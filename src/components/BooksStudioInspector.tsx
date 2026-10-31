import { Fragment, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  BringToFront,
  CaseUpper,
  ChevronRight,
  Code2,
  Columns3,
  Copy,
  Frame,
  ImagePlus,
  Link2,
  List,
  ListOrdered,
  Minus,
  Move,
  PaintBucket,
  Palette,
  Plus,
  Quote,
  Rows3,
  SendToBack,
  SlidersHorizontal,
  Sparkles,
  Strikethrough,
  Table2,
  Trash2,
  Type,
  Underline,
} from "lucide-react";
import { DEFAULT_BOOK_TYPOGRAPHY, type BookBulletType, type BookGrepStyle, type BookLayout, type BookNestedStyle, type BookParagraphStyle, type BookRuleStyle, type BookTextAlign, type BookTextCase, type BookTextRole, type BookTextStyle } from "../lib/bookLayout";
import {
  addTableColumn,
  addTableRow,
  calloutBlockText,
  canvasTextSource,
  chartBlockText,
  CHART_PALETTE_NAMES,
  defaultChartData,
  DEFAULT_RICH_PRESENTATION,
  FONT_OPTIONS,
  fontCss,
  imageMarkdown,
  objectValue,
  richJsonLine,
  richPresentationFromValue,
  richPresentationLeft,
  splitTableCells,
  tableBlockText,
  tableSeparator,
  updateTableCell,
  removeTableColumn,
  removeTableRow,
  type ChartData,
  type ChartKind,
  type ChartPalette,
  type EditorContext,
  type ImagePresentation,
  type RichAlign,
  type RichPresentation,
  type TableAlign,
} from "../lib/bookPublishing";
import { cloneParagraphStyle, styleColor, styleFromRole, uniqueStyleId } from "../lib/bookStyles";

