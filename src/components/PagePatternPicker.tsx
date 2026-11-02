import type { CSSProperties } from "react";
import { BOOK_PAGE_PATTERNS, type BookLayout } from "../lib/bookLayout";
import { measurementRange, measurementText, measurementToInches, measurementValue, measurementUnitShort } from "../lib/measurements";
import { useTheme } from "../store/theme";

export function PagePatternPicker({ layout, onChange }: { layout: BookLayout; onChange: (change: (layout: BookLayout) => BookLayout) => void }) {
  const unit = useTheme((state) => state.measurementUnit);
  const spacingRange = measurementRange(0.15, 0.6, unit);
  const spacingStep = unit === "px" ? 1 : unit === "cm" ? 0.025 : 0.01;
  const previewStyle = {
    "--page-pattern-color": layout.pagePatternColor,
    "--page-pattern-step": "13px",
  } as CSSProperties;
  return (
    <div className="page-pattern-picker">
      <div className="page-pattern-grid" role="group" aria-label="Paper pattern">
        {BOOK_PAGE_PATTERNS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={layout.pagePattern === option.value ? "active" : ""}
            onClick={() => onChange((current) => ({ ...current, pagePattern: option.value }))}
            aria-pressed={layout.pagePattern === option.value}
            title={option.description}
          >
            <span className={`page-pattern-swatch paper-${option.value}`} style={previewStyle} aria-hidden="true" />
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
      {layout.pagePattern !== "blank" && (
        <div className="page-pattern-controls">
          <label>
            <span>Rule color</span>
            <span className="page-pattern-color">
              <input type="color" value={layout.pagePatternColor} onChange={(event) => onChange((current) => ({ ...current, pagePatternColor: event.target.value }))} aria-label="Paper pattern color" />
              <code>{layout.pagePatternColor}</code>
            </span>
          </label>
          <label>
            <span>Spacing</span>
            <span className="page-pattern-spacing">
              <input type="range" min={spacingRange.min} max={spacingRange.max} step={spacingStep} value={measurementValue(layout.pagePatternSpacing, unit)} onChange={(event) => onChange((current) => ({ ...current, pagePatternSpacing: measurementToInches(Number(event.target.value), unit) }))} aria-label={`Paper pattern spacing in ${measurementUnitShort(unit)}`} />
              <code>{measurementText(layout.pagePatternSpacing, unit)}</code>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
