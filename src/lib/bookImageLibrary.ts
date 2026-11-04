export const COVER_IMAGE_DB_NAME = "book-studio-image-library";
export const COVER_IMAGE_DB_VERSION = 1;
export const COVER_IMAGE_STORE = "cover-images";
export const MAX_COVER_IMAGE_ASSETS = 24;

export interface CoverImageAsset {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  createdAt: string;
  bytes: number;
}

export interface CoverImageInput {
  name: string;
  src: string;
  width: number;
  height: number;
}

function newAssetId() {
  return `cover-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function estimateImageBytes(src: string) {
  return Math.max(0, Math.round(src.length * 0.75));
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(COVER_IMAGE_DB_NAME, COVER_IMAGE_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(COVER_IMAGE_STORE)) {
          database.createObjectStore(COVER_IMAGE_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readAll(database: IDBDatabase): Promise<CoverImageAsset[]> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readonly");
      const request = transaction.objectStore(COVER_IMAGE_STORE).getAll();
      request.onsuccess = () => {
        const assets = (request.result as CoverImageAsset[]).filter((asset) => asset && typeof asset.src === "string" && asset.src);
        resolve(assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      };
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function listCoverImageAssets(): Promise<CoverImageAsset[]> {
  const database = await openDatabase();
  if (!database) return [];
  try {
    return await readAll(database);
  } finally {
    database.close();
  }
}

export async function saveCoverImageAsset(input: CoverImageInput, now = new Date()): Promise<CoverImageAsset | null> {
  if (!input.src) return null;
  const database = await openDatabase();
  if (!database) return null;
  const asset: CoverImageAsset = {
    id: newAssetId(),
    name: input.name.slice(0, 80) || "Cover image",
    src: input.src,
    width: Math.max(0, Math.round(input.width)),
    height: Math.max(0, Math.round(input.height)),
    createdAt: now.toISOString(),
    bytes: estimateImageBytes(input.src),
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readwrite");
      transaction.objectStore(COVER_IMAGE_STORE).put(asset);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Image could not be saved."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image save was cancelled."));
    });
    const all = await readAll(database);
    const extras = all.slice(MAX_COVER_IMAGE_ASSETS);
    if (extras.length > 0) {
      await new Promise<void>((resolve) => {
        const transaction = database.transaction(COVER_IMAGE_STORE, "readwrite");
        const store = transaction.objectStore(COVER_IMAGE_STORE);
        extras.forEach((extra) => store.delete(extra.id));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    }
    return asset;
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export async function deleteCoverImageAsset(id: string) {
  const database = await openDatabase();
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(COVER_IMAGE_STORE, "readwrite");
      transaction.objectStore(COVER_IMAGE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Image could not be removed."));
    });
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}