function InspectorSection({ icon, title, summary, children, defaultOpen = false }: { icon: ReactNode; title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`design-section ${open ? "open" : ""}`}>
      <button className="design-section-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="design-section-icon">{icon}</span>
        <span className="design-section-title"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
        <ChevronRight size={13} />
      </button>
      {open && <div className="design-section-body">{children}</div>}
    </section>
  );
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`design-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function NumberField({ value, onChange, min, max, step = 1, suffix }: { value: number; onChange: (value: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return <span className="design-number"><input type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))} />{suffix && <small>{suffix}</small>}</span>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label className="design-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const resolved = value === "accent" ? "#a56b3e" : value.startsWith("#") ? value : "#2b2621";
  return (
    <span className="design-color">
      <input type="color" value={resolved} onChange={(event) => onChange(event.target.value)} aria-label="Custom color" />
      <button className={value === "inherit" ? "active" : ""} onClick={() => onChange("inherit")} title="Use the inherited text color">Auto</button>
      <button className={value === "accent" ? "active" : ""} onClick={() => onChange("accent")} title="Use the book accent">Accent</button>
      <input className="design-color-hex" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Color value" />
    </span>
  );
}

function AlignmentButtons({ value, onChange }: { value: BookTextAlign; onChange: (value: BookTextAlign) => void }) {
  const options: { value: BookTextAlign; label: string; icon: ReactNode }[] = [
    { value: "left", label: "Align left", icon: <AlignLeft size={14} /> },
    { value: "center", label: "Align center", icon: <AlignCenter size={14} /> },
    { value: "right", label: "Align right", icon: <AlignRight size={14} /> },
    { value: "justify", label: "Justify", icon: <AlignJustify size={14} /> },
  ];
  return <div className="design-segment" role="group" aria-label="Alignment">{options.map((option) => <button key={option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)} title={option.label} aria-label={option.label} aria-pressed={value === option.value}>{option.icon}</button>)}</div>;
}

function PlacementButtons({ value, onChange }: { value: RichAlign; onChange: (value: RichAlign) => void }) {
  return <div className="design-segment" role="group" aria-label="Placement">{(["left", "center", "right"] as const).map((align) => <button key={align} className={value === align ? "active" : ""} onClick={() => onChange(align)} aria-label={`Place ${align}`} title={`Place ${align}`}><span className="design-letter">{align[0].toUpperCase()}</span></button>)}</div>;
}

function RuleControls({ title, rule, onChange }: { title: string; rule: BookTextStyle["ruleAbove"]; onChange: (patch: Partial<BookTextStyle["ruleAbove"]>) => void }) {
  return <div className="design-subgroup">
    <div className="design-subgroup-head"><strong>{title}</strong><Toggle checked={rule.enabled} onChange={(enabled) => onChange({ enabled })} label={rule.enabled ? "On" : "Off"} /></div>
    {rule.enabled && <div className="design-grid">
      <Field label="Weight"><NumberField value={rule.width} min={0} max={8} step={0.25} onChange={(width) => onChange({ width })} suffix="px" /></Field>
      <Field label="Style"><select value={rule.style} onChange={(event) => onChange({ style: event.target.value as BookRuleStyle })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="double">Double</option></select></Field>
      <Field label="Offset"><NumberField value={rule.offset} min={0} max={3} step={0.1} onChange={(offset) => onChange({ offset })} suffix="em" /></Field>
      <Field label="Color"><ColorField value={rule.color} onChange={(color) => onChange({ color })} /></Field>
    </div>}
  </div>;
}

function TextStyleEditor({ style, preset, role, showInlineFormatting, onPatch, onInlineFormat, onConvertRole, onDelete, onDuplicate }: { style: BookTextStyle; preset: BookParagraphStyle | null; role?: BookTextRole; showInlineFormatting?: boolean; onPatch: (patch: Partial<BookTextStyle>) => void; onInlineFormat?: (prefix: string, suffix?: string) => void; onConvertRole?: (level: number) => void; onDelete?: () => void; onDuplicate?: () => void }) {
  const presetFont = FONT_OPTIONS.some((option) => option.value === style.fontFamily);
  const headingLevel = role?.startsWith("heading") ? Number(role.slice(-1)) : role === "paragraph" ? 0 : null;
  const nestedFont = FONT_OPTIONS.some((option) => option.value === style.nestedFontFamily);
  const dropCapFont = FONT_OPTIONS.some((option) => option.value === style.dropCapFontFamily);
  return <div className="design-editor">
    <div className={`design-editing-badge ${preset ? "preset" : ""}`}>
      <Palette size={13} />
      <span>{preset ? <>Editing paragraph style <strong>{preset.name}</strong></> : <>Editing base role style</>}</span>
      {preset && <div className="design-editing-actions"><button onClick={onDuplicate} title="Duplicate style"><Copy size={12} /></button><button className="danger" onClick={onDelete} title="Delete style"><Trash2 size={12} /></button></div>}
    </div>
    {(showInlineFormatting || headingLevel !== null) && <div className="design-inline-format" role="toolbar" aria-label="Text formatting">
      {showInlineFormatting && <>
        <button onClick={() => onInlineFormat?.("**", "**")} title="Bold (⌘B)" aria-label="Bold"><strong>B</strong></button>
        <button onClick={() => onInlineFormat?.("*", "*")} title="Italic (⌘I)" aria-label="Italic"><em>I</em></button>
        <button onClick={() => onInlineFormat?.("++", "++")} title="Underline (⌘U)" aria-label="Underline"><Underline size={13} /></button>
        <button onClick={() => onInlineFormat?.("~~", "~~")} title="Strikethrough" aria-label="Strikethrough"><Strikethrough size={13} /></button>
        <span className="design-inline-format-sep" aria-hidden="true" />
        <button onClick={() => onInlineFormat?.("[", "](url)")} title="Link" aria-label="Link"><Link2 size={13} /></button>
        <button onClick={() => onInlineFormat?.("> ")} title="Block quote" aria-label="Block quote"><Quote size={13} /></button>
        <button onClick={() => onInlineFormat?.("- ")} title="Bulleted list" aria-label="Bulleted list"><List size={13} /></button>
        <button onClick={() => onInlineFormat?.("1. ")} title="Numbered list" aria-label="Numbered list"><ListOrdered size={13} /></button>
        <button onClick={() => onInlineFormat?.("`", "`")} title="Inline code" aria-label="Inline code"><Code2 size={13} /></button>
      </>}
      {headingLevel !== null && onConvertRole && <label className="design-inline-role"><span>Role</span><select value={headingLevel} onChange={(event) => onConvertRole(Number(event.target.value))} aria-label="Text role"><option value={0}>Body</option>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>Heading {level}</option>)}</select></label>}
    </div>}
    <InspectorSection icon={<Type size={14} />} title="Character" summary="Font, size, color, case" defaultOpen>
      <div className="design-grid">
        <Field label="Font" wide><select value={presetFont ? style.fontFamily : "custom"} onChange={(event) => onPatch({ fontFamily: event.target.value === "custom" ? "" : event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom stack</option></select></Field>
        {(!presetFont || !style.fontFamily) && <Field label="Custom font" wide><input value={style.fontFamily} onChange={(event) => onPatch({ fontFamily: event.target.value })} placeholder="Baskerville, Georgia, serif" /></Field>}
        <Field label="Size"><NumberField value={style.fontSize} min={6} max={96} step={0.5} onChange={(fontSize) => onPatch({ fontSize })} suffix="pt" /></Field>
        <Field label="Weight"><select value={style.fontWeight} onChange={(event) => onPatch({ fontWeight: Number(event.target.value) })}><option value={300}>Light</option><option value={400}>Regular</option><option value={500}>Medium</option><option value={600}>Semibold</option><option value={700}>Bold</option><option value={800}>Heavy</option></select></Field>
        <Field label="Leading"><NumberField value={style.lineHeight} min={0.8} max={3} step={0.05} onChange={(lineHeight) => onPatch({ lineHeight })} /></Field>
        <Field label="Tracking"><NumberField value={style.letterSpacing} min={-0.2} max={1} step={0.01} onChange={(letterSpacing) => onPatch({ letterSpacing })} suffix="em" /></Field>
        <Field label="Case"><select value={style.textCase} onChange={(event) => onPatch({ textCase: event.target.value as BookTextCase })}><option value="none">None</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="small-caps">Small caps</option></select></Field>
        <Field label="Color" wide><ColorField value={style.color} onChange={(color) => onPatch({ color })} /></Field>
      </div>
      <div className="design-inline-row">
        <Toggle checked={style.fontStyle === "italic"} onChange={(checked) => onPatch({ fontStyle: checked ? "italic" : "normal" })} label="Italic" />
        <Toggle checked={style.underline} onChange={(underline) => onPatch({ underline })} label="Underline" />
        <Toggle checked={style.strikethrough} onChange={(strikethrough) => onPatch({ strikethrough })} label="Strike" />
      </div>
      <div className="design-icon-row">
        <span className="design-mini-label">Alignment</span>
        <AlignmentButtons value={style.textAlign} onChange={(textAlign) => onPatch({ textAlign })} />
        <span className="design-mini-label"><Underline size={12} /> <Strikethrough size={12} /> <CaseUpper size={12} /></span>
      </div>
    </InspectorSection>

    <InspectorSection icon={<AlignJustify size={14} />} title="Paragraph" summary="Indents, spacing, hyphenation, tabs">
      <div className="design-grid">
        <Field label="First line"><NumberField value={style.firstLineIndent} min={-2} max={8} step={0.1} onChange={(firstLineIndent) => onPatch({ firstLineIndent })} suffix="em" /></Field>
        <Field label="Left indent"><NumberField value={style.leftIndent} min={0} max={8} step={0.1} onChange={(leftIndent) => onPatch({ leftIndent })} suffix="em" /></Field>
        <Field label="Right indent"><NumberField value={style.rightIndent} min={0} max={8} step={0.1} onChange={(rightIndent) => onPatch({ rightIndent })} suffix="em" /></Field>
        <Field label="Space before"><NumberField value={style.spaceBefore} min={0} max={4} step={0.05} onChange={(spaceBefore) => onPatch({ spaceBefore })} suffix="em" /></Field>
        <Field label="Space after"><NumberField value={style.spaceAfter} min={0} max={4} step={0.05} onChange={(spaceAfter) => onPatch({ spaceAfter })} suffix="em" /></Field>
        <Field label="Tab stops"><input value={style.tabs.map((tab) => tab.position).join(", ")} onChange={(event) => onPatch({ tabs: event.target.value.split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0).slice(0, 12).map((position) => ({ position, align: "left" as const })) })} placeholder="1.5, 3.25" /></Field>
      </div>
      <div className="design-inline-row">
        <Toggle checked={style.hyphenation} onChange={(hyphenation) => onPatch({ hyphenation })} label="Hyphenation" />
        <Toggle checked={style.keepWithNext} onChange={(keepWithNext) => onPatch({ keepWithNext })} label="Keep with next" />
      </div>
      <div className="design-grid">
        <Field label="Columns"><NumberField value={style.columns} min={1} max={4} onChange={(columns) => onPatch({ columns })} /></Field>
        <Field label="Column gap"><NumberField value={style.columnGap} min={0} max={4} step={0.1} onChange={(columnGap) => onPatch({ columnGap })} suffix="em" /></Field>
      </div>
      <div className="design-subgroup">
        <div className="design-subgroup-head"><strong>Drop cap</strong><Toggle checked={style.dropCap} onChange={(dropCap) => onPatch({ dropCap })} label={style.dropCap ? "On" : "Off"} /></div>
        {style.dropCap && <div className="design-grid">
          <Field label="Lines"><NumberField value={style.dropCapLines} min={2} max={6} onChange={(dropCapLines) => onPatch({ dropCapLines })} /></Field>
          <Field label="Gap"><NumberField value={style.dropCapGap} min={0} max={1} step={0.05} onChange={(dropCapGap) => onPatch({ dropCapGap })} suffix="em" /></Field>
          <Field label="Font" wide><select value={dropCapFont ? style.dropCapFontFamily : "custom"} onChange={(event) => onPatch({ dropCapFontFamily: event.target.value === "custom" ? "" : event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom font</option></select></Field>
          <Field label="Color" wide><ColorField value={style.dropCapColor} onChange={(dropCapColor) => onPatch({ dropCapColor })} /></Field>
        </div>}
      </div>
      <div className="design-subgroup">
        <div className="design-subgroup-head"><strong>Nested opening</strong><select className="design-mini-select" value={style.nestedStyle} onChange={(event) => onPatch({ nestedStyle: event.target.value as BookNestedStyle })}><option value="none">None</option><option value="small-caps">Small caps</option><option value="bold">Bold</option><option value="italic">Italic</option><option value="accent">Accent</option></select></div>
        {style.nestedStyle !== "none" && <div className="design-grid">
          <Field label="Words"><NumberField value={style.nestedWords} min={1} max={12} onChange={(nestedWords) => onPatch({ nestedWords })} /></Field>
          <Field label="Font"><select value={nestedFont ? style.nestedFontFamily : "custom"} onChange={(event) => onPatch({ nestedFontFamily: event.target.value === "custom" ? "" : event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom font</option></select></Field>
          <Field label="Color" wide><ColorField value={style.nestedColor} onChange={(nestedColor) => onPatch({ nestedColor })} /></Field>
        </div>}
      </div>
    </InspectorSection>

    <InspectorSection icon={<Frame size={14} />} title="Rules & shading" summary="Paragraph rules, border, background">
      <RuleControls title="Rule above" rule={style.ruleAbove} onChange={(patch) => onPatch({ ruleAbove: { ...style.ruleAbove, ...patch } })} />
      <RuleControls title="Rule below" rule={style.ruleBelow} onChange={(patch) => onPatch({ ruleBelow: { ...style.ruleBelow, ...patch } })} />
      <div className="design-subgroup">
        <div className="design-subgroup-head"><strong>Paragraph border</strong><Toggle checked={style.border.enabled} onChange={(enabled) => onPatch({ border: { ...style.border, enabled } })} label={style.border.enabled ? "On" : "Off"} /></div>
        {style.border.enabled && <div className="design-grid">
          <Field label="Weight"><NumberField value={style.border.width} min={0} max={8} step={0.25} onChange={(width) => onPatch({ border: { ...style.border, width } })} suffix="px" /></Field>
          <Field label="Style"><select value={style.border.style} onChange={(event) => onPatch({ border: { ...style.border, style: event.target.value as BookRuleStyle } })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="double">Double</option></select></Field>
          <Field label="Padding"><NumberField value={style.border.padding} min={0} max={4} step={0.1} onChange={(padding) => onPatch({ border: { ...style.border, padding } })} suffix="em" /></Field>
          <Field label="Radius"><NumberField value={style.border.radius} min={0} max={40} onChange={(radius) => onPatch({ border: { ...style.border, radius } })} suffix="px" /></Field>
          <Field label="Color" wide><ColorField value={style.border.color} onChange={(color) => onPatch({ border: { ...style.border, color } })} /></Field>
        </div>}
      </div>
      <div className="design-subgroup">
        <div className="design-subgroup-head"><strong>Paragraph shading</strong><Toggle checked={style.shading.enabled} onChange={(enabled) => onPatch({ shading: { ...style.shading, enabled } })} label={style.shading.enabled ? "On" : "Off"} /></div>
        {style.shading.enabled && <ColorField value={style.shading.color} onChange={(color) => onPatch({ shading: { ...style.shading, color } })} />}
      </div>
    </InspectorSection>

    <InspectorSection icon={<ListOrdered size={14} />} title="Bullets, numbering & GREP" summary="Markers, patterns, inline emphasis">
      <div className="design-subgroup">
        <div className="design-subgroup-head"><strong>Bullets & numbering</strong><Toggle checked={style.bullets.enabled} onChange={(enabled) => onPatch({ bullets: { ...style.bullets, enabled } })} label={style.bullets.enabled ? "On" : "Off"} /></div>
        {style.bullets.enabled && <div className="design-grid">
          <Field label="Type"><select value={style.bullets.type} onChange={(event) => onPatch({ bullets: { ...style.bullets, type: event.target.value as BookBulletType } })}><option value="bullet">Bullet</option><option value="number">Number</option></select></Field>
          <Field label="Marker"><input value={style.bullets.marker} onChange={(event) => onPatch({ bullets: { ...style.bullets, marker: event.target.value.slice(0, 4) } })} placeholder="•" /></Field>
          <Field label="Indent"><NumberField value={style.bullets.indent} min={0} max={8} step={0.1} onChange={(indent) => onPatch({ bullets: { ...style.bullets, indent } })} suffix="em" /></Field>
        </div>}
      </div>
      <div className="design-subgroup">
        <div className="design-subgroup-head"><strong>GREP style</strong><Toggle checked={style.grep.enabled} onChange={(enabled) => onPatch({ grep: { ...style.grep, enabled } })} label={style.grep.enabled ? "On" : "Off"} /></div>
        {style.grep.enabled && <div className="design-grid">
          <Field label="Pattern" wide><input value={style.grep.pattern} onChange={(event) => onPatch({ grep: { ...style.grep, pattern: event.target.value } })} placeholder="\\b[A-Z]{2,}\\b" /></Field>
          <Field label="Style"><select value={style.grep.style} onChange={(event) => onPatch({ grep: { ...style.grep, style: event.target.value as BookGrepStyle } })}><option value="none">None</option><option value="bold">Bold</option><option value="italic">Italic</option><option value="accent">Accent</option><option value="small-caps">Small caps</option></select></Field>
          <Field label="Color" wide><ColorField value={style.grep.color} onChange={(color) => onPatch({ grep: { ...style.grep, color } })} /></Field>
        </div>}
      </div>
    </InspectorSection>
  </div>;
}

function StyleLibrary({ layout, context, onLayoutChange, onReplaceRange }: { layout: BookLayout; context: EditorContext; onLayoutChange: (change: (layout: BookLayout) => BookLayout) => void; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const role = context.role;
  const isText = Boolean(role && context.kind !== "none" && context.kind !== "title");
  const [browseOpen, setBrowseOpen] = useState(false);
  const activeId = context.presentation?.styleId;
  const activePreset = layout.paragraphStyles.find((style) => style.id === activeId) ?? null;

  const applyStyle = (styleId?: string) => {
    if (!isText || !context.presentation) return;
    onReplaceRange(context.start, context.end, canvasTextSource(context.source, { ...context.presentation, styleId }));
  };
  const createStyle = () => {
    const base = activePreset ?? (role ? { id: "base", name: "Base", style: styleFromRole(layout, role) } : null);
    if (!base) return;
    const id = uniqueStyleId(layout, "custom-style");
    const preset = cloneParagraphStyle(base, id, "Untitled paragraph style");
    onLayoutChange((current) => ({ ...current, paragraphStyles: [...current.paragraphStyles, preset] }));
    applyStyle(id);
  };
  const duplicateStyle = (preset: BookParagraphStyle) => {
    const id = uniqueStyleId(layout, `${preset.id}-copy`);
    const copy = cloneParagraphStyle(preset, id, `${preset.name} copy`);
    onLayoutChange((current) => ({ ...current, paragraphStyles: [...current.paragraphStyles, copy] }));
    applyStyle(id);
  };
  const deleteStyle = (preset: BookParagraphStyle) => {
    if (activeId === preset.id) applyStyle(undefined);
    onLayoutChange((current) => ({ ...current, paragraphStyles: current.paragraphStyles.filter((style) => style.id !== preset.id) }));
  };
  const renameStyle = (preset: BookParagraphStyle, name: string) => {
    onLayoutChange((current) => ({ ...current, paragraphStyles: current.paragraphStyles.map((style) => style.id === preset.id ? { ...style, name } : style) }));
  };

  return <div className="design-style-library">
    <div className="design-style-library-head"><div><strong>Paragraph style</strong><small>Applied to this text box</small></div><button className="design-add-style" onClick={createStyle} disabled={!role} title="Create a style from the current selection"><Plus size={13} /> New</button></div>
    <label className="design-style-select">
      <Palette size={13} />
      <select value={activeId ?? ""} onChange={(event) => applyStyle(event.target.value || undefined)} disabled={!isText} aria-label="Paragraph style">
        <option value="">Role default</option>
        {layout.paragraphStyles.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
      </select>
    </label>
    <div className="design-style-library-actions">
      <button className="design-browse-styles" onClick={() => setBrowseOpen((value) => !value)} aria-expanded={browseOpen}><Palette size={12} /> {browseOpen ? "Hide style cards" : "Browse style cards"}</button>
      {activePreset && <>
        <input key={activePreset.id} className="design-style-name" defaultValue={activePreset.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== activePreset.name) renameStyle(activePreset, name); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label="Style name" />
        <button onClick={() => duplicateStyle(activePreset)} title="Duplicate style"><Copy size={13} /></button>
        <button className="danger" onClick={() => deleteStyle(activePreset)} title="Delete style" disabled={layout.paragraphStyles.length <= 1}><Trash2 size={13} /></button>
      </>}
    </div>
    {browseOpen && <div className="design-style-list">
      <button className={`design-style-card ${!activeId ? "active" : ""}`} onClick={() => applyStyle(undefined)} disabled={!isText}>
        <span className="design-style-aa" style={{ fontFamily: fontCss(layout.typography[role ?? "paragraph"].fontFamily) }}>Aa</span>
        <span><strong>Role default</strong><small>{role ? `${layout.typography[role].fontSize}pt base style` : "No text selected"}</small></span>
      </button>
      {layout.paragraphStyles.map((preset) => {
        const sampleColor = styleColor(preset.style.color);
        return <button key={preset.id} className={`design-style-card ${activeId === preset.id ? "active" : ""}`} onClick={() => applyStyle(preset.id)} disabled={!isText}>
          <span className="design-style-aa" style={{ fontFamily: fontCss(preset.style.fontFamily), fontSize: `${Math.max(13, Math.min(22, preset.style.fontSize))}px`, fontWeight: preset.style.fontWeight, fontStyle: preset.style.fontStyle, color: sampleColor === "inherit" ? undefined : sampleColor }}>Aa</span>
          <span><strong>{preset.name}</strong><small>{preset.style.fontFamily} · {preset.style.fontSize}pt · {preset.style.textAlign}</small></span>
          {activeId === preset.id && <i className="design-style-active-dot" aria-hidden="true" />}
        </button>;
      })}
    </div>}
  </div>;
}

function FrameControls({ context, freeLayout, onReplaceRange }: { context: EditorContext; freeLayout: boolean; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const presentation = context.presentation ?? DEFAULT_RICH_PRESENTATION;
  const isText = context.kind === "paragraph" || context.kind === "heading" || context.kind === "quote";
  if (!isText) return null;
  const update = (patch: Partial<RichPresentation>) => onReplaceRange(context.start, context.end, canvasTextSource(context.source, { ...presentation, ...patch }));
  const left = richPresentationLeft(presentation);
  return <InspectorSection icon={<Move size={14} />} title="Frame & position" summary={`${Math.round(left)}% left · ${presentation.width}% wide`}>
    <div className="design-grid">
      <Field label="X position"><NumberField value={left} min={0} max={Math.max(0, 100 - presentation.width)} step={0.5} onChange={(x) => update({ x })} suffix="%" /></Field>
      <Field label="Y position"><NumberField value={presentation.y ?? 0} min={0} max={400} step={0.5} onChange={(y) => update({ y })} suffix="%" /></Field>
      <Field label="Width"><NumberField value={presentation.width} min={20} max={100} step={0.5} onChange={(width) => update({ width, x: Math.min(left, 100 - width) })} suffix="%" /></Field>
      <Field label="Placement"><PlacementButtons value={presentation.align} onChange={(align) => update({ align, x: undefined })} /></Field>
    </div>
    {!freeLayout && <p className="design-help">Enable Free layout in the canvas bar to place this frame vertically anywhere on the artboard.</p>}
    {freeLayout && <p className="design-help">Position is measured from the top-left of the safe content area. Y uses the page content width as its unit.</p>}
  </InspectorSection>;
}

function ImageInspector({ context, freeLayout, onReplaceRange, onReplaceImage }: { context: EditorContext; freeLayout: boolean; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void; onReplaceImage?: () => void }) {
  const image = context.image;
  if (!image) return null;
  const presentation = image.presentation;
  const update = (patch: Partial<ImagePresentation>) => {
    const next = { ...presentation, ...patch };
    if (patch.align !== undefined && patch.x === undefined) next.x = undefined;
    if (next.x !== undefined) next.x = Math.max(0, Math.min(100 - next.width, next.x));
    onReplaceRange(context.start, context.end, `${image.indent}${imageMarkdown(image.alt, image.source, next)}`);
  };
  const updateAlt = (alt: string) => onReplaceRange(context.start, context.end, `${image.indent}${imageMarkdown(alt, image.source, presentation)}`);
  const left = richPresentationLeft({ width: presentation.width, align: presentation.align, x: presentation.x });
  return <div className="design-editor">
    <InspectorSection icon={<ImagePlus size={14} />} title="Artwork" summary="Crop, fit, frame, effects" defaultOpen>
      <div className="design-inline-actions"><button onClick={onReplaceImage}><ImagePlus size={13} /> Replace image</button><span className="design-mini-label">{presentation.width}% × {presentation.height ?? "auto"}</span></div>
      <div className="design-grid">
        <Field label="Shape"><select value={presentation.aspect} onChange={(event) => update({ aspect: event.target.value as ImagePresentation["aspect"], ...(event.target.value === "auto" ? {} : { fit: "cover" as const }) })}><option value="auto">Original</option><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="wide">Wide</option></select></Field>
        <Field label="Crop fit"><select value={presentation.fit} onChange={(event) => update({ fit: event.target.value as ImagePresentation["fit"] })}><option value="contain">Fit inside</option><option value="cover">Fill frame</option></select></Field>
        <Field label="Width"><NumberField value={presentation.width} min={10} max={100} step={0.5} onChange={(width) => update({ width, x: Math.min(left, 100 - width) })} suffix="%" /></Field>
        <Field label="Height"><NumberField value={presentation.height ?? 0} min={0} max={240} step={0.5} onChange={(height) => update({ height: height || undefined })} suffix="%" /></Field>
        <Field label="X position"><NumberField value={left} min={0} max={Math.max(0, 100 - presentation.width)} step={0.5} onChange={(x) => update({ x })} suffix="%" /></Field>
        <Field label="Y position"><NumberField value={presentation.y ?? 0} min={0} max={400} step={0.5} onChange={(y) => update({ y })} suffix="%" /></Field>
        <Field label="Corner radius"><NumberField value={presentation.cornerRadius ?? 0} min={0} max={120} step={1} onChange={(cornerRadius) => update({ cornerRadius: cornerRadius || undefined })} suffix="px" /></Field>
        <Field label="Opacity"><NumberField value={Math.round((presentation.opacity ?? 1) * 100)} min={5} max={100} step={1} onChange={(opacity) => update({ opacity: opacity / 100 })} suffix="%" /></Field>
        <Field label="Rotation"><NumberField value={presentation.rotation ?? 0} min={-180} max={180} step={1} onChange={(rotation) => update({ rotation: rotation || undefined })} suffix="°" /></Field>
        <Field label="Shadow"><select value={presentation.shadow ?? "none"} onChange={(event) => update({ shadow: event.target.value as ImagePresentation["shadow"] })}><option value="none">None</option><option value="soft">Soft</option><option value="medium">Medium</option><option value="strong">Strong</option></select></Field>
      </div>
      <div className="design-grid">
        <Field label="Border"><select value={presentation.borderStyle ?? "solid"} onChange={(event) => update({ borderStyle: event.target.value as ImagePresentation["borderStyle"] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></Field>
        <Field label="Border width"><NumberField value={presentation.borderWidth ?? 0} min={0} max={20} step={0.5} onChange={(borderWidth) => update({ borderWidth: borderWidth || undefined })} suffix="px" /></Field>
        <Field label="Border color" wide><ColorField value={presentation.borderColor ?? "#a56b3e"} onChange={(borderColor) => update({ borderColor })} /></Field>
      </div>
      <div className="design-inline-row"><Toggle checked={Boolean(presentation.caption)} onChange={(checked) => update({ caption: checked ? presentation.caption || "Add a caption" : "" })} label="Visible caption" /></div>
      {presentation.caption && <Field label="Caption" wide><input value={presentation.caption} onChange={(event) => update({ caption: event.target.value })} /></Field>}
      <Field label="Alt text" wide><input value={image.alt} onChange={(event) => updateAlt(event.target.value)} /></Field>
      <div className="design-grid"><Field label="Placement"><PlacementButtons value={presentation.align} onChange={(align) => update({ align, x: undefined })} /></Field><Field label="Frame"><select value={presentation.frame} onChange={(event) => update({ frame: event.target.value as ImagePresentation["frame"] })}><option value="none">No frame</option><option value="hairline">Hairline</option><option value="mat">Gallery mat</option></select></Field></div>
      {!freeLayout && <p className="design-help">Free layout adds vertical artwork placement on the artboard.</p>}
      <p className="design-help">Height and Y position use the page content width as their unit, so artwork scales with the book.</p>
    </InspectorSection>
  </div>;
}

function TableInspector({ context, onReplaceRange }: { context: EditorContext; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const lines = context.tableLines ?? [];
  const options = context.tableOptions ?? { caption: "", align: "left" as TableAlign, striped: false, compact: false, width: 100 };
  const rewrite = (nextLines = lines, nextOptions = options) => onReplaceRange(context.start, context.end, tableBlockText(nextLines, nextOptions));
  const columnCount = Math.max(1, splitTableCells(lines[0] ?? "").length);
  const editableRows = lines.length >= 2 && tableSeparator(lines[1]) ? lines.map((line, rowIndex) => ({ line, rowIndex })).filter((row) => row.rowIndex !== 1) : [];
  return <InspectorSection icon={<Table2 size={14} />} title="Data table" summary="Rows, columns, presentation" defaultOpen>
    <div className="design-grid">
      <Field label="Caption" wide><input value={options.caption} onChange={(event) => rewrite(lines, { ...options, caption: event.target.value })} placeholder="Optional table caption" /></Field>
      <Field label="Placement"><select value={options.align} onChange={(event) => rewrite(lines, { ...options, align: event.target.value as TableAlign, x: undefined })}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></Field>
      <Field label="Width"><NumberField value={options.width} min={20} max={100} step={1} onChange={(width) => rewrite(lines, { ...options, width, x: options.x !== undefined ? Math.min(options.x, 100 - width) : undefined })} suffix="%" /></Field>
    </div>
    <div className="design-inline-row"><Toggle checked={options.striped} onChange={(striped) => rewrite(lines, { ...options, striped })} label="Striped rows" /><Toggle checked={options.compact} onChange={(compact) => rewrite(lines, { ...options, compact })} label="Compact" /></div>
    {editableRows.length > 0 && <div className="design-table-editor-wrap"><div className="design-subgroup-head"><strong>Data grid</strong><small>{editableRows.length - 1} data {editableRows.length - 1 === 1 ? "row" : "rows"}</small></div><div className="design-table-editor" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(70px, 1fr))` }}>{editableRows.flatMap(({ line, rowIndex }) => splitTableCells(line).slice(0, columnCount).map((cell, columnIndex) => <input key={`${rowIndex}-${columnIndex}`} className={rowIndex === 0 ? "header" : ""} value={cell} onChange={(event) => rewrite(updateTableCell(lines, rowIndex, columnIndex, event.target.value))} aria-label={`${rowIndex === 0 ? "Header" : `Row ${rowIndex}`} column ${columnIndex + 1}`} />))}</div></div>}
    <div className="design-button-grid"><button onClick={() => rewrite(addTableRow(lines))}><Rows3 size={13} /> Add row</button><button onClick={() => rewrite(addTableColumn(lines))}><Columns3 size={13} /> Add column</button><button onClick={() => rewrite(removeTableRow(lines))} disabled={lines.length <= 2}><Rows3 size={13} /> Remove row</button><button onClick={() => rewrite(removeTableColumn(lines))} disabled={splitTableCells(lines[0] ?? "").length <= 1}><Columns3 size={13} /> Remove column</button></div>
  </InspectorSection>;
}

