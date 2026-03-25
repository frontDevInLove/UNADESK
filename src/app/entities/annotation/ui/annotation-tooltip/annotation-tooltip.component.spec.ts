import { TestBed } from '@angular/core/testing';
import { AnnotationTooltipComponent } from './annotation-tooltip.component';

describe('AnnotationTooltipComponent', () => {
  it('keeps the tooltip bubble fixed to viewport coordinates', async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationTooltipComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnnotationTooltipComponent);
    fixture.componentRef.setInput('comment', 'Розовый цвет');
    fixture.componentRef.setInput('top', 120);
    fixture.componentRef.setInput('left', 280);
    fixture.componentRef.setInput('color', 'rgba(244, 186, 70, 0.45)');
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('.annotation-tooltip') as HTMLElement;

    expect(tooltip.textContent).toContain('Розовый цвет');
    expect(getComputedStyle(tooltip).position).toBe('fixed');
  });
});
