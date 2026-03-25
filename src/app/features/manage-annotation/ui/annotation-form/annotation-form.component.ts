import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  ANNOTATION_COLOR_OPTIONS,
  DEFAULT_ANNOTATION_COLOR,
} from '../../../../entities/annotation/lib/annotation-colors';
import { trimmedRequired } from '../../../../shared/lib/validators/trimmed-required.validator';

type AnnotationFormMode = 'create' | 'edit';

@Component({
  selector: 'app-annotation-form',
  imports: [ReactiveFormsModule],
  templateUrl: './annotation-form.component.html',
  styleUrl: './annotation-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationFormComponent implements OnChanges {
  /** Построитель реактивной формы аннотации. */
  private readonly formBuilder = inject(FormBuilder);

  /** Текст выделенного фрагмента. */
  @Input({ required: true }) selectedText = '';

  /** Ключ, по которому форма понимает, что выделение изменилось. */
  @Input({ required: true }) selectionKey = '';

  /** Режим работы формы: создание или редактирование. */
  @Input() mode: AnnotationFormMode = 'create';

  /** Начальное значение комментария. */
  @Input() initialComment = '';

  /** Начальный цвет подсветки. */
  @Input() initialColor = DEFAULT_ANNOTATION_COLOR;

  /** Флаг процесса сохранения формы. */
  @Input() isSaving = false;

  /** Флаг процесса удаления аннотации. */
  @Input() isDeleting = false;

  /** Событие сохранения аннотации. */
  @Output() saveAnnotation = new EventEmitter<{ comment: string; color: string }>();

  /** Событие закрытия формы без сохранения. */
  @Output() cancelAnnotation = new EventEmitter<void>();

  /** Событие удаления аннотации. */
  @Output() deleteAnnotation = new EventEmitter<void>();

  /** Доступные варианты цветов подсветки. */
  protected readonly colorOptions = ANNOTATION_COLOR_OPTIONS;

  /** Реактивная форма редактирования аннотации. */
  protected readonly annotationForm = this.formBuilder.nonNullable.group({
    color: [DEFAULT_ANNOTATION_COLOR],
    comment: ['', [trimmedRequired]],
  });

  /** Синхронизирует форму с новыми входными данными. */
  ngOnChanges(changes: SimpleChanges) {
    if (
      !changes['selectedText'] &&
      !changes['selectionKey'] &&
      !changes['mode'] &&
      !changes['initialComment'] &&
      !changes['initialColor']
    ) {
      return;
    }

    this.resetForm();
  }

  /** Валидирует форму и отправляет событие сохранения. */
  protected save() {
    if (this.annotationForm.invalid) {
      this.annotationForm.markAllAsTouched();
      return;
    }

    this.saveAnnotation.emit({
      color: this.annotationForm.controls.color.getRawValue(),
      comment: this.annotationForm.controls.comment.getRawValue().trim(),
    });
  }

  /** Сбрасывает форму и закрывает диалог. */
  protected cancel() {
    this.resetForm();
    this.cancelAnnotation.emit();
  }

  /** Запрашивает удаление текущей аннотации. */
  protected delete() {
    this.deleteAnnotation.emit();
  }

  /** Проверяет, нужно ли показывать ошибку комментария. */
  protected hasCommentError(): boolean {
    const control = this.annotationForm.controls.comment;

    return control.invalid && (control.touched || control.dirty);
  }

  /** Проверяет, выбран ли указанный цвет. */
  protected isSelectedColor(color: string): boolean {
    return this.annotationForm.controls.color.value === color;
  }

  /** Выбирает цвет подсветки в форме. */
  protected selectColor(color: string) {
    this.annotationForm.controls.color.setValue(color);
    this.annotationForm.controls.color.markAsDirty();
  }

  /** Возвращает краткий заголовок формы по текущему режиму. */
  protected getEyebrow(): string {
    return this.mode === 'edit' ? 'Редактирование аннотации' : 'Новый фрагмент';
  }

  /** Возвращает подпись кнопки сохранения с учётом текущего состояния. */
  protected getSubmitLabel(): string {
    if (this.isSaving) {
      return this.mode === 'edit' ? 'Сохранение изменений...' : 'Сохранение...';
    }

    return this.mode === 'edit' ? 'Сохранить изменения' : 'Сохранить аннотацию';
  }

  /** Возвращает форму к начальному состоянию текущей аннотации. */
  private resetForm() {
    this.annotationForm.reset({
      color: this.initialColor || DEFAULT_ANNOTATION_COLOR,
      comment: this.initialComment,
    });
  }
}
