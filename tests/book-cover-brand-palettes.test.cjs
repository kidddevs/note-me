const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_BRAND_PALETTE_COLORS,
  SAVED_BRAND_PALETTES_KEY,
  createBrandPalette,
  deleteBrandPalette,
  parseBrandPalettes,
  readBrandPalettes,
  renameBrandPalette,
  saveBrandPalette,
  serializeBrandPalettes,
} = require("./.compiled/src/lib/bookCoverBrandPalettes");

test("brand palettes normalize, dedupe, clamp, and require colours", () => {
  assert.equal(createBrandPalette("Empty", []), null);
  const palette = createBrandPalette("  House colours  ", ["#AABBCC", "#aabbcc", "not-a-colour", "#112233"], new Date("2026-01-02T03:04:05Z"));
  assert.equal(palette.name, "House colours");
  assert.deepEqual(palette.colors, ["#aabbcc", "#112233"]);
  assert.equal(palette.createdAt, "2026-01-02T03:04:05.000Z");
  const many = Array.from({ length: MAX_BRAND_PALETTE_COLORS + 5 }, (_, index) => `#${(index + 16).toString(16).padStart(6, "0")}`);
  assert.equal(createBrandPalette("Many", many).colors.length, MAX_BRAND_PALETTE_COLORS);
});

test("brand palette parsing repairs duplicates and drops invalid entries", () => {
  const first = createBrandPalette("First", ["#112233", "#445566"], new Date("2026-02-03T04:05:06Z"));
  const wire = JSON.parse(serializeBrandPalettes([
    first,
    { ...first, name: "Second" },
    { ...first, name: "" },
    { ...first, name: "No colours", colors: [] },
    null,
  ]));
  const parsed = parseBrandPalettes(wire, new Date("2026-05-06T07:08:09Z"));
  assert.equal(parsed.length, 2);
  assert.notEqual(parsed[0].id, parsed[1].id);
  assert.equal(parsed[0].colors.length, 2);
});

test("brand palette storage supports save, rename, and delete", () => {
  const previousWindow = global.window;
  const map = new Map();
  global.window = { localStorage: {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  } };
  try {
    assert.deepEqual(readBrandPalettes(), []);
    const saved = saveBrandPalette("House", ["#112233", "#aabbcc"], []);
    assert.equal(saved.ok, true);
    assert.equal(saved.palettes.length, 1);
    assert.ok(map.has(SAVED_BRAND_PALETTES_KEY));
    const renamed = renameBrandPalette(saved.palettes[0].id, "Studio", readBrandPalettes());
    assert.equal(renamed.ok, true);
    assert.equal(readBrandPalettes()[0].name, "Studio");
    const deleted = deleteBrandPalette(saved.palettes[0].id, readBrandPalettes());
    assert.equal(deleted.ok, true);
    assert.equal(readBrandPalettes().length, 0);
  } finally {
    global.window = previousWindow;
  }
});


test("brand palettes preserve picker alpha colours when saved and reloaded", () => {
  const palette = createBrandPalette("Transparent ink", ["#ABCDEF80", "#abcdef80", "#1234567"]);
  assert.deepEqual(palette.colors, ["#abcdef80"]);
  assert.deepEqual(parseBrandPalettes(serializeBrandPalettes([palette]))[0].colors, ["#abcdef80"]);
});
