const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Возвращает все доступные для фокуса элементы внутри контейнера.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.tabIndex >= 0,
  );
}

/**
 * Переводит фокус на первый доступный элемент контейнера.
 */
export function focusFirstElement(container: HTMLElement): boolean {
  const [firstElement] = getFocusableElements(container);

  if (!firstElement) {
    return false;
  }

  firstElement.focus();
  return true;
}

/**
 * Зацикливает перемещение фокуса по `Tab` внутри контейнера.
 */
export function keepFocusWithinContainer(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== 'Tab') {
    return false;
  }

  const focusableElements = getFocusableElements(container);

  if (focusableElements.length === 0) {
    return false;
  }

  const [firstElement] = focusableElements;
  const lastElement = focusableElements[focusableElements.length - 1]!;
  const activeElement =
    container.ownerDocument.activeElement instanceof HTMLElement
      ? container.ownerDocument.activeElement
      : null;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return true;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement!.focus();
    return true;
  }

  return false;
}
