import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AnnotationTooltipComponent } from '../../entities/annotation/ui/annotation-tooltip/annotation-tooltip.component';
import { Annotation } from '../../entities/annotation/model/annotation.model';
import { AnnotationStateService } from '../../entities/annotation/model/annotation-state.service';
import {
  ArticleContentRendererService,
  RenderedArticleParagraph,
} from '../../widgets/article-content/lib/article-content-renderer.service';
import { ArticleStateService } from '../../entities/article/model/article-state.service';
import {
  getArticleDeleteSuccessMessage,
  getArticleManagementErrorMessage,
} from '../../features/manage-article/lib/article-feedback.util';
import { ArticleManagementService } from '../../features/manage-article/model/article-management.service';
import {
  AnnotationInteractionService,
  resolveSelectionPromptPlacement,
} from '../../features/manage-annotation/model/annotation-interaction.service';
import { AnnotationFormComponent } from '../../features/manage-annotation/ui/annotation-form/annotation-form.component';
import { focusFirstElement, keepFocusWithinContainer } from '../../shared/lib/a11y/focus-trap.util';
import { ToastService } from '../../shared/lib/toast/toast.service';
import { isDirectImageUrl } from '../../shared/lib/url/url-preview.util';
import { HideBrokenImageDirective } from '../../shared/ui/image/hide-broken-image.directive';

@Component({
  selector: 'app-article-viewer',
  imports: [
    RouterLink,
    AnnotationFormComponent,
    AnnotationTooltipComponent,
    HideBrokenImageDirective,
  ],
  templateUrl: './article-viewer.component.html',
  styleUrl: './article-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AnnotationInteractionService],
})
export class ArticleViewerComponent {
  /** Документ текущей страницы. */
  private readonly document = inject(DOCUMENT);

  /** Доступ к параметрам маршрута. */
  private readonly route = inject(ActivatedRoute);

  /** Состояние статей приложения. */
  private readonly articleState = inject(ArticleStateService);

  /** Сервис удаления статьи. */
  private readonly articleManagement = inject(ArticleManagementService);

  /** Состояние аннотаций статьи. */
  private readonly annotationState = inject(AnnotationStateService);

  /** Рендерер текста статьи с подсветкой аннотаций. */
  private readonly articleContentRenderer = inject(ArticleContentRendererService);

  /** Локальный сервис UI-взаимодействий с аннотациями на экране просмотра. */
  protected readonly annotationInteraction = inject(AnnotationInteractionService);

  /** Сервис уведомлений. */
  private readonly toastService = inject(ToastService);

  /** Роутер для переходов после удаления статьи. */
  private readonly router = inject(Router);

  /** Идентификатор отложенного кадра захвата выделения. */
  private selectionCaptureFrameId: number | null = null;

  /** Ссылка на выпадающее меню действий статьи. */
  private readonly actionMenuElement = viewChild<ElementRef<HTMLElement>>('actionMenu');

  /** Ссылка на кнопку открытия меню действий. */
  private readonly actionMenuTriggerElement =
    viewChild<ElementRef<HTMLElement>>('actionMenuTrigger');

  /** Ссылка на popover для создания аннотации. */
  private readonly selectionPromptElement =
    viewChild<ElementRef<HTMLElement>>('selectionPromptElement');

  /** Ссылка на диалог редактирования аннотации. */
  private readonly annotationDialogElement = viewChild<ElementRef<HTMLElement>>('annotationDialog');

  /** Ссылка на контейнер отрендеренного текста статьи. */
  private readonly articleContentElement = viewChild<ElementRef<HTMLElement>>('articleContent');

  /** Элемент для возврата фокуса после закрытия меню действий. */
  private actionMenuReturnFocusElement: HTMLElement | null = null;

  /** Элемент для возврата фокуса после закрытия popover выделения. */
  private selectionPromptReturnFocusElement: HTMLElement | null = null;

  /** Элемент для возврата фокуса после закрытия диалога аннотации. */
  private annotationDialogReturnFocusElement: HTMLElement | null = null;

  /** Флаг открытия меню действий статьи. */
  protected readonly isActionMenuOpen = signal(false);

  /** Идентификатор статьи из маршрута. */
  protected readonly articleId = toSignal(
    this.route.paramMap.pipe(map((paramMap) => paramMap.get('articleId'))),
    {
      initialValue: this.route.snapshot.paramMap.get('articleId'),
    },
  );

  /** Активная статья из состояния приложения. */
  protected readonly article = toSignal(this.articleState.activeArticle$, { initialValue: null });

