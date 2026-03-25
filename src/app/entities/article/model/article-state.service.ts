import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { ArticlesStorageService } from './articles-storage.service';
import { Article } from './article.model';

@Injectable({
  providedIn: 'root',
})
export class ArticleStateService {
  /** Хранилище статей в localStorage. */
  private readonly articlesStorage = inject(ArticlesStorageService);

  /** Текущее состояние списка статей. */
  private readonly articlesSubject = new BehaviorSubject<Article[]>([]);

  /** Идентификатор выбранной статьи. */
  private readonly activeArticleIdSubject = new BehaviorSubject<string | null>(null);

  /** Поток со всеми статьями. */
  readonly articles$ = this.articlesSubject.asObservable();

  /** Поток с идентификатором активной статьи. */
  readonly activeArticleId$ = this.activeArticleIdSubject.asObservable();

  /** Поток с активной статьёй, найденной по выбранному идентификатору. */
  readonly activeArticle$ = combineLatest([this.articles$, this.activeArticleId$]).pipe(
    map(
      ([articles, activeArticleId]) =>
        articles.find((article) => article.id === activeArticleId) ?? null,
    ),
  );

  constructor() {
    this.loadArticles();
  }

  /** Текущее значение идентификатора активной статьи без подписки. */
  get activeArticleIdSnapshot(): string | null {
    return this.activeArticleIdSubject.value;
  }

  /** Загружает список статей из хранилища в реактивное состояние. */
  loadArticles() {
    this.articlesSubject.next(this.articlesStorage.getAll());
  }

  /** Возвращает статью по идентификатору. */
  getArticleById(articleId: string): Article | null {
    return this.articlesStorage.getById(articleId);
  }

  /** Выбирает активную статью. */
  selectArticle(articleId: string | null) {
    this.activeArticleIdSubject.next(articleId);
  }

  /** Сбрасывает выбранную статью. */
  clearSelection() {
    this.selectArticle(null);
  }
}
