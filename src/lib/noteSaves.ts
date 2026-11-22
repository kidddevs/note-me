import { api } from "./api";
import { notify } from "../store/toast";

export interface NoteDraft { title: string; content: string; categoryId: number | null }

/** Pending drafts outlive editor tabs; writes for one note always finish in order. */
export function createNoteSaveQueue(write: (id: number, draft: NoteDraft) => Promise<void>, onError: (error: unknown) => void = () => {}, delay = 600) {
  type Entry = { draft: NoteDraft; revision: number; timer?: ReturnType<typeof setTimeout>; running?: Promise<void>; error?: unknown };
  const entries = new Map<number, Entry>();
  const listeners = new Set<() => void>();
  const publish = () => { for (const listener of listeners) listener(); };
  const queue = {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get(id: number) { const entry = entries.get(id); return entry ? { ...entry.draft } : undefined; },
    status(id: number) { const entry = entries.get(id); return { dirty: Boolean(entry), saving: Boolean(entry?.running), error: entry?.error }; },
    hasPending() { return entries.size > 0; },
    stage(id: number, draft: NoteDraft) {
      const entry = entries.get(id) ?? { draft, revision: 0 };
      if (entry.timer) clearTimeout(entry.timer);
      entry.draft = { ...draft }; entry.revision += 1; entry.error = undefined;
      entries.set(id, entry);
      entry.timer = setTimeout(() => { void queue.flush(id).catch(() => {}); }, delay);
      publish();
    },
    flush(id: number): Promise<void> {
      const entry = entries.get(id);
      if (!entry) return Promise.resolve();
      if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
      if (entry.running) return entry.running;
      entry.error = undefined;
      const operation = Promise.resolve().then(async () => {
        try {
          while (entries.get(id) === entry) {
            const revision = entry.revision;
            await write(id, { ...entry.draft });
            if (revision === entry.revision) entries.delete(id);
          }
        } catch (error) {
          entry.error = error;
          onError(error);
          throw error;
        } finally {
          entry.running = undefined;
          if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
          publish();
        }
      });
      entry.running = operation;
      publish();
      return operation;
    },
    async flushAll() {
      while (entries.size) {
        const results = await Promise.allSettled([...entries.keys()].map((id) => queue.flush(id)));
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
      }
    },
  };
  return queue;
}

export const noteSaves = createNoteSaveQueue(
  (id, draft) => api.updateNote(id, draft.title, draft.content, draft.categoryId),
  (error) => notify("error", "Note could not be saved", `Your draft is kept for retry. ${String(error)}`),
);
