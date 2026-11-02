const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MEASUREMENT_UNIT,
  inchesToMeasurement,
  measurementRange,
  measurementText,
  measurementToInches,
  measurementValue,
  rulerLabel,
  rulerMajorInches,
  trimSizeLabel,
} = require("./.compiled/src/lib/measurements.js");

test("measurement units convert between inches, centimeters, and pixels", () => {
  assert.equal(DEFAULT_MEASUREMENT_UNIT, "in");
  assert.equal(inchesToMeasurement(1, "in"), 1);
  assert.equal(inchesToMeasurement(1, "cm"), 2.54);
  assert.equal(inchesToMeasurement(1, "px"), 96);
  assert.equal(measurementToInches(2.54, "cm"), 1);
  assert.equal(measurementToInches(96, "px"), 1);
  assert.equal(measurementText(0.5, "cm"), "1.27 cm");
  assert.equal(measurementText(0.5, "px"), "48 px");
});

test("measurement ranges and ruler labels follow the selected unit", () => {
  assert.deepEqual(measurementRange(0.2, 3, "in"), { min: 0.2, max: 3, step: 0.05 });
  assert.deepEqual(measurementRange(0.2, 3, "px"), { min: 19, max: 288, step: 1 });
  assert.equal(measurementValue(0.5, "cm"), 1.27);
  assert.equal(rulerMajorInches("cm"), 1 / 2.54);
  assert.equal(rulerMajorInches("px"), 100 / 96);
  assert.equal(rulerLabel(1 / 2.54, "cm"), "1");
  assert.equal(rulerLabel(1, "px"), "96");
});

test("trim labels convert both dimensions without changing the stored size", () => {
  assert.equal(trimSizeLabel("6x9", "in"), "6 × 9 in");
  assert.equal(trimSizeLabel("6x9", "cm"), "15.24 × 22.86 cm");
  assert.equal(trimSizeLabel("6x9", "px"), "576 × 864 px");
});
