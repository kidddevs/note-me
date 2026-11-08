import { flushChapterWorkflowWrites, hasPendingChapterWorkflowWrites } from "./bookWorkflowWrites";

interface StudioCloseTask {
  hasChanges: () => boolean;
  save: () => Promise<void>;
}
const tasks = new Set<StudioCloseTask>();

/** Surfaces register draft savers; only the app owns the native close listener. */
export function registerBookStudioCloseTask(task: StudioCloseTask): () => void {
  tasks.add(task);
  return () => { tasks.delete(task); };
}

export function hasBookStudioCloseWork() {
  return hasPendingChapterWorkflowWrites() || [...tasks].some((task) => task.hasChanges());
}

export async function flushBookStudioCloseWork(): Promise<void> {
  while (hasBookStudioCloseWork()) {
    // Start watching plans before another surface saves: a fast failure must not
    // disappear from the pending queue while a slower manuscript write finishes.
    const results = await Promise.allSettled([
      flushChapterWorkflowWrites(),
      (async () => {
        for (const task of [...tasks]) {
          if (tasks.has(task) && task.hasChanges()) await task.save();
        }
      })(),
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
}

/** Tauri automatically destroys the window if this single listener does not prevent close. */
export function createBookStudioCloseHandler(close: () => Promise<void>, onError: (error: unknown) => void) {
  let waiting = false;
  return async (event: { preventDefault: () => void }) => {
    if (!waiting && !hasBookStudioCloseWork()) return;
    event.preventDefault();
    if (waiting) return;
    waiting = true;
    try {
      await flushBookStudioCloseWork();
      await close();
    } catch (error) { onError(error); }
    finally { waiting = false; }
  };
}
