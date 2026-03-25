import { AbstractControl, ValidationErrors } from '@angular/forms';
import { isDirectImageUrl } from '../url/url-preview.util';

/**
 * Проверяет необязательное поле со ссылкой на изображение.
 */
export function optionalImageUrl(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return (url.protocol === 'http:' || url.protocol === 'https:') && isDirectImageUrl(value)
      ? null
      : { imageUrl: true };
  } catch {
    return { imageUrl: true };
  }
}
