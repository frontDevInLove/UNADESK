import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: 'img[appHideBrokenImage]',
})
export class HideBrokenImageDirective {
  /** Скрывает изображение, если браузер не смог его загрузить. */
  @HostListener('error', ['$event.target'])
  protected hideBrokenImage(target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    target.style.display = 'none';
  }

  /** Возвращает изображение в поток документа после успешной загрузки. */
  @HostListener('load', ['$event.target'])
  protected restoreImageVisibility(target: EventTarget | null) {
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    target.style.removeProperty('display');
  }
}
