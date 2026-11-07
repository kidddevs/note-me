const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCoverHex, parseCoverColor, rgbaToHex, rgbToHsv, hsvToRgb } = require("./.compiled/src/lib/bookCoverColor.js");

test("cover colours accept only valid hex lengths and expand shorthand alpha", () => {
  assert.equal(normalizeCoverHex(" AbC "), "#aabbcc");
  assert.equal(normalizeCoverHex("#abcd"), "#aabbccdd");
  assert.equal(normalizeCoverHex("#12345678"), "#12345678");
  for (const value of ["", "#12", "#12345", "#1234567", "#123456789", "#zzzzzz", "red"]) assert.equal(normalizeCoverHex(value), null);
  assert.deepEqual(parseCoverColor("#f008"), { r: 255, g: 0, b: 0, a: 0.533 });
});

test("HSV and RGB conversions round-trip the full sRGB range and alpha", () => {
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
    const input = { r, g, b, a: 1 };
    assert.equal(rgbaToHex(hsvToRgb(rgbToHsv(input))), rgbaToHex(input));
  }
  for (let alpha = 0; alpha <= 255; alpha++) {
    const hex = `#bfaeaa${alpha.toString(16).padStart(2, "0")}`;
    assert.equal(rgbaToHex(parseCoverColor(hex)), alpha === 255 ? "#bfaeaa" : hex);
  }
  assert.equal(rgbaToHex(hsvToRgb({ h: 360, s: 1, v: 1 })), "#ff0000");
});