function ChartInspector({ context, onReplaceRange }: { context: EditorContext; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const data = context.chart ?? defaultChartData();
  const update = (patch: Partial<ChartData>) => onReplaceRange(context.start, context.end, chartBlockText({ ...data, ...patch }));
  const updateSeries = (series: ChartData["series"]) => update({ series });
  const addPoint = () => update({ labels: [...data.labels, `Item ${data.labels.length + 1}`], series: data.series.map((series) => ({ ...series, values: [...series.values, 0] })) });
  const removePoint = () => data.labels.length > 1 && update({ labels: data.labels.slice(0, -1), series: data.series.map((series) => ({ ...series, values: series.values.slice(0, -1) })) });
  const addSeries = () => update({ series: [...data.series, { name: `Series ${data.series.length + 1}`, values: data.labels.map(() => 0) }], showLegend: true });
  const removeSeries = () => data.series.length > 1 && updateSeries(data.series.slice(0, -1));
  return <InspectorSection icon={<BarChart3 size={14} />} title="Chart / graph" summary="Data, palette, display" defaultOpen>
    <div className="design-grid">
      <Field label="Type"><select value={data.type} onChange={(event) => update({ type: event.target.value as ChartKind })}><option value="bar">Bar chart</option><option value="line">Line graph</option><option value="area">Area graph</option><option value="donut">Donut chart</option><option value="stat">Single stat</option></select></Field>
      <Field label="Palette"><select value={data.palette} onChange={(event) => update({ palette: event.target.value as ChartPalette })}>{CHART_PALETTE_NAMES.map((palette) => <option key={palette} value={palette}>{palette[0].toUpperCase() + palette.slice(1)}</option>)}</select></Field>
      <Field label="Title" wide><input value={data.title} onChange={(event) => update({ title: event.target.value })} placeholder="Chart title" /></Field>
      <Field label="Subtitle" wide><input value={data.subtitle} onChange={(event) => update({ subtitle: event.target.value })} placeholder="A short explanation" /></Field>
      <Field label="Placement"><select value={data.align} onChange={(event) => update({ align: event.target.value as RichAlign, x: undefined })}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></Field>
      <Field label="Width"><NumberField value={data.width} min={20} max={100} step={1} onChange={(width) => update({ width, x: data.x !== undefined ? Math.min(data.x, 100 - width) : undefined })} suffix="%" /></Field>
    </div>
    <div className="design-inline-row"><Toggle checked={data.showLegend} onChange={(showLegend) => update({ showLegend })} label="Legend" /><Toggle checked={data.showGrid} onChange={(showGrid) => update({ showGrid })} label="Grid" /></div>
    <div className="design-subgroup-head"><strong>Data points</strong><div><button onClick={addPoint}><Plus size={12} /> Point</button><button onClick={removePoint} disabled={data.labels.length <= 1}><Minus size={12} /> Point</button></div></div>
    <div className="design-chart-grid" style={{ gridTemplateColumns: `minmax(70px, 1.1fr) repeat(${data.series.length}, minmax(46px, 1fr))` }}><strong>Label</strong>{data.series.map((series, index) => <input key={`name-${index}`} value={series.name} onChange={(event) => updateSeries(data.series.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} aria-label={`Series ${index + 1} name`} />)}{data.labels.map((label, labelIndex) => <Fragment key={`point-${labelIndex}`}><input value={label} onChange={(event) => update({ labels: data.labels.map((item, index) => index === labelIndex ? event.target.value : item) })} aria-label={`Point ${labelIndex + 1} label`} />{data.series.map((series, seriesIndex) => <input key={`${labelIndex}-${seriesIndex}`} type="number" value={series.values[labelIndex] ?? 0} onChange={(event) => updateSeries(data.series.map((item, index) => index === seriesIndex ? { ...item, values: item.values.map((value, pointIndex) => pointIndex === labelIndex ? Number(event.target.value) || 0 : value) } : item))} aria-label={`${series.name} value for ${label}`} />)}</Fragment>)}</div>
    <div className="design-button-grid"><button onClick={addSeries}><Plus size={13} /> Add series</button><button onClick={removeSeries} disabled={data.series.length <= 1}><Trash2 size={13} /> Remove series</button></div>
  </InspectorSection>;
}

function CalloutInspector({ context, onReplaceRange }: { context: EditorContext; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const body = context.blockBody ?? "";
  const parsed = richJsonLine(body);
  const options = objectValue(parsed.value) ? parsed.value : {};
  const title = typeof options.title === "string" ? options.title : "Note";
  const tone = typeof options.tone === "string" ? options.tone : "note";
  const presentation = context.calloutPresentation ?? richPresentationFromValue(options);
  const content = body.split(/\r?\n/).filter((_line, index) => index !== parsed.index).join("\n");
  const update = (nextTitle = title, nextTone = tone, nextContent = content, nextPresentation = presentation) => onReplaceRange(context.start, context.end, calloutBlockText(nextTitle, nextTone, nextContent, nextPresentation));
  return <InspectorSection icon={<Quote size={14} />} title="Callout" summary="Label, tone, copy" defaultOpen>
    <div className="design-grid">
      <Field label="Label"><input value={title} onChange={(event) => update(event.target.value)} /></Field>
      <Field label="Tone"><select value={tone} onChange={(event) => update(title, event.target.value)}><option value="note">Note</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="quote">Quote</option></select></Field>
      <Field label="Placement"><select value={presentation.align} onChange={(event) => update(title, tone, content, { ...presentation, align: event.target.value as RichAlign, x: undefined })}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></Field>
      <Field label="Width"><NumberField value={presentation.width} min={20} max={100} step={1} onChange={(width) => update(title, tone, content, { ...presentation, width, x: presentation.x !== undefined ? Math.min(presentation.x, 100 - width) : undefined })} suffix="%" /></Field>
    </div>
    <Field label="Callout copy" wide><textarea rows={5} value={content} onChange={(event) => update(title, tone, event.target.value)} /></Field>
  </InspectorSection>;
}

function PageColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <span className="design-page-color"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Page color" /><input value={value} onChange={(event) => onChange(event.target.value)} aria-label="Page color hex value" /></span>;
}

function DocumentPanel({ layout, onLayoutChange }: { layout: BookLayout; onLayoutChange: (change: (layout: BookLayout) => BookLayout) => void }) {
  const styles = layout.paragraphStyles;
  return <div className="design-editor">
    <div className="design-empty-hero"><Sparkles size={18} /><strong>Select something on the page</strong><span>Choose a text box, image, table, chart, or callout to open its design controls. With nothing selected, tune the page itself.</span></div>
    <InspectorSection icon={<PaintBucket size={14} />} title="Page appearance" summary="Paper color and document accent" defaultOpen>
      <Field label="Page background" wide><PageColorField value={layout.pageColor} onChange={(pageColor) => onLayoutChange((current) => ({ ...current, pageColor }))} /></Field>
      <div className="design-color-presets" aria-label="Page background presets">
        {([["White", "#ffffff"], ["Ivory", "#fffaf3"], ["Warm paper", "#f3eadc"], ["Slate", "#22201d"]] as const).map(([label, color]) => <button key={label} style={{ background: color }} onClick={() => onLayoutChange((current) => ({ ...current, pageColor: color }))} title={`${label} page background`} aria-label={`${label} page background`} />)}
      </div>
      <Field label="Document accent" wide><PageColorField value={layout.accentColor} onChange={(accentColor) => onLayoutChange((current) => ({ ...current, accentColor }))} /></Field>
      <div className="design-color-presets" aria-label="Document accent presets">
        {([["Editorial", "#a56b3e"], ["Ink", "#29231e"], ["Botanical", "#6f7f6d"], ["Berry", "#874e47"], ["Ocean", "#486777"]] as const).map(([label, color]) => <button key={label} style={{ background: color }} onClick={() => onLayoutChange((current) => ({ ...current, accentColor: color }))} title={`${label} document accent`} aria-label={`${label} document accent`} />)}
      </div>
      <p className="design-help">Page background and document accent are separate from the cover color. The editor chrome follows the app appearance instead.</p>
    </InspectorSection>
    <InspectorSection icon={<Frame size={14} />} title="Page margins" summary={`${layout.pageMargins.top} / ${layout.pageMargins.right} / ${layout.pageMargins.bottom} / ${layout.pageMargins.left} in`}>
      <div className="design-grid">
        {(["top", "right", "bottom", "left"] as const).map((side) => <Field key={side} label={side[0].toUpperCase() + side.slice(1)}><NumberField value={layout.pageMargins[side]} min={0.2} max={3} step={0.05} onChange={(value) => onLayoutChange((current) => ({ ...current, pageMargins: { ...current.pageMargins, [side]: value } }))} suffix="in" /></Field>)}
      </div>
      <div className="design-margin-presets" role="group" aria-label="Page margin presets">
        {([["Tight", 0.5], ["Standard", 1], ["Wide", 1.5]] as const).map(([label, value]) => <button key={label} onClick={() => onLayoutChange((current) => ({ ...current, pageMargins: { top: value, right: value, bottom: value, left: value } }))}>{label}<small>{value} in</small></button>)}
      </div>
    </InspectorSection>
    <InspectorSection icon={<Palette size={14} />} title="Document styles" summary={`${styles.length} paragraph presets`} defaultOpen>
      <div className="design-style-list compact">
        {styles.map((preset) => <div key={preset.id} className="design-style-card static"><span className="design-style-aa" style={{ fontFamily: fontCss(preset.style.fontFamily), fontWeight: preset.style.fontWeight, fontStyle: preset.style.fontStyle }}>Aa</span><span><strong>{preset.name}</strong><small>{preset.style.fontFamily} · {preset.style.fontSize}pt</small></span></div>)}
      </div>
      <p className="design-help">Apply a style to a text box from the floating quick bar or the style library above. Style edits are shared by every text box using that preset.</p>
    </InspectorSection>
    <InspectorSection icon={<BookOpen size={14} />} title="Role typography" summary="Fallback styles for each text role">
      <div className="design-role-list">
        {(["title", "heading1", "heading2", "heading3", "paragraph", "quote"] as BookTextRole[]).map((role) => <div key={role} className="design-role-row"><span style={{ fontFamily: fontCss(layout.typography[role].fontFamily), fontWeight: layout.typography[role].fontWeight }}>{role === "paragraph" ? "Body" : role === "quote" ? "Quote" : role === "title" ? "Title" : `Heading ${role.slice(-1)}`}</span><small>{layout.typography[role].fontSize}pt · {layout.typography[role].textAlign}</small></div>)}
      </div>
      <div className="design-button-grid"><button onClick={() => onLayoutChange((current) => ({ ...current, typography: { ...current.typography, paragraph: { ...DEFAULT_BOOK_TYPOGRAPHY.paragraph } } }))}><Type size={13} /> Reset body role</button></div>
    </InspectorSection>
  </div>;
}

export function BooksInspector({ context, layout, freeLayout, onLayoutChange, onReplaceRange, onMoveRange, onDeleteRange, onDuplicateRange, onBringToFront, onSendToBack, onReplaceImage, onInlineFormat, onConvertRole, chapterWords, totalWords, wordGoal }: { context: EditorContext; layout: BookLayout; freeLayout: boolean; onLayoutChange: (change: (layout: BookLayout) => BookLayout) => void; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void; onMoveRange: (start: number, end: number, direction: -1 | 1) => void; onDeleteRange: (start: number, end: number, restoreFocus?: HTMLElement | null) => void; onDuplicateRange: (start: number, end: number) => void; onBringToFront?: () => void; onSendToBack?: () => void; onReplaceImage?: () => void; onInlineFormat?: (prefix: string, suffix?: string) => void; onConvertRole?: (level: number) => void; chapterWords: number; totalWords: number; wordGoal: number }) {
  const role = context.role;
  const roleStyle = role ? layout.typography[role] : null;
  const activePreset = context.presentation?.styleId ? layout.paragraphStyles.find((preset) => preset.id === context.presentation?.styleId) ?? null : null;
  const editingStyle = activePreset?.style ?? roleStyle;
  const goalProgress = Math.min(100, Math.round((totalWords / Math.max(1, wordGoal)) * 100));
  const isText = context.kind === "paragraph" || context.kind === "heading" || context.kind === "quote";

  const patchStyle = (patch: Partial<BookTextStyle>) => {
    if (!role) return;
    if (activePreset) {
      onLayoutChange((current) => ({
        ...current,
        paragraphStyles: current.paragraphStyles.map((preset) => preset.id === activePreset.id ? { ...preset, style: { ...preset.style, ...patch } } : preset),
      }));
    } else {
      onLayoutChange((current) => ({
        ...current,
        typography: { ...current.typography, [role]: { ...current.typography[role], ...patch } },
      }));
    }
  };

  const deleteStyle = () => {
    if (!activePreset) return;
    if (context.presentation) onReplaceRange(context.start, context.end, canvasTextSource(context.source, { ...context.presentation, styleId: undefined }));
    onLayoutChange((current) => ({ ...current, paragraphStyles: current.paragraphStyles.filter((preset) => preset.id !== activePreset.id) }));
  };
  const duplicateStyle = () => {
    if (!activePreset) return;
    const id = uniqueStyleId(layout, `${activePreset.id}-copy`);
    const copy = cloneParagraphStyle(activePreset, id, `${activePreset.name} copy`);
    onLayoutChange((current) => ({ ...current, paragraphStyles: [...current.paragraphStyles, copy] }));
    if (context.presentation) onReplaceRange(context.start, context.end, canvasTextSource(context.source, { ...context.presentation, styleId: id }));
  };

  return <aside className="books-editor-inspector design-inspector">
    <div className="design-inspector-head">
      <div><span className="design-overline"><SlidersHorizontal size={12} /> Design inspector</span><strong>{context.kind === "none" ? "Page & styles" : context.label}</strong></div>
      <span className={`design-kind ${context.kind}`}>{context.kind === "none" ? "document" : context.kind}</span>
    </div>
    {context.kind !== "none" && context.kind !== "title" && <div className="design-element-actions">
      <button onClick={() => onMoveRange(context.start, context.end, -1)} aria-label="Move earlier" title="Move earlier"><ArrowUp size={14} /></button>
      <button onClick={() => onMoveRange(context.start, context.end, 1)} aria-label="Move later" title="Move later"><ArrowDown size={14} /></button>
      {freeLayout && <><button onClick={onSendToBack} aria-label="Send to back" title="Send to back"><SendToBack size={14} /></button><button onClick={onBringToFront} aria-label="Bring to front" title="Bring to front"><BringToFront size={14} /></button></>}
      <button onClick={() => onDuplicateRange(context.start, context.end)} aria-label="Duplicate" title="Duplicate"><Copy size={14} /></button>
      <button className="delete" onClick={(event) => onDeleteRange(context.start, context.end, event.currentTarget)} aria-label="Delete" title="Delete"><Trash2 size={14} /></button>
    </div>}
    {context.kind === "none" ? <DocumentPanel layout={layout} onLayoutChange={onLayoutChange} /> : <>
      {isText && <StyleLibrary layout={layout} context={context} onLayoutChange={onLayoutChange} onReplaceRange={onReplaceRange} />}
      {(isText || context.kind === "title") && editingStyle && <TextStyleEditor style={editingStyle} preset={context.kind === "title" ? null : activePreset} role={role} showInlineFormatting={isText} onPatch={patchStyle} onInlineFormat={onInlineFormat} onConvertRole={onConvertRole} onDelete={deleteStyle} onDuplicate={duplicateStyle} />}
      {isText && <FrameControls context={context} freeLayout={freeLayout} onReplaceRange={onReplaceRange} />}
      {context.kind === "image" && <ImageInspector context={context} freeLayout={freeLayout} onReplaceRange={onReplaceRange} onReplaceImage={onReplaceImage} />}
      {context.kind === "table" && <TableInspector context={context} onReplaceRange={onReplaceRange} />}
      {context.kind === "chart" && <ChartInspector context={context} onReplaceRange={onReplaceRange} />}
      {context.kind === "callout" && <CalloutInspector context={context} onReplaceRange={onReplaceRange} />}
      <InspectorSection icon={<BookOpen size={14} />} title="Chapter pulse" summary={`${chapterWords.toLocaleString()} words`} defaultOpen={false}>
        <div className="design-pulse"><strong>{chapterWords.toLocaleString()}</strong><span>words in this section</span><div className="design-goal-track"><span style={{ width: `${goalProgress}%` }} /></div><div className="design-goal-meta"><span>{totalWords.toLocaleString()} total</span><span>{goalProgress}% of goal</span></div></div>
      </InspectorSection>
    </>}
  </aside>;
}