  /** Все аннотации из состояния приложения. */
  protected readonly annotations = toSignal(this.annotationState.annotations$, {
    initialValue: [],
  });

  /** Признак отсутствия статьи по текущему маршруту. */
  protected readonly isMissingArticle = computed(
    () => this.articleId() !== null && this.article() === null,
  );

  /** Заголовок вкладки/экрана. */
  protected readonly screenTitle = computed(
    () => this.article()?.title ?? (this.isMissingArticle() ? 'Статья не найдена' : 'Статья'),
  );

  /** Заголовок статьи для отображения в интерфейсе. */
  protected readonly articleTitle = computed(() => this.article()?.title ?? 'Статья не найдена');

  /** Прямая ссылка на изображение-превью, если она валидна. */
  protected readonly titlePreviewImageUrl = computed(() =>
    isDirectImageUrl(this.article()?.titleUrl) ? (this.article()?.titleUrl ?? null) : null,
  );

  /** Аннотации текущей статьи, отсортированные по позиции в тексте. */
  protected readonly articleAnnotations = computed(() => {
    const articleId = this.articleId();

    if (!articleId) {
      return [];
    }

    return this.annotations()
      .filter((annotation) => annotation.articleId === articleId)
      .sort(
        (leftAnnotation, rightAnnotation) =>
          leftAnnotation.startOffset - rightAnnotation.startOffset,
      );
  });

  /** Готовая структура статьи для шаблона с абзацами и сегментами. */
  protected readonly renderedArticle = computed<RenderedArticleParagraph[]>(() => {
    const article = this.article();

    if (!article) {
      return [];
    }

    return this.articleContentRenderer.render(article.content, this.articleAnnotations());
  });

  /** Подписывает экран на смену статьи и управляет фокусом модальных элементов. */
  constructor() {
    effect(
      () => {
        const articleId = this.articleId();

        this.articleState.selectArticle(articleId);
        this.annotationInteraction.reset();
        this.isActionMenuOpen.set(false);
        this.actionMenuReturnFocusElement = null;
        this.selectionPromptReturnFocusElement = null;
        this.annotationDialogReturnFocusElement = null;
        this.cancelSelectionCapture();
      },
      { allowSignalWrites: true },
    );

    effect((onCleanup) => {
      if (!this.annotationInteraction.annotationDialog()) {
        return;
      }

      const body = this.document.body;
      const previousOverflow = body.style.overflow;
      const previousPaddingRight = body.style.paddingRight;
      const windowRef = this.document.defaultView;
      const scrollbarWidth = windowRef
        ? Math.max(0, windowRef.innerWidth - this.document.documentElement.clientWidth)
        : 0;

      // Компенсируем исчезновение полосы прокрутки, чтобы макет не "прыгал" при открытии диалога.
      body.style.overflow = 'hidden';

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }

      onCleanup(() => {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      });
    });

    effect((onCleanup) => {
      if (!this.isActionMenuOpen()) {
        return;
      }

      const menuElement = this.actionMenuElement()?.nativeElement;

      if (!menuElement || menuElement.contains(this.document.activeElement)) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        focusFirstElement(menuElement);
      });

