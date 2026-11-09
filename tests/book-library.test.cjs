const test = require("node:test");
const assert = require("node:assert/strict");
const {
  filterLibraryBooks,
  libraryBookSearchText,
  libraryStatusCounts,
  libraryStatusLabel,
} = require("./.compiled/src/lib/bookLibrary.js");

function book(overrides = {}) {
  return {
    id: 1,
    title: "The Quiet Hour",
    subtitle: "",
    author: "A. Writer",
    description: "Essays about attention and the morning.",
    genre: "Essays",
    status: "draft",
    trim_size: "6x9",
    font_family: "serif",
    font_size: 12,
    line_height: 1.5,
    paragraph_spacing: 0,
    margin: 1,
    word_goal: 50000,
    cover_color: "#a56b3e",
    dedication: "",
    epigraph: "",
    copyright_text: "",
    acknowledgements: "",
    toc_enabled: true,
    toc_title: "Contents",
    toc_depth: 3,
    toc_include_front_matter: false,
    toc_include_back_matter: false,
    layout_json: "{}",
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-02 10:00:00",
    ...overrides,
  };
}

const shelf = [
  book({ id: 1, title: "The Quiet Hour", author: "A. Writer", status: "draft", updated_at: "2026-03-01 10:00:00" }),
  book({ id: 2, title: "Blue Rooms", author: "B. Poet", genre: "Poetry", status: "ready", updated_at: "2026-01-01 10:00:00", created_at: "2025-12-01 10:00:00" }),
  book({ id: 3, title: "Field Notes", author: "C. Editor", genre: "Nonfiction", status: "published", updated_at: "2026-02-01 10:00:00", created_at: "2026-02-15 10:00:00" }),
];

test("library search covers title, author, genre and stage", () => {
  assert.deepEqual(filterLibraryBooks(shelf, { query: "poet" }).map((item) => item.id), [2]);
  assert.deepEqual(filterLibraryBooks(shelf, { query: "nonfiction" }).map((item) => item.id), [3]);
  assert.deepEqual(filterLibraryBooks(shelf, { query: "published" }).map((item) => item.id), [3]);
  assert.match(libraryBookSearchText(shelf[0]), /the quiet hour/);
});

test("library stage filter and counts stay aligned", () => {
  assert.deepEqual(filterLibraryBooks(shelf, { status: "ready" }).map((item) => item.id), [2]);
  assert.deepEqual(libraryStatusCounts(shelf), { all: 3, draft: 1, revising: 0, ready: 1, published: 1 });
});

test("library sorting covers recency, title, creation and progress", () => {
  assert.deepEqual(filterLibraryBooks(shelf).map((item) => item.id), [1, 3, 2]);
  assert.deepEqual(filterLibraryBooks(shelf, { sort: "title" }).map((item) => item.id), [2, 3, 1]);
  assert.deepEqual(filterLibraryBooks(shelf, { sort: "created" }).map((item) => item.id), [3, 1, 2]);
  assert.deepEqual(filterLibraryBooks(shelf, { sort: "stage" }).map((item) => item.id), [3, 2, 1]);
});

test("library labels use the saved publishing vocabulary", () => {
  assert.equal(libraryStatusLabel("revising"), "In revision");
  assert.equal(libraryStatusLabel("unexpected-stage"), "unexpected stage");
});
