const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "../src/styles.css"), "utf8");
const tokens = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]));
const light = tokens(css.match(/:root \{([\s\S]*?)\n\}/)[1]);
const dark = { ...light, ...tokens(css.match(/\[data-theme="dark"\] \{([\s\S]*?)\n\}/)[1]) };

function color(value) {
  if (value.startsWith("#")) return [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16)).concat(1);
  const rgba = value.match(/^rgba\(([^)]+)\)$/);
  assert.ok(rgba, `Unsupported test color: ${value}`);
  return rgba[1].split(",").map(Number);
}

function composite(foreground, background) {
  const [r, g, b, alpha] = foreground;
  return [r, g, b].map((channel, index) => channel * alpha + background[index] * (1 - alpha)).concat(1);
}

function luminance(rgb) {
  const linear = rgb.slice(0, 3).map((channel) => {
    const unit = channel / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return linear.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function readable(foreground, background, label) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  const ratio = (values[1] + 0.05) / (values[0] + 0.05);
  assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1, expected at least 4.5:1`);
}

for (const [theme, palette] of Object.entries({ light, dark })) {
  test(`${theme} neutral text remains readable on normal, hover and selected UI surfaces`, () => {
    const backgrounds = ["--bg", "--surface", "--surface-modal"].flatMap((base) => {
      const background = color(palette[base]);
      return [background, ...["--surface-2", "--surface-3", "--surface-hover", "--surface-active", "--accent-soft", "--accent-soft-hover"].map((overlay) => composite(color(palette[overlay]), background))];
    });
    for (const token of ["--text", "--text-2", "--text-3", "--text-4"]) {
      backgrounds.forEach((background, index) => readable(color(palette[token]), background, `${theme} ${token} on surface ${index}`));
    }
  });

  test(`${theme} accent buttons and semantic labels retain normal text contrast`, () => {
    for (const accent of ["--accent", "--accent-hover", "--accent-active"]) {
      readable(color(palette["--accent-text"]), color(palette[accent]), `${theme} ${accent} button`);
    }
    readable(color(palette["--danger-text"]), color(palette["--danger"]), `${theme} destructive button`);
    for (const base of ["--bg", "--surface", "--surface-modal"]) {
      const background = color(palette[base]);
      readable(color(palette["--accent"]), composite(color(palette["--accent-soft"]), background), `${theme} accent label`);
      for (const name of ["danger", "success", "warning", "indigo", "purple", "teal"]) {
        readable(color(palette[`--${name}`]), composite(color(palette[`--${name}-soft`]), background), `${theme} ${name} label`);
      }
    }
  });
}
