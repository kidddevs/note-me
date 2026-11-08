const { test } = require("node:test");
const assert = require("node:assert/strict");
const { registerBookStudioCloseTask, createBookStudioCloseHandler, hasBookStudioCloseWork } = require("./.compiled/src/lib/bookStudioClose.js");
const { queueChapterWorkflowWrite } = require("./.compiled/src/lib/bookWorkflowWrites.js");
const turn = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

// Tauri's onCloseRequested wrapper destroys the window if its listener does not
// prevent close. Exercise that behavior instead of assuming shared cancellation.
function windowFixture() {
  const state = { destroyed: 0, errors: [] };
  const handler = createBookStudioCloseHandler(async () => { state.destroyed++; }, (error) => state.errors.push(error));
  return { state, request: async () => {
    let prevented = false;
    await handler({ preventDefault: () => { prevented = true; } });
    if (!prevented) state.destroyed++;
    return prevented;
  } };
}

test("one close owner waits for manuscript and plans despite repeated close requests", async () => {
  const writing = deferred(), planning = deferred();
  let dirty = true, saves = 0;
  const dispose = registerBookStudioCloseTask({ hasChanges: () => dirty, save: async () => { saves++; await writing.promise; dirty = false; } });
  const plan = queueChapterWorkflowWrite(1, () => planning.promise);
  const window = windowFixture();
  try {
    const closing = window.request(); await turn();
    assert.equal(await window.request(), true);
    planning.resolve(); await plan; await turn();
    assert.equal(window.state.destroyed, 0); assert.equal(saves, 1);
    writing.resolve(); assert.equal(await closing, true);
    assert.equal(window.state.destroyed, 1); assert.deepEqual(window.state.errors, []);
  } finally { dispose(); }
});

test("a fast plan failure keeps close paused while a slower draft finishes", async () => {
  const writing = deferred(), planning = deferred(); let dirty = true;
  const dispose = registerBookStudioCloseTask({ hasChanges: () => dirty, save: async () => { await writing.promise; dirty = false; } });
  const failedPlan = queueChapterWorkflowWrite(2, () => planning.promise).catch((error) => error);
  const window = windowFixture();
  try {
    const closing = window.request(); planning.reject(new Error("Plan disk failure")); await failedPlan; await turn();
    assert.equal(window.state.destroyed, 0);
    writing.resolve(); await closing;
    assert.equal(window.state.destroyed, 0); assert.equal(window.state.errors[0].message, "Plan disk failure");
  } finally { dispose(); }
});

test("close rechecks drafts changed during saving and supports retry after failure", async () => {
  let dirty = true, saves = 0;
  const dispose = registerBookStudioCloseTask({ hasChanges: () => dirty, save: async () => {
    saves++;
    if (saves === 1) throw new Error("Writing unavailable");
    if (saves === 3) dirty = false;
  } });
  const window = windowFixture();
  try {
    await window.request(); assert.equal(window.state.destroyed, 0); assert.equal(saves, 1);
    await window.request(); assert.equal(window.state.destroyed, 1); assert.equal(saves, 3);
    assert.equal(window.state.errors.length, 1);
  } finally { dispose(); }
});

test("unmounted draft savers are removed and a clean window uses native close", async () => {
  const dispose = registerBookStudioCloseTask({ hasChanges: () => true, save: async () => { throw new Error("Stale surface ran"); } });
  assert.equal(hasBookStudioCloseWork(), true); dispose();
  assert.equal(hasBookStudioCloseWork(), false);
  const window = windowFixture();
  assert.equal(await window.request(), false);
  assert.equal(window.state.destroyed, 1); assert.deepEqual(window.state.errors, []);
});

test("submitted plans remain protected with no Studio surface mounted", async () => {
  const planning = deferred();
  const plan = queueChapterWorkflowWrite(3, () => planning.promise);
  const window = windowFixture();
  const closing = window.request(); await turn();
  assert.equal(hasBookStudioCloseWork(), true); assert.equal(window.state.destroyed, 0);
  planning.resolve(); await plan; await closing;
  assert.equal(window.state.destroyed, 1); assert.equal(hasBookStudioCloseWork(), false);
});
