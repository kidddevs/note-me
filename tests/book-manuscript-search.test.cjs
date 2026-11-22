const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { findManuscriptMatches, replaceManuscriptText, highlightManuscriptMatches } = require("./.compiled/src/lib/bookManuscriptSearch.js");
const { canvasBlocks, canvasTextSource, markdownToHtml, setChapterFreeLayout } = require("./.compiled/src/lib/bookPublishing.js");
const { DEFAULT_BOOK_TYPOGRAPHY } = require("./.compiled/src/lib/bookLayout.js");

test("prose search and replacement leave artwork, links and structured objects byte-for-byte intact", () => {
  const prose = canvasTextSource("## Shore **shore** [shore](https://shore.example/shore)", { width: 60, align: "left", styleId: "shore" });
  const media = '\n\n![shore](data:image/png;base64,shore){caption="shore" credit="shore"}\n\n::: chart\n{"title":"shore","labels":["shore"]}\n:::\n\n| shore |\n| --- |\n| shore |\n\n::: callout\n{"title":"shore"}\nshore\n:::';
  const content = setChapterFreeLayout(prose + media, true);
  const matches = findManuscriptMatches(content, "shore");
  assert.equal(matches.length, 3);
  assert.deepEqual(matches.map((match) => content.slice(match.start, match.end)), ["Shore", "shore", "shore"]);
  assert.equal(replaceManuscriptText(content, "shore", "coast").content, content.replace("Shore **shore** [shore]", "coast **coast** [coast]"));
});

test("case and Unicode word boundaries use source offsets without lowercase expansion drift", () => {
  const content = "İ Shore shore shoreline shore_line shore's shore’s éshore shoreé 𐐀shore shore𐐀\n\n**shore**";
  const matches = findManuscriptMatches(content, "shore", { wholeWord: true });
  assert.deepEqual(matches.map((match) => content.slice(match.start, match.end)), ["Shore", "shore", "shore"]);
  assert.equal(findManuscriptMatches(content, "shore", { wholeWord: true, matchCase: true }).length, 2);
  assert.equal(findManuscriptMatches("shore**line** **shore**", "shore", { wholeWord: true }).length, 1);
});

test("literal queries, empty queries and large source offsets remain safe", () => {
  const content = "İ ".repeat(2000) + "[x] a+b $cash";
  const match = findManuscriptMatches(content, "[x]")[0];
  assert.equal(content.slice(match.start, match.end), "[x]");
  assert.equal(findManuscriptMatches(content, "a+b").length, 1);
  for (const query of ["", "  ", "[", "\\", ".*", "(?=x)"]) assert.doesNotThrow(() => findManuscriptMatches(content, query));
  assert.deepEqual(findManuscriptMatches(content, "  "), []);
});

test("markers, image attributes, fenced code and scene breaks are excluded", () => {
  const content = "# shore\n\n- shore\n1. shore\n\n```text\n# shore\nshore\n```\n\nshore\n\n---\n\n***";
  assert.equal(findManuscriptMatches(content, "shore").length, 4);
  for (const query of ["#", "-", "1.", "```", "text", "**"]) assert.equal(findManuscriptMatches(content, query).length, 0);
  assert.equal(findManuscriptMatches("shore\n\n```\nshore", "shore").length, 1);
});

test("inline style runs stay intact and a search does not cross style or media boundaries", () => {
  const content = "**shore** _shore_ ++shore++ ~~shore~~ `shore` [shore](https://example.com)\n\nquiet **shore**\n\nshore ![x](data:image/png;base64,shore) coast";
  assert.equal(findManuscriptMatches(content, "shore").length, 8);
  assert.equal(findManuscriptMatches(content, "quiet shore").length, 0);
  assert.equal(findManuscriptMatches(content, "shore coast").length, 0);
  const replaced = replaceManuscriptText(content, "shore", "coast");
  assert.equal(replaced.count, 8);
  assert.ok(replaced.content.includes("**coast** _coast_ ++coast++ ~~coast~~ `coast` [coast](https://example.com)"));
  assert.ok(replaced.content.includes("base64,shore"));
});

test("single replacement proceeds past inserted matches and wraps after the last match", () => {
  let result = replaceManuscriptText("shore shore shore", "shore", "shoreline", {}, 0);
  assert.equal(result.content, "shoreline shore shore"); assert.equal(result.nextIndex, 1);
  result = replaceManuscriptText(result.content, "shore", "coast", {}, result.nextIndex);
  assert.equal(result.content, "shoreline coast shore"); assert.equal(result.nextIndex, 1);
  result = replaceManuscriptText(result.content, "shore", "coast", {}, result.nextIndex);
  assert.equal(result.content, "shoreline coast coast"); assert.equal(result.nextIndex, 0);
});

test("replace all handles deletion, literal dollars, longer replacements and stale indices", () => {
  assert.equal(replaceManuscriptText("shore shore", "shore", "$&$$").content, "$&$$ $&$$");
  assert.equal(replaceManuscriptText("shore shore", "shore", "").content, " ");
  for (const index of [-1, 20, 0.5]) assert.deepEqual(replaceManuscriptText("shore", "shore", "coast", {}, index), { content: "shore", count: 0, nextIndex: 0 });
  assert.equal(replaceManuscriptText("shore SHORE", "shore", "coast", { matchCase: true }).content, "coast SHORE");
});

function highlighted(content, query, typography = DEFAULT_BOOK_TYPOGRAPHY) {
  const matches = findManuscriptMatches(content, query);
  const html = canvasBlocks(content).filter((block) => block.kind === "text").map((block) => highlightManuscriptMatches(block.source, matches.filter((match) => match.blockStart === block.start), block.start, matches[0]?.start, (source) => markdownToHtml(source, undefined, typography))).join("");
  return { matches, html, document: new JSDOM(html).window.document };
}

test("preview highlights retain rich markup, escape HTML, and mark the current source match", () => {
  const content = '# shore\n\n**shore** [shore](https://example.com) <shore>';
  const { document, matches, html } = highlighted(content, "shore");
  assert.equal(document.querySelectorAll("mark").length, 4);
  assert.equal(document.querySelectorAll('[data-manuscript-find-current="true"]').length, 1);
  assert.equal(document.querySelector("strong mark").textContent, "shore");
  assert.equal(document.querySelector("a").getAttribute("href"), "https://example.com");
  assert.equal(document.querySelector("shore"), null);
  assert.ok(!/[\uE000-\uE003]/.test(html));
  assert.ok(matches.every((match) => content.slice(match.start, match.end).toLowerCase() === "shore"));
});

test("preview highlights span nested typography safely and preserve private-use user text", () => {
  const content = "\uE000\uE001 quiet shore at home";
  const typography = { ...DEFAULT_BOOK_TYPOGRAPHY, paragraph: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph, nestedStyle: "bold", nestedWords: 2 } };
  const original = new JSDOM(markdownToHtml(content, undefined, typography)).window.document.body;
  const { document } = highlighted(content, "quiet shore", typography);
  assert.equal(document.body.textContent, original.textContent);
  assert.equal(Array.from(document.querySelectorAll("mark"), (node) => node.textContent).join(""), "quiet shore");
  assert.equal(document.querySelectorAll(".book-nested-style").length, original.querySelectorAll(".book-nested-style").length);
});
