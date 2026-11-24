import { api, type SystemFontAsset, type SystemFontAxis } from "./api";
import { normalizeFontFamily } from "./fontFamilies";

export type { SystemFontAsset, SystemFontAxis } from "./api";

export interface SystemFontFamilyDetails {
  family: string;
  faceCount: number;
  axes: SystemFontAxis[];
}

let systemFontsRequest: Promise<string[]> | null = null;
let systemFontAssetsRequest: Promise<SystemFontAsset[]> | null = null;

function uniqueFontNames(fonts: string[]) {
  const names = new Map<string, string>();
  fonts.forEach((font) => {
    const normalized = normalizeFontFamily(font, 120);
    if (!normalized) return;
    const key = normalized.toLocaleLowerCase();
    if (!names.has(key)) names.set(key, normalized);
  });
  return [...names.values()].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

/**
 * Resolve the font families visible to the native desktop host. Browser and
 * fixture environments may not expose the Tauri command, so an empty list is
 * a supported fallback and the text field remains available.
 */
export function loadSystemFonts() {
  if (!systemFontsRequest) {
    systemFontsRequest = api.listSystemFonts()
      .then(uniqueFontNames)
      .catch(() => []);
  }
  return systemFontsRequest;
}

function uniqueFontAssets(assets: SystemFontAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const family = normalizeFontFamily(asset.family, 120);
    if (!family || !asset.path || !["ttf", "otf", "ttc"].includes(asset.extension)) return false;
    const axisKey = (asset.axes ?? []).map((axis) => `${axis.tag}:${axis.min}:${axis.default}:${axis.max}`).join("|");
    const key = `${family.toLocaleLowerCase()}::${asset.path}::${asset.weight ?? 400}::${asset.style ?? "normal"}::${axisKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((asset) => ({ ...asset, family: normalizeFontFamily(asset.family, 120), axes: (asset.axes ?? []) as SystemFontAxis[] } as SystemFontAsset));
}

/** Group native font faces into the family-level metadata shown by the picker. */
export function systemFontFamilyDetails(assets: SystemFontAsset[]) {
  const families = new Map<string, SystemFontFamilyDetails>();
  assets.forEach((asset) => {
    const family = normalizeFontFamily(asset.family, 120);
    if (!family) return;
    const key = family.toLocaleLowerCase();
    const current = families.get(key) ?? { family, faceCount: 0, axes: [] };
    current.faceCount += 1;
    (asset.axes ?? []).forEach((axis) => {
      const existing = current.axes.find((candidate) => candidate.tag.toLocaleLowerCase() === axis.tag.toLocaleLowerCase());
      if (existing) {
        existing.min = Math.min(existing.min, axis.min);
        existing.max = Math.max(existing.max, axis.max);
        return;
      }
      current.axes.push({ ...axis });
    });
    families.set(key, current);
  });
  return families;
}

/**
 * Resolve the native font files that can be offered for an explicit export.
 * The browser fallback is intentionally empty: installed files are only read
 * by the native command after the user opts into licensed embedding.
 */
export function loadSystemFontAssets() {
  if (!systemFontAssetsRequest) {
    systemFontAssetsRequest = api.listSystemFontAssets()
      .then(uniqueFontAssets)
      .catch(() => []);
  }
  return systemFontAssetsRequest;
}

export async function readSystemFontAsset(asset: Pick<SystemFontAsset, "path">) {
  const data = await api.readSystemFontAsset(asset.path);
  return {
    ...asset,
    extension: data.extension,
    bytes: new Uint8Array(data.bytes),
  };
}
