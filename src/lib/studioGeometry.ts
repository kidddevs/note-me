/** Geometry shared by the inch-based cover and percentage-based page canvas. */
export interface StudioRect { x: number; y: number; width: number; height: number }
export type StudioAlign = "left" | "center-x" | "right" | "top" | "middle" | "bottom";
export type StudioAxis = "horizontal" | "vertical";
export type StudioSpacing = "gaps" | "centers";
export type StudioArrangeReference = "selection" | "canvas" | "safe";

export function studioBounds(rects: StudioRect[]): StudioRect | null {
  if (!rects.length || rects.some((rect) => ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0)) return null;
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  return { x, y, width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x, height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y };
}

export function rotatedStudioBounds(rect: StudioRect, rotation = 0): StudioRect {
  const angle = rotation * Math.PI / 180;
  const width = Math.abs(Math.cos(angle)) * rect.width + Math.abs(Math.sin(angle)) * rect.height;
  const height = Math.abs(Math.sin(angle)) * rect.width + Math.abs(Math.cos(angle)) * rect.height;
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height };
}

/** Align visual rectangles while preserving their size and input order. */
export function alignStudioRects<T extends StudioRect>(rects: T[], mode: StudioAlign, target = studioBounds(rects)): T[] {
  if (!target || !studioBounds([target, ...rects])) return [];
  return rects.map((rect) => ({ ...rect,
    x: mode === "left" ? target.x : mode === "center-x" ? target.x + (target.width - rect.width) / 2 : mode === "right" ? target.x + target.width - rect.width : rect.x,
    y: mode === "top" ? target.y : mode === "middle" ? target.y + (target.height - rect.height) / 2 : mode === "bottom" ? target.y + target.height - rect.height : rect.y,
  }));
}

/** Keep the two outer items fixed and space the others by edges or centers. */
export function distributeStudioRects<T extends StudioRect>(rects: T[], axis: StudioAxis, spacing: StudioSpacing = "gaps"): T[] {
  if (rects.length < 3 || !studioBounds(rects)) return [];
  const position = axis === "horizontal" ? "x" : "y";
  const size = axis === "horizontal" ? "width" : "height";
  const anchor = (rect: StudioRect) => rect[position] + (spacing === "centers" ? rect[size] / 2 : 0);
  const entries = rects.map((rect, index) => ({ rect, index })).sort((a, b) => anchor(a.rect) - anchor(b.rect) || a.index - b.index);
  const first = entries[0].rect, last = entries[entries.length - 1].rect;
  const gap = (last[position] + last[size] - first[position] - rects.reduce((sum, rect) => sum + rect[size], 0)) / (rects.length - 1);
  const step = (anchor(last) - anchor(first)) / (rects.length - 1);
  const result = [...rects];
  let cursor = first[position];
  entries.forEach(({ rect, index }, order) => {
    const value = order === 0 || order === entries.length - 1 ? rect[position] : spacing === "centers" ? anchor(first) + step * order - rect[size] / 2 : cursor;
    result[index] = { ...rect, [position]: value };
    cursor += rect[size] + gap;
  });
  return result;
}
