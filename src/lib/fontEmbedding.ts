export type EmbeddedFontFormat = "ttf" | "otf";
export type EmbeddedFontStyle = "normal" | "italic";

export interface FontRequest {
  family: string;
  weight: number;
  style: EmbeddedFontStyle;
}

export interface FontAxis {
  tag: string;
  min: number;
  default: number;
  max: number;
}

export interface EmbeddedFont {
  family: string;
  format: EmbeddedFontFormat;
  bytes: Uint8Array;
  weight?: number;
  style?: EmbeddedFontStyle;
}

export interface FontAssetDescriptor {
  family: string;
  path: string;
  extension: "ttf" | "otf" | "ttc";
  bytes: number;
  weight?: number;
  style?: EmbeddedFontStyle;
  axes?: FontAxis[];
}

export interface FontAssetMatch {
  request: FontRequest;
  asset: FontAssetDescriptor;
  exact: boolean;
}

const GENERIC_FAMILIES = new Set([
  "cursive",
  "fantasy",
  "inherit",
  "initial",
  "math",
  "monospace",
  "sans-serif",
  "serif",
  "system-ui",
  "ui-monospace",
  "ui-rounded",
  "ui-sans-serif",
  "ui-serif",
  "unset",
]);

function sameFamily(left: string, right: string) {
  return left.trim().replace(/^['"]|['"]$/g, "").toLocaleLowerCase() === right.trim().replace(/^['"]|['"]$/g, "").toLocaleLowerCase();
}

function normalizeWeight(value: number | undefined) {
  if (!Number.isFinite(value)) return 400;
  return Math.min(900, Math.max(100, Math.round((value as number) / 100) * 100));
}

function normalizeStyle(value: EmbeddedFontStyle | undefined): EmbeddedFontStyle {
  return value === "italic" ? "italic" : "normal";
}

export function fontStackFamilies(value: string) {
  return value
    .split(",")
    .map((family) => family.trim().replace(/^['"]|['"]$/g, ""))
    .filter((family) => family && !GENERIC_FAMILIES.has(family.toLocaleLowerCase()));
}

export function primaryFontFamily(value: string) {
  return fontStackFamilies(value)[0] ?? "";
}

export function fontRequestKey(request: FontRequest) {
  return `${primaryFontFamily(request.family).toLocaleLowerCase()}::${normalizeWeight(request.weight)}::${normalizeStyle(request.style)}`;
}

function assetWeight(asset: FontAssetDescriptor) {
  return normalizeWeight(asset.weight);
}

function assetStyle(asset: FontAssetDescriptor) {
  return normalizeStyle(asset.style);
}

function assetAxis(asset: FontAssetDescriptor, tag: string) {
  return asset.axes?.find((axis) => axis.tag.toLocaleLowerCase() === tag);
}

function axisCovers(axis: FontAxis | undefined, value: number) {
  return Boolean(axis && Number.isFinite(axis.min) && Number.isFinite(axis.max) && axis.min <= value && value <= axis.max);
}

function supportsWeight(asset: FontAssetDescriptor, weight: number) {
  return axisCovers(assetAxis(asset, "wght"), weight) || assetWeight(asset) === weight;
}

function supportsStyle(asset: FontAssetDescriptor, style: EmbeddedFontStyle) {
  if (assetStyle(asset) === style) return true;
  const italicAxis = assetAxis(asset, "ital");
  if (italicAxis) return axisCovers(italicAxis, style === "italic" ? 1 : 0);
  const slantAxis = assetAxis(asset, "slnt");
  if (slantAxis) return style === "italic" ? slantAxis.min < 0 || slantAxis.max > 0 : axisCovers(slantAxis, 0);
  return false;
}

function isVariableFont(asset: FontAssetDescriptor) {
  return Boolean(asset.axes?.some((axis) => ["wght", "ital", "slnt"].includes(axis.tag.toLocaleLowerCase())));
}

function assetVariantKey(asset: FontAssetDescriptor) {
  const axes = (asset.axes ?? []).map((axis) => `${axis.tag}:${axis.min}:${axis.default}:${axis.max}`).join("|");
  return `${asset.family.toLocaleLowerCase()}::${asset.path}::${assetWeight(asset)}::${assetStyle(asset)}::${axes}`;
}

/** Match each requested family face to the closest readable TTF or OTF. Variable axes can cover a requested weight/style. TTC files stay local-only. */
export function fontAssetMatches(requests: FontRequest[], assets: FontAssetDescriptor[]): FontAssetMatch[] {
  const matches = new Map<string, FontAssetMatch>();
  for (const request of requests) {
    const normalizedRequest: FontRequest = {
      family: request.family,
      weight: normalizeWeight(request.weight),
      style: normalizeStyle(request.style),
    };
    const key = fontRequestKey(normalizedRequest);
    if (!primaryFontFamily(normalizedRequest.family) || matches.has(key)) continue;
    const candidates = assets
      .filter((candidate) => candidate.extension === "ttf" || candidate.extension === "otf")
      .filter((candidate) => sameFamily(candidate.family, primaryFontFamily(normalizedRequest.family)))
      .sort((left, right) => {
        const leftExact = Number(supportsWeight(left, normalizedRequest.weight) && supportsStyle(left, normalizedRequest.style));
        const rightExact = Number(supportsWeight(right, normalizedRequest.weight) && supportsStyle(right, normalizedRequest.style));
        const leftStyleDistance = Number(!supportsStyle(left, normalizedRequest.style));
        const rightStyleDistance = Number(!supportsStyle(right, normalizedRequest.style));
        return rightExact - leftExact
          || leftStyleDistance - rightStyleDistance
          || Number(isVariableFont(left)) - Number(isVariableFont(right))
          || Math.abs(assetWeight(left) - normalizedRequest.weight) - Math.abs(assetWeight(right) - normalizedRequest.weight)
          || assetVariantKey(left).localeCompare(assetVariantKey(right));
      });
    const asset = candidates[0];
    if (!asset) continue;
    matches.set(key, {
      request: normalizedRequest,
      asset,
      exact: supportsWeight(asset, normalizedRequest.weight) && supportsStyle(asset, normalizedRequest.style),
    });
  }
  return [...matches.values()];
}

/** Pick one exact regular face for each selected family stack. TTC files stay local-only. */
export function embeddableFontAssets(families: string[], assets: FontAssetDescriptor[]) {
  return fontAssetMatches(families.map((family) => ({ family, weight: 400, style: "normal" })), assets)
    .filter((match) => match.exact)
    .map((match) => match.asset);
}

function cssFamily(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function fontCssFormat(format: EmbeddedFontFormat) {
  return format === "otf" ? "opentype" : "truetype";
}

export function fontMimeType(format: EmbeddedFontFormat) {
  return format === "otf" ? "font/otf" : "font/ttf";
}

export function embeddedFontFaceCss(fonts: EmbeddedFont[], sourceFor: (font: EmbeddedFont, index: number) => string) {
  return fonts.map((font, index) => `@font-face{font-family:${cssFamily(font.family)};src:url(${sourceFor(font, index)}) format('${fontCssFormat(font.format)}');font-style:${normalizeStyle(font.style)};font-weight:${normalizeWeight(font.weight)};font-display:swap;}`).join("");
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function fontKeyBytes(font: EmbeddedFont, index: number) {
  let hash = 2166136261 >>> 0;
  const seed = `${font.family}:${font.format}:${index}:${font.bytes.length}`;
  for (let offset = 0; offset < seed.length; offset += 1) {
    hash ^= seed.charCodeAt(offset);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  for (const offset of [0, Math.floor(font.bytes.length / 2), Math.max(0, font.bytes.length - 1)]) {
    hash ^= font.bytes[offset] ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const key = new Uint8Array(16);
  for (let offset = 0; offset < key.length; offset += 1) {
    hash ^= offset + 0x9e3779b9;
    hash = Math.imul(hash, 16777619) >>> 0;
    key[offset] = (hash >>> ((offset % 4) * 8)) & 0xff;
  }
  return key;
}

function guidText(key: Uint8Array) {
  const hex = [...key].map((value) => value.toString(16).padStart(2, "0"));
  return [hex.slice(0, 4).join(""), hex.slice(4, 6).join(""), hex.slice(6, 8).join(""), hex.slice(8, 10).join(""), hex.slice(10).join("")].join("-").toUpperCase();
}

function obfuscateDocxFont(bytes: Uint8Array, key: Uint8Array) {
  const output = new Uint8Array(bytes);
  const obfuscationKey = new Uint8Array([
    ...key.slice(0, 4).reverse(),
    ...key.slice(4, 6).reverse(),
    ...key.slice(6, 8).reverse(),
    ...key.slice(8),
  ]);
  for (let offset = 0; offset < Math.min(32, output.length); offset += 1) {
    output[offset] ^= obfuscationKey[offset % obfuscationKey.length];
  }
  return output;
}

export interface DocxFontPackage {
  files: Record<string, Uint8Array>;
  fontTableXml: string;
  fontTableRelationshipsXml: string;
  documentRelationship: string;
  contentTypeDefaults: string;
  contentTypeOverride: string;
}

function docxFontRole(font: EmbeddedFont) {
  const bold = normalizeWeight(font.weight) >= 600;
  const italic = normalizeStyle(font.style) === "italic";
  if (bold && italic) return "BoldItalic";
  if (bold) return "Bold";
  if (italic) return "Italic";
  return "Regular";
}

/** Build the OOXML fontTable parts and Word's reversible obfuscated font payloads. */
export function docxFontPackage(fonts: EmbeddedFont[]): DocxFontPackage | null {
  if (fonts.length === 0) return null;
  const entries = fonts.map((font, index) => {
    const key = fontKeyBytes(font, index);
    const filename = `font${index + 1}.odttf`;
    return {
      font,
      relationshipId: `rId${index + 1}`,
      filename,
      key: guidText(key),
      bytes: obfuscateDocxFont(font.bytes, key),
      role: docxFontRole(font),
    };
  });
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    const familyKey = entry.font.family.toLocaleLowerCase();
    const familyEntries = grouped.get(familyKey) ?? [];
    if (!familyEntries.some((candidate) => candidate.role === entry.role)) familyEntries.push(entry);
    grouped.set(familyKey, familyEntries);
  }
  const uniqueEntries = [...grouped.values()].flat();
  return {
    files: Object.fromEntries(uniqueEntries.map((entry) => [`word/fonts/${entry.filename}`, entry.bytes])),
    fontTableXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${[...grouped.values()].map((familyEntries) => `<w:font w:name="${xmlEscape(familyEntries[0].font.family)}">${familyEntries.map((entry) => `<w:embed${entry.role} r:id="${entry.relationshipId}" w:fontKey="{${entry.key}}"/>`).join("")}</w:font>`).join("")}</w:fonts>`,
    fontTableRelationshipsXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${uniqueEntries.map((entry) => `<Relationship Id="${entry.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${entry.filename}"/>`).join("")}</Relationships>`,
    documentRelationship: `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>`,
    contentTypeDefaults: `<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>`,
    contentTypeOverride: `<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>`,
  };
}
