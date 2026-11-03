const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCoverPdf, COVER_PDF_SLUG } = require("./.compiled/src/lib/bookCoverPdf.js");

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

test("print PDF embeds the rendered wrap at physical page size", () => {
  const pdf = buildCoverPdf(jpeg, {
    pageWidth: 13.75,
    pageHeight: 9.75,
    imageWidth: 4125,
    imageHeight: 2925,
  });
  const text = Buffer.from(pdf).toString("latin1");
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/MediaBox \[0 0 990 702\]/);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/Width 4125/);
  assert.match(text, /\/Height 2925/);
  assert.match(text, /\/Im0 Do/);
  assert.match(text, /xref/);
  assert.match(text, /startxref/);
  assert.ok(text.endsWith("%%EOF\n"));
});

test("PDF xref offsets point at real objects", () => {
  const pdf = buildCoverPdf(jpeg, {
    pageWidth: 12.5,
    pageHeight: 9.5,
    imageWidth: 1000,
    imageHeight: 760,
  });
  const text = Buffer.from(pdf).toString("latin1");
  const xref = text.indexOf("xref\n0 6\n");
  assert.ok(xref > 0);
  const lines = text.slice(xref).split("\n");
  const firstOffset = Number.parseInt(lines[3].slice(0, 10), 10);
  assert.equal(text.slice(firstOffset, firstOffset + 8), "1 0 obj\n");
  assert.equal(COVER_PDF_SLUG, 0.25);
});
