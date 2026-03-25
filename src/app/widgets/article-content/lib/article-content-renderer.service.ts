import { Injectable } from '@angular/core';
import { Annotation } from '../../../entities/annotation/model/annotation.model';

export interface RenderedArticleSegment {
  /** Стабильный ключ сегмента для шаблона. */
  key: string;

  /** Текст сегмента. */
  text: string;

  /** Аннотация, если сегмент подсвечен. */
  annotation: Annotation | null;

  /** Смещение начала сегмента в исходном тексте статьи. */
  startOffset: number;
}

export interface RenderedArticleParagraph {
  /** Стабильный ключ абзаца для шаблона. */
  key: string;

  /** Смещение начала абзаца в исходном тексте статьи. */
  startOffset: number;

  /** Сегменты, из которых состоит абзац. */
  segments: RenderedArticleSegment[];
}

@Injectable({
  providedIn: 'root',
})
export class ArticleContentRendererService {
  /** Разбивает текст статьи на абзацы и сегменты с учётом аннотаций. */
  render(content: string, annotations: Annotation[]): RenderedArticleParagraph[] {
    if (!content) {
      return [];
    }

    const renderableAnnotations = this.getRenderableAnnotations(content, annotations);
    const segments: RenderedArticleSegment[] = [];
    let cursor = 0;

    for (const annotation of renderableAnnotations) {
      if (annotation.startOffset > cursor) {
        segments.push({
          key: `plain-${cursor}`,
          text: content.slice(cursor, annotation.startOffset),
          annotation: null,
          startOffset: cursor,
        });
      }

      segments.push({
        key: `annotation-${annotation.id}`,
        text: content.slice(annotation.startOffset, annotation.endOffset),
        annotation,
        startOffset: annotation.startOffset,
      });
      cursor = annotation.endOffset;
    }

    if (cursor < content.length) {
      segments.push({
        key: `plain-${cursor}`,
        text: content.slice(cursor),
        annotation: null,
        startOffset: cursor,
      });
    }

    return this.splitIntoParagraphs(segments);
  }

  /** Отбрасывает невалидные и пересекающиеся аннотации перед рендерингом. */
  private getRenderableAnnotations(content: string, annotations: Annotation[]): Annotation[] {
    const contentLength = content.length;
    const sortedAnnotations = [...annotations]
      .filter(
        (annotation) =>
          annotation.startOffset >= 0 &&
          annotation.endOffset <= contentLength &&
          annotation.startOffset < annotation.endOffset,
      )
      .sort(
        (leftAnnotation, rightAnnotation) =>
          leftAnnotation.startOffset - rightAnnotation.startOffset ||
          leftAnnotation.endOffset - rightAnnotation.endOffset,
      );

    const renderableAnnotations: Annotation[] = [];
    let lastEndOffset = -1;

    for (const annotation of sortedAnnotations) {
      if (annotation.startOffset < lastEndOffset) {
        continue;
      }

      renderableAnnotations.push(annotation);
      lastEndOffset = annotation.endOffset;
    }

    return renderableAnnotations;
  }

  /** Разбивает последовательность сегментов на абзацы по символам переноса строки. */
  private splitIntoParagraphs(segments: RenderedArticleSegment[]): RenderedArticleParagraph[] {
    const paragraphs: RenderedArticleParagraph[] = [];
    let currentParagraphSegments: RenderedArticleSegment[] = [];
    let paragraphIndex = 0;
    let currentParagraphStartOffset = segments[0]?.startOffset ?? 0;
    const pushParagraph = () => {
      if (currentParagraphSegments.length === 0) {
        return;
      }

      paragraphs.push({
        key: `paragraph-${paragraphIndex++}`,
        startOffset: currentParagraphStartOffset,
        segments: currentParagraphSegments,
      });
      currentParagraphSegments = [];
    };

    for (const segment of segments) {
      const parts = segment.text.split('\n');
      let localOffset = 0;

      parts.forEach((part, index) => {
        if (currentParagraphSegments.length === 0) {
          currentParagraphStartOffset = segment.startOffset + localOffset;
        }

        if (part) {
          currentParagraphSegments.push({
            key: `${segment.key}-${segment.startOffset + localOffset}`,
            text: part,
            annotation: segment.annotation,
            startOffset: segment.startOffset + localOffset,
          });
        }

        localOffset += part.length;

        if (index < parts.length - 1) {
          // Символ переноса не рендерится как текст, но влияет на глобальные смещения.
          pushParagraph();
          localOffset += 1;
          currentParagraphStartOffset = segment.startOffset + localOffset;
        }
      });
    }

    pushParagraph();

    return paragraphs;
  }
}
