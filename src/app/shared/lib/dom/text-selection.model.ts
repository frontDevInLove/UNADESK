export interface TextSelectionRange {
  /** Текст выделенного фрагмента. */
  text: string;

  /** Смещение начала выделения в тексте статьи. */
  startOffset: number;

  /** Смещение конца выделения в тексте статьи. */
  endOffset: number;
}
