const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createNoteSaveQueue, noteSaves } = require("./.compiled/src/lib/noteSaves.js");
const { api } = require("./.compiled/src/lib/api.js");
const { createBookStudioCloseHandler, hasBookStudioCloseWork } = require("./.compiled/src/lib/bookStudioClose.js");
const originalWrite = api.updateNote;
afterEach(() => { api.updateNote = originalWrite; });
const turn = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const draft = (content = "Mock first\n\nMock last") => ({ title: "Synthetic note", content, categoryId: null });

test("note saves copy drafts and serialize edits made during a pending write", async () => {
  const first = deferred(), calls = [];
  const queue = createNoteSaveQueue(async (id, value) => { calls.push([id, value.content]); if (calls.length === 1) await first.promise; }, undefined, 60000);
  const input = draft(); queue.stage(-901, input); input.content = "Mutated external object";
  const saving = queue.flush(-901); await turn();
  queue.stage(-901, draft("Newest\n\n\nMock draft"));
  assert.deepEqual(calls, [[-901, "Mock first\n\nMock last"]]);
  assert.equal(queue.get(-901).content, "Newest\n\n\nMock draft");
  first.resolve(); await saving;
  assert.deepEqual(calls, [[-901, "Mock first\n\nMock last"], [-901, "Newest\n\n\nMock draft"]]);
  assert.equal(queue.hasPending(), false);
});
test("independent notes save concurrently and flush waits for both", async () => {
  const a = deferred(), b = deferred(), calls = [];
  const queue = createNoteSaveQueue((id) => { calls.push(id); return id === -901 ? a.promise : b.promise; }, undefined, 60000);
  queue.stage(-901, draft()); queue.stage(-902, draft("Other mock"));
  let finished = false; const closing = queue.flushAll().then(() => { finished = true; });
  await turn(); assert.deepEqual(calls, [-901, -902]);
  a.resolve(); await turn(); assert.equal(finished, false);
  b.resolve(); await closing; assert.equal(queue.hasPending(), false);
});
test("a synchronous write failure retains the exact draft and permits retry", async () => {
  let calls = 0; const errors = [];
  const queue = createNoteSaveQueue(() => { if (++calls === 1) throw new Error("Synthetic disk failure"); return Promise.resolve(); }, (error) => errors.push(error), 60000);
  queue.stage(-901, draft());
  await assert.rejects(queue.flush(-901), /Synthetic disk failure/);
  assert.deepEqual(queue.get(-901), draft()); assert.equal(queue.status(-901).saving, false);
  await queue.flushAll(); assert.equal(calls, 2); assert.equal(errors.length, 1);
  assert.equal(queue.hasPending(), false);
});
test("the shared app close owner waits for notes with no editor mounted", async () => {
  const write = deferred(); api.updateNote = () => write.promise;
  noteSaves.stage(-901, draft()); assert.equal(hasBookStudioCloseWork(), true);
  let prevented = 0, destroyed = 0;
  const handler = createBookStudioCloseHandler(async () => { destroyed++; }, (error) => { throw error; });
  const closing = handler({ preventDefault: () => { prevented++; } });
  await turn(); assert.equal(destroyed, 0); assert.equal(prevented, 1);
  write.resolve(); await closing;
  assert.equal(destroyed, 1); assert.equal(noteSaves.hasPending(), false);
});
test("a failed note save pauses close and a second close retries the retained draft", async () => {
  let attempts = 0; api.updateNote = async () => { if (++attempts === 1) throw new Error("Mock close failure"); };
  noteSaves.stage(-901, draft("Keep\n\nthis mock text\n"));
  let destroyed = 0; const errors = [];
  const handler = createBookStudioCloseHandler(async () => { destroyed++; }, (error) => errors.push(error));
  await handler({ preventDefault() {} });
  assert.equal(destroyed, 0); assert.equal(errors.length, 1);
  assert.equal(noteSaves.get(-901).content, "Keep\n\nthis mock text\n");
  await handler({ preventDefault() {} }); assert.equal(destroyed, 1);
});
