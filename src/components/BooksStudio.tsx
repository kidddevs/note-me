import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Download,
  LayoutList,
  Library,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Book, Chapter, ChapterKind } from "../lib/types";
import { layoutForBook } from "../lib/bookLayout";
import {
  buildBookToc,
  orderBookChapters,
} from "../lib/bookToc";
import {
  EXPORT_OPTIONS,
  bookChromeValues,
  bookDocx,
  bookEpub,
  bookHtml,
  bookMarkdown,
  bookText,
  chapterKindLabel,
  defaultChapterTitle,
  filenameFor,
  formatUpdated,
  fontCss,
} from "../lib/bookPublishing";
export * from "../lib/bookPublishing";
import type { PageBand } from "../lib/bookPublishing";
import { useBooks } from "../store/books";
import { useWorkspace } from "../store/workspace";
import { notify } from "../store/toast";
import { ManuscriptScreen } from "./BooksStudioEditor";
import { OutlineScreen, SectionsRail } from "./BooksStudioOutline";
import { ExportScreen, PrintBook } from "./BooksStudioExport";
import { SettingsScreen } from "./BooksStudioSettings";

export type StudioScreen = "library" | "manuscript" | "outline" | "settings" | "export";
export type EditorView = "write" | "preview";
export type ExportFormat = "markdown" | "html" | "epub" | "docx" | "txt";
export type MatterFocus = "front" | "back";

interface ConfirmationRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

