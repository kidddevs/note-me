export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCoverHex(value: string) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!match) return null;
  const raw = match[1];
  const expanded = raw.length <= 4 ? raw.split("").map((character) => `${character}${character}`).join("") : raw;
  return `#${expanded.toLocaleLowerCase()}`;
}

export function parseCoverColor(value: string): Rgba {
  const normalized = normalizeCoverHex(value) ?? "#000000";
  const hex = normalized.slice(1);
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: Math.round(alpha * 1000) / 1000,
  };
}

export function rgbaToHex({ r, g, b, a }: Rgba) {
  const channels = [r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"));
  const alpha = Math.round(clamp(a, 0, 1) * 255);
  return `#${channels.join("")}${alpha < 255 ? alpha.toString(16).padStart(2, "0") : ""}`;
}

export function rgbToHsv({ r, g, b }: Pick<Rgba, "r" | "g" | "b">): Hsv {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgba {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;
  const [red, green, blue] = hue < 60 ? [chroma, x, 0]
    : hue < 120 ? [x, chroma, 0]
      : hue < 180 ? [0, chroma, x]
        : hue < 240 ? [0, x, chroma]
          : hue < 300 ? [x, 0, chroma]
            : [chroma, 0, x];
  return { r: (red + m) * 255, g: (green + m) * 255, b: (blue + m) * 255, a: 1 };
}
