import { Injectable } from '@angular/core';
import {
  readJsonFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../shared/lib/storage/local-storage.util';
import { Article, ArticleDraft, buildArticleFromDraft, isArticle } from './article.model';

const ARTICLES_STORAGE_KEY = 'text-annotator.articles';

@Injectable({
  providedIn: 'root',
})
export class ArticlesStorageService {
  /**
   * Полностью заменяет коллекцию статей в localStorage.
   */
  replaceAll(articles: Article[]) {
    writeJsonToLocalStorage(ARTICLES_STORAGE_KEY, articles);
  }

  /**
   * Возвращает все корректно сохранённые статьи.
   */
  getAll(): Article[] {
    const value = readJsonFromLocalStorage<unknown>(ARTICLES_STORAGE_KEY, []);

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isArticle);
  }

  /**
   * Ищет статью по идентификатору.
   */
  getById(articleId: string): Article | null {
    return this.getAll().find((article) => article.id === articleId) ?? null;
  }

  /**
   * Создаёт новую статью и сохраняет её в хранилище.
   */
  create(draft: ArticleDraft): Article {
    const timestamp = new Date().toISOString();
    const article = buildArticleFromDraft(draft, {
      id: crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    this.replaceAll([...this.getAll(), article]);

    return article;
  }

  /**
   * Обновляет существующую статью и возвращает её новую версию.
   */
  update(articleId: string, draft: ArticleDraft): Article | null {
    let updatedArticle: Article | null = null;
    const nextArticles = this.getAll().map((article) => {
      if (article.id !== articleId) {
        return article;
      }

      updatedArticle = buildArticleFromDraft(draft, {
        id: article.id,
        createdAt: article.createdAt,
        updatedAt: new Date().toISOString(),
      });

      return updatedArticle;
    });

    this.replaceAll(nextArticles);

    return updatedArticle;
  }

  /**
   * Удаляет статью из хранилища.
   */
  delete(articleId: string): boolean {
    const currentArticles = this.getAll();
    const nextArticles = currentArticles.filter((article) => article.id !== articleId);

    if (nextArticles.length === currentArticles.length) {
      return false;
    }

    this.replaceAll(nextArticles);

    return true;
  }
}
