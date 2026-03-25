import { TestBed } from '@angular/core/testing';
import { ArticleContentRendererService } from './article-content-renderer.service';

describe('ArticleContentRendererService', () => {
  let service: ArticleContentRendererService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ArticleContentRendererService);
  });

  it('renders plain and annotated segments in source order inside one paragraph', () => {
    const paragraphs = service.render('Alpha Beta Gamma', [
      {
        id: 'annotation-1',
        articleId: 'article-1',
        text: 'Beta',
        comment: 'Focus on Beta',
        color: 'rgba(244, 186, 70, 0.45)',
        startOffset: 6,
        endOffset: 10,
        createdAt: '2026-03-25T09:00:00.000Z',
        updatedAt: '2026-03-25T09:00:00.000Z',
      },
    ]);

    expect(paragraphs).toEqual([
      {
        key: 'paragraph-0',
        startOffset: 0,
        segments: [
          { key: 'plain-0-0', text: 'Alpha ', annotation: null, startOffset: 0 },
          {
            key: 'annotation-annotation-1-6',
            text: 'Beta',
            annotation: expect.objectContaining({ id: 'annotation-1' }),
            startOffset: 6,
          },
          { key: 'plain-10-10', text: ' Gamma', annotation: null, startOffset: 10 },
        ],
      },
    ]);
  });

  it('splits source text into paragraphs and keeps absolute offsets for spans', () => {
    const paragraphs = service.render('Alpha\nBeta Gamma', [
      {
        id: 'annotation-1',
        articleId: 'article-1',
        text: 'Beta',
        comment: 'Second paragraph',
        color: 'rgba(126, 195, 134, 0.42)',
        startOffset: 6,
        endOffset: 10,
        createdAt: '2026-03-25T09:00:00.000Z',
        updatedAt: '2026-03-25T09:00:00.000Z',
      },
    ]);

    expect(paragraphs).toEqual([
      {
        key: 'paragraph-0',
        startOffset: 0,
        segments: [{ key: 'plain-0-0', text: 'Alpha', annotation: null, startOffset: 0 }],
      },
      {
        key: 'paragraph-1',
        startOffset: 6,
        segments: [
          {
            key: 'annotation-annotation-1-6',
            text: 'Beta',
            annotation: expect.objectContaining({ id: 'annotation-1' }),
            startOffset: 6,
          },
          { key: 'plain-10-10', text: ' Gamma', annotation: null, startOffset: 10 },
        ],
      },
    ]);
  });

  it('collapses consecutive line breaks into one visual paragraph gap without empty paragraphs', () => {
    const paragraphs = service.render('Alpha\n\nBeta', []);

    expect(paragraphs).toEqual([
      {
        key: 'paragraph-0',
        startOffset: 0,
        segments: [{ key: 'plain-0-0', text: 'Alpha', annotation: null, startOffset: 0 }],
      },
      {
        key: 'paragraph-1',
        startOffset: 7,
        segments: [{ key: 'plain-0-7', text: 'Beta', annotation: null, startOffset: 7 }],
      },
    ]);
  });

  it('skips overlapping or out-of-range annotations to keep rendering stable', () => {
    const paragraphs = service.render('Alpha Beta Gamma', [
      {
        id: 'annotation-overlap',
        articleId: 'article-1',
        text: 'Alpha Beta',
        comment: 'Too wide',
        color: 'rgba(244, 186, 70, 0.45)',
        startOffset: 0,
        endOffset: 10,
        createdAt: '2026-03-25T09:00:00.000Z',
        updatedAt: '2026-03-25T09:00:00.000Z',
      },
      {
        id: 'annotation-overlapped',
        articleId: 'article-1',
        text: 'Beta',
        comment: 'Should be skipped',
        color: 'rgba(126, 195, 134, 0.42)',
        startOffset: 6,
        endOffset: 10,
        createdAt: '2026-03-25T09:01:00.000Z',
        updatedAt: '2026-03-25T09:01:00.000Z',
      },
      {
        id: 'annotation-invalid',
        articleId: 'article-1',
        text: 'Overflow',
        comment: 'Out of bounds',
        color: 'rgba(115, 168, 243, 0.38)',
        startOffset: 11,
        endOffset: 40,
        createdAt: '2026-03-25T09:02:00.000Z',
        updatedAt: '2026-03-25T09:02:00.000Z',
      },
    ]);

    expect(paragraphs).toEqual([
      {
        key: 'paragraph-0',
        startOffset: 0,
        segments: [
          {
            key: 'annotation-annotation-overlap-0',
            text: 'Alpha Beta',
            annotation: expect.objectContaining({ id: 'annotation-overlap' }),
            startOffset: 0,
          },
          { key: 'plain-10-10', text: ' Gamma', annotation: null, startOffset: 10 },
        ],
      },
    ]);
  });
});
