import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ArticlesStorageService } from '../../article/model/articles-storage.service';
import { Annotation, AnnotationDraft, AnnotationUpdateDraft } from './annotation.model';
import { AnnotationsStorageService } from './annotations-storage.service';

export type AnnotationMutationError =
  | 'missing_article'
  | 'missing_annotation'
  | 'invalid_range'
  | 'empty_selection'
  | 'selection_mismatch'
  | 'overlap'
  | 'empty_comment'
  | 'missing_color';

export interface AnnotationMutationResult {
  /** Созданная или обновлённая аннотация. */
  annotation: Annotation | null;

  /** Код ошибки валидации или сохранения. */
  error: AnnotationMutationError | null;
}

@Injectable({
  providedIn: 'root',
})
export class AnnotationStateService {
  /** Хранилище аннотаций. */
  private readonly annotationsStorage = inject(AnnotationsStorageService);

  /** Хранилище статей для проверки диапазонов выделения. */
  private readonly articlesStorage = inject(ArticlesStorageService);

  /** Реактивное состояние списка аннотаций. */
  private readonly annotationsSubject = new BehaviorSubject<Annotation[]>([]);

  /** Поток со всеми аннотациями. */
  readonly annotations$ = this.annotationsSubject.asObservable();

  constructor() {
    this.loadAnnotations();
  }

  /** Загружает аннотации из хранилища в реактивное состояние. */
  loadAnnotations() {
    this.annotationsSubject.next(this.annotationsStorage.getAll());
  }

  /** Возвращает снимок всех аннотаций. */
  getAll(): Annotation[] {
    return [...this.annotationsSubject.value];
  }

  /** Возвращает отсортированные аннотации конкретной статьи. */
  getByArticleId(articleId: string): Annotation[] {
    return this.annotationsSubject.value
      .filter((annotation) => annotation.articleId === articleId)
      .sort(
        (leftAnnotation, rightAnnotation) =>
          leftAnnotation.startOffset - rightAnnotation.startOffset,
      );
  }

  /** Подсчитывает количество аннотаций у статьи. */
  getAnnotationCount(articleId: string): number {
    return this.getByArticleId(articleId).length;
  }

  /** Возвращает аннотацию по идентификатору. */
  getById(annotationId: string): Annotation | null {
    return (
      this.annotationsSubject.value.find((annotation) => annotation.id === annotationId) ?? null
    );
  }

  /** Проверяет корректность диапазона выделения для новой аннотации. */
  validateSelection(
    articleId: string,
    startOffset: number,
    endOffset: number,
  ): AnnotationMutationError | null {
    const article = this.articlesStorage.getById(articleId);

    if (!article) {
      return 'missing_article';
    }

    if (startOffset < 0 || endOffset > article.content.length || startOffset >= endOffset) {
      return 'invalid_range';
    }

    if (!article.content.slice(startOffset, endOffset).trim()) {
      return 'empty_selection';
    }

    // Пересекающиеся диапазоны не поддерживаются, иначе подсветка станет неоднозначной.
    const hasOverlap = this.getByArticleId(articleId).some(
      (annotation) => startOffset < annotation.endOffset && endOffset > annotation.startOffset,
    );

    return hasOverlap ? 'overlap' : null;
  }

  /** Создаёт новую аннотацию после полной проверки выделения и формы. */
  createAnnotation(draft: AnnotationDraft): AnnotationMutationResult {
    const rangeError = this.validateSelection(draft.articleId, draft.startOffset, draft.endOffset);

    if (rangeError) {
      return { annotation: null, error: rangeError };
    }

    if (!draft.comment.trim()) {
      return { annotation: null, error: 'empty_comment' };
    }

    if (!draft.color.trim()) {
      return { annotation: null, error: 'missing_color' };
    }

    const article = this.articlesStorage.getById(draft.articleId);

    if (!article) {
      return { annotation: null, error: 'missing_article' };
    }

    const selectedText = article.content.slice(draft.startOffset, draft.endOffset);

    if (!selectedText.trim()) {
      return { annotation: null, error: 'empty_selection' };
    }

    if (!selectedText || selectedText !== draft.text) {
      return { annotation: null, error: 'selection_mismatch' };
    }

    const annotation = this.annotationsStorage.create({
      ...draft,
      comment: draft.comment.trim(),
      color: draft.color.trim(),
      text: selectedText,
    });

    this.loadAnnotations();

    return { annotation, error: null };
  }

  /** Обновляет комментарий и цвет существующей аннотации. */
  updateAnnotation(annotationId: string, draft: AnnotationUpdateDraft): AnnotationMutationResult {
    if (!draft.comment.trim()) {
      return { annotation: null, error: 'empty_comment' };
    }

    if (!draft.color.trim()) {
      return { annotation: null, error: 'missing_color' };
    }

    if (!this.getById(annotationId)) {
      return { annotation: null, error: 'missing_annotation' };
    }

    const annotation = this.annotationsStorage.update(annotationId, draft);

    if (!annotation) {
      return { annotation: null, error: 'missing_annotation' };
    }

    this.loadAnnotations();

    return { annotation, error: null };
  }

  /** Удаляет аннотацию по идентификатору. */
  deleteAnnotation(annotationId: string): boolean {
    const deleted = this.annotationsStorage.delete(annotationId);

    if (
      deleted ||
      this.annotationsSubject.value.some((annotation) => annotation.id === annotationId)
    ) {
      this.loadAnnotations();
    }

    return deleted;
  }

  /** Удаляет все аннотации указанной статьи. */
  deleteByArticleId(articleId: string): number {
    const deletedAnnotationsCount = this.annotationsStorage.deleteByArticleId(articleId);

    if (
      deletedAnnotationsCount > 0 ||
      this.annotationsSubject.value.some((annotation) => annotation.articleId === articleId)
    ) {
      this.loadAnnotations();
    }

    return deletedAnnotationsCount;
  }

  /** Возвращает коллекцию без аннотаций, относящихся к указанной статье. */
  filterOutByArticleId(articleId: string, annotations: Annotation[] = this.getAll()): Annotation[] {
    return annotations.filter((annotation) => annotation.articleId !== articleId);
  }
}
