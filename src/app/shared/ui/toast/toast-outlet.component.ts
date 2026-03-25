import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../lib/toast/toast.service';

@Component({
  selector: 'app-toast-outlet',
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastOutletComponent {
  /** Сервис всплывающих уведомлений. */
  private readonly toastService = inject(ToastService);

  /** Текущий список уведомлений для вывода в шаблон. */
  protected readonly toasts = this.toastService.toasts;

  /** Закрывает уведомление по идентификатору. */
  protected dismissToast(toastId: string) {
    this.toastService.dismiss(toastId);
  }
}
