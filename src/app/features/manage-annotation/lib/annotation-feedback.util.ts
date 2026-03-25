export type AnnotationFeedbackError =
  | 'missing_article'
  | 'missing_annotation'
  | 'invalid_range'
  | 'empty_selection'
  | 'selection_mismatch'
  | 'overlap'
  | 'empty_comment'
  | 'missing_color'
  | 'storage_unavailable';

/**
 * Возвращает текст ошибки для операций с аннотациями.
 */
export function getAnnotationErrorMessage(error: AnnotationFeedbackError): string {
  switch (error) {
    case 'missing_article':
      return 'Текущая статья больше не найдена. Вернись к списку и открой запись заново.';
    case 'missing_annotation':
      return 'Аннотация больше недоступна. Открой другой фрагмент или создай новую аннотацию.';
    case 'invalid_range':
      return 'Не удалось определить корректные границы выделения. Попробуй выделить фрагмент ещё раз.';
    case 'empty_selection':
      return 'Выделение состоит только из пробелов или переносов строки. Выдели содержательный фрагмент текста.';
    case 'selection_mismatch':
      return 'Выделение устарело после перерисовки текста. Выдели фрагмент заново.';
    case 'overlap':
      return 'Пересекающиеся выделения не поддерживаются. Выдели другой фрагмент без пересечения.';
    case 'empty_comment':
      return 'Добавь комментарий к выбранному фрагменту.';
    case 'missing_color':
      return 'Выбери цвет подсветки.';
    case 'storage_unavailable':
      return 'Не удалось сохранить изменения в локальное хранилище. Проверь доступность localStorage и попробуй снова.';
  }
}

/**
 * Возвращает сообщение об успешном сохранении аннотации.
 */
export function getAnnotationSaveSuccessMessage(mode: 'create' | 'edit'): string {
  return mode === 'create'
    ? 'Аннотация сохранена. После перезагрузки страницы она останется на месте.'
    : 'Аннотация обновлена. Изменения сразу применены к тексту статьи.';
}

/** Сообщение об успешном удалении аннотации. */
export const ANNOTATION_DELETE_SUCCESS_MESSAGE = 'Аннотация удалена. Подсветка сразу обновлена.';
