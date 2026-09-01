import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  ChevronRight,
  Code2,
  ImagePlus,
  LayoutList,
  Link2,
  List,
  ListOrdered,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Quote,
  Save,
  Search,
  Table2,
  Type,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import type * as React from "react";
import type { Book, Chapter, ChapterKind } from "../lib/types";
import { BOOK_GRAPHICS, BOOK_GRAPHIC_CATEGORIES, graphicDataUri, type BookGraphic, type BookGraphicVariant } from "../lib/bookAssets";
import { layoutForBook, serializeBookLayout, type BookLayout, type BookTypography } from "../lib/bookLayout";
import { sectionAnchorId } from "../lib/bookToc";
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
  tableBlockText,
  tableDataFromValue,
  wordCount,
  type CanvasBlock,
} from "../lib/bookPublishing";
import { handleTabListKeyDown, manuscriptStyle, useConfirmationDialog } from "./BooksStudio";
import type { EditorView } from "./BooksStudio";


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
         {graphics.map((item: BookGraphic) => <button key={item.id} className="books-asset-card" onClick={() => onInsert(`![${item.label}](${graphicDataUri(item.svg, color)})\n`)} title={`Insert ${item.label}`}><span className="books-asset-preview" dangerouslySetInnerHTML={{ __html: item.svg.replace(/currentColor/g, color) }} /><strong>{item.label}</strong><small>{item.variant}</small></button>)}
        {graphics.length === 0 && <p className="books-assets-empty">No artwork matches “{query}”.</p>}
      </div>
      <p className="books-assets-note">Graphics are embedded as portable SVG data, so their color and shape travel with exported copies.</p>
    </section>
  );
}


function CanvasResizeHandles({ label, onResizeStart }: { label: string; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, direction: -1 | 1) => void }) {
  return <><button className="books-canvas-resize-handle left" onPointerDown={(event) => onResizeStart(event, -1)} aria-label={`Resize ${label} from the left edge`} /><button className="books-canvas-resize-handle right" onPointerDown={(event) => onResizeStart(event, 1)} aria-label={`Resize ${label} from the right edge`} /></>;
}

function CanvasTextBlock({ block, index, width, selected, typography, onTextChange, onTextSelection, onEditorKeyDown, onResizeStart }: { block: CanvasBlock; index: number; width: number; selected: boolean; typography: BookTypography; onTextChange: (block: CanvasBlock, value: string, selectionStart: number, selectionEnd: number) => void; onTextSelection: (block: CanvasBlock, event: React.SyntheticEvent<HTMLTextAreaElement>) => void; onEditorKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, block: CanvasBlock, direction: -1 | 1) => void }) {
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const style = block.role ? typography[block.role] : typography.paragraph;
  const className = block.role === "quote" ? "quote" : block.level ? `heading heading-${block.level}` : "paragraph";
  const label = block.role === "quote" ? "quote" : block.level ? `heading ${block.level}` : "paragraph";
  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => editor.current?.focus());
  }, [editing]);
  const beginEditing = () => setEditing(true);
  return <div className={`books-canvas-text-block align-${block.presentation.align} ${selected ? "selected" : ""}`} style={{ width: `${width}%` }}>
    {editing ? <textarea ref={editor} className={`books-canvas-text ${className}`} style={{ textIndent: `${style.firstLineIndent}em`, marginTop: `${style.spaceBefore}em`, marginBottom: `${style.spaceAfter}em`, paddingLeft: `${style.leftIndent}em`, paddingRight: `${style.rightIndent}em` }} value={block.display} rows={Math.max(1, block.display.split("\n").length)} onChange={(event) => onTextChange(block, event.target.value, event.target.selectionStart, event.target.selectionEnd)} onFocus={(event) => onTextSelection(block, event)} onSelect={(event) => onTextSelection(block, event)} onClick={(event) => onTextSelection(block, event)} onKeyUp={(event) => onTextSelection(block, event)} onBlur={() => setEditing(false)} onKeyDown={onEditorKeyDown} placeholder={index === 0 ? "Begin writing here…" : undefined} spellCheck aria-label={`${label} text`} /> : <div className={`books-canvas-text-preview ${block.display ? "" : "empty"}`} tabIndex={0} role="textbox" aria-label={`${label} text`} onClick={beginEditing} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "F2") { event.preventDefault(); beginEditing(); } }} dangerouslySetInnerHTML={{ __html: block.display ? markdownToHtml(block.source, undefined, typography) : "Begin writing here…" }} />}
    {selected && <CanvasResizeHandles label={label} onResizeStart={(event, direction) => onResizeStart(event, block, direction)} />}
  </div>;
}

