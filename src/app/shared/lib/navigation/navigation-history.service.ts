import { Location } from '@angular/common';
import {
  ENVIRONMENT_INITIALIZER,
  EnvironmentProviders,
  Injectable,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';

interface NavigationHistoryEntry {
  /** Идентификатор навигации из Angular Router. */
  navigationId: number;

  /** Итоговый URL после редиректов. */
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  /** Экземпляр Angular Router. */
  private readonly router = inject(Router);

  /** Адаптер для системной навигации браузера. */
  private readonly location = inject(Location);

  /** Внутренний стек навигации приложения. */
  private readonly historyEntries: NavigationHistoryEntry[] = [];

  /** Индекс текущего элемента в собственном стеке навигации. */
  private currentHistoryIndex = -1;

  /** Тип ещё не завершённой навигации. */
  private pendingNavigationTrigger: NavigationStart['navigationTrigger'] | null = null;

  /** Идентификатор восстановленной записи браузерной истории. */
  private pendingRestoredNavigationId: number | null = null;

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.pendingNavigationTrigger = event.navigationTrigger ?? 'imperative';
        this.pendingRestoredNavigationId = event.restoredState?.navigationId ?? null;
        return;
      }

      if (event instanceof NavigationEnd) {
        this.recordSuccessfulNavigation(event);
        return;
      }

      if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ) {
        this.resetPendingNavigationState();
      }
    });
  }

  /** Переходит назад или открывает резервный URL, если истории недостаточно. */
  async back(fallbackUrl: string) {
    if (this.canGoBack()) {
      this.location.back();
      return true;
    }

    return this.router.navigateByUrl(fallbackUrl);
  }

  /** Проверяет, есть ли предыдущий экран в собственном стеке навигации. */
  private canGoBack(): boolean {
    return this.currentHistoryIndex > 0;
  }

  /** Обрабатывает успешно завершившуюся навигацию. */
  private recordSuccessfulNavigation(event: NavigationEnd) {
    if (this.pendingNavigationTrigger === 'popstate') {
      this.restorePopstateNavigation(event);
      this.resetPendingNavigationState();
      return;
    }

    this.recordImperativeNavigation(event.id, event.urlAfterRedirects);
    this.resetPendingNavigationState();
  }

  /** Записывает новую пользовательскую навигацию в стек истории. */
  private recordImperativeNavigation(navigationId: number, url: string) {
    if (this.currentHistoryIndex < this.historyEntries.length - 1) {
      this.historyEntries.splice(this.currentHistoryIndex + 1);
    }

    const currentEntry = this.historyEntries[this.currentHistoryIndex];

    if (currentEntry?.url === url) {
      this.historyEntries[this.currentHistoryIndex] = {
        navigationId,
        url,
      };
      return;
    }

    this.historyEntries.push({
      navigationId,
      url,
    });
    this.currentHistoryIndex = this.historyEntries.length - 1;
  }

  /** Сопоставляет popstate-навигацию с уже известной записью истории. */
  private restorePopstateNavigation(event: NavigationEnd) {
    // Для popstate Angular создаёт новый navigationId, но restoredState.navigationId
    // ссылается на уже существующую запись браузерной истории.
    if (this.pendingRestoredNavigationId !== null) {
      const restoredIndex = this.historyEntries.findIndex(
        (entry) => entry.navigationId === this.pendingRestoredNavigationId,
      );

      if (restoredIndex !== -1) {
        this.historyEntries[restoredIndex] = {
          ...this.historyEntries[restoredIndex]!,
          url: event.urlAfterRedirects,
        };
        this.currentHistoryIndex = restoredIndex;
        return;
      }
    }

    const matchedUrlIndex = this.findLastIndexByUrl(event.urlAfterRedirects);

    if (matchedUrlIndex !== -1) {
      this.currentHistoryIndex = matchedUrlIndex;
      return;
    }

    this.recordImperativeNavigation(event.id, event.urlAfterRedirects);
  }

  /** Ищет последнюю запись стека по URL. */
  private findLastIndexByUrl(url: string): number {
    for (let index = this.historyEntries.length - 1; index >= 0; index -= 1) {
      if (this.historyEntries[index]?.url === url) {
        return index;
      }
    }

    return -1;
  }

  /** Сбрасывает служебное состояние незавершённой навигации. */
  private resetPendingNavigationState() {
    this.pendingNavigationTrigger = null;
    this.pendingRestoredNavigationId = null;
  }
}

/** Подключает сервис истории навигации на этапе инициализации приложения. */
export function provideNavigationHistory(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(NavigationHistoryService);
      },
    },
  ]);
}
