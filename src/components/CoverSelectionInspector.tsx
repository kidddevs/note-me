import { useEffect, useState } from "react";
import { Copy, FolderPlus, Link2, LockKeyhole, RotateCcw, RotateCw } from "lucide-react";
import { coverLayerLocked, type BookCoverDocument, type CoverMetrics } from "../lib/bookCoverDoc";
import { coverSelectionBounds, type CoverSelectionTransform } from "../lib/bookCoverGeometry";
import type { StudioAlign, StudioArrangeReference, StudioAxis, StudioSpacing } from "../lib/studioGeometry";
import { StudioArrangeControls } from "./StudioArrangeControls";

function GeometryField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value * 1000) / 1000));
  useEffect(() => setDraft(String(Math.round(value * 1000) / 1000)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed) && Math.abs(parsed - value) > 0.0005) onCommit(parsed);
    setDraft(String(Math.round(value * 1000) / 1000));
  };
  return <label className="studio-selection-dimension"><span>{label}</span><span><input aria-label={`Selection ${label}`} type="number" step="0.05" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
    if (event.key === "Escape") { event.stopPropagation(); setDraft(String(Math.round(value * 1000) / 1000)); }
  }} /><small>in</small></span></label>;
}

export function CoverSelectionInspector({ doc, ids, metrics, reference, onReference, spacing, onSpacing, onAlign, onDistribute, onTransform, onGroup, onDuplicate }: {
  doc: BookCoverDocument;
  ids: string[];
  metrics: CoverMetrics;
  reference: StudioArrangeReference;
  onReference: (value: StudioArrangeReference) => void;
  spacing: StudioSpacing;
  onSpacing: (value: StudioSpacing) => void;
  onAlign: (mode: StudioAlign) => void;
  onDistribute: (axis: StudioAxis, spacing: StudioSpacing) => void;
  onTransform: (change: CoverSelectionTransform, key: string) => void;
  onGroup: () => void;
  onDuplicate: () => void;
}) {
  const layers = doc.layers.filter((layer) => ids.includes(layer.id));
  const bounds = coverSelectionBounds(metrics, layers);
  const locked = layers.some((layer) => coverLayerLocked(doc, layer));
  if (!bounds) return null;
  const groupId = layers[0]?.groupId;
  const group = groupId && layers.every((layer) => layer.groupId === groupId) && doc.layers.filter((layer) => layer.groupId === groupId).length === layers.length ? doc.groups.find((item) => item.id === groupId) : null;
  return <div className="cover-selection-inspector">
    {locked && <p className="studio-selection-locked"><LockKeyhole size={14} /> Unlock every selected layer and group to transform the selection.</p>}
    <section className="studio-selection-section"><h3>{group?.name || "Transform selection"}</h3><p>Full-wrap coordinates</p>
      <fieldset disabled={locked} className="studio-selection-transform">
        <div className="studio-selection-dimensions">
          <GeometryField label="X" value={bounds.x} onCommit={(x) => onTransform({ dx: x - bounds.x }, "position-x")} />
          <GeometryField label="Y" value={bounds.y} onCommit={(y) => onTransform({ dy: y - bounds.y }, "position-y")} />
          <GeometryField label="Width" value={bounds.width} onCommit={(width) => onTransform({ scale: width / bounds.width }, "scale-width")} />
          <GeometryField label="Height" value={bounds.height} onCommit={(height) => onTransform({ scale: height / bounds.height }, "scale-height")} />
        </div>
        <p className="studio-selection-ratio"><Link2 size={12} /> Resize proportionally from the center. Drag a corner to anchor the opposite corner.</p>
        <div className="studio-selection-rotation"><button type="button" aria-label="Rotate selection 15 degrees left" onClick={() => onTransform({ rotation: -15 }, "rotate-left")}><RotateCcw size={14} /> 15°</button><button type="button" aria-label="Rotate selection 15 degrees right" onClick={() => onTransform({ rotation: 15 }, "rotate-right")}><RotateCw size={14} /> 15°</button><button type="button" onClick={() => onTransform({ rotation: 90 }, "rotate-quarter")}><RotateCw size={14} /> 90°</button></div>
      </fieldset>
    </section>
    <section className="studio-selection-section"><h3>Align & space</h3><StudioArrangeControls count={layers.length} reference={reference} onReference={onReference} spacing={spacing} onSpacing={onSpacing} onAlign={onAlign} onDistribute={onDistribute} disabled={locked} references={[{ value: "selection", label: "Selection" }, { value: "canvas", label: "Current artboard" }, { value: "safe", label: "Artboard safe area" }]} /></section>
    <section className="studio-selection-section studio-selection-actions"><button type="button" disabled={locked} onClick={onGroup}><FolderPlus size={14} /> Group selection</button><button type="button" onClick={onDuplicate}><Copy size={14} /> Duplicate selection</button></section>
  </div>;
}
