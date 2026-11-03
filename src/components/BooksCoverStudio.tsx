import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Barcode,
  BookOpen,
  CaseUpper,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Feather,
  FileDown,
  FileImage,
  FileText,
  FlipHorizontal2,
  FlipVertical2,
  Frame,
  Grid3X3,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Lock,
  Maximize2,
  Minus,
  Move,
  Palette,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  ScanLine,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Book, Chapter } from "../lib/types";
import { BOOK_GRAPHIC_CATEGORIES, BOOK_GRAPHICS, graphicDataUri, type BookGraphic } from "../lib/bookAssets";
import { coverCss, coverMarkup } from "../lib/bookCover";
import {
  COVER_FONTS,
  COVER_IMAGE_PRESETS,
  COVER_PAPER_STOCKS,
  COVER_SYMBOLS,
  COVER_TEMPLATE_PRESETS,
  artworkLayer,
  barcodeLayer,
  barcodeSvgMarkup,
  coverArtworkDataUrl,
  coverDocMarkup,
  coverFill,
  coverFillCss,
  coverLayerInnerHtml,
  coverMetrics,
  coverPanelRect,
  createCoverDocument,
  createInitialCoverDocument,
  downloadCoverFile,
  emptyCoverDocument,
  estimateManuscriptPages,
  hasCoverDocument,
  imageLayer,
  isbnDigits,
  isbnIsValid,
  lineLayer,
  newCoverLayerId,
  normalizeIsbn13,
  reflowSpineLayers,
  shapeLayer,
  spineWidthMillimetres,
  symbolLayer,
  textLayer,
  type BookCoverDocument,
  type CoverBarcodeLayer,
  type CoverBlendMode,
  type CoverFill,
  type CoverGuideline,
  type CoverImageLayer,
  type CoverImageMask,
  type CoverLayer,
  type CoverLayerType,
  type CoverLineLayer,
  type CoverPanel,
  type CoverShapeKind,
  type CoverShapeLayer,
  type CoverTextAlign,
  type CoverTextEffect,
  type CoverTextLayer,
  type CoverVerticalAlign,
} from "../lib/bookCoverDoc";
import {
  alignCoverLayers,
  coverGuidePanelPosition,
  coverGuideSpreadPosition,
  coverGuideVisible,
  coverPanelSize,
  coverPanelRectFor,
  coverSelectionBounds,
  coverSpreadRect,
  distributeCoverLayers,
  snapCoverRect,
  type CoverAlignMode,
  type CoverDistributeAxis,
} from "../lib/bookCoverGeometry";
import {
  layoutForBook,
  serializeBookLayout,
  type BookCoverDesign,
  type BookLayout,
} from "../lib/bookLayout";
import { bookInputFromBook, TRIM_SIZES } from "../lib/bookPublishing";
import { downloadCoverPdf } from "../lib/bookCoverPdf";
import { useBooks } from "../store/books";
import { notify } from "../store/toast";

const COVER_CSS = coverCss();
const FALLBACK_ACCENT = "#a56b3e";
const NOOP = () => undefined;

type SaveState = "saved" | "dirty" | "saving";

interface CommitOptions {
  history?: boolean;
  key?: string;
}

interface CoverStageProps {
  book: Book;
  cover: BookCoverDesign;
  panel: CoverPanel;
  selectedId: string | null;
  selectedIds: string[];
  showGuides: boolean;
  showGrid: boolean;
  showBleed: boolean;
  previewing: boolean;
  zoom: number;
  autoFit: boolean;
  onSelect: (id: string | null, additive?: boolean) => void;
  onZoom: (value: number) => void;
  onFit: () => void;
  onLayersChange: (updates: Array<{ id: string; patch: Partial<CoverLayer> }>, options?: CommitOptions) => void;
  onInteractionStart: (key: string) => void;
  onInteractionEnd: () => void;
  onEditText: (id: string) => void;
  onDropImage: (dataUrl: string, x: number, y: number) => void;
  onGuideAdd: (axis: "x" | "y", spreadPosition: number) => void;
  onGuideChange: (id: string, spreadPosition: number) => void;
  onGuideDelete: (id: string) => void;
  onAlignSelection: (mode: CoverAlignMode) => void;
  onDistributeSelection: (axis: CoverDistributeAxis) => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
}

interface InspectorProps {
  book: Book;
  cover: BookCoverDesign;
  metrics: ReturnType<typeof coverMetrics>;
  selected: CoverLayer | null;
  selectedCount: number;
  pageEstimate: number;
  onSelect: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<CoverLayer>, options?: CommitOptions) => void;
  onUpdateCover: (patch: Partial<BookCoverDesign>, options?: CommitOptions) => void;
  onUpdateDoc: (doc: BookCoverDocument, options?: CommitOptions) => void;
  onApplyTemplate: () => void;
  onEstimatePages: () => void;
  onPageCount: (value: number) => void;
  onPaperStock: (value: string) => void;
  onSpineOverride: (value: number) => void;
  onBleed: (value: number) => void;
  onTrimSize: (value: string) => void;
  onOpenSettings: () => void;
  onReplaceImage: () => void;
  onUploadBarcode: () => void;
  onClearBarcode: () => void;
  focusContent: number;
}

interface LayerPanelProps {
  doc: BookCoverDocument;
  selectedId: string | null;
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onAdd: () => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onReorderDrag: (id: string, targetId: string) => void;
  onCollapse: () => void;
}

interface TemplateModalProps {
  book: Book;
  cover: BookCoverDesign;
  onApply: (templateId: string) => void;
  onClose: () => void;
}

function pickerColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : "#000000";
}

function readImageFile(file: File | null, maxMb = 16): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected."));
    if (!file.type.startsWith("image/")) return reject(new Error("Choose a PNG, JPEG, WebP, GIF, or SVG image."));
    if (file.size > maxMb * 1024 * 1024) return reject(new Error(`Choose an image smaller than ${maxMb} MB.`));
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(String(reader.error ?? "The image could not be read.")));
    reader.readAsDataURL(file);
  });
}

function layerLabel(type: CoverLayerType) {
  if (type === "text") return "Text";
  if (type === "image") return "Image";
  if (type === "shape") return "Shape";
  if (type === "line") return "Line";
  if (type === "symbol") return "Ornament";
  if (type === "artwork") return "Artwork";
  return "Barcode";
}

function LayerIcon({ type, size = 13 }: { type: CoverLayerType; size?: number }) {
  if (type === "text") return <Type size={size} />;
  if (type === "image") return <FileImage size={size} />;
  if (type === "shape") return <Shapes size={size} />;
  if (type === "line") return <Minus size={size} />;
  if (type === "symbol") return <Sparkles size={size} />;
  if (type === "artwork") return <Feather size={size} />;
  return <Barcode size={size} />;
}

function selectedLayerName(layer: CoverLayer | null) {
  if (!layer) return "Document";
  return layer.name || layerLabel(layer.type);
}

function normalizeWheelDelta(event: WheelEvent) {
  return event.deltaMode === 1 ? event.deltaY * 18 : event.deltaMode === 2 ? event.deltaY * 300 : event.deltaY;
}

function parseNumeric(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDimension(value: number) {
  return `${Math.round(value * 100) / 100}`;
}

function pageCountFor(book: Book, chapters: Chapter[]) {
  return estimateManuscriptPages(book, chapters);
}

function graphicAspect(graphic: BookGraphic) {
  const match = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(graphic.svg);
  if (!match) return 1;
  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);
  return width > 0 && height > 0 ? height / width : 1;
}

/* ========================================================================== */

export function CoverArtwork({
  book,
  layout,
  className = "",
  panel = "wrap",
  fit = true,
}: {
  book: Book;
  layout: BookLayout;
  className?: string;
  panel?: CoverPanel;
  fit?: boolean;
}) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const usesDocument = hasCoverDocument(layout.cover);
  useEffect(() => {
    if (!usesDocument || !fit) return;
    const element = containerRef.current;
    if (!element) return;
    const update = () => setAvailableWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [usesDocument, fit]);
  if (usesDocument) {
    const metrics = coverMetrics(book.trim_size, layout.cover);
    const rect = coverPanelRect(metrics, panel);
    const scale = fit ? (availableWidth > 0 ? availableWidth / (rect.width * 96) : 0) : 1;
    return (
      <div ref={containerRef} className={`books-cover-art-frame books-wrap-art-frame ${className}`} style={fit && scale > 0 ? { height: rect.height * 96 * scale } : undefined}>
        <style>{COVER_CSS}</style>
        {fit && scale === 0 ? null : (
          <div
            style={fit ? { width: rect.width * 96, height: rect.height * 96, transform: `scale(${scale})`, transformOrigin: "0 0" } : undefined}
            dangerouslySetInnerHTML={{ __html: coverDocMarkup(book, layout.cover, panel) }}
          />
        )}
      </div>
    );
  }
  return <div className={`books-cover-art-frame ${className}`}><style>{COVER_CSS}</style><div dangerouslySetInnerHTML={{ __html: coverMarkup(book, layout) }} /></div>;
}

/* ========================================================================== */

