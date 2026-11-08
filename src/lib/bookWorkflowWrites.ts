// Kept independent of the studio UI so close protection can stay mounted in Notes.
const pending = new Map<number, Promise<unknown>>();

export function hasPendingChapterWorkflowWrites() { return pending.size > 0; }

export function queueChapterWorkflowWrite<T>(id: number, write: () => Promise<T>): Promise<T> {
  const previous = pending.get(id) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(write);
  const tracked = operation.finally(() => { if (pending.get(id) === tracked) pending.delete(id); });
  pending.set(id, tracked);
  return tracked;
}

/** Include writes queued while waiting. Surface failures so callers can keep the window open. */
export async function flushChapterWorkflowWrites(): Promise<void> {
  while (pending.size) {
    const results = await Promise.allSettled([...pending.values()]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
}
