import type { BookCoverDesign } from "./bookLayout";

export const COVER_HISTORY_DB_NAME = "book-studio-cover-history";
export const COVER_HISTORY_DB_VERSION = 1;
export const COVER_HISTORY_STORE = "cover-history";
export const MAX_PERSISTED_COVER_HISTORY = 24;

export interface StoredCoverHistoryEntry {
  cover: BookCoverDesign;
  label: string;
  at: number;
}

export interface StoredCoverHistory {
  bookId: number;
  history: StoredCoverHistoryEntry[];
  future: StoredCoverHistoryEntry[];
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(COVER_HISTORY_DB_NAME, COVER_HISTORY_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(COVER_HISTORY_STORE)) {
          database.createObjectStore(COVER_HISTORY_STORE, { keyPath: "bookId" });
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

function validEntry(value: unknown): value is StoredCoverHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredCoverHistoryEntry>;
  return Boolean(entry.cover && entry.cover.doc && typeof entry.label === "string" && typeof entry.at === "number");
}

function normalizeHistory(value: unknown): StoredCoverHistoryEntry[] {
  return Array.isArray(value) ? value.filter(validEntry).slice(-MAX_PERSISTED_COVER_HISTORY) : [];
}

export async function loadCoverHistory(bookId: number): Promise<Pick<StoredCoverHistory, "history" | "future"> | null> {
  const database = await openDatabase();
  if (!database) return null;
  try {
    return await new Promise((resolve) => {
      const transaction = database.transaction(COVER_HISTORY_STORE, "readonly");
      const request = transaction.objectStore(COVER_HISTORY_STORE).get(bookId);
      request.onsuccess = () => {
        const record = request.result as Partial<StoredCoverHistory> | undefined;
        resolve(record ? { history: normalizeHistory(record.history), future: normalizeHistory(record.future) } : null);
      };
      request.onerror = () => resolve(null);
    });
  } finally {
    database.close();
  }
}

export async function saveCoverHistory(bookId: number, history: StoredCoverHistoryEntry[], future: StoredCoverHistoryEntry[]) {
  const database = await openDatabase();
  if (!database) return false;
  const record: StoredCoverHistory = {
    bookId,
    history: history.slice(-MAX_PERSISTED_COVER_HISTORY),
    future: future.slice(0, MAX_PERSISTED_COVER_HISTORY),
    updatedAt: new Date().toISOString(),
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(COVER_HISTORY_STORE, "readwrite");
      transaction.objectStore(COVER_HISTORY_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Cover history could not be saved."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Cover history save was cancelled."));
    });
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}

export async function clearStoredCoverHistory(bookId: number) {
  const database = await openDatabase();
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(COVER_HISTORY_STORE, "readwrite");
      transaction.objectStore(COVER_HISTORY_STORE).delete(bookId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Cover history could not be removed."));
    });
    return true;
  } catch {
    return false;
  } finally {
    database.close();
  }
}
