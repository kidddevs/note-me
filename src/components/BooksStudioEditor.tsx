import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  ChevronRight,
  BookmarkPlus,
  Clock3,
  Grid3X3,
  GripVertical,
  History,
  ImagePlus,
  LayoutList,
  LayoutTemplate,
  Minus,
  MousePointer2,
  Move,
  PaintBucket,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Pause,
  Play,
  Plus,
  Quote,
  Redo2,
  Replace,
  RotateCcw,
  Rows3,
  Ruler,
  Save,
  Search,
  Settings2,
  Timer,
  Table2,
  TextCursorInput,
  Trash2,
  Undo2,
  Upload,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type * as React from "react";
import type { Book, Chapter, ChapterKind, ChapterSnapshot, ChapterSnapshotReason } from "../lib/types";
import { BOOK_GRAPHICS, BOOK_GRAPHIC_CATEGORIES, graphicDataUri, type BookGraphic, type BookGraphicVariant } from "../lib/bookAssets";
import { layoutForBook, parseBookLayout, serializeBookLayout, type BookLayout, type BookParagraphStyle, type BookTextRole, type BookTypography } from "../lib/bookLayout";
import { applyGrepStyle, resolvedBlockTypography, textStyleClasses, textStyleVars } from "../lib/bookStyles";
import { api } from "../lib/api";
import { useBooks } from "../store/books";
import { notify } from "../store/toast";
import { BooksInspector } from "./BooksStudioInspector";
import {
  calloutBlockText,
  canvasTextSource,
  canvasBlocks,
  chartBlockText,
  chapterDisplayLabel,
  defaultChartData,
  DEFAULT_RICH_PRESENTATION,
  editorContextFor,
  findOccurrences,
  imageAltText,
  imageDataUri,
  imageFileToMarkdown,
  imageMimeType,
  imageMarkdown,
  markdownToHtml,
  bookInputFromBook,
  restyleCanvasTextSource,
  canvasParagraphBreak,
  chapterUsesFreeLayout,
  setChapterFreeLayout,
  EMPTY_CANVAS_PARAGRAPH,
  richPresentationLeft,
  richAlignForLeft,
  clampPresentationX,
  clampPresentationY,
  clampPresentationHeight,
  clampPresentationZ,
  tableBlockText,
  tableDataFromValue,
  wordCount,
  type CanvasBlock,
  type RichPresentation,
} from "../lib/bookPublishing";
import { handleTabListKeyDown, manuscriptStyle, useConfirmationDialog } from "./BooksStudio";

const SPRINT_PRESETS = [15, 25, 45] as const;
const CANVAS_PREFS_KEY = "note-me.books.canvas";

