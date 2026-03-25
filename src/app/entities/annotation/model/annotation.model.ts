export interface Annotation {
  /** Уникальный идентификатор аннотации. */
  id: string;

  /** Идентификатор статьи, к которой относится аннотация. */
  articleId: string;

  /** Текст выделенного фрагмента. */
  text: string;

  /** Пояснение пользователя к выделенному фрагменту. */
  comment: string;

  /** Цвет подсветки в CSS-формате. */
  color: string;

  /** Смещение начала выделения в тексте статьи. */
  startOffset: number;

  /** Смещение конца выделения в тексте статьи. */
  endOffset: number;

  /** Дата и время создания аннотации в ISO-формате. */
  createdAt: string;

  /** Дата и время последнего изменения аннотации в ISO-формате. */
  updatedAt: string;
}

/** Данные, необходимые для создания новой аннотации. */
export type AnnotationDraft = Pick<
  Annotation,
  'articleId' | 'text' | 'comment' | 'color' | 'startOffset' | 'endOffset'
>;

/** Данные, которые можно изменить у существующей аннотации. */
export type AnnotationUpdateDraft = Pick<Annotation, 'comment' | 'color'>;

/**
 * Проверяет, что значение соответствует контракту аннотации.
 */
export function isAnnotation(value: unknown): value is Annotation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['articleId'] === 'string' &&
    typeof candidate['text'] === 'string' &&
    typeof candidate['comment'] === 'string' &&
    typeof candidate['color'] === 'string' &&
    typeof candidate['startOffset'] === 'number' &&
    typeof candidate['endOffset'] === 'number' &&
    typeof candidate['createdAt'] === 'string' &&
    typeof candidate['updatedAt'] === 'string'
  );
}
