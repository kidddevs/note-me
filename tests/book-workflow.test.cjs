const test = require("node:test");
const assert = require("node:assert/strict");
const { parseChapterWorkflow, serializeChapterWorkflow, validWorkflowDate, localDateKey, chapterPlanEntries, filterChapterPlan, chapterPlanSummary } = require("./.compiled/src/lib/bookWorkflow.js");
const chapter = (id, overrides = {}) => ({ id, book_id: 1, title: `Section ${id}`, content: "The coast remembers.", chapter_kind: "chapter", position: id, toc_include: true, toc_heading_exclusions: [], layout_json: "{}", created_at: "", updated_at: "", ...overrides });
const plan = (status = "draft", wordGoal = 0, dueDate = "") => serializeChapterWorkflow({ status, wordGoal, dueDate });

test("older and malformed section plans get defaults without rewriting input", () => {
  for (const raw of [undefined, "", "{", "[]", "null"]) assert.deepEqual(parseChapterWorkflow(raw), { status: "draft", wordGoal: 0, dueDate: "" });
  const raw = '{"status":"unknown","wordGoal":1e9,"dueDate":"2026-02-30"}';
  assert.deepEqual(parseChapterWorkflow(raw), { status: "draft", wordGoal: 1000000, dueDate: "" });
  assert.ok(raw.includes('"unknown"'));
});

test("calendar validation handles leap centuries and local day boundaries", () => {
  for (const value of ["2000-02-29", "2028-02-29", "2026-11-08", "1000-01-01", "9999-12-31"]) assert.equal(validWorkflowDate(value), true, value);
  for (const value of ["1900-02-29", "2100-02-29", "2026-04-31", "2026-11-00", "2026-13-01", "0999-12-31", "2026-1-01", "2026-11-08T12:00:00Z"]) assert.equal(validWorkflowDate(value), false, value);
  assert.equal(localDateKey(new Date(2026, 10, 8, 23, 59)), "2026-11-08");
});

test("explicit saves reject invalid budgets, dates and workflow stages", () => {
  for (const wordGoal of [-1, 1.5, Infinity, NaN, 1000001]) assert.throws(() => serializeChapterWorkflow({ status: "draft", wordGoal, dueDate: "" }));
  assert.throws(() => plan("published"));
  assert.throws(() => plan("draft", 1, "2026-02-29"));
  for (const dueDate of [null, undefined, false, 0]) assert.throws(() => serializeChapterWorkflow({ status: "draft", wordGoal: 0, dueDate }));
  assert.deepEqual(parseChapterWorkflow(plan("ready", 1200, "2028-02-29")), { status: "ready", wordGoal: 1200, dueDate: "2028-02-29" });
});

test("plan entries use document bands, actual words and explicit readiness", () => {
  const entries = chapterPlanEntries([
    chapter(1, { workflow_json: plan("draft", 5, "2026-11-07") }),
    chapter(2, { chapter_kind: "title_page", workflow_json: plan("ready", 1, "2026-11-07") }),
    chapter(3, { chapter_kind: "colophon", workflow_json: plan("revising", 0, "2026-11-08") }),
  ], "2026-11-08");
  assert.deepEqual(entries.map((entry) => entry.chapter.id), [2, 1, 3]);
  assert.equal(entries[1].words, 3); assert.equal(entries[1].progress, 60); assert.equal(entries[1].remaining, 2); assert.equal(entries[1].overdue, true);
  assert.equal(entries[0].overdue, false); assert.equal(entries[0].progress, 100); assert.equal(entries[0].remaining, 0);
  assert.equal(entries[2].dueToday, true); assert.equal(entries[2].progress, null);
  const aboveBudget = chapterPlanEntries([chapter(4, { workflow_json: plan("draft", 1) })])[0];
  assert.equal(aboveBudget.workflow.status, "draft");
});

test("search, stage, band and deadline filters combine without mutating document order", () => {
  const entries = chapterPlanEntries([chapter(1, { title: "North coast", chapter_kind: "photo_essay", workflow_json: plan("revising", 1200, "2026-11-07") }), chapter(2, { title: "South coast", workflow_json: plan("ready", 0, "2026-11-09") }), chapter(3, { chapter_kind: "colophon" })], "2026-11-08");
  const before = entries.map((entry) => entry.chapter.id);
  assert.deepEqual(filterChapterPlan(entries, { query: "NORTH photo", status: "revising", group: "story", overdue: true }).map((entry) => entry.chapter.id), [1]);
  assert.deepEqual(filterChapterPlan(entries, { status: "ready" }).map((entry) => entry.chapter.id), [2]);
  assert.deepEqual(filterChapterPlan(entries, { sort: "due" }).map((entry) => entry.chapter.id), [1, 2, 3]);
  assert.deepEqual(entries.map((entry) => entry.chapter.id), before);
});

test("plan summaries keep section budgets separate from the book goal", () => {
  const entries = chapterPlanEntries([chapter(1, { workflow_json: plan("revising", 1200) }), chapter(2, { workflow_json: plan("ready", 0) })]);
  assert.deepEqual(chapterPlanSummary(entries, { word_goal: 50000 }), { sections: 2, words: 6, ready: 1, overdue: 0, plannedWords: 1200, budgetedSections: 1, bookGoal: 50000 });
});

test("planning excerpts suppress portable layout and image payloads", () => {
  const { canvasTextSource, imageMarkdownFromAsset, setChapterFreeLayout } = require("./.compiled/src/lib/bookPublishing.js");
  const image = imageMarkdownFromAsset({ name: "The shore", src: "data:image/png;base64,SECRETIMAGEPAYLOAD", width: 100, height: 100 });
  const content = setChapterFreeLayout(`${canvasTextSource("## The **north** coast", { width: 50, x: 10, y: 20 })}\n\n${image}`, true);
  const entry = chapterPlanEntries([chapter(1, { content })])[0];
  assert.match(entry.excerpt, /The north coast/); assert.doesNotMatch(entry.excerpt, /note-me:|SECRETIMAGEPAYLOAD|base64|\*\*/);
});

test("plan search includes writing beyond the visible excerpt", () => {
  const entries = chapterPlanEntries([chapter(1, { content: `${"A quiet beginning. ".repeat(50)}A distant lighthouse.` })]);
  assert.doesNotMatch(entries[0].excerpt, /lighthouse/);
  assert.equal(filterChapterPlan(entries, { query: "distant lighthouse" }).length, 1);
});
