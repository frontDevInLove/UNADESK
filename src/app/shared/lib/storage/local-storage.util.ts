/**
 * Ошибка записи значения в localStorage.
 */
export class LocalStorageWriteError extends Error {
  constructor(
    /** Ключ localStorage, запись в который завершилась ошибкой. */
    public readonly key: string,
    cause?: unknown,
  ) {
    super(`Failed to write localStorage item "${key}".`, { cause });
    this.name = 'LocalStorageWriteError';
  }
}

/**
 * Проверяет, что ошибка возникла именно при записи в localStorage.
 */
export function isLocalStorageWriteError(error: unknown): error is LocalStorageWriteError {
  return error instanceof LocalStorageWriteError;
}

/**
 * Считывает JSON-значение из localStorage и возвращает `fallback` при любой ошибке.
 */
export function readJsonFromLocalStorage<T>(
  key: string,
  fallback: T,
  storage: Storage = localStorage,
): T {
  try {
    const rawValue = storage.getItem(key);

    if (rawValue === null) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

/**
 * Сериализует и записывает значение в localStorage.
 */
export function writeJsonToLocalStorage<T>(key: string, value: T, storage: Storage = localStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new LocalStorageWriteError(key, error);
  }
}
