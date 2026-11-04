export interface CoverPaletteOptions {
  alphaThreshold?: number;
  similarity?: number;
}

interface ColorBucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

function colorDistance(a: ColorBucket, b: ColorBucket) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Extracts a compact, visually distinct palette from RGBA pixel data.
 * Channels are popularity-quantized first, then near-duplicate buckets merge.
 */
export function extractPaletteFromPixels(pixels: ArrayLike<number>, count = 8, options: CoverPaletteOptions = {}): string[] {
  const totalPixels = Math.floor(pixels.length / 4);
  if (totalPixels === 0) return [];
  const maximum = Math.max(1, Math.min(16, Math.round(count)));
  const alphaThreshold = Math.max(0, Math.min(255, options.alphaThreshold ?? 32));
  const similarity = Math.max(0, options.similarity ?? 36);
  const step = Math.max(1, Math.floor(totalPixels / 24_000));
  const buckets = new Map<number, ColorBucket>();

  for (let index = 0; index < totalPixels; index += step) {
    const offset = index * 4;
    if ((pixels[offset + 3] ?? 255) < alphaThreshold) continue;
    const r = pixels[offset] ?? 0;
    const g = pixels[offset + 1] ?? 0;
    const b = pixels[offset + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const ranked = [...buckets.values()]
    .map((bucket) => ({ r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count, count: bucket.count }))
    .sort((a, b) => b.count - a.count);
  const picked: ColorBucket[] = [];
  for (const bucket of ranked) {
    if (picked.some((color) => colorDistance(color, bucket) < similarity)) continue;
    picked.push(bucket);
    if (picked.length >= maximum) break;
  }
  return picked.map((color) => toHex(color.r, color.g, color.b));
}
