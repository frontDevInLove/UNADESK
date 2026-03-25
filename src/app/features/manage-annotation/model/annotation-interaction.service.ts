import { Injectable, inject, signal } from '@angular/core';
import { DEFAULT_ANNOTATION_COLOR } from '../../../entities/annotation/lib/annotation-colors';
import { Annotation } from '../../../entities/annotation/model/annotation.model';
import {
  AnnotationMutationError,
  AnnotationStateService,
} from '../../../entities/annotation/model/annotation-state.service';
import { SelectionService } from '../../../shared/lib/dom/selection.service';
import { TextSelectionRange } from '../../../shared/lib/dom/text-selection.model';
import { isLocalStorageWriteError } from '../../../shared/lib/storage/local-storage.util';
import { ToastService } from '../../../shared/lib/toast/toast.service';
import {
  ANNOTATION_DELETE_SUCCESS_MESSAGE,
  getAnnotationErrorMessage,
  getAnnotationSaveSuccessMessage,
} from '../lib/annotation-feedback.util';

export interface AnnotationTooltipState {
  /** Текст комментария в подсказке. */
  comment: string;

  /** Цвет связанной подсветки. */
  color: string;

  /** Вертикальная координата подсказки. */
  top: number;

  /** Горизонтальная координата подсказки. */
  left: number;
}

export interface SelectionPromptState {
  /** Текст текущего выделения. */
  selectedText: string;

  /** Начало выделения в тексте статьи. */
  startOffset: number;

  /** Конец выделения в тексте статьи. */
  endOffset: number;

  /** Вертикальная координата попапа. */
  top: number;

  /** Горизонтальная координата попапа. */
  left: number;

  /** Верхняя граница якорного прямоугольника выделения. */
  anchorTop: number;

  /** Нижняя граница якорного прямоугольника выделения. */
  anchorBottom: number;

  /** Центр якоря по оси X. */
  anchorCenterX: number;

  /** Сторона расположения попапа относительно выделения. */
  placement: 'above' | 'below';
}

export interface AnnotationDialogState {
  /** Режим формы аннотации. */
  mode: 'create' | 'edit';

  /** Текст выделенного или уже аннотированного фрагмента. */
  selectedText: string;

  /** Ключ для принудительной синхронизации формы. */
  selectionKey: string;

  /** Начальный комментарий формы. */
  initialComment: string;

  /** Начальный цвет формы. */
  initialColor: string;

  /** Идентификатор редактируемой аннотации. */
  annotationId: string | null;

  /** Начальное смещение выделения для новой аннотации. */
  startOffset: number | null;

  /** Конечное смещение выделения для новой аннотации. */
  endOffset: number | null;
}

@Injectable()
export class AnnotationInteractionService {
  /** Состояние доменной модели аннотаций. */
  private readonly annotationState = inject(AnnotationStateService);

  /** Сервис чтения текстового выделения из DOM. */
  private readonly selectionService = inject(SelectionService);

  /** Сервис всплывающих уведомлений. */
  private readonly toastService = inject(ToastService);

  /** Состояние попапа с предложением создать аннотацию. */
  readonly selectionPrompt = signal<SelectionPromptState | null>(null);

  /** Состояние диалога создания или редактирования аннотации. */
  readonly annotationDialog = signal<AnnotationDialogState | null>(null);

  /** Состояние всплывающей подсказки над существующей аннотацией. */
  readonly tooltipState = signal<AnnotationTooltipState | null>(null);

  /** Флаг активного сохранения аннотации. */
  readonly isSaving = signal(false);

  /** Флаг активного удаления аннотации. */
  readonly isDeleting = signal(false);

  /** Полностью сбрасывает временное UI-состояние работы с аннотациями. */
  reset() {
    this.selectionPrompt.set(null);
    this.annotationDialog.set(null);
    this.tooltipState.set(null);
    this.isSaving.set(false);
    this.isDeleting.set(false);
    this.selectionService.clearSelection();
  }

  /** Считывает текущее выделение и открывает попап создания аннотации. */
  captureSelection(
    article: { id: string; content: string } | null,
    container: HTMLElement,
  ): boolean {
    if (!article) {
      return false;
    }

    const selection = this.selectionService.getSelection(container, article.content);
    const selectionRect = this.selectionService.getSelectionRect(container);

    if (!selection || !selectionRect) {
      this.selectionPrompt.set(null);
      return false;
    }

    this.hideTooltip();

    const validationError = this.annotationState.validateSelection(
      article.id,
      selection.startOffset,
      selection.endOffset,
    );

    if (validationError) {
      this.selectionPrompt.set(null);
      this.annotationDialog.set(null);
      this.selectionService.clearSelection();
      this.toastService.error(getAnnotationErrorMessage(validationError));
      return true;
    }

    this.selectionPrompt.set(this.createSelectionPrompt(selection, selectionRect));
    return true;
  }

