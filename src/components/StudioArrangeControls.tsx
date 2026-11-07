import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter } from "lucide-react";
import type { StudioAlign, StudioArrangeReference, StudioAxis, StudioSpacing } from "../lib/studioGeometry";

export function StudioArrangeControls({ count, reference, references, onReference, spacing, onSpacing, onAlign, onDistribute, disabled = false }: {
  count: number;
  reference: StudioArrangeReference;
  references: Array<{ value: StudioArrangeReference; label: string }>;
  onReference: (value: StudioArrangeReference) => void;
  spacing: StudioSpacing;
  onSpacing: (value: StudioSpacing) => void;
  onAlign: (mode: StudioAlign) => void;
  onDistribute: (axis: StudioAxis, spacing: StudioSpacing) => void;
  disabled?: boolean;
}) {
  return <fieldset className="studio-arrange-controls" disabled={disabled} onKeyDown={(event) => { if (event.key === "Escape" && (event.target as HTMLElement).tagName === "SELECT") event.stopPropagation(); }}>
    <label><span>Align to</span><select aria-label="Align to" value={reference} onChange={(event) => onReference(event.target.value as StudioArrangeReference)}>{references.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <div className="studio-arrange-align" role="group" aria-label="Align selected objects">
      {([
        ["left", "Align left edges", AlignStartVertical], ["center-x", "Align horizontal centers", AlignCenterVertical], ["right", "Align right edges", AlignEndVertical],
        ["top", "Align top edges", AlignStartHorizontal], ["middle", "Align vertical centers", AlignCenterHorizontal], ["bottom", "Align bottom edges", AlignEndHorizontal],
      ] as const).map(([mode, label, Icon]) => <button key={mode} type="button" onClick={() => onAlign(mode)} aria-label={label} title={label}><Icon size={15} /></button>)}
    </div>
    <label><span>Space by</span><select aria-label="Distribute by" value={spacing} onChange={(event) => onSpacing(event.target.value as StudioSpacing)}><option value="gaps">Equal gaps</option><option value="centers">Equal centers</option></select></label>
    <div className="studio-arrange-distribute" role="group" aria-label="Space selected objects">
      <button type="button" disabled={count < 3} onClick={() => onDistribute("horizontal", spacing)}><AlignHorizontalDistributeCenter size={15} /> Horizontal</button>
      <button type="button" disabled={count < 3} onClick={() => onDistribute("vertical", spacing)}><AlignVerticalDistributeCenter size={15} /> Vertical</button>
    </div>
    <p>{count < 3 ? "Select at least three objects to distribute." : "Spacing keeps the two outer objects in place."}</p>
  </fieldset>;
}
