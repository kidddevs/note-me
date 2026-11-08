const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { api } = require("./.compiled/src/lib/api.js");
const { useBooks } = require("./.compiled/src/store/books.js");
const { parseChapterWorkflow, serializeChapterWorkflow } = require("./.compiled/src/lib/bookWorkflow.js");
const initialState = useBooks.getState();
const originals = { updateChapterWorkflow: api.updateChapterWorkflow, updateChapter: api.updateChapter, updateChapterLayout: api.updateChapterLayout, reorderChapters: api.reorderChapters, deleteChapter: api.deleteChapter };
const chapter = { id: 2, book_id: 1, title: "North", content: "Original writing", chapter_kind: "photo_essay", position: 0, toc_include: false, toc_heading_exclusions: ["quiet"], layout_json: "{}", workflow_json: "{}", created_at: "", updated_at: "" };
const workflow = (status = "ready", wordGoal = 100) => ({ status, wordGoal, dueDate: "" });
const response = (plan) => ({ ...chapter, workflow_json: serializeChapterWorkflow(plan), updated_at: "2026-11-08T12:00:00.000Z" });
const seed = () => useBooks.setState({ books: [{ id: 1, title: "Book", updated_at: "" }], chapters: [{ ...chapter }], selectedBookId: 1 });
const turn = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
afterEach(() => { Object.assign(api, originals); useBooks.setState(initialState, true); });

test("planning saves serialize per section and merge only confirmed metadata", async () => {
  seed(); const first = deferred(), second = deferred(); const calls = [];
  api.updateChapterWorkflow = (id, plan) => { calls.push([id, plan.status]); return calls.length === 1 ? first.promise : second.promise; };
  const a = useBooks.getState().updateChapterWorkflow(2, workflow());
  const b = useBooks.getState().updateChapterWorkflow(2, workflow("revising", 200));
  await turn(); assert.deepEqual(calls, [[2, "ready"]]);
  assert.equal(parseChapterWorkflow(useBooks.getState().chapters[0].workflow_json).status, "draft");
  useBooks.setState((state) => ({ chapters: state.chapters.map((item) => ({ ...item, content: "Typing continues", layout_json: '{"paper":"cream"}' })) }));
  first.resolve(response(workflow())); await a; await turn();
  assert.deepEqual(calls, [[2, "ready"], [2, "revising"]]);
  second.resolve(response(workflow("revising", 200))); await b;
  const current = useBooks.getState().chapters[0];
  assert.equal(current.content, "Typing continues"); assert.equal(current.layout_json, '{"paper":"cream"}');
  assert.deepEqual(parseChapterWorkflow(current.workflow_json), workflow("revising", 200));
});

test("a failed planning write leaves the saved plan intact and does not block a later save", async () => {
  seed(); const first = deferred(); let calls = 0;
  api.updateChapterWorkflow = (_id, plan) => ++calls === 1 ? first.promise : Promise.resolve(response(plan));
  const a = useBooks.getState().updateChapterWorkflow(2, workflow()).then(() => null, (error) => error);
  const b = useBooks.getState().updateChapterWorkflow(2, workflow("revising", 500));
  first.reject(new Error("Disk unavailable")); assert.equal((await a).message, "Disk unavailable"); await b;
  assert.equal(parseChapterWorkflow(useBooks.getState().chapters[0].workflow_json).wordGoal, 500);
  await useBooks.getState().updateChapterWorkflow(2, workflow("ready", 800));
  assert.equal(parseChapterWorkflow(useBooks.getState().chapters[0].workflow_json).wordGoal, 800);
});

