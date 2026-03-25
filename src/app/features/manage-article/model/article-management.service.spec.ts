import { TestBed } from '@angular/core/testing';
import { AnnotationStateService } from '../../../entities/annotation/model/annotation-state.service';
import { AnnotationsStorageService } from '../../../entities/annotation/model/annotations-storage.service';
import { ArticleStateService } from '../../../entities/article/model/article-state.service';
import { ArticlesStorageService } from '../../../entities/article/model/articles-storage.service';
import { LocalStorageWriteError } from '../../../shared/lib/storage/local-storage.util';
import { ArticleManagementService } from './article-management.service';

describe('ArticleManagementService', () => {
  let service: ArticleManagementService;
  let articlesStorage: {
    create: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    replaceAll: ReturnType<typeof vi.fn>;
  };
  let annotationsStorage: {
    replaceAll: ReturnType<typeof vi.fn>;
  };
  let articleState: {
    loadArticles: ReturnType<typeof vi.fn>;
    selectArticle: ReturnType<typeof vi.fn>;
    clearSelection: ReturnType<typeof vi.fn>;
    activeArticleIdSnapshot: string | null;
  };
  let annotationState: {
    getAll: ReturnType<typeof vi.fn>;
    filterOutByArticleId: ReturnType<typeof vi.fn>;
    loadAnnotations: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    articlesStorage = {
      create: vi.fn(),
      getAll: vi.fn(),
      replaceAll: vi.fn(),
    };
    annotationsStorage = {
      replaceAll: vi.fn(),
    };
    articleState = {
      loadArticles: vi.fn(),
      selectArticle: vi.fn(),
      clearSelection: vi.fn(),
      activeArticleIdSnapshot: null,
    };
    annotationState = {
      getAll: vi.fn(),
      filterOutByArticleId: vi.fn(),
      loadAnnotations: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ArticleManagementService,
        { provide: ArticlesStorageService, useValue: articlesStorage },
        { provide: AnnotationsStorageService, useValue: annotationsStorage },
        { provide: ArticleStateService, useValue: articleState },
        { provide: AnnotationStateService, useValue: annotationState },
      ],
    });

    service = TestBed.inject(ArticleManagementService);
  });

  it('clears article annotations during update when text changed and reset is confirmed', () => {
    const currentArticles = [
      {
        id: 'article-1',
        title: 'Old title',
        titleUrl: 'https://example.com/old-cover.webp',
        content: 'Old content',
        createdAt: '2026-03-25T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
      },
    ];
    const currentAnnotations = [
      {
        id: 'annotation-1',
        articleId: 'article-1',
        text: 'Old',
        comment: 'First note',
        color: 'rgba(244, 186, 70, 0.45)',
        startOffset: 0,
        endOffset: 3,
        createdAt: '2026-03-25T10:01:00.000Z',
        updatedAt: '2026-03-25T10:01:00.000Z',
      },
      {
        id: 'annotation-2',
        articleId: 'article-2',
        text: 'Other',
        comment: 'Another note',
        color: 'rgba(126, 195, 134, 0.42)',
        startOffset: 0,
        endOffset: 5,
        createdAt: '2026-03-25T10:02:00.000Z',
        updatedAt: '2026-03-25T10:02:00.000Z',
      },
    ];

    articlesStorage.getAll.mockReturnValue(currentArticles);
    annotationState.getAll.mockReturnValue(currentAnnotations);
    annotationState.filterOutByArticleId.mockImplementation((articleId: string, annotations: typeof currentAnnotations) =>
      annotations.filter((annotation) => annotation.articleId !== articleId),
    );

    const result = service.updateArticle(
      'article-1',
      {
        title: 'Updated title',
        titleUrl: '',
        content: 'Updated content',
      },
      { clearAnnotations: true },
    );

    expect(result.error).toBeNull();
    expect(result.deletedAnnotationsCount).toBe(1);
    expect(result.article).toEqual(
      expect.objectContaining({
        id: 'article-1',
        title: 'Updated title',
        content: 'Updated content',
        createdAt: '2026-03-25T10:00:00.000Z',
      }),
    );
    expect(articlesStorage.replaceAll).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'article-1',
        title: 'Updated title',
        content: 'Updated content',
      }),
    ]);
    expect(annotationsStorage.replaceAll).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'annotation-2',
        articleId: 'article-2',
      }),
    ]);
    expect(articleState.loadArticles).toHaveBeenCalledTimes(1);
    expect(annotationState.loadAnnotations).toHaveBeenCalledTimes(1);
    expect(articleState.selectArticle).toHaveBeenCalledWith('article-1');
  });

  it('returns storage_unavailable and rolls both collections back when annotation write fails', () => {
    const currentArticles = [
      {
        id: 'article-1',
        title: 'Article',
        content: 'Body',
        createdAt: '2026-03-25T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
      },
      {
        id: 'article-2',
        title: 'Article 2',
        content: 'Body 2',
        createdAt: '2026-03-25T10:05:00.000Z',
        updatedAt: '2026-03-25T10:05:00.000Z',
      },
    ];
    const currentAnnotations = [
      {
        id: 'annotation-1',
        articleId: 'article-1',
        text: 'Body',
        comment: 'Note',
        color: 'rgba(244, 186, 70, 0.45)',
        startOffset: 0,
        endOffset: 4,
        createdAt: '2026-03-25T10:01:00.000Z',
        updatedAt: '2026-03-25T10:01:00.000Z',
      },
    ];

    articlesStorage.getAll.mockReturnValue(currentArticles);
    annotationState.getAll.mockReturnValue(currentAnnotations);
    annotationState.filterOutByArticleId.mockReturnValue([]);
    annotationsStorage.replaceAll
      .mockImplementationOnce(() => {
        throw new LocalStorageWriteError('text-annotator.annotations');
      })
      .mockImplementationOnce(() => undefined);

    const result = service.deleteArticle('article-1');

    expect(result).toEqual({
      deleted: false,
      deletedAnnotationsCount: 0,
      error: 'storage_unavailable',
    });
    expect(articlesStorage.replaceAll).toHaveBeenNthCalledWith(1, [currentArticles[1]]);
    expect(articlesStorage.replaceAll).toHaveBeenNthCalledWith(2, currentArticles);
    expect(annotationsStorage.replaceAll).toHaveBeenNthCalledWith(1, []);
    expect(annotationsStorage.replaceAll).toHaveBeenNthCalledWith(2, currentAnnotations);
    expect(articleState.loadArticles).not.toHaveBeenCalled();
    expect(annotationState.loadAnnotations).not.toHaveBeenCalled();
  });

  it('returns storage_unavailable when article creation cannot be persisted', () => {
    articlesStorage.create.mockImplementation(() => {
      throw new LocalStorageWriteError('text-annotator.articles');
    });

    const result = service.createArticle({
      title: 'Draft',
      titleUrl: '',
      content: 'Text',
    });

    expect(result).toEqual({
      article: null,
      error: 'storage_unavailable',
    });
    expect(articleState.loadArticles).toHaveBeenCalledTimes(1);
    expect(articleState.selectArticle).not.toHaveBeenCalled();
  });
});