function ManuscriptCanvas({ content, selection, typography, onSelectVisual, onTextChange, onTextSelection, onEditorKeyDown, onEditorDragOver, onEditorDrop, onEditorPaste, onResizeStart, onEditSource, onDeleteBlock, onMoveBlock, resizing }: {
  content: string;
  selection: { start: number; end: number };
  typography: BookTypography;
  onSelectVisual: (block: CanvasBlock) => void;
  onTextChange: (block: CanvasBlock, value: string, selectionStart: number, selectionEnd: number) => void;
  onTextSelection: (block: CanvasBlock, event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onEditorDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onEditorDrop: (event: React.DragEvent<HTMLElement>) => void;
  onEditorPaste: (event: React.ClipboardEvent<HTMLElement>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, block: CanvasBlock, direction: -1 | 1) => void;
  onEditSource: (block: CanvasBlock) => void;
  onDeleteBlock: (block: CanvasBlock) => void;
  onMoveBlock: (fromStart: number, targetStart: number) => void;
  resizing: { start: number; width: number } | null;
}) {
  const parsedBlocks = canvasBlocks(content);
  const blocks = parsedBlocks.length > 0 ? parsedBlocks : [{ kind: "text", start: 0, end: 0, source: "", display: "", editPrefix: "", editSuffix: "", role: "paragraph", presentation: { ...DEFAULT_RICH_PRESENTATION } } satisfies CanvasBlock];
  const isSelected = (block: CanvasBlock) => selection.start <= block.end && selection.end >= block.start;
  const renderVisual = (block: CanvasBlock) => {
    if (block.kind === "image" && block.image) {
      const safeSource = /^(?:https?:\/\/|data:image\/)/i.test(block.image.source);
      return <div className="books-canvas-image-inner">{safeSource ? <img src={block.image.source} alt={block.image.alt || "Manuscript artwork"} draggable={false} /> : <span className="books-canvas-unsupported">This image source cannot be previewed.</span>}</div>;
    }
    return <div className="books-canvas-rich-inner" dangerouslySetInnerHTML={{ __html: markdownToHtml(block.source, undefined, typography) }} />;
  };
  return <div className="books-manuscript-canvas" onDragOver={onEditorDragOver} onDrop={onEditorDrop} onPaste={onEditorPaste} aria-label="Manuscript canvas">
    {blocks.map((block, index) => {
      if (block.kind === "text") {
        const selected = isSelected(block);
        const width = resizing?.start === block.start ? resizing.width : block.presentation.width;
        return <CanvasTextBlock key={`${block.start}-${index}`} block={block} index={index} width={width} selected={selected} typography={typography} onTextChange={onTextChange} onTextSelection={onTextSelection} onEditorKeyDown={onEditorKeyDown} onResizeStart={onResizeStart} />;
      }
      const selected = isSelected(block);
      const width = resizing?.start === block.start ? resizing.width : block.presentation.width;
      return <div key={`${block.start}-${index}`} className={`books-canvas-visual ${selected ? "selected" : ""} align-${block.presentation.align}`} style={{ width: `${width}%` }} role="button" tabIndex={0} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-note-me-block", String(block.start)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const fromStart = Number(event.dataTransfer.getData("application/x-note-me-block")); if (Number.isFinite(fromStart)) onMoveBlock(fromStart, block.start); }} onClick={() => onSelectVisual(block)} onDoubleClick={() => onEditSource(block)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectVisual(block); } else if ((event.key === "Backspace" || event.key === "Delete") && selected) { event.preventDefault(); onDeleteBlock(block); } }} aria-label={`Select ${block.kind === "image" ? "artwork" : block.kind}`}>
        <span className="books-canvas-visual-label">{block.kind === "image" ? "Artwork" : block.kind === "table" ? "Data table" : block.kind === "chart" ? "Chart / graph" : "Callout"}</span>
        {renderVisual(block)}
        {selected && <><span className="books-canvas-edit-hint">Double-click to edit source</span><CanvasResizeHandles label={block.kind} onResizeStart={(event, direction) => onResizeStart(event, block, direction)} /></>}
      </div>;
    })}
  </div>;
}


export function ManuscriptScreen({ book, chapters, activeChapter, focusMode, onFocusModeChange, onOpenOutline, onNewChapter, onNavigateSection }: { book: Book; chapters: Chapter[]; activeChapter: Chapter | null; focusMode: boolean; onFocusModeChange: (focused: boolean) => void; onOpenOutline: () => void; onNewChapter: () => void; onNavigateSection: (direction: -1 | 1) => void }) {
  const updateChapter = useBooks((state) => state.updateChapter);
  const updateBook = useBooks((state) => state.updateBook);
  const [view, setView] = useState<EditorView>("write");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [assetOpen, setAssetOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const confirmation = useConfirmationDialog();
  const [canvasResize, setCanvasResize] = useState<{ start: number; width: number } | null>(null);
  const [title, setTitle] = useState(activeChapter?.title ?? "");
  const [content, setContent] = useState(activeChapter?.content ?? "");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0, titleFocused: false });
  const [inspectorLayout, setInspectorLayout] = useState(() => layoutForBook(book));
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeEditorMapRef = useRef({ sourceStart: 0, prefixLength: 0 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const draftVersionRef = useRef(0);
  const closingRef = useRef(false);
  const inspectorLayoutRef = useRef(inspectorLayout);
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
    setAssetOpen(false);
    setSourceMode(false);
    setCanvasResize(null);
    editorRef.current = null;
    activeEditorMapRef.current = { sourceStart: 0, prefixLength: 0 };
    setEditorSelection({ start: 0, end: 0, titleFocused: false });
    setTitle(activeChapter?.title ?? "");
    setContent(activeChapter?.content ?? "");
    setSaveState("saved");
    draftRef.current = {
      id: activeChapter?.id ?? null,
      title: activeChapter?.title ?? "",
      content: activeChapter?.content ?? "",
      chapterKind: activeChapter?.chapter_kind ?? "chapter",
      tocInclude: activeChapter?.toc_include ?? true,
      tocHeadingExclusions: activeChapter?.toc_heading_exclusions ?? [],
      dirty: false,
    };
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
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

  const syncEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    activeEditorMapRef.current = { sourceStart: 0, prefixLength: 0 };
    setEditorSelection({ start: editor.selectionStart, end: editor.selectionEnd, titleFocused: false });
  };

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
    const currentBook = useBooks.getState().books.find((item) => item.id === book.id) ?? book;
    void updateBook(currentBook.id, bookInputFromBook(currentBook, serializeBookLayout(nextLayout))).catch((error) => {
      inspectorLayoutRef.current = layoutForBook(currentBook);
      setInspectorLayout(inspectorLayoutRef.current);
      notify("error", "Typography could not be saved", String(error));
    });
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
    const replacement = `${block.editPrefix}${value}${block.editSuffix}`;
    const nextContent = content.slice(0, block.start) + replacement + content.slice(block.end);
    setContent(nextContent);
    markDraft({ content: nextContent });
    const sourceStart = block.start + block.editPrefix.length + selectionStart;
    const sourceEnd = block.start + block.editPrefix.length + selectionEnd;
    setEditorSelection({ start: sourceStart, end: sourceEnd, titleFocused: false });
  };

  const resizeCanvasBlock = (block: CanvasBlock, width: number) => {
    const safeWidth = Math.min(100, Math.max(20, Math.round(width)));
    if (block.kind === "image" && block.image) {
      replaceContentRange(block.start, block.end, `${block.image.indent}${imageMarkdown(block.image.alt, block.image.source, { ...block.image.presentation, width: safeWidth })}`);
    } else if (block.kind === "table") {
      replaceContentRange(block.start, block.end, tableBlockText(block.tableLines ?? [], { ...(block.tableOptions ?? tableDataFromValue(null)), width: safeWidth }));
    } else if (block.kind === "chart" && block.chart) {
      replaceContentRange(block.start, block.end, chartBlockText({ ...block.chart, width: safeWidth }));
    } else if (block.kind === "callout") {
      const presentation = { ...(block.calloutPresentation ?? DEFAULT_RICH_PRESENTATION), width: safeWidth };
      replaceContentRange(block.start, block.end, calloutBlockText(block.calloutTitle ?? "Note", block.calloutTone ?? "note", block.source.split(/\r?\n/).slice(2, -1).join("\n"), presentation));
    } else if (block.kind === "text") {
      replaceContentRange(block.start, block.end, canvasTextSource(block.source, { ...block.presentation, width: safeWidth }));
    }
  };

  const startCanvasResize = (event: React.PointerEvent<HTMLButtonElement>, block: CanvasBlock, direction: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas) return;
    const initialWidth = block.presentation.width;
    let nextWidth = initialWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - event.clientX) / Math.max(1, canvas.width)) * 100 * direction;
      nextWidth = Math.min(100, Math.max(20, initialWidth + delta));
      setCanvasResize({ start: block.start, width: nextWidth });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setCanvasResize(null);
      resizeCanvasBlock(block, nextWidth);
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

  const moveCanvasBlock = (fromStart: number, targetStart: number) => {
    let workingContent = content;
    let currentStart = fromStart;
    let currentEnd = canvasBlocks(content).find((block) => block.start === fromStart)?.end ?? fromStart;
    const initialBlocks = canvasBlocks(content);
    const fromIndex = initialBlocks.findIndex((block) => block.start === fromStart);
    const targetIndex = initialBlocks.findIndex((block) => block.start === targetStart);
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
    const direction = fromIndex < targetIndex ? 1 : -1;
    for (let step = Math.abs(targetIndex - fromIndex); step > 0; step -= 1) {
      const blocks = canvasBlocks(workingContent);
      const index = blocks.findIndex((block) => block.start === currentStart && block.end === currentEnd);
      const neighbor = index + direction;
      if (index < 0 || neighbor < 0 || neighbor >= blocks.length) return;
      const current = blocks[index];
      const adjacent = blocks[neighbor];
      const currentSource = workingContent.slice(current.start, current.end);
      const adjacentSource = workingContent.slice(adjacent.start, adjacent.end);
      const gap = direction < 0 ? workingContent.slice(adjacent.end, current.start) : workingContent.slice(current.end, adjacent.start);
      const rangeStart = direction < 0 ? adjacent.start : current.start;
      const rangeEnd = direction < 0 ? current.end : adjacent.end;
      const replacement = direction < 0 ? `${currentSource}${gap}${adjacentSource}` : `${adjacentSource}${gap}${currentSource}`;
      workingContent = workingContent.slice(0, rangeStart) + replacement + workingContent.slice(rangeEnd);
      currentStart = direction < 0 ? rangeStart : rangeStart + adjacentSource.length + gap.length;
      currentEnd = currentStart + currentSource.length;
    }
    setContent(workingContent);
    markDraft({ content: workingContent });
    setEditorSelection({ start: currentStart, end: currentEnd, titleFocused: false });
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

  const insertAsset = (markdown: string) => {
    replaceSelection(markdown);
    setAssetOpen(false);
  };

  const insertRichBlock = (block: string) => {
    const value = `${block}\n`;
    const cursor = Math.max(0, value.length - 4);
    replaceSelection(value, cursor, cursor);
  };

  const insertTable = () => insertRichBlock(tableBlockText(["| Measure | Current | Target |", "| :--- | ---: | ---: |", "| Example | 42 | 60 |"], { caption: "A clear comparison", align: "left", striped: true, compact: false, width: 100 }));
  const insertChart = () => insertRichBlock(chartBlockText(defaultChartData()));
  const insertCallout = () => insertRichBlock(calloutBlockText("A note for the reader", "note", "Use this space for context, a caveat, or a memorable detail."));

  const editorContext = useMemo(() => editorContextFor(content, editorSelection.start, editorSelection.end, editorSelection.titleFocused), [content, editorSelection]);

  const insertImageFile = async (file: File) => {
    try {
      insertAsset(await imageFileToMarkdown(file));
    } catch (error) {
      notify("error", "Image could not be added", String(error));
    }
  };

  const onEditorDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (Array.from(event.dataTransfer.files).some((file) => file.type.startsWith("image/"))) event.preventDefault();
  };

  const onEditorDrop = (event: React.DragEvent<HTMLElement>) => {
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

  const openFind = () => {
    setView("write");
    setSourceMode(true);
    setFindOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => findInputRef.current?.focus()));
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openFind();
      } else if (event.key === "Escape" && findOpen) {
        event.preventDefault();
        closeFind();
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [findOpen]);

  const onEditorKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onNavigateSection(event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveNow();
      return;
    }
    if (modifier && event.key.toLowerCase() === "b") { event.preventDefault(); applyFormat("**", "**"); return; }
    if (modifier && event.key.toLowerCase() === "i") { event.preventDefault(); applyFormat("*", "*"); return; }
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
  const totalWords = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  const findMatches = findOccurrences(content, findQuery);
  const wordGoal = Math.max(1, book.word_goal || 50000);
  const manuscriptBody = sourceMode ? (
    <textarea ref={editorRef} className="manuscript-editor" value={content} onChange={(event) => { const value = event.target.value; setContent(value); markDraft({ content: value }); requestAnimationFrame(syncEditorSelection); }} onSelect={syncEditorSelection} onClick={syncEditorSelection} onKeyUp={syncEditorSelection} onFocus={syncEditorSelection} onKeyDown={onEditorKeyDown} onDragOver={onEditorDragOver} onDrop={onEditorDrop} onPaste={onEditorPaste} spellCheck placeholder="Begin writing here…" aria-label="Manuscript source" />
  ) : (
    <div ref={canvasRef} className="books-canvas-host"><ManuscriptCanvas content={content} selection={editorSelection} typography={inspectorLayout.typography} onSelectVisual={(block) => { editorRef.current?.blur(); setEditorSelection({ start: block.start, end: block.end, titleFocused: false }); }} onTextChange={updateCanvasText} onTextSelection={syncCanvasSelection} onEditorKeyDown={onEditorKeyDown} onEditorDragOver={onEditorDragOver} onEditorDrop={onEditorDrop} onEditorPaste={onEditorPaste} onResizeStart={startCanvasResize} onEditSource={(block) => { setEditorSelection({ start: block.start, end: block.end, titleFocused: false }); setSourceMode(true); requestAnimationFrame(() => requestAnimationFrame(() => { editorRef.current?.focus(); editorRef.current?.setSelectionRange(block.start, block.end); })); }} onDeleteBlock={(block) => confirmDeleteCanvasRange(block.start, block.end)} onMoveBlock={moveCanvasBlock} resizing={canvasResize} /></div>
  );
  const activeChapterIndex = chapters.findIndex((chapter) => chapter.id === activeChapter.id);
  return (
    <>
    <div className={`books-editor-screen ${focusMode ? "focus-mode" : ""}`} style={manuscriptStyle(book)}>
      <div className="books-editor-toolbar">
          <div className="books-editor-context"><span>{chapterDisplayLabel(activeChapter, chapters.findIndex((chapter) => chapter.id === activeChapter.id), chapters)}</span><ChevronRight size={13} /><strong>{title || "Untitled chapter"}</strong></div>
        <div className="books-editor-actions">
           <span className={`books-save-state ${saveState}`} aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Saved locally"}</span>
            <button className="books-quiet-button" onClick={openFind} title="Find in section (Ctrl/Cmd+F)" aria-label="Find in section"><Search size={15} /></button>
            <button className={`books-quiet-button ${inspectorOpen ? "active" : ""}`} onClick={() => setInspectorOpen((value) => !value)} title={inspectorOpen ? "Hide contextual tools" : "Show contextual tools"} aria-label={inspectorOpen ? "Hide contextual tools" : "Show contextual tools"} aria-pressed={inspectorOpen}>{inspectorOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}</button>
            <button className={`books-quiet-button ${focusMode ? "active" : ""}`} onClick={() => onFocusModeChange(!focusMode)} title={focusMode ? "Exit focus mode" : "Enter focus mode"} aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"} aria-pressed={focusMode}><WandSparkles size={15} /></button>
          <button className="books-outline-button" onClick={() => void saveNow()} disabled={saveState !== "dirty"} title="Save chapter (⌘S)"><Save size={13} /> Save</button>
           <button className="books-outline-button" onClick={onOpenOutline}><LayoutList size={14} /> Outline</button>
         </div>
      </div>
       <div className="books-editor-workspace">
         <div className="books-writing-column">
            <div className="books-writing-topline"><div className="books-section-stepper" aria-label="Section navigation"><button onClick={() => onNavigateSection(-1)} disabled={activeChapterIndex <= 0} aria-label="Previous section" title="Previous section (⌘⌥↑)"><ArrowLeft size={12} /> Previous</button><button onClick={() => onNavigateSection(1)} disabled={activeChapterIndex < 0 || activeChapterIndex >= chapters.length - 1} aria-label="Next section" title="Next section (⌘⌥↓)">Next <ChevronRight size={12} /></button></div><span>{chapterWords.toLocaleString()} words</span><span>{Math.max(1, Math.ceil(chapterWords / 250))} min read</span><div className="books-view-toggle" role="tablist" aria-label="Manuscript view" onKeyDown={handleTabListKeyDown}><button className={view === "write" && !sourceMode ? "active" : ""} onClick={() => { setView("write"); setSourceMode(false); }} role="tab" aria-selected={view === "write" && !sourceMode} tabIndex={view === "write" && !sourceMode ? 0 : -1}>Canvas</button><button className={view === "write" && sourceMode ? "active" : ""} onClick={() => { setView("write"); setSourceMode(true); }} role="tab" aria-selected={view === "write" && sourceMode} tabIndex={view === "write" && sourceMode ? 0 : -1}>Source</button><button className={view === "preview" ? "active" : ""} onClick={() => { setView("preview"); setFindOpen(false); setAssetOpen(false); }} role="tab" aria-selected={view === "preview"} tabIndex={view === "preview" ? 0 : -1}>Preview</button></div></div>
            {findOpen && <div className="books-find-bar"><Search size={14} /><input ref={findInputRef} value={findQuery} onChange={(event) => { setFindQuery(event.target.value); setFindIndex(0); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); moveFindMatch(event.shiftKey ? -1 : 1); } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeFind(); } }} placeholder="Find in this section…" aria-label="Find in this section" /><span className="books-find-count" aria-live="polite">{findQuery ? (findMatches.length ? `${findIndex + 1} of ${findMatches.length}` : "No matches") : "Type to search"}</span><button onClick={() => moveFindMatch(-1)} disabled={!findMatches.length} title="Previous match" aria-label="Previous match"><ArrowUp size={13} /></button><button onClick={() => moveFindMatch(1)} disabled={!findMatches.length} title="Next match" aria-label="Next match"><ArrowDown size={13} /></button><button onClick={closeFind} title="Close find" aria-label="Close find"><X size={13} /></button></div>}
              {view === "write" && <div className="books-format-toolbar" role="toolbar" aria-label="Formatting toolbar">
             <label className="books-format-style"><Type size={14} aria-hidden="true" /><select value="" onChange={(event) => { if (event.target.value !== "") applyHeading(Number(event.target.value)); }} aria-label="Text style"><option value="" disabled>Text style</option><option value="0">Paragraph</option>{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>Heading {level}</option>)}</select></label>
             <button onClick={() => applyFormat("**", "**")} title="Bold" aria-label="Bold"><strong>B</strong></button>
             <button onClick={() => applyFormat("*", "*")} title="Italic" aria-label="Italic"><em>I</em></button>
             <span />
             <button onClick={() => applyFormat("[", "](url)")} title="Link" aria-label="Insert link"><Link2 size={14} /></button>
             <button onClick={() => applyFormat("> ")} title="Block quote" aria-label="Block quote"><Quote size={14} /></button>
             <button onClick={() => applyFormat("- ")} title="Bulleted list" aria-label="Bulleted list"><List size={14} /></button>
             <button onClick={() => applyFormat("1. ")} title="Numbered list" aria-label="Numbered list"><ListOrdered size={14} /></button>
              <button onClick={() => applyFormat("`", "`")} title="Inline code" aria-label="Inline code"><Code2 size={14} /></button>
              <button onClick={() => applyFormat("\n---\n")} title="Scene break" aria-label="Insert scene break"><Minus size={14} /></button>
              <span />
               <button onClick={() => setAssetOpen((value) => !value)} title="Insert artwork" aria-label="Insert artwork" aria-expanded={assetOpen}><ImagePlus size={15} /></button>
               <button onClick={insertTable} title="Insert table" aria-label="Insert table"><Table2 size={15} /></button>
               <button onClick={insertChart} title="Insert chart or graph" aria-label="Insert chart or graph"><BarChart3 size={15} /></button>
               <button onClick={insertCallout} title="Insert callout" aria-label="Insert callout"><Quote size={15} /></button>
            </div>}
            {assetOpen && <BooksAssetDrawer onClose={() => setAssetOpen(false)} onInsert={insertAsset} />}
            {view === "write" ? (
             <div className="books-page-editor">
                  <div className="books-chapter-heading-row"><input className="books-chapter-title-input" value={title} onFocus={() => setEditorSelection({ start: 0, end: title.length, titleFocused: true })} onChange={(event) => { const value = event.target.value; setTitle(value); setEditorSelection({ start: 0, end: value.length, titleFocused: true }); markDraft({ title: value }); }} placeholder="Section title" aria-label="Section title" /></div>
                  {manuscriptBody}
             </div>
          ) : (
              <article className="books-manuscript-preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(content, sectionAnchorId(activeChapter.id), inspectorLayout.typography) }} />
          )}
        </div>
           {inspectorOpen && <BooksInspector context={editorContext} layout={inspectorLayout} onLayoutChange={changeLayout} onReplaceRange={replaceContentRange} onMoveRange={moveCanvasRange} onDeleteRange={confirmDeleteCanvasRange} chapterWords={chapterWords} totalWords={totalWords} wordGoal={wordGoal} />}
      </div>
    </div>
    {confirmation.dialog}
    </>
  );
}