test("writing rollback preserves a plan saved while the writing request was pending", async () => {
  seed(); const pending = deferred(); let args;
  api.updateChapter = (...input) => { args = input; return pending.promise; };
  api.updateChapterWorkflow = (_id, plan) => Promise.resolve(response(plan));
  const writing = useBooks.getState().updateChapter(2, "Changed title", "Changed writing").then(() => null, (error) => error);
  assert.deepEqual(args.slice(3), ["photo_essay", false, ["quiet"]]);
  await useBooks.getState().updateChapterWorkflow(2, workflow("ready", 400));
  pending.reject(new Error("Writing failed")); await writing;
  const current = useBooks.getState().chapters[0];
  assert.equal(current.title, "North"); assert.equal(current.content, "Original writing");
  assert.deepEqual(parseChapterWorkflow(current.workflow_json), workflow("ready", 400));
});

test("page-layout rollback preserves independently confirmed planning", async () => {
  seed(); const pending = deferred();
  api.updateChapterLayout = () => pending.promise;
  api.updateChapterWorkflow = (_id, plan) => Promise.resolve(response(plan));
  const layout = useBooks.getState().updateChapterLayout(2, '{"paper":"sand"}').then(() => null, (error) => error);
  await useBooks.getState().updateChapterWorkflow(2, workflow("revising", 600));
  pending.reject(new Error("Layout failed")); await layout;
  assert.equal(useBooks.getState().chapters[0].layout_json, "{}");
  assert.deepEqual(parseChapterWorkflow(useBooks.getState().chapters[0].workflow_json), workflow("revising", 600));
});

test("a planning response cannot replace the newly selected book's chapter", async () => {
  seed(); const pending = deferred(); api.updateChapterWorkflow = () => pending.promise;
  const save = useBooks.getState().updateChapterWorkflow(2, workflow()); await turn();
  useBooks.setState({ selectedBookId: 3, chapters: [{ ...chapter, id: 4, book_id: 3, content: "Other manuscript" }] });
  pending.resolve(response(workflow())); await save;
  assert.equal(useBooks.getState().chapters[0].id, 4); assert.equal(useBooks.getState().chapters[0].content, "Other manuscript");
});

test("invalid planning input is rejected before invoking the native API", async () => {
  seed(); let invoked = false; api.updateChapterWorkflow = async () => { invoked = true; return chapter; };
  await assert.rejects(useBooks.getState().updateChapterWorkflow(2, workflow("ready", -5)), /word budget/i);
  assert.equal(invoked, false);
});

test("reordering rollback restores positions while keeping confirmed section planning", async () => {
  seed(); useBooks.setState((state) => ({ chapters: [...state.chapters, { ...chapter, id: 3, position: 1 }] }));
  const pending = deferred(); api.reorderChapters = () => pending.promise;
  api.updateChapterWorkflow = (_id, plan) => Promise.resolve(response(plan));
  const reorder = useBooks.getState().reorderChapters([3, 2]).then(() => null, (error) => error);
  await useBooks.getState().updateChapterWorkflow(2, workflow("ready", 700));
  pending.reject(new Error("Order failed")); await reorder;
  assert.deepEqual(useBooks.getState().chapters.map((item) => item.id), [2, 3]);
  assert.equal(parseChapterWorkflow(useBooks.getState().chapters[0].workflow_json).wordGoal, 700);
});

test("failed deletion preserves planning saved on a remaining section", async () => {
  seed(); useBooks.setState((state) => ({ chapters: [...state.chapters, { ...chapter, id: 3, position: 1 }], activeChapterId: 3 }));
  const pending = deferred(); api.deleteChapter = () => pending.promise;
  api.updateChapterWorkflow = (_id, plan) => Promise.resolve(response(plan));
  const deletion = useBooks.getState().deleteChapter(3).then(() => null, (error) => error);
  await useBooks.getState().updateChapterWorkflow(2, workflow("revising", 900));
  pending.reject(new Error("Delete failed")); await deletion;
  assert.deepEqual(useBooks.getState().chapters.map((item) => item.id), [2, 3]);
  assert.equal(useBooks.getState().activeChapterId, 3);
  assert.equal(parseChapterWorkflow(useBooks.getState().chapters[0].workflow_json).wordGoal, 900);
});
