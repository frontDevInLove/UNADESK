import { DOCUMENT, DatePipe } from '@angular/common';
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
import { Router, RouterLink } from '@angular/router';
import { AnnotationStateService } from '../../entities/annotation/model/annotation-state.service';
import { ArticleStateService } from '../../entities/article/model/article-state.service';
import {
  getArticleDeleteSuccessMessage,
  getArticleManagementErrorMessage,
} from '../../features/manage-article/lib/article-feedback.util';
import { ArticleManagementService } from '../../features/manage-article/model/article-management.service';
import { focusFirstElement, keepFocusWithinContainer } from '../../shared/lib/a11y/focus-trap.util';
import { ToastService } from '../../shared/lib/toast/toast.service';
import { isDirectImageUrl } from '../../shared/lib/url/url-preview.util';
import { HideBrokenImageDirective } from '../../shared/ui/image/hide-broken-image.directive';

interface PendingDeleteDialog {
  /** Идентификатор статьи, ожидающей удаления. */
  articleId: string;

  /** Заголовок статьи для текста подтверждения. */
  articleTitle: string;

  /** Количество связанных аннотаций. */
  annotationCount: number;
}

@Component({
  selector: 'app-article-list',
  imports: [RouterLink, DatePipe, HideBrokenImageDirective],
  templateUrl: './article-list.component.html',
  styleUrl: './article-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleListComponent {
  /** Длина превью для карточки без изображения. */
  private readonly defaultPreviewLength = 220;

  /** Длина превью для карточки с изображением. */
  private readonly expandedPreviewLength = 420;

  /** Документ текущей страницы. */
  private readonly document = inject(DOCUMENT);

  /** Состояние статей приложения. */
  private readonly articleState = inject(ArticleStateService);

  /** Сервис удаления статей. */
  private readonly articleManagement = inject(ArticleManagementService);

  /** Состояние аннотаций для подсчёта связанных записей. */
  private readonly annotationState = inject(AnnotationStateService);

  /** Сервис уведомлений. */
  private readonly toastService = inject(ToastService);

  /** Роутер для перехода к просмотру статьи. */
  private readonly router = inject(Router);

  /** Ссылка на элемент диалога подтверждения удаления. */
  private readonly deleteDialogElement = viewChild<ElementRef<HTMLElement>>('deleteDialog');

  /** Элемент, который открыл меню действий статьи. */
  private actionMenuTriggerElement: HTMLElement | null = null;

  /** Элемент, которому нужно вернуть фокус после закрытия диалога. */
  private deleteDialogReturnFocusElement: HTMLElement | null = null;

  /** Реактивный список статей. */
  protected readonly articles = toSignal(this.articleState.articles$, { initialValue: [] });

  /** Идентификатор статьи с открытым меню действий. */
  protected readonly openedActionMenuId = signal<string | null>(null);

  /** Состояние диалога удаления статьи. */
  protected readonly pendingDeleteDialog = signal<PendingDeleteDialog | null>(null);

  /** Статьи, отсортированные по дате создания. */
  protected readonly sortedArticles = computed(() =>
    [...this.articles()].sort(
      (leftArticle, rightArticle) =>
        Date.parse(rightArticle.createdAt) - Date.parse(leftArticle.createdAt),
    ),
  );

  /** Признак наличия хотя бы одной статьи. */
  protected readonly hasArticles = computed(() => this.articles().length > 0);

  /** Управляет автофокусом внутри диалога удаления. */
  constructor() {
    effect((onCleanup) => {
      if (!this.pendingDeleteDialog()) {
        return;
      }

      const dialogElement = this.deleteDialogElement()?.nativeElement;

      if (!dialogElement) {
        return;
      }

      const frameId = window.requestAnimationFrame(() => {
        focusFirstElement(dialogElement);
      });

      onCleanup(() => {
        window.cancelAnimationFrame(frameId);
      });
    });
  }

  /** Открывает диалог подтверждения удаления статьи. */
  protected requestDeleteArticle(articleId: string, articleTitle: string) {
    this.deleteDialogReturnFocusElement = this.actionMenuTriggerElement;
    this.closeActionMenu({ restoreFocus: false });

    const annotationCount = this.annotationState.getAnnotationCount(articleId);
    this.pendingDeleteDialog.set({
      articleId,
      articleTitle,
      annotationCount,
    });
  }

  /** Подтверждает удаление статьи и показывает итоговое уведомление. */
  protected confirmDeleteArticle() {
    const pendingDeleteDialog = this.pendingDeleteDialog();

    if (!pendingDeleteDialog) {
      return;
    }

    const result = this.articleManagement.deleteArticle(pendingDeleteDialog.articleId);

    if (result.error) {
      this.toastService.error(getArticleManagementErrorMessage(result.error, 'delete'));
    } else if (result.deleted) {
      this.toastService.success(getArticleDeleteSuccessMessage(result.deletedAnnotationsCount));
    }

    this.pendingDeleteDialog.set(null);
    this.restoreDeleteDialogFocus();
  }

  /** Закрывает диалог удаления без выполнения операции. */
  protected cancelDeleteArticle() {
    this.pendingDeleteDialog.set(null);
    this.restoreDeleteDialogFocus();
  }

  /** Возвращает ссылку на превью, если это прямой URL изображения. */
  protected getTitlePreviewUrl(titleUrl: string | undefined): string | null {
    return isDirectImageUrl(titleUrl) ? titleUrl : null;
  }

  /** Обрезает текст статьи для карточки списка. */
  protected getArticlePreview(content: string, hasImagePreview = false): string {
    const maxLength = hasImagePreview ? this.expandedPreviewLength : this.defaultPreviewLength;

    return content.length > maxLength ? `${content.slice(0, maxLength)}...` : content;
  }

  /** Открывает экран просмотра статьи. */
  protected openArticle(articleId: string) {
    if (this.pendingDeleteDialog()) {
      return;
    }

    this.closeActionMenu({ restoreFocus: false });
    void this.router.navigate(['/articles', articleId]);
  }

  /** Открывает статью по клавиатуре, если фокус не находится на интерактивном элементе. */
  protected openArticleFromKeyboard(event: KeyboardEvent, articleId: string) {
    if (this.isInteractiveTarget(event.target)) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openArticle(articleId);
  }

  /** Переключает выпадающее меню действий карточки статьи. */
  protected toggleActionMenu(articleId: string, event?: Event) {
    event?.stopPropagation();
    const triggerElement = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const isOpening = this.openedActionMenuId() !== articleId;

    if (isOpening && triggerElement) {
      this.actionMenuTriggerElement = triggerElement;
    }

    this.openedActionMenuId.set(isOpening ? articleId : null);

    if (isOpening && triggerElement) {
      window.requestAnimationFrame(() => {
        // Меню рендерится после смены сигнала, поэтому ищем его в следующем кадре.
        const menuElement = triggerElement
          .closest('.article-card__menu')
          ?.querySelector<HTMLElement>('.article-card__menu-list');

        if (menuElement) {
          focusFirstElement(menuElement);
        }
      });
      return;
    }

    if (!isOpening) {
      this.focusElement(this.actionMenuTriggerElement);
    }
  }

  /** Закрывает меню действий и при необходимости возвращает фокус на триггер. */
  protected closeActionMenu(options?: { restoreFocus?: boolean }) {
    const shouldRestoreFocus = options?.restoreFocus ?? false;
    const hadOpenedMenu = this.openedActionMenuId() !== null;

    this.openedActionMenuId.set(null);

    if (shouldRestoreFocus && hadOpenedMenu) {
      this.focusElement(this.actionMenuTriggerElement);
    }
  }

  /** Проверяет, открыто ли меню действий для указанной статьи. */
  protected isActionMenuOpen(articleId: string): boolean {
    return this.openedActionMenuId() === articleId;
  }

  /** Проверяет, был ли клик или клавиатурное событие инициировано интерактивным элементом. */
  private isInteractiveTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      target.closest('a, button, input, textarea, select, [role="menuitem"]') !== null
    );
  }

  /** Закрывает меню действий при клике вне карточки. */
  @HostListener('document:click')
  protected handleDocumentClick() {
    this.closeActionMenu({ restoreFocus: false });
  }

  /** Обрабатывает клавиатурную навигацию для диалога и меню действий. */
  @HostListener('document:keydown', ['$event'])
  protected handleDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab' && this.pendingDeleteDialog()) {
      const dialogElement = this.deleteDialogElement()?.nativeElement;

      if (dialogElement) {
        keepFocusWithinContainer(event, dialogElement);
      }
      return;
    }

    if (event.key === 'Tab') {
      const menuElement = this.getOpenedActionMenuElement();

      if (menuElement) {
        keepFocusWithinContainer(event, menuElement);
      }
      return;
    }

    if (event.key !== 'Escape') {
      return;
    }

    if (this.pendingDeleteDialog()) {
      event.preventDefault();
      this.cancelDeleteArticle();
      return;
    }

    if (this.openedActionMenuId()) {
      event.preventDefault();
      this.closeActionMenu({ restoreFocus: true });
    }
  }

  /** Возвращает фокус элементу, который открыл диалог удаления. */
  private restoreDeleteDialogFocus() {
    this.focusElement(this.deleteDialogReturnFocusElement);
    this.deleteDialogReturnFocusElement = null;
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

  /** Возвращает DOM-элемент открытого меню действий. */
  private getOpenedActionMenuElement(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>('.article-card__menu-list');
  }
}