  /** Открывает диалог создания аннотации для текущего выделения. */
  openCreateAnnotationDialog() {
    const prompt = this.selectionPrompt();

    if (!prompt) {
      return;
    }

    this.annotationDialog.set({
      mode: 'create',
      selectedText: prompt.selectedText,
      selectionKey: `${prompt.startOffset}:${prompt.endOffset}`,
      initialComment: '',
      initialColor: DEFAULT_ANNOTATION_COLOR,
      annotationId: null,
      startOffset: prompt.startOffset,
      endOffset: prompt.endOffset,
    });
    this.selectionPrompt.set(null);
    this.selectionService.clearSelection();
  }

  /** Сохраняет новую аннотацию или изменения существующей. */
  saveAnnotation(articleId: string | null, formValue: { comment: string; color: string }) {
    const dialog = this.annotationDialog();

    if (!articleId || !dialog) {
      return;
    }

    this.isSaving.set(true);
    this.hideTooltip();

    try {
      const result =
        dialog.mode === 'create'
          ? this.annotationState.createAnnotation({
              articleId,
              text: dialog.selectedText,
              comment: formValue.comment,
              color: formValue.color,
              startOffset: dialog.startOffset!,
              endOffset: dialog.endOffset!,
            })
          : this.annotationState.updateAnnotation(dialog.annotationId!, formValue);

      if (result.error) {
        if (result.error === 'missing_annotation') {
          this.closeAnnotationDialog();
        }

        this.toastService.error(getAnnotationErrorMessage(result.error));
        return;
      }

      this.closeAnnotationDialog();
      this.toastService.success(getAnnotationSaveSuccessMessage(dialog.mode));
      this.selectionService.clearSelection();
    } catch (error) {
      if (!isLocalStorageWriteError(error)) {
        throw error;
      }

      this.toastService.error(getAnnotationErrorMessage('storage_unavailable'));
    } finally {
      this.isSaving.set(false);
    }
  }

  /** Удаляет редактируемую аннотацию. */
  deleteAnnotation() {
    const dialog = this.annotationDialog();

    if (!dialog || dialog.mode !== 'edit' || !dialog.annotationId) {
      return;
    }

    this.isDeleting.set(true);
    this.hideTooltip();

    try {
      const deleted = this.annotationState.deleteAnnotation(dialog.annotationId);

      if (!deleted) {
        this.closeAnnotationDialog();
        this.toastService.error(getAnnotationErrorMessage('missing_annotation'));
        return;
      }

      this.closeAnnotationDialog();
      this.toastService.success(ANNOTATION_DELETE_SUCCESS_MESSAGE);
    } catch (error) {
      if (!isLocalStorageWriteError(error)) {
        throw error;
      }

      this.toastService.error(getAnnotationErrorMessage('storage_unavailable'));
    } finally {
      this.isDeleting.set(false);
    }
  }

  /** Закрывает диалог аннотации без сохранения. */
  cancelAnnotation() {
    this.closeAnnotationDialog();
  }

  /** Закрывает попап текущего выделения. */
  dismissSelectionPrompt() {
    this.selectionPrompt.set(null);
    this.selectionService.clearSelection();
  }

  /** Показывает подсказку с текстом аннотации возле подсвеченного фрагмента. */
  showTooltip(event: Event, comment: string, color: string) {
    if (this.annotationDialog() || this.selectionPrompt()) {
      return;
    }

    const target = event.currentTarget;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const left = clamp(rect.left + rect.width / 2, 176, window.innerWidth - 176);
    const top = Math.max(80, rect.top - 8);

    this.tooltipState.set({
      comment,
      color,
      top,
      left,
    });
  }

  /** Скрывает подсказку аннотации. */
  hideTooltip() {
    this.tooltipState.set(null);
  }

  /** Открывает редактирование аннотации по клику мышью. */
  openAnnotationEditor(event: MouseEvent, annotation: Annotation) {
    event.stopPropagation();
    this.hideTooltip();
    this.selectionService.clearSelection();
    this.selectionPrompt.set(null);
    this.annotationDialog.set(this.createEditAnnotationDialog(annotation));
  }