      onCleanup(() => {
        window.cancelAnimationFrame(frameId);
      });
    });

    effect((onCleanup) => {
      const prompt = this.annotationInteraction.selectionPrompt();
      const promptElement = this.selectionPromptElement()?.nativeElement;

      if (!prompt || !promptElement) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        const promptRect = promptElement.getBoundingClientRect();
        const nextPlacement = resolveSelectionPromptPlacement(
          {
            top: prompt.anchorTop,
            bottom: prompt.anchorBottom,
            centerX: prompt.anchorCenterX,
          },
          {
            width: promptRect.width || promptElement.offsetWidth || 320,
            height: promptRect.height || promptElement.offsetHeight || 104,
          },
        );

        if (
          prompt.top === nextPlacement.top &&
          prompt.left === nextPlacement.left &&
          prompt.placement === nextPlacement.placement
        ) {
          return;
        }

        // После реального измерения пересчитываем позицию, чтобы popover не уехал за экран.
        this.annotationInteraction.selectionPrompt.set({
          ...prompt,
          ...nextPlacement,
        });
      });

      onCleanup(() => {
        window.cancelAnimationFrame(frameId);
      });
    });

    effect((onCleanup) => {
      const prompt = this.annotationInteraction.selectionPrompt();
      const promptElement = this.selectionPromptElement()?.nativeElement;

      if (!prompt || !promptElement || promptElement.contains(this.document.activeElement)) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        if (!promptElement.contains(this.document.activeElement)) {
          focusFirstElement(promptElement);
        }
      });

      onCleanup(() => {
        window.cancelAnimationFrame(frameId);
      });
    });

    effect((onCleanup) => {
      if (!this.annotationInteraction.annotationDialog()) {
        return;
      }

      const dialogElement = this.annotationDialogElement()?.nativeElement;

      if (!dialogElement || dialogElement.contains(this.document.activeElement)) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        if (!dialogElement.contains(this.document.activeElement)) {
          focusFirstElement(dialogElement);
        }
      });

      onCleanup(() => {
        window.cancelAnimationFrame(frameId);
      });
    });
  }

  /** Удаляет текущую статью после подтверждения пользователя. */
  protected async deleteArticle() {
    const article = this.article();

    if (!article) {
      return;
    }

    this.closeActionMenu({ restoreFocus: false });

    const annotationCount = this.annotationState.getAnnotationCount(article.id);
    const confirmMessage =
      annotationCount > 0
        ? `Удалить статью "${article.title}"? Вместе с ней будут удалены ${annotationCount} аннотаций.`
        : `Удалить статью "${article.title}"?`;
    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      return;
    }

    const result = this.articleManagement.deleteArticle(article.id);

    if (result.deleted) {
      this.toastService.success(getArticleDeleteSuccessMessage(result.deletedAnnotationsCount));
      await this.router.navigate(['/articles']);
      return;
    }

    if (result.error) {
      this.toastService.error(getArticleManagementErrorMessage(result.error, 'delete'));
    }
  }

  /** Переключает меню действий статьи. */
  protected toggleActionMenu(event?: Event) {
    event?.stopPropagation();

    if (this.isActionMenuOpen()) {
      this.closeActionMenu({ restoreFocus: true });
      return;
    }

    this.actionMenuReturnFocusElement =
      event?.currentTarget instanceof HTMLElement ? event.currentTarget : this.getActiveElement();
    this.isActionMenuOpen.set(true);
  }

  /** Закрывает меню действий и при необходимости возвращает фокус. */
  protected closeActionMenu(options?: { restoreFocus?: boolean }) {
    const shouldRestoreFocus = options?.restoreFocus ?? false;

    this.isActionMenuOpen.set(false);

    if (shouldRestoreFocus) {
      this.focusElement(
        this.actionMenuReturnFocusElement ?? this.actionMenuTriggerElement()?.nativeElement ?? null,
      );
    }
  }

  /** Откладывает чтение выделения до следующего кадра после завершения выбора текста. */
  protected queueSelectionCapture(container: HTMLElement) {
    if (this.annotationInteraction.annotationDialog()) {
      return;
    }

    this.cancelSelectionCapture();
    this.selectionCaptureFrameId = window.requestAnimationFrame(() => {
      this.selectionCaptureFrameId = null;
      const activeElement = this.getActiveElement() ?? container;
      const didHandleSelection = this.annotationInteraction.captureSelection(
        this.article(),
        container,
      );

      if (didHandleSelection) {
        this.closeActionMenu({ restoreFocus: false });
      }

      if (this.annotationInteraction.selectionPrompt()) {
        // Запоминаем текущий фокус, чтобы вернуть его после закрытия popover выделения.
        this.selectionPromptReturnFocusElement = activeElement;
      }
    });
  }

  /** Сбрасывает временные popover-элементы при изменении размеров или прокрутке окна. */
  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected clearTooltipOnViewportChange() {
    this.cancelSelectionCapture();
    const hadSelectionPrompt = this.annotationInteraction.selectionPrompt() !== null;
    this.annotationInteraction.clearTransientUi();
    this.closeActionMenu({ restoreFocus: false });

    if (hadSelectionPrompt) {
      this.restoreSelectionPromptFocus(this.articleContentElement()?.nativeElement ?? null);
    }
  }

  /** Закрывает popover выделения и возвращает фокус в текст статьи. */
  protected dismissSelectionPrompt() {
    this.cancelSelectionCapture();
    this.annotationInteraction.dismissSelectionPrompt();
    this.restoreSelectionPromptFocus(this.articleContentElement()?.nativeElement ?? null);
  }

  /** Запускает обработку выделения после завершения жеста выбора текста. */
  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  protected handleDocumentSelectionEnd() {
    const container = this.articleContentElement()?.nativeElement;

    if (!container || this.annotationInteraction.annotationDialog()) {
      return;
    }

    this.queueSelectionCapture(container);
  }

  /** Закрывает меню действий при клике вне него. */
  @HostListener('document:click')
  protected handleDocumentClick() {
    this.closeActionMenu({ restoreFocus: false });
  }

  /** Обрабатывает навигацию с клавиатуры между меню, popover и диалогом аннотации. */
  @HostListener('document:keydown', ['$event'])
  protected handleDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      if (this.annotationInteraction.annotationDialog()) {
        const dialogElement = this.annotationDialogElement()?.nativeElement;

        if (dialogElement) {
          keepFocusWithinContainer(event, dialogElement);
        }
        return;
      }

      if (this.annotationInteraction.selectionPrompt()) {
        const promptElement = this.selectionPromptElement()?.nativeElement;

        if (promptElement) {
          keepFocusWithinContainer(event, promptElement);
        }
        return;
      }

      if (this.isActionMenuOpen()) {
        const menuElement = this.actionMenuElement()?.nativeElement;

        if (menuElement) {
          keepFocusWithinContainer(event, menuElement);
        }
      }
      return;
    }

    if (event.key !== 'Escape') {
      return;
    }

    if (this.isActionMenuOpen()) {
      event.preventDefault();
      this.closeActionMenu({ restoreFocus: true });
      return;
    }

    if (this.annotationInteraction.annotationDialog()) {
      event.preventDefault();
      this.cancelAnnotation();
      return;
    }

    if (this.annotationInteraction.selectionPrompt()) {
      event.preventDefault();
      this.dismissSelectionPrompt();
      return;
    }

    this.annotationInteraction.hideTooltip();
  }

  /** Отменяет отложенный захват выделения текста. */
  private cancelSelectionCapture() {
    if (this.selectionCaptureFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.selectionCaptureFrameId);
    this.selectionCaptureFrameId = null;
  }

  /** Открывает диалог создания аннотации для текущего выделения. */
  protected openCreateAnnotationDialog() {
    this.annotationDialogReturnFocusElement =
      this.articleContentElement()?.nativeElement ?? this.getActiveElement();
    this.annotationInteraction.openCreateAnnotationDialog();
  }

  /** Открывает редактор существующей аннотации по клику мышью. */
  protected openAnnotationEditor(event: MouseEvent, annotation: Annotation) {
    this.annotationDialogReturnFocusElement =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : this.getActiveElement();
    this.annotationInteraction.openAnnotationEditor(event, annotation);
  }

  /** Открывает редактор существующей аннотации по клавиатуре. */
  protected openAnnotationEditorFromKeyboard(event: KeyboardEvent, annotation: Annotation) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    this.annotationDialogReturnFocusElement =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : this.getActiveElement();
    this.annotationInteraction.openAnnotationEditorFromKeyboard(event, annotation);
  }

  /** Сохраняет аннотацию и восстанавливает фокус после закрытия диалога. */
  protected saveAnnotation(formValue: { comment: string; color: string }) {
    this.annotationInteraction.saveAnnotation(this.article()?.id ?? null, formValue);

    if (!this.annotationInteraction.annotationDialog()) {
      this.restoreAnnotationDialogFocus();
    }
  }

  /** Закрывает диалог аннотации без сохранения. */
  protected cancelAnnotation() {
    this.annotationInteraction.cancelAnnotation();
    this.restoreAnnotationDialogFocus();
  }

  /** Удаляет аннотацию и восстанавливает фокус после закрытия диалога. */
  protected deleteAnnotation() {
    this.annotationInteraction.deleteAnnotation();

    if (!this.annotationInteraction.annotationDialog()) {
      this.restoreAnnotationDialogFocus();
    }
  }

  /** Возвращает фокус после закрытия popover выделения. */
  private restoreSelectionPromptFocus(fallbackElement: HTMLElement | null) {
    const targetElement = this.selectionPromptReturnFocusElement?.isConnected
      ? this.selectionPromptReturnFocusElement
      : fallbackElement;

    this.focusElement(targetElement);
    this.selectionPromptReturnFocusElement = null;
  }

  /** Возвращает фокус после закрытия диалога аннотации. */
  private restoreAnnotationDialogFocus() {
    const fallbackElement = this.articleContentElement()?.nativeElement ?? null;
    const targetElement = this.annotationDialogReturnFocusElement?.isConnected
      ? this.annotationDialogReturnFocusElement
      : fallbackElement;

    this.focusElement(targetElement);
    this.annotationDialogReturnFocusElement = null;
  }

  /** Возвращает текущий активный элемент документа, если это HTMLElement. */
  private getActiveElement(): HTMLElement | null {
    return this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null;
  }

  /** Безопасно переводит фокус на элемент в следующем кадре. */
  private focusElement(element: HTMLElement | null) {
    if (!element || !element.isConnected) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (element.isConnected) {
        element.focus();
      }
    });
  }
}
