import { openCoverPreviewDatabase } from "./bookCoverPreview";
import type { Chapter, ChapterSnapshot, ChapterSnapshotInput } from "./types";

interface SnapshotRecord { id: string; snapshot: ChapterSnapshot }

function snapshotRecords(values: unknown[]): SnapshotRecord[] {
  return values.filter((value): value is SnapshotRecord => Boolean(value && typeof value === "object" && "snapshot" in value));
}

function snapshotsFor(values: unknown[], chapterId: number) {
  return snapshotRecords(values).map((record) => record.snapshot)
    .filter((snapshot) => snapshot.chapter_id === chapterId)
    .sort((a, b) => b.id - a.id);
}

function assertFixtureSection(chapterId: number) {
  if (!Number.isInteger(chapterId) || chapterId > -702 || chapterId < -799) throw new Error("Only development fixture sections can have preview checkpoints.");
}

async function withSnapshots<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, values: unknown[]) => T): Promise<T> {
  const database = await openCoverPreviewDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("books", mode);
      const store = transaction.objectStore("books");
      const request = store.getAll();
      let result: T;
      let failure: unknown;
      request.onsuccess = () => {
        try { result = action(store, request.result); }
        catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Fixture checkpoint operation failed."));
    });
  } finally { database.close(); }
}

function section(values: unknown[], chapterId: number): Chapter {
  assertFixtureSection(chapterId);
  const chapter = values.find((value) => value && typeof value === "object" && "id" in value && value.id === chapterId) as Chapter | undefined;
  if (!chapter || chapter.book_id !== -701) throw new Error("Fixture section not found.");
  return chapter;
}

function saveSnapshot(store: IDBObjectStore, values: unknown[], chapterId: number, input: ChapterSnapshotInput): ChapterSnapshot {
  section(values, chapterId);
  const id = snapshotRecords(values).reduce((latest, record) => Math.max(latest, record.snapshot.id + 1), Date.now());
  const snapshot: ChapterSnapshot = { id, chapter_id: chapterId, book_id: -701, title: input.title, content: input.content, reason: input.reason, word_count: input.wordCount, created_at: new Date().toISOString() };
  store.put({ id: `snapshot-${id}`, snapshot });
  for (const old of snapshotsFor(values, chapterId).slice(49)) store.delete(`snapshot-${old.id}`);
  return snapshot;
}

export function listPreviewSnapshots(chapterId: number) {
  assertFixtureSection(chapterId);
  return withSnapshots("readonly", (_store, values) => snapshotsFor(values, chapterId));
}

export function createPreviewSnapshot(chapterId: number, input: ChapterSnapshotInput) {
  assertFixtureSection(chapterId);
  return withSnapshots("readwrite", (store, values) => saveSnapshot(store, values, chapterId, input));
}

export function deletePreviewSnapshot(id: number) {
  return withSnapshots("readwrite", (store, values) => {
    if (!snapshotRecords(values).some((record) => record.snapshot.id === id)) throw new Error("Fixture checkpoint not found.");
    store.delete(`snapshot-${id}`);
  });
}

export function restorePreviewSnapshot(chapterId: number, snapshotId: number, draft: Pick<ChapterSnapshotInput, "title" | "content" | "wordCount">) {
  assertFixtureSection(chapterId);
  return withSnapshots("readwrite", (store, values) => {
    const chapter = section(values, chapterId);
    const snapshot = snapshotsFor(values, chapterId).find((item) => item.id === snapshotId);
    if (!snapshot) throw new Error("Fixture checkpoint not found for this section.");
    saveSnapshot(store, values, chapterId, { ...draft, reason: "safety" });
    const restored = { ...chapter, title: snapshot.title, content: snapshot.content, updated_at: new Date().toISOString() };
    store.put(restored);
    return restored;
  });
}