export function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = useCallback(() => {
    if (busy) return;
    setRequest(null);
    setError("");
    requestAnimationFrame(() => restoreFocusRef.current?.focus());
  }, [busy]);

  const ask = useCallback((next: ConfirmationRequest, restoreFocus?: HTMLElement | null) => {
    restoreFocusRef.current = restoreFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setError("");
    setRequest(next);
  }, []);

  useEffect(() => {
    if (request) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [request]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const accept = async () => {
    if (!request || busy) return;
    setBusy(true);
    setError("");
    try {
      await request.onConfirm();
      setRequest(null);
      requestAnimationFrame(() => restoreFocusRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const dialog = request ? (
    <div className="modal-overlay books-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className="books-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} onKeyDown={onKeyDown}>
        <div className="books-confirm-mark" aria-hidden="true"><Trash2 size={18} /></div>
        <div className="books-confirm-copy">
          <span className="books-eyebrow">Please confirm</span>
          <h2 id={titleId}>{request.title}</h2>
          <p id={descriptionId}>{request.description}</p>
          {error && <p className="books-confirm-error" role="alert">{error}</p>}
        </div>
        <div className="books-confirm-actions">
          <button ref={cancelRef} className="books-confirm-cancel" onClick={close} disabled={busy}>Keep it</button>
          <button className="books-confirm-delete" onClick={() => void accept()} disabled={busy}>{busy ? "Deleting…" : request.confirmLabel}</button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}

export function handleTabListKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']:not([disabled])"));
  if (!tabs.length) return;
  const current = Math.max(0, tabs.findIndex((tab) => tab === document.activeElement));
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}

export function handleMenuKeyDown(event: React.KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not([disabled])"));
  if (!items.length) return;
  const current = Math.max(0, items.findIndex((item) => item === document.activeElement));
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  event.preventDefault();
  items[next].focus();
}

export async function exportBook(book: Book, chapters: Chapter[], format: ExportFormat) {
  const [{ save }, { writeFile, writeTextFile }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const option = EXPORT_OPTIONS.find((item) => item.value === format)!;
  const path = await save({
    defaultPath: filenameFor(book, option.extension),
    filters: [{ name: option.label, extensions: [option.extension.slice(1)] }],
  });
  if (!path) return;
  if (format === "markdown") await writeTextFile(path, bookMarkdown(book, chapters));
  if (format === "html") await writeTextFile(path, bookHtml(book, chapters));
  if (format === "txt") await writeTextFile(path, bookText(book, chapters));
  if (format === "epub") await writeFile(path, await bookEpub(book, chapters));
  if (format === "docx") await writeFile(path, await bookDocx(book, chapters));
  notify("success", "Book exported", path);
}

export function manuscriptStyle(book: Book): CSSProperties {
  const typography = layoutForBook(book).typography;
  const typographyVars = Object.fromEntries(Object.entries(typography).flatMap(([role, style]) => [
    [`--book-${role}-font`, fontCss(style.fontFamily)],
    [`--book-${role}-size`, `${style.fontSize}pt`],
    [`--book-${role}-weight`, style.fontWeight],
    [`--book-${role}-style`, style.fontStyle],
    [`--book-${role}-align`, style.textAlign],
    [`--book-${role}-line-height`, style.lineHeight],
    [`--book-${role}-letter-spacing`, `${style.letterSpacing}em`],
    [`--book-${role}-first-line-indent`, `${style.firstLineIndent}em`],
    [`--book-${role}-left-indent`, `${style.leftIndent}em`],
    [`--book-${role}-right-indent`, `${style.rightIndent}em`],
    [`--book-${role}-space-before`, `${style.spaceBefore}em`],
    [`--book-${role}-space-after`, `${style.spaceAfter}em`],
    [`--book-${role}-drop-cap-lines`, style.dropCapLines],
    [`--book-${role}-drop-cap-size`, `${style.fontSize * style.dropCapLines * 0.82}pt`],
    [`--book-${role}-drop-cap-gap`, `${style.dropCapGap}em`],
    [`--book-${role}-drop-cap-font`, fontCss(style.dropCapFontFamily)],
    [`--book-${role}-drop-cap-color`, style.dropCapColor],
    [`--book-${role}-nested-words`, style.nestedWords],
    [`--book-${role}-nested-font`, fontCss(style.nestedFontFamily)],
    [`--book-${role}-nested-color`, style.nestedColor],
  ]));
  return {
    "--book-accent": book.cover_color || "#a56b3e",
    "--book-font": fontCss(book.font_family),
    "--book-font-size": `${book.font_size}pt`,
    "--book-line-height": book.line_height,
    "--book-paragraph-spacing": `${book.paragraph_spacing}em`,
    "--book-margin": `${book.margin}in`,
    ...typographyVars,
  } as CSSProperties;
}

export function BooksPageChrome({ book, keyName, section, band, ordinal }: { book: Book; keyName: string; section: string; band: PageBand; ordinal: number }) {
  const values = bookChromeValues(book, layoutForBook(book), keyName, section, band, ordinal);
  if (!values.header.some(Boolean) && !values.footer.some(Boolean)) return null;
  const row = (name: string, slots: string[]) => slots.some(Boolean) ? <div className={`books-page-chrome-row ${name}`}>{slots.map((slot, index) => <span key={`${name}-${index}`}>{slot}</span>)}</div> : null;
  return <div className="books-page-chrome">{row("header", values.header)}{row("footer", values.footer)}</div>;
}

function ScreenNav({ screen, hasBook, onChange }: { screen: StudioScreen; hasBook: boolean; onChange: (screen: StudioScreen) => void }) {
  const modifier = navigator.userAgent.includes("Macintosh") || navigator.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl+";
  const items: { id: StudioScreen; label: string; icon: typeof Library; shortcut: string }[] = [
    { id: "library", label: "Library", icon: Library, shortcut: `${modifier}1` },
    { id: "manuscript", label: "Manuscript", icon: NotebookPen, shortcut: `${modifier}2` },
    { id: "outline", label: "Outline", icon: LayoutList, shortcut: `${modifier}3` },
    { id: "settings", label: "Book settings", icon: Settings2, shortcut: `${modifier}4` },
    { id: "export", label: "Export studio", icon: Download, shortcut: `${modifier}5` },
  ];
  return (
    <nav className="books-nav" aria-label="Books Studio">
      <span className="books-nav-label">Workspace</span>
      {items.map(({ id, label, icon: Icon, shortcut }) => {
        const disabled = id !== "library" && !hasBook;
        return (
          <button key={id} className={`books-nav-item ${screen === id ? "active" : ""}`} onClick={() => onChange(id)} title={disabled ? `Choose a manuscript to open ${label.toLocaleLowerCase()}` : `${label} (${shortcut})`} disabled={disabled} aria-current={screen === id ? "page" : undefined}>
            <Icon size={15} /> <span>{label}</span>
            <kbd>{shortcut}</kbd>
            {screen === id && <ChevronRight size={13} className="books-nav-chevron" />}
          </button>
        );
      })}
    </nav>
  );
}

function BooksCommandPalette({ open, bookTitle, chapters, onClose, onNavigate, onNewChapter, onOpenChapter }: { open: boolean; bookTitle?: string; chapters: Chapter[]; onClose: () => void; onNavigate: (screen: StudioScreen) => void; onNewChapter: (kind?: ChapterKind) => void; onOpenChapter: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      requestAnimationFrame(() => {
        if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
      });
    };
  }, [open]);

  const items = useMemo(() => {
    const commands = [
      { id: "library", label: "Open library", sub: "⌘1", icon: <Library size={15} />, action: () => onNavigate("library") },
      ...(bookTitle ? [
        { id: "manuscript", label: "Open manuscript", sub: "⌘2", icon: <NotebookPen size={15} />, action: () => onNavigate("manuscript") },
        { id: "outline", label: "Open outline", sub: "⌘3", icon: <LayoutList size={15} />, action: () => onNavigate("outline") },
        { id: "settings", label: "Open book settings", sub: "⌘4", icon: <Settings2 size={15} />, action: () => onNavigate("settings") },
        { id: "export", label: "Open export studio", sub: "⌘5", icon: <Download size={15} />, action: () => onNavigate("export") },
        { id: "new-chapter", label: "Add chapter", sub: "New section", icon: <Plus size={15} />, action: () => onNewChapter("chapter") },
      ] : []),
      ...chapters.map((chapter) => ({
        id: `section-${chapter.id}`,
        label: chapter.title || "Untitled section",
        sub: chapterKindLabel(chapter.chapter_kind),
        icon: <BookOpen size={15} />,
        action: () => onOpenChapter(chapter.id),
      })),
    ];
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = normalized
      ? commands.filter((command) => `${command.label} ${command.sub}`.toLocaleLowerCase().includes(normalized))
      : commands;
    return filtered.length ? filtered : [{ id: "none", label: "No matching commands", sub: "Try a section title or action", icon: <Search size={15} />, action: () => {} }];
  }, [bookTitle, chapters, onNavigate, onNewChapter, onOpenChapter, query]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
    listRef.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index, items.length]);

  if (!open) return null;

  const run = (item: (typeof items)[number]) => {
    if (item.id === "none") return;
    item.action();
    onClose();
  };

  return (
    <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ alignItems: "flex-start", paddingTop: "10vh" }}>
      <div className="palette books-command-palette" role="dialog" aria-modal="true" aria-label="Books Studio command palette">
        <div className="palette-input">
          <Search size={16} color="var(--book-accent)" />
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setIndex(0); }} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowDown") { event.preventDefault(); setIndex((value) => Math.min(value + 1, items.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setIndex((value) => Math.max(value - 1, 0)); } if (event.key === "Enter" && items[index]) { event.preventDefault(); run(items[index]); } }} placeholder="Search sections or commands…" aria-label="Search sections or commands" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={`books-command-${items[index]?.id ?? "none"}`} />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} id={listId} role="listbox" aria-label="Books Studio commands">
          {items.map((item, itemIndex) => <button key={item.id} id={`books-command-${item.id}`} role="option" aria-selected={itemIndex === index} aria-disabled={item.id === "none"} disabled={item.id === "none"} className={`palette-item ${itemIndex === index ? "active" : ""}`} onMouseEnter={() => setIndex(itemIndex)} onClick={() => run(item)}><span className="books-command-icon">{item.icon}</span><span className="palette-label">{item.label}</span>{item.sub && <span className="palette-sub">{item.sub}</span>}</button>)}
        </div>
      </div>
    </div>
  );
}

