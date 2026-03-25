import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Валидирует строковое поле с учётом обрезки пробелов по краям.
 */
export function trimmedRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { trimmedRequired: true };
}
