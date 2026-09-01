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
  ChevronRight,
  Columns3,
  ImagePlus,
  Minus,
  Plus,
  Quote,
  Rows3,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  Type,
} from "lucide-react";
import type { BookLayout, BookNestedStyle, BookTextAlign, BookTextRole, BookTextStyle } from "../lib/bookLayout";
import {
  addTableColumn,
  addTableRow,
  canvasTextSource,
  calloutBlockText,
  chartBlockText,
  CHART_PALETTE_NAMES,
  defaultChartData,
  DEFAULT_RICH_PRESENTATION,
  FONT_OPTIONS,
  imageMarkdown,
  objectValue,
  richJsonLine,
  richPresentationFromValue,
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

function InspectorDisclosure({ icon, title, summary, children, defaultOpen = true }: { icon: ReactNode; title: string; summary?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`books-inspector-disclosure ${open ? "open" : ""}`}>
      <button className="books-inspector-disclosure-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="books-inspector-disclosure-icon">{icon}</span>
        <span className="books-inspector-disclosure-title"><strong>{title}</strong>{summary && <small>{summary}</small>}</span>
        <ChevronRight size={13} />
      </button>
      {open && <div className="books-inspector-disclosure-content">{children}</div>}
    </section>
  );
}

function typographyRoleLabel(role: BookTextRole) {
  if (role === "title") return "Section title";
  if (role === "paragraph") return "Paragraph";
  if (role === "quote") return "Quote";
  return `Heading ${role.replace("heading", "")}`;
}

