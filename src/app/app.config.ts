import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideNavigationHistory } from './shared/lib/navigation/navigation-history.service';

/** Корневая конфигурация Angular-приложения. */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideNavigationHistory(),
  ],
};
