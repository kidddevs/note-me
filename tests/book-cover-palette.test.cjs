const test = require("node:test");
const assert = require("node:assert/strict");
const { coverGradientFromPalette, extractPaletteFromPixels, mergeCoverPalette } = require("./.compiled/src/lib/bookCoverPalette");

test("sampled colours move to the front of a bounded palette without duplicate swatches", () => {
  const existing = Array.from({ length: 16 }, (_, index) => "#1234" + index.toString(16).padStart(2, "0"));
  const palette = mergeCoverPalette(["#AbC8", " #123409 ", "invalid"], existing);
  assert.deepEqual(palette.slice(0, 3), ["#aabbcc88", "#123409", "#123400"]);
  assert.equal(palette.length, 16);
  assert.equal(new Set(palette).size, 16);
  assert.ok(!palette.includes("#12340f"));
});

test("palette gradients use distinct colours, preserve transparency and keep the gradient geometry", () => {
  const radial = { type: "radial", angle: 73, stops: [{ color: "#efefef", position: 0 }, { color: "#343434", position: 1 }] };
  assert.equal(coverGradientFromPalette(["#abc", "#aabbcc", "invalid"], radial), null);
  assert.deepEqual(coverGradientFromPalette(["#ABC", "#aabbcc", "#0128", "#321", "#faa", "#111"], radial), {
    type: "radial", angle: 73,
    stops: [
      { color: "#aabbcc", position: 0 },
      { color: "#00112288", position: 1 / 3 },
      { color: "#332211", position: 2 / 3 },
      { color: "#ffaaaa", position: 1 },
    ],
  });
  assert.equal(radial.stops[0].color, "#efefef");
});

function pixelsOf(colors, repeat = 40) {
  const data = [];
  for (const [r, g, b, a = 255] of colors) {
    for (let index = 0; index < repeat; index += 1) data.push(r, g, b, a);
  }
  return data;
}

test("palette extraction returns distinct dominant colours in frequency order", () => {
  const red = [235, 40, 40];
  const blue = [30, 70, 230];
  const green = [30, 190, 80];
  const yellow = [235, 205, 35];
  const data = [];
  for (const [color, repeats] of [[red, 80], [blue, 50], [green, 30], [yellow, 20]]) {
    for (let index = 0; index < repeats; index += 1) data.push(color[0], color[1], color[2], 255);
  }
  const palette = extractPaletteFromPixels(data, 8);
  assert.equal(palette.length, 4);
  assert.equal(palette[0], "#eb2828");
  assert.equal(palette[1], "#1e46e6");
  assert.equal(palette[2], "#1ebe50");
  assert.equal(palette[3], "#ebcd23");
});

test("palette extraction ignores transparency and merges similar colours", () => {
  const data = pixelsOf([
    [240, 30, 30, 255],
    [248, 36, 36, 255],
    [30, 30, 240, 0],
    [30, 30, 240, 0],
    [250, 250, 250, 255],
  ], 30);
  const palette = extractPaletteFromPixels(data, 6);
  assert.deepEqual(palette, ["#f01e1e", "#fafafa"]);
});

test("palette extraction respects the requested count and tolerates tiny inputs", () => {
  const many = pixelsOf([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]], 10);
  assert.equal(extractPaletteFromPixels(many, 3).length, 3);
  assert.equal(extractPaletteFromPixels(many, 99).length, 6);
  assert.deepEqual(extractPaletteFromPixels([], 8), []);
  assert.deepEqual(extractPaletteFromPixels([255, 0, 0], 8), []);
  assert.equal(extractPaletteFromPixels(pixelsOf([[1, 2, 3]]), 8)[0], "#010203");
});
