import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { AnnotationStateService } from '../../entities/annotation/model/annotation-state.service';
import { ArticleStateService } from '../../entities/article/model/article-state.service';
import {
  ARTICLE_CREATE_SUCCESS_MESSAGE,
  getArticleManagementErrorMessage,
  getArticleUpdateSuccessMessage,
} from '../../features/manage-article/lib/article-feedback.util';
import { ArticleManagementService } from '../../features/manage-article/model/article-management.service';
import { NavigationHistoryService } from '../../shared/lib/navigation/navigation-history.service';
import { ToastService } from '../../shared/lib/toast/toast.service';
import { isDirectImageUrl } from '../../shared/lib/url/url-preview.util';
import { optionalImageUrl } from '../../shared/lib/validators/optional-image-url.validator';
import { trimmedRequired } from '../../shared/lib/validators/trimmed-required.validator';
import { HideBrokenImageDirective } from '../../shared/ui/image/hide-broken-image.directive';
import { ArticleContentRendererService } from '../../widgets/article-content/lib/article-content-renderer.service';

@Component({
  selector: 'app-article-editor',
  imports: [ReactiveFormsModule, RouterLink, HideBrokenImageDirective],
  templateUrl: './article-editor.component.html',
  styleUrl: './article-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleEditorComponent {
  /** Построитель реактивной формы статьи. */
  private readonly formBuilder = inject(FormBuilder);

  /** Состояние статей приложения. */
  private readonly articleState = inject(ArticleStateService);

  /** Сервис создания и обновления статей. */
  private readonly articleManagement = inject(ArticleManagementService);

  /** Состояние аннотаций для подсчёта связанных выделений. */
  private readonly annotationState = inject(AnnotationStateService);

  /** Рендерер превью содержимого статьи. */
  private readonly articleContentRenderer = inject(ArticleContentRendererService);

  /** Сервис возврата на предыдущий экран. */
  private readonly navigationHistory = inject(NavigationHistoryService);

  /** Сервис всплывающих уведомлений. */
  private readonly toastService = inject(ToastService);

  /** Доступ к параметрам маршрута. */
  private readonly route = inject(ActivatedRoute);

  /** Роутер для переходов после сохранения. */
  private readonly router = inject(Router);

  /** Идентификатор статьи, уже подставленной в форму. */
  private readonly hydratedArticleId = signal<string | null>(null);

  /** Флаг текущей отправки формы. */
  protected readonly isSubmitting = signal(false);

  /** Флаг режима предпросмотра. */
  protected readonly isPreviewMode = signal(false);

  /** Идентификатор статьи из маршрута. */
  protected readonly articleId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('articleId'))),
    {
      initialValue: this.route.snapshot.paramMap.get('articleId'),
    },
  );

  /** Активная статья из состояния приложения. */
  protected readonly article = toSignal(this.articleState.activeArticle$, { initialValue: null });

  /** Признак режима редактирования существующей статьи. */
  protected readonly isEditMode = computed(() => this.articleId() !== null);

  /** Признак отсутствия статьи при открытом режиме редактирования. */
  protected readonly isMissingArticle = computed(
    () => this.isEditMode() && this.articleId() !== null && this.article() === null,
  );

  /** Количество аннотаций текущей статьи. */
  protected readonly annotationCount = computed(() =>
    this.articleId() ? this.annotationState.getAnnotationCount(this.articleId()!) : 0,
  );

  /** Заголовок экрана по текущему режиму. */
  protected readonly screenTitle = computed(() =>
    this.isEditMode() ? 'Редактирование статьи' : 'Создание статьи',
  );

  /** Вводный текст экрана по текущему режиму. */
  protected readonly screenLead = computed(() =>
    this.isEditMode()
      ? 'Измени заголовок, ссылку на изображение или текст статьи. Если текст изменится и у статьи есть аннотации, приложение запросит подтверждение на их сброс.'
      : 'Добавь заголовок, опциональную ссылку на изображение и текст, чтобы новая статья сразу появилась в списке.',
  );

  /** Подпись переключателя режима предпросмотра. */
  protected readonly previewToggleLabel = computed(() =>
    this.isPreviewMode() ? 'Редактировать' : 'Превью',
  );

  /** Реактивная форма редактирования статьи. */
  protected readonly articleForm = this.formBuilder.nonNullable.group({
    title: ['', [trimmedRequired]],
    titleUrl: ['', [optionalImageUrl]],
    content: ['', [trimmedRequired]],
  });

  /** Данные для живого предпросмотра содержимого статьи. */
  protected readonly articlePreview = toSignal(
    this.articleForm.valueChanges.pipe(
      map(() => this.getPreviewDraft()),
      startWith(this.getPreviewDraft()),
    ),
    {
      initialValue: this.getPreviewDraft(),
    },
  );

  /** Синхронизирует форму с маршрутом и выбранной статьёй. */
  constructor() {
    effect(
      () => {
        this.articleState.selectArticle(this.articleId());
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const article = this.article();

      if (!article) {
        return;
      }

      if (this.hydratedArticleId() === article.id) {
        return;
      }

      // Повторно заполняем форму только при фактической смене статьи, чтобы не затереть пользовательский ввод.
      this.articleForm.reset({
        title: article.title,
        titleUrl: article.titleUrl ?? '',
        content: article.content,
      });
      this.isPreviewMode.set(false);
      this.hydratedArticleId.set(article.id);
    });
  }

  /** Создаёт новую статью или сохраняет изменения существующей. */
  protected async submit() {
    if (this.articleForm.invalid) {
      this.isPreviewMode.set(false);
      this.articleForm.markAllAsTouched();
      return;
    }

    if (this.isEditMode() && this.isMissingArticle()) {
      return;
    }

    this.isSubmitting.set(true);

    try {
      if (this.isEditMode()) {
        const currentArticle = this.article();

        if (!currentArticle) {
          return;
        }

        const draft = this.articleForm.getRawValue();
        const textChanged = draft.content !== currentArticle.content;
        const annotationCount = this.annotationCount();

        if (textChanged && annotationCount > 0) {
          // При изменении текста абсолютные смещения аннотаций перестают быть валидными.
          const confirmed = window.confirm(
            `У статьи есть ${annotationCount} аннотаций. При изменении текста они будут удалены. Продолжить?`,
          );

          if (!confirmed) {
            return;
          }
        }

        const result = this.articleManagement.updateArticle(currentArticle.id, draft, {
          clearAnnotations: textChanged && annotationCount > 0,
        });

        if (result.article) {
          this.toastService.success(getArticleUpdateSuccessMessage(result.deletedAnnotationsCount));
          await this.router.navigate(['/articles']);
          return;
        }

        this.toastService.error(getArticleManagementErrorMessage(result.error!, 'update'));
      } else {
        const result = this.articleManagement.createArticle(this.articleForm.getRawValue());

        if (result.article) {
          this.toastService.success(ARTICLE_CREATE_SUCCESS_MESSAGE);
          await this.router.navigate(['/articles']);
          return;
        }

        this.toastService.error(getArticleManagementErrorMessage('storage_unavailable', 'create'));
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Переключает режим предпросмотра формы. */
  protected togglePreviewMode() {
    this.isPreviewMode.update((value) => !value);
  }

  /** Возвращает пользователя на предыдущий экран или в резервный маршрут. */
  protected async goBack() {
    const fallbackUrl =
      this.isEditMode() && this.articleId() ? `/articles/${this.articleId()}` : '/articles';

    await this.navigationHistory.back(fallbackUrl);
  }

  /** Проверяет, нужно ли показывать ошибку указанного поля формы. */
  protected hasControlError(controlName: 'title' | 'titleUrl' | 'content') {
    const control = this.articleForm.controls[controlName];

    return control.invalid && (control.touched || control.dirty);
  }

  /** Собирает данные для режима предпросмотра. */
  private getPreviewDraft() {
    const draft = this.articleForm.getRawValue();
    const normalizedTitle = draft.title.trim();
    const normalizedTitleUrl = draft.titleUrl.trim();
    const previewContent = draft.content;

    return {
      title: normalizedTitle || 'Без названия',
      titleUrl: isDirectImageUrl(normalizedTitleUrl) ? normalizedTitleUrl : null,
      content: previewContent,
      renderedParagraphs: this.articleContentRenderer.render(previewContent, []),
    };
  }
}
