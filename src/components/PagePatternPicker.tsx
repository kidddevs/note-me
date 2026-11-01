import type { CSSProperties } from "react";
import { BOOK_PAGE_PATTERNS, type BookLayout } from "../lib/bookLayout";

export function PagePatternPicker({ layout, onChange }: { layout: BookLayout; onChange: (change: (layout: BookLayout) => BookLayout) => void }) {
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
              <input type="range" min="0.15" max="0.6" step="0.01" value={layout.pagePatternSpacing} onChange={(event) => onChange((current) => ({ ...current, pagePatternSpacing: Number(event.target.value) }))} aria-label="Paper pattern spacing" />
              <code>{layout.pagePatternSpacing.toFixed(2)} in</code>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