function TypographyControls({ style, onChange }: { style: BookTextStyle; onChange: (patch: Partial<BookTextStyle>) => void }) {
  const preset = FONT_OPTIONS.some((option) => option.value === style.fontFamily);
  const alignments: { value: BookTextAlign; label: string; icon: ReactNode }[] = [
    { value: "left", label: "Align left", icon: <AlignLeft size={13} /> },
    { value: "center", label: "Align center", icon: <AlignCenter size={13} /> },
    { value: "right", label: "Align right", icon: <AlignRight size={13} /> },
    { value: "justify", label: "Justify", icon: <AlignJustify size={13} /> },
  ];
  return (
    <div className="books-inspector-form">
      <label>Font family<select value={preset ? style.fontFamily : "custom"} onChange={(event) => onChange({ fontFamily: event.target.value === "custom" ? (preset ? "" : style.fontFamily) : event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom font stack</option></select></label>
      {(!preset || style.fontFamily === "") && <label>Custom stack<input value={style.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })} placeholder="Baskerville, Georgia, serif" /></label>}
      <div className="books-inspector-two-up"><label>Size<input type="number" min="6" max="96" step="0.5" value={style.fontSize} onChange={(event) => onChange({ fontSize: Math.min(96, Math.max(6, Number(event.target.value) || 6)) })} /></label><label>Weight<select value={style.fontWeight} onChange={(event) => onChange({ fontWeight: Number(event.target.value) })}><option value={300}>Light</option><option value={400}>Regular</option><option value={500}>Medium</option><option value={600}>Semibold</option><option value={700}>Bold</option><option value={800}>Heavy</option></select></label></div>
      <div className="books-inspector-two-up"><label>Line height<input type="number" min="0.8" max="3" step="0.05" value={style.lineHeight} onChange={(event) => onChange({ lineHeight: Math.min(3, Math.max(0.8, Number(event.target.value) || 0.8)) })} /></label><label>Letter spacing<input type="number" min="-0.2" max="1" step="0.01" value={style.letterSpacing} onChange={(event) => onChange({ letterSpacing: Math.min(1, Math.max(-0.2, Number(event.target.value) || 0)) })} /></label></div>
      <div className="books-inspector-label-row"><span>Alignment</span><div className="books-align-buttons">{alignments.map((alignment) => <button key={alignment.value} className={style.textAlign === alignment.value ? "active" : ""} onClick={() => onChange({ textAlign: alignment.value })} aria-label={alignment.label} title={alignment.label}>{alignment.icon}</button>)}</div></div>
      <label className="books-inspector-check"><span>Italic style</span><input type="checkbox" checked={style.fontStyle === "italic"} onChange={(event) => onChange({ fontStyle: event.target.checked ? "italic" : "normal" })} /></label>
    </div>
  );
}

function TextPresentationControls({ presentation, onChange }: { presentation: RichPresentation; onChange: (patch: Partial<RichPresentation>) => void }) {
  return <div className="books-inspector-form books-text-presentation-controls"><div className="books-inspector-label-row"><span>Text box placement</span><div className="books-align-buttons">{(["left", "center", "right"] as const).map((align) => <button key={align} className={presentation.align === align ? "active" : ""} onClick={() => onChange({ align })} aria-label={`Place text ${align}`}><span className="books-align-text">{align[0].toUpperCase()}</span></button>)}</div></div><label className="books-inspector-range">Text box width<strong>{presentation.width}%</strong><input type="range" min="20" max="100" step="5" value={presentation.width} onChange={(event) => onChange({ width: Number(event.target.value) })} /></label></div>;
}

function ParagraphControls({ style, onChange }: { style: BookTextStyle; onChange: (patch: Partial<BookTextStyle>) => void }) {
  const dropCapPreset = FONT_OPTIONS.some((option) => option.value === style.dropCapFontFamily);
  const nestedFontPreset = FONT_OPTIONS.some((option) => option.value === style.nestedFontFamily);
  const nestedOptions: { value: BookNestedStyle; label: string }[] = [
    { value: "none", label: "None" },
    { value: "small-caps", label: "Small caps" },
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "accent", label: "Accent color" },
  ];
  return <div className="books-paragraph-controls">
    <section className="books-paragraph-construction" aria-labelledby="books-paragraph-construction-title">
      <div className="books-inspector-subheading"><span className="books-paragraph-section-mark" aria-hidden="true">¶</span><div><strong id="books-paragraph-construction-title">Paragraph construction</strong><small>Indent, rhythm, and opening treatment</small></div></div>
      <div className="books-paragraph-construction-fields">
        <div className="books-inspector-two-up"><label>First line (em)<input type="number" min="-2" max="8" step="0.1" value={style.firstLineIndent} onChange={(event) => onChange({ firstLineIndent: Math.min(8, Math.max(-2, Number(event.target.value) || 0)) })} /></label><label>Left indent (em)<input type="number" min="0" max="8" step="0.1" value={style.leftIndent} onChange={(event) => onChange({ leftIndent: Math.min(8, Math.max(0, Number(event.target.value) || 0)) })} /></label></div>
        <div className="books-inspector-two-up"><label>Right indent (em)<input type="number" min="0" max="8" step="0.1" value={style.rightIndent} onChange={(event) => onChange({ rightIndent: Math.min(8, Math.max(0, Number(event.target.value) || 0)) })} /></label><label>Space before (em)<input type="number" min="0" max="4" step="0.05" value={style.spaceBefore} onChange={(event) => onChange({ spaceBefore: Math.min(4, Math.max(0, Number(event.target.value) || 0)) })} /></label></div>
        <label>Space after (em)<input type="number" min="0" max="4" step="0.05" value={style.spaceAfter} onChange={(event) => onChange({ spaceAfter: Math.min(4, Math.max(0, Number(event.target.value) || 0)) })} /></label>
      </div>
    </section>
    <section className="books-paragraph-dropcap" aria-labelledby="books-dropcap-title">
      <div className="books-inspector-subheading"><span className="books-paragraph-section-mark books-paragraph-dropcap-mark" aria-hidden="true">A</span><div><strong id="books-dropcap-title">Drop cap</strong><small>Float the opening letter in Preview and exports</small></div></div>
      <div className="books-paragraph-dropcap-fields">
        <label className="books-inspector-check"><span>Use a drop cap</span><input type="checkbox" checked={style.dropCap} onChange={(event) => onChange({ dropCap: event.target.checked })} /></label>
        {style.dropCap && <>
          <div className="books-inspector-two-up"><label>Lines<input type="number" min="2" max="6" step="1" value={style.dropCapLines} onChange={(event) => onChange({ dropCapLines: Math.min(6, Math.max(2, Number(event.target.value) || 2)) })} /></label><label>Gap (em)<input type="number" min="0" max="1" step="0.05" value={style.dropCapGap} onChange={(event) => onChange({ dropCapGap: Math.min(1, Math.max(0, Number(event.target.value) || 0)) })} /></label></div>
          <label>Drop-cap font<select value={dropCapPreset ? style.dropCapFontFamily : "custom"} onChange={(event) => onChange({ dropCapFontFamily: event.target.value === "custom" ? (dropCapPreset ? "" : style.dropCapFontFamily) : event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom font stack</option></select></label>
          {(!dropCapPreset || style.dropCapFontFamily === "") && <label>Custom drop-cap stack<input value={style.dropCapFontFamily} onChange={(event) => onChange({ dropCapFontFamily: event.target.value })} placeholder="Baskerville, Georgia, serif" /></label>}
          <label className="books-color-field">Drop-cap color<div><input className="books-color-input" type="color" value={style.dropCapColor} onChange={(event) => onChange({ dropCapColor: event.target.value })} /><code>{style.dropCapColor}</code></div></label>
        </>}
      </div>
    </section>
    <section className="books-paragraph-nested-opening" aria-labelledby="books-nested-opening-title">
      <div className="books-inspector-subheading"><span className="books-paragraph-section-mark books-paragraph-nested-mark" aria-hidden="true">Aa</span><div><strong id="books-nested-opening-title">Nested opening style</strong><small>Apply a character treatment to the first words</small></div></div>
      <div className="books-paragraph-nested-fields">
        <label>Style<select value={style.nestedStyle} onChange={(event) => onChange({ nestedStyle: event.target.value as BookNestedStyle })}>{nestedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {style.nestedStyle !== "none" && <>
          <label>Words<input type="number" min="1" max="12" step="1" value={style.nestedWords} onChange={(event) => onChange({ nestedWords: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })} /></label>
          <label>Nested font<select value={nestedFontPreset ? style.nestedFontFamily : "custom"} onChange={(event) => onChange({ nestedFontFamily: event.target.value === "custom" ? "" : event.target.value })}>{FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">Custom font stack</option></select></label>
          {(!nestedFontPreset || style.nestedFontFamily === "") && <label>Custom nested stack<input value={style.nestedFontFamily} onChange={(event) => onChange({ nestedFontFamily: event.target.value })} placeholder="Baskerville, Georgia, serif" /></label>}
          <label className="books-color-field">Nested color<div><input className="books-color-input" type="color" value={style.nestedColor} onChange={(event) => onChange({ nestedColor: event.target.value })} /><code>{style.nestedColor}</code></div></label>
        </>}
      </div>
    </section>
  </div>;
}

function ImageInspector({ context, onReplaceRange }: { context: EditorContext; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const image = context.image;
  if (!image) return null;
  const update = (patch: Partial<ImagePresentation>) => onReplaceRange(context.start, context.end, `${image.indent}${imageMarkdown(image.alt, image.source, { ...image.presentation, ...patch })}`);
  const updateAlt = (alt: string) => onReplaceRange(context.start, context.end, `${image.indent}${imageMarkdown(alt, image.source, image.presentation)}`);
  return (
    <div className="books-inspector-form">
      <label>Alt text<input value={image.alt} onChange={(event) => updateAlt(event.target.value)} /></label>
      <div className="books-inspector-label-row"><span>Corner treatment</span><div className="books-segmented-buttons">{(["none", "soft", "round"] as const).map((radius) => <button key={radius} className={image.presentation.radius === radius ? "active" : ""} onClick={() => update({ radius })}>{radius === "none" ? "Square" : radius === "soft" ? "Soft" : "Round"}</button>)}</div></div>
      <div className="books-inspector-label-row"><span>Image alignment</span><div className="books-align-buttons">{(["left", "center", "right"] as const).map((align) => <button key={align} className={image.presentation.align === align ? "active" : ""} onClick={() => update({ align })} aria-label={`Align image ${align}`}><span className="books-align-text">{align[0].toUpperCase()}</span></button>)}</div></div>
      <label className="books-inspector-range">Width<strong>{image.presentation.width}%</strong><input type="range" min="20" max="100" step="5" value={image.presentation.width} onChange={(event) => update({ width: Number(event.target.value) })} /></label>
    </div>
  );
}

function TableInspector({ context, onReplaceRange }: { context: EditorContext; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const lines = context.tableLines ?? [];
  const options = context.tableOptions ?? { caption: "", align: "left" as TableAlign, striped: false, compact: false, width: 100 };
  const rewrite = (nextLines = lines, nextOptions = options) => onReplaceRange(context.start, context.end, tableBlockText(nextLines, nextOptions));
  const columnCount = Math.max(1, splitTableCells(lines[0] ?? "").length);
  const editableRows = lines.length >= 2 && tableSeparator(lines[1]) ? lines.map((line, rowIndex) => ({ line, rowIndex })).filter((row) => row.rowIndex !== 1) : [];
  return (
    <div className="books-inspector-form">
      <label>Caption<input value={options.caption} onChange={(event) => rewrite(lines, { ...options, caption: event.target.value })} placeholder="Optional table caption" /></label>
      <label>Table alignment<select value={options.align} onChange={(event) => rewrite(lines, { ...options, align: event.target.value as TableAlign })}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></label>
      <label className="books-inspector-range">Width<strong>{options.width}%</strong><input type="range" min="20" max="100" step="5" value={options.width} onChange={(event) => rewrite(lines, { ...options, width: Number(event.target.value) })} /></label>
      <label className="books-inspector-check"><span>Striped rows</span><input type="checkbox" checked={options.striped} onChange={(event) => rewrite(lines, { ...options, striped: event.target.checked })} /></label>
      <label className="books-inspector-check"><span>Compact spacing</span><input type="checkbox" checked={options.compact} onChange={(event) => rewrite(lines, { ...options, compact: event.target.checked })} /></label>
      {editableRows.length > 0 && <div className="books-table-editor-wrap"><div className="books-chart-data-heading"><span>Data grid</span><small>{editableRows.length - 1} data {editableRows.length - 1 === 1 ? "row" : "rows"}</small></div><div className="books-table-editor" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(80px, 1fr))` }} aria-label="Edit table cells">{editableRows.flatMap(({ line, rowIndex }) => splitTableCells(line).slice(0, columnCount).map((cell, columnIndex) => <input key={`${rowIndex}-${columnIndex}`} className={rowIndex === 0 ? "header" : ""} value={cell} onChange={(event) => rewrite(updateTableCell(lines, rowIndex, columnIndex, event.target.value))} aria-label={`${rowIndex === 0 ? "Header" : `Row ${rowIndex}`} column ${columnIndex + 1}`} />))}</div></div>}
      <div className="books-inspector-button-grid"><button onClick={() => rewrite(addTableRow(lines))}><Rows3 size={13} /> Add row</button><button onClick={() => rewrite(addTableColumn(lines))}><Columns3 size={13} /> Add column</button><button onClick={() => rewrite(removeTableRow(lines))} disabled={lines.length <= 2}><Rows3 size={13} /> Remove row</button><button onClick={() => rewrite(removeTableColumn(lines))} disabled={splitTableCells(lines[0] ?? "").length <= 1}><Columns3 size={13} /> Remove column</button></div>
      <p className="books-inspector-help">Use <code>|</code> in a cell for a line break in the source, or keep editing directly for full Markdown control.</p>
    </div>
  );
}

function ChartInspector({ context, onReplaceRange }: { context: EditorContext; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void }) {
  const data = context.chart ?? defaultChartData();
  const update = (patch: Partial<ChartData>) => onReplaceRange(context.start, context.end, chartBlockText({ ...data, ...patch }));
  const updateSeries = (series: ChartData["series"]) => update({ series });
  const addPoint = () => update({ labels: [...data.labels, `Item ${data.labels.length + 1}`], series: data.series.map((series) => ({ ...series, values: [...series.values, 0] })) });
  const removePoint = () => data.labels.length > 1 && update({ labels: data.labels.slice(0, -1), series: data.series.map((series) => ({ ...series, values: series.values.slice(0, -1) })) });
  const addSeries = () => update({ series: [...data.series, { name: `Series ${data.series.length + 1}`, values: data.labels.map(() => 0) }], showLegend: true });
  const removeSeries = () => data.series.length > 1 && updateSeries(data.series.slice(0, -1));
  return (
    <div className="books-inspector-form">
      <div className="books-inspector-two-up"><label>Chart type<select value={data.type} onChange={(event) => update({ type: event.target.value as ChartKind })}><option value="bar">Bar chart</option><option value="line">Line graph</option><option value="area">Area graph</option><option value="donut">Donut chart</option><option value="stat">Single stat</option></select></label><label>Palette<select value={data.palette} onChange={(event) => update({ palette: event.target.value as ChartPalette })}>{CHART_PALETTE_NAMES.map((palette) => <option key={palette} value={palette}>{palette[0].toUpperCase() + palette.slice(1)}</option>)}</select></label></div>
      <label>Title<input value={data.title} onChange={(event) => update({ title: event.target.value })} placeholder="Chart title" /></label>
      <label>Subtitle<input value={data.subtitle} onChange={(event) => update({ subtitle: event.target.value })} placeholder="A short explanation" /></label>
      <div className="books-inspector-two-up"><label>Placement<select value={data.align} onChange={(event) => update({ align: event.target.value as RichAlign })}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></label><label className="books-inspector-range">Width<strong>{data.width}%</strong><input type="range" min="20" max="100" step="5" value={data.width} onChange={(event) => update({ width: Number(event.target.value) })} /></label></div>
      <div className="books-inspector-two-up"><label className="books-inspector-check"><span>Legend</span><input type="checkbox" checked={data.showLegend} onChange={(event) => update({ showLegend: event.target.checked })} /></label><label className="books-inspector-check"><span>Grid lines</span><input type="checkbox" checked={data.showGrid} onChange={(event) => update({ showGrid: event.target.checked })} /></label></div>
      <div className="books-chart-data-heading"><span>Data points</span><div><button onClick={addPoint}><Plus size={12} /> Point</button><button onClick={removePoint} disabled={data.labels.length <= 1}><Minus size={12} /> Point</button></div></div>
      <div className="books-chart-data-grid" style={{ gridTemplateColumns: `minmax(80px, 1.1fr) repeat(${data.series.length}, minmax(52px, 1fr))` }}><strong>Label</strong>{data.series.map((series, index) => <input key={`name-${index}`} value={series.name} onChange={(event) => updateSeries(data.series.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} aria-label={`Series ${index + 1} name`} />)}{data.labels.map((label, labelIndex) => <Fragment key={`point-${labelIndex}`}><input value={label} onChange={(event) => update({ labels: data.labels.map((item, index) => index === labelIndex ? event.target.value : item) })} aria-label={`Point ${labelIndex + 1} label`} />{data.series.map((series, seriesIndex) => <input key={`${labelIndex}-${seriesIndex}`} type="number" value={series.values[labelIndex] ?? 0} onChange={(event) => updateSeries(data.series.map((item, index) => index === seriesIndex ? { ...item, values: item.values.map((value, pointIndex) => pointIndex === labelIndex ? Number(event.target.value) || 0 : value) } : item))} aria-label={`${series.name} value for ${label}`} />)}</Fragment>)}</div>
      <div className="books-inspector-button-grid"><button onClick={addSeries}><Plus size={13} /> Add series</button><button onClick={removeSeries} disabled={data.series.length <= 1}><Trash2 size={13} /> Remove series</button></div>
      {!context.chart && <p className="books-inspector-help">This chart block is not valid JSON yet. Resetting a control will normalize it to an editable chart.</p>}
    </div>
  );
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
  return <div className="books-inspector-form"><label>Label<input value={title} onChange={(event) => update(event.target.value)} /></label><label>Tone<select value={tone} onChange={(event) => update(title, event.target.value)}><option value="note">Note</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="quote">Quote</option></select></label><div className="books-inspector-two-up"><label>Placement<select value={presentation.align} onChange={(event) => update(title, tone, content, { ...presentation, align: event.target.value as RichAlign })}><option value="left">Left</option><option value="center">Centered</option><option value="right">Right</option></select></label><label className="books-inspector-range">Width<strong>{presentation.width}%</strong><input type="range" min="20" max="100" step="5" value={presentation.width} onChange={(event) => update(title, tone, content, { ...presentation, width: Number(event.target.value) })} /></label></div><p className="books-inspector-help">Edit the callout copy directly in the manuscript. The tone and presentation stay portable in Markdown.</p></div>;
}

export function BooksInspector({ context, layout, onLayoutChange, onReplaceRange, onMoveRange, onDeleteRange, chapterWords, totalWords, wordGoal }: { context: EditorContext; layout: BookLayout; onLayoutChange: (change: (layout: BookLayout) => BookLayout) => void; onReplaceRange: (start: number, end: number, replacement: string, focusEditor?: boolean) => void; onMoveRange: (start: number, end: number, direction: -1 | 1) => void; onDeleteRange: (start: number, end: number, restoreFocus?: HTMLElement | null) => void; chapterWords: number; totalWords: number; wordGoal: number }) {
  const role = context.role;
  const roleStyle = role ? layout.typography[role] : null;
  const goalProgress = Math.min(100, Math.round((totalWords / Math.max(1, wordGoal)) * 100));
  return (
    <aside className="books-editor-inspector books-context-inspector">
      <div className="books-inspector-header"><div><span className="books-inspector-overline"><SlidersHorizontal size={12} /> Contextual tools</span><strong>{context.kind === "none" ? "Select an element" : context.label}</strong></div></div>
      {context.kind !== "none" && context.kind !== "title" && <div className="books-inspector-element-actions"><button onClick={() => onMoveRange(context.start, context.end, -1)} aria-label="Move element earlier" title="Move earlier"><ArrowUp size={13} /></button><button onClick={() => onMoveRange(context.start, context.end, 1)} aria-label="Move element later" title="Move later"><ArrowDown size={13} /></button><button className="delete" onClick={(event) => onDeleteRange(context.start, context.end, event.currentTarget)} aria-label="Delete selected element" title="Delete selected element"><Trash2 size={13} /></button></div>}
      {context.kind === "none" ? <div className="books-inspector-empty"><Sparkles size={17} /><strong>Nothing selected</strong><span>Place the caret inside a heading, quote, image, table, chart, or paragraph to reveal its controls.</span></div> : role && roleStyle ? <InspectorDisclosure icon={<Type size={14} />} title={typographyRoleLabel(role)} summary="Font, rhythm, alignment" defaultOpen><TypographyControls style={roleStyle} onChange={(patch) => onLayoutChange((current) => ({ ...current, typography: { ...current.typography, [role]: { ...current.typography[role], ...patch } } }))} />{role !== "title" && <TextPresentationControls presentation={context.presentation ?? DEFAULT_RICH_PRESENTATION} onChange={(patch) => onReplaceRange(context.start, context.end, canvasTextSource(context.source, { ...(context.presentation ?? DEFAULT_RICH_PRESENTATION), ...patch }))} />}{role === "paragraph" && <ParagraphControls style={roleStyle} onChange={(patch) => onLayoutChange((current) => ({ ...current, typography: { ...current.typography, paragraph: { ...current.typography.paragraph, ...patch } } }))} />}</InspectorDisclosure> : context.kind === "image" ? <InspectorDisclosure icon={<ImagePlus size={14} />} title="Image" summary="Corners, size, alignment" defaultOpen><ImageInspector context={context} onReplaceRange={onReplaceRange} /></InspectorDisclosure> : context.kind === "table" ? <InspectorDisclosure icon={<Table2 size={14} />} title="Table" summary="Rows, columns, presentation" defaultOpen><TableInspector context={context} onReplaceRange={onReplaceRange} /></InspectorDisclosure> : context.kind === "chart" ? <InspectorDisclosure icon={<BarChart3 size={14} />} title="Chart / graph" summary="Data, palette, display" defaultOpen><ChartInspector context={context} onReplaceRange={onReplaceRange} /></InspectorDisclosure> : context.kind === "callout" ? <InspectorDisclosure icon={<Quote size={14} />} title="Callout" summary="Label and tone" defaultOpen><CalloutInspector context={context} onReplaceRange={onReplaceRange} /></InspectorDisclosure> : null}
      <InspectorDisclosure icon={<BookOpen size={14} />} title="Chapter pulse" summary={`${chapterWords.toLocaleString()} words`} defaultOpen={context.kind === "none"}>
        <div className="books-pulse-compact"><strong>{chapterWords.toLocaleString()}</strong><span>words in this section</span><div className="books-goal-track"><span style={{ width: `${goalProgress}%` }} /></div><div className="books-goal-meta"><span>{totalWords.toLocaleString()} total</span><span>{goalProgress}% of goal</span></div></div>
      </InspectorDisclosure>
      {context.kind !== "none" && <p className="books-inspector-source-hint">Changes apply to this role or selected block and remain portable in the manuscript source.</p>}
    </aside>
  );
}
