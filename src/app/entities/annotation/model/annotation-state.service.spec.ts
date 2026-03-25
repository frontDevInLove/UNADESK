import { TestBed } from '@angular/core/testing';
import { AnnotationStateService } from './annotation-state.service';
import { ArticlesStorageService } from '../../article/model/articles-storage.service';

describe('AnnotationStateService', () => {
  let service: AnnotationStateService;
  let articlesStorage: ArticlesStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnnotationStateService);
    articlesStorage = TestBed.inject(ArticlesStorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates an annotation and keeps it available through the state layer', () => {
    const article = articlesStorage.create({
      title: 'Article',
      titleUrl: '',
      content: 'Alpha Beta Gamma',
    });

    const result = service.createAnnotation({
      articleId: article.id,
      text: 'Beta',
      comment: 'Focus on this word',
      color: 'rgba(244, 186, 70, 0.45)',
      startOffset: 6,
      endOffset: 10,
    });

    expect(result.error).toBeNull();
    expect(result.annotation).toEqual(
      expect.objectContaining({
        articleId: article.id,
        text: 'Beta',
        comment: 'Focus on this word',
      }),
    );
    expect(service.getByArticleId(article.id)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('text-annotator.annotations') ?? '[]')).toHaveLength(1);
  });

  it('rejects overlapping annotations in MVP mode', () => {
    const article = articlesStorage.create({
      title: 'Article',
      titleUrl: '',
      content: 'Alpha Beta Gamma',
    });

    service.createAnnotation({
      articleId: article.id,
      text: 'Beta',
      comment: 'First annotation',
      color: 'rgba(244, 186, 70, 0.45)',
      startOffset: 6,
      endOffset: 10,
    });

    const result = service.createAnnotation({
      articleId: article.id,
      text: 'Beta Gamma',
      comment: 'Second annotation',
      color: 'rgba(126, 195, 134, 0.42)',
      startOffset: 6,
      endOffset: 16,
    });

    expect(result.annotation).toBeNull();
    expect(result.error).toBe('overlap');
    expect(service.getByArticleId(article.id)).toHaveLength(1);
  });

  it('updates comment and color for an existing annotation', () => {
    const article = articlesStorage.create({
      title: 'Article',
      titleUrl: '',
      content: 'Alpha Beta Gamma',
    });

    const created = service.createAnnotation({
      articleId: article.id,
      text: 'Beta',
      comment: 'First note',
      color: 'rgba(244, 186, 70, 0.45)',
      startOffset: 6,
      endOffset: 10,
    });

    expect(created.annotation).toBeTruthy();

    const updated = service.updateAnnotation(created.annotation!.id, {
      comment: 'Updated note',
      color: 'rgba(126, 195, 134, 0.42)',
    });

    expect(updated.error).toBeNull();
    expect(updated.annotation).toEqual(
      expect.objectContaining({
        id: created.annotation!.id,
        comment: 'Updated note',
        color: 'rgba(126, 195, 134, 0.42)',
      }),
    );
    expect(service.getByArticleId(article.id)[0]).toEqual(
      expect.objectContaining({
        comment: 'Updated note',
        color: 'rgba(126, 195, 134, 0.42)',
      }),
    );
  });

  it('rejects annotations that only cover whitespace between text fragments', () => {
    const whitespaceText = ' \n\n ';
    const article = articlesStorage.create({
      title: 'Article',
      titleUrl: '',
      content: `Alpha${whitespaceText}Beta`,
    });

    const result = service.createAnnotation({
      articleId: article.id,
      text: whitespaceText,
      comment: 'Whitespace only',
      color: 'rgba(244, 186, 70, 0.45)',
      startOffset: 5,
      endOffset: 9,
    });

    expect(result.annotation).toBeNull();
    expect(result.error).toBe('empty_selection');
    expect(service.getByArticleId(article.id)).toHaveLength(0);
  });

  it('deletes a single annotation without touching the rest of the article', () => {
    const article = articlesStorage.create({
      title: 'Article',
      titleUrl: '',
      content: 'Alpha Beta Gamma Delta',
    });

    const first = service.createAnnotation({
      articleId: article.id,
      text: 'Beta',
      comment: 'First note',
      color: 'rgba(244, 186, 70, 0.45)',
      startOffset: 6,
      endOffset: 10,
    });
    const second = service.createAnnotation({
      articleId: article.id,
      text: 'Delta',
      comment: 'Second note',
      color: 'rgba(126, 195, 134, 0.42)',
      startOffset: 17,
      endOffset: 22,
    });

    expect(first.annotation).toBeTruthy();
    expect(second.annotation).toBeTruthy();

    const deleted = service.deleteAnnotation(first.annotation!.id);

    expect(deleted).toBe(true);
    expect(service.getByArticleId(article.id)).toEqual([
      expect.objectContaining({ id: second.annotation!.id }),
    ]);
  });
});
