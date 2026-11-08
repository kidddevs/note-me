import type { Book, Chapter, ChapterInput } from "./types";

// This store belongs only to the development preview; it never opens native data.
const DATABASE = "noteme-cover-preview";
const STORE = "books";
const BOOK_ID = -701;

function previewChapterId(id: number) { return Number.isInteger(id) && id <= -702 && id >= -799; }
function previewChapter(value: unknown): value is Chapter {
  return Boolean(value && typeof value === "object" && "id" in value && "book_id" in value && typeof value.id === "number" && previewChapterId(value.id) && value.book_id === BOOK_ID);
}

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


/** The manuscript companion uses a negative fixture id in the same isolated store. */
export async function loadCoverPreviewChapter(id = -702): Promise<Chapter | null> {
  if (!previewChapterId(id)) throw new Error("Only studio fixture chapters can be read here.");
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

export async function saveCoverPreviewChapter(chapter: Chapter | null) {
  if (chapter && !previewChapter(chapter)) throw new Error("Only studio fixture chapters can be saved here.");
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      if (chapter) store.put(chapter);
      else store.delete(-702);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Preview chapter save was cancelled."));
    });
  } finally { database.close(); }
}

export async function loadCoverPreviewChapters(): Promise<Chapter[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result.filter(previewChapter).sort((a: Chapter, b: Chapter) => a.position - b.position));
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

/** Isolated fixture mutations use the same field ownership as native commands. */
export async function patchCoverPreviewChapter(id: number, patch: Partial<Omit<Chapter, "id" | "book_id">>): Promise<Chapter> {
  if (!previewChapterId(id)) throw new Error("Only studio fixture chapters can be changed here.");
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.get(id);
      let next: Chapter;
      request.onsuccess = () => {
        if (!previewChapter(request.result)) { transaction.abort(); return; }
        next = { ...request.result, ...patch, id, book_id: BOOK_ID, updated_at: new Date().toISOString() };
        store.put(next);
      };
      transaction.oncomplete = () => resolve(next);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Preview section could not be saved."));
    });
  } finally { database.close(); }
}

export async function createCoverPreviewChapter(input: ChapterInput): Promise<Chapter> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.getAll();
      let next: Chapter;
      request.onsuccess = () => {
        const chapters: Chapter[] = request.result.filter(previewChapter);
        const id = Array.from({ length: 98 }, (_, i) => -702 - i).find((id) => !chapters.some((chapter) => chapter.id === id));
        if (id === undefined) { transaction.abort(); return; }
        const now = new Date().toISOString();
        next = { id, book_id: BOOK_ID, title: input.title, content: input.content, chapter_kind: input.chapterKind ?? "chapter",
          position: input.position ?? Math.max(-1, ...chapters.map((chapter) => chapter.position)) + 1,
          toc_include: input.tocInclude ?? true, toc_heading_exclusions: input.tocHeadingExclusions ?? [], layout_json: input.layoutJson ?? "{}", workflow_json: "{}", created_at: now, updated_at: now };
        store.put(next);
      };
      transaction.oncomplete = () => resolve(next);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Preview section could not be created."));
    });
  } finally { database.close(); }
}

export async function reorderCoverPreviewChapters(ids: number[]) {
  if (new Set(ids).size !== ids.length || ids.some((id) => !previewChapterId(id))) throw new Error("Invalid studio fixture order.");
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const chapters: Chapter[] = request.result.filter(previewChapter);
        if (chapters.length !== ids.length || chapters.some((chapter) => !ids.includes(chapter.id))) { transaction.abort(); return; }
        for (const chapter of chapters) store.put({ ...chapter, position: ids.indexOf(chapter.id) });
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Preview order could not be saved."));
    });
  } finally { database.close(); }
}

export async function deleteCoverPreviewChapter(id: number) {
  if (!previewChapterId(id)) throw new Error("Only studio fixture chapters can be deleted here.");
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function clearCoverPreviewChapters() {
  for (const chapter of await loadCoverPreviewChapters()) await deleteCoverPreviewChapter(chapter.id);
}
