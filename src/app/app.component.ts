import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastOutletComponent } from './shared/ui/toast/toast-outlet.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, ToastOutletComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Заголовок приложения в шапке. */
  protected readonly title = 'UNADESK';

  /** Краткое описание основного сценария работы приложения. */
  protected readonly subtitle =
    'Создавай статьи, выделяй важные фрагменты и сохраняй пояснения прямо в тексте.';
}
