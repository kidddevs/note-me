import type { CSSProperties } from "react";
import { DEFAULT_BOOK_TYPOGRAPHY, type BookLayout, type BookParagraphStyle, type BookTextRole, type BookTextStyle, type BookTypography } from "./bookLayout";
import { fontCss } from "./bookPublishing";

export function paragraphStyleById(layout: BookLayout, id?: string) {
  if (!id) return null;
  return layout.paragraphStyles.find((style) => style.id === id) ?? null;
}

export function resolvedBlockTypography(typography: BookTypography, role: BookTextRole, preset: BookParagraphStyle | null): BookTypography {
  if (!preset) return typography;
  return { ...typography, [role]: preset.style };
}

export function styleColor(value: string) {
  if (value === "accent") return "var(--document-accent, var(--book-accent))";
  if (value === "inherit") return "inherit";
  return value;
}

export function textStyleClasses(style: BookTextStyle | null) {
  if (!style) return "";
  const classes = ["books-styled-text"];
  if (style.hyphenation) classes.push("styled-hyphenate");
  if (style.ruleAbove.enabled) classes.push("styled-rule-above");
  if (style.ruleBelow.enabled) classes.push("styled-rule-below");
  if (style.border.enabled) classes.push("styled-border");
  if (style.shading.enabled) classes.push("styled-shading");
  if (style.bullets.enabled) classes.push("styled-bullets", style.bullets.type === "number" ? "styled-bullets-number" : "styled-bullets-marker");
  if (style.textCase === "small-caps") classes.push("styled-small-caps");
  if (style.tabs.length > 0) classes.push("styled-tabs");
  return classes.join(" ");
}

export function textStyleVars(style: BookTextStyle | null): CSSProperties {
  if (!style) return {};
  const rule = (prefix: string, value: BookTextStyle["ruleAbove"]) => ({
    [`--${prefix}-width`]: `${value.width}px`,
    [`--${prefix}-color`]: styleColor(value.color),
    [`--${prefix}-style`]: value.style,
    [`--${prefix}-offset`]: `${value.offset}em`,
  });
  return {
    "--block-font": fontCss(style.fontFamily),
    "--block-size": `${style.fontSize}pt`,
    "--block-weight": String(style.fontWeight),
    "--block-style": style.fontStyle,
    "--block-align": style.textAlign,
    "--block-line-height": String(style.lineHeight),
    "--block-letter-spacing": `${style.letterSpacing}em`,
    "--block-first-indent": `${style.firstLineIndent}em`,
    "--block-left-indent": `${style.leftIndent}em`,
    "--block-right-indent": `${style.rightIndent}em`,
    "--block-space-before": `${style.spaceBefore}em`,
    "--block-space-after": `${style.spaceAfter}em`,
    "--block-color": styleColor(style.color),
    "--block-underline": style.underline ? "underline" : "none",
    "--block-strikethrough": style.strikethrough ? "line-through" : "none",
    "--block-decoration": [style.underline ? "underline" : "", style.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || "none",
    "--block-text-case": style.textCase === "uppercase" ? "uppercase" : style.textCase === "lowercase" ? "lowercase" : "none",
    "--block-hyphens": style.hyphenation ? "auto" : "manual",
    "--block-columns": String(style.columns),
    "--block-column-gap": `${style.columnGap}em`,
    "--block-border-width": `${style.border.width}px`,
    "--block-border-color": styleColor(style.border.color),
    "--block-border-style": style.border.style,
    "--block-border-padding": `${style.border.padding}em`,
    "--block-border-radius": `${style.border.radius}px`,
    "--block-shading-color": style.shading.enabled ? `color-mix(in srgb, ${styleColor(style.shading.color)} 16%, transparent)` : "transparent",
    "--block-bullet-marker": JSON.stringify(style.bullets.marker),
    "--block-bullet-indent": `${style.bullets.indent}em`,
    "--block-tab-size": `${style.tabs[0]?.position ?? 4}`,
    "--block-drop-cap-color": styleColor(style.dropCapColor),
    "--block-drop-cap-gap": `${style.dropCapGap}em`,
    "--block-drop-cap-size": `${style.fontSize * style.dropCapLines * 0.82}pt`,
    "--block-drop-cap-font": fontCss(style.dropCapFontFamily),
    "--block-nested-color": styleColor(style.nestedColor),
    "--block-nested-font": fontCss(style.nestedFontFamily),
    ...rule("rule-above", style.ruleAbove),
    ...rule("rule-below", style.ruleBelow),
  } as CSSProperties;
}

export function applyGrepStyle(html: string, style: BookTextStyle) {
  if (!style.grep.enabled || !style.grep.pattern || style.grep.style === "none") return html;
  let pattern: RegExp;
  try {
    pattern = new RegExp(style.grep.pattern, "g");
  } catch {
    return html;
  }
  return html.replace(/>([^<]+)</g, (_match, text: string) => `>${text.replace(pattern, (found) => `<span class="design-grep design-grep-${style.grep.style}" style="color:${styleColor(style.grep.color)}">${found}</span>`)}<`);
}

export function cloneParagraphStyle(preset: BookParagraphStyle, id: string, name: string): BookParagraphStyle {
  return {
    id,
    name,
    style: {
      ...preset.style,
      ruleAbove: { ...preset.style.ruleAbove },
      ruleBelow: { ...preset.style.ruleBelow },
      border: { ...preset.style.border },
      shading: { ...preset.style.shading },
      bullets: { ...preset.style.bullets },
      grep: { ...preset.style.grep },
      tabs: preset.style.tabs.map((tab) => ({ ...tab })),
    },
  };
}

export function styleFromRole(layout: BookLayout, role: BookTextRole): BookTextStyle {
  const style = layout.typography[role] ?? DEFAULT_BOOK_TYPOGRAPHY.paragraph;
  return {
    ...style,
    ruleAbove: { ...style.ruleAbove },
    ruleBelow: { ...style.ruleBelow },
    border: { ...style.border },
    shading: { ...style.shading },
    bullets: { ...style.bullets },
    grep: { ...style.grep },
    tabs: style.tabs.map((tab) => ({ ...tab })),
  };
}

export function uniqueStyleId(layout: BookLayout, base = "style") {
  const used = new Set(layout.paragraphStyles.map((style) => style.id));
  let index = 1;
  let id = base;
  while (used.has(id)) {
    index += 1;
    id = `${base}-${index}`;
  }
  return id;
}
