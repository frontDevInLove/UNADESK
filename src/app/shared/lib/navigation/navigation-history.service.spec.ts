import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NavigationHistoryService } from './navigation-history.service';

describe('NavigationHistoryService', () => {
  let events$: Subject<object>;
  let service: NavigationHistoryService;
  let router: {
    events: ReturnType<Subject<object>['asObservable']>;
    url: string;
    navigateByUrl: ReturnType<typeof vi.fn>;
  };
  let location: {
    back: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    events$ = new Subject<object>();
    router = {
      events: events$.asObservable(),
      url: '/',
      navigateByUrl: vi.fn().mockResolvedValue(true),
    };
    location = {
      back: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        NavigationHistoryService,
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
      ],
    });

    service = TestBed.inject(NavigationHistoryService);
  });

  afterEach(() => {
    events$.complete();
  });

  it('uses the fallback route for a direct deep-link open without a phantom root entry', async () => {
    emitNavigation(1, '/articles/article-1/edit');

    await service.back('/articles/article-1');

    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/articles/article-1');
    expect(readHistoryUrls()).toEqual(['/articles/article-1/edit']);
    expect(readCurrentHistoryIndex()).toBe(0);
  });

  it('delegates to browser back when there is known internal navigation history', async () => {
    emitNavigation(1, '/articles/article-1');
    emitNavigation(2, '/articles/article-1/edit');

    await service.back('/articles');

    expect(location.back).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('keeps the current pointer in sync with popstate and drops forward history after a new navigation', () => {
    emitNavigation(1, '/articles');
    emitNavigation(2, '/articles/article-1');
    emitNavigation(3, '/articles/article-1/edit');

    emitPopstateNavigation(4, '/articles/article-1', 2);

    expect(readCurrentHistoryIndex()).toBe(1);
    expect(readHistoryUrls()).toEqual([
      '/articles',
      '/articles/article-1',
      '/articles/article-1/edit',
    ]);

    emitNavigation(5, '/articles/new');

    expect(readCurrentHistoryIndex()).toBe(2);
    expect(readHistoryUrls()).toEqual([
      '/articles',
      '/articles/article-1',
      '/articles/new',
    ]);
  });

  function emitNavigation(id: number, url: string) {
    events$.next(new NavigationStart(id, url, 'imperative'));
    events$.next(new NavigationEnd(id, url, url));
  }

  function emitPopstateNavigation(id: number, url: string, restoredNavigationId: number) {
    events$.next(
      new NavigationStart(id, url, 'popstate', {
        navigationId: restoredNavigationId,
      }),
    );
    events$.next(new NavigationEnd(id, url, url));
  }

  function readHistoryUrls(): string[] {
    return (service as never as { historyEntries: Array<{ url: string }> }).historyEntries.map(
      (entry) => entry.url,
    );
  }

  function readCurrentHistoryIndex(): number {
    return (service as never as { currentHistoryIndex: number }).currentHistoryIndex;
  }
});
