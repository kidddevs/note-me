const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { api } = require("./.compiled/src/lib/api.js");
const { useNotes } = require("./.compiled/src/store/notes.js");
const { noteSaves } = require("./.compiled/src/lib/noteSaves.js");
const originals = { ...api }, initial = useNotes.getState();
afterEach(() => { Object.assign(api, originals); useNotes.setState(initial, true); });
const note = { id: -901, title: "Mock note", content: "Older mock content", category_id: null, tags: [] };
function sources() {
  api.listArchived = api.listTrashed = api.listCategories = api.listTags = api.listClipboard = api.listTasks = async () => [];
  api.stats = async () => ({ total_notes: 1, favorites: 0, trashed: 0 });
  api.updateNote = async () => {};
}
test("refresh retains an unsaved synthetic draft instead of reopening stale content", async () => {
  sources(); api.listNotes = async () => [note];
  noteSaves.stage(-901, { title: "Mock newest title", content: "Keep\n\n\nmanual rows", categoryId: null });
  try {
    await useNotes.getState().refresh();
    assert.equal(useNotes.getState().notes[0].content, "Keep\n\n\nmanual rows");
    assert.equal(useNotes.getState().notes[0].title, "Mock newest title");
  } finally { await noteSaves.flushAll(); }
});
test("a late refresh cannot replace a more recent saved-note response", async () => {
  sources(); let resolve; const older = new Promise((yes) => { resolve = yes; });
  api.listNotes = () => older;
  const first = useNotes.getState().refresh();
  api.listNotes = async () => [{ ...note, content: "Latest mock text\n\nSpacing" }];
  await useNotes.getState().refresh();
  resolve([note]); await first;
  assert.equal(useNotes.getState().notes[0].content, "Latest mock text\n\nSpacing");
});
