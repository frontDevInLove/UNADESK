import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  /** Уникальный идентификатор уведомления. */
  id: string;

  /** Визуальный тон уведомления. */
  tone: ToastTone;

  /** Текст уведомления. */
  text: string;
}

interface ShowToastOptions {
  /** Пользовательская длительность показа в миллисекундах. */
  durationMs?: number;
}

const DEFAULT_TOAST_DURATION_MS = 5000;
const DEFAULT_ERROR_TOAST_DURATION_MS = 7000;

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  /** Внутренний сигнал с текущим стеком уведомлений. */
  private readonly toastsSignal = signal<Toast[]>([]);

  /** Таймеры автоматического скрытия уведомлений. */
  private readonly dismissTimers = new Map<string, number>();

  /** Публичное read-only представление списка уведомлений. */
  readonly toasts = this.toastsSignal.asReadonly();

  /** Показывает уведомление и возвращает его идентификатор. */
  show(toast: Omit<Toast, 'id'>, options?: ShowToastOptions): string {
    const id = crypto.randomUUID();
    const nextToast: Toast = {
      id,
      ...toast,
    };

    this.toastsSignal.update((currentToasts) => [...currentToasts, nextToast]);
    this.scheduleDismiss(id, toast.tone, options?.durationMs);

    return id;
  }

  /** Показывает информационное уведомление. */
  info(text: string, options?: ShowToastOptions): string {
    return this.show({ tone: 'info', text }, options);
  }

  /** Показывает уведомление об успешной операции. */
  success(text: string, options?: ShowToastOptions): string {
    return this.show({ tone: 'success', text }, options);
  }

  /** Показывает уведомление об ошибке. */
  error(text: string, options?: ShowToastOptions): string {
    return this.show({ tone: 'error', text }, options);
  }

  /** Скрывает уведомление и очищает связанный таймер. */
  dismiss(toastId: string) {
    const timerId = this.dismissTimers.get(toastId);

    if (typeof timerId === 'number') {
      window.clearTimeout(timerId);
      this.dismissTimers.delete(toastId);
    }

    this.toastsSignal.update((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }

  /** Скрывает все уведомления сразу. */
  clear() {
    for (const timerId of this.dismissTimers.values()) {
      window.clearTimeout(timerId);
    }

    this.dismissTimers.clear();
    this.toastsSignal.set([]);
  }

  /** Планирует автоматическое скрытие уведомления. */
  private scheduleDismiss(toastId: string, tone: ToastTone, durationMs?: number) {
    const timeoutMs =
      durationMs ??
      (tone === 'error' ? DEFAULT_ERROR_TOAST_DURATION_MS : DEFAULT_TOAST_DURATION_MS);

    const existingTimerId = this.dismissTimers.get(toastId);

    if (typeof existingTimerId === 'number') {
      window.clearTimeout(existingTimerId);
    }

    const timerId = window.setTimeout(() => {
      this.dismiss(toastId);
    }, timeoutMs);

    this.dismissTimers.set(toastId, timerId);
  }
}
