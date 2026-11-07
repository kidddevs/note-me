export const COVER_IMAGE_DB_NAME = "book-studio-image-library";
export const COVER_IMAGE_DB_VERSION = 1;
export const COVER_IMAGE_STORE = "cover-images";
export const MAX_COVER_IMAGE_ASSETS = 24;
export const IMAGE_LIBRARY_CHANGED = "book-studio-image-library-changed";

export interface CoverImageDetails {
  alt: string;
  credit: string;
  license: string;
  tags: string[];
  favorite: boolean;
}

export interface CoverImageAsset extends CoverImageDetails {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  bytes: number;
}

export interface CoverImageInput extends Partial<CoverImageDetails> {
  name: string;
  src: string;
  width: number;
  height: number;
}

export type CoverImageDetailsPatch = Partial<CoverImageDetails & { name: string }>;

function newAssetId() {
  return `cover-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function estimateImageBytes(src: string) {
  return Math.max(0, Math.round(src.length * 0.75));
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").trim().slice(0, limit) : "";
}

function dimension(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function normalizeCoverImageDetails(value: Partial<CoverImageDetails>): CoverImageDetails {
  const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => text(tag, 32)).filter(Boolean) : [];
  return {
    alt: text(value.alt, 500), credit: text(value.credit, 240), license: text(value.license, 500),
    tags: [...new Map(tags.map((tag) => [tag.toLocaleLowerCase(), tag])).values()].slice(0, 12),
    favorite: value.favorite === true,
  };
}

/** Old version-1 records gain metadata defaults without rewriting the library. */
export function normalizeCoverImageAsset(value: unknown): CoverImageAsset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CoverImageAsset>;
  if (typeof raw.id !== "string" || !raw.id || typeof raw.src !== "string" || !raw.src) return null;
  const createdAt = text(raw.createdAt, 40);
  return {
    ...normalizeCoverImageDetails(raw), id: raw.id, src: raw.src,
    name: text(raw.name, 80) || "Studio image", width: dimension(raw.width), height: dimension(raw.height),
    createdAt, updatedAt: text(raw.updatedAt, 40) || createdAt, bytes: estimateImageBytes(raw.src),
  };
}

/** Reuses the source's id and details. A full library never evicts existing photos. */
export function prepareCoverImageAsset(input: CoverImageInput, existing: CoverImageAsset[], now: Date, id: string): CoverImageAsset | null {
  if (!input.src) return null;
  const previous = existing.find((asset) => asset.src === input.src);
  if (!previous && existing.length >= MAX_COVER_IMAGE_ASSETS) return null;
  const timestamp = now.toISOString();
  return {
    ...normalizeCoverImageDetails({ ...previous, ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) }),
    id: previous?.id ?? id, name: previous?.name ?? (text(input.name, 80) || "Studio image"), src: input.src,
    width: dimension(input.width) || previous?.width || 0, height: dimension(input.height) || previous?.height || 0,
    createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp, bytes: estimateImageBytes(input.src),
  };
}

export type CoverImageOrientation = "all" | "landscape" | "portrait" | "square";

export function filterCoverImageAssets(assets: CoverImageAsset[], query: string, orientation: CoverImageOrientation = "all", favorites = false) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return assets.filter((asset) => {
    if (favorites && !asset.favorite) return false;
    if (orientation !== "all") {
      if (!asset.width || !asset.height) return false;
      const ratio = asset.width / asset.height;
      if (orientation === "square" ? ratio < 0.95 || ratio > 1.05 : orientation === "landscape" ? ratio <= 1.05 : ratio >= 0.95) return false;
    }
    const searchable = [asset.name, asset.alt, asset.credit, asset.license, ...asset.tags].join(" ").toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

function changed() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(IMAGE_LIBRARY_CHANGED));
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(COVER_IMAGE_DB_NAME, COVER_IMAGE_DB_VERSION);
      let unavailable = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(COVER_IMAGE_STORE)) database.createObjectStore(COVER_IMAGE_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => {
        const database = request.result;
        if (unavailable) { database.close(); return; }
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => { unavailable = true; resolve(null); };
    } catch { resolve(null); }
  });
}

export async function listCoverImageAssets(): Promise<CoverImageAsset[]> {
  const database = await openDatabase();
  if (!database) return [];
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readonly");
      const request = transaction.objectStore(COVER_IMAGE_STORE).getAll();
      let assets: CoverImageAsset[] = [];
      request.onsuccess = () => {
        assets = request.result.map(normalizeCoverImageAsset).filter((asset): asset is CoverImageAsset => asset !== null);
        assets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
      };
      transaction.oncomplete = () => resolve(assets);
      transaction.onerror = transaction.onabort = () => resolve([]);
    });
  } catch { return []; }
  finally { database.close(); }
}

export async function saveCoverImageAsset(input: CoverImageInput, now = new Date()): Promise<CoverImageAsset | null> {
  if (!input.src) return null;
  const database = await openDatabase();
  if (!database) return null;
  try {
    const result = await new Promise<CoverImageAsset | null>((resolve, reject) => {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(COVER_IMAGE_STORE);
      const request = store.getAll();
      let asset: CoverImageAsset | null = null;
      request.onsuccess = () => {
        const existing = request.result.map(normalizeCoverImageAsset).filter((item): item is CoverImageAsset => item !== null);
        asset = prepareCoverImageAsset(input, existing, now, newAssetId());
        if (asset) store.put(asset);
      };
      transaction.oncomplete = () => resolve(asset);
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    if (result) changed();
    return result;
  } catch { return null; }
  finally { database.close(); }
}

/** Updates details only; embedded images already placed in documents stay independent. */
export async function updateCoverImageAsset(id: string, patch: CoverImageDetailsPatch): Promise<CoverImageAsset | null> {
  const database = await openDatabase();
  if (!database) return null;
  try {
    const result = await new Promise<CoverImageAsset | null>((resolve, reject) => {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(COVER_IMAGE_STORE);
      const request = store.get(id);
      let next: CoverImageAsset | null = null;
      request.onsuccess = () => {
        const previous = normalizeCoverImageAsset(request.result);
        if (!previous) return;
        next = {
          ...previous, ...normalizeCoverImageDetails({ ...previous, ...patch }),
          name: patch.name === undefined ? previous.name : text(patch.name, 80) || "Studio image",
          updatedAt: new Date().toISOString(),
        };
        store.put(next);
      };
      transaction.oncomplete = () => resolve(next);
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    if (result) changed();
    return result;
  } catch { return null; }
  finally { database.close(); }
}

export async function deleteCoverImageAsset(id: string) {
  const database = await openDatabase();
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readwrite");
      transaction.objectStore(COVER_IMAGE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
    changed();
    return true;
  } catch { return false; }
  finally { database.close(); }
}

/** Decodes a portable source once so both studios record real pixel dimensions. */
export function readBookImageSource(src: string): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("This image could not be decoded. Choose another file."));
    image.src = src;
  });
}

export async function readBookImageFile(file: File): Promise<CoverImageInput> {
  const mime = file.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" }[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "");
  if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(mime)) throw new Error("Choose a PNG, JPEG, GIF, WebP, or SVG image.");
  if (file.size > 16 * 1024 * 1024) throw new Error("Choose an image smaller than 16 MB.");
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.onabort = () => reject(new Error("Image reading was cancelled."));
    reader.readAsDataURL(file.type ? file : new Blob([file], { type: mime }));
  });
  const name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Studio image";
  return { ...await readBookImageSource(src), name, alt: name };
}


/** Embed app-relative or remote sources before adding older artwork to the shared shelf. */
export async function readPortableBookImageSource(src: string) {
  if (src.startsWith("data:image/")) return readBookImageSource(src);
  const response = await fetch(src);
  if (!response.ok) throw new Error("The image source could not be read.");
  const blob = await response.blob();
  const image = await readBookImageFile(new File([blob], "Studio image", { type: blob.type.split(";")[0] }));
  return { src: image.src, width: image.width, height: image.height };
}
