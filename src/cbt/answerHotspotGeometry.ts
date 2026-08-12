import type { AnswerHotspot, AnswerHotspotSegment } from './types';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Builds one visible/clickable box per answer.
 *
 * PaddleOCR may return one rectangle per wrapped line. Its rectangles already
 * include the printed ①·②·③·④ marker and a small reading margin. Their union
 * encloses every line without filling the unused part of the old broad cell.
 */
export function unifiedAnswerHotspot(hotspot: AnswerHotspot): AnswerHotspot {
  const segments = hotspot.segments || [];
  if (!segments.length) return { ...hotspot };

  const left = clamp(Math.min(...segments.map((segment) => segment.x)));
  const top = clamp(Math.min(...segments.map((segment) => segment.y)));
  const right = clamp(Math.max(...segments.map((segment) => segment.x + segment.width)));
  const bottom = clamp(Math.max(...segments.map((segment) => segment.y + segment.height)));

  return {
    choice: hotspot.choice,
    x: left,
    y: top,
    width: Math.max(0.01, right - left),
    height: Math.max(0.01, bottom - top),
    segments,
  };
}

export function unifiedAnswerHotspots(hotspots: AnswerHotspot[]): AnswerHotspot[] {
  const boxes = hotspots.map(unifiedAnswerHotspot);
  const minX = Math.min(...hotspots.map((hotspot) => hotspot.x));
  const maxX = Math.max(...hotspots.map((hotspot) => hotspot.x));
  const twoColumns = maxX - minX > 24;
  const columns = twoColumns
    ? [boxes.filter((box) => box.choice === 1 || box.choice === 3), boxes.filter((box) => box.choice === 2 || box.choice === 4)]
    : [boxes];

  // OCR margins can touch by a fraction of a percent at an adjacent column.
  // Split only that shared sliver at its midpoint.
  if (twoColumns) {
    const [leftColumn, rightColumn] = columns;
    const leftEdge = Math.max(...leftColumn.map((box) => box.x + box.width));
    const rightEdge = Math.min(...rightColumn.map((box) => box.x));
    if (leftEdge > rightEdge) {
      const boundary = (leftEdge + rightEdge) / 2;
      for (const box of leftColumn) box.width = Math.min(box.width, boundary - box.x);
      for (const box of rightColumn) {
        const edge = box.x + box.width;
        box.x = Math.max(box.x, boundary);
        box.width = edge - box.x;
      }
    }
  }

  // Do the same for vertically adjacent answers. The normalized box becomes
  // the single source of truth for hover, click, and selected-area display.
  for (const column of columns) {
    const ordered = [...column].sort((left, right) => left.y - right.y);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const top = ordered[index];
      const bottom = ordered[index + 1];
      const topEdge = top.y + top.height;
      if (topEdge <= bottom.y) continue;
      const boundary = (topEdge + bottom.y) / 2;
      top.height = boundary - top.y;
      const bottomEdge = bottom.y + bottom.height;
      bottom.y = boundary;
      bottom.height = bottomEdge - boundary;
    }
  }

  return boxes;
}

export function hotspotStyle(hotspot: AnswerHotspotSegment): Record<string, string> {
  return {
    left: `${hotspot.x}%`,
    top: `${hotspot.y}%`,
    width: `${hotspot.width}%`,
    height: `${hotspot.height}%`,
  };
}
