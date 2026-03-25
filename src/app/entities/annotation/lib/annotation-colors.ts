export interface AnnotationColorOption {
  /** Подпись цвета в интерфейсе. */
  label: string;

  /** CSS-значение цвета подсветки. */
  value: string;
}

/** Набор доступных цветов для подсветки аннотаций. */
export const ANNOTATION_COLOR_OPTIONS: readonly AnnotationColorOption[] = [
  { label: 'Янтарный', value: 'rgba(244, 186, 70, 0.45)' },
  { label: 'Мятный', value: 'rgba(126, 195, 134, 0.42)' },
  { label: 'Лазурный', value: 'rgba(115, 168, 243, 0.38)' },
  { label: 'Коралловый', value: 'rgba(235, 127, 132, 0.4)' },
];

/** Цвет подсветки по умолчанию для новой аннотации. */
export const DEFAULT_ANNOTATION_COLOR = ANNOTATION_COLOR_OPTIONS[0]!.value;
