import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-annotation-tooltip',
  templateUrl: './annotation-tooltip.component.html',
  styleUrl: './annotation-tooltip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationTooltipComponent {
  /** Текст комментария, отображаемый в подсказке. */
  @Input({ required: true }) comment = '';

  /** Вертикальная координата позиционирования подсказки. */
  @Input({ required: true }) top = 0;

  /** Горизонтальная координата позиционирования подсказки. */
  @Input({ required: true }) left = 0;

  /** Цвет связанной подсветки. */
  @Input({ required: true }) color = '';
}
