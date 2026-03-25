import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HideBrokenImageDirective } from './hide-broken-image.directive';

@Component({
  template: '<img appHideBrokenImage [src]="src" alt="" />',
  imports: [HideBrokenImageDirective],
})
class TestHostComponent {
  src = 'broken-image.jpg';
}

describe('HideBrokenImageDirective', () => {
  it('restores image visibility after a new successful load', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).createComponent(TestHostComponent);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    image.dispatchEvent(new Event('error'));
    expect(image.style.display).toBe('none');

    fixture.componentInstance.src = 'working-image.jpg';
    fixture.detectChanges();
    image.dispatchEvent(new Event('load'));

    expect(image.style.display).toBe('');
  });
});
