import { useState } from "react";
import { Check, ClipboardPaste, LockKeyhole, Paintbrush, Plus, Trash2, X } from "lucide-react";
import {
  COVER_STYLE_SCOPES,
  MAX_SAVED_COVER_STYLE_NAME,
  type CoverLayerStylePreset,
  type CoverLayerStyleValues,
  type CoverStyleScope,
} from "../lib/bookCoverStyles";

export function CoverStyleControls({ sourceName, selectionCount, scope, onScope, locked, canPaste, canApply, presets, onCopy, onPaste, onApply, onSave, onDelete }: {
  sourceName: string;
  selectionCount: number;
  scope: CoverStyleScope;
  onScope: (value: CoverStyleScope) => void;
  locked: boolean;
  canPaste: boolean;
  canApply: (values: CoverLayerStyleValues) => boolean;
  presets: CoverLayerStylePreset[];
  onCopy: () => void;
  onPaste: () => void;
  onApply: (preset: CoverLayerStylePreset) => void;
  onSave: (name: string) => string | null;
  onDelete: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const cancel = () => { setSaving(false); setError(""); };
  return <div className="cover-style-controls">
    {selectionCount > 1 && <p className="cover-field-hint">Copy or save from <strong>{sourceName}</strong>. Apply to {selectionCount} selected layers.</p>}
    <label className="cover-select-field full"><span>Apply style</span>
      <select aria-label="Style properties to apply" value={scope} onChange={(event) => onScope(event.target.value as CoverStyleScope)}>
        {COVER_STYLE_SCOPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    {locked && <p className="cover-style-lock"><LockKeyhole size={13} /> Unlock the selected layers and groups to apply a style.</p>}
    <div className="cover-style-actions">
      <button type="button" className="cover-mini-button" onClick={onCopy} title={`Copy appearance from ${sourceName}`}><Paintbrush size={12} /> Copy style</button>
      <button type="button" className="cover-mini-button" disabled={!canPaste} onClick={onPaste} title="Paste the chosen properties onto compatible layers"><ClipboardPaste size={12} /> Paste style</button>
    </div>
    <div className="cover-style-presets">
      <span className="cover-field-heading">Saved styles</span>
      {presets.length === 0 ? <p className="cover-style-empty">Save a layer's appearance to reuse it across covers.</p> : (
        <div className="cover-style-preset-list">
          {presets.map((preset) => <div className="cover-style-preset" key={preset.id}>
            <button type="button" disabled={!canApply(preset.values)} onClick={() => onApply(preset)} title={`Apply ${preset.name}`}><span>{preset.name}</span><small>{preset.sourceType}</small></button>
            <button type="button" className="cover-style-delete" onClick={() => onDelete(preset.id)} title={`Delete ${preset.name}`} aria-label={`Delete ${preset.name} style`}><Trash2 size={11} /></button>
          </div>)}
        </div>
      )}
      {saving ? <form className="cover-style-save" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        const message = onSave(name.trim());
        if (message) setError(message);
        else cancel();
      }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); cancel(); }
      }}>
        <label className="cover-text-input"><span>Style name</span><input autoFocus maxLength={MAX_SAVED_COVER_STYLE_NAME} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} /></label>
        <div className="cover-style-actions">
          <button type="submit" className="cover-mini-button" disabled={!name.trim()}><Check size={12} /> Save style</button>
          <button type="button" className="cover-mini-button" onClick={cancel}><X size={12} /> Cancel</button>
        </div>
        {error && <p className="cover-style-error" role="alert">{error}</p>}
      </form> : <button type="button" className="cover-wide-button subtle" onClick={() => {
        setName(`${sourceName} style`.slice(0, MAX_SAVED_COVER_STYLE_NAME));
        setSaving(true);
      }}><Plus size={12} /> Save current style</button>}
    </div>
    <small className="cover-field-hint">Copy ⌥⌘C · Paste ⌥⌘V. Paste uses the chosen properties.</small>
  </div>;
}
