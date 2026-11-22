const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
for (const name of ["document", "DOMParser", "Element", "NodeFilter"]) global[name] = window[name];
const { noteHtmlToMarkdown, noteMarkdownToHtml } = require("./.compiled/src/lib/noteRichtext.js");
const { htmlToMarkdown } = require("./.compiled/src/lib/richtext.js");

test("synthetic prose keeps single breaks, repeated blank rows, tabs and Unicode across repeated reopen", () => {
  for (const original of ["First\nSecond", "First\n\nSecond", "First\n\n\n\nSecond", "\n\nFirst\n\n", "One  two\tthree", "  First\n   second  ", "Café  中文\n🌿 sample", "A\u00a0B", "\uE000\uE001 sample\nnext"]) {
    let source = original;
    for (let pass = 0; pass < 5; pass++) { source = noteHtmlToMarkdown(noteMarkdownToHtml(source)); assert.equal(source, original); }
  }
});
test("browser paragraphs, div lines and placeholder BRs serialize without paragraph inflation", () => {
  for (const [html, expected] of [
    ["a<div>b</div>", "a\nb"], ["<p>a</p><p>b</p>", "a\nb"],
    ["<div>a</div><div><br></div><div><br></div><div>b</div>", "a\n\n\nb"],
    ["a<br><br>", "a\n"], ["<p>a<br>b</p>", "a\nb"], ["<br>", ""],
    ["<p>a\n\n</p>", "a\n"], ["<div><b>a\n\n</b></div>", "**a**\n"],
    ['<p data-note-blank="true">Filled mock row<br data-note-break="true"></p>', "Filled mock row"],
  ]) assert.equal(noteHtmlToMarkdown(html), expected);
});
test("headings, emphasis, tasks, quotes and code retain semantics and spacing", () => {
  for (const original of ["# Heading\n\n**Bold** and *italic* and ~~deleted~~\nnext", "- [ ] Task\n- [x] Done", "> Quote\n> next\n\nAfter", "```text\n  keep  spaces\n\nnext\n```\n\nAfter", "[A link](https://example.com)\n`a  b`\n\nAfter"]) {
    let source = original;
    for (let pass = 0; pass < 4; pass++) { source = noteHtmlToMarkdown(noteMarkdownToHtml(source)); assert.equal(source, original); }
  }
  const source = "before\n\n- one\n- two\n\nafter";
  const once = noteHtmlToMarkdown(noteMarkdownToHtml(source));
  assert.equal(noteHtmlToMarkdown(noteMarkdownToHtml(once)), once);
});
test("rich and preview rendering emits explicit rows and never enables raw HTML", () => {
  const doc = new JSDOM(noteMarkdownToHtml("First\nSecond\n\n\nLast\n")).window.document;
  assert.equal(doc.querySelectorAll('[data-note-blank="true"]').length, 3);
  assert.equal(doc.querySelectorAll('[data-note-break="true"]').length, 4);
  for (const br of doc.querySelectorAll("br")) assert.ok(!br.nextSibling?.textContent.startsWith("\n"), "a BR must not display a second formatting newline");
  const unsafe = new JSDOM(noteMarkdownToHtml('<script>alert("mock")</script>\n\n![sample](javascript:alert(1))')).window.document;
  assert.equal(unsafe.querySelector("script"), null);
  assert.ok(!unsafe.querySelector('[src^="javascript:"]'));
});
test("the manuscript converter retains its existing paragraph behavior", () => {
  assert.equal(htmlToMarkdown("<p>One</p><p>Two</p>"), "One\n\nTwo");
});
