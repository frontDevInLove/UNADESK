import { Routes } from '@angular/router';

/** Маршруты основных экранов приложения. */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'articles',
  },
  {
    path: 'articles',
    loadComponent: () =>
      import('./pages/article-list/article-list.component').then((m) => m.ArticleListComponent),
  },
  {
    path: 'articles/new',
    loadComponent: () =>
      import('./pages/article-editor/article-editor.component').then(
        (m) => m.ArticleEditorComponent,
      ),
  },
  {
    path: 'articles/:articleId/edit',
    loadComponent: () =>
      import('./pages/article-editor/article-editor.component').then(
        (m) => m.ArticleEditorComponent,
      ),
  },
  {
    path: 'articles/:articleId',
    loadComponent: () =>
      import('./pages/article-viewer/article-viewer.component').then(
        (m) => m.ArticleViewerComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'articles',
  },
];
