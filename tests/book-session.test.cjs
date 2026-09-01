const test = require("node:test");
const assert = require("node:assert/strict");
const {
  activeChapterSetting,
  rememberedChapterId,
  storedEntityId,
} = require("./.compiled/src/lib/bookSession.js");

test("book sessions use a stable per-manuscript setting key", () => {
  assert.equal(activeChapterSetting(42), "books.activeChapterId.42");
  assert.equal(storedEntityId("42"), 42);
  assert.equal(storedEntityId("0"), null);
  assert.equal(storedEntityId("not-an-id"), null);
});

test("each manuscript restores its own valid section with a legacy fallback", () => {
  const chapters = [{ id: 7 }, { id: 11 }, { id: 19 }];
  assert.equal(rememberedChapterId(chapters, "11", "19"), 11);
  assert.equal(rememberedChapterId(chapters, null, "19"), 19);
  assert.equal(rememberedChapterId(chapters, "99", "19"), 7);
  assert.equal(rememberedChapterId([], "11", "19"), null);
});