export function CoverScreen({
  book,
  chapters,
  onOpenChapter,
  onNavigate,
}: {
  book: Book;
  chapters: Chapter[];
  onOpenChapter: (id: number) => void;
  onNavigate?: (screen: "library" | "manuscript" | "outline" | "settings" | "export" | "cover") => void;
}) {
  const updateBook = useBooks((state) => state.updateBook);
  const [layout, setLayout] = useState<BookLayout>(() => layoutForBook(book));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [extraSelectedIds, setExtraSelectedIds] = useState<string[]>([]);
  const [panel, setPanel] = useState<CoverPanel>("wrap");
  const [tool, setTool] = useState<string>("select");
  const [showLayers, setShowLayers] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [artworkOpen, setArtworkOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const [dpi, setDpi] = useState(300);
  const [busyDownload, setBusyDownload] = useState<string | null>(null);
  const [history, setHistory] = useState<BookCoverDesign[]>([]);
  const [future, setFuture] = useState<BookCoverDesign[]>([]);
  const [focusContent, setFocusContent] = useState(0);
  const layoutRef = useRef(layout);
  const bookRef = useRef(book);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const colorRef = useRef(book.cover_color || FALLBACK_ACCENT);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const lastHistoryKeyRef = useRef("");
  const lastHistoryTimeRef = useRef(0);
  const historyRef = useRef(history);
  const futureRef = useRef(future);
  historyRef.current = history;
  futureRef.current = future;
  bookRef.current = book;

  const cover = layout.cover;
  const doc = cover.doc;
  const metrics = useMemo(() => coverMetrics(book.trim_size, cover), [book.trim_size, cover.pageCount, cover.paperStock, cover.spineWidthOverride, cover.bleed]);
  const selected = doc.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedIds = useMemo(
    () => selectedLayerId ? [selectedLayerId, ...extraSelectedIds.filter((id) => id !== selectedLayerId)] : [],
    [selectedLayerId, extraSelectedIds],
  );
  const selectedLayers = useMemo(() => doc.layers.filter((layer) => selectedIds.includes(layer.id)), [doc.layers, selectedIds]);
  const pageEstimate = useMemo(() => pageCountFor(book, chapters), [book, chapters]);
  const coverChapter = chapters.find((chapter) => chapter.chapter_kind === "cover") ?? null;
  const designPanel: Exclude<CoverPanel, "wrap"> = panel === "wrap" ? "front" : panel;
  const panelWidth = designPanel === "back" ? metrics.panelWidths.back : designPanel === "spine" ? metrics.panelWidths.spine : metrics.panelWidths.front;
  const shelfColor = doc.background.type === "solid" ? doc.background.color : doc.background.gradient.stops[0]?.color || book.cover_color || FALLBACK_ACCENT;
  colorRef.current = /^#[0-9a-f]{6}$/i.test(shelfColor) ? shelfColor : colorRef.current;

  const saveNow = (nextLayout: BookLayout = layoutRef.current) => {
    const currentBook = bookRef.current;
    return updateBook(currentBook.id, bookInputFromBook({ ...currentBook, cover_color: colorRef.current }, serializeBookLayout(nextLayout)));
  };

  const scheduleSave = (nextLayout: BookLayout) => {
    layoutRef.current = nextLayout;
    dirtyRef.current = true;
    setSaveState("dirty");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setSaveState("saving");
      void saveNow(nextLayout).then(() => {
        if (layoutRef.current === nextLayout) {
          dirtyRef.current = false;
          setSaveState("saved");
        }
      }).catch((error) => {
        setSaveState("dirty");
        notify("error", "Cover design could not be saved", String(error));
      });
    }, 720);
  };

  const pushHistory = useCallback((snapshot: BookCoverDesign, key?: string) => {
    const now = Date.now();
    if (key && key === lastHistoryKeyRef.current && now - lastHistoryTimeRef.current < 650) {
      lastHistoryTimeRef.current = now;
      return;
    }
    lastHistoryKeyRef.current = key ?? "";
    lastHistoryTimeRef.current = now;
    setHistory((items) => [...items.slice(-49), snapshot]);
    setFuture([]);
  }, []);

  const applyLayout = (next: BookLayout, options: CommitOptions = {}, previousCover = layoutRef.current.cover) => {
    if (options.history !== false) pushHistory(previousCover, options.key);
    layoutRef.current = next;
    setLayout(next);
    scheduleSave(next);
  };

  const updateCover = (patch: Partial<BookCoverDesign>, options: CommitOptions = {}) => {
    const current = layoutRef.current;
    applyLayout({ ...current, cover: { ...current.cover, ...patch } }, options, current.cover);
  };

  const updateDoc = (nextDoc: BookCoverDocument, options: CommitOptions = {}) => {
    updateCover({ doc: nextDoc }, options);
  };

  const updateLayer = useCallback((id: string, patch: Partial<CoverLayer>, options: CommitOptions = {}) => {
    const current = layoutRef.current.cover;
    const layer = current.doc.layers.find((item) => item.id === id);
    if (!layer) return;
    const layers = current.doc.layers.map((item) => item.id === id ? ({ ...item, ...patch } as CoverLayer) : item);
    const nextCover = { ...current, doc: { ...current.doc, layers } };
    applyLayout({ ...layoutRef.current, cover: nextCover }, options, current);
  }, []);

  const updateLayers = useCallback((updates: Array<{ id: string; patch: Partial<CoverLayer> }>, options: CommitOptions = {}) => {
    if (updates.length === 0) return;
    const current = layoutRef.current.cover;
    const patches = new Map(updates.map((update) => [update.id, update.patch]));
    const layers = current.doc.layers.map((layer) => patches.has(layer.id) ? ({ ...layer, ...patches.get(layer.id) } as CoverLayer) : layer);
    const nextCover = { ...current, doc: { ...current.doc, layers } };
    applyLayout({ ...layoutRef.current, cover: nextCover }, options, current);
  }, []);

  const restoreCover = (snapshot: BookCoverDesign) => {
    const next = { ...layoutRef.current, cover: snapshot };
    layoutRef.current = next;
    setLayout(next);
    scheduleSave(next);
  };

  const undo = useCallback(() => {
    const items = historyRef.current;
    if (items.length === 0) return;
    const previous = items[items.length - 1];
    setHistory(items.slice(0, -1));
    setFuture((next) => [layoutRef.current.cover, ...next].slice(0, 50));
    restoreCover(previous);
  }, []);

  const redo = useCallback(() => {
    const items = futureRef.current;
    if (items.length === 0) return;
    const next = items[0];
    setFuture(items.slice(1));
    setHistory((previous) => [...previous.slice(-49), layoutRef.current.cover]);
    restoreCover(next);
  }, []);

  useEffect(() => {
    const next = layoutForBook(book);
    let initial = next;
    const needsSeed = !next.cover.doc.templateId && next.cover.doc.layers.length === 0;
    if (needsSeed) {
      const estimatedPages = estimateManuscriptPages(book, chapters);
      const seededCover = { ...next.cover, pageCount: estimatedPages > 0 ? estimatedPages : next.cover.pageCount };
      const seededDoc = createInitialCoverDocument(book, seededCover);
      initial = { ...next, cover: { ...seededCover, enabled: true, doc: seededDoc } };
    }
    layoutRef.current = initial;
    setLayout(initial);
    setSelectedLayerId(null);
    setExtraSelectedIds([]);
    setPanel("wrap");
    setHistory([]);
    setFuture([]);
    dirtyRef.current = false;
    setSaveState("saved");
    if (needsSeed) scheduleSave(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (dirtyRef.current && bookRef.current.id === book.id) {
      void saveNow(layoutRef.current).catch((error) => notify("error", "Cover design could not be saved", String(error)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    const layerIds = new Set(doc.layers.map((layer) => layer.id));
    setExtraSelectedIds((ids) => ids.filter((id) => layerIds.has(id)));
    if (selectedLayerId && !layerIds.has(selectedLayerId)) setSelectedLayerId(null);
  }, [doc.layers, selectedLayerId]);

  const selectLayer = (id: string | null, additive = false) => {
    if (!id) {
      setSelectedLayerId(null);
      setExtraSelectedIds([]);
      return;
    }
    if (additive) {
      if (selectedLayerId === id) {
        const [next, ...rest] = extraSelectedIds;
        setSelectedLayerId(next ?? null);
        setExtraSelectedIds(rest);
        return;
      }
      if (extraSelectedIds.includes(id)) {
        setExtraSelectedIds(extraSelectedIds.filter((item) => item !== id));
        return;
      }
      if (!selectedLayerId) setSelectedLayerId(id);
      else setExtraSelectedIds([...extraSelectedIds, id]);
      return;
    }
    setSelectedLayerId(id);
    setExtraSelectedIds([]);
    const layer = layoutRef.current.cover.doc.layers.find((item) => item.id === id);
    if (layer && layer.panel !== "wrap" && panel !== "wrap" && layer.panel !== panel) {
      setPanel(layer.panel);
      setAutoFit(true);
    }
  };

  const addLayer = (layer: CoverLayer, targetPanel: CoverPanel = layer.panel) => {
    const current = layoutRef.current.cover;
    updateDoc({ ...current.doc, templateId: current.doc.templateId || "custom", layers: [...current.doc.layers, layer] }, { key: `add:${layer.type}` });
    setSelectedLayerId(layer.id);
    setExtraSelectedIds([]);
    if (targetPanel !== "wrap" && panel !== "wrap" && panel !== targetPanel) setPanel(targetPanel);
  };

  const makeTextLayer = () => {
    const target = designPanel;
    const width = target === "spine" ? Math.max(0.6, metrics.trimHeight * 0.72) : Math.max(0.8, panelWidth - 1);
    const height = target === "spine" ? Math.max(0.2, metrics.spineWidth * 0.6) : 1.1;
    const layer = textLayer({
      id: newCoverLayerId("text"),
      name: "Text",
      panel: target,
      x: target === "spine" ? metrics.spineWidth / 2 - width / 2 : 0.5,
      y: target === "spine" ? metrics.trimHeight * 0.4 : 0.6,
      width,
      height,
      text: "Your text",
      fontFamily: target === "spine" ? "sans" : "display",
      fontSize: target === "spine" ? 9 : 24,
      fontWeight: 500,
      lineHeight: 1.1,
      letterSpacing: 0,
      rotation: target === "spine" ? -90 : 0,
      color: "#211b16",
    });
    addLayer(layer, target);
  };

  const makeShapeLayer = (shape: CoverShapeKind) => {
    const width = Math.min(panelWidth * 0.42, 2.2);
    addLayer(shapeLayer({
      id: newCoverLayerId(shape),
      name: shape === "rectangle" ? "Rectangle" : shape.charAt(0).toUpperCase() + shape.slice(1),
      panel: designPanel,
      x: Math.max(0.2, panelWidth * 0.5 - width / 2),
      y: Math.max(0.2, metrics.trimHeight * 0.35),
      width,
      height: shape === "ellipse" ? width : width * 0.72,
      shape,
      fill: coverFill(cover.accentColor || FALLBACK_ACCENT),
      strokeWidth: 0,
    }), designPanel);
  };

  const makeLineLayer = () => addLayer(lineLayer({
    id: newCoverLayerId("line"),
    name: "Rule",
    panel: designPanel,
    x: Math.max(0.2, panelWidth * 0.12),
    y: metrics.trimHeight * 0.3,
    width: Math.max(0.5, panelWidth * 0.76),
    height: 0.012,
    color: cover.accentColor || FALLBACK_ACCENT,
  }), designPanel);

  const makeSymbolLayer = (glyph: string) => {
    const size = Math.min(panelWidth * 0.22, 0.9);
    addLayer(symbolLayer({
      id: newCoverLayerId("symbol"),
      name: "Ornament",
      panel: designPanel,
      x: Math.max(0.1, panelWidth * 0.5 - size / 2),
      y: Math.max(0.1, metrics.trimHeight * 0.18),
      width: size,
      height: size,
      glyph,
      color: cover.accentColor || FALLBACK_ACCENT,
    }), designPanel);
    setSymbolOpen(false);
  };

  const makeArtworkLayer = (graphic: BookGraphic) => {
    const aspect = graphicAspect(graphic);
    let width = Math.min(panelWidth * 0.64, Math.max(0.7, panelWidth * (graphic.width / 100)));
    let height = width * aspect;
    if (height > metrics.trimHeight * 0.72) {
      height = metrics.trimHeight * 0.72;
      width = height / aspect;
    }
    addLayer(artworkLayer({
      id: newCoverLayerId("artwork"),
      name: graphic.label,
      panel: designPanel,
      x: Math.max(0.1, panelWidth * 0.5 - width / 2),
      y: Math.max(0.1, metrics.trimHeight * 0.18),
      width,
      height,
      graphicId: graphic.id,
      color: cover.accentColor || FALLBACK_ACCENT,
    }), designPanel);
    setArtworkOpen(false);
  };

  const makeBarcodeLayer = () => {
    const width = Math.min(2.05, metrics.panelWidths.back * 0.42);
    const height = width * 0.59;
    addLayer(barcodeLayer({
      id: newCoverLayerId("barcode"),
      name: "ISBN barcode",
      panel: "back",
      x: Math.max(0.2, metrics.panelWidths.back - width - 0.5),
      y: Math.max(0.2, metrics.trimHeight - height - 0.5),
      width,
      height,
      showText: true,
    }), "back");
    setPanel("back");
  };

  const addImage = async (file: File | null) => {
    try {
      const dataUrl = await readImageFile(file);
      const target = designPanel;
      const width = target === "spine" ? Math.max(0.3, metrics.spineWidth) : panelWidth * 0.7;
      const height = target === "spine" ? metrics.trimHeight * 0.5 : metrics.trimHeight * 0.55;
      const layer = imageLayer({
        id: newCoverLayerId("image"),
        name: file?.name.replace(/\.[^.]+$/, "").slice(0, 50) || "Image",
        panel: target,
        x: target === "spine" ? 0 : Math.max(0.2, panelWidth * 0.5 - width / 2),
        y: Math.max(0.2, metrics.trimHeight * 0.2),
        width,
        height,
        src: dataUrl,
        fit: "cover",
      });
      addLayer(layer, target);
    } catch (error) {
      notify("error", "Image could not be added", String(error));
    }
  };

  const replaceImage = async (file: File | null) => {
    if (!selected || selected.type !== "image") return;
    try {
      const dataUrl = await readImageFile(file);
      updateLayer(selected.id, { src: dataUrl, name: file?.name.replace(/\.[^.]+$/, "").slice(0, 50) || selected.name }, { key: `replace-image:${selected.id}` });
    } catch (error) {
      notify("error", "Image could not be replaced", String(error));
    }
  };

  const uploadBarcode = async (file: File | null) => {
    try {
      const dataUrl = await readImageFile(file, 8);
      updateCover({ barcodeImage: dataUrl }, { key: "barcode-image" });
      notify("success", "Barcode image added");
    } catch (error) {
      notify("error", "Barcode image could not be added", String(error));
    }
  };

  const useManuscriptEstimate = () => {
    if (pageEstimate <= 0) {
      notify("info", "Add manuscript text first", "Page estimates need words in the manuscript.");
      return;
    }
    updatePageCount(pageEstimate);
  };

  const updatePageCount = (value: number) => {
    const currentCover = layoutRef.current.cover;
    const pages = Math.min(8000, Math.max(1, Math.round(value)));
    const previousMetrics = coverMetrics(book.trim_size, currentCover);
    const nextCover = { ...currentCover, pageCount: pages, spineWidthOverride: 0 };
    const nextMetrics = coverMetrics(book.trim_size, nextCover);
    const nextDoc = reflowSpineLayers(currentCover.doc, previousMetrics.spineWidth, nextMetrics.spineWidth);
    updateCover({ pageCount: pages, spineWidthOverride: 0, doc: nextDoc }, { key: "setup:page-count" });
  };

  const updatePaperStock = (paperStock: string) => {
    const currentCover = layoutRef.current.cover;
    const previousMetrics = coverMetrics(book.trim_size, currentCover);
    const nextCover = { ...currentCover, paperStock, spineWidthOverride: 0 };
    const nextMetrics = coverMetrics(book.trim_size, nextCover);
    const nextDoc = reflowSpineLayers(currentCover.doc, previousMetrics.spineWidth, nextMetrics.spineWidth);
    updateCover({ paperStock, spineWidthOverride: 0, doc: nextDoc }, { key: "setup:paper" });
  };

  const updateSpineOverride = (value: number) => {
    const currentCover = layoutRef.current.cover;
    const previousMetrics = coverMetrics(book.trim_size, currentCover);
    const nextCover = { ...currentCover, spineWidthOverride: Math.max(0, value) };
    const nextMetrics = coverMetrics(book.trim_size, nextCover);
    const nextDoc = reflowSpineLayers(currentCover.doc, previousMetrics.spineWidth, nextMetrics.spineWidth);
    updateCover({ spineWidthOverride: Math.max(0, value), doc: nextDoc }, { key: "setup:spine" });
  };

  const updateBleed = (value: number) => {
    const currentCover = layoutRef.current.cover;
    const previousMetrics = coverMetrics(book.trim_size, currentCover);
    const nextCover = { ...currentCover, bleed: value };
    const nextMetrics = coverMetrics(book.trim_size, nextCover);
    const scaleX = nextMetrics.fullWidth / previousMetrics.fullWidth;
    const scaleY = nextMetrics.fullHeight / previousMetrics.fullHeight;
    const layers = currentCover.doc.layers.map((layer) => layer.panel === "wrap" ? ({
      ...layer,
      x: layer.x * scaleX,
      y: layer.y * scaleY,
      width: layer.width * scaleX,
      height: layer.height * scaleY,
    }) : layer);
    updateCover({ bleed: value, doc: { ...currentCover.doc, layers } }, { key: "setup:bleed" });
  };

  const changeTrimSize = (value: string) => {
    const currentBook = bookRef.current;
    void updateBook(currentBook.id, bookInputFromBook({ ...currentBook, trim_size: value }, serializeBookLayout(layoutRef.current)))
      .catch((error) => notify("error", "Trim size could not be saved", String(error)));
  };

  const applyTemplate = (templateId: string) => {
    const current = layoutRef.current.cover;
    const imageLayerSource = current.doc.layers.find((layer): layer is CoverImageLayer => layer.type === "image" && Boolean(layer.src));
    const templateCover = { ...current, image: current.image || imageLayerSource?.src || "" };
    const nextDoc = templateId === "blank"
      ? { ...emptyCoverDocument(), templateId: "blank", background: coverFill(shelfColor) }
      : createCoverDocument(templateId, book, templateCover);
    updateCover({ doc: nextDoc, enabled: true }, { key: `template:${templateId}`, history: true });
    setTemplateOpen(false);
    setSelectedLayerId(null);
    setExtraSelectedIds([]);
    setPanel("wrap");
    setAutoFit(true);
    notify("success", templateId === "blank" ? "Blank cover created" : "Cover template applied", "Your previous design is available in undo.");
  };

  const toggleVisible = (id: string) => {
    const layer = layoutRef.current.cover.doc.layers.find((item) => item.id === id);
    if (!layer) return;
    updateLayer(id, { visible: !layer.visible }, { key: `visible:${id}` });
  };

  const toggleLocked = (id: string) => {
    const layer = layoutRef.current.cover.doc.layers.find((item) => item.id === id);
    if (!layer) return;
    updateLayer(id, { locked: !layer.locked }, { key: `lock:${id}` });
  };

  const duplicateLayers = (ids: string[]) => {
    const current = layoutRef.current.cover;
    const sources = current.doc.layers.filter((layer) => ids.includes(layer.id));
    if (sources.length === 0) return;
    const clones = sources.map((layer, index) => ({
      ...layer,
      id: newCoverLayerId(layer.type),
      name: `${layer.name} copy`,
      x: layer.x + 0.12 + index * 0.04,
      y: layer.y + 0.12 + index * 0.04,
    } as CoverLayer));
    updateDoc({ ...current.doc, layers: [...current.doc.layers, ...clones] }, { key: `duplicate:${ids.join(",")}` });
    setSelectedLayerId(clones[clones.length - 1]?.id ?? null);
    setExtraSelectedIds(clones.slice(0, -1).map((layer) => layer.id));
  };

  const duplicateLayer = (id: string) => duplicateLayers([id]);
  const duplicateSelection = () => duplicateLayers(selectedIds);

  const deleteLayers = (ids: string[]) => {
    if (ids.length === 0) return;
    const current = layoutRef.current.cover;
    updateDoc({ ...current.doc, layers: current.doc.layers.filter((layer) => !ids.includes(layer.id)) }, { key: `delete:${ids.join(",")}` });
    setSelectedLayerId(null);
    setExtraSelectedIds([]);
  };

  const deleteLayer = (id: string) => deleteLayers([id]);
  const deleteSelection = () => deleteLayers(selectedIds);

  const selectAllLayers = () => {
    const ids = doc.layers.filter((layer) => layer.visible && !layer.locked).map((layer) => layer.id);
    if (ids.length === 0) return;
    setSelectedLayerId(ids[ids.length - 1]);
    setExtraSelectedIds(ids.slice(0, -1));
  };

  const alignSelection = (mode: CoverAlignMode) => {
    if (selectedLayers.length === 0) return;
    const bounds = selectedLayers.length > 1
      ? coverSelectionBounds(metrics, selectedLayers)
      : coverPanelRectFor(metrics, selectedLayers[0].panel);
    const patches = alignCoverLayers(metrics, selectedLayers, mode, bounds);
    updateLayers(patches.map((patch) => ({ id: patch.id, patch: { x: patch.x, y: patch.y } })), { key: `align:${mode}:${selectedIds.join(",")}` });
  };

  const distributeSelection = (axis: CoverDistributeAxis) => {
    const patches = distributeCoverLayers(metrics, selectedLayers, axis);
    if (patches.length === 0) return;
    updateLayers(patches.map((patch) => ({ id: patch.id, patch: { x: patch.x, y: patch.y } })), { key: `distribute:${axis}:${selectedIds.join(",")}` });
  };

  const nudgeSelection = (dx: number, dy: number) => {
    const current = layoutRef.current.cover;
    const layers = current.doc.layers.filter((layer) => selectedIds.includes(layer.id) && !layer.locked);
    if (layers.length === 0) return;
    updateLayers(layers.map((layer) => ({
      id: layer.id,
      patch: { x: layer.x + dx, y: layer.y + dy },
    })), { key: `nudge:${selectedIds.join(",")}` });
  };

  const addGuide = (axis: "x" | "y", spreadPosition: number) => {
    const current = layoutRef.current.cover;
    const targetPanel = panel;
    const origin = targetPanel === "wrap" ? 0 : axis === "x" ? metrics.panelOrigins[targetPanel].x : metrics.panelOrigins[targetPanel].y;
    const size = coverPanelSize(metrics, targetPanel);
    const limit = axis === "x" ? size.width : size.height;
    const position = Math.max(0, Math.min(limit, spreadPosition - origin));
    updateDoc({ ...current.doc, guides: [...current.doc.guides, { id: newCoverLayerId("guide"), axis, panel: targetPanel, position }] }, { key: "guide:add" });
  };

  const changeGuide = (id: string, spreadPosition: number) => {
    const current = layoutRef.current.cover;
    const guide = current.doc.guides.find((item) => item.id === id);
    if (!guide) return;
    const size = coverPanelSize(metrics, guide.panel);
    const limit = guide.axis === "x" ? size.width : size.height;
    const position = Math.max(0, Math.min(limit, coverGuidePanelPosition(metrics, guide, spreadPosition)));
    updateDoc({ ...current.doc, guides: current.doc.guides.map((item) => item.id === id ? { ...item, position } : item) }, { key: `guide:${id}` });
  };

  const deleteGuide = (id: string) => {
    const current = layoutRef.current.cover;
    updateDoc({ ...current.doc, guides: current.doc.guides.filter((guide) => guide.id !== id) }, { key: `guide-delete:${id}` });
  };

  const reorderLayer = (id: string, direction: "up" | "down") => {
    const current = layoutRef.current.cover;
    const index = current.doc.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index + 1 : index - 1;
    if (target < 0 || target >= current.doc.layers.length) return;
    const layers = [...current.doc.layers];
    [layers[index], layers[target]] = [layers[target], layers[index]];
    updateDoc({ ...current.doc, layers }, { key: `reorder:${id}` });
  };

  const reorderDrag = (id: string, targetId: string) => {
    if (id === targetId) return;
    const current = layoutRef.current.cover;
    const from = current.doc.layers.findIndex((layer) => layer.id === id);
    const to = current.doc.layers.findIndex((layer) => layer.id === targetId);
    if (from < 0 || to < 0) return;
    const layers = [...current.doc.layers];
    const [layer] = layers.splice(from, 1);
    layers.splice(to, 0, layer);
    updateDoc({ ...current.doc, layers }, { key: `reorder-drag:${id}` });
  };

  const onInteractionStart = useCallback((key: string) => {
    pushHistory(layoutRef.current.cover, key);
  }, [pushHistory]);

  const requestEditText = (id: string) => {
    setSelectedLayerId(id);
    setExtraSelectedIds([]);
    setFocusContent((value) => value + 1);
  };

  const handleDownload = async (target: CoverPanel, format: "png" | "jpeg" = "png") => {
    setBusyDownload(`${target}-${format}`);
    try {
      const filename = await downloadCoverFile(book, layoutRef.current.cover, target, { dpi, format, bleed: target === "wrap" });
      if (filename) notify("success", "Cover downloaded", filename);
      setDownloadOpen(false);
    } catch (error) {
      notify("error", "Cover could not be downloaded", String(error));
    } finally {
      setBusyDownload(null);
    }
  };

  const printCover = () => {
    const start = () => {
      document.body.classList.add("print-cover-only");
      window.print();
      window.setTimeout(() => document.body.classList.remove("print-cover-only"), 1400);
    };
    void saveNow(layoutRef.current).then(() => window.setTimeout(start, 120)).catch(() => start());
  };

  const handleDownloadPdf = async (marks: boolean) => {
    setBusyDownload(marks ? "pdf-marks" : "pdf");
    try {
      const filename = await downloadCoverPdf(book, layoutRef.current.cover, { dpi, marks });
      if (filename) notify("success", "Print PDF ready", filename);
      setDownloadOpen(false);
    } catch (error) {
      notify("error", "Print PDF could not be generated", String(error));
    } finally {
      setBusyDownload(null);
    }
  };

  const addTextTool = () => {
    makeTextLayer();
    setTool("select");
  };

  const keyboardHandler = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const editing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
    if (event.key === "Escape") {
      if (previewing) setPreviewing(false);
      else if (symbolOpen) setSymbolOpen(false);
      else if (artworkOpen) setArtworkOpen(false);
      else if (downloadOpen) setDownloadOpen(false);
      else if (templateOpen) setTemplateOpen(false);
      else if (selectedIds.length > 1) { setSelectedLayerId(selectedLayerId); setExtraSelectedIds([]); }
      else selectLayer(null);
      return;
    }
    if (editing) return;
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLocaleLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if (meta && event.key.toLocaleLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (meta && event.key.toLocaleLowerCase() === "a") {
      event.preventDefault();
      selectAllLayers();
      return;
    }
    if (meta && event.key.toLocaleLowerCase() === "d" && selectedIds.length > 0) {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length > 0) {
      event.preventDefault();
      deleteSelection();
      return;
    }
    if (selectedIds.length > 0 && event.key.startsWith("Arrow")) {
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 0.02;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      nudgeSelection(dx, dy);
      return;
    }
    if (meta || event.altKey) return;
    const key = event.key.toLocaleLowerCase();
    if (key === "v") setTool("select");
    if (key === "t") { setTool("text"); makeTextLayer(); setTool("select"); }
    if (key === "i") { fileInputRef.current?.click(); }
    if (key === "r") makeShapeLayer("rectangle");
    if (key === "o") makeShapeLayer("ellipse");
    if (key === "l") makeLineLayer();
    if (key === "b") makeBarcodeLayer();
    if (key === "s") { setSymbolOpen(true); setArtworkOpen(false); }
    if (key === "a") { setArtworkOpen(true); setSymbolOpen(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewing, symbolOpen, artworkOpen, downloadOpen, templateOpen, selectedLayerId, selectedIds, undo, redo]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyboardHandler(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [keyboardHandler]);

  useEffect(() => {
    if (!downloadOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".cover-download-wrap")) return;
      setDownloadOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [downloadOpen]);

  const addSymbolAt = (glyph: string) => {
    makeSymbolLayer(glyph);
  };

  return (
    <div className={`books-screen books-cover-screen ${previewing ? "is-previewing" : ""}`}>
      <div className="cover-designer">
        <header className="cover-designer-bar">
          <div className="cover-bar-left">
            <button type="button" className="cover-icon-button" onClick={() => onNavigate?.("library")} title="Back to library" aria-label="Back to library"><ChevronLeft size={16} /></button>
            <span className="cover-brand-mark"><CameraMark /></span>
            <div className="cover-bar-title">
              <span>Cover studio</span>
              <strong>{book.title || "Untitled manuscript"}</strong>
            </div>
            <span className={`books-save-state cover-save-state ${saveState}`} aria-live="polite">{saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved" : "Saved"}</span>
          </div>
          <div className="cover-bar-center">
            <div className="cover-view-tabs" role="tablist" aria-label="Cover view">
              {(["wrap", "front", "spine", "back"] as CoverPanel[]).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={panel === item} className={panel === item ? "active" : ""} onClick={() => { setPanel(item); setAutoFit(true); }}>
                  {item === "wrap" ? "Spread" : item === "front" ? "Front" : item === "spine" ? "Spine" : "Back"}
                </button>
              ))}
            </div>
            <span className="cover-bar-divider" />
            <button type="button" className={`cover-icon-button ${doc.showGuides ? "active" : ""}`} title="Toggle guides" aria-label="Toggle guides" onClick={() => updateDoc({ ...doc, showGuides: !doc.showGuides }, { key: "guides" })}><Frame size={15} /></button>
            <button type="button" className={`cover-icon-button ${doc.showRulers ? "active" : ""}`} title="Toggle rulers" aria-label="Toggle rulers" onClick={() => updateDoc({ ...doc, showRulers: !doc.showRulers }, { key: "rulers" })}><Ruler size={15} /></button>
            <button type="button" className={`cover-icon-button ${doc.showGrid ? "active" : ""}`} title="Toggle grid" aria-label="Toggle grid" onClick={() => updateDoc({ ...doc, showGrid: !doc.showGrid }, { key: "grid" })}><Grid3X3 size={15} /></button>
            <button type="button" className={`cover-icon-button ${previewing ? "active" : ""}`} title={previewing ? "Exit preview" : "Preview cover"} aria-label={previewing ? "Exit preview" : "Preview cover"} onClick={() => { setPreviewing((value) => !value); setDownloadOpen(false); setSymbolOpen(false); setArtworkOpen(false); }}><ScanLine size={15} /></button>
          </div>
          <div className="cover-bar-right">
            <span className="cover-dimension-chip">{formatDimension(metrics.fullWidth)} × {formatDimension(metrics.fullHeight)} in</span>
            <button type="button" className="cover-icon-button" title="Undo" aria-label="Undo" disabled={history.length === 0} onClick={undo}><Undo2 size={15} /></button>
            <button type="button" className="cover-icon-button" title="Redo" aria-label="Redo" disabled={future.length === 0} onClick={redo}><Redo2 size={15} /></button>
            <button type="button" className="cover-outline-button" onClick={() => { setTemplateOpen(true); setDownloadOpen(false); setSymbolOpen(false); setArtworkOpen(false); }}><LayoutTemplate size={14} /><span>Templates</span></button>
            <button type="button" className="cover-icon-button" title="Print cover" aria-label="Print cover" onClick={printCover}><Printer size={15} /></button>
            <div className="cover-download-wrap">
              <button type="button" className="cover-primary-button" onClick={() => { setDownloadOpen((value) => !value); setSymbolOpen(false); setArtworkOpen(false); }} disabled={Boolean(busyDownload)}>
                {busyDownload ? <span className="cover-spinner" /> : <Download size={14} />}<span>{busyDownload ? "Rendering…" : "Download"}</span><ChevronDown size={13} />
              </button>
              {downloadOpen && (
                <div className="cover-download-menu" role="menu">
                  <div className="cover-download-head">
                    <div><strong>Export cover</strong><small>Print-ready files with real spine width</small></div>
                    <span>{dpi} DPI</span>
                  </div>
                  <div className="cover-dpi-row" role="group" aria-label="Export resolution">
                    {[150, 300].map((value) => <button key={value} type="button" className={dpi === value ? "active" : ""} onClick={() => setDpi(value)}>{value} DPI</button>)}
                  </div>
                  <button type="button" role="menuitem" onClick={() => void handleDownload("wrap")}><FileImage size={14} /><span><strong>Full wrap</strong><small>Back + spine + front, with bleed</small></span></button>
                  <div className="cover-download-grid">
                    <button type="button" role="menuitem" onClick={() => void handleDownload("front")}><span><strong>Front</strong><small>Trim size</small></span></button>
                    <button type="button" role="menuitem" onClick={() => void handleDownload("back")}><span><strong>Back</strong><small>Trim size</small></span></button>
                    <button type="button" role="menuitem" onClick={() => void handleDownload("spine")}><span><strong>Spine</strong><small>{formatDimension(metrics.spineWidth)} in</small></span></button>
                  </div>
                  <button type="button" role="menuitem" onClick={() => void handleDownload("wrap", "jpeg")}><FileDown size={14} /><span><strong>Full wrap JPEG</strong><small>Smaller file for proofs & sharing</small></span></button>
                  <div className="cover-download-sep" />
                  <div className="cover-download-subhead">Print-ready PDF <small>Vector page · embedded image</small></div>
                  <button type="button" role="menuitem" disabled={Boolean(busyDownload)} onClick={() => void handleDownloadPdf(true)}><FileText size={14} /><span><strong>Full wrap PDF with marks</strong><small>Crop marks, fold marks, colour bar & slug</small></span></button>
                  <button type="button" role="menuitem" disabled={Boolean(busyDownload)} onClick={() => void handleDownloadPdf(false)}><FileText size={14} /><span><strong>Full wrap PDF</strong><small>Trim + bleed without printer marks</small></span></button>
                  <div className="cover-download-sep" />
                  <button type="button" role="menuitem" onClick={() => { setDownloadOpen(false); printCover(); }}><Printer size={14} /><span><strong>Print / Save via browser</strong><small>Uses the full print wrap</small></span></button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="cover-designer-body">
          {!previewing && (
            <ToolRail
              tool={tool}
              symbolOpen={symbolOpen}
              artworkOpen={artworkOpen}
              onSelectTool={(value) => {
                setTool(value);
                if (value !== "symbol") setSymbolOpen(false);
                if (value !== "artwork") setArtworkOpen(false);
                if (value === "text") addTextTool();
                else if (value === "image") fileInputRef.current?.click();
                else if (value === "rect") makeShapeLayer("rectangle");
                else if (value === "ellipse") makeShapeLayer("ellipse");
                else if (value === "line") makeLineLayer();
                else if (value === "symbol") { setSymbolOpen((open) => !open); setArtworkOpen(false); }
                else if (value === "artwork") { setArtworkOpen((open) => !open); setSymbolOpen(false); }
                else if (value === "barcode") makeBarcodeLayer();
              }}
              onAddImage={() => fileInputRef.current?.click()}
              onAddText={addTextTool}
            />
          )}
          {symbolOpen && !previewing && (
            <div className="cover-symbol-popover">
              <div className="cover-popover-head"><span>Ornaments &amp; icons</span><button type="button" onClick={() => setSymbolOpen(false)} aria-label="Close"><X size={13} /></button></div>
              <div className="cover-symbol-grid">{COVER_SYMBOLS.map((glyph) => <button key={glyph} type="button" onClick={() => addSymbolAt(glyph)} title={`Add ${glyph}`}>{glyph}</button>)}</div>
            </div>
          )}
          {artworkOpen && !previewing && (
            <ArtworkPicker onAdd={makeArtworkLayer} onClose={() => setArtworkOpen(false)} />
          )}
          {!previewing && showLayers && (
            <LayerPanel
              doc={doc}
              selectedId={selectedLayerId}
              selectedIds={selectedIds}
              onSelect={selectLayer}
              onAdd={() => fileInputRef.current?.click()}
              onToggleVisible={toggleVisible}
              onToggleLocked={toggleLocked}
              onDuplicate={duplicateLayer}
              onDelete={deleteLayer}
              onReorder={reorderLayer}
              onReorderDrag={reorderDrag}
              onCollapse={() => setShowLayers(false)}
            />
          )}
          {!previewing && !showLayers && (
            <div className="cover-layers-collapsed">
              <button type="button" onClick={() => setShowLayers(true)} title="Show layers" aria-label="Show layers"><LayersIcon /><span>{doc.layers.length}</span></button>
            </div>
          )}
          <CoverStage
            book={book}
            cover={cover}
            panel={panel}
            selectedId={selectedLayerId}
            selectedIds={selectedIds}
            showGuides={doc.showGuides && !previewing}
            showGrid={doc.showGrid && !previewing}
            showBleed={doc.showBleed}
            previewing={previewing}
            zoom={zoom}
            autoFit={autoFit}
            onSelect={selectLayer}
            onZoom={(value) => { setAutoFit(false); setZoom(value); }}
            onFit={() => setAutoFit(true)}
            onLayersChange={updateLayers}
            onInteractionStart={onInteractionStart}
            onInteractionEnd={NOOP}
            onEditText={requestEditText}
            onGuideAdd={addGuide}
            onGuideChange={changeGuide}
            onGuideDelete={deleteGuide}
            onAlignSelection={alignSelection}
            onDistributeSelection={distributeSelection}
            onDuplicateSelection={duplicateSelection}
            onDeleteSelection={deleteSelection}
            onDropImage={(dataUrl, x, y) => {
              const target = designPanel;
              addLayer(imageLayer({
                id: newCoverLayerId("image"),
                name: "Dropped image",
                panel: target,
                x: Math.max(0, x),
                y: Math.max(0, y),
                width: Math.min(panelWidth * 0.6, 3.4),
                height: Math.min(metrics.trimHeight * 0.5, 4.5),
                src: dataUrl,
                fit: "cover",
              }), target);
            }}
          />
          {!previewing && (
            <Inspector
              book={book}
              cover={cover}
              metrics={metrics}
              selected={selected}
              selectedCount={selectedIds.length}
              pageEstimate={pageEstimate}
              onSelect={selectLayer}
              onUpdateLayer={updateLayer}
              onUpdateCover={updateCover}
              onUpdateDoc={updateDoc}
              onApplyTemplate={() => setTemplateOpen(true)}
              onEstimatePages={useManuscriptEstimate}
              onPageCount={updatePageCount}
              onPaperStock={updatePaperStock}
              onSpineOverride={updateSpineOverride}
              onBleed={updateBleed}
              onTrimSize={changeTrimSize}
              onOpenSettings={() => onNavigate?.("settings")}
              onReplaceImage={() => { if (selected?.type === "image") replaceImageInputRef.current?.click(); }}
              onUploadBarcode={() => barcodeInputRef.current?.click()}
              onClearBarcode={() => updateCover({ barcodeImage: "" }, { key: "barcode-image" })}
              focusContent={focusContent}
            />
          )}
          {previewing && (
            <div className="cover-preview-exit">
              <button type="button" className="cover-outline-button" onClick={() => setPreviewing(false)}><EyeOff size={14} /> Exit preview</button>
            </div>
          )}
        </div>

        <input
          ref={(element) => {
            fileInputRef.current = element;
          }}
          type="file"
          accept="image/*"
          className="cover-hidden-input"
          onChange={(event) => {
            void addImage(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <input
          ref={(element) => { replaceImageInputRef.current = element; }}
          type="file"
          accept="image/*"
          className="cover-hidden-input"
          onChange={(event) => {
            void replaceImage(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <input
          ref={(element) => { barcodeInputRef.current = element; }}
          type="file"
          accept="image/*"
          className="cover-hidden-input"
          onChange={(event) => { void uploadBarcode(event.target.files?.[0] ?? null); event.target.value = ""; }}
        />

        {coverChapter && !previewing && (
          <button type="button" className="cover-source-strip" onClick={() => onOpenChapter(coverChapter.id)}>
            <span><BookOpen size={13} /> Cover section copy</span>
            <small>Edit “{coverChapter.title || "Cover"}” for reader-facing issue text</small>
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {templateOpen && <TemplateModal book={book} cover={cover} onApply={applyTemplate} onClose={() => setTemplateOpen(false)} />}
    </div>
  );
}

/* ========================================================================== */

function CameraMark() {
  return <span className="cover-camera-mark"><span /><span /><i /></span>;
}

function LayersIcon() {
  return <LayersGlyph />;
}

function LayersGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </svg>
  );
}

function ToolRail({
  tool,
  symbolOpen,
  artworkOpen,
  onSelectTool,
  onAddImage,
  onAddText,
}: {
  tool: string;
  symbolOpen: boolean;
  artworkOpen: boolean;
  onSelectTool: (tool: string) => void;
  onAddImage: () => void;
  onAddText: () => void;
}) {
  const tools: { id: string; label: string; shortcut: string; icon: ReactNode; action?: () => void }[] = [
    { id: "select", label: "Select & move", shortcut: "V", icon: <Move size={18} /> },
    { id: "text", label: "Add text", shortcut: "T", icon: <Type size={18} />, action: onAddText },
    { id: "image", label: "Add image", shortcut: "I", icon: <ImagePlus size={18} />, action: onAddImage },
    { id: "rect", label: "Rectangle", shortcut: "R", icon: <Square size={18} /> },
    { id: "ellipse", label: "Ellipse", shortcut: "O", icon: <Circle size={18} /> },
    { id: "line", label: "Rule line", shortcut: "L", icon: <Minus size={18} /> },
    { id: "symbol", label: "Ornaments", shortcut: "S", icon: <Star size={18} /> },
    { id: "artwork", label: "Artwork library", shortcut: "A", icon: <Feather size={18} /> },
    { id: "barcode", label: "ISBN barcode", shortcut: "B", icon: <Barcode size={18} /> },
  ];
  return (
    <aside className="cover-tool-rail" aria-label="Cover tools">
      {tools.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${tool === item.id || (item.id === "symbol" && symbolOpen) || (item.id === "artwork" && artworkOpen) ? "active" : ""} ${item.id === "barcode" ? "accent" : ""}`}
          onClick={() => onSelectTool(item.id)}
          data-tooltip={`${item.label} · ${item.shortcut}`}
          aria-label={item.label}
        >
          {item.icon}
          <span>{item.shortcut}</span>
        </button>
      ))}
    </aside>
  );
}

function ArtworkPicker({ onAdd, onClose }: { onAdd: (graphic: BookGraphic) => void; onClose: () => void }) {
  const [category, setCategory] = useState<string>(BOOK_GRAPHIC_CATEGORIES[0] ?? "Ornaments");
  const graphics = BOOK_GRAPHICS.filter((graphic) => graphic.category === category);
  return (
    <div className="cover-artwork-popover">
      <div className="cover-popover-head"><span>Artwork library</span><button type="button" onClick={onClose} aria-label="Close"><X size={13} /></button></div>
      <div className="cover-artwork-categories">
        {BOOK_GRAPHIC_CATEGORIES.map((item) => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="cover-artwork-grid">
        {graphics.map((graphic) => (
          <button key={graphic.id} type="button" onClick={() => onAdd(graphic)} title={graphic.label}>
            <span><img src={graphicDataUri(graphic.svg, "#6f5845")} alt="" loading="lazy" /></span>
            <small>{graphic.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */

function LayerPanel({ doc, selectedId, selectedIds, onSelect, onAdd, onToggleVisible, onToggleLocked, onDuplicate, onDelete, onReorder, onReorderDrag, onCollapse }: LayerPanelProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const layers = [...doc.layers].reverse();
  return (
    <aside className="cover-layer-panel" aria-label="Layers">
      <div className="cover-panel-heading">
        <div><span className="cover-panel-eyebrow">Layers</span><strong>{doc.layers.length + 1}</strong></div>
        <div className="cover-panel-heading-actions">
          <button type="button" onClick={onAdd} title="Add image layer" aria-label="Add image layer"><Plus size={15} /></button>
          <button type="button" onClick={onCollapse} title="Hide layers" aria-label="Hide layers"><ChevronLeft size={15} /></button>
        </div>
      </div>
      <div className="cover-layer-list">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`cover-layer-row ${selectedIds.includes(layer.id) ? "active" : ""} ${selectedId === layer.id ? "primary" : ""} ${overId === layer.id ? "drop-target" : ""} ${layer.visible ? "" : "is-hidden"}`}
            draggable
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", layer.id); setDragId(layer.id); }}
            onDragOver={(event) => { event.preventDefault(); setOverId(layer.id); }}
            onDragLeave={() => setOverId((value) => value === layer.id ? null : value)}
            onDrop={(event) => {
              event.preventDefault();
              if (dragId) onReorderDrag(dragId, layer.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onClick={(event) => onSelect(layer.id, event.shiftKey || event.metaKey || event.ctrlKey)}
          >
            <button type="button" className={`cover-layer-eye ${layer.visible ? "" : "off"}`} onClick={(event) => { event.stopPropagation(); onToggleVisible(layer.id); }} title={layer.visible ? "Hide layer" : "Show layer"} aria-label={layer.visible ? "Hide layer" : "Show layer"}>{layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
            <span className="cover-layer-type-icon"><LayerIcon type={layer.type} size={13} /></span>
            <span className="cover-layer-name" title={layer.name}>{layer.name || layerLabel(layer.type)}<small>{layer.panel === "wrap" ? "whole wrap" : layer.panel}</small></span>
            <button type="button" className={`cover-layer-lock ${layer.locked ? "locked" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleLocked(layer.id); }} title={layer.locked ? "Unlock layer" : "Lock layer"} aria-label={layer.locked ? "Unlock layer" : "Lock layer"}>{layer.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
          </div>
        ))}
        <button type="button" className="cover-background-row" onClick={() => onSelect(null)}>
          <span className="cover-layer-type-icon"><Palette size={13} /></span>
          <span className="cover-layer-name">Background<small>paper &amp; gradient</small></span>
          <span className="cover-background-swatch" style={{ background: coverFillCss(doc.background) }} />
        </button>
      </div>
      {selectedIds.length > 0 && (
        <div className="cover-layer-actions">
          <button type="button" onClick={() => onReorder(selectedId ?? selectedIds[0], "up")} title="Move layer up" aria-label="Move layer up"><ArrowUp size={13} /></button>
          <button type="button" onClick={() => onReorder(selectedId ?? selectedIds[0], "down")} title="Move layer down" aria-label="Move layer down"><ArrowDown size={13} /></button>
          <button type="button" onClick={() => onDuplicate(selectedId ?? selectedIds[0])} title={selectedIds.length > 1 ? "Duplicate selected layers" : "Duplicate layer"} aria-label="Duplicate layer"><Copy size={13} /></button>
          <button type="button" className="danger" onClick={() => onDelete(selectedId ?? selectedIds[0])} title={selectedIds.length > 1 ? "Delete selected layers" : "Delete layer"} aria-label="Delete layer"><Trash2 size={13} /></button>
        </div>
      )}
      <div className="cover-layer-hint"><Move size={11} /> {selectedIds.length > 1 ? `${selectedIds.length} layers selected` : "Drag to reorder · Shift-click to multi-select"}</div>
    </aside>
  );
}

/* ========================================================================== */

function CoverStage({ book, cover, panel, selectedId, selectedIds, showGuides, showGrid, showBleed, previewing, zoom, autoFit, onSelect, onZoom, onFit, onLayersChange, onInteractionStart, onInteractionEnd, onEditText, onDropImage, onGuideAdd, onGuideChange, onGuideDelete, onAlignSelection, onDistributeSelection, onDuplicateSelection, onDeleteSelection }: CoverStageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [interaction, setInteraction] = useState<{
    mode: "move" | "resize" | "rotate";
    layerId: string;
    handle?: string;
    startClientX: number;
    startClientY: number;
    startLayer: CoverLayer;
    startLayers: CoverLayer[];
    startScale: number;
    startAngle?: number;
    startRotation?: number;
    centerX?: number;
    centerY?: number;
  } | null>(null);
  const [guideDraft, setGuideDraft] = useState<{ id: string; axis: "x" | "y"; spread: number } | null>(null);
  const [guideInteraction, setGuideInteraction] = useState<{ mode: "new" | "move"; id: string; axis: "x" | "y"; startClientX: number; startClientY: number } | null>(null);
  const guideMovedRef = useRef(false);
  const guidePositionRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [snapGuides, setSnapGuides] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const movedRef = useRef(false);
  const metrics = useMemo(() => coverMetrics(book.trim_size, cover), [book.trim_size, cover.pageCount, cover.paperStock, cover.spineWidthOverride, cover.bleed]);
  const panelRect = coverPanelRect(metrics, panel);
  const viewRect = panel === "wrap"
    ? { x: 0, y: 0, width: metrics.fullWidth, height: metrics.fullHeight }
    : { x: Math.max(0, panelRect.x - metrics.bleed), y: 0, width: panelRect.width + metrics.bleed * 2, height: metrics.fullHeight };
  const fitScale = viewport.width > 0 && viewport.height > 0
    ? Math.min((viewport.width - 76) / (viewRect.width * 96), (viewport.height - 86) / (viewRect.height * 96), 1.35)
    : 0.6;
  const effectiveZoom = autoFit ? Math.max(0.05, fitScale) : zoom;
  const contentWidth = viewRect.width * 96 * effectiveZoom;
  const contentHeight = viewRect.height * 96 * effectiveZoom;
  const stageRef = useRef<HTMLDivElement>(null);
  const currentDesignPanel: Exclude<CoverPanel, "wrap"> = panel === "wrap" ? "front" : panel;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const listener = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      onZoom(Math.min(3, Math.max(0.08, effectiveZoom - normalizeWheelDelta(event) * 0.0015)));
    };
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, [effectiveZoom, onZoom]);

  useEffect(() => {
    if (!guideInteraction) return;
    const move = (event: PointerEvent) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const rect = sheet.getBoundingClientRect();
      const scale = rect.width / metrics.fullWidth;
      if (scale <= 0) return;
      const spread = (guideInteraction.axis === "x" ? event.clientX - rect.left : event.clientY - rect.top) / scale;
      guidePositionRef.current = Math.round(spread * 1000) / 1000;
      if (Math.abs(event.clientX - guideInteraction.startClientX) > 3 || Math.abs(event.clientY - guideInteraction.startClientY) > 3) guideMovedRef.current = true;
      if (guideInteraction.mode === "new") {
        setGuideDraft({ id: guideInteraction.id, axis: guideInteraction.axis, spread: guidePositionRef.current });
      } else {
        onGuideChange(guideInteraction.id, guidePositionRef.current);
      }
    };
    const up = () => {
      if (guideInteraction.mode === "new" && guideMovedRef.current) {
        const limit = guideInteraction.axis === "x" ? metrics.fullWidth : metrics.fullHeight;
        if (guidePositionRef.current >= 0 && guidePositionRef.current <= limit) onGuideAdd(guideInteraction.axis, guidePositionRef.current);
      }
      setGuideDraft(null);
      setGuideInteraction(null);
      guideMovedRef.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [guideInteraction, metrics.fullWidth, metrics.fullHeight, onGuideAdd, onGuideChange]);

  useEffect(() => {
    if (!interaction) return;
    const move = (event: PointerEvent) => {
      const layer = interaction.startLayer;
      const dx = (event.clientX - interaction.startClientX) / interaction.startScale;
      const dy = (event.clientY - interaction.startClientY) / interaction.startScale;
      if (!movedRef.current && (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002)) {
        movedRef.current = true;
        onInteractionStart(`${interaction.mode}:${interaction.layerId}${interaction.handle ? `:${interaction.handle}` : ""}`);
      }
      if (!movedRef.current) return;
      if (interaction.mode === "move") {
        let x = layer.x + dx;
        let y = layer.y + dy;
        const stageWidth = layer.panel === "wrap" ? metrics.fullWidth : layer.panel === "back" ? metrics.panelWidths.back : layer.panel === "spine" ? metrics.panelWidths.spine : metrics.panelWidths.front;
        const stageHeight = layer.panel === "wrap" ? metrics.fullHeight : metrics.trimHeight;
        const vertical: number[] = [];
        const horizontal: number[] = [];
        if (!event.altKey) {
          const targetsX = [0, stageWidth / 2, stageWidth];
          const targetsY = [0, stageHeight / 2, stageHeight];
          if (layer.panel === "wrap") {
            targetsX.push(metrics.bleed, metrics.bleed + metrics.trimWidth, metrics.bleed + metrics.trimWidth + metrics.spineWidth, metrics.fullWidth - metrics.bleed);
            targetsY.push(metrics.bleed, metrics.fullHeight - metrics.bleed);
          }
          const otherLayers = cover.doc.layers.filter((item) => item.id !== layer.id && item.visible && item.panel === layer.panel && !selectedIds.includes(item.id));
          for (const other of otherLayers) {
            targetsX.push(other.x, other.x + other.width / 2, other.x + other.width);
            targetsY.push(other.y, other.y + other.height / 2, other.y + other.height);
          }
          const origin = layer.panel === "wrap" ? { x: 0, y: 0 } : metrics.panelOrigins[layer.panel];
          for (const guide of cover.doc.guides) {
            let position = guide.position;
            if (guide.panel !== layer.panel && layer.panel !== "wrap" && guide.panel === "wrap") position -= guide.axis === "x" ? origin.x : origin.y;
            else if (guide.panel !== layer.panel && layer.panel === "wrap" && guide.panel !== "wrap") position += guide.axis === "x" ? metrics.panelOrigins[guide.panel].x : metrics.panelOrigins[guide.panel].y;
            else if (guide.panel !== layer.panel) continue;
            if (guide.axis === "x") targetsX.push(position);
            else targetsY.push(position);
          }
          const snapped = snapCoverRect({ x, y, width: layer.width, height: layer.height }, targetsX, targetsY);
          x = snapped.x;
          y = snapped.y;
          vertical.push(...snapped.vertical);
          horizontal.push(...snapped.horizontal);
        }
        setSnapGuides({ vertical, horizontal });
        const moveX = x - layer.x;
        const moveY = y - layer.y;
        onLayersChange(interaction.startLayers.map((item) => ({
          id: item.id,
          patch: { x: Math.round((item.x + moveX) * 1000) / 1000, y: Math.round((item.y + moveY) * 1000) / 1000 },
        })), { history: false });
        return;
      }
      if (interaction.mode === "resize") {
        const handle = interaction.handle ?? "se";
        const rotation = (-layer.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rotation) - dy * Math.sin(rotation);
        const localY = dx * Math.sin(rotation) + dy * Math.cos(rotation);
        let x = layer.x;
        let y = layer.y;
        let width = layer.width;
        let height = layer.height;
        if (handle.includes("e")) width += localX;
        if (handle.includes("w")) { x += localX; width -= localX; }
        if (handle.includes("s")) height += localY;
        if (handle.includes("n")) { y += localY; height -= localY; }
        if (width < 0.08) {
          if (handle.includes("w")) x -= 0.08 - width;
          width = 0.08;
        }
        if (height < 0.04) {
          if (handle.includes("n")) y -= 0.04 - height;
          height = 0.04;
        }
        onLayersChange([{ id: layer.id, patch: { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, width: Math.round(width * 1000) / 1000, height: Math.round(height * 1000) / 1000 } }], { history: false });
        return;
      }
      if (interaction.mode === "rotate" && interaction.centerX !== undefined && interaction.centerY !== undefined && interaction.startAngle !== undefined) {
        const angle = (Math.atan2(event.clientY - interaction.centerY, event.clientX - interaction.centerX) * 180) / Math.PI;
        let rotation = (interaction.startRotation ?? 0) + angle - interaction.startAngle;
        if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
        onLayersChange([{ id: layer.id, patch: { rotation: Math.round(rotation * 10) / 10 } }], { history: false });
      }
    };
    const up = () => {
      movedRef.current = false;
      setInteraction(null);
      setSnapGuides({ vertical: [], horizontal: [] });
      onInteractionEnd();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [interaction, cover.doc.guides, metrics, onLayersChange, onInteractionEnd, onInteractionStart, selectedIds]);

  const beginMove = (event: ReactPointerEvent<HTMLDivElement>, layer: CoverLayer) => {
    if (previewing || layer.locked) return;
    if ((event.target as HTMLElement).closest(".cover-selection-handle, .cover-rotate-handle")) return;
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      onSelect(layer.id, true);
      return;
    }
    const wasSelected = selectedIds.includes(layer.id);
    if (!wasSelected) onSelect(layer.id);
    const ids = wasSelected ? selectedIds : [layer.id];
    const startLayers = cover.doc.layers.filter((item) => ids.includes(item.id) && !item.locked && item.visible);
    const sheet = (event.currentTarget.closest("[data-cover-sheet]") as HTMLElement | null) ?? stageRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const scale = rect.width / metrics.fullWidth;
    movedRef.current = false;
    setInteraction({
      mode: "move",
      layerId: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayer: layer,
      startLayers: startLayers.length ? startLayers : [layer],
      startScale: scale,
    });
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>, layer: CoverLayer, handle: string) => {
    if (previewing || layer.locked) return;
    event.stopPropagation();
    event.preventDefault();
    const sheet = event.currentTarget.closest("[data-cover-sheet]") as HTMLElement | null;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const scale = rect.width / metrics.fullWidth;
    movedRef.current = false;
    setInteraction({
      mode: "resize",
      layerId: layer.id,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayer: layer,
      startLayers: [layer],
      startScale: scale,
    });
  };

  const beginRotate = (event: ReactPointerEvent<HTMLButtonElement>, layer: CoverLayer) => {
    if (previewing || layer.locked) return;
    event.stopPropagation();
    event.preventDefault();
    const sheet = event.currentTarget.closest("[data-cover-sheet]") as HTMLElement | null;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const scale = rect.width / metrics.fullWidth;
    const layerRect = spreadRectFor(layer);
    const centerX = rect.left + (layerRect.x + layerRect.width / 2) * scale;
    const centerY = rect.top + (layerRect.y + layerRect.height / 2) * scale;
    const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
    movedRef.current = false;
    setInteraction({
      mode: "rotate",
      layerId: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayer: layer,
      startLayers: [layer],
      startScale: scale,
      startAngle: angle,
      startRotation: layer.rotation,
      centerX,
      centerY,
    });
  };

  const spreadRectFor = (layer: CoverLayer) => coverSpreadRect(metrics, layer);

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (previewing) return;
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      const sheet = event.currentTarget;
      const rect = sheet.getBoundingClientRect();
      const scale = rect.width / metrics.fullWidth;
      const spreadX = (event.clientX - rect.left) / scale;
      const spreadY = (event.clientY - rect.top) / scale;
      const origin = metrics.panelOrigins[currentDesignPanel];
      const width = Math.min(currentDesignPanel === "spine" ? metrics.spineWidth : metrics.panelWidths[currentDesignPanel] * 0.6, 3.4);
      const height = Math.min(metrics.trimHeight * 0.5, width * 0.75);
      onDropImage(dataUrl, spreadX - origin.x - width / 2, spreadY - origin.y - height / 2);
    } catch (error) {
      notify("error", "Image could not be dropped", String(error));
    }
  };

  const beginNewGuide = (event: ReactPointerEvent<HTMLDivElement>, axis: "x" | "y") => {
    if (previewing) return;
    event.preventDefault();
    event.stopPropagation();
    guideMovedRef.current = false;
    setGuideInteraction({ mode: "new", id: `draft-${axis}`, axis, startClientX: event.clientX, startClientY: event.clientY });
  };

  const beginGuideMove = (event: ReactPointerEvent<HTMLSpanElement>, guide: CoverGuideline) => {
    if (previewing) return;
    event.preventDefault();
    event.stopPropagation();
    guideMovedRef.current = false;
    setGuideInteraction({ mode: "move", id: guide.id, axis: guide.axis, startClientX: event.clientX, startClientY: event.clientY });
  };

  return (
    <main className={`cover-stage ${previewing ? "is-previewing" : ""}`} ref={viewportRef}>
      <div className="cover-stage-meta">
        <span className="cover-stage-context">{panel === "wrap" ? "Full wrap" : panel === "front" ? "Front cover" : panel === "back" ? "Back cover" : "Spine"}</span>
        <span className="cover-stage-sep" />
        <span>{formatDimension(metrics.trimWidth)} × {formatDimension(metrics.trimHeight)} in trim</span>
        <span className="cover-stage-spacer" />
        <span>{formatDimension(metrics.spineWidth)} in spine · {cover.pageCount.toLocaleString()} pages</span>
      </div>
      {selectedIds.length > 1 && !previewing && (
        <div className="cover-selection-bar" role="toolbar" aria-label="Selection tools">
          <span className="cover-selection-count">{selectedIds.length} layers</span>
          <span className="cover-selection-sep" />
          <button type="button" title="Align left edges" aria-label="Align left edges" onClick={() => onAlignSelection("left")}><AlignLeft size={14} /></button>
          <button type="button" title="Align horizontal centres" aria-label="Align horizontal centres" onClick={() => onAlignSelection("center-x")}><AlignCenter size={14} /></button>
          <button type="button" title="Align right edges" aria-label="Align right edges" onClick={() => onAlignSelection("right")}><AlignRight size={14} /></button>
          <button type="button" title="Align top edges" aria-label="Align top edges" onClick={() => onAlignSelection("top")}><AlignStartVertical size={14} /></button>
          <button type="button" title="Align vertical centres" aria-label="Align vertical centres" onClick={() => onAlignSelection("middle")}><AlignCenter size={14} /></button>
          <button type="button" title="Align bottom edges" aria-label="Align bottom edges" onClick={() => onAlignSelection("bottom")}><AlignEndVertical size={14} /></button>
          <span className="cover-selection-sep" />
          <button type="button" title="Distribute horizontally" aria-label="Distribute horizontally" disabled={selectedIds.length < 3} onClick={() => onDistributeSelection("horizontal")}><AlignHorizontalDistributeCenter size={14} /></button>
          <button type="button" title="Distribute vertically" aria-label="Distribute vertically" disabled={selectedIds.length < 3} onClick={() => onDistributeSelection("vertical")}><AlignVerticalDistributeCenter size={14} /></button>
          <span className="cover-selection-sep" />
          <button type="button" title="Duplicate selected layers" aria-label="Duplicate selected layers" onClick={onDuplicateSelection}><Copy size={14} /></button>
          <button type="button" className="danger" title="Delete selected layers" aria-label="Delete selected layers" onClick={onDeleteSelection}><Trash2 size={14} /></button>
          <button type="button" title="Deselect all" aria-label="Deselect all" onClick={() => onSelect(null)}><X size={14} /></button>
        </div>
      )}
      <div className="cover-stage-scroll" ref={stageRef}>
        <div className="cover-stage-canvas" style={{ width: contentWidth, height: contentHeight }}>
          <div
            ref={sheetRef}
            className="cover-stage-sheet"
            data-cover-sheet
            onPointerDown={(event) => { if (event.target === event.currentTarget) onSelect(null); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDrop={(event) => void onDrop(event)}
            style={{
              width: `${metrics.fullWidth}in`,
              height: `${metrics.fullHeight}in`,
              transform: `translate(${-viewRect.x * 96 * effectiveZoom}px, ${-viewRect.y * 96 * effectiveZoom}px) scale(${effectiveZoom})`,
              transformOrigin: "0 0",
              background: coverFillCss(cover.doc.background),
              ["--cover-zoom" as string]: String(effectiveZoom),
            }}
          >
            {cover.doc.layers.map((layer) => {
              if (!layer.visible) return null;
              const rect = spreadRectFor(layer);
              const isSelected = selectedIds.includes(layer.id) && !previewing;
              const isPrimary = selectedId === layer.id && !previewing;
              return (
                <div
                  key={layer.id}
                  className={`cover-canvas-layer ${isSelected ? "selected" : ""} ${layer.locked ? "locked" : ""} ${layer.panel !== panel && panel !== "wrap" && layer.panel !== "wrap" ? "out-of-panel" : ""}`}
                  style={{
                    left: `${rect.x}in`,
                    top: `${rect.y}in`,
                    width: `${rect.width}in`,
                    height: `${rect.height}in`,
                    transform: `rotate(${layer.rotation}deg)`,
                    opacity: layer.opacity,
                    mixBlendMode: layer.blendMode as CSSProperties["mixBlendMode"],
                    zIndex: undefined,
                  }}
                  onPointerDown={(event) => beginMove(event, layer)}
                  onDoubleClick={() => { if (layer.type === "text") onEditText(layer.id); }}
                  title={layer.locked ? `${layer.name} (locked)` : layer.name}
                >
                  <div className="cover-canvas-layer-content" style={{ pointerEvents: "none" }} dangerouslySetInnerHTML={{ __html: coverLayerInnerHtml(book, cover, layer, "editor") }} />
                  {isSelected && (
                    <>
                      <span className="cover-selection-outline" />
                      {isPrimary && !layer.locked && (
                        <>
                          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((handle) => (
                            <button key={handle} type="button" className={`cover-selection-handle handle-${handle}`} onPointerDown={(event) => beginResize(event, layer, handle)} aria-label={`Resize ${handle}`} />
                          ))}
                          <button type="button" className="cover-rotate-handle" onPointerDown={(event) => beginRotate(event, layer)} aria-label="Rotate layer"><RotateCw size={11} /></button>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {showGrid && <span className="cover-grid-overlay" />}
            {showBleed && (
              <span className="cover-bleed-guide" style={{ left: `${metrics.bleed}in`, top: `${metrics.bleed}in`, width: `${metrics.trimWidthTotal}in`, height: `${metrics.trimHeight}in` }} />
            )}
            {showGuides && (
              <>
                <span className="cover-trim-guide" style={{ left: `${metrics.bleed}in`, top: `${metrics.bleed}in`, width: `${metrics.trimWidthTotal}in`, height: `${metrics.trimHeight}in` }} />
                <span className="cover-spine-guide" style={{ left: `${metrics.bleed + metrics.trimWidth}in`, top: `${metrics.bleed}in`, height: `${metrics.trimHeight}in` }} />
                <span className="cover-spine-guide" style={{ left: `${metrics.bleed + metrics.trimWidth + metrics.spineWidth}in`, top: `${metrics.bleed}in`, height: `${metrics.trimHeight}in` }} />
                <span className="cover-safe-guide" style={{ left: `${metrics.bleed + 0.25}in`, top: `${metrics.bleed + 0.25}in`, width: `${metrics.trimWidthTotal - 0.5}in`, height: `${metrics.trimHeight - 0.5}in` }} />
                <span className="cover-panel-label label-back" style={{ left: `${metrics.bleed + 0.08}in`, top: `${metrics.bleed + 0.07}in` }}>BACK COVER</span>
                <span className="cover-panel-label label-spine" style={{ left: `${metrics.bleed + metrics.trimWidth + metrics.spineWidth / 2}in`, top: `${metrics.bleed + 0.07}in` }}>SPINE</span>
                <span className="cover-panel-label label-front" style={{ left: `${metrics.bleed + metrics.trimWidth + metrics.spineWidth + 0.08}in`, top: `${metrics.bleed + 0.07}in` }}>FRONT COVER</span>
                {cover.doc.guides.filter((guide) => coverGuideVisible(guide, panel)).map((guide) => {
                  const position = coverGuideSpreadPosition(metrics, guide);
                  return (
                    <span
                      key={guide.id}
                      className={`cover-custom-guide ${guide.axis === "x" ? "vertical" : "horizontal"}`}
                      style={guide.axis === "x"
                        ? { left: `${position}in`, top: 0, height: `${metrics.fullHeight}in` }
                        : { top: `${position}in`, left: 0, width: `${metrics.fullWidth}in` }}
                      onPointerDown={(event) => beginGuideMove(event, guide)}
                      onDoubleClick={(event) => { event.stopPropagation(); onGuideDelete(guide.id); }}
                      title="Drag to move · Double-click to remove"
                    />
                  );
                })}
              </>
            )}
            {guideDraft && (
              <span
                className={`cover-custom-guide draft ${guideDraft.axis === "x" ? "vertical" : "horizontal"}`}
                style={guideDraft.axis === "x"
                  ? { left: `${guideDraft.spread}in`, top: 0, height: `${metrics.fullHeight}in` }
                  : { top: `${guideDraft.spread}in`, left: 0, width: `${metrics.fullWidth}in` }}
              />
            )}
            {cover.doc.showRulers && !previewing && (
              <>
                <div
                  className="cover-ruler cover-ruler-top"
                  style={{ left: `${viewRect.x}in`, top: 0, width: `${viewRect.width}in`, height: `${16 / effectiveZoom}px` }}
                  onPointerDown={(event) => beginNewGuide(event, "y")}
                  title="Drag down to add a horizontal guide"
                >
                  {Array.from({ length: Math.floor(viewRect.width) + 2 }, (_, index) => Math.floor(viewRect.x) + index).map((inch) => (
                    <span key={inch} style={{ left: `${inch - viewRect.x}in`, fontSize: `${8 / effectiveZoom}px` }}>{inch}</span>
                  ))}
                </div>
                <div
                  className="cover-ruler cover-ruler-left"
                  style={{ left: `${viewRect.x}in`, top: 0, height: `${viewRect.height}in`, width: `${16 / effectiveZoom}px` }}
                  onPointerDown={(event) => beginNewGuide(event, "x")}
                  title="Drag right to add a vertical guide"
                >
                  {Array.from({ length: Math.floor(viewRect.height) + 2 }, (_, index) => Math.floor(viewRect.y) + index).map((inch) => (
                    <span key={inch} style={{ top: `${inch - viewRect.y}in`, fontSize: `${8 / effectiveZoom}px` }}>{inch}</span>
                  ))}
                </div>
              </>
            )}
            {snapGuides.vertical.map((position, index) => {
              const origin = panel === "wrap" ? 0 : metrics.panelOrigins[panel as Exclude<CoverPanel, "wrap">].x;
              return <span key={`v-${index}`} className="cover-snap-guide vertical" style={{ left: `${origin + position}in`, top: 0, height: `${metrics.fullHeight}in` }} />;
            })}
            {snapGuides.horizontal.map((position, index) => {
              const origin = panel === "wrap" ? 0 : metrics.panelOrigins[panel as Exclude<CoverPanel, "wrap">].y;
              return <span key={`h-${index}`} className="cover-snap-guide horizontal" style={{ top: `${origin + position}in`, left: 0, width: `${metrics.fullWidth}in` }} />;
            })}
          </div>
        </div>
      </div>
      <div className="cover-stage-footer">
        <div className="cover-zoom-controls">
          <button type="button" onClick={() => onZoom(Math.max(0.08, effectiveZoom - 0.1))} aria-label="Zoom out"><ZoomOut size={14} /></button>
          <span>{Math.round(effectiveZoom * 100)}%</span>
          <button type="button" onClick={() => onZoom(Math.min(3, effectiveZoom + 0.1))} aria-label="Zoom in"><ZoomIn size={14} /></button>
          <button type="button" className={autoFit ? "active" : ""} onClick={onFit}><Maximize2 size={13} /> Fit</button>
        </div>
        <span className="cover-stage-hint"><Move size={12} /> Drag to move · Shift-click multi-select · Drag from rulers for guides · Alt disables snapping</span>
      </div>
    </main>
  );
}

/* ========================================================================== */

function Inspector({ book, cover, metrics, selected, selectedCount, pageEstimate, onSelect, onUpdateLayer, onUpdateCover, onUpdateDoc, onApplyTemplate, onEstimatePages, onPageCount, onPaperStock, onSpineOverride, onBleed, onTrimSize, onOpenSettings, onReplaceImage, onUploadBarcode, onClearBarcode, focusContent }: InspectorProps) {
  return (
    <aside className="cover-inspector" aria-label={selected ? "Layer properties" : "Cover properties"}>
      <div className="cover-inspector-head">
        <div><span className="cover-panel-eyebrow">{selected ? layerLabel(selected.type) : "Cover"}{selectedCount > 1 ? ` · ${selectedCount} selected` : ""}</span><strong>{selectedLayerName(selected)}</strong></div>
        {selected ? <button type="button" onClick={() => onSelect(null)} title="Document settings" aria-label="Document settings"><SlidersHorizontal size={15} /></button> : <span className="cover-inspector-badge">Document</span>}
      </div>
      <div className="cover-inspector-scroll">
        {selected ? (
          <LayerInspector
            cover={cover}
            layer={selected}
            metrics={metrics}
            onUpdate={(patch, options) => onUpdateLayer(selected.id, patch, options)}
            onUpdateCover={onUpdateCover}
            onReplaceImage={onReplaceImage}
            onUploadBarcode={onUploadBarcode}
            onClearBarcode={onClearBarcode}
            focusContent={focusContent}
          />
        ) : (
          <DocumentInspector
            book={book}
            cover={cover}
            metrics={metrics}
            pageEstimate={pageEstimate}
            onUpdateCover={onUpdateCover}
            onUpdateDoc={onUpdateDoc}
            onApplyTemplate={onApplyTemplate}
            onEstimatePages={onEstimatePages}
            onPageCount={onPageCount}
            onPaperStock={onPaperStock}
            onSpineOverride={onSpineOverride}
            onBleed={onBleed}
            onTrimSize={onTrimSize}
            onOpenSettings={onOpenSettings}
            onUploadBarcode={onUploadBarcode}
            onClearBarcode={onClearBarcode}
          />
        )}
      </div>
    </aside>
  );
}

function Section({ title, hint, children, defaultOpen = true }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`cover-inspector-section ${open ? "open" : ""}`}>
      <button type="button" className="cover-inspector-section-head" onClick={() => setOpen((value) => !value)}>
        <span>{title}{hint && <small>{hint}</small>}</span>
        <ChevronDown size={14} />
      </button>
      {open && <div className="cover-inspector-section-body">{children}</div>}
    </section>
  );
}

function NumberField({ label, value, onChange, step = 0.05, min, max, suffix = "in", compact = false }: { label: string; value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number; suffix?: string; compact?: boolean }) {
  return (
    <label className={`cover-number-field ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <span className="cover-number-input">
        <input
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0}
          step={step}
          min={min}
          max={max}
          onChange={(event) => onChange(parseNumeric(event.target.value, value))}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  );
}

function SliderField({ label, value, onChange, min, max, step, suffix = "" }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; suffix?: string }) {
  return (
    <label className="cover-slider-field">
      <span>{label}<small>{Math.round(value * 100) / 100}{suffix}</small></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="cover-color-field">
      <span>{label}</span>
      <span className="cover-color-input-wrap">
        <input type="color" value={pickerColor(value)} onChange={(event) => onChange(event.target.value)} aria-label={`${label} colour`} />
        <input
          type="text"
          value={value}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value;
            if (/^#[0-9a-f]{0,8}$/i.test(next) || next === "") onChange(next || "#000000");
          }}
        />
      </span>
    </label>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="cover-segmented" role="group">
      {options.map((option) => (
        <button key={option.value} type="button" className={value === option.value ? "active" : ""} title={option.title} onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  );
}

function FillEditor({ label, fill, onChange }: { label: string; fill: CoverFill; onChange: (fill: CoverFill) => void }) {
  const update = (patch: Partial<CoverFill>) => onChange({ ...fill, ...patch });
  const updateGradient = (patch: Partial<CoverFill["gradient"]>) => update({ gradient: { ...fill.gradient, ...patch } });
  const setStop = (index: number, patch: Partial<{ color: string; position: number }>) => updateGradient({ stops: fill.gradient.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop) });
  return (
    <div className="cover-fill-editor">
      <div className="cover-fill-head"><span>{label}</span><Segmented value={fill.type} options={[{ value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }, { value: "none", label: "None" }]} onChange={(type) => update({ type })} /></div>
      {fill.type === "solid" && <ColorField label="Colour" value={fill.color} onChange={(color) => update({ color })} />}
      {fill.type === "gradient" && (
        <div className="cover-gradient-editor">
          <div className="cover-fill-row">
            <label>Style<select value={fill.gradient.type} onChange={(event) => updateGradient({ type: event.target.value === "radial" ? "radial" : "linear" })}><option value="linear">Linear</option><option value="radial">Radial</option></select></label>
            {fill.gradient.type === "linear" && <NumberField label="Angle" value={fill.gradient.angle} onChange={(angle) => updateGradient({ angle })} step={1} min={0} max={360} suffix="°" />}
          </div>
          <div className="cover-gradient-stops">
            {fill.gradient.stops.map((stop, index) => (
              <div className="cover-gradient-stop" key={index}>
                <input type="color" value={pickerColor(stop.color)} onChange={(event) => setStop(index, { color: event.target.value })} aria-label={`Gradient stop ${index + 1} colour`} />
                <input type="range" min={0} max={1} step={0.01} value={stop.position} onChange={(event) => setStop(index, { position: Number(event.target.value) })} aria-label={`Gradient stop ${index + 1} position`} />
                <span>{Math.round(stop.position * 100)}%</span>
                {fill.gradient.stops.length > 2 && <button type="button" onClick={() => updateGradient({ stops: fill.gradient.stops.filter((_item, stopIndex) => stopIndex !== index) })} aria-label="Remove gradient stop"><X size={11} /></button>}
              </div>
            ))}
          </div>
          {fill.gradient.stops.length < 4 && <button type="button" className="cover-mini-button" onClick={() => updateGradient({ stops: [...fill.gradient.stops, { color: "#ffffff", position: 1 }] })}><Plus size={12} /> Add stop</button>}
        </div>
      )}
    </div>
  );
}

function LayerInspector({
  cover,
  layer,
  metrics,
  onUpdate,
  onUpdateCover,
  onReplaceImage,
  onUploadBarcode,
  onClearBarcode,
  focusContent,
}: {
  cover: BookCoverDesign;
  layer: CoverLayer;
  metrics: ReturnType<typeof coverMetrics>;
  onUpdate: (patch: Partial<CoverLayer>, options?: CommitOptions) => void;
  onUpdateCover: (patch: Partial<BookCoverDesign>, options?: CommitOptions) => void;
  onReplaceImage: () => void;
  onUploadBarcode: () => void;
  onClearBarcode: () => void;
  focusContent: number;
}) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusContent > 0) {
      const timer = window.setTimeout(() => {
        contentRef.current?.focus();
        contentRef.current?.select();
      }, 40);
      return () => window.clearTimeout(timer);
    }
  }, [focusContent]);

  const contentTokens = ["{{title}}", "{{subtitle}}", "{{tagline}}", "{{author}}", "{{authorBio}}", "{{description}}", "{{backCopy}}", "{{genre}}", "{{publisher}}", "{{isbn}}", "{{year}}"];
  const panelBounds = layer.panel === "wrap" ? { width: metrics.fullWidth, height: metrics.fullHeight } : layer.panel === "back" ? { width: metrics.panelWidths.back, height: metrics.trimHeight } : layer.panel === "spine" ? { width: metrics.panelWidths.spine, height: metrics.trimHeight } : { width: metrics.panelWidths.front, height: metrics.trimHeight };

  const align = (horizontal: "left" | "center" | "right", vertical: "top" | "middle" | "bottom") => {
    const x = horizontal === "left" ? 0 : horizontal === "center" ? (panelBounds.width - layer.width) / 2 : panelBounds.width - layer.width;
    const y = vertical === "top" ? 0 : vertical === "middle" ? (panelBounds.height - layer.height) / 2 : panelBounds.height - layer.height;
    onUpdate({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }, { key: `align:${layer.id}` });
  };

  return (
    <>
      <Section title="Layer" hint="Position, size, order">
        <div className="cover-transform-grid">
          <NumberField label="X" value={layer.x} onChange={(x) => onUpdate({ x }, { key: `x:${layer.id}` })} />
          <NumberField label="Y" value={layer.y} onChange={(y) => onUpdate({ y }, { key: `y:${layer.id}` })} />
          <NumberField label="W" value={layer.width} onChange={(width) => onUpdate({ width: Math.max(0.02, width) }, { key: `w:${layer.id}` })} min={0.02} />
          <NumberField label="H" value={layer.height} onChange={(height) => onUpdate({ height: Math.max(0.02, height) }, { key: `h:${layer.id}` })} min={0.02} />
          <NumberField label="Rotate" value={layer.rotation} onChange={(rotation) => onUpdate({ rotation }, { key: `rot:${layer.id}` })} step={1} suffix="°" />
          <label className="cover-select-field"><span>Panel</span><select value={layer.panel} onChange={(event) => onUpdate({ panel: event.target.value as CoverPanel }, { key: `panel:${layer.id}` })}><option value="front">Front</option><option value="spine">Spine</option><option value="back">Back</option><option value="wrap">Whole wrap</option></select></label>
        </div>
        <div className="cover-align-row">
          <span>Align</span>
          <button type="button" className="cover-mini-icon" title="Align left" onClick={() => align("left", "top")}><AlignLeft size={13} /></button>
          <button type="button" className="cover-mini-icon" title="Align centre" onClick={() => align("center", "top")}><AlignCenter size={13} /></button>
          <button type="button" className="cover-mini-icon" title="Align right" onClick={() => align("right", "top")}><AlignRight size={13} /></button>
          <button type="button" className="cover-mini-icon" title="Align top" onClick={() => align("left", "top")}><AlignStartVertical size={13} /></button>
          <button type="button" className="cover-mini-icon" title="Align middle" onClick={() => align("left", "middle")}><AlignCenter size={13} /></button>
          <button type="button" className="cover-mini-icon" title="Align bottom" onClick={() => align("left", "bottom")}><AlignEndVertical size={13} /></button>
        </div>
        <div className="cover-transform-actions">
          <button type="button" className="cover-mini-button" onClick={() => onUpdate({ rotation: layer.rotation - 90 }, { key: `rot:${layer.id}` })}><RotateCcw size={12} /> -90°</button>
          <button type="button" className="cover-mini-button" onClick={() => onUpdate({ rotation: layer.rotation + 90 }, { key: `rot:${layer.id}` })}><RotateCw size={12} /> +90°</button>
          <button type="button" className="cover-mini-button" onClick={() => onUpdate({ x: 0, y: 0, width: Math.round(panelBounds.width * 1000) / 1000, height: Math.round(panelBounds.height * 1000) / 1000 }, { key: `fill-panel:${layer.id}` })}><Maximize2 size={12} /> Fill</button>
          <button type="button" className={`cover-mini-button ${layer.locked ? "active" : ""}`} onClick={() => onUpdate({ locked: !layer.locked }, { key: `lock:${layer.id}` })}>{layer.locked ? <Lock size={12} /> : <Unlock size={12} />} {layer.locked ? "Locked" : "Lock"}</button>
          <button type="button" className={`cover-mini-button ${layer.visible ? "active" : ""}`} onClick={() => onUpdate({ visible: !layer.visible }, { key: `visible:${layer.id}` })}>{layer.visible ? <Eye size={12} /> : <EyeOff size={12} />} {layer.visible ? "Visible" : "Hidden"}</button>
        </div>
        <label className="cover-text-input"><span>Layer name</span><input value={layer.name} onChange={(event) => onUpdate({ name: event.target.value }, { key: `name:${layer.id}` })} /></label>
        <div className="cover-opacity-row">
          <SliderField label="Opacity" value={layer.opacity} onChange={(opacity) => onUpdate({ opacity }, { key: `opacity:${layer.id}` })} min={0} max={1} step={0.01} suffix="" />
          <label className="cover-select-field"><span>Blend</span><select value={layer.blendMode} onChange={(event) => onUpdate({ blendMode: event.target.value as CoverBlendMode }, { key: `blend:${layer.id}` })}><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="soft-light">Soft light</option><option value="darken">Darken</option><option value="lighten">Lighten</option></select></label>
        </div>
      </Section>

      {layer.type === "text" && (
        <Section title="Typography" hint="Type & effect">
          <label className="cover-text-input"><span>Content</span><textarea ref={contentRef} id="cover-text-content" value={layer.text} rows={4} onChange={(event) => onUpdate({ text: event.target.value }, { key: `text:${layer.id}` })} /></label>
          <div className="cover-token-row">{contentTokens.map((token) => <button key={token} type="button" onClick={() => onUpdate({ text: `${layer.text}${layer.text ? " " : ""}${token}` }, { key: `text:${layer.id}` })}>{token.replace(/[{}]/g, "")}</button>)}</div>
          <div className="cover-select-grid">
            <label className="cover-select-field full"><span>Typeface</span><select value={layer.fontFamily} onChange={(event) => onUpdate({ fontFamily: event.target.value as CoverTextLayer["fontFamily"] }, { key: `font:${layer.id}` })}>{["Display", "Serif", "Sans", "Mono", "Script"].map((group) => <optgroup key={group} label={group}>{COVER_FONTS.filter((font) => font.group === group).map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</optgroup>)}</select></label>
            <NumberField label="Size" value={layer.fontSize} onChange={(fontSize) => onUpdate({ fontSize: Math.max(4, fontSize) }, { key: `size:${layer.id}` })} step={1} min={4} max={240} suffix="pt" />
            <label className="cover-select-field"><span>Weight</span><select value={layer.fontWeight} onChange={(event) => onUpdate({ fontWeight: Number(event.target.value) }, { key: `weight:${layer.id}` })}>{[300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></label>
          </div>
          <div className="cover-text-format-row">
            <button type="button" className={layer.italic ? "active" : ""} onClick={() => onUpdate({ italic: !layer.italic }, { key: `italic:${layer.id}` })} title="Italic"><Italic size={13} /></button>
            <button type="button" className={layer.uppercase ? "active" : ""} onClick={() => onUpdate({ uppercase: !layer.uppercase }, { key: `case:${layer.id}` })} title="Uppercase"><CaseUpper size={13} /></button>
            <span className="cover-text-format-sep" />
            <button type="button" className={layer.align === "left" ? "active" : ""} onClick={() => onUpdate({ align: "left" as CoverTextAlign }, { key: `align:${layer.id}` })} title="Align left"><AlignLeft size={13} /></button>
            <button type="button" className={layer.align === "center" ? "active" : ""} onClick={() => onUpdate({ align: "center" as CoverTextAlign }, { key: `align:${layer.id}` })} title="Align center"><AlignCenter size={13} /></button>
            <button type="button" className={layer.align === "right" ? "active" : ""} onClick={() => onUpdate({ align: "right" as CoverTextAlign }, { key: `align:${layer.id}` })} title="Align right"><AlignRight size={13} /></button>
            <span className="cover-text-format-sep" />
            <button type="button" className={layer.verticalAlign === "top" ? "active" : ""} onClick={() => onUpdate({ verticalAlign: "top" as CoverVerticalAlign }, { key: `valign:${layer.id}` })} title="Top"><AlignStartVertical size={13} /></button>
            <button type="button" className={layer.verticalAlign === "middle" ? "active" : ""} onClick={() => onUpdate({ verticalAlign: "middle" as CoverVerticalAlign }, { key: `valign:${layer.id}` })} title="Middle"><AlignCenter size={13} /></button>
            <button type="button" className={layer.verticalAlign === "bottom" ? "active" : ""} onClick={() => onUpdate({ verticalAlign: "bottom" as CoverVerticalAlign }, { key: `valign:${layer.id}` })} title="Bottom"><AlignEndVertical size={13} /></button>
          </div>
          <ColorField label="Ink colour" value={layer.color} onChange={(color) => onUpdate({ color }, { key: `color:${layer.id}` })} />
          <div className="cover-transform-grid">
            <NumberField label="Leading" value={layer.lineHeight} onChange={(lineHeight) => onUpdate({ lineHeight }, { key: `leading:${layer.id}` })} step={0.01} min={0.7} max={3} suffix="×" />
            <NumberField label="Tracking" value={layer.letterSpacing} onChange={(letterSpacing) => onUpdate({ letterSpacing }, { key: `tracking:${layer.id}` })} step={0.005} min={-0.15} max={1} suffix="em" />
          </div>
          <div className="cover-select-grid">
            <label className="cover-select-field"><span>Effect</span><select value={layer.effect} onChange={(event) => onUpdate({ effect: event.target.value as CoverTextEffect }, { key: `effect:${layer.id}` })}><option value="none">None</option><option value="soft">Soft shadow</option><option value="hard">Hard shadow</option><option value="glow">Glow</option><option value="outline">Outline</option></select></label>
            {layer.effect !== "none" && <ColorField label="Effect colour" value={layer.effectColor} onChange={(effectColor) => onUpdate({ effectColor }, { key: `effect-color:${layer.id}` })} />}
          </div>
        </Section>
      )}

      {layer.type === "image" && (
        <Section title="Image lab" hint="Crop, tone & frame">
          <button type="button" className="cover-wide-button" onClick={onReplaceImage}><Upload size={13} /> Replace image</button>
          <div className="cover-image-preset-grid">
            {COVER_IMAGE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" title={preset.description} onClick={() => onUpdate(preset.patch, { key: `image-preset:${layer.id}:${preset.id}` })}>{preset.label}</button>
            ))}
          </div>
          <div className="cover-select-grid">
            <label className="cover-select-field"><span>Fit</span><select value={layer.fit} onChange={(event) => onUpdate({ fit: event.target.value === "contain" ? "contain" : "cover" }, { key: `fit:${layer.id}` })}><option value="cover">Fill frame</option><option value="contain">Fit inside</option></select></label>
            <label className="cover-select-field"><span>Mask</span><select value={layer.mask} onChange={(event) => onUpdate({ mask: event.target.value as CoverImageMask }, { key: `mask:${layer.id}` })}><option value="none">Rectangle</option><option value="circle">Circle</option><option value="arch">Arch</option><option value="diamond">Diamond</option><option value="hexagon">Hexagon</option></select></label>
            <NumberField label="Radius" value={layer.radius} onChange={(radius) => onUpdate({ radius: Math.max(0, radius) }, { key: `radius:${layer.id}` })} step={0.01} min={0} suffix="in" />
          </div>
          <div className="cover-image-sliders">
            <SliderField label="Brightness" value={layer.brightness} onChange={(brightness) => onUpdate({ brightness }, { key: `brightness:${layer.id}` })} min={20} max={180} step={1} suffix="%" />
            <SliderField label="Contrast" value={layer.contrast} onChange={(contrast) => onUpdate({ contrast }, { key: `contrast:${layer.id}` })} min={20} max={220} step={1} suffix="%" />
            <SliderField label="Saturation" value={layer.saturation} onChange={(saturation) => onUpdate({ saturation }, { key: `saturation:${layer.id}` })} min={0} max={220} step={1} suffix="%" />
            <SliderField label="Hue" value={layer.hue} onChange={(hue) => onUpdate({ hue }, { key: `hue:${layer.id}` })} min={-180} max={180} step={1} suffix="°" />
            <SliderField label="Blur" value={layer.blur} onChange={(blur) => onUpdate({ blur }, { key: `blur:${layer.id}` })} min={0} max={0.08} step={0.002} suffix="in" />
          </div>
          <div className="cover-toggle-grid">
            <label className="cover-toggle-row"><span>Grayscale</span><input type="checkbox" checked={layer.grayscale} onChange={(event) => onUpdate({ grayscale: event.target.checked }, { key: `gray:${layer.id}` })} /></label>
            <label className="cover-toggle-row"><span>Sepia</span><input type="checkbox" checked={layer.sepia} onChange={(event) => onUpdate({ sepia: event.target.checked }, { key: `sepia:${layer.id}` })} /></label>
          </div>
          <div className="cover-tint-editor">
            <ColorField label="Duotone tint" value={layer.tint} onChange={(tint) => onUpdate({ tint }, { key: `tint:${layer.id}` })} />
            <SliderField label="Tint strength" value={layer.tintStrength} onChange={(tintStrength) => onUpdate({ tintStrength }, { key: `tint-strength:${layer.id}` })} min={0} max={1} step={0.01} suffix="" />
          </div>
          <div className="cover-focus-block">
            <span className="cover-field-heading">Crop focus</span>
            <SliderField label="Horizontal" value={layer.focusX} onChange={(focusX) => onUpdate({ focusX }, { key: `focus-x:${layer.id}` })} min={0} max={1} step={0.01} suffix="" />
            <SliderField label="Vertical" value={layer.focusY} onChange={(focusY) => onUpdate({ focusY }, { key: `focus-y:${layer.id}` })} min={0} max={1} step={0.01} suffix="" />
            <div className="cover-image-flip-row">
              <button type="button" className={layer.flipX ? "active" : ""} onClick={() => onUpdate({ flipX: !layer.flipX }, { key: `flip-x:${layer.id}` })}><FlipHorizontal2 size={13} /> Flip H</button>
              <button type="button" className={layer.flipY ? "active" : ""} onClick={() => onUpdate({ flipY: !layer.flipY }, { key: `flip-y:${layer.id}` })}><FlipVertical2 size={13} /> Flip V</button>
              <button type="button" onClick={() => onUpdate({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, grayscale: false, sepia: false, tint: "#ffffff", tintStrength: 0, mask: "none", focusX: 0.5, focusY: 0.5, flipX: false, flipY: false }, { key: `image-reset:${layer.id}` })}><RotateCcw size={12} /> Reset</button>
            </div>
          </div>
        </Section>
      )}

      {layer.type === "shape" && (
        <Section title="Shape" hint="Fill, outline & form">
          <label className="cover-select-field"><span>Shape</span><select value={layer.shape} onChange={(event) => onUpdate({ shape: event.target.value as CoverShapeKind }, { key: `shape:${layer.id}` })}><option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="triangle">Triangle</option><option value="diamond">Diamond</option><option value="star">Star</option><option value="burst">Burst</option><option value="heart">Heart</option><option value="arch">Arch</option></select></label>
          <FillEditor label="Fill" fill={layer.fill} onChange={(fill) => onUpdate({ fill }, { key: `fill:${layer.id}` })} />
          <div className="cover-transform-grid">
            {layer.shape === "rectangle" && <NumberField label="Corner" value={layer.radius} onChange={(radius) => onUpdate({ radius: Math.max(0, radius) }, { key: `radius:${layer.id}` })} step={0.01} min={0} suffix="in" />}
            <NumberField label="Stroke" value={layer.strokeWidth} onChange={(strokeWidth) => onUpdate({ strokeWidth: Math.max(0, strokeWidth) }, { key: `stroke:${layer.id}` })} step={0.005} min={0} suffix="in" />
          </div>
          {layer.strokeWidth > 0 && (
            <>
              <ColorField label="Stroke colour" value={layer.strokeColor} onChange={(strokeColor) => onUpdate({ strokeColor }, { key: `stroke-color:${layer.id}` })} />
              <label className="cover-select-field"><span>Stroke style</span><select value={layer.dash} onChange={(event) => onUpdate({ dash: event.target.value as CoverShapeLayer["dash"] }, { key: `dash:${layer.id}` })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
            </>
          )}
        </Section>
      )}

      {layer.type === "line" && (
        <Section title="Rule" hint="Colour & style">
          <ColorField label="Colour" value={layer.color} onChange={(color) => onUpdate({ color }, { key: `line-color:${layer.id}` })} />
          <label className="cover-select-field"><span>Style</span><select value={layer.dash} onChange={(event) => onUpdate({ dash: event.target.value as CoverLineLayer["dash"] }, { key: `line-dash:${layer.id}` })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
        </Section>
      )}

      {layer.type === "symbol" && (
        <Section title="Ornament" hint="Glyph & colour">
          <ColorField label="Colour" value={layer.color} onChange={(color) => onUpdate({ color }, { key: `symbol-color:${layer.id}` })} />
          <div className="cover-symbol-grid inspector-symbols">{COVER_SYMBOLS.map((glyph) => <button key={glyph} type="button" className={layer.glyph === glyph ? "active" : ""} onClick={() => onUpdate({ glyph }, { key: `glyph:${layer.id}` })}>{glyph}</button>)}</div>
        </Section>
      )}

      {layer.type === "artwork" && (
        <Section title="Artwork" hint="Library & colour">
          <label className="cover-select-field full"><span>Graphic</span><select value={layer.graphicId} onChange={(event) => onUpdate({ graphicId: event.target.value }, { key: `graphic:${layer.id}` })}>{BOOK_GRAPHIC_CATEGORIES.map((category) => <optgroup key={category} label={category}>{BOOK_GRAPHICS.filter((graphic) => graphic.category === category).map((graphic) => <option key={graphic.id} value={graphic.id}>{graphic.label}</option>)}</optgroup>)}</select></label>
          <ColorField label="Ink colour" value={layer.color} onChange={(color) => onUpdate({ color }, { key: `artwork-color:${layer.id}` })} />
          <div className="cover-artwork-inspector-preview"><img src={coverArtworkDataUrl(layer)} alt="" /></div>
        </Section>
      )}

      {layer.type === "barcode" && (
        <BarcodeControls cover={cover} layer={layer} onUpdateCover={onUpdateCover} updateLayer={(patch) => onUpdate(patch, { key: `barcode:${layer.id}` })} onUploadBarcode={onUploadBarcode} onClearBarcode={onClearBarcode} />
      )}
    </>
  );
}

function BarcodeControls({
  cover,
  layer,
  onUpdateCover,
  updateLayer,
  onUploadBarcode,
  onClearBarcode,
}: {
  cover: BookCoverDesign;
  layer: CoverBarcodeLayer;
  onUpdateCover: (patch: Partial<BookCoverDesign>, options?: CommitOptions) => void;
  updateLayer: (patch: Partial<CoverBarcodeLayer>) => void;
  onUploadBarcode: () => void;
  onClearBarcode: () => void;
}) {
  const digits = isbnDigits(cover.isbn);
  const valid = isbnIsValid(cover.isbn);
  const normalized = normalizeIsbn13(cover.isbn);
  return (
    <Section title="ISBN barcode" hint="Scan-safe & movable">
      <label className="cover-text-input"><span>ISBN number</span><input value={cover.isbn} onChange={(event) => onUpdateCover({ isbn: event.target.value }, { key: "isbn" })} placeholder="978-1-234-56789-0" spellCheck={false} /></label>
      <p className="cover-inspector-note">{valid ? <>EAN-13 pattern ready · check digit {normalized.slice(-1)}</> : digits.length === 0 ? "Add your ISBN for a generated, scannable EAN-13 barcode. You can also upload a barcode image." : "Use 10, 12, or 13 digits. The check digit is calculated for you."}</p>
      <div className="cover-inspector-row">
        <button type="button" className="cover-wide-button" onClick={onUploadBarcode}><Upload size={13} /> Upload barcode image</button>
        {cover.barcodeImage && <button type="button" className="cover-mini-button danger" onClick={onClearBarcode}><Trash2 size={12} /> Remove</button>}
      </div>
      <div className="cover-toggle-grid">
        <label className="cover-toggle-row"><span>Show ISBN digits</span><input type="checkbox" checked={layer.showText} onChange={(event) => updateLayer({ showText: event.target.checked })} /></label>
      </div>
      <div className="cover-transform-grid">
        <ColorField label="Bars" value={layer.barColor} onChange={(barColor) => updateLayer({ barColor })} />
        <ColorField label="Swatch" value={layer.background} onChange={(background) => updateLayer({ background })} />
      </div>
      <div className="cover-barcode-preview"><span>{cover.isbn || "ISBN"}</span><span dangerouslySetInnerHTML={{ __html: barcodeSvgMarkup(cover.isbn, layer.barColor) }} /></div>
    </Section>
  );
}

function DocumentInspector({
  book,
  cover,
  metrics,
  pageEstimate,
  onUpdateCover,
  onUpdateDoc,
  onApplyTemplate,
  onEstimatePages,
  onPageCount,
  onPaperStock,
  onSpineOverride,
  onBleed,
  onTrimSize,
  onOpenSettings,
  onUploadBarcode,
  onClearBarcode,
}: {
  book: Book;
  cover: BookCoverDesign;
  metrics: ReturnType<typeof coverMetrics>;
  pageEstimate: number;
  onUpdateCover: (patch: Partial<BookCoverDesign>, options?: CommitOptions) => void;
  onUpdateDoc: (doc: BookCoverDocument, options?: CommitOptions) => void;
  onApplyTemplate: () => void;
  onEstimatePages: () => void;
  onPageCount: (value: number) => void;
  onPaperStock: (value: string) => void;
  onSpineOverride: (value: number) => void;
  onBleed: (value: number) => void;
  onTrimSize: (value: string) => void;
  onOpenSettings: () => void;
  onUploadBarcode: () => void;
  onClearBarcode: () => void;
}) {
  const doc = cover.doc;
  const isbn = normalizeIsbn13(cover.isbn);
  const validIsbn = isbnIsValid(cover.isbn);
  return (
    <>
      <div className="cover-document-pills">
        <span className="cover-pill accent"><Palette size={12} /> {doc.templateId ? COVER_TEMPLATE_PRESETS.find((template) => template.id === doc.templateId)?.label ?? "Custom design" : "Custom design"}</span>
        <button type="button" className="cover-pill" onClick={onApplyTemplate}><LayoutTemplate size={12} /> Change template</button>
      </div>
      <Section title="Background" hint="Paper, colour or gradient">
        <FillEditor label="Cover finish" fill={doc.background} onChange={(background) => onUpdateDoc({ ...doc, background }, { key: "background" })} />
        <div className="cover-swatch-row">
          {["#f6efe3", "#fffdf8", "#1f3a2d", "#14161a", "#e4583a", "#315f73", "#d4b26b", "#e8d9c7"].map((color) => <button key={color} type="button" style={{ background: color }} onClick={() => onUpdateDoc({ ...doc, background: coverFill(color) }, { key: "background-swatch" })} aria-label={`Set background ${color}`} />)}
        </div>
      </Section>

      <Section title="Print setup" hint="Trim, spine & bleed">
        <label className="cover-select-field full"><span>Trim size</span><select value={book.trim_size} onChange={(event) => onTrimSize(event.target.value)}>{TRIM_SIZES.map((size) => <option key={size.value} value={size.value}>{size.label} — {size.description}</option>)}</select></label>
        <div className="cover-spine-readout">
          <div><span>Spine width</span><strong>{formatDimension(metrics.spineWidth)} in</strong><small>{spineWidthMillimetres(metrics.spineWidth)} mm</small></div>
          <div><span>Full wrap</span><strong>{formatDimension(metrics.fullWidth)} × {formatDimension(metrics.fullHeight)} in</strong><small>with {cover.bleed} in bleed</small></div>
        </div>
        <div className="cover-page-estimate">
          <div><span>Page count</span><strong>{cover.pageCount.toLocaleString()} pages</strong><small>{cover.spineWidthOverride > 0 ? "Custom spine override" : `${COVER_PAPER_STOCKS.find((stock) => stock.id === cover.paperStock)?.label ?? "Paper"} · ${spineWidthMillimetres(metrics.spineWidth)} mm`}</small></div>
          {pageEstimate > 0 && <button type="button" className="cover-mini-button" onClick={onEstimatePages}><Sparkles size={12} /> Use {pageEstimate.toLocaleString()} from manuscript</button>}
        </div>
        <div className="cover-transform-grid">
          <NumberField label="Pages" value={cover.pageCount} onChange={(pageCount) => onPageCount(Math.min(8000, Math.max(1, Math.round(pageCount))))} step={1} min={1} max={8000} suffix="" />
          <label className="cover-select-field"><span>Paper stock</span><select value={cover.paperStock} onChange={(event) => onPaperStock(event.target.value)}>{COVER_PAPER_STOCKS.map((stock) => <option key={stock.id} value={stock.id}>{stock.label}</option>)}</select></label>
          <NumberField label="Spine" value={cover.spineWidthOverride > 0 ? cover.spineWidthOverride : metrics.spineWidth} onChange={onSpineOverride} step={0.01} min={0} suffix="in" />
          <NumberField label="Bleed" value={cover.bleed} onChange={onBleed} step={0.005} min={0} max={0.5} suffix="in" />
        </div>
        <p className="cover-inspector-note">Spine width is calculated as <strong>pages × paper thickness</strong>. Change the page count when your final pagination changes, or type a custom spine width to override it.</p>
      </Section>

      <Section title="ISBN & barcode" hint="Back cover commerce block">
        <label className="cover-text-input"><span>ISBN</span><input value={cover.isbn} onChange={(event) => onUpdateCover({ isbn: event.target.value }, { key: "isbn" })} placeholder="978-1-234-56789-0" spellCheck={false} /></label>
        <p className={`cover-inspector-note ${validIsbn ? "success" : ""}`}>{validIsbn ? <>Generated EAN-13: <strong>{isbn}</strong>. The barcode is a free layer — drag it anywhere on the back cover.</> : "Paste an ISBN-10 or ISBN-13. We generate a scannable EAN-13 barcode and keep the ISBN digits on the block."}</p>
        <div className="cover-inspector-row">
          <button type="button" className="cover-wide-button" onClick={onUploadBarcode}><Upload size={13} /> Upload barcode image</button>
          {cover.barcodeImage && <button type="button" className="cover-mini-button danger" onClick={onClearBarcode}><Trash2 size={12} /> Clear</button>}
        </div>
        {cover.barcodeImage && <p className="cover-inspector-note success">A custom barcode image replaces the generated EAN-13 in every barcode layer.</p>}
        <label className="cover-text-input"><span>Publisher / imprint</span><input value={cover.publisher} onChange={(event) => onUpdateCover({ publisher: event.target.value }, { key: "publisher" })} placeholder="Your imprint" /></label>
      </Section>

      <Section title="Back cover copy" hint="Blurb & author">
        <label className="cover-text-input"><span>Description override</span><textarea value={cover.backCopy} rows={5} onChange={(event) => onUpdateCover({ backCopy: event.target.value }, { key: "back-copy" })} placeholder={book.description || "Write the back cover blurb. Leave blank to inherit the book description."} /></label>
        <label className="cover-text-input"><span>Author bio</span><textarea value={cover.authorBio} rows={3} onChange={(event) => onUpdateCover({ authorBio: event.target.value }, { key: "author-bio" })} placeholder="A short author biography for the back cover." /></label>
        <button type="button" className="cover-wide-button subtle" onClick={onOpenSettings}><Settings2 size={13} /> Book metadata & settings</button>
      </Section>

      <Section title="Export" hint="Print & digital">
        <label className="cover-toggle-row"><span><strong>Include cover in print &amp; export</strong><small>Adds the full wrap to print, and the front panel to digital exports.</small></span><input type="checkbox" checked={cover.enabled} onChange={(event) => onUpdateCover({ enabled: event.target.checked }, { key: "enabled" })} /></label>
        <div className="cover-toggle-grid">
          <label className="cover-toggle-row"><span>Guides</span><input type="checkbox" checked={doc.showGuides} onChange={(event) => onUpdateDoc({ ...doc, showGuides: event.target.checked }, { key: "guides" })} /></label>
          <label className="cover-toggle-row"><span>Rulers</span><input type="checkbox" checked={doc.showRulers} onChange={(event) => onUpdateDoc({ ...doc, showRulers: event.target.checked }, { key: "rulers" })} /></label>
          <label className="cover-toggle-row"><span>Grid</span><input type="checkbox" checked={doc.showGrid} onChange={(event) => onUpdateDoc({ ...doc, showGrid: event.target.checked }, { key: "grid" })} /></label>
          <label className="cover-toggle-row"><span>Bleed overlay</span><input type="checkbox" checked={doc.showBleed} onChange={(event) => onUpdateDoc({ ...doc, showBleed: event.target.checked }, { key: "bleed-overlay" })} /></label>
        </div>
        <p className="cover-inspector-note">The full wrap uses {formatDimension(metrics.fullWidth)} × {formatDimension(metrics.fullHeight)} in with {cover.bleed} in bleed. Front, back, and spine download separately at trim size.</p>
      </Section>
    </>
  );
}

/* ========================================================================== */

function TemplateModal({ book, cover, onApply, onClose }: TemplateModalProps) {
  const imageLayerSource = cover.doc.layers.find((layer): layer is CoverImageLayer => layer.type === "image" && Boolean(layer.src));
  const previewCover = { ...cover, image: cover.image || imageLayerSource?.src || "" };
  const templates = useMemo(() => COVER_TEMPLATE_PRESETS.map((preset, index) => {
    const doc = createCoverDocument(preset.id, book, previewCover);
    const metrics = coverMetrics(book.trim_size, previewCover);
    return { preset, doc, metrics, index };
  }), [book, previewCover, cover.pageCount, cover.paperStock, cover.spineWidthOverride, cover.bleed]);
  return (
    <div className="cover-modal-overlay" role="dialog" aria-modal="true" aria-label="Cover templates" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="cover-template-modal">
        <div className="cover-template-modal-head">
          <div><span className="books-eyebrow"><LayoutTemplate size={13} /> Cover templates</span><h2>Start from a complete wrap.</h2><p>Each template includes a designed front, spine, back, blurb zone, and a movable ISBN barcode. Metadata, trim size, and page count stay yours.</p></div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="cover-template-grid">
          {templates.map(({ preset, doc, metrics }) => {
            const scale = 240 / (metrics.fullWidth * 96);
            return (
              <article className="cover-template-card" key={preset.id}>
                <div className="cover-template-preview" style={{ height: metrics.fullHeight * 96 * scale }}>
                  <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: metrics.fullWidth * 96, height: metrics.fullHeight * 96 }} dangerouslySetInnerHTML={{ __html: coverDocMarkup(book, { ...previewCover, doc }, "wrap", { instanceId: `template-${preset.id}` }) }} />
                </div>
                <div className="cover-template-card-body">
                  <div className="cover-template-card-title"><span style={{ background: preset.palette[0] }} /><span style={{ background: preset.palette[2] }} /><strong>{preset.label}</strong><em>{preset.mood}</em></div>
                  <p>{preset.description}</p>
                  <button type="button" className="cover-primary-button small" onClick={() => onApply(preset.id)}><Check size={13} /> Use template</button>
                </div>
              </article>
            );
          })}
          <article className="cover-template-card blank">
            <div className="cover-template-preview blank-canvas" style={{ height: 174 }}>
              <span><Plus size={20} /></span>
              <strong>Blank wrap</strong>
              <small>{formatDimension(metricsPreviewWidth(book, cover))} × {formatDimension(metricsPreviewHeight(book, cover))} in</small>
            </div>
            <div className="cover-template-card-body">
              <div className="cover-template-card-title"><strong>Blank canvas</strong><em>Custom</em></div>
              <p>Start with a clean paper surface and build every layer yourself.</p>
              <button type="button" className="cover-outline-button" onClick={() => onApply("blank")}><Plus size={13} /> Start blank</button>
            </div>
          </article>
        </div>
        <div className="cover-template-modal-foot"><span>Tip: all templates use <strong>{`{{title}}`}</strong>, <strong>{`{{author}}`}</strong> and <strong>{`{{backCopy}}`}</strong> tokens so copy stays connected to the manuscript.</span><button type="button" className="cover-outline-button" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

function metricsPreviewWidth(book: Book, cover: BookCoverDesign) {
  return coverMetrics(book.trim_size, cover).fullWidth;
}

function metricsPreviewHeight(book: Book, cover: BookCoverDesign) {
  return coverMetrics(book.trim_size, cover).fullHeight;
}
