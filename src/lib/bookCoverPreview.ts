import type { Book } from "./types";

// This store belongs only to the development preview; it never opens native data.
const DATABASE = "noteme-cover-preview";
const STORE = "books";
const BOOK_ID = -701;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("The cover preview database is blocked."));
  });
}

export async function loadCoverPreviewBook(): Promise<Book | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).get(BOOK_ID);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

async function writePreview(book: Book | null) {
  if (book && book.id !== BOOK_ID) throw new Error("Only the cover preview fixture can be saved here.");
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      if (book) store.put(book);
      else store.delete(BOOK_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Preview save was cancelled."));
    });
  } finally { database.close(); }
}

export const saveCoverPreviewBook = (book: Book) => writePreview(book);
export const clearCoverPreviewBook = () => writePreview(null);
