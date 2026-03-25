import { SelectionService } from './selection.service';

describe('SelectionService', () => {
  const service = new SelectionService();

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('calculates absolute offsets for selections across nested spans inside one paragraph', () => {
    const container = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.setAttribute('data-paragraph-start', '0');
    paragraph.innerHTML =
      '<span data-segment-start="0">Alpha </span><span data-segment-start="6">Beta</span><span data-segment-start="10"> Gamma</span>';
    container.append(paragraph);
    document.body.append(container);

    const spans = container.querySelectorAll('span');
    const startNode = spans[1]?.firstChild;
    const endNode = spans[2]?.firstChild;

    expect(startNode).toBeTruthy();
    expect(endNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(startNode!, 1);
    range.setEnd(endNode!, 3);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'Alpha Beta Gamma')).toEqual({
      text: 'eta Ga',
      startOffset: 7,
      endOffset: 13,
    });
  });

  it('ignores formatting whitespace nodes around segments when resolving offsets', () => {
    const container = document.createElement('div');
    const paragraph = document.createElement('p');
    const leadingWhitespace = document.createTextNode(' ');
    const plainSegment = document.createElement('span');
    const trailingWhitespace = document.createTextNode(' ');
    const annotatedSegment = document.createElement('span');

    paragraph.setAttribute('data-paragraph-start', '0');
    plainSegment.setAttribute('data-segment-start', '0');
    plainSegment.textContent = 'диалога с США,';
    annotatedSegment.setAttribute('data-segment-start', '15');
    annotatedSegment.textContent = 'заявил';
    paragraph.append(leadingWhitespace, plainSegment, trailingWhitespace, annotatedSegment);
    container.append(paragraph);
    document.body.append(container);

    const textNode = plainSegment.firstChild;

    expect(textNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, plainSegment.textContent!.length);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'диалога с США, заявил')).toEqual({
      text: 'диалога с США,',
      startOffset: 0,
      endOffset: 14,
    });
  });

  it('keeps the last selected symbol when range ends at the paragraph boundary', () => {
    const container = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.setAttribute('data-paragraph-start', '0');
    paragraph.innerHTML = '<span data-segment-start="0">Alpha</span>';
    container.append(paragraph);
    document.body.append(container);

    const textNode = paragraph.querySelector('span')?.firstChild;

    expect(textNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(textNode!, 4);
    range.setEnd(paragraph, paragraph.childNodes.length);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'Alpha')).toEqual({
      text: 'a',
      startOffset: 4,
      endOffset: 5,
    });
  });

  it('keeps offsets stable when selection crosses paragraph boundaries created from line breaks', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<p data-paragraph-start="0"><span data-segment-start="0">Alpha</span></p><p data-paragraph-start="6"><span data-segment-start="6">Beta</span></p>';
    document.body.append(container);

    const paragraphs = container.querySelectorAll('p');
    const startNode = paragraphs[0]?.querySelector('span')?.firstChild;
    const endNode = paragraphs[1]?.querySelector('span')?.firstChild;

    expect(startNode).toBeTruthy();
    expect(endNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(startNode!, 2);
    range.setEnd(endNode!, 2);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'Alpha\nBeta')).toEqual({
      text: 'pha\nBe',
      startOffset: 2,
      endOffset: 8,
    });
  });

  it('returns null when the browser selection escapes the article container', () => {
    const container = document.createElement('div');
    const outside = document.createElement('div');
    container.innerHTML =
      '<p data-paragraph-start="0"><span data-segment-start="0">Alpha Beta Gamma</span></p>';
    outside.textContent = 'Outside selection';
    document.body.append(container, outside);

    const range = document.createRange();
    range.setStart(outside.firstChild!, 0);
    range.setEnd(outside.firstChild!, 7);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'Alpha Beta Gamma')).toBeNull();
  });

  it('uses canonical text from article offsets even when browser selection text is normalized differently', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<p data-paragraph-start="0"><span data-segment-start="0">Alpha Beta Gamma Delta</span></p>';
    document.body.append(container);

    const textNode = container.querySelector('span')?.firstChild;

    expect(textNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(textNode!, 6);
    range.setEnd(textNode!, 16);

    vi.spyOn(range, 'toString').mockReturnValue('Beta\nGamma');
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'Alpha Beta Gamma Delta')).toEqual({
      text: 'Beta Gamma',
      startOffset: 6,
      endOffset: 16,
    });
  });

  it('ignores selections made only of whitespace and line breaks', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<p data-paragraph-start="0"><span data-segment-start="0">Alpha \n\n Beta</span></p>';
    document.body.append(container);

    const textNode = container.querySelector('span')?.firstChild;

    expect(textNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(textNode!, 5);
    range.setEnd(textNode!, 9);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelection(container, 'Alpha \n\n Beta')).toBeNull();
  });

  it('falls back to the boundary element rect when browser range geometry is empty at the end of text', () => {
    const container = document.createElement('div');
    const paragraph = document.createElement('p');
    const segment = document.createElement('span');

    paragraph.setAttribute('data-paragraph-start', '0');
    segment.setAttribute('data-segment-start', '0');
    segment.textContent = 'Alpha';
    paragraph.append(segment);
    container.append(paragraph);
    document.body.append(container);

    const textNode = segment.firstChild;

    expect(textNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(textNode!, 4);
    range.setEnd(paragraph, paragraph.childNodes.length);

    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 }),
    });
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () =>
        ({
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {},
        }) as DOMRectList,
    });
    vi.spyOn(segment, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 120, y: 240, width: 12, height: 24 }),
    );
    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      getRangeAt: () => range,
    } as unknown as Selection);

    expect(service.getSelectionRect(container)).toEqual(
      DOMRect.fromRect({ x: 120, y: 240, width: 12, height: 24 }),
    );
  });
});
