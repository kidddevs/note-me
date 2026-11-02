export type MeasurementUnit = "in" | "cm" | "px";

export interface MeasurementUnitOption {
  value: MeasurementUnit;
  label: string;
  short: string;
  description: string;
}

export const MEASUREMENT_UNITS: MeasurementUnitOption[] = [
  { value: "in", label: "Inches", short: "in", description: "Print-native page sizes, margins, and rulers" },
  { value: "cm", label: "Centimeters", short: "cm", description: "Metric page sizes, margins, and rulers" },
  { value: "px", label: "Pixels", short: "px", description: "Screen-native measurements at 96 px per inch" },
];

export const DEFAULT_MEASUREMENT_UNIT: MeasurementUnit = "in";
export const PIXELS_PER_INCH = 96;

export function isMeasurementUnit(value: unknown): value is MeasurementUnit {
  return value === "in" || value === "cm" || value === "px";
}

export function measurementUnitOption(unit: MeasurementUnit) {
  return MEASUREMENT_UNITS.find((option) => option.value === unit) ?? MEASUREMENT_UNITS[0];
}

export function measurementUnitShort(unit: MeasurementUnit) {
  return measurementUnitOption(unit).short;
}

export function measurementDecimals(unit: MeasurementUnit) {
  return unit === "px" ? 0 : 2;
}

export function measurementStep(unit: MeasurementUnit) {
  return unit === "px" ? 1 : unit === "cm" ? 0.1 : 0.05;
}

export function inchesToMeasurement(inches: number, unit: MeasurementUnit) {
  if (!Number.isFinite(inches)) return 0;
  if (unit === "cm") return inches * 2.54;
  if (unit === "px") return inches * PIXELS_PER_INCH;
  return inches;
}

export function measurementToInches(value: number, unit: MeasurementUnit) {
  if (!Number.isFinite(value)) return 0;
  if (unit === "cm") return value / 2.54;
  if (unit === "px") return value / PIXELS_PER_INCH;
  return value;
}

export function measurementValue(inches: number, unit: MeasurementUnit, decimals = measurementDecimals(unit)) {
  const converted = inchesToMeasurement(inches, unit);
  const factor = 10 ** decimals;
  return Math.round(converted * factor) / factor;
}

export function measurementText(inches: number, unit: MeasurementUnit, decimals = measurementDecimals(unit)) {
  return `${measurementValue(inches, unit, decimals)} ${measurementUnitShort(unit)}`;
}

export function measurementRange(minInches: number, maxInches: number, unit: MeasurementUnit) {
  return {
    min: measurementValue(minInches, unit),
    max: measurementValue(maxInches, unit),
    step: measurementStep(unit),
  };
}

export function trimSizeLabel(value: string, unit: MeasurementUnit) {
  const [width, height] = value.split("x").map((part) => Number(part));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return value;
  const suffix = measurementUnitShort(unit);
  const decimals = unit === "px" ? 0 : 2;
  return `${measurementValue(width, unit, decimals)} × ${measurementValue(height, unit, decimals)} ${suffix}`;
}

export function rulerMajorInches(unit: MeasurementUnit) {
  if (unit === "cm") return 1 / 2.54;
  if (unit === "px") return 100 / PIXELS_PER_INCH;
  return 1;
}

export function rulerLabel(inches: number, unit: MeasurementUnit) {
  return String(measurementValue(inches, unit, unit === "px" ? 0 : unit === "cm" ? 1 : 0));
}