function LibraryScreen({ books, creating, deletingBookId, onNew, onOpen, onDelete }: { books: Book[]; creating: boolean; deletingBookId: number | null; onNew: () => void; onOpen: (id: number) => void; onDelete: (book: Book) => void }) {
  const [menuBookId, setMenuBookId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = (restoreFocus = false) => {
    const closingBookId = menuBookId;
    setMenuBookId(null);
    if (restoreFocus && closingBookId !== null) {
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-book-menu-trigger='${closingBookId}']`)?.focus());
    }
  };

  useEffect(() => {
    if (menuBookId !== null) requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not([disabled])")?.focus());
  }, [menuBookId]);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".book-library-card")) setMenuBookId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && menuBookId !== null) closeMenu(true); };
    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuBookId]);

  return (
    <div className="books-screen books-library-screen">
      <div className="books-hero">
        <div>
          <span className="books-eyebrow"><Sparkles size={13} /> Long-form workspace</span>
          <h1>A room for the<br /><em>long sentence.</em></h1>
          <p>Shape an idea into a manuscript, one considered page at a time.</p>
        </div>
        <button className="books-primary-action" onClick={onNew} disabled={creating}><Plus size={16} /> {creating ? "Creating…" : "New manuscript"}</button>
      </div>
      <div className="books-section-heading">
        <div><span className="books-eyebrow">Your shelf</span><h2>Manuscripts</h2></div>
        <span className="books-count">{books.length} {books.length === 1 ? "book" : "books"}</span>
      </div>
      {books.length === 0 ? (
        <button className="books-empty-card" onClick={onNew}>
          <div className="books-empty-icon"><BookOpen size={24} /></div>
          <strong>Start your first manuscript</strong>
          <span>Set the voice, build the outline, and write without distraction.</span>
          <span className="books-empty-link">Create a book <ChevronRight size={13} /></span>
        </button>
      ) : (
        <div className="books-library-grid">
          {books.map((book) => (
            <article key={book.id} className="book-library-card">
              <button className="book-library-card-main" onClick={() => { setMenuBookId(null); onOpen(book.id); }}>
                <div className="book-card-topline">{book.status.replace("revising", "in revision")}</div>
                <div className="book-card-cover" style={{ background: book.cover_color || undefined }}><BookOpen size={25} /><span>{book.genre || "MANUSCRIPT"}</span></div>
                <h3>{book.title || "Untitled manuscript"}</h3>
                <p>{book.author || "Author not set"}</p>
              </button>
              <div className="book-card-footer">
                <span>Edited {formatUpdated(book.updated_at)}</span>
                <button data-book-menu-trigger={book.id} onClick={() => setMenuBookId((current) => current === book.id ? null : book.id)} aria-label={`Actions for ${book.title || "untitled manuscript"}`} aria-expanded={menuBookId === book.id} aria-haspopup="menu"><MoreHorizontal size={15} /></button>
              </div>
              {menuBookId === book.id && <div ref={menuRef} className="book-library-menu" role="menu" aria-label={`Actions for ${book.title || "untitled manuscript"}`} onKeyDown={(event) => handleMenuKeyDown(event, () => closeMenu(true))}>
                <button role="menuitem" onClick={() => { setMenuBookId(null); onOpen(book.id); }}><BookOpen size={13} /> Open manuscript</button>
                <button role="menuitem" className="danger" disabled={deletingBookId === book.id} onClick={() => { setMenuBookId(null); onDelete(book); }}><Trash2 size={13} /> {deletingBookId === book.id ? "Deleting…" : "Delete manuscript"}</button>
              </div>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function BooksStudio() {
  const books = useBooks((state) => state.books);
  const chapters = useBooks((state) => state.chapters);
  const selectedBookId = useBooks((state) => state.selectedBookId);
  const activeChapterId = useBooks((state) => state.activeChapterId);
  const loaded = useBooks((state) => state.loaded);
  const loadError = useBooks((state) => state.error);
  const init = useBooks((state) => state.init);
  const createBook = useBooks((state) => state.createBook);
  const deleteBook = useBooks((state) => state.deleteBook);
  const createChapter = useBooks((state) => state.createChapter);
  const selectBook = useBooks((state) => state.selectBook);
  const selectChapter = useBooks((state) => state.selectChapter);
  const sidebarCollapsed = useWorkspace((state) => state.booksSidebarCollapsed);
  const [screen, setScreen] = useState<StudioScreen>("library");
  const [settingsFocus, setSettingsFocus] = useState<MatterFocus | undefined>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [creatingBook, setCreatingBook] = useState(false);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [editorFocusMode, setEditorFocusMode] = useState(false);
  const confirmation = useConfirmationDialog();
  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) ?? null, [books, selectedBookId]);
  const orderedChapters = useMemo(() => orderBookChapters(chapters), [chapters]);
  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId) ?? null;
  const selectedToc = useMemo(() => selectedBook ? buildBookToc(selectedBook, chapters) : [], [selectedBook, chapters]);

  useEffect(() => { void init(); }, [init]);

  const newBook = async () => {
    if (creatingBook) return;
    setCreatingBook(true);
    try {
      const book = await createBook({ title: "Untitled manuscript" });
      await createChapter(book.id, "Chapter 1", "chapter");
      setScreen("manuscript");
    } catch (error) {
      notify("error", "Manuscript could not be created", String(error));
    } finally {
      setCreatingBook(false);
    }
  };
  const removeBook = (book: Book) => {
    const menuTrigger = document.querySelector<HTMLElement>(`[data-book-menu-trigger='${book.id}']`);
    confirmation.ask({
      title: `Delete “${book.title || "Untitled manuscript"}”?`,
      description: "Every section and all manuscript settings in this book will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete manuscript",
      onConfirm: async () => {
        setDeletingBookId(book.id);
        try {
          await deleteBook(book.id);
          setEditorFocusMode(false);
          setScreen("library");
          notify("success", "Manuscript deleted", book.title || "Untitled manuscript");
        } finally {
          setDeletingBookId(null);
        }
      },
    }, menuTrigger);
  };
  const openBook = async (id: number) => {
    try {
      await selectBook(id);
      setScreen("manuscript");
    } catch (error) {
      notify("error", "Manuscript could not be opened", String(error));
    }
  };
  const newChapter = async (kind: ChapterKind = "chapter") => {
    if (selectedBookId !== null) {
      try {
        const chapterNumber = chapters.filter((chapter) => chapter.chapter_kind === "chapter").length + 1;
        await createChapter(selectedBookId, defaultChapterTitle(kind, chapterNumber), kind);
        setScreen("manuscript");
      } catch (error) {
        notify("error", "Section could not be created", String(error));
      }
    }
  };
  const openMatter = (focus: MatterFocus) => { setSettingsFocus(focus); setScreen("settings"); };
  const openChapter = (id: number) => { selectChapter(id); setCommandOpen(false); setSettingsFocus(undefined); setScreen("manuscript"); };
  const navigateSection = (direction: -1 | 1) => {
    if (!activeChapter) return;
    const index = orderedChapters.findIndex((chapter) => chapter.id === activeChapter.id);
    const next = orderedChapters[index + direction];
    if (next) openChapter(next.id);
  };
  const switchScreen = (next: StudioScreen) => { if (next === "manuscript" && !selectedBook) return; if (next !== "manuscript") setEditorFocusMode(false); setCommandOpen(false); setSettingsFocus(undefined); setScreen(next); };

  useEffect(() => {
    const openCommandPalette = () => setCommandOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (selectedBookId === null || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      const nextScreen = ({
        "1": "library",
        "2": "manuscript",
        "3": "outline",
        "4": "settings",
        "5": "export",
      } as Record<string, StudioScreen>)[event.key];
      if (!nextScreen) return;
      event.preventDefault();
      switchScreen(nextScreen);
    };
    window.addEventListener("open-books-palette", openCommandPalette);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("open-books-palette", openCommandPalette);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedBookId, selectedBook]);

  if (!loaded) return <div className="books-loading" role="status"><div className="spinner" /><strong>Opening Books Studio</strong><span>Preparing your local manuscript library…</span></div>;
  if (loadError) return <div className="books-loading books-load-error" role="alert"><BookOpen size={26} /><strong>Books Studio could not open</strong><span>{loadError}</span><button className="books-primary-action" onClick={() => void init()}>Try again</button></div>;
  return (
    <div className={`books-studio ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${editorFocusMode ? "editor-focus-mode" : ""}`}>
      <aside className="books-sidebar">
        <div className="books-sidebar-brand"><div className="books-brand-mark"><BookOpen size={17} /></div><div><strong>Books Studio</strong><span>Long-form writing</span></div></div>
        <button className="books-new-button" onClick={() => void newBook()} disabled={creatingBook}><Plus size={15} /> {creatingBook ? "Creating…" : "New manuscript"}</button>
        <ScreenNav screen={screen} hasBook={Boolean(selectedBook)} onChange={switchScreen} />
        <div className="books-sidebar-divider" />
        <div className="books-shelf-heading"><span>Your shelf</span><button onClick={() => void newBook()} title="New manuscript" aria-label="New manuscript" disabled={creatingBook}><Plus size={13} /></button></div>
         <div className="books-sidebar-books">{books.map((book) => <button key={book.id} className={`books-sidebar-book ${book.id === selectedBookId ? "active" : ""}`} onClick={() => void openBook(book.id)}><span>{book.title || "Untitled manuscript"}</span></button>)}{books.length === 0 && <span className="books-no-books">No manuscripts yet</span>}</div>
         {selectedBook && <SectionsRail chapters={chapters} activeChapterId={activeChapterId} onSelect={openChapter} onNewChapter={(kind) => void newChapter(kind)} />}
       </aside>
       <main className="books-main">
         <div className="books-main-header"><div className="books-breadcrumb"><button onClick={() => switchScreen("library")}>Books Studio</button>{selectedBook && <><ChevronRight size={13} /><strong>{selectedBook.title || "Untitled manuscript"}</strong></>}</div>{selectedBook && <div className="books-header-actions"><span className={`book-status-pill ${selectedBook.status}`}>{selectedBook.status.replace("revising", "in revision")}</span><button className="books-header-icon" onClick={() => switchScreen("settings")} title="Book settings" aria-label="Book settings"><Settings2 size={15} /></button></div>}</div>
            {!selectedBook && screen !== "library" ? <div className="books-no-selection"><ArrowLeft size={20} /><h2>Choose a manuscript first.</h2><button className="books-primary-action" onClick={() => setScreen("library")}>Back to library</button></div> : screen === "library" ? <LibraryScreen books={books} creating={creatingBook} deletingBookId={deletingBookId} onNew={() => void newBook()} onOpen={(id) => void openBook(id)} onDelete={(book) => void removeBook(book)} /> : selectedBook && screen === "manuscript" ? <ManuscriptScreen book={selectedBook} chapters={orderedChapters} activeChapter={activeChapter} focusMode={editorFocusMode} onFocusModeChange={setEditorFocusMode} onOpenOutline={() => switchScreen("outline")} onNewChapter={() => void newChapter()} onNavigateSection={navigateSection} /> : selectedBook && screen === "outline" ? <OutlineScreen book={selectedBook} chapters={chapters} onNewChapter={(kind) => void newChapter(kind)} onOpenMatter={openMatter} onOpenChapter={openChapter} /> : selectedBook && screen === "settings" ? <SettingsScreen book={selectedBook} chapters={chapters} focus={settingsFocus} /> : selectedBook ? <ExportScreen book={selectedBook} chapters={chapters} onNavigate={switchScreen} onOpenChapter={openChapter} /> : null}
          </main>
          {selectedBook && <PrintBook book={selectedBook} chapters={chapters} toc={selectedToc} />}
           <BooksCommandPalette open={commandOpen} bookTitle={selectedBook ? (selectedBook.title || "Untitled manuscript") : undefined} chapters={orderedChapters} onClose={() => setCommandOpen(false)} onNavigate={switchScreen} onNewChapter={(kind) => void newChapter(kind)} onOpenChapter={openChapter} />
           {confirmation.dialog}
     </div>
  );
}
