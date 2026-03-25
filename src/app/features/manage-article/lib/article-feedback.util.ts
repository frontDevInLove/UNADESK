export type ArticleManagementMessageError = 'missing_article' | 'storage_unavailable';
export type ArticleManagementAction = 'create' | 'update' | 'delete';

/**
 * Возвращает текст ошибки для операций со статьями.
 */
export function getArticleManagementErrorMessage(
  error: ArticleManagementMessageError,
  action: ArticleManagementAction,
): string {
  switch (error) {
    case 'storage_unavailable':
      return `Не удалось ${getStorageActionVerb(action)} в локальном хранилище. Проверь доступность localStorage и попробуй снова.`;
    case 'missing_article':
      return getMissingArticleMessage(action);
  }
}

/**
 * Формирует сообщение об успешном удалении статьи.
 */
export function getArticleDeleteSuccessMessage(deletedAnnotationsCount: number): string {
  return deletedAnnotationsCount > 0
    ? `Статья удалена вместе с ${deletedAnnotationsCount} аннотациями.`
    : 'Статья удалена.';
}

/**
 * Формирует сообщение об успешном обновлении статьи.
 */
export function getArticleUpdateSuccessMessage(deletedAnnotationsCount: number): string {
  return deletedAnnotationsCount > 0
    ? `Статья обновлена. ${deletedAnnotationsCount} аннотаций удалены из-за изменения текста.`
    : 'Статья обновлена.';
}

/** Сообщение об успешном создании статьи. */
export const ARTICLE_CREATE_SUCCESS_MESSAGE = 'Статья сохранена и добавлена в список.';

function getStorageActionVerb(action: ArticleManagementAction): string {
  switch (action) {
    case 'create':
      return 'сохранить статью';
    case 'update':
      return 'сохранить статью';
    case 'delete':
      return 'удалить статью';
  }
}

function getMissingArticleMessage(action: ArticleManagementAction): string {
  switch (action) {
    case 'delete':
      return 'Статья больше недоступна. Обнови список и попробуй снова.';
    case 'update':
      return 'Статья больше недоступна. Вернись к списку и открой актуальную запись.';
    case 'create':
      return 'Статья больше недоступна. Обнови список и попробуй снова.';
  }
}
