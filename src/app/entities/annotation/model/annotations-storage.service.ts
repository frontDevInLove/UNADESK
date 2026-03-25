import { Injectable } from '@angular/core';
import {
  readJsonFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../shared/lib/storage/local-storage.util';
import {
  Annotation,
  AnnotationDraft,
  AnnotationUpdateDraft,
  isAnnotation,
} from './annotation.model';

const ANNOTATIONS_STORAGE_KEY = 'text-annotator.annotations';

@Injectable({
  providedIn: 'root',
})
export class AnnotationsStorageService {
  /**
   * Полностью заменяет коллекцию аннотаций в localStorage.
   */
  replaceAll(annotations: Annotation[]) {
    writeJsonToLocalStorage(ANNOTATIONS_STORAGE_KEY, annotations);
  }

  /**
   * Возвращает все корректно сохранённые аннотации.
   */
  getAll(): Annotation[] {
    const value = readJsonFromLocalStorage<unknown>(ANNOTATIONS_STORAGE_KEY, []);

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isAnnotation);
  }

  /**
   * Возвращает аннотации, связанные с указанной статьёй.
   */
  getByArticleId(articleId: string): Annotation[] {
    return this.getAll().filter((annotation) => annotation.articleId === articleId);
  }

  /**
   * Создаёт новую аннотацию и сохраняет её в хранилище.
   */
  create(draft: AnnotationDraft): Annotation {
    const timestamp = new Date().toISOString();
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      articleId: draft.articleId,
      text: draft.text,
      comment: draft.comment.trim(),
      color: draft.color.trim(),
      startOffset: draft.startOffset,
      endOffset: draft.endOffset,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.replaceAll([...this.getAll(), annotation]);

    return annotation;
  }

  /**
   * Обновляет комментарий и цвет существующей аннотации.
   */
  update(annotationId: string, draft: AnnotationUpdateDraft): Annotation | null {
    let updatedAnnotation: Annotation | null = null;
    const nextAnnotations = this.getAll().map((annotation) => {
      if (annotation.id !== annotationId) {
        return annotation;
      }

      updatedAnnotation = {
        ...annotation,
        comment: draft.comment.trim(),
        color: draft.color.trim(),
        updatedAt: new Date().toISOString(),
      };

      return updatedAnnotation;
    });

    if (!updatedAnnotation) {
      return null;
    }

    this.replaceAll(nextAnnotations);

    return updatedAnnotation;
  }

  /**
   * Удаляет аннотацию по идентификатору.
   */
  delete(annotationId: string): boolean {
    const currentAnnotations = this.getAll();
    const nextAnnotations = currentAnnotations.filter(
      (annotation) => annotation.id !== annotationId,
    );

    if (nextAnnotations.length === currentAnnotations.length) {
      return false;
    }

    this.replaceAll(nextAnnotations);

    return true;
  }

  /**
   * Удаляет все аннотации статьи и возвращает количество удалённых записей.
   */
  deleteByArticleId(articleId: string): number {
    const currentAnnotations = this.getAll();
    const nextAnnotations = currentAnnotations.filter(
      (annotation) => annotation.articleId !== articleId,
    );
    const deletedCount = currentAnnotations.length - nextAnnotations.length;

    if (deletedCount > 0) {
      this.replaceAll(nextAnnotations);
    }

    return deletedCount;
  }
}
