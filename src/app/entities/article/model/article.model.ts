export interface Article {
  /** Уникальный идентификатор статьи. */
  id: string;

  /** Заголовок статьи. */
  title: string;

  /** Необязательная ссылка на изображение-превью статьи. */
  titleUrl?: string;

  /** Основной текст статьи. */
  content: string;

  /** Дата и время создания статьи в ISO-формате. */
  createdAt: string;

  /** Дата и время последнего изменения статьи в ISO-формате. */
  updatedAt: string;
}

/** Черновик статьи, вводимый пользователем в форме. */
export type ArticleDraft = Pick<Article, 'title' | 'content' | 'titleUrl'>;

interface ArticleBuildOptions {
  /** Идентификатор итоговой статьи. */
  id: string;

  /** Метка времени создания статьи. */
  createdAt: string;

  /** Метка времени последнего обновления статьи. */
  updatedAt: string;
}

/**
 * Нормализует ссылку на изображение и убирает пустые значения.
 */
export function normalizeArticleTitleUrl(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

/**
 * Собирает сущность статьи из черновика и служебных метаданных.
 */
export function buildArticleFromDraft(draft: ArticleDraft, options: ArticleBuildOptions): Article {
  const titleUrl = normalizeArticleTitleUrl(draft.titleUrl);

  return {
    id: options.id,
    title: draft.title,
    ...(titleUrl ? { titleUrl } : {}),
    content: draft.content,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
  };
}

/**
 * Проверяет, что значение соответствует контракту статьи.
 */
export function isArticle(value: unknown): value is Article {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['title'] === 'string' &&
    (typeof candidate['titleUrl'] === 'undefined' || typeof candidate['titleUrl'] === 'string') &&
    typeof candidate['content'] === 'string' &&
    typeof candidate['createdAt'] === 'string' &&
    typeof candidate['updatedAt'] === 'string'
  );
}
