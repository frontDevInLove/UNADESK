import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AnnotationStateService } from '../../entities/annotation/model/annotation-state.service';
import { ArticleStateService } from '../../entities/article/model/article-state.service';
import { ArticleManagementService } from '../../features/manage-article/model/article-management.service';
import { resolveSelectionPromptPlacement } from '../../features/manage-annotation/model/annotation-interaction.service';
import { ArticleViewerComponent } from './article-viewer.component';

describe('resolveSelectionPromptPlacement', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 720,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('places the prompt above the selection when there is not enough space below', () => {
    const placement = resolveSelectionPromptPlacement(
      {
        top: 620,
        bottom: 650,
        centerX: 900,
      },
      {
        width: 320,
        height: 180,
      },
    );

    expect(placement.placement).toBe('above');
    expect(placement.top).toBeGreaterThanOrEqual(16);
    expect(placement.top + 180).toBeLessThanOrEqual(window.innerHeight - 16);
  });

  it('clamps the prompt horizontally inside the viewport', () => {
    const placement = resolveSelectionPromptPlacement(
      {
        top: 180,
        bottom: 210,
        centerX: 1240,
      },
      {
        width: 320,
        height: 132,
      },
    );

    expect(placement.left + 160).toBeLessThanOrEqual(window.innerWidth - 16);
    expect(placement.left - 160).toBeGreaterThanOrEqual(16);
  });
});

describe('ArticleViewerComponent', () => {
  const article = {
    id: 'article-1',
    title: 'Тестовая статья',
    content: 'Первый абзац статьи.',
    createdAt: '2026-03-25T12:00:00.000Z',
    updatedAt: '2026-03-25T12:00:00.000Z',
  };

  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('keeps the article action menu open after clicking its trigger without a text selection', async () => {
    const activeArticle$ = new BehaviorSubject(article);
    const annotations$ = new BehaviorSubject([]);
    let hasQueuedFrame = false;
    let runQueuedFrame = () => {};

    window.requestAnimationFrame = vi.fn((callback: (timestamp: number) => void) => {
      hasQueuedFrame = true;
      runQueuedFrame = () => callback(performance.now());
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ArticleViewerComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ articleId: article.id })),
            snapshot: {
              paramMap: convertToParamMap({ articleId: article.id }),
            },
          },
        },
        {
          provide: ArticleStateService,
          useValue: {
            activeArticle$: activeArticle$.asObservable(),
            selectArticle: vi.fn(),
          },
        },
        {
          provide: AnnotationStateService,
          useValue: {
            annotations$: annotations$.asObservable(),
            getAnnotationCount: vi.fn().mockReturnValue(0),
            validateSelection: vi.fn().mockReturnValue(null),
          },
        },
        {
          provide: ArticleManagementService,
          useValue: {
            deleteArticle: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ArticleViewerComponent);
    const component = fixture.componentInstance as ArticleViewerComponent & {
      handleDocumentSelectionEnd(): void;
      toggleActionMenu(event?: Event): void;
      isActionMenuOpen: { (): boolean };
    };

    fixture.detectChanges();

    component.handleDocumentSelectionEnd();
    component.toggleActionMenu({ stopPropagation: vi.fn() } as unknown as Event);
    if (hasQueuedFrame) {
      runQueuedFrame();
    }
    fixture.detectChanges();

    expect(component.isActionMenuOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.reader-panel__menu-list')).not.toBeNull();
  });

  it('renders plain and annotated segments without template whitespace around their text', async () => {
    const activeArticle$ = new BehaviorSubject({
      ...article,
      content: 'Alpha Beta',
    });
    const annotations$ = new BehaviorSubject([
      {
        id: 'annotation-1',
        articleId: article.id,
        text: 'Alpha',
        comment: 'Комментарий',
        color: 'rgba(244, 186, 70, 0.45)',
        startOffset: 0,
        endOffset: 5,
        createdAt: '2026-03-25T12:00:00.000Z',
        updatedAt: '2026-03-25T12:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ArticleViewerComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ articleId: article.id })),
            snapshot: {
              paramMap: convertToParamMap({ articleId: article.id }),
            },
          },
        },
        {
          provide: ArticleStateService,
          useValue: {
            activeArticle$: activeArticle$.asObservable(),
            selectArticle: vi.fn(),
          },
        },
        {
          provide: AnnotationStateService,
          useValue: {
            annotations$: annotations$.asObservable(),
            getAnnotationCount: vi.fn().mockReturnValue(1),
            validateSelection: vi.fn().mockReturnValue(null),
          },
        },
        {
          provide: ArticleManagementService,
          useValue: {
            deleteArticle: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ArticleViewerComponent);
    fixture.detectChanges();

    const segments = Array.from(
      fixture.nativeElement.querySelectorAll('.article-content__segment'),
    ) as HTMLElement[];

    expect(segments.map((segment) => segment.textContent)).toEqual(['Alpha', ' Beta']);
  });
});