  /** Открывает редактирование аннотации с клавиатуры. */
  openAnnotationEditorFromKeyboard(event: KeyboardEvent, annotation: Annotation) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.hideTooltip();
    this.selectionService.clearSelection();
    this.selectionPrompt.set(null);
    this.annotationDialog.set(this.createEditAnnotationDialog(annotation));
  }

  /** Очищает временные элементы интерфейса без закрытия редактора статьи. */
  clearTransientUi() {
    this.hideTooltip();
    this.dismissSelectionPrompt();
  }

  /** Формирует состояние попапа для только что выделенного текста. */
  private createSelectionPrompt(
    selection: TextSelectionRange,
    anchorRect: DOMRect,
  ): SelectionPromptState {
    const placement = resolveSelectionPromptPlacement(
      {
        top: anchorRect.top,
        bottom: anchorRect.bottom,
        centerX: anchorRect.left + anchorRect.width / 2,
      },
      {
        width: getEstimatedSelectionPromptWidth(),
        height: SELECTION_PROMPT_ESTIMATED_HEIGHT,
      },
    );

    return {
      selectedText: selection.text,
      startOffset: selection.startOffset,
      endOffset: selection.endOffset,
      anchorTop: anchorRect.top,
      anchorBottom: anchorRect.bottom,
      anchorCenterX: anchorRect.left + anchorRect.width / 2,
      ...placement,
    };
  }

  /** Формирует состояние диалога редактирования существующей аннотации. */
  private createEditAnnotationDialog(annotation: Annotation): AnnotationDialogState {
    return {
      mode: 'edit',
      selectedText: annotation.text,
      selectionKey: annotation.id,
      initialComment: annotation.comment,
      initialColor: annotation.color,
      annotationId: annotation.id,
      startOffset: null,
      endOffset: null,
    };
  }

  /** Закрывает диалог аннотации и очищает выделение текста. */
  private closeAnnotationDialog() {
    this.annotationDialog.set(null);
    this.selectionService.clearSelection();
  }
}

/** Ограничивает значение диапазоном `min..max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const VIEWPORT_PADDING = 16;
const SELECTION_PROMPT_MAX_WIDTH = 320;
const DEFAULT_SELECTION_PROMPT_WIDTH = 320;
const SELECTION_PROMPT_ESTIMATED_HEIGHT = 104;
const SELECTION_PROMPT_OFFSET = 18;

/**
 * Вычисляет позицию попапа относительно выделения с учётом размеров вьюпорта.
 */
export function resolveSelectionPromptPlacement(
  anchor: { top: number; bottom: number; centerX: number },
  promptSize: { width: number; height: number },
): {
  top: number;
  left: number;
  placement: 'above' | 'below';
} {
  const promptWidth = Math.min(promptSize.width, getEstimatedSelectionPromptWidth());
  const promptHeight = promptSize.height;
  const halfWidth = promptWidth / 2;
  const minLeft = halfWidth + VIEWPORT_PADDING;
  const maxLeft = window.innerWidth - halfWidth - VIEWPORT_PADDING;
  const left = minLeft > maxLeft ? window.innerWidth / 2 : clamp(anchor.centerX, minLeft, maxLeft);
  const belowTop = anchor.bottom + SELECTION_PROMPT_OFFSET;
  const aboveTop = anchor.top - promptHeight - SELECTION_PROMPT_OFFSET;
  const spaceBelow = window.innerHeight - belowTop - VIEWPORT_PADDING;
  const spaceAbove = anchor.top - SELECTION_PROMPT_OFFSET - VIEWPORT_PADDING;
  // Выбираем сторону с достаточным местом, а при равенстве предпочитаем размещение снизу.
  const placement: 'above' | 'below' =
    spaceBelow >= promptHeight || spaceBelow >= spaceAbove ? 'below' : 'above';
  const unclampedTop = placement === 'below' ? belowTop : aboveTop;
  const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - promptHeight - VIEWPORT_PADDING);

  return {
    left,
    top: clamp(unclampedTop, VIEWPORT_PADDING, maxTop),
    placement,
  };
}

/** Возвращает рабочую ширину попапа для текущего размера окна. */
function getEstimatedSelectionPromptWidth(): number {
  return Math.min(SELECTION_PROMPT_MAX_WIDTH, Math.max(280, window.innerWidth - 24));
}
