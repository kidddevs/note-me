export const FONT_OPTIONS = [
  { value: "serif", label: "Editorial Serif", css: "Georgia, 'Times New Roman', serif" },
  { value: "humanist", label: "Humanist", css: "Palatino, 'Palatino Linotype', serif" },
  { value: "sans", label: "Modern Sans", css: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" },
  { value: "mono", label: "Typewriter", css: "'SF Mono', 'Courier New', monospace" },
];

/** Keep a user-selected family or fallback stack safe to put in a CSS value. */
export function normalizeFontFamily(fontFamily: string, maximum = 200) {
  return fontFamily
    .replace(/[<>{};\\"`]/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N}\s,._&()+\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
    .trim();
}

export function fontCss(fontFamily: string) {
  const preset = FONT_OPTIONS.find((font) => font.value === fontFamily);
  if (preset) return preset.css;
  const custom = normalizeFontFamily(fontFamily);
  return custom || FONT_OPTIONS[0].css;
}