function readCanvasPrefs() {
  const fallback = { zoom: 100, rulers: true, guides: true };
  try {
    const raw = window.localStorage.getItem(CANVAS_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { zoom?: unknown; rulers?: unknown; guides?: unknown };
    const zoom = typeof parsed.zoom === "number" && parsed.zoom >= 60 && parsed.zoom <= 160 ? Math.round(parsed.zoom) : fallback.zoom;
    return { zoom, rulers: parsed.rulers !== false, guides: parsed.guides !== false };
  } catch {
    return fallback;
  }
}

function sprintClock(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

type EditorHistoryEntry = {
  title: string;
  content: string;
  selection: { start: number; end: number; titleFocused: boolean };
  layoutJson: string;
};

const SNAPSHOT_LABELS: Record<ChapterSnapshotReason, string> = {
  auto: "Auto checkpoint",
  manual: "Saved checkpoint",
  safety: "Before restore",
  restore: "Restored copy",
};

function snapshotTime(value: string) {
  const date = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function snapshotPreview(content: string) {
  const parts = canvasBlocks(content).map((block) => {
    if (block.kind === "image") return "Artwork";
    if (block.kind === "table") return "Data table";
    if (block.kind === "chart") return "Chart";
    if (block.kind === "callout") return "Callout";
    return block.display.replace(/[`*_~]/g, "").replace(/\s+/g, " ").trim();
  }).filter(Boolean);
  const clean = parts.join(" · ").replace(/\s+/g, " ").trim();
  return clean.slice(0, 180) || "No text in this checkpoint.";
}


function BooksAssetDrawer({ onClose, onInsert }: { onClose: () => void; onInsert: (markdown: string) => void }) {
  const [category, setCategory] = useState(BOOK_GRAPHIC_CATEGORIES[0]);
  const [variant, setVariant] = useState<BookGraphicVariant | "all">("all");
  const [color, setColor] = useState("#a56b3e");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const graphics = BOOK_GRAPHICS.filter((item) => item.category === category && (variant === "all" || item.variant === variant) && (!query.trim() || item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));

  const importImage = async () => {
    setUploading(true);
    try {
      const [{ open }, { readFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      });
      if (typeof path !== "string") return;
      const data = await readFile(path);
      if (data.byteLength > 12 * 1024 * 1024) {
        notify("error", "Image is too large", "Choose an image smaller than 12 MB.");
        return;
      }
      const alt = imageAltText(path);
      onInsert(`![${alt}](${imageDataUri(imageMimeType(path), data)})\n`);
    } catch (error) {
      notify("error", "Image could not be added", String(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="books-assets-drawer" aria-label="Book assets">
      <div className="books-assets-heading">
        <div><span className="books-eyebrow"><ImagePlus size={13} /> Artwork</span><strong>Place an image or ornament</strong></div>
        <button className="books-assets-close" onClick={onClose} aria-label="Close artwork drawer"><X size={14} /></button>
      </div>
      <div className="books-assets-tools">
        <button className="books-asset-upload" onClick={() => void importImage()} disabled={uploading}><Upload size={13} /> {uploading ? "Reading image…" : "Add image from Mac"}</button>
        <div className="books-asset-color-group"><label className="books-asset-color"><span>Graphic color</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><code>{color}</code></label><div className="books-asset-swatches" aria-label="Graphic color presets">{["#a56b3e", "#29231e", "#6f7f6d", "#874e47", "#756e62"].map((preset) => <button key={preset} className={color === preset ? "active" : ""} style={{ background: preset }} onClick={() => setColor(preset)} aria-label={`Use ${preset}`} />)}</div></div>
      </div>
      <label className="books-asset-search"><Search size={12} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this collection" aria-label="Search artwork collection" />{query && <button onClick={() => setQuery("")} aria-label="Clear artwork search"><X size={12} /></button>}</label>
       <div className="books-asset-categories" role="tablist" aria-label="Graphic categories" onKeyDown={handleTabListKeyDown}>
         {BOOK_GRAPHIC_CATEGORIES.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)} role="tab" aria-selected={category === item} tabIndex={category === item ? 0 : -1}>{item}</button>)}
       </div>
        <div className="books-asset-variants" role="tablist" aria-label="Graphic variants" onKeyDown={handleTabListKeyDown}>{(["all", "line", "solid", "frame", "dotted", "dashed"] as const).map((item) => <button key={item} className={variant === item ? "active" : ""} onClick={() => setVariant(item)} role="tab" aria-selected={variant === item} tabIndex={variant === item ? 0 : -1}>{item === "all" ? "All variants" : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
       <div className="books-asset-grid">
         {graphics.map((item: BookGraphic) => {
           const markdown = `![${item.label}](${graphicDataUri(item.svg, color)})\n`;
           return <button key={item.id} className="books-asset-card" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-note-me-artwork", markdown); }} onClick={() => onInsert(markdown)} title={`Insert ${item.label} or drag onto the page`}><span className="books-asset-preview" dangerouslySetInnerHTML={{ __html: item.svg.replace(/currentColor/g, color) }} /><strong>{item.label}</strong><small>{item.variant}</small></button>;
         })}
        {graphics.length === 0 && <p className="books-assets-empty">No artwork matches “{query}”.</p>}
      </div>
      <p className="books-assets-note">Graphics are embedded as portable SVG data, so their color and shape travel with exported copies.</p>
    </section>
  );
}



function roundCanvasPercent(value: number) {
  return Math.round(value * 10) / 10;
}


type CanvasSnapRect = { left: number; top: number; width: number; height: number };

function snapAxis(value: number, size: number, targets: number[], threshold: number) {
  let best: { value: number; guide: number; distance: number } | null = null;
  const anchors = [0, size / 2, size];
  for (const target of targets) {
    for (const anchor of anchors) {
      const next = target - anchor;
      const distance = Math.abs(next - value);
      if (distance <= threshold && (!best || distance < best.distance)) best = { value: next, guide: target, distance };
    }
  }
  return best;
}

function snapWithAlignmentGuides(rawX: number, rawY: number, width: number, height: number, others: CanvasSnapRect[], includeY: boolean, threshold = 0.9) {
  const xTargets = [0, 50, 100, ...others.flatMap((rect) => [rect.left, rect.left + rect.width / 2, rect.left + rect.width])];
  const yTargets = [0, ...others.flatMap((rect) => [rect.top, rect.top + rect.height / 2, rect.top + rect.height])];
  const xSnap = snapAxis(rawX, width, xTargets, threshold);
  const ySnap = includeY ? snapAxis(rawY, height, yTargets, threshold) : null;
  return {
    x: roundCanvasPercent(xSnap?.value ?? rawX),
    y: roundCanvasPercent(ySnap?.value ?? rawY),
    guideX: xSnap?.guide,
    guideY: ySnap?.guide,
  };
}

function canvasBlockStyle(width: number, left?: number, freeY?: number, moving = false, layer?: number, height?: number): CSSProperties {
  const heightStyle = height !== undefined ? { height: `${roundCanvasPercent(height)}cqw` } : {};
  if (freeY !== undefined) {
    return {
      position: "absolute",
      top: `${roundCanvasPercent(freeY)}cqw`,
      left: `${roundCanvasPercent(left ?? 0)}%`,
      width: `${width}%`,
      ...heightStyle,
      ...(moving ? { zIndex: 9999 } : layer !== undefined ? { zIndex: layer + 100 } : {}),
    };
  }
  const frame: CSSProperties = { width: `${width}%`, ...heightStyle };
  if (left !== undefined) {
    frame.marginLeft = `${roundCanvasPercent(left)}%`;
    frame.alignSelf = "flex-start";
  }
  if (moving) frame.zIndex = 4;
  return frame;
}

function CanvasMoveHandle({ label, onMoveStart }: { label: string; onMoveStart: (event: React.PointerEvent<HTMLButtonElement>) => void }) {
  return <button type="button" className="books-canvas-move-handle" onPointerDown={onMoveStart} aria-label={`Move ${label}`} title="Drag to move"><GripVertical size={12} /></button>;
}

type ResizeDirection = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

const RESIZE_DIRECTIONS: ResizeDirection[] = ["nw", "n", "ne", "w", "e", "sw", "s", "se"];
const HORIZONTAL_RESIZE_DIRECTIONS: ResizeDirection[] = ["w", "e"];

function CanvasResizeHandles({ label, full, onResizeStart }: { label: string; full?: boolean; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, direction: ResizeDirection) => void }) {
  const directions = full ? RESIZE_DIRECTIONS : HORIZONTAL_RESIZE_DIRECTIONS;
  return <>{directions.map((direction) => <button key={direction} type="button" className={`books-canvas-resize-handle ${direction}`} onPointerDown={(event) => onResizeStart(event, direction)} aria-label={`Resize ${label} from the ${direction} handle`} title="Drag to resize" />)}</>;
}

function moveCanvasBlockInContent(workingContent: string, currentStart: number, currentEnd: number, dropIndex: number) {
  const initialBlocks = canvasBlocks(workingContent);
  const fromIndex = initialBlocks.findIndex((block) => block.start === currentStart && block.end === currentEnd);
  if (fromIndex < 0) return { content: workingContent, start: currentStart, end: currentEnd };
  const targetIndex = Math.max(0, Math.min(initialBlocks.length, dropIndex));
  const steps = targetIndex > fromIndex ? targetIndex - fromIndex - 1 : fromIndex - targetIndex;
  if (steps <= 0) return { content: workingContent, start: currentStart, end: currentEnd };
  let content = workingContent;
  let start = currentStart;
  let end = currentEnd;
  const direction = targetIndex > fromIndex ? 1 : -1;
  for (let step = steps; step > 0; step -= 1) {
    const blocks = canvasBlocks(content);
    const index = blocks.findIndex((block) => block.start === start && block.end === end);
    const neighbor = index + direction;
    if (index < 0 || neighbor < 0 || neighbor >= blocks.length) break;
    const current = blocks[index];
    const adjacent = blocks[neighbor];
    const currentSource = content.slice(current.start, current.end);
    const adjacentSource = content.slice(adjacent.start, adjacent.end);
    const gap = direction < 0 ? content.slice(adjacent.end, current.start) : content.slice(current.end, adjacent.start);
    const rangeStart = direction < 0 ? adjacent.start : current.start;
    const rangeEnd = direction < 0 ? current.end : adjacent.end;
    const replacement = direction < 0 ? `${currentSource}${gap}${adjacentSource}` : `${adjacentSource}${gap}${currentSource}`;
    content = content.slice(0, rangeStart) + replacement + content.slice(rangeEnd);
    start = direction < 0 ? rangeStart : rangeStart + adjacentSource.length + gap.length;
    end = start + currentSource.length;
  }
  return { content, start, end };
}

function CanvasRulers({ trimWidth, trimHeight }: { trimWidth: number; trimHeight: number }) {
  const width = Math.max(1, trimWidth);
  const height = Math.max(1, trimHeight);
  return (
    <>
      <div className="books-canvas-ruler horizontal" aria-hidden="true" style={{ "--ruler-minor": `${100 / (width * 4)}%`, "--ruler-major": `${100 / width}%` } as CSSProperties}>
        {Array.from({ length: Math.floor(width) + 1 }, (_, index) => <span key={index} style={{ left: `${(index / width) * 100}%` }}>{index}</span>)}
      </div>
      <div className="books-canvas-ruler vertical" aria-hidden="true" style={{ "--ruler-minor": `${100 / (height * 4)}%`, "--ruler-major": `${100 / height}%` } as CSSProperties}>
        {Array.from({ length: Math.floor(height) + 1 }, (_, index) => <span key={index} style={{ top: `${(index / height) * 100}%` }}>{index}</span>)}
      </div>
    </>
  );
}







function CanvasTextBlock({ block, index, width, left, freeY, layer, height, fullResize, selected, moving, resizing, typography, focusRequest, onFocusHandled, onTextChange, onTextSelection, onEditorKeyDown, onResizeStart, onMoveStart, onParagraphBreak }: { block: CanvasBlock; index: number; width: number; left?: number; freeY?: number; layer?: number; height?: number; fullResize?: boolean; selected: boolean; moving?: boolean; resizing?: boolean; typography: BookTypography; focusRequest?: { start: number; cursor: number } | null; onFocusHandled?: () => void; onTextChange: (block: CanvasBlock, value: string, selectionStart: number, selectionEnd: number) => void; onTextSelection: (block: CanvasBlock, event: React.SyntheticEvent<HTMLTextAreaElement>) => void; onEditorKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, block: CanvasBlock, direction: ResizeDirection) => void; onMoveStart: (event: React.PointerEvent<HTMLElement>, block: CanvasBlock) => void; onParagraphBreak: (block: CanvasBlock, selectionStart: number, selectionEnd: number) => void }) {
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const style = block.role ? typography[block.role] : typography.paragraph;
  const className = block.role === "quote" ? "quote" : block.level ? `heading heading-${block.level}` : "paragraph";
  const label = block.role === "quote" ? "quote" : block.level ? `heading ${block.level}` : "paragraph";
  const empty = !block.display.replace(/\u200B/g, "").trim();
  const autoFocus = focusRequest?.start === block.start;
  useEffect(() => {
    if (autoFocus) setEditing(true);
  }, [autoFocus]);
  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      const target = editor.current;
      if (!target) return;
      target.focus();
      if (autoFocus && focusRequest) {
        const position = Math.min(target.value.length, Math.max(0, focusRequest.cursor));
        target.setSelectionRange(position, position);
        onFocusHandled?.();
      } else if (!target.value.replace(/\u200B/g, "").trim()) {
        target.setSelectionRange(0, target.value.length);
      }
    });
  }, [editing]);
  useEffect(() => {
    if (!editing) return;
    const target = editor.current;
    if (!target) return;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  });
  const beginEditing = () => setEditing(true);
  return <div className={`books-canvas-text-block align-${block.presentation.align} ${selected ? "selected" : ""} ${moving ? "is-moving" : ""} ${height !== undefined ? "fixed-height" : ""} ${textStyleClasses(style)}`} style={{ ...canvasBlockStyle(width, left, freeY, moving, layer, height), ...textStyleVars(style) }} data-canvas-block data-block-start={block.start} onPointerDown={(event) => {
    if ((event.target as HTMLElement).closest(".books-canvas-text-preview")) onMoveStart(event, block);
  }}>
    <CanvasMoveHandle label={label} onMoveStart={(event) => onMoveStart(event, block)} />
    {editing ? <textarea ref={editor} className={`books-canvas-text ${className}`} style={{ textIndent: `${style.firstLineIndent}em`, marginTop: `${style.spaceBefore}em`, marginBottom: `${style.spaceAfter}em`, paddingLeft: `${style.leftIndent}em`, paddingRight: `${style.rightIndent}em`, textAlign: style.textAlign }} value={block.display} rows={1} onChange={(event) => onTextChange(block, event.target.value, event.target.selectionStart, event.target.selectionEnd)} onFocus={(event) => onTextSelection(block, event)} onSelect={(event) => onTextSelection(block, event)} onClick={(event) => onTextSelection(block, event)} onKeyUp={(event) => onTextSelection(block, event)} onBlur={() => setEditing(false)} onKeyDown={(event) => {
      const target = event.currentTarget;
      const lineStart = target.value.lastIndexOf("\n", Math.max(0, target.selectionStart - 1)) + 1;
      const listLine = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(target.value.slice(lineStart, target.selectionStart));
      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && !listLine) {
        event.preventDefault();
        onParagraphBreak(block, target.selectionStart, target.selectionEnd);
        return;
      }
      onEditorKeyDown(event);
    }} placeholder={empty ? (index === 0 ? "Begin writing here…" : "Continue writing…") : undefined} spellCheck aria-label={`${label} text`} /> : <div className={`books-canvas-text-preview ${empty ? "empty" : ""}`} tabIndex={0} role="textbox" aria-label={`${label} text`} onClick={beginEditing} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "F2") { event.preventDefault(); beginEditing(); } }} dangerouslySetInnerHTML={{ __html: empty ? "Begin writing here…" : applyGrepStyle(markdownToHtml(block.source, undefined, typography), style) }} />}
    {selected && <CanvasResizeHandles label={label} full={fullResize} onResizeStart={(event, direction) => onResizeStart(event, block, direction)} />}
    {resizing && <span className="books-canvas-resize-badge">{roundCanvasPercent(width)}% wide{height !== undefined ? ` · ${roundCanvasPercent(height)}% tall` : ""}</span>}
    {moving && <span className="books-canvas-move-badge">{roundCanvasPercent(richPresentationLeft({ ...block.presentation, width, x: left }))}% left · {roundCanvasPercent(width)}% wide</span>}
  </div>;
}

function ManuscriptCanvas({ content, selection, typography, paragraphStyles, freeLayout, onSelectVisual, onTextChange, onTextSelection, onEditorKeyDown, onEditorDragOver, onEditorDrop, onEditorPaste, onResizeStart, onDeleteBlock, onInsertArtwork, onChangePresentation, onMoveRange, onPlaceBlock, onParagraphBreak, focusRequest, onFocusHandled, resizing }: {
  content: string;
  selection: { start: number; end: number };
  typography: BookTypography;
  paragraphStyles: BookParagraphStyle[];
  freeLayout: boolean;
  onSelectVisual: (block: CanvasBlock) => void;
  onTextChange: (block: CanvasBlock, value: string, selectionStart: number, selectionEnd: number) => void;
  onTextSelection: (block: CanvasBlock, event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onEditorDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onEditorDrop: (event: React.DragEvent<HTMLElement>) => void;
  onEditorPaste: (event: React.ClipboardEvent<HTMLElement>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, block: CanvasBlock, direction: ResizeDirection) => void;
  onDeleteBlock: (block: CanvasBlock) => void;
  onInsertArtwork: (markdown: string) => void;
  onChangePresentation: (block: CanvasBlock, patch: Partial<RichPresentation>) => void;
  onMoveRange: (start: number, end: number, direction: -1 | 1) => void;
  onPlaceBlock: (block: CanvasBlock, patch: Partial<RichPresentation>, dropIndex: number | null) => void;
  onParagraphBreak: (block: CanvasBlock, selectionStart: number, selectionEnd: number) => void;
  focusRequest: { start: number; cursor: number } | null;
  onFocusHandled: () => void;
  resizing: { start: number; width: number; x?: number; height?: number; y?: number } | null;
}) {
  const parsedBlocks = canvasBlocks(content);
  const blocks = parsedBlocks.length > 0 ? parsedBlocks : [{ kind: "text", start: 0, end: 0, source: "", display: "", editPrefix: "", editSuffix: "", role: "paragraph", presentation: { ...DEFAULT_RICH_PRESENTATION } } satisfies CanvasBlock];
  const isSelected = (block: CanvasBlock) => selection.start <= block.end && selection.end >= block.start;
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [blockDrag, setBlockDrag] = useState<{ start: number; width: number; x: number; y?: number; dropIndex: number; guideX?: number; guideY?: number; moving: boolean } | null>(null);
  const [artworkOver, setArtworkOver] = useState(false);
  const [freeHeight, setFreeHeight] = useState<number | undefined>(undefined);

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.classList.remove("books-canvas-pointer-dragging");
  }, []);

  useLayoutEffect(() => {
    if (!freeLayout) {
      setFreeHeight(undefined);
      return;
    }
    const canvas = canvasRootRef.current;
    if (!canvas) return;
    const measure = () => {
      let bottom = 0;
      canvas.querySelectorAll<HTMLElement>("[data-canvas-block]").forEach((element) => {
        bottom = Math.max(bottom, element.offsetTop + element.offsetHeight);
      });
      const next = Math.max(340, Math.ceil(bottom + 48));
      setFreeHeight((current) => current !== undefined && Math.abs(current - next) < 2 ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    canvas.querySelectorAll<HTMLElement>("[data-canvas-block]").forEach((element) => observer.observe(element));
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [freeLayout, content, typography, paragraphStyles, resizing, blockDrag]);

  const renderVisual = (block: CanvasBlock, liveImageHeight?: number) => {
    if (block.kind === "image" && block.image) {
      const safeSource = /^(?:https?:\/\/|data:image\/)/i.test(block.image.source);
      const image = block.image.presentation;
      const frameClass = image.frame === "none" ? "" : ` frame-${image.frame}`;
      const radius = image.cornerRadius !== undefined ? `${image.cornerRadius}px` : undefined;
      const frameStyle: CSSProperties = {
        ...((liveImageHeight ?? image.height) !== undefined ? { height: `${liveImageHeight ?? image.height}cqw` } : {}),
        ...(radius ? { borderRadius: radius } : {}),
        ...(image.borderWidth ? { borderWidth: `${image.borderWidth}px`, borderStyle: image.borderStyle ?? "solid", borderColor: image.borderColor === "accent" ? "var(--book-accent)" : image.borderColor ?? "color-mix(in srgb, var(--book-ink) 22%, transparent)" } : {}),
        ...(image.shadow && image.shadow !== "none" ? { boxShadow: image.shadow === "soft" ? "0 6px 18px rgba(0,0,0,.12)" : image.shadow === "medium" ? "0 12px 30px rgba(0,0,0,.18)" : "0 18px 46px rgba(0,0,0,.26)" } : {}),
        ...(image.opacity !== undefined ? { opacity: image.opacity } : {}),
        ...(image.rotation ? { transform: `rotate(${image.rotation}deg)` } : {}),
      };
      return <div className="books-canvas-artwork">
        <div className={`books-canvas-image-inner radius-${image.radius} aspect-${image.aspect} fit-${image.fit}${frameClass}`} style={frameStyle}>
          {safeSource ? <img src={block.image.source} alt={block.image.alt || "Manuscript artwork"} draggable={false} /> : <span className="books-canvas-unsupported">This image source cannot be previewed.</span>}
        </div>
        {image.caption && <p className="books-canvas-image-caption">{image.caption}</p>}
      </div>;
    }
    const canvasSource = block.kind === "table"
      ? tableBlockText(block.tableLines ?? [], { ...(block.tableOptions ?? tableDataFromValue(null)), width: 100 })
      : block.kind === "chart" && block.chart
        ? chartBlockText({ ...block.chart, width: 100 })
        : block.kind === "callout"
          ? calloutBlockText(block.calloutTitle ?? "Note", block.calloutTone ?? "note", block.source.split(/\r?\n/).slice(2, -1).join("\n"), { ...(block.calloutPresentation ?? DEFAULT_RICH_PRESENTATION), width: 100 })
          : block.source;
    return <div className="books-canvas-rich-inner" dangerouslySetInnerHTML={{ __html: markdownToHtml(canvasSource, undefined, typography) }} />;
  };

  const isArtworkDrag = (event: React.DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes("application/x-note-me-artwork");

  const handleArtworkDrop = (event: React.DragEvent<HTMLElement>) => {
    const markdown = event.dataTransfer.getData("application/x-note-me-artwork");
    if (!markdown) return false;
    event.preventDefault();
    event.stopPropagation();
    onInsertArtwork(markdown);
    setArtworkOver(false);
    return true;
  };

  const dropIndexAt = (clientY: number) => {
    const elements = Array.from(canvasRootRef.current?.querySelectorAll<HTMLElement>("[data-canvas-block]") ?? []);
    for (let index = 0; index < elements.length; index += 1) {
      const rect = elements[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return elements.length;
  };

  const beginBlockMove = (event: React.PointerEvent<HTMLElement>, block: CanvasBlock) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".books-canvas-quickbar, .books-canvas-resize-handle")) return;
    const fromMoveHandle = Boolean(target.closest(".books-canvas-move-handle, .books-canvas-drag-handle"));
    if (!fromMoveHandle && target.closest("button, input, select, textarea, a")) return;
    const canvas = canvasRootRef.current;
    const blockElement = target.closest<HTMLElement>("[data-canvas-block]") ?? event.currentTarget.closest<HTMLElement>("[data-canvas-block]");
    if (!canvas || !blockElement) return;
    if (fromMoveHandle) event.preventDefault();
    event.stopPropagation();
    const canvasRect = canvas.getBoundingClientRect();
    const blockRect = blockElement.getBoundingClientRect();
    const width = block.presentation.width;
    const startX = richPresentationLeft(block.presentation);
    const startY = freeLayout ? block.presentation.y ?? 0 : undefined;
    const grabOffset = ((event.clientX - blockRect.left) / Math.max(1, canvasRect.width)) * 100;
    const grabOffsetY = ((event.clientY - blockRect.top) / Math.max(1, canvasRect.width)) * 100;
    const height = (blockRect.height / Math.max(1, canvasRect.width)) * 100;
    const others = Array.from(canvas.querySelectorAll<HTMLElement>("[data-canvas-block]"))
      .filter((element) => element !== blockElement)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: ((rect.left - canvasRect.left) / Math.max(1, canvasRect.width)) * 100, top: ((rect.top - canvasRect.top) / Math.max(1, canvasRect.width)) * 100, width: (rect.width / Math.max(1, canvasRect.width)) * 100, height: (rect.height / Math.max(1, canvasRect.width)) * 100 };
      });
    const state = {
      block,
      width,
      height,
      x: startX,
      y: startY,
      others,
      guideX: undefined as number | undefined,
      guideY: undefined as number | undefined,
      dropIndex: blocks.findIndex((item) => item.start === block.start),
      started: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerId: event.pointerId,
      grabOffset,
      grabOffsetY,
    };
    onSelectVisual(block);
    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.body.classList.remove("books-canvas-pointer-dragging");
      dragCleanupRef.current = null;
    };
    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== state.pointerId) return;
      if (!state.started && Math.hypot(moveEvent.clientX - state.startClientX, moveEvent.clientY - state.startClientY) < 4) return;
      if (!state.started) {
        state.started = true;
        document.body.classList.add("books-canvas-pointer-dragging");
        const suppressClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          window.removeEventListener("click", suppressClick, true);
        };
        window.addEventListener("click", suppressClick, true);
        window.setTimeout(() => window.removeEventListener("click", suppressClick, true), 0);
      }
      moveEvent.preventDefault();
      const rawLeft = Math.min(100 - state.width, Math.max(0, ((moveEvent.clientX - canvasRect.left) / Math.max(1, canvasRect.width)) * 100 - state.grabOffset));
      const rawTop = Math.max(0, ((moveEvent.clientY - canvasRect.top) / Math.max(1, canvasRect.width)) * 100 - state.grabOffsetY);
      const snapped = moveEvent.altKey
        ? { x: roundCanvasPercent(rawLeft), y: roundCanvasPercent(rawTop), guideX: undefined, guideY: undefined }
        : snapWithAlignmentGuides(rawLeft, rawTop, state.width, state.height, state.others, freeLayout);
      state.x = snapped.x;
      state.guideX = snapped.guideX;
      state.guideY = snapped.guideY;
      if (freeLayout) {
        state.y = snapped.y;
      } else {
        state.dropIndex = dropIndexAt(moveEvent.clientY);
        state.guideY = undefined;
      }
      setBlockDrag({ start: block.start, width: state.width, x: state.x, y: state.y, dropIndex: state.dropIndex, guideX: state.guideX, guideY: state.guideY, moving: true });
    };
    const onPointerUp = () => {
      cleanup();
      if (state.started) {
        onPlaceBlock(state.block, { width: state.width, x: state.x, ...(freeLayout && state.y !== undefined ? { y: state.y } : {}), align: richAlignForLeft(state.x, state.width) }, freeLayout ? null : state.dropIndex);
      }
      setBlockDrag(null);
    };
    dragCleanupRef.current?.();
    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerUp, { once: true });
  };

  const dropLine = (index: number) => <div key={`drop-${index}`} className={`books-canvas-drop-zone ${blockDrag?.dropIndex === index ? "active" : ""}`} aria-hidden="true"><span /></div>;

  return <div
    ref={canvasRootRef}
    className={`books-manuscript-canvas ${freeLayout ? "free-layout" : ""} ${blockDrag ? "is-dragging" : ""} ${artworkOver ? "artwork-drop" : ""}`}
    style={freeLayout ? { height: freeHeight, minHeight: 340 } : undefined}
    onDragOver={(event) => {
      if (isArtworkDrag(event)) {
        event.preventDefault();
        setArtworkOver(true);
      }
      onEditorDragOver(event);
    }}
    onDragLeave={(event) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setArtworkOver(false);
    }}
    onDrop={(event) => {
      if (handleArtworkDrop(event)) return;
      setArtworkOver(false);
      onEditorDrop(event);
    }}
    onPaste={onEditorPaste}
    aria-label="Manuscript canvas"
  >
    {blocks.map((block, index) => {
      const selected = isSelected(block) && (block.kind !== "text" || block.source.trim().length > 0);
      const liveResize = resizing?.start === block.start ? resizing : null;
      const liveDrag = blockDrag?.start === block.start ? blockDrag : null;
      const width = liveResize?.width ?? liveDrag?.width ?? block.presentation.width;
      const left = liveResize ? (liveResize.x ?? richPresentationLeft({ ...block.presentation, width: liveResize.width })) : liveDrag?.x ?? (freeLayout ? richPresentationLeft({ ...block.presentation, width }) : block.presentation.x);
      const freeY = freeLayout ? liveResize?.y ?? liveDrag?.y ?? block.presentation.y ?? 0 : undefined;
      const liveHeight = liveResize?.height;
      const fullResize = freeLayout && (block.kind === "text" || block.kind === "image");
      const layer = freeLayout ? block.presentation.z ?? index : undefined;
      const moving = Boolean(liveDrag);
      const preset = block.presentation.styleId ? paragraphStyles.find((item) => item.id === block.presentation.styleId) ?? null : null;
      const blockTypography = block.kind === "text" && block.role ? resolvedBlockTypography(typography, block.role, preset) : typography;
      return <Fragment key={`${block.start}-${index}`}>
        {blockDrag && !freeLayout && blockDrag.dropIndex === index && dropLine(index)}
        {block.kind === "text" ? (
          <CanvasTextBlock block={block} index={index} width={width} left={left} freeY={freeY} layer={layer} height={liveHeight ?? block.presentation.height} fullResize={fullResize} selected={selected} moving={moving} resizing={Boolean(liveResize)} typography={blockTypography} focusRequest={focusRequest?.start === block.start ? focusRequest : null} onFocusHandled={onFocusHandled} onTextChange={onTextChange} onTextSelection={onTextSelection} onEditorKeyDown={onEditorKeyDown} onResizeStart={onResizeStart} onMoveStart={beginBlockMove} onParagraphBreak={onParagraphBreak} />
        ) : (
          <div className={`books-canvas-visual ${selected ? "selected" : ""} ${moving ? "is-moving" : ""} align-${block.presentation.align}`} style={canvasBlockStyle(width, left, freeY, moving, layer)} role="button" tabIndex={0} data-canvas-block data-block-start={block.start} onPointerDown={(event) => beginBlockMove(event, block)} onClick={() => onSelectVisual(block)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectVisual(block);
            } else if ((event.key === "Backspace" || event.key === "Delete") && selected) {
              event.preventDefault();
              onDeleteBlock(block);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const step = event.shiftKey ? 5 : 1;
              const currentLeft = richPresentationLeft(block.presentation);
              const nextLeft = Math.max(0, Math.min(100 - block.presentation.width, currentLeft + (event.key === "ArrowLeft" ? -step : step)));
              onChangePresentation(block, { x: nextLeft, align: richAlignForLeft(nextLeft, block.presentation.width) });
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onMoveRange(block.start, block.end, event.key === "ArrowUp" ? -1 : 1);
            }
          }} aria-label={`Select ${block.kind === "image" ? "artwork" : block.kind}`}>
            <span className="books-canvas-visual-label">{block.kind === "image" ? "Artwork" : block.kind === "table" ? "Data table" : block.kind === "chart" ? "Chart / graph" : "Callout"}</span>
            <CanvasMoveHandle label={block.kind} onMoveStart={(event) => beginBlockMove(event, block)} />
            {renderVisual(block, liveHeight)}
            {selected && <><CanvasResizeHandles label={block.kind} full={fullResize} onResizeStart={(event, direction) => onResizeStart(event, block, direction)} /></>}
            {liveResize && <span className="books-canvas-resize-badge">{roundCanvasPercent(width)}% wide{liveHeight !== undefined ? ` · ${roundCanvasPercent(liveHeight)}% tall` : ""}</span>}
            {moving && <span className="books-canvas-move-badge">{roundCanvasPercent(left ?? 0)}% left · {roundCanvasPercent(width)}% wide</span>}
          </div>
        )}
      </Fragment>;
    })}
    {blockDrag && !freeLayout && blockDrag.dropIndex === blocks.length && dropLine(blocks.length)}
    {blockDrag?.guideX !== undefined && <div className="books-canvas-snap-guide vertical" style={{ left: `${blockDrag.guideX}%` }} aria-hidden="true" />}
    {blockDrag?.guideY !== undefined && <div className="books-canvas-snap-guide horizontal" style={{ top: `${blockDrag.guideY}cqw` }} aria-hidden="true" />}
    {artworkOver && <div className="books-canvas-artwork-drop-hint" aria-hidden="true">Drop artwork to place it in the manuscript</div>}
  </div>;
}


export function ManuscriptScreen({ book, chapters, activeChapter, focusMode, onFocusModeChange, onOpenOutline, onOpenSettings, onNewChapter, onNavigateSection }: { book: Book; chapters: Chapter[]; activeChapter: Chapter | null; focusMode: boolean; onFocusModeChange: (focused: boolean) => void; onOpenOutline: () => void; onOpenSettings: () => void; onNewChapter: () => void; onNavigateSection: (direction: -1 | 1) => void }) {
  const updateChapter = useBooks((state) => state.updateChapter);
  const updateBook = useBooks((state) => state.updateBook);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [assetOpen, setAssetOpen] = useState(false);
  const [canvasPrefs] = useState(readCanvasPrefs);
  const [canvasZoom, setCanvasZoom] = useState(canvasPrefs.zoom);
  const [showRulers, setShowRulers] = useState(canvasPrefs.rulers);
  const [showGuides, setShowGuides] = useState(canvasPrefs.guides);
  const confirmation = useConfirmationDialog();
  const [canvasResize, setCanvasResize] = useState<{ start: number; width: number; x?: number; height?: number; y?: number } | null>(null);
  const [pendingCanvasFocus, setPendingCanvasFocus] = useState<{ start: number; cursor: number } | null>(null);
  const [title, setTitle] = useState(activeChapter?.title ?? "");
  const [content, setContent] = useState(activeChapter?.content ?? "");
  const freeLayout = chapterUsesFreeLayout(content);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<ChapterSnapshot[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [sprintOpen, setSprintOpen] = useState(false);
  const [sprintMinutes, setSprintMinutes] = useState<number>(25);
  const [sprintEndsAt, setSprintEndsAt] = useState<number | null>(null);
  const [sprintRemaining, setSprintRemaining] = useState<number | null>(null);
  const [sprintStartWords, setSprintStartWords] = useState(0);
  const [sprintFinished, setSprintFinished] = useState(false);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0, titleFocused: false });
  const [inspectorLayout, setInspectorLayout] = useState(() => layoutForBook(book));
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageEditorRef = useRef<HTMLDivElement>(null);
  const activeEditorMapRef = useRef({ sourceStart: 0, prefixLength: 0 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const historyRef = useRef<EditorHistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const historyTimerRef = useRef<number | null>(null);
  const layoutHistoryTimerRef = useRef<number | null>(null);
  const applyingHistoryRef = useRef(false);
  const contentRef = useRef(content);
  const titleRef = useRef(title);
  const selectionRef = useRef(editorSelection);
  const lastSnapshotRef = useRef<{ chapterId: number; content: string; title: string } | null>(null);
  const draftVersionRef = useRef(0);
  const closingRef = useRef(false);
  const inspectorLayoutRef = useRef(inspectorLayout);
  const sprintStartWordsRef = useRef(0);
  const liveWordsRef = useRef(0);
  const draftRef = useRef<{
    id: number | null;
    title: string;
    content: string;
    chapterKind: ChapterKind;
    tocInclude: boolean;
    tocHeadingExclusions: string[];
    dirty: boolean;
  }>({
    id: activeChapter?.id ?? null,
    title: activeChapter?.title ?? "",
    content: activeChapter?.content ?? "",
    chapterKind: activeChapter?.chapter_kind ?? "chapter",
    tocInclude: activeChapter?.toc_include ?? true,
    tocHeadingExclusions: activeChapter?.toc_heading_exclusions ?? [],
    dirty: false,
  });

  const currentManuscriptWords = useMemo(
    () => chapters.reduce((total, chapter) => total + (chapter.id === activeChapter?.id ? wordCount(content) : wordCount(chapter.content)), 0),
    [chapters, activeChapter?.id, content]
  );
  const [trimWidth = 6, trimHeight = 9] = (book.trim_size || "6x9").split("x").map((value) => Number(value) || 0);
  const sprintWords = Math.max(0, currentManuscriptWords - sprintStartWords);
  const sprintRunning = sprintEndsAt !== null;
  const sprintPaused = !sprintRunning && !sprintFinished && sprintRemaining !== null && sprintRemaining > 0;
  liveWordsRef.current = currentManuscriptWords;

  useEffect(() => {
    const previous = draftRef.current;
    if (previous.id !== (activeChapter?.id ?? null) && previous.id !== null && previous.dirty) {
      void updateChapter(previous.id, previous.title.trim() || "Untitled chapter", previous.content, previous.chapterKind, previous.tocInclude, previous.tocHeadingExclusions);
    }
    draftVersionRef.current += 1;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setFindOpen(false);
    setFindQuery("");
    setFindIndex(0);
    setReplaceOpen(false);
    setReplaceQuery("");
    setAssetOpen(false);
    setCanvasResize(null);
    setPendingCanvasFocus(null);
    editorRef.current = null;
    activeEditorMapRef.current = { sourceStart: 0, prefixLength: 0 };
    setEditorSelection({ start: 0, end: 0, titleFocused: false });
    const initialTitle = activeChapter?.title ?? "";
    const initialContent = activeChapter?.content ?? "";
    setTitle(initialTitle);
    setContent(initialContent);
    setSaveState("saved");
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    if (layoutHistoryTimerRef.current !== null) window.clearTimeout(layoutHistoryTimerRef.current);
    layoutHistoryTimerRef.current = null;
    historyRef.current = [{ title: initialTitle, content: initialContent, selection: { start: 0, end: 0, titleFocused: false }, layoutJson: serializeBookLayout(inspectorLayoutRef.current) }];
    historyIndexRef.current = 0;
    contentRef.current = initialContent;
    titleRef.current = initialTitle;
    selectionRef.current = { start: 0, end: 0, titleFocused: false };
    setUndoState({ canUndo: false, canRedo: false });
    setHistoryOpen(false);
    setSnapshots([]);
    lastSnapshotRef.current = null;
    draftRef.current = {
      id: activeChapter?.id ?? null,
      title: initialTitle,
      content: initialContent,
      chapterKind: activeChapter?.chapter_kind ?? "chapter",
      tocInclude: activeChapter?.toc_include ?? true,
      tocHeadingExclusions: activeChapter?.toc_heading_exclusions ?? [],
      dirty: false,
    };
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
      if (layoutHistoryTimerRef.current !== null) window.clearTimeout(layoutHistoryTimerRef.current);
      const draft = draftRef.current;
      if (draft.id !== null && draft.dirty && useBooks.getState().chapters.some((chapter) => chapter.id === draft.id)) {
        void updateChapter(draft.id, draft.title.trim() || "Untitled chapter", draft.content, draft.chapterKind, draft.tocInclude, draft.tocHeadingExclusions);
      }
    };
  }, [activeChapter?.id, updateChapter]);

  useEffect(() => {
    const nextLayout = layoutForBook(book);
    inspectorLayoutRef.current = nextLayout;
    setInspectorLayout(nextLayout);
  }, [book.id, book.layout_json]);

  useEffect(() => {
    setSprintEndsAt(null);
    setSprintRemaining(null);
    setSprintStartWords(0);
    setSprintFinished(false);
    setSprintOpen(false);
  }, [book.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CANVAS_PREFS_KEY, JSON.stringify({ zoom: canvasZoom, rulers: showRulers, guides: showGuides }));
    } catch {
      // Canvas preferences are a convenience; ignore storage failures.
    }
  }, [canvasZoom, showGuides, showRulers]);

  useEffect(() => {
    if (sprintEndsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, sprintEndsAt - Date.now());
      setSprintRemaining(remaining);
      if (remaining <= 0) {
        setSprintEndsAt(null);
        setSprintFinished(true);
        const written = Math.max(0, liveWordsRef.current - sprintStartWordsRef.current);
        notify("success", "Writing sprint complete", `${written.toLocaleString()} words written in ${sprintMinutes} minutes`);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [sprintEndsAt, sprintMinutes]);

  useEffect(() => {
    if (!sprintOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".books-sprint-control")) setSprintOpen(false);
    };
    window.addEventListener("pointerdown", closeOnPointerDown);
    return () => window.removeEventListener("pointerdown", closeOnPointerDown);
  }, [sprintOpen]);



  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void getCurrentWindow().onCloseRequested(async (event) => {
      const draft = draftRef.current;
      if (closingRef.current || draft.id === null || !draft.dirty) return;
      event.preventDefault();
      closingRef.current = true;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      try {
        await updateChapter(draft.id, draft.title.trim() || "Untitled chapter", draft.content, draft.chapterKind, draft.tocInclude, draft.tocHeadingExclusions);
        draftRef.current.dirty = false;
        await getCurrentWindow().destroy();
      } catch (error) {
        closingRef.current = false;
        setSaveState("dirty");
        notify("error", "Close paused: chapter was not saved", String(error));
      }
    }).then((dispose) => {
      if (cancelled) dispose();
      else unlisten = dispose;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [updateChapter]);

  useEffect(() => {
    if (!activeChapter) return;
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [activeChapter?.id]);

  useEffect(() => {
    if (!activeChapter || draftRef.current.id !== activeChapter.id) return;
    draftRef.current = {
      id: activeChapter.id,
      title,
      content,
      chapterKind: activeChapter.chapter_kind,
      tocInclude: activeChapter.toc_include,
      tocHeadingExclusions: activeChapter.toc_heading_exclusions,
      dirty: saveState !== "saved",
    };
  }, [activeChapter?.id, activeChapter?.chapter_kind, activeChapter?.toc_include, title, content, saveState]);

  useEffect(() => {
    if (!activeChapter || !draftRef.current.dirty) return;
    const version = draftVersionRef.current;
    saveTimerRef.current = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await updateChapter(activeChapter.id, title.trim() || "Untitled chapter", content, activeChapter.chapter_kind, activeChapter.toc_include, activeChapter.toc_heading_exclusions);
        if (draftVersionRef.current === version && draftRef.current.id === activeChapter.id) {
          draftRef.current.dirty = false;
          setSaveState("saved");
        }
      } catch (error) {
        if (draftRef.current.id === activeChapter.id) setSaveState("dirty");
        notify("error", "Chapter could not be saved", String(error));
      }
    }, 700);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [activeChapter?.id, activeChapter?.chapter_kind, activeChapter?.toc_include, activeChapter?.toc_heading_exclusions, title, content, updateChapter]);

  const markDraft = (next: { title?: string; content?: string }) => {
    draftVersionRef.current += 1;
    draftRef.current = {
      ...draftRef.current,
      title: next.title ?? draftRef.current.title,
      content: next.content ?? draftRef.current.content,
      dirty: true,
    };
    setSaveState("dirty");
  };

  const commitHistory = () => {
    const layoutJson = serializeBookLayout(inspectorLayoutRef.current);
    const last = historyRef.current[historyIndexRef.current];
    if (last && last.content === contentRef.current && last.title === titleRef.current && last.layoutJson === layoutJson) return;
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push({ title: titleRef.current, content: contentRef.current, selection: { ...selectionRef.current }, layoutJson });
    const capped = next.slice(-120);
    historyRef.current = capped;
    historyIndexRef.current = capped.length - 1;
    setUndoState({ canUndo: historyIndexRef.current > 0, canRedo: false });
  };

  const flushHistory = () => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    if (layoutHistoryTimerRef.current !== null) {
      window.clearTimeout(layoutHistoryTimerRef.current);
      layoutHistoryTimerRef.current = null;
    }
    commitHistory();
  };

  const applyHistoryEntry = (entry: EditorHistoryEntry) => {
    applyingHistoryRef.current = true;
    contentRef.current = entry.content;
    titleRef.current = entry.title;
    selectionRef.current = entry.selection;
    setTitle(entry.title);
    setContent(entry.content);
    setEditorSelection(entry.selection);
    markDraft({ title: entry.title, content: entry.content });
    const nextLayout = parseBookLayout(entry.layoutJson);
    inspectorLayoutRef.current = nextLayout;
    setInspectorLayout(nextLayout);
    const currentBook = useBooks.getState().books.find((item) => item.id === book.id) ?? book;
    void updateBook(currentBook.id, bookInputFromBook(currentBook, serializeBookLayout(nextLayout))).catch((error) => notify("error", "Design history could not be restored", String(error)));
    requestAnimationFrame(() => { applyingHistoryRef.current = false; });
  };

  const undo = () => {
    flushHistory();
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applyHistoryEntry(historyRef.current[historyIndexRef.current]);
    setUndoState({ canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1 });
  };

  const redo = () => {
    flushHistory();
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applyHistoryEntry(historyRef.current[historyIndexRef.current]);
    setUndoState({ canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < historyRef.current.length - 1 });
  };

  useEffect(() => {
    contentRef.current = content;
    titleRef.current = title;
    selectionRef.current = editorSelection;
  }, [content, title, editorSelection]);

  useEffect(() => {
    if (applyingHistoryRef.current) return;
    const last = historyRef.current[historyIndexRef.current];
    if (last && last.content === content && last.title === title) return;
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      commitHistory();
    }, 500);
    return () => {
      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };
  }, [content, title]);

  const createChapterSnapshot = async (reason: ChapterSnapshotReason, snapshotTitle = title, snapshotContent = content) => {
    if (!activeChapter) return null;
    setSnapshotSaving(true);
    try {
      const snapshot = await api.createChapterSnapshot(activeChapter.id, {
        title: snapshotTitle.trim() || "Untitled chapter",
        content: snapshotContent,
        reason,
        wordCount: wordCount(snapshotContent),
      });
      setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 50));
      lastSnapshotRef.current = { chapterId: activeChapter.id, content: snapshot.content, title: snapshot.title };
      if (reason === "manual") notify("success", "Checkpoint saved", `${snapshot.word_count.toLocaleString()} words preserved`);
      return snapshot;
    } catch (error) {
      notify("error", "Checkpoint could not be saved", String(error));
      return null;
    } finally {
      setSnapshotSaving(false);
    }
  };

  const openHistory = async () => {
    if (!activeChapter) return;
    setHistoryOpen(true);
    setSnapshotLoading(true);
    try {
      let list = await api.listChapterSnapshots(activeChapter.id);
      if (list.length === 0 && content.trim()) {
        const snapshot = await createChapterSnapshot("auto", title, content);
        if (snapshot) list = [snapshot];
      }
      setSnapshots(list);
      const latest = list[0];
      lastSnapshotRef.current = latest ? { chapterId: activeChapter.id, content: latest.content, title: latest.title } : null;
    } catch (error) {
      notify("error", "Version history could not be loaded", String(error));
    } finally {
      setSnapshotLoading(false);
    }
  };

  const restoreSnapshot = (snapshot: ChapterSnapshot) => {
    if (!activeChapter) return;
    confirmation.ask({
      title: "Restore this checkpoint?",
      description: `The current draft will be kept as a safety checkpoint first, then replaced with the version from ${snapshotTime(snapshot.created_at)}.`,
      confirmLabel: "Restore checkpoint",
      onConfirm: async () => {
        await createChapterSnapshot("safety", title, content);
        setTitle(snapshot.title);
        setContent(snapshot.content);
        markDraft({ title: snapshot.title, content: snapshot.content });
        try {
          await updateChapter(activeChapter.id, snapshot.title, snapshot.content, activeChapter.chapter_kind, activeChapter.toc_include, activeChapter.toc_heading_exclusions);
          draftRef.current.dirty = false;
          setSaveState("saved");
          setHistoryOpen(false);
          notify("success", "Checkpoint restored", `${snapshot.word_count.toLocaleString()} words restored`);
        } catch (error) {
          notify("error", "Checkpoint could not be restored", String(error));
        }
      },
    });
  };

  const deleteSnapshot = (snapshot: ChapterSnapshot) => {
    confirmation.ask({
      title: "Delete this checkpoint?",
      description: "This saved version will be permanently removed from local history.",
      confirmLabel: "Delete checkpoint",
      onConfirm: async () => {
        try {
          await api.deleteChapterSnapshot(snapshot.id);
          setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
          notify("success", "Checkpoint deleted");
        } catch (error) {
          notify("error", "Checkpoint could not be deleted", String(error));
        }
      },
    });
  };

  useEffect(() => {
    if (!activeChapter) return;
    let cancelled = false;
    void api.listChapterSnapshots(activeChapter.id).then((list) => {
      if (cancelled) return;
      setSnapshots(list);
      const latest = list[0];
      lastSnapshotRef.current = latest ? { chapterId: activeChapter.id, content: latest.content, title: latest.title } : null;
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeChapter?.id]);

  useEffect(() => {
    if (!activeChapter) return;
    const timer = window.setInterval(() => {
      const draft = draftRef.current;
      if (draft.id !== activeChapter.id || !draft.dirty) return;
      const last = lastSnapshotRef.current;
      if (last?.chapterId === activeChapter.id && last.content === draft.content) return;
      void createChapterSnapshot("auto", draft.title, draft.content);
    }, 2 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [activeChapter?.id]);

  useEffect(() => {
    if (!historyOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen]);

  const syncCanvasSelection = (block: CanvasBlock, event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const editor = event.currentTarget;
    editorRef.current = editor;
    activeEditorMapRef.current = { sourceStart: block.start, prefixLength: block.editPrefix.length };
    setEditorSelection({ start: block.start + block.editPrefix.length + editor.selectionStart, end: block.start + block.editPrefix.length + editor.selectionEnd, titleFocused: false });
  };

  const changeLayout = (change: (layout: BookLayout) => BookLayout) => {
    const nextLayout = change(inspectorLayoutRef.current);
    inspectorLayoutRef.current = nextLayout;
    setInspectorLayout(nextLayout);
    if (layoutHistoryTimerRef.current !== null) window.clearTimeout(layoutHistoryTimerRef.current);
    layoutHistoryTimerRef.current = window.setTimeout(() => {
      layoutHistoryTimerRef.current = null;
      commitHistory();
    }, 350);
    const currentBook = useBooks.getState().books.find((item) => item.id === book.id) ?? book;
    void updateBook(currentBook.id, bookInputFromBook(currentBook, serializeBookLayout(nextLayout))).catch((error) => {
      inspectorLayoutRef.current = layoutForBook(currentBook);
      setInspectorLayout(inspectorLayoutRef.current);
      notify("error", "Typography could not be saved", String(error));
    });
  };

;

  const setFreeLayout = (free: boolean) => {
    const currentlyFree = chapterUsesFreeLayout(content);
    if (currentlyFree === free) return;
    const blocks = canvasBlocks(content);
    const canvas = canvasRef.current?.querySelector<HTMLElement>(".books-manuscript-canvas");
    const canvasRect = canvas?.getBoundingClientRect();
    let working = content;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      const element = canvas?.querySelector<HTMLElement>(`[data-block-start="${block.start}"]`);
      const rect = element?.getBoundingClientRect();
      const x = rect && canvasRect ? ((rect.left - canvasRect.left) / Math.max(1, canvasRect.width)) * 100 : block.presentation.x ?? richPresentationLeft(block.presentation);
      const y = rect && canvasRect ? ((rect.top - canvasRect.top) / Math.max(1, canvasRect.width)) * 100 : index * 8;
      const width = rect && canvasRect ? (rect.width / Math.max(1, canvasRect.width)) * 100 : block.presentation.width;
      const patch: Partial<RichPresentation> = free
        ? { x: roundCanvasPercent(x), y: roundCanvasPercent(y), width: roundCanvasPercent(width), align: richAlignForLeft(x, width) }
        : { y: undefined, height: undefined };
      const source = canvasBlockSourceWithPresentation(block, patch);
      working = working.slice(0, block.start) + source + working.slice(block.end);
    }
    working = setChapterFreeLayout(working, free);
    setContent(working);
    markDraft({ content: working });
    setEditorSelection({ start: 0, end: 0, titleFocused: false });
    notify("success", free ? "Free layout enabled" : "Flow layout restored", free ? "Drag any block anywhere on the artboard." : "Blocks are back in document order.");
  };

  const fitCanvasToWidth = () => {
    const host = pageEditorRef.current;
    if (!host) return;
    const styles = window.getComputedStyle(host);
    const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
    const rulerOffset = showRulers ? 20 : 0;
    const available = host.clientWidth - horizontalPadding - rulerOffset - 2;
    setCanvasZoom(Math.max(60, Math.min(100, Math.round((available / 780) * 100))));
  };



  const replaceContentRange = (start: number, end: number, replacement: string, focusEditor = false) => {
    const nextContent = content.slice(0, start) + replacement + content.slice(end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    const replacementEnd = start + replacement.length;
    const cursor = start + Math.max(0, replacement.length - (replacement.startsWith(":::") ? 3 : 0));
    setEditorSelection({ start, end: replacementEnd, titleFocused: false });
    if (focusEditor) requestAnimationFrame(() => { editorRef.current?.focus(); editorRef.current?.setSelectionRange(cursor, cursor); });
  };

  const updateCanvasText = (block: CanvasBlock, value: string, selectionStart: number, selectionEnd: number) => {
    const cleanValue = value.replace(/\u200B/g, "");
    const nextValue = cleanValue === "" ? EMPTY_CANVAS_PARAGRAPH : cleanValue;
    const replacement = `${block.editPrefix}${nextValue}${block.editSuffix}`;
    const nextContent = content.slice(0, block.start) + replacement + content.slice(block.end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    const sourceStart = block.start + block.editPrefix.length + selectionStart;
    const sourceEnd = block.start + block.editPrefix.length + selectionEnd;
    setEditorSelection({ start: sourceStart, end: sourceEnd, titleFocused: false });
  };

  const normalizeCanvasPatch = (block: CanvasBlock, patch: Partial<RichPresentation>) => {
    const nextPatch = { ...patch };
    if (nextPatch.width !== undefined) nextPatch.width = Math.min(100, Math.max(20, Math.round(nextPatch.width)));
    if (nextPatch.align !== undefined && nextPatch.x === undefined) nextPatch.x = undefined;
    const width = nextPatch.width ?? block.presentation.width;
    if (nextPatch.x !== undefined) nextPatch.x = clampPresentationX(nextPatch.x, width);
    if (nextPatch.y !== undefined) nextPatch.y = clampPresentationY(nextPatch.y);
    if (nextPatch.height !== undefined) nextPatch.height = clampPresentationHeight(nextPatch.height);
    if (nextPatch.z !== undefined) nextPatch.z = clampPresentationZ(nextPatch.z);
    return nextPatch;
  };

  const canvasBlockSourceWithPresentation = (block: CanvasBlock, patch: Partial<RichPresentation>) => {
    const nextPatch = normalizeCanvasPatch(block, patch);
    if (block.kind === "image" && block.image) {
      return `${block.image.indent}${imageMarkdown(block.image.alt, block.image.source, { ...block.image.presentation, ...nextPatch })}`;
    }
    if (block.kind === "table") {
      return tableBlockText(block.tableLines ?? [], { ...(block.tableOptions ?? tableDataFromValue(null)), ...nextPatch });
    }
    if (block.kind === "chart" && block.chart) {
      return chartBlockText({ ...block.chart, ...nextPatch });
    }
    if (block.kind === "callout") {
      const presentation = { ...(block.calloutPresentation ?? DEFAULT_RICH_PRESENTATION), ...nextPatch };
      return calloutBlockText(block.calloutTitle ?? "Note", block.calloutTone ?? "note", block.source.split(/\r?\n/).slice(2, -1).join("\n"), presentation);
    }
    return canvasTextSource(block.source, { ...block.presentation, ...nextPatch });
  };

  const changeCanvasPresentation = (block: CanvasBlock, patch: Partial<RichPresentation>) => {
    replaceContentRange(block.start, block.end, canvasBlockSourceWithPresentation(block, patch));
  };

  const placeCanvasBlock = (block: CanvasBlock, patch: Partial<RichPresentation>, dropIndex: number | null) => {
    const source = canvasBlockSourceWithPresentation(block, patch);
    let nextContent = content.slice(0, block.start) + source + content.slice(block.end);
    let nextStart = block.start;
    let nextEnd = block.start + source.length;
    if (dropIndex !== null) {
      const moved = moveCanvasBlockInContent(nextContent, nextStart, nextEnd, dropIndex);
      nextContent = moved.content;
      nextStart = moved.start;
      nextEnd = moved.end;
    }
    if (nextContent === content) return;
    setContent(nextContent);
    markDraft({ content: nextContent });
    setEditorSelection({ start: nextStart, end: nextEnd, titleFocused: false });
  };

;

  const replaceCanvasArtwork = async (block: CanvasBlock) => {
    if (block.kind !== "image" || !block.image) return;
    try {
      const [{ open }, { readFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      });
      if (typeof path !== "string") return;
      const data = await readFile(path);
      if (data.byteLength > 12 * 1024 * 1024) {
        notify("error", "Image is too large", "Choose an image smaller than 12 MB.");
        return;
      }
      const presentation = block.image.presentation;
      replaceContentRange(block.start, block.end, `${block.image.indent}${imageMarkdown(imageAltText(path), imageDataUri(imageMimeType(path), data), presentation)}`);
      notify("success", "Artwork replaced", imageAltText(path));
    } catch (error) {
      notify("error", "Artwork could not be replaced", String(error));
    }
  };

  const restyleCanvasTextBlock = (block: CanvasBlock, role: BookTextRole) => {
    if (block.kind !== "text") return;
    replaceContentRange(block.start, block.end, restyleCanvasTextSource(block.source, role, block.presentation));
  };

  const breakCanvasParagraph = (block: CanvasBlock, selectionStart: number, selectionEnd: number) => {
    const canvasWidth = canvasRef.current?.querySelector<HTMLElement>(".books-manuscript-canvas")?.clientWidth ?? 1;
    const heightPercent = ((editorRef.current?.scrollHeight ?? 24) / Math.max(1, canvasWidth)) * 100;
    const afterY = freeLayout ? roundCanvasPercent((block.presentation.y ?? 0) + heightPercent + 1.5) : undefined;
    const split = canvasParagraphBreak(block, selectionStart, selectionEnd, afterY !== undefined ? { y: afterY } : {});
    if (!split) return;
    const nextContent = content.slice(0, block.start) + split.source + content.slice(block.end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    const afterStart = block.start + split.afterOffset;
    setEditorSelection({ start: afterStart, end: afterStart, titleFocused: false });
    setPendingCanvasFocus({ start: afterStart, cursor: 0 });
  };

  const textBlockAtSelection = () => {
    if (editorSelection.titleFocused) return null;
    return canvasBlocks(content).find((block) => block.kind === "text" && block.start <= editorSelection.start && block.end >= editorSelection.start) ?? null;
  };

  const setSelectedLayer = (direction: "front" | "back") => {
    const blocks = canvasBlocks(content);
    const block = blocks.find((item) => item.start === editorContext.start && item.end === editorContext.end);
    if (!block) return;
    const values = blocks.map((item) => item.presentation.z ?? 0);
    const z = direction === "front" ? Math.max(0, ...values) + 1 : Math.min(0, ...values) - 1;
    changeCanvasPresentation(block, { z });
  };

  const duplicateCanvasRange = (start: number, end: number) => {
    const parsed = canvasBlocks(content).find((block) => block.start === start && block.end === end);
    const source = freeLayout && parsed
      ? canvasBlockSourceWithPresentation(parsed, { y: roundCanvasPercent((parsed.presentation.y ?? 0) + 4) })
      : content.slice(start, end);
    if (!source) return;
    const insertion = `\n\n${source}`;
    const nextContent = content.slice(0, end) + insertion + content.slice(end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    const duplicateStart = end + 2;
    setEditorSelection({ start: duplicateStart, end: duplicateStart + source.length, titleFocused: false });
  };

  const startCanvasResize = (event: React.PointerEvent<HTMLButtonElement>, block: CanvasBlock, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas) return;
    const element = canvasRef.current?.querySelector<HTMLElement>(`[data-block-start="${block.start}"]`);
    const measuredHeight = element ? (element.getBoundingClientRect().height / Math.max(1, canvas.width)) * 100 : 8;
    const initialWidth = block.presentation.width;
    const initialLeft = richPresentationLeft(block.presentation);
    const initialHeight = block.kind === "image" && block.image?.presentation.height !== undefined
      ? block.image.presentation.height
      : block.presentation.height ?? measuredHeight;
    const initialY = freeLayout ? block.presentation.y ?? 0 : 0;
    const movesLeft = direction.includes("w");
    const movesRight = direction.includes("e");
    const movesTop = direction.includes("n");
    const movesBottom = direction.includes("s");
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    let nextWidth = initialWidth;
    let nextLeft = initialLeft;
    let nextHeight = initialHeight;
    let nextY = initialY;
    const onMove = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startClientX) / Math.max(1, canvas.width)) * 100;
      const dy = ((moveEvent.clientY - startClientY) / Math.max(1, canvas.width)) * 100;
      if (movesLeft) {
        nextLeft = Math.min(Math.max(0, initialLeft + dx), initialLeft + initialWidth - 20);
        nextWidth = initialLeft + initialWidth - nextLeft;
      } else if (movesRight) {
        nextWidth = Math.min(100 - initialLeft, Math.max(20, initialWidth + dx));
        nextLeft = initialLeft;
      }
      if (movesTop) {
        nextY = Math.min(Math.max(0, initialY + dy), initialY + initialHeight - 4);
        nextHeight = initialY + initialHeight - nextY;
      } else if (movesBottom) {
        nextHeight = Math.min(400, Math.max(4, initialHeight + dy));
        nextY = initialY;
      }
      if (!moveEvent.altKey) {
        nextWidth = Math.round(nextWidth * 2) / 2;
        if (movesTop || movesBottom) nextHeight = Math.round(nextHeight * 2) / 2;
      }
      setCanvasResize({ start: block.start, width: roundCanvasPercent(nextWidth), x: roundCanvasPercent(nextLeft), ...(movesTop || movesBottom ? { height: roundCanvasPercent(nextHeight), y: roundCanvasPercent(nextY) } : {}) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setCanvasResize(null);
      const changed = Math.abs(nextWidth - initialWidth) > 0.05 || Math.abs(nextLeft - initialLeft) > 0.05 || ((movesTop || movesBottom) && (Math.abs(nextHeight - initialHeight) > 0.05 || Math.abs(nextY - initialY) > 0.05));
      if (!changed) return;
      placeCanvasBlock(block, {
        width: roundCanvasPercent(nextWidth),
        x: roundCanvasPercent(nextLeft),
        align: richAlignForLeft(nextLeft, nextWidth),
        ...((movesTop || movesBottom) ? { height: roundCanvasPercent(nextHeight) } : {}),
        ...(freeLayout && (movesTop || movesBottom) ? { y: roundCanvasPercent(nextY) } : {}),
      }, null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const moveCanvasRange = (start: number, end: number, direction: -1 | 1) => {
    const blocks = canvasBlocks(content);
    const index = blocks.findIndex((block) => block.start === start && block.end === end);
    const neighbor = index + direction;
    if (index < 0 || neighbor < 0 || neighbor >= blocks.length) return;
    const current = blocks[index];
    const adjacent = blocks[neighbor];
    const currentSource = content.slice(current.start, current.end);
    const adjacentSource = content.slice(adjacent.start, adjacent.end);
    const rangeStart = direction < 0 ? adjacent.start : current.start;
    const rangeEnd = direction < 0 ? current.end : adjacent.end;
    const gap = direction < 0 ? content.slice(adjacent.end, current.start) : content.slice(current.end, adjacent.start);
    const replacement = direction < 0 ? `${currentSource}${gap}${adjacentSource}` : `${adjacentSource}${gap}${currentSource}`;
    const nextContent = content.slice(0, rangeStart) + replacement + content.slice(rangeEnd);
    const nextStart = direction < 0 ? rangeStart : rangeStart + adjacentSource.length + gap.length;
    setContent(nextContent);
    markDraft({ content: nextContent });
    setEditorSelection({ start: nextStart, end: nextStart + currentSource.length, titleFocused: false });
  };

  const deleteCanvasRange = (start: number, end: number) => {
    const removeStart = start > 0 && content[start - 1] === "\n" ? start - 1 : start;
    const removeEnd = end < content.length && content[end] === "\n" ? end + 1 : end;
    const nextContent = content.slice(0, removeStart) + content.slice(removeEnd);
    setContent(nextContent);
    markDraft({ content: nextContent });
    setEditorSelection({ start: removeStart, end: removeStart, titleFocused: false });
  };

  const confirmDeleteCanvasRange = (start: number, end: number, restoreFocus?: HTMLElement | null) => {
    const selected = editorContextFor(content, start, end).label.toLocaleLowerCase();
    confirmation.ask({
      title: `Delete this ${selected}?`,
      description: "The selected manuscript element will be removed from this section. This cannot be undone after the section is saved.",
      confirmLabel: `Delete ${selected}`,
      onConfirm: () => deleteCanvasRange(start, end),
    }, restoreFocus);
  };

  const replaceSelection = (replacement: string, selectionStart = 0, selectionEnd = replacement.length) => {
    const editor = editorRef.current;
    const start = editorSelection.titleFocused ? content.length : editorSelection.start;
    const end = editorSelection.titleFocused ? content.length : editorSelection.end;
    const nextContent = content.slice(0, start) + replacement + content.slice(end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    setEditorSelection({ start: start + selectionStart, end: start + selectionEnd, titleFocused: false });
    if (editor) requestAnimationFrame(() => {
      editor.focus();
      const localStart = Math.max(0, start + selectionStart - activeEditorMapRef.current.sourceStart - activeEditorMapRef.current.prefixLength);
      const localEnd = Math.max(0, start + selectionEnd - activeEditorMapRef.current.sourceStart - activeEditorMapRef.current.prefixLength);
      editor.setSelectionRange(localStart, localEnd);
    });
  };

  const applyFormat = (prefix: string, suffix = "") => {
    const editor = editorRef.current;
    const start = editorSelection.titleFocused ? content.length : editorSelection.start;
    const end = editorSelection.titleFocused ? content.length : editorSelection.end;
    const selected = content.slice(start, end) || "your text";
    const next = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(next);
    markDraft({ content: next });
    setEditorSelection({ start: start + prefix.length, end: start + prefix.length + selected.length, titleFocused: false });
    if (editor) requestAnimationFrame(() => {
      editor.focus();
      const localStart = Math.max(0, start + prefix.length - activeEditorMapRef.current.sourceStart - activeEditorMapRef.current.prefixLength);
      const localEnd = Math.max(0, start + prefix.length + selected.length - activeEditorMapRef.current.sourceStart - activeEditorMapRef.current.prefixLength);
      editor.setSelectionRange(localStart, localEnd);
    });
  };

  const applyHeading = (level: number) => {
    if (selectedTextBlock) {
      const role: BookTextRole = level > 0 ? `heading${Math.min(6, Math.max(1, level))}` as BookTextRole : "paragraph";
      replaceContentRange(selectedTextBlock.start, selectedTextBlock.end, restyleCanvasTextSource(selectedTextBlock.source, role, selectedTextBlock.presentation));
      return;
    }
    const editor = editorRef.current;
    const start = content.lastIndexOf("\n", editorSelection.start - 1) + 1;
    const endIndex = content.indexOf("\n", editorSelection.end);
    const end = endIndex === -1 ? content.length : endIndex;
    const selectedLines = content.slice(start, end).split("\n");
    const prefix = level > 0 ? `${"#".repeat(level)} ` : "";
    const nextLines = selectedLines.map((line) => `${prefix}${line.replace(/^\s*#{1,6}\s+/, "")}`);
    const next = content.slice(0, start) + nextLines.join("\n") + content.slice(end);
    setContent(next);
    markDraft({ content: next });
    setEditorSelection({ start, end: start + nextLines.join("\n").length, titleFocused: false });
    if (editor) requestAnimationFrame(() => {
      editor.focus();
      const localStart = Math.max(0, start - activeEditorMapRef.current.sourceStart - activeEditorMapRef.current.prefixLength);
      const localEnd = Math.max(0, start + nextLines.join("\n").length - activeEditorMapRef.current.sourceStart - activeEditorMapRef.current.prefixLength);
      editor.setSelectionRange(localStart, localEnd);
    });
  };

  const freeInsertionY = (preferredStart?: number) => {
    if (!freeLayout) return undefined;
    const canvas = canvasRef.current?.querySelector<HTMLElement>(".books-manuscript-canvas");
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvas || !canvasRect) return undefined;
    const preferred = preferredStart !== undefined ? canvas.querySelector<HTMLElement>(`[data-block-start="${preferredStart}"]`) : null;
    if (preferred) {
      const rect = preferred.getBoundingClientRect();
      return roundCanvasPercent(((rect.bottom - canvasRect.top) / Math.max(1, canvasRect.width)) * 100 + 2);
    }
    let bottom = 0;
    canvas.querySelectorAll<HTMLElement>("[data-canvas-block]").forEach((element) => {
      const rect = element.getBoundingClientRect();
      bottom = Math.max(bottom, rect.bottom - canvasRect.top);
    });
    return roundCanvasPercent((bottom / Math.max(1, canvasRect.width)) * 100 + 2);
  };

  const withFreeY = (markdown: string, y: number | undefined) => {
    if (y === undefined) return markdown;
    const parsed = canvasBlocks(markdown.trim())[0];
    if (!parsed) return markdown;
    if (parsed.kind === "image" && parsed.image) return `${imageMarkdown(parsed.image.alt, parsed.image.source, { ...parsed.image.presentation, y })}\n`;
    if (parsed.kind === "table") return `${tableBlockText(parsed.tableLines ?? [], { ...(parsed.tableOptions ?? tableDataFromValue(null)), y })}\n`;
    if (parsed.kind === "chart" && parsed.chart) return `${chartBlockText({ ...parsed.chart, y })}\n`;
    if (parsed.kind === "callout") return `${calloutBlockText(parsed.calloutTitle ?? "Note", parsed.calloutTone ?? "note", parsed.source.split(/\r?\n/).slice(2, -1).join("\n"), { ...(parsed.calloutPresentation ?? DEFAULT_RICH_PRESENTATION), y })}\n`;
    return `${canvasTextSource(parsed.source, { ...parsed.presentation, y })}\n`;
  };

  const insertAsset = (markdown: string) => {
    const freeY = freeInsertionY(editorSelection.start);
    const nextMarkdown = withFreeY(markdown, freeY);
    const selectedVisual = canvasBlocks(content).find((block) => block.kind !== "text" && block.start === editorSelection.start && block.end === editorSelection.end);
    if (selectedVisual && !editorSelection.titleFocused) {
      const insertAt = selectedVisual.end;
      const insertion = `\n\n${nextMarkdown.trim()}`;
      const nextContent = content.slice(0, insertAt) + insertion + content.slice(insertAt);
      setContent(nextContent);
      markDraft({ content: nextContent });
      setEditorSelection({ start: insertAt + 2, end: insertAt + 2 + insertion.length - 2, titleFocused: false });
    } else {
      replaceSelection(nextMarkdown);
    }
    setAssetOpen(false);
  };

  const insertRichBlock = (block: string) => {
    const value = withFreeY(block, freeInsertionY(editorSelection.start));
    const cursor = Math.max(0, value.length - 4);
    replaceSelection(value, cursor, cursor);
  };

  const insertTable = () => insertRichBlock(tableBlockText(["| Measure | Current | Target |", "| :--- | ---: | ---: |", "| Example | 42 | 60 |"], { caption: "A clear comparison", align: "left", striped: true, compact: false, width: 100 }));
  const insertChart = () => insertRichBlock(chartBlockText(defaultChartData()));
  const insertCallout = () => insertRichBlock(calloutBlockText("A note for the reader", "note", "Use this space for context, a caveat, or a memorable detail."));

  const editorContext = useMemo(() => editorContextFor(content, editorSelection.start, editorSelection.end, editorSelection.titleFocused), [content, editorSelection]);
  const selectedTextBlock = useMemo(() => canvasBlocks(content).find((block) => block.kind === "text" && block.start <= editorSelection.start && block.end >= editorSelection.start) ?? null, [content, editorSelection.start]);
  const focusSelectedText = () => {
    const preview = canvasRef.current?.querySelector<HTMLElement>(".books-canvas-text-block.selected .books-canvas-text-preview");
    preview?.click();
  };
  const applyInlineFormat = (prefix: string, suffix = "") => {
    const editor = editorRef.current;
    const editingSelectedBlock = Boolean(editor?.isConnected && selectedTextBlock && activeEditorMapRef.current.sourceStart === selectedTextBlock.start);
    if (editingSelectedBlock) {
      applyFormat(prefix, suffix);
      return;
    }
    if (!selectedTextBlock) return;
    const nextSource = restyleCanvasTextSource(`${prefix}${selectedTextBlock.display}${suffix}`, selectedTextBlock.role ?? "paragraph", selectedTextBlock.presentation);
    replaceContentRange(selectedTextBlock.start, selectedTextBlock.end, nextSource);
    setEditorSelection({ start: selectedTextBlock.start, end: selectedTextBlock.start + nextSource.length, titleFocused: false });
  };

  const insertImageFile = async (file: File) => {
    try {
      insertAsset(await imageFileToMarkdown(file));
    } catch (error) {
      notify("error", "Image could not be added", String(error));
    }
  };

  const onEditorDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (Array.from(event.dataTransfer.types).includes("application/x-note-me-artwork") || Array.from(event.dataTransfer.files).some((file) => file.type.startsWith("image/"))) event.preventDefault();
  };

  const onEditorDrop = (event: React.DragEvent<HTMLElement>) => {
    const artwork = event.dataTransfer.getData("application/x-note-me-artwork");
    if (artwork) {
      event.preventDefault();
      insertAsset(artwork);
      return;
    }
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    void insertImageFile(file);
  };

  const onEditorPaste = (event: React.ClipboardEvent<HTMLElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    void insertImageFile(file);
  };

  const focusFindMatch = (query: string, index: number) => {
    const match = findOccurrences(content, query)[index];
    if (!match) return;
    const block = canvasBlocks(content).find((item) => match.start >= item.start && match.start <= item.end);
    if (block) {
      setEditorSelection({ start: block.start, end: block.end, titleFocused: false });
      requestAnimationFrame(() => {
        canvasRef.current?.querySelector<HTMLElement>(`[data-block-start="${block.start}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(match.start, match.end);
    });
  };

  const moveFindMatch = (direction: -1 | 1) => {
    const matches = findOccurrences(content, findQuery);
    if (matches.length === 0) return;
    const nextIndex = (findIndex + direction + matches.length) % matches.length;
    setFindIndex(nextIndex);
    focusFindMatch(findQuery, nextIndex);
  };

  const closeFind = () => {
    setFindOpen(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const openFind = (withReplace = false) => {
    setFindOpen(true);
    if (withReplace) setReplaceOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => (withReplace ? replaceInputRef.current : findInputRef.current)?.focus()));
  };

  const toggleReplace = () => {
    setReplaceOpen((value) => {
      if (!value) requestAnimationFrame(() => replaceInputRef.current?.focus());
      return !value;
    });
  };

  const replaceCurrentMatch = () => {
    const matches = findOccurrences(content, findQuery);
    if (matches.length === 0) return;
    const match = matches[Math.min(findIndex, matches.length - 1)];
    const nextContent = content.slice(0, match.start) + replaceQuery + content.slice(match.end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    const remainingMatches = findOccurrences(nextContent, findQuery).length;
    setFindIndex((value) => Math.min(value, Math.max(0, remainingMatches - 1)));
    const cursor = match.start + replaceQuery.length;
    setEditorSelection({ start: cursor, end: cursor, titleFocused: false });
  };

  const replaceAllMatches = () => {
    const matches = findOccurrences(content, findQuery);
    if (matches.length === 0) return;
    let nextContent = content;
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index];
      nextContent = nextContent.slice(0, match.start) + replaceQuery + nextContent.slice(match.end);
    }
    setContent(nextContent);
    markDraft({ content: nextContent });
    setFindIndex(0);
    setEditorSelection({ start: 0, end: 0, titleFocused: false });
  };

  const startSprint = () => {
    const remaining = sprintMinutes * 60000;
    sprintStartWordsRef.current = currentManuscriptWords;
    setSprintStartWords(currentManuscriptWords);
    setSprintRemaining(remaining);
    setSprintEndsAt(Date.now() + remaining);
    setSprintFinished(false);
    setSprintOpen(false);
  };

  const resumeSprint = () => {
    const remaining = sprintRemaining && sprintRemaining > 0 ? sprintRemaining : sprintMinutes * 60000;
    setSprintRemaining(remaining);
    setSprintEndsAt(Date.now() + remaining);
  };

  const pauseSprint = () => {
    if (sprintEndsAt === null) return;
    setSprintRemaining(Math.max(0, sprintEndsAt - Date.now()));
    setSprintEndsAt(null);
  };

  const resetSprint = () => {
    setSprintEndsAt(null);
    setSprintRemaining(null);
    setSprintStartWords(currentManuscriptWords);
    setSprintFinished(false);
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const findKey = event.code === "KeyF" || event.key.toLowerCase() === "f";
      if (modifier && event.altKey && findKey) {
        event.preventDefault();
        openFind(true);
      } else if (modifier && findKey) {
        event.preventDefault();
        openFind();
      } else if (event.key === "Escape" && findOpen) {
        event.preventDefault();
        closeFind();
      } else if (event.key === "Escape" && sprintOpen) {
        event.preventDefault();
        setSprintOpen(false);
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [findOpen, sprintOpen]);

  const onEditorKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && !event.altKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (modifier && !event.altKey && event.key.toLowerCase() === "y") {
      event.preventDefault();
      event.stopPropagation();
      redo();
      return;
    }
    if (modifier && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onNavigateSection(event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (modifier && event.altKey) {
      const role = ({ Digit0: "paragraph", Digit1: "heading1", Digit2: "heading2", Digit3: "heading3", KeyQ: "quote" } as Record<string, BookTextRole>)[event.code];
      const block = role ? textBlockAtSelection() : null;
      if (role && block) {
        event.preventDefault();
        event.stopPropagation();
        restyleCanvasTextBlock(block, role);
        return;
      }
    }
    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveNow();
      return;
    }
    if (modifier && event.key.toLowerCase() === "b") { event.preventDefault(); applyFormat("**", "**"); return; }
    if (modifier && event.key.toLowerCase() === "i") { event.preventDefault(); applyFormat("*", "*"); return; }
    if (modifier && event.key.toLowerCase() === "u") { event.preventDefault(); applyFormat("++", "++"); return; }
    if (modifier && event.shiftKey && event.key.toLowerCase() === "x") { event.preventDefault(); applyFormat("~~", "~~"); return; }
    const editor = editorRef.current;
    if (event.key === "Enter" && editor && editorSelection.start === editorSelection.end) {
      const cursor = editorSelection.start;
      const lineStart = content.lastIndexOf("\n", cursor - 1) + 1;
      const line = content.slice(lineStart, cursor);
      const listMarker = /^(\s*(?:[-*+]\s+|\d+[.)]\s+))/.exec(line);
      if (listMarker && line.slice(listMarker[0].length).trim()) {
        event.preventDefault();
        const marker = listMarker[1].replace(/\s+$/, " ");
        replaceSelection(`\n${marker}`, `\n${marker}`.length, `\n${marker}`.length);
        return;
      }
    }
    if (event.key === "Tab") {
      event.preventDefault();
      replaceSelection("  ", 2, 2);
    }
  };

  async function saveNow() {
    if (!activeChapter || saveState === "saved") return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const version = draftVersionRef.current;
    setSaveState("saving");
    try {
      await updateChapter(activeChapter.id, title.trim() || "Untitled chapter", content, activeChapter.chapter_kind, activeChapter.toc_include, activeChapter.toc_heading_exclusions);
      if (draftVersionRef.current === version && draftRef.current.id === activeChapter.id) {
        draftRef.current.dirty = false;
        setSaveState("saved");
      }
      void createChapterSnapshot("manual", title.trim() || "Untitled chapter", content);
    } catch (error) {
      if (draftRef.current.id === activeChapter.id) setSaveState("dirty");
      notify("error", "Chapter could not be saved", String(error));
    }
  }

  if (!activeChapter) {
    return (
      <div className="books-empty-editor">
        <BookOpen size={30} />
        <h2>Your manuscript is ready.</h2>
        <p>Create a chapter to begin the first page.</p>
        <button className="books-primary-action" onClick={onNewChapter}><Plus size={15} /> Add chapter</button>
      </div>
    );
  }

  const chapterWords = wordCount(content);
  const totalWords = currentManuscriptWords;
  const findMatches = findOccurrences(content, findQuery);
  const wordGoal = Math.max(1, book.word_goal || 50000);
  const manuscriptBody = (
    <div ref={canvasRef} className="books-canvas-host">
      <ManuscriptCanvas
        content={content}
        selection={editorSelection}
        typography={inspectorLayout.typography}
        paragraphStyles={inspectorLayout.paragraphStyles}
        freeLayout={freeLayout}
        onSelectVisual={(block) => { editorRef.current?.blur(); setEditorSelection({ start: block.start, end: block.end, titleFocused: false }); }}
        onTextChange={updateCanvasText}
        onTextSelection={syncCanvasSelection}
        onEditorKeyDown={onEditorKeyDown}
        onEditorDragOver={onEditorDragOver}
        onEditorDrop={onEditorDrop}
        onEditorPaste={onEditorPaste}
        onResizeStart={startCanvasResize}
        onDeleteBlock={(block) => confirmDeleteCanvasRange(block.start, block.end)}
        onInsertArtwork={insertAsset}
        onChangePresentation={changeCanvasPresentation}
        onMoveRange={moveCanvasRange}
        onPlaceBlock={placeCanvasBlock}
        onParagraphBreak={breakCanvasParagraph}
        focusRequest={pendingCanvasFocus}
        onFocusHandled={() => setPendingCanvasFocus(null)}
        resizing={canvasResize}
      />
    </div>
  );
  const activeChapterIndex = chapters.findIndex((chapter) => chapter.id === activeChapter.id);
  const canvasBook = { ...book, layout_json: serializeBookLayout(inspectorLayout) };
  return (
    <>
    <div className={`books-editor-screen ${focusMode ? "focus-mode" : ""}`} style={manuscriptStyle(canvasBook)}>
      <div className="books-editor-toolbar">
          <div className="books-editor-context"><span>{chapterDisplayLabel(activeChapter, chapters.findIndex((chapter) => chapter.id === activeChapter.id), chapters)}</span><ChevronRight size={13} /><strong>{title || "Untitled chapter"}</strong></div>
        <div className="books-editor-actions">
           <span className={`books-save-state ${saveState}`} aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Saved locally"}</span>
            <div className="books-undo-group" role="group" aria-label="Editing history">
              <button className="books-quiet-button" onClick={undo} disabled={!undoState.canUndo} title="Undo (⌘Z)" aria-label="Undo"><Undo2 size={15} /></button>
              <button className="books-quiet-button" onClick={redo} disabled={!undoState.canRedo} title="Redo (⌘⇧Z)" aria-label="Redo"><Redo2 size={15} /></button>
            </div>
            <button className="books-quiet-button" onClick={() => openFind()} title="Find in section (Ctrl/Cmd+F)" aria-label="Find in section"><Search size={15} /></button>
            <button className={`books-quiet-button ${inspectorOpen ? "active" : ""}`} onClick={() => setInspectorOpen((value) => !value)} title={inspectorOpen ? "Hide contextual tools" : "Show contextual tools"} aria-label={inspectorOpen ? "Hide contextual tools" : "Show contextual tools"} aria-pressed={inspectorOpen}>{inspectorOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}</button>
            <button className={`books-quiet-button ${focusMode ? "active" : ""}`} onClick={() => onFocusModeChange(!focusMode)} title={focusMode ? "Exit focus mode" : "Enter focus mode"} aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"} aria-pressed={focusMode}><WandSparkles size={15} /></button>
          <button className="books-outline-button" onClick={() => void saveNow()} disabled={saveState !== "dirty"} title="Save chapter and keep a checkpoint (⌘S)"><Save size={13} /> Save</button>
          <button className={`books-outline-button ${historyOpen ? "active" : ""}`} onClick={() => void openHistory()} title="Version history" aria-haspopup="dialog"><History size={14} /> History</button>
           <button className="books-outline-button" onClick={onOpenOutline}><LayoutList size={14} /> Outline</button>
           <span className={`book-status-pill ${book.status}`}>{book.status.replace("revising", "in revision")}</span>
           <button className="books-quiet-button" onClick={onOpenSettings} title="Book settings" aria-label="Book settings"><Settings2 size={15} /></button>
         </div>
      </div>
       <div className="books-editor-workspace">
         <div className="books-writing-column">
            <div className="books-writing-topline">
              <div className="books-section-stepper" aria-label="Section navigation"><button onClick={() => onNavigateSection(-1)} disabled={activeChapterIndex <= 0} aria-label="Previous section" title="Previous section (⌘⌥↑)"><ArrowLeft size={12} /> Previous</button><button onClick={() => onNavigateSection(1)} disabled={activeChapterIndex < 0 || activeChapterIndex >= chapters.length - 1} aria-label="Next section" title="Next section (⌘⌥↓)">Next <ChevronRight size={12} /></button></div>
              <span>{chapterWords.toLocaleString()} words</span>
              <span>{Math.max(1, Math.ceil(chapterWords / 250))} min read</span>
              <div className="books-sprint-control">
                <button className={`books-sprint-chip ${sprintRunning ? "running" : sprintPaused ? "paused" : sprintFinished ? "finished" : ""}`} onClick={() => setSprintOpen((value) => !value)} title="Writing sprint timer" aria-label="Writing sprint timer" aria-expanded={sprintOpen}>
                  <Timer size={12} />
                  <span>{sprintRunning || sprintPaused ? sprintClock(sprintRemaining ?? 0) : sprintFinished ? "Sprint done" : "Sprint"}</span>
                </button>
                {sprintOpen && (
                  <div className="books-sprint-popover" role="dialog" aria-label="Writing sprint">
                    <div className="books-sprint-heading"><div><strong>Writing sprint</strong><span>Focused, timed writing</span></div><button onClick={() => setSprintOpen(false)} aria-label="Close writing sprint"><X size={13} /></button></div>
                    {!(sprintRunning || sprintPaused) && (
                      <div className="books-sprint-presets" role="group" aria-label="Sprint length">
                        {SPRINT_PRESETS.map((minutes) => <button key={minutes} className={sprintMinutes === minutes ? "active" : ""} onClick={() => setSprintMinutes(minutes)}>{minutes} min</button>)}
                      </div>
                    )}
                    {sprintRunning || sprintPaused ? (
                      <div className="books-sprint-status">
                        <strong>{sprintClock(sprintRemaining ?? 0)}</strong>
                        <span>{sprintWords.toLocaleString()} words this sprint</span>
                        <div className="books-sprint-actions">
                          <button onClick={sprintRunning ? pauseSprint : resumeSprint}>{sprintRunning ? <Pause size={13} /> : <Play size={13} />} {sprintRunning ? "Pause" : "Resume"}</button>
                          <button onClick={resetSprint}><RotateCcw size={13} /> Reset</button>
                        </div>
                      </div>
                    ) : (
                      <div className="books-sprint-status">
                        {sprintFinished ? <><strong>Sprint complete</strong><span>{sprintWords.toLocaleString()} words written</span></> : <p>Choose a length and write without stopping. A gentle nudge will mark the finish.</p>}
                        <button className="books-sprint-start" onClick={startSprint}><Play size={13} /> {sprintFinished ? "Start another sprint" : "Start sprint"}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="design-mode-chip"><Palette size={12} /> Design canvas</span>
            </div>
             {findOpen && (
              <div className="books-find-bar">
                <div className="books-find-row">
                  <Search size={14} />
                  <input ref={findInputRef} value={findQuery} onChange={(event) => { setFindQuery(event.target.value); setFindIndex(0); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); moveFindMatch(event.shiftKey ? -1 : 1); } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeFind(); } }} placeholder="Find in this section…" aria-label="Find in this section" />
                  <span className="books-find-count" aria-live="polite">{findQuery ? (findMatches.length ? `${findIndex + 1} of ${findMatches.length}` : "No matches") : "Type to search"}</span>
                  <button onClick={() => moveFindMatch(-1)} disabled={!findMatches.length} title="Previous match" aria-label="Previous match"><ArrowUp size={13} /></button>
                  <button onClick={() => moveFindMatch(1)} disabled={!findMatches.length} title="Next match" aria-label="Next match"><ArrowDown size={13} /></button>
                  <button className={replaceOpen ? "active" : ""} onClick={toggleReplace} title="Toggle replace" aria-label="Toggle replace" aria-expanded={replaceOpen}><Replace size={13} /></button>
                  <button onClick={closeFind} title="Close find" aria-label="Close find"><X size={13} /></button>
                </div>
                {replaceOpen && (
                  <div className="books-find-row replace">
                    <Replace size={14} />
                    <input ref={replaceInputRef} value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); replaceCurrentMatch(); } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeFind(); } }} placeholder="Replace with…" aria-label="Replace with" />
                    <button className="books-find-text-button" onClick={replaceCurrentMatch} disabled={!findMatches.length} title="Replace current match">Replace</button>
                    <button className="books-find-text-button" onClick={replaceAllMatches} disabled={!findMatches.length} title="Replace every match">All</button>
                  </div>
                )}
              </div>
            )}
              <div className="books-format-toolbar design-toolbar" role="toolbar" aria-label="Canvas tools">
                <div className="design-tool-group" aria-label="Tools">
                  <button className="active" title="Selection tool" aria-label="Selection tool"><MousePointer2 size={14} /></button>
                  <button onClick={focusSelectedText} disabled={!selectedTextBlock} title="Type tool: edit the selected text box" aria-label="Type tool"><TextCursorInput size={14} /></button>
                </div>
                <div className="design-tool-group" aria-label="Insert objects">
                  <button onClick={() => setAssetOpen((value) => !value)} title="Insert artwork" aria-label="Insert artwork" aria-expanded={assetOpen}><ImagePlus size={15} /></button>
                  <button onClick={insertTable} title="Insert table" aria-label="Insert table"><Table2 size={15} /></button>
                  <button onClick={insertChart} title="Insert chart or graph" aria-label="Insert chart or graph"><BarChart3 size={15} /></button>
                  <button onClick={insertCallout} title="Insert callout" aria-label="Insert callout"><Quote size={15} /></button>
                </div>
                <div className="design-tool-group" aria-label="Insert block">
                  <button onClick={() => insertRichBlock("---")} title="Insert scene break" aria-label="Insert scene break"><Minus size={14} /></button>
                </div>
                <div className="design-toolbar-end">
                  <span className="books-canvas-controlbar-title"><LayoutTemplate size={12} aria-hidden="true" /><strong>{trimWidth} × {trimHeight} in</strong></span>
                  <div className="books-layout-switch" role="group" aria-label="Canvas layout mode">
                    <button className={!freeLayout ? "active" : ""} onClick={() => setFreeLayout(false)} aria-pressed={!freeLayout} title="Flow text blocks in document order"><Rows3 size={12} /> Flow</button>
                    <button className={freeLayout ? "active" : ""} onClick={() => setFreeLayout(true)} aria-pressed={freeLayout} title="Arrange text boxes and objects freely on the artboard"><Move size={12} /> Free</button>
                  </div>
                  <button className="books-page-settings-button" onClick={() => { setEditorSelection({ start: -1, end: -1, titleFocused: false }); setInspectorOpen(true); }} title="Page background and document design" aria-label="Page settings"><PaintBucket size={12} /> Page</button>
                  <div className="books-canvas-zoom" role="group" aria-label="Canvas zoom">
                    <button onClick={() => setCanvasZoom((value) => Math.max(60, value - 10))} disabled={canvasZoom <= 60} title="Zoom out" aria-label="Zoom out"><ZoomOut size={13} /></button>
                    <button className="books-canvas-zoom-value" onClick={() => setCanvasZoom(100)} title="Reset zoom" aria-label={`Reset zoom. Current zoom ${canvasZoom} percent`}>{canvasZoom}%</button>
                    <button onClick={() => setCanvasZoom((value) => Math.min(160, value + 10))} disabled={canvasZoom >= 160} title="Zoom in" aria-label="Zoom in"><ZoomIn size={13} /></button>
                    <button className="books-canvas-zoom-fit" onClick={fitCanvasToWidth} title="Fit page to width" aria-label="Fit page to width">Fit</button>
                  </div>
                  <div className="books-canvas-toggles">
                    <button className={showRulers ? "active" : ""} onClick={() => setShowRulers((value) => !value)} title="Toggle rulers" aria-pressed={showRulers}><Ruler size={13} /> Rulers</button>
                    <button className={showGuides ? "active" : ""} onClick={() => setShowGuides((value) => !value)} title="Toggle margin guides" aria-pressed={showGuides}><Grid3X3 size={13} /> Guides</button>
                  </div>
                </div>
              </div>
            {assetOpen && <BooksAssetDrawer onClose={() => setAssetOpen(false)} onInsert={insertAsset} />}
             <div className="books-page-editor" ref={pageEditorRef}>
                <div className={`books-page-frame ${showRulers ? "with-rulers" : ""}`} style={{ zoom: canvasZoom / 100 }}>
                  {showRulers && <CanvasRulers trimWidth={trimWidth} trimHeight={trimHeight} />}
                  <div className={`books-page-sheet ${showGuides ? "show-guides" : ""} ${freeLayout ? "free-layout" : ""}`} style={freeLayout ? { minHeight: `calc(${Math.max(0.2, trimHeight / Math.max(0.2, trimWidth))} * 100cqw)` } : undefined} onPointerDown={(event) => {
                    const target = event.target as HTMLElement;
                    if (!target.closest("[data-canvas-block], input, textarea, button, select, .books-chapter-heading-row")) setEditorSelection({ start: -1, end: -1, titleFocused: false });
                  }}>
                    {showGuides && <div className="books-page-guide" aria-hidden="true" />}
                    <div className="books-chapter-heading-row"><input className="books-chapter-title-input" value={title} onFocus={() => setEditorSelection({ start: 0, end: title.length, titleFocused: true })} onChange={(event) => { const value = event.target.value; setTitle(value); setEditorSelection({ start: 0, end: value.length, titleFocused: true }); markDraft({ title: value }); }} placeholder="Section title" aria-label="Section title" /></div>
                    {manuscriptBody}
                  </div>
                </div>
             </div>
        </div>
           {inspectorOpen && <BooksInspector context={editorContext} layout={inspectorLayout} freeLayout={freeLayout} onLayoutChange={changeLayout} onReplaceRange={replaceContentRange} onMoveRange={moveCanvasRange} onDeleteRange={confirmDeleteCanvasRange} onDuplicateRange={duplicateCanvasRange} onBringToFront={() => setSelectedLayer("front")} onSendToBack={() => setSelectedLayer("back")} onReplaceImage={() => { const block = canvasBlocks(content).find((item) => item.kind === "image" && item.start === editorContext.start && item.end === editorContext.end); if (block) void replaceCanvasArtwork(block); }} onInlineFormat={applyInlineFormat} onConvertRole={applyHeading} chapterWords={chapterWords} totalWords={totalWords} wordGoal={wordGoal} />}
      </div>
    </div>
    {historyOpen && (
      <div className="books-history-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}>
        <section className="books-history-panel" role="dialog" aria-modal="true" aria-labelledby="books-history-title">
          <div className="books-history-header">
            <div>
              <span className="books-eyebrow"><Clock3 size={13} /> Local version history</span>
              <h2 id="books-history-title">Checkpoints</h2>
              <p>{title || "Untitled chapter"} · {chapterWords.toLocaleString()} words in the current draft</p>
            </div>
            <div className="books-history-header-actions">
              <button className="books-history-save" onClick={() => void createChapterSnapshot("manual")} disabled={snapshotSaving}><BookmarkPlus size={13} /> {snapshotSaving ? "Saving…" : "Save checkpoint"}</button>
              <button className="books-history-close" onClick={() => setHistoryOpen(false)} aria-label="Close version history"><X size={15} /></button>
            </div>
          </div>
          <div className="books-history-current">
            <span className="books-history-dot current" aria-hidden="true" />
            <div><strong>Current draft</strong><small>{chapterWords.toLocaleString()} words · {saveState === "saving" ? "saving" : saveState === "dirty" ? "unsaved changes" : "saved locally"}</small></div>
            <ChevronRight size={14} aria-hidden="true" />
          </div>
          {snapshotLoading ? (
            <div className="books-history-empty"><Clock3 size={19} /><strong>Loading checkpoints…</strong></div>
          ) : snapshots.length === 0 ? (
            <div className="books-history-empty"><History size={20} /><strong>No checkpoints yet</strong><span>Save a checkpoint now, or keep writing — a checkpoint is captured automatically every two minutes while this section changes.</span></div>
          ) : (
            <ol className="books-history-list">
              {snapshots.map((snapshot) => (
                <li className={`books-history-item ${snapshot.reason}`} key={snapshot.id}>
                  <span className={`books-history-dot ${snapshot.reason}`} aria-hidden="true" />
                  <div className="books-history-item-main">
                    <div className="books-history-item-top"><span className={`books-history-badge ${snapshot.reason}`}>{SNAPSHOT_LABELS[snapshot.reason]}</span><time dateTime={snapshot.created_at}>{snapshotTime(snapshot.created_at)}</time></div>
                    <p>{snapshotPreview(snapshot.content)}</p>
                    <small>{snapshot.title || "Untitled section"} · {snapshot.word_count.toLocaleString()} words</small>
                  </div>
                  <div className="books-history-item-actions">
                    <button onClick={() => restoreSnapshot(snapshot)}>Restore</button>
                    <button className="danger" onClick={() => deleteSnapshot(snapshot)} title="Delete checkpoint" aria-label={`Delete checkpoint from ${snapshotTime(snapshot.created_at)}`}><Trash2 size={13} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="books-history-note">Checkpoints stay on this Mac. The latest 50 per section are kept, and restoring one always saves your current draft first.</p>
        </section>
      </div>
    )}
    {confirmation.dialog}
    </>
  );
}
