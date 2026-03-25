import { Injectable } from '@angular/core';
import { TextSelectionRange } from './text-selection.model';

@Injectable({
  providedIn: 'root',
})
export class SelectionService {
  /** Возвращает выделенный пользователем фрагмент и его смещения в тексте статьи. */
  getSelection(container: HTMLElement, articleText: string): TextSelectionRange | null {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (!this.isRangeInsideContainer(range, container)) {
      return null;
    }

    const selectedRangeText = range.toString();

    if (!selectedRangeText || !selectedRangeText.trim()) {
      return null;
    }

    const startOffset = this.getOffset(container, articleText.length, range, 'start');
    const endOffset = this.getOffset(container, articleText.length, range, 'end');

    if (startOffset === null || endOffset === null) {
      return null;
    }

    if (startOffset < 0 || endOffset > articleText.length || startOffset >= endOffset) {
      return null;
    }

    const text = articleText.slice(startOffset, endOffset);

    if (!text || !text.trim()) {
      return null;
    }

    return {
      text,
      startOffset,
      endOffset,
    };
  }

  /** Снимает текущее текстовое выделение в документе. */
  clearSelection() {
    window.getSelection()?.removeAllRanges();
  }

  /** Возвращает прямоугольник текущего выделения для позиционирования попапов. */
  getSelectionRect(container: HTMLElement): DOMRect | null {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (!this.isRangeInsideContainer(range, container)) {
      return null;
    }

    const rangeRect = range.getBoundingClientRect();

    if (this.hasVisibleRect(rangeRect)) {
      return this.toDomRect(rangeRect);
    }

    const clientRect = range.getClientRects().item(0);

    if (clientRect && this.hasVisibleRect(clientRect)) {
      return this.toDomRect(clientRect);
    }

    return (
      this.getNodeRect(range.endContainer) ??
      this.getNodeRect(range.startContainer) ??
      this.getNodeRect(range.commonAncestorContainer)
    );
  }

  /** Проверяет, что выделение полностью находится внутри контейнера статьи. */
  private isRangeInsideContainer(range: Range, container: HTMLElement): boolean {
    return container.contains(range.startContainer) && container.contains(range.endContainer);
  }

  /** Вычисляет смещение начала или конца выделения в исходном тексте статьи. */
  private getOffset(
    container: HTMLElement,
    articleLength: number,
    range: Range,
    boundary: 'start' | 'end',
  ): number | null {
    const boundaryNode = boundary === 'start' ? range.startContainer : range.endContainer;
    const boundaryOffset = boundary === 'start' ? range.startOffset : range.endOffset;

    if (boundaryNode === container) {
      return this.getContainerBoundaryOffset(container, articleLength, boundaryOffset);
    }

    const segment = this.getClosestSegmentElement(boundaryNode);

    if (segment) {
      // При попадании внутрь подсвеченного сегмента используем его абсолютное смещение из data-атрибута.
      return this.getSegmentBoundaryOffset(segment, boundaryNode, boundaryOffset);
    }

    const paragraph = this.getClosestParagraphElement(boundaryNode, container);

    if (!paragraph) {
      return null;
    }

    const paragraphStartOffset = this.readNumericAttribute(paragraph, 'data-paragraph-start');

    if (paragraphStartOffset === null) {
      return null;
    }

    const paragraphRange = container.ownerDocument.createRange();
    paragraphRange.selectNodeContents(paragraph);

    try {
      paragraphRange.setEnd(boundaryNode, boundaryOffset);
    } catch {
      return null;
    }

    return paragraphStartOffset + paragraphRange.toString().length;
  }

  /** Вычисляет абсолютное смещение внутри сегмента текста. */
  private getSegmentBoundaryOffset(
    segment: HTMLElement,
    boundaryNode: Node,
    boundaryOffset: number,
  ): number | null {
    const segmentStartOffset = this.readNumericAttribute(segment, 'data-segment-start');

    if (segmentStartOffset === null) {
      return null;
    }

    const segmentRange = segment.ownerDocument.createRange();
    segmentRange.selectNodeContents(segment);

    try {
      segmentRange.setEnd(boundaryNode, boundaryOffset);
    } catch {
      return null;
    }

    return segmentStartOffset + segmentRange.toString().length;
  }

  /** Вычисляет смещение, если граница выделения указывает на сам контейнер. */
  private getContainerBoundaryOffset(
    container: HTMLElement,
    articleLength: number,
    boundaryOffset: number,
  ): number | null {
    const paragraphElements = this.getParagraphElements(container);

    if (paragraphElements.length === 0) {
      return boundaryOffset === 0 ? 0 : articleLength;
    }

    if (boundaryOffset <= 0) {
      return this.readNumericAttribute(paragraphElements[0]!, 'data-paragraph-start');
    }

    for (let index = boundaryOffset; index < container.childNodes.length; index += 1) {
      const childNode = container.childNodes.item(index);

      if (!childNode) {
        continue;
      }

      const nextParagraph = this.getFirstParagraphElement(childNode);

      if (nextParagraph) {
        return this.readNumericAttribute(nextParagraph, 'data-paragraph-start');
      }
    }

    return articleLength;
  }

  /** Возвращает все элементы абзацев, размеченные абсолютными смещениями. */
  private getParagraphElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-paragraph-start]'));
  }

  /** Ищет ближайший элемент абзаца от указанного DOM-узла. */
  private getClosestParagraphElement(node: Node, container: HTMLElement): HTMLElement | null {
    if (node instanceof HTMLElement) {
      return node.closest<HTMLElement>('[data-paragraph-start]');
    }

    if (node.parentElement) {
      return node.parentElement.closest<HTMLElement>('[data-paragraph-start]');
    }

    return node === container ? container : null;
  }

  /** Ищет ближайший размеченный сегмент текста. */
  private getClosestSegmentElement(node: Node): HTMLElement | null {
    if (node instanceof HTMLElement) {
      return node.closest<HTMLElement>('[data-segment-start]');
    }

    return node.parentElement?.closest<HTMLElement>('[data-segment-start]') ?? null;
  }

  /** Ищет первый размеченный абзац внутри узла. */
  private getFirstParagraphElement(node: Node): HTMLElement | null {
    if (node instanceof HTMLElement) {
      if (node.hasAttribute('data-paragraph-start')) {
        return node;
      }

      return node.querySelector<HTMLElement>('[data-paragraph-start]');
    }

    return node.parentElement?.closest<HTMLElement>('[data-paragraph-start]') ?? null;
  }

  /** Считывает числовой `data-*`-атрибут и безопасно преобразует его в число. */
  private readNumericAttribute(element: HTMLElement, attributeName: string): number | null {
    const value = element.getAttribute(attributeName);

    if (value === null) {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Возвращает видимый прямоугольник DOM-узла или его родителя. */
  private getNodeRect(node: Node): DOMRect | null {
    if (node instanceof HTMLElement) {
      const rect = node.getBoundingClientRect();
      return this.hasVisibleRect(rect) ? this.toDomRect(rect) : null;
    }

    if (node.parentElement) {
      const rect = node.parentElement.getBoundingClientRect();
      return this.hasVisibleRect(rect) ? this.toDomRect(rect) : null;
    }

    return null;
  }

  /** Проверяет, что прямоугольник действительно занимает место на экране. */
  private hasVisibleRect(rect: DOMRect | DOMRectReadOnly): boolean {
    return rect.width > 0 || rect.height > 0;
  }

  /** Нормализует `DOMRectReadOnly` в полноценный `DOMRect`. */
  private toDomRect(rect: DOMRect | DOMRectReadOnly): DOMRect {
    return DOMRect.fromRect({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  }
}
