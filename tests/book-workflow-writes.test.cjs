const { test } = require("node:test");
const assert = require("node:assert/strict");
const { queueChapterWorkflowWrite, hasPendingChapterWorkflowWrites, flushChapterWorkflowWrites } = require("./.compiled/src/lib/bookWorkflowWrites.js");

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));

test("close flushing waits for all sections and writes queued during the wait", async () => {
  const first = deferred(), second = deferred(), other = deferred();
  const calls = [];
  const a = queueChapterWorkflowWrite(10, () => { calls.push("first"); return first.promise; });
  const b = queueChapterWorkflowWrite(11, () => { calls.push("other"); return other.promise; });
  assert.equal(hasPendingChapterWorkflowWrites(), true);
  let flushed = false;
  const closing = flushChapterWorkflowWrites().then(() => { flushed = true; });
  await turn(); assert.deepEqual(calls, ["first", "other"]);
  const c = queueChapterWorkflowWrite(10, () => { calls.push("second"); return second.promise; });
  first.resolve("a"); other.resolve("b");
  await Promise.all([a, b]); await turn();
  assert.deepEqual(calls, ["first", "other", "second"]);
  assert.equal(flushed, false); assert.equal(hasPendingChapterWorkflowWrites(), true);
  second.resolve("c"); await c; await closing;
  assert.equal(flushed, true); assert.equal(hasPendingChapterWorkflowWrites(), false);
});

test("close flushing surfaces write failures and a later retry can drain", async () => {
  const failing = deferred();
  const save = queueChapterWorkflowWrite(20, () => failing.promise);
  const failedSave = assert.rejects(save, /disk full/);
  const failedClose = assert.rejects(flushChapterWorkflowWrites(), /disk full/);
  failing.reject(new Error("disk full"));
  await Promise.all([failedSave, failedClose]);
  assert.equal(hasPendingChapterWorkflowWrites(), false);
  const retry = deferred();
  const saveAgain = queueChapterWorkflowWrite(20, () => retry.promise);
  const closing = flushChapterWorkflowWrites();
  assert.equal(hasPendingChapterWorkflowWrites(), true);
  retry.resolve("saved"); await saveAgain; await closing;
  assert.equal(hasPendingChapterWorkflowWrites(), false);
});
