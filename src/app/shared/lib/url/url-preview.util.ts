const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

/**
 * Проверяет, что строка является прямой ссылкой на изображение.
 */
export function isDirectImageUrl(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return IMAGE_EXTENSION_PATTERN.test(url.pathname);
  } catch {
    return false;
  }
}
