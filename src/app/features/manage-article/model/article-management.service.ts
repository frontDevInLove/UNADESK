import { Injectable, inject } from '@angular/core';
import { AnnotationStateService } from '../../../entities/annotation/model/annotation-state.service';
import { Annotation } from '../../../entities/annotation/model/annotation.model';
import { AnnotationsStorageService } from '../../../entities/annotation/model/annotations-storage.service';
import { ArticleStateService } from '../../../entities/article/model/article-state.service';
import { ArticlesStorageService } from '../../../entities/article/model/articles-storage.service';
import {
  Article,
  ArticleDraft,
  buildArticleFromDraft,
} from '../../../entities/article/model/article.model';
import { isLocalStorageWriteError } from '../../../shared/lib/storage/local-storage.util';

export type ArticleManagementError = 'missing_article' | 'storage_unavailable';

export interface ArticleCreationResult {
  /** Созданная статья, если операция прошла успешно. */
  article: Article | null;

  /** Код ошибки создания статьи. */
  error: ArticleManagementError | null;
}

export interface ArticleUpdateResult {
  /** Обновлённая статья, если операция прошла успешно. */
  article: Article | null;

  /** Количество аннотаций, удалённых из-за изменения текста статьи. */
  deletedAnnotationsCount: number;

  /** Код ошибки обновления статьи. */
  error: ArticleManagementError | null;
}

export interface ArticleDeletionResult {
  /** Признак успешного удаления статьи. */
  deleted: boolean;

  /** Количество аннотаций, удалённых вместе со статьёй. */
  deletedAnnotationsCount: number;

  /** Код ошибки удаления статьи. */
  error: ArticleManagementError | null;
}

@Injectable({
  providedIn: 'root',
})
export class ArticleManagementService {
  /** Хранилище статей. */
  private readonly articlesStorage = inject(ArticlesStorageService);

  /** Хранилище аннотаций. */
  private readonly annotationsStorage = inject(AnnotationsStorageService);

  /** Реактивное состояние статей. */
  private readonly articleState = inject(ArticleStateService);

  /** Реактивное состояние аннотаций. */
  private readonly annotationState = inject(AnnotationStateService);

  /** Создаёт статью и синхронизирует состояние приложения. */
  createArticle(draft: ArticleDraft): ArticleCreationResult {
    try {
      const article = this.articlesStorage.create(draft);
      this.articleState.loadArticles();
      this.articleState.selectArticle(article.id);

      return { article, error: null };
    } catch (error) {
      if (!isLocalStorageWriteError(error)) {
        throw error;
      }

      this.articleState.loadArticles();

      return { article: null, error: 'storage_unavailable' };
    }
  }

  /** Обновляет статью и при необходимости удаляет связанные аннотации. */
  updateArticle(
    articleId: string,
    draft: ArticleDraft,
    options?: { clearAnnotations?: boolean },
  ): ArticleUpdateResult {
    const currentArticles = this.articlesStorage.getAll();
    const currentAnnotations = this.annotationState.getAll();
    const articleIndex = currentArticles.findIndex((article) => article.id === articleId);

    if (articleIndex === -1) {
      return { article: null, deletedAnnotationsCount: 0, error: 'missing_article' };
    }

    const currentArticle = currentArticles[articleIndex]!;
    const updatedArticle: Article = buildArticleFromDraft(draft, {
      id: currentArticle.id,
      createdAt: currentArticle.createdAt,
      updatedAt: new Date().toISOString(),
    });
    const nextArticles = [...currentArticles];
    nextArticles[articleIndex] = updatedArticle;
    // При изменении текста аннотации теряют привязку к исходным смещениям и должны быть удалены.
    const nextAnnotations = options?.clearAnnotations
      ? this.annotationState.filterOutByArticleId(articleId, currentAnnotations)
      : null;
    const deletedAnnotationsCount = nextAnnotations
      ? currentAnnotations.length - nextAnnotations.length
      : 0;

    if (
      !this.commitCollections(nextArticles, currentArticles, nextAnnotations, currentAnnotations)
    ) {
      return { article: null, deletedAnnotationsCount: 0, error: 'storage_unavailable' };
    }

    this.articleState.loadArticles();

    if (nextAnnotations) {
      this.annotationState.loadAnnotations();
    }

    this.articleState.selectArticle(updatedArticle.id);

    return { article: updatedArticle, deletedAnnotationsCount, error: null };
  }

  /** Удаляет статью и все её аннотации одной транзакцией. */
  deleteArticle(articleId: string): ArticleDeletionResult {
    const currentArticles = this.articlesStorage.getAll();
    const currentAnnotations = this.annotationState.getAll();
    const nextArticles = currentArticles.filter((article) => article.id !== articleId);

    if (nextArticles.length === currentArticles.length) {
      return { deleted: false, deletedAnnotationsCount: 0, error: 'missing_article' };
    }

    const nextAnnotations = this.annotationState.filterOutByArticleId(
      articleId,
      currentAnnotations,
    );
    const deletedAnnotationsCount = currentAnnotations.length - nextAnnotations.length;

    if (
      !this.commitCollections(nextArticles, currentArticles, nextAnnotations, currentAnnotations)
    ) {
      return { deleted: false, deletedAnnotationsCount: 0, error: 'storage_unavailable' };
    }

    this.articleState.loadArticles();
    this.annotationState.loadAnnotations();

    if (this.articleState.activeArticleIdSnapshot === articleId) {
      this.articleState.clearSelection();
    }

    return { deleted: true, deletedAnnotationsCount, error: null };
  }

  /** Пытается атомарно сохранить новые коллекции статей и аннотаций. */
  private commitCollections(
    nextArticles: Article[],
    previousArticles: Article[],
    nextAnnotations: Annotation[] | null,
    previousAnnotations: Annotation[],
  ): boolean {
    try {
      this.articlesStorage.replaceAll(nextArticles);

      if (nextAnnotations) {
        this.annotationsStorage.replaceAll(nextAnnotations);
      }

      return true;
    } catch (error) {
      if (!isLocalStorageWriteError(error)) {
        throw error;
      }

      // Если вторая запись упала, пытаемся вернуть обе коллекции к исходному состоянию.
      this.rollbackCollections(previousArticles, previousAnnotations, nextAnnotations !== null);

      return false;
    }
  }

  /** Пытается откатить частично сохранённые изменения в localStorage. */
  private rollbackCollections(
    previousArticles: Article[],
    previousAnnotations: Annotation[],
    shouldRollbackAnnotations: boolean,
  ) {
    try {
      this.articlesStorage.replaceAll(previousArticles);

      if (shouldRollbackAnnotations) {
        this.annotationsStorage.replaceAll(previousAnnotations);
      }
    } catch {
      this.articleState.loadArticles();

      if (shouldRollbackAnnotations) {
        this.annotationState.loadAnnotations();
      }
    }
  }
}
