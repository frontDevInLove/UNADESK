import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnnotationStateService } from '../../entities/annotation/model/annotation-state.service';
import { ArticleStateService } from '../../entities/article/model/article-state.service';
import { ArticleManagementService } from '../../features/manage-article/model/article-management.service';
import { NavigationHistoryService } from '../../shared/lib/navigation/navigation-history.service';
import { ArticleContentRendererService } from '../../widgets/article-content/lib/article-content-renderer.service';
import { ArticleEditorComponent } from './article-editor.component';

describe('ArticleEditorComponent', () => {
  it('renders preview paragraphs the same way as the reader view for single line breaks', async () => {
    const articleState = {
      activeArticle$: of(null),
      selectArticle: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleEditorComponent],
      providers: [
        ArticleContentRendererService,
        { provide: ArticleStateService, useValue: articleState },
        { provide: ArticleManagementService, useValue: {} },
        { provide: AnnotationStateService, useValue: { getAnnotationCount: vi.fn().mockReturnValue(0) } },
        { provide: NavigationHistoryService, useValue: { back: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ArticleEditorComponent);
    const component = fixture.componentInstance as ArticleEditorComponent & {
      articleForm: {
        controls: {
          content: { setValue(value: string): void };
        };
      };
      isPreviewMode: { set(value: boolean): void };
    };

    fixture.detectChanges();
    component.articleForm.controls.content.setValue('Alpha\nBeta');
    component.isPreviewMode.set(true);
    fixture.detectChanges();

    const paragraphs = Array.from(
      fixture.nativeElement.querySelectorAll('.preview-panel__content p'),
    ).map((element) => (element as HTMLParagraphElement).textContent?.trim());

    expect(paragraphs).toEqual(['Alpha', 'Beta']);
  });
});
