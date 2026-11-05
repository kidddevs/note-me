const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_PERSISTED_COVER_HISTORY,
  clearStoredCoverHistory,
  loadCoverHistory,
  saveCoverHistory,
} = require("./.compiled/src/lib/bookCoverHistory");

test("persistent cover history degrades gracefully without IndexedDB", async () => {
  assert.equal(await loadCoverHistory(1), null);
  assert.equal(await saveCoverHistory(1, [], []), false);
  assert.equal(await clearStoredCoverHistory(1), false);
  assert.equal(MAX_PERSISTED_COVER_HISTORY, 24);
});
