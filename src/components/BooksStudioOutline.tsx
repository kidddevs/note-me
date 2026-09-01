import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  LayoutList,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Book, Chapter, ChapterKind } from "../lib/types";
import { buildBookToc, orderBookChapters, type TocEntry } from "../lib/bookToc";
import { useBooks } from "../store/books";
import { notify } from "../store/toast";
import {
  CHAPTER_KIND_OPTIONS,
  SECTION_GROUP_LABELS,
  chapterGroup,
  chapterKindLabel,
  handleMenuKeyDown,
  tocTitle,
  useConfirmationDialog,
  wordCount,
} from "./BooksStudio";
import type { MatterFocus } from "./BooksStudio";

export function SectionsRail({ chapters, activeChapterId, onSelect, onNewChapter }: { chapters: Chapter[]; activeChapterId: number | null; onSelect: (id: number) => void; onNewChapter: (kind: ChapterKind) => void }) {
  const updateChapter = useBooks((state) => state.updateChapter);
  const deleteChapter = useBooks((state) => state.deleteChapter);
  const reorderChapters = useBooks((state) => state.reorderChapters);
  const [addOpen, setAddOpen] = useState(false);
  const [menuChapterId, setMenuChapterId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragChapterId, setDragChapterId] = useState<number | null>(null);
  const [dragOverChapterId, setDragOverChapterId] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<"front" | "story" | "back", boolean>>({ front: false, story: false, back: false });
  const [addMenuStyle, setAddMenuStyle] = useState<CSSProperties | null>(null);
  const [contextMenuStyle, setContextMenuStyle] = useState<CSSProperties | null>(null);
  const railRef = useRef<HTMLElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const confirmation = useConfirmationDialog();

  const restoreMenuFocus = () => requestAnimationFrame(() => {
    if (menuTriggerRef.current?.isConnected) menuTriggerRef.current.focus();
  });

  const closeAddMenu = (restoreFocus = false) => {
    setAddOpen(false);
    setAddMenuStyle(null);
    if (restoreFocus) restoreMenuFocus();
  };

  const closeContextMenu = (restoreFocus = false) => {
    setMenuChapterId(null);
    setContextMenuStyle(null);
    if (restoreFocus) restoreMenuFocus();
  };

  const popoverStyle = (anchor: HTMLElement, height: number): CSSProperties => {
    const rail = railRef.current?.getBoundingClientRect();
    if (!rail) return {};
    const target = anchor.getBoundingClientRect();
    const opensAbove = target.bottom + height > window.innerHeight - 12;
    return {
      top: opensAbove ? target.top - rail.top - 5 : target.bottom - rail.top + 5,
      left: "auto",
      right: 4,
      transform: opensAbove ? "translateY(-100%)" : undefined,
    };
  };

  const openContextMenu = (event: React.MouseEvent<HTMLElement>, chapterId: number) => {
    event.preventDefault();
    menuTriggerRef.current = event.currentTarget;
    closeAddMenu();
    setMenuChapterId(chapterId);
    setContextMenuStyle(popoverStyle(event.currentTarget, 430));
  };

  useEffect(() => {
    if (addOpen) requestAnimationFrame(() => addMenuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not([disabled])")?.focus());
    if (menuChapterId !== null) requestAnimationFrame(() => contextMenuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not([disabled])")?.focus());
  }, [addOpen, menuChapterId]);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".books-sections-rail")) {
        closeAddMenu();
        closeContextMenu();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (addOpen) closeAddMenu(true);
        if (menuChapterId !== null) closeContextMenu(true);
      }
    };
    window.addEventListener("pointerdown", closeMenus);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenus);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [addOpen, menuChapterId]);

  const changeKind = async (chapter: Chapter, kind: ChapterKind) => {
    try {
      await updateChapter(chapter.id, chapter.title, chapter.content, kind, chapter.toc_include, chapter.toc_heading_exclusions);
      closeContextMenu();
    } catch (error) {
      notify("error", "Section type could not be saved", String(error));
    }
  };

  const toggleContents = async (chapter: Chapter) => {
    try {
      await updateChapter(chapter.id, chapter.title, chapter.content, chapter.chapter_kind, !chapter.toc_include, chapter.toc_heading_exclusions);
    } catch (error) {
      notify("error", "Contents setting could not be saved", String(error));
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const orderedChapters = orderBookChapters(chapters);
    const destination = index + direction;
    if (destination < 0 || destination >= orderedChapters.length || chapterGroup(orderedChapters[index].chapter_kind) !== chapterGroup(orderedChapters[destination].chapter_kind)) return;
    const next = [...orderedChapters];
    [next[index], next[destination]] = [next[destination], next[index]];
    try {
      await reorderChapters(next.map((chapter) => chapter.id));
      closeContextMenu();
    } catch (error) {
      notify("error", "Section order could not be saved", String(error));
    }
  };

  const removeChapter = (chapter: Chapter, restoreFocus?: HTMLElement | null) => {
    closeContextMenu();
    confirmation.ask({
      title: `Delete “${chapter.title || "Untitled section"}”?`,
      description: "This section and its writing will be permanently removed from the manuscript. This cannot be undone.",
      confirmLabel: "Delete section",
      onConfirm: async () => {
        await deleteChapter(chapter.id);
        notify("success", "Section deleted", chapter.title || "Untitled section");
      },
    }, restoreFocus);
  };

  const dropChapter = async (targetId: number) => {
    if (dragChapterId === null || dragChapterId === targetId) return;
    const orderedChapters = orderBookChapters(chapters);
    const from = orderedChapters.findIndex((chapter) => chapter.id === dragChapterId);
    const to = orderedChapters.findIndex((chapter) => chapter.id === targetId);
    if (from === -1 || to === -1) return;
    if (chapterGroup(orderedChapters[from].chapter_kind) !== chapterGroup(orderedChapters[to].chapter_kind)) return;
    const next = [...orderedChapters];
    const [dragged] = next.splice(from, 1);
    next.splice(to, 0, dragged);
    try {
      await reorderChapters(next.map((chapter) => chapter.id));
    } catch (error) {
      notify("error", "Section order could not be saved", String(error));
    } finally {
      setDragChapterId(null);
      setDragOverChapterId(null);
    }
  };

  const orderedChapters = orderBookChapters(chapters);
  const filteredChapters = orderedChapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => !searchQuery.trim() || `${chapter.title} ${chapterKindLabel(chapter.chapter_kind)}`.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()));
  const menuChapter = menuChapterId === null ? null : chapters.find((chapter) => chapter.id === menuChapterId) ?? null;
  const menuChapterIndex = menuChapter ? orderedChapters.indexOf(menuChapter) : -1;
  const canMoveMenuChapter = (direction: -1 | 1) => {
    const destination = menuChapterIndex + direction;
    return menuChapterIndex >= 0 && destination >= 0 && destination < orderedChapters.length && chapterGroup(orderedChapters[menuChapterIndex].chapter_kind) === chapterGroup(orderedChapters[destination].chapter_kind);
  };

  return (
    <>
    <section ref={railRef} className="books-sections-rail" aria-labelledby="books-sections-heading">
      <div className="books-sections-heading">
        <div>
          <span id="books-sections-heading">Sections</span>
          <small>{chapters.length} {chapters.length === 1 ? "section" : "sections"}</small>
        </div>
         <div className="books-sections-heading-actions">
           {chapters.length > 4 && <button className="books-section-add-button" onClick={() => { setAddOpen(false); closeContextMenu(); setSearchOpen((open) => !open); }} aria-label="Search sections" aria-expanded={searchOpen} title="Search sections"><Search size={13} /></button>}
           <button className="books-section-add-button" onClick={(event) => { menuTriggerRef.current = event.currentTarget; closeContextMenu(); setSearchOpen(false); if (addOpen) closeAddMenu(true); else { setAddOpen(true); setAddMenuStyle(popoverStyle(event.currentTarget, 430)); } }} aria-label="Add section" aria-expanded={addOpen} aria-haspopup="menu" title="Add section"><Plus size={14} /></button>
         </div>
       </div>
       {searchOpen && <div className="books-section-search"><Search size={12} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setSearchQuery(""); setSearchOpen(false); } }} placeholder="Filter sections" aria-label="Filter sections" />{searchQuery && <button onClick={() => setSearchQuery("")} aria-label="Clear section search"><X size={12} /></button>}</div>}
       {addOpen && (
         <div ref={addMenuRef} className="books-section-add-menu" role="menu" aria-label="Add section" style={addMenuStyle ?? undefined} onKeyDown={(event) => handleMenuKeyDown(event, () => closeAddMenu(true))}>
          <span className="books-section-menu-kicker">Add to manuscript</span>
          {(["front", "story", "back"] as const).map((group) => (
            <div key={group} className="books-section-option-group">
              <small>{SECTION_GROUP_LABELS[group]}</small>
              {CHAPTER_KIND_OPTIONS.filter((option) => option.group === group).map((option) => (
                <button key={option.value} role="menuitem" onClick={() => { setAddOpen(false); setAddMenuStyle(null); onNewChapter(option.value); }}>{option.label}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      {chapters.length === 0 ? (
        <button className="books-sections-empty" onClick={(event) => { menuTriggerRef.current = event.currentTarget; setAddOpen(true); setAddMenuStyle(popoverStyle(event.currentTarget, 430)); }} aria-haspopup="menu" aria-expanded={addOpen}>
          <Plus size={14} />
          <span>Add the first section</span>
        </button>
      ) : filteredChapters.length === 0 ? (
        <div className="books-sections-no-results"><Search size={13} /><span>No matching sections</span></div>
      ) : (
        <div className="books-section-list" role="list">
          {filteredChapters.map(({ chapter, index }, visibleIndex) => {
            const group = chapterGroup(chapter.chapter_kind);
            const previousGroup = visibleIndex > 0 ? chapterGroup(filteredChapters[visibleIndex - 1].chapter.chapter_kind) : null;
            const showGroup = previousGroup !== group;
            const groupCount = chapters.filter((item) => chapterGroup(item.chapter_kind) === group).length;
            return (
              <Fragment key={chapter.id}>
                {showGroup && <button className={`books-section-group ${collapsedGroups[group] ? "collapsed" : ""}`} onClick={() => setCollapsedGroups((current) => ({ ...current, [group]: !current[group] }))} aria-expanded={!collapsedGroups[group]}><span><strong>{SECTION_GROUP_LABELS[group]}</strong><small>{groupCount}</small></span><ChevronRight size={12} /></button>}
                {!collapsedGroups[group] && <div
                  role="listitem"
                  draggable
                  className={`books-section-row ${chapter.id === activeChapterId ? "active" : ""} ${dragChapterId === chapter.id ? "dragging" : ""} ${dragOverChapterId === chapter.id ? "drop-target" : ""}`}
                  onContextMenu={(event) => openContextMenu(event, chapter.id)}
                  onDragStart={(event) => { setDragChapterId(chapter.id); setDragOverChapterId(null); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(chapter.id)); }}
                  onDragEnd={() => { setDragChapterId(null); setDragOverChapterId(null); }}
                   onDragOver={(event) => { const draggedChapter = chapters.find((item) => item.id === dragChapterId); if (draggedChapter && dragChapterId !== chapter.id && chapterGroup(draggedChapter.chapter_kind) === group) { event.preventDefault(); setDragOverChapterId(chapter.id); } }}
                  onDrop={(event) => { event.preventDefault(); void dropChapter(chapter.id); }}
                >
                  <button
                    className="books-section-main"
                    onClick={() => { closeContextMenu(); onSelect(chapter.id); }}
                    onKeyDown={(event) => {
                      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const navigable = filteredChapters.filter(({ chapter: item }) => !collapsedGroups[chapterGroup(item.chapter_kind)]);
                      const currentIndex = navigable.findIndex(({ chapter: item }) => item.id === chapter.id);
                      const destination = event.key === "Home" ? 0 : event.key === "End" ? navigable.length - 1 : currentIndex + (event.key === "ArrowUp" ? -1 : 1);
                      const next = navigable[destination]?.chapter;
                      if (next) onSelect(next.id);
                    }}
                    aria-current={chapter.id === activeChapterId ? "page" : undefined}
                  >
                    <GripVertical className="books-section-grip" size={13} aria-hidden="true" />
                    <span className="books-section-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="books-section-name"><strong>{chapter.title || "Untitled section"}</strong><small>{chapterKindLabel(chapter.chapter_kind)} · {wordCount(chapter.content).toLocaleString()} words</small></span>
                  </button>
                  <button className={`books-section-toc-toggle ${chapter.toc_include ? "included" : "excluded"}`} onClick={() => void toggleContents(chapter)} title={chapter.toc_include ? "Included in contents" : "Excluded from contents"} aria-label={chapter.toc_include ? "Exclude section from contents" : "Include section in contents"}>
                    {chapter.toc_include ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button className="books-section-more" onClick={(event) => { if (menuChapterId === chapter.id) closeContextMenu(true); else openContextMenu(event, chapter.id); }} aria-label={`Options for ${chapter.title || "untitled section"}`} aria-expanded={menuChapterId === chapter.id} aria-haspopup="menu"><MoreHorizontal size={14} /></button>
                </div>}
              </Fragment>
            );
          })}
        </div>
      )}
      {menuChapter && <div ref={contextMenuRef} className="books-section-context" role="menu" aria-label={`Options for ${menuChapter.title || "untitled section"}`} style={contextMenuStyle ?? undefined} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => handleMenuKeyDown(event, () => closeContextMenu(true))}>
        <span className="books-section-menu-kicker">Section type</span>
        {CHAPTER_KIND_OPTIONS.map((option) => (
          <button key={option.value} role="menuitem" className={menuChapter.chapter_kind === option.value ? "selected" : ""} onClick={() => void changeKind(menuChapter, option.value)}>
            <span>{option.label}</span>{menuChapter.chapter_kind === option.value && <Check size={12} />}
          </button>
        ))}
        <div className="books-section-menu-divider" />
        <button role="menuitem" onClick={() => void move(menuChapterIndex, -1)} disabled={!canMoveMenuChapter(-1)}><ArrowUp size={13} /> Move earlier</button>
        <button role="menuitem" onClick={() => void move(menuChapterIndex, 1)} disabled={!canMoveMenuChapter(1)}><ArrowDown size={13} /> Move later</button>
        <button role="menuitem" onClick={() => { closeContextMenu(); void toggleContents(menuChapter); }}>{menuChapter.toc_include ? <EyeOff size={13} /> : <Eye size={13} />}{menuChapter.toc_include ? "Hide from contents" : "Include in contents"}</button>
        <button role="menuitem" className="danger" onClick={() => void removeChapter(menuChapter, menuTriggerRef.current)}><Trash2 size={13} /> Delete section</button>
      </div>}
       <p className="books-sections-hint">Right-click for options. Focus a section and use Up/Down to move through the rail.</p>
    </section>
    {confirmation.dialog}
    </>
  );
}
export function OutlineScreen({ book, chapters, onNewChapter, onOpenMatter, onOpenChapter }: { book: Book; chapters: Chapter[]; onNewChapter: (kind?: ChapterKind) => void; onOpenMatter: (focus: MatterFocus) => void; onOpenChapter: (id: number) => void }) {
  const reorderChapters = useBooks((state) => state.reorderChapters);
  const deleteChapter = useBooks((state) => state.deleteChapter);
  const updateChapter = useBooks((state) => state.updateChapter);
  const orderedChapters = orderBookChapters(chapters);
  const toc = useMemo(() => buildBookToc(book, chapters, { includeExcludedHeadings: true }), [book, chapters]);
  const visibleTocCount = toc.filter((entry) => entry.included !== false).length;
  const confirmation = useConfirmationDialog();
  const move = async (index: number, direction: -1 | 1) => {
    const next = [...orderedChapters];
    const destination = index + direction;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    try {
     await reorderChapters(next.map((chapter) => chapter.id));
    } catch (error) {
      notify("error", "Section order could not be saved", String(error));
    }
  };
  const removeChapter = (chapter: Chapter, restoreFocus?: HTMLElement | null) => {
    confirmation.ask({
      title: `Delete “${chapter.title || "Untitled section"}”?`,
      description: "This section and its writing will be permanently removed from the manuscript. This cannot be undone.",
      confirmLabel: "Delete section",
      onConfirm: async () => {
        await deleteChapter(chapter.id);
        notify("success", "Section deleted", chapter.title || "Untitled section");
      },
    }, restoreFocus);
  };
  const toggleHeading = async (entry: TocEntry) => {
    if (entry.chapterId === undefined || entry.headingKey === undefined) return;
    const chapter = chapters.find((item) => item.id === entry.chapterId);
    if (!chapter) return;
    const exclusions = new Set(chapter.toc_heading_exclusions ?? []);
    if (exclusions.has(entry.headingKey)) {
      exclusions.delete(entry.headingKey);
    } else {
      exclusions.add(entry.headingKey);
    }
    try {
      await updateChapter(chapter.id, chapter.title, chapter.content, chapter.chapter_kind, chapter.toc_include, Array.from(exclusions).sort());
    } catch (error) {
      notify("error", "Heading visibility could not be saved", String(error));
    }
  };
  const frontMatter = [
    { title: "Dedication", content: book.dedication },
    { title: "Epigraph", content: book.epigraph },
    { title: "Copyright", content: book.copyright_text },
  ];
  const backMatter = [{ title: "Acknowledgements", content: book.acknowledgements }];
  const matterRow = (section: { title: string; content: string }, focus: MatterFocus) => (
    <button className="books-matter-row" key={section.title} onClick={() => onOpenMatter(focus)}>
      <span><strong>{section.title}</strong><small>{section.content.trim() ? `${wordCount(section.content).toLocaleString()} words` : "Not written yet"}</small></span><ChevronRight size={14} />
    </button>
  );
  return (
    <>
    <div className="books-screen books-outline-screen">
       <div className="books-screen-heading"><div><span className="books-eyebrow"><LayoutList size={13} /> Structure</span><h1>Outline</h1><p>Reorder the manuscript. Add and classify sections from the left rail.</p></div><div className="books-outline-actions"><button className="books-primary-action" onClick={() => onNewChapter("chapter")}><Plus size={15} /> Add chapter</button></div></div>
      <div className="books-outline-list">
        <div className="books-outline-group"><div className="books-outline-group-heading"><span>Front matter</span><small>Before the story</small></div>{frontMatter.map((section) => matterRow(section, "front"))}</div>
        <div className="books-outline-group books-outline-story"><div className="books-outline-group-heading"><span>Story</span><small>{chapters.length} sections</small></div>
        {chapters.length === 0 && <div className="books-outline-empty">No story sections yet. Add the first beat of your manuscript.</div>}
         {orderedChapters.map((chapter, index) => (
          <div className="books-outline-row" key={chapter.id}>
             <button className="books-outline-main" onClick={() => onOpenChapter(chapter.id)}><span className="outline-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{chapter.title || "Untitled section"}</strong><small>{chapterKindLabel(chapter.chapter_kind)} · {wordCount(chapter.content).toLocaleString()} words</small></span><ChevronRight size={15} /></button>
              <div className="books-outline-controls"><span className="books-outline-kind">{chapterKindLabel(chapter.chapter_kind)}</span><button onClick={() => void move(index, -1)} disabled={index === 0 || chapterGroup(orderedChapters[index - 1].chapter_kind) !== chapterGroup(chapter.chapter_kind)} title="Move up" aria-label={`Move ${chapter.title || "untitled section"} up`}><ArrowUp size={14} /></button><button onClick={() => void move(index, 1)} disabled={index === orderedChapters.length - 1 || chapterGroup(orderedChapters[index + 1]?.chapter_kind ?? chapter.chapter_kind) !== chapterGroup(chapter.chapter_kind)} title="Move down" aria-label={`Move ${chapter.title || "untitled section"} down`}><ArrowDown size={14} /></button><button className="danger" onClick={(event) => void removeChapter(chapter, event.currentTarget)} title="Delete section" aria-label={`Delete ${chapter.title || "untitled section"}`}><Trash2 size={14} /></button></div>
          </div>
        ))}
        </div>
        <div className="books-outline-group"><div className="books-outline-group-heading"><span>Back matter</span><small>After the story</small></div>{backMatter.map((section) => matterRow(section, "back"))}</div>
       </div>
       <section className="books-generated-toc" aria-labelledby="generated-toc-heading">
          <div className="books-generated-toc-heading"><div><span className="books-eyebrow"><LayoutList size={13} /> Generated contents</span><h2 id="generated-toc-heading">{tocTitle(book)}</h2></div><span>{visibleTocCount === toc.length ? `${toc.length} entries` : `${visibleTocCount} visible · ${toc.length - visibleTocCount} hidden`}</span></div>
           {toc.length === 0 ? <p className="books-generated-toc-empty">Enable contents in Book settings, then add headings to a section to build this map.</p> : <div className="books-generated-toc-list">{toc.map((entry) => <div key={entry.id} className={`books-generated-toc-item ${entry.included === false ? "hidden" : ""}`} style={{ paddingLeft: `${Math.max(0, entry.level - 1) * 18}px` }}><button className={`books-generated-toc-entry ${entry.source === "heading" ? "heading" : "section"}`} onClick={() => entry.chapterId !== undefined && onOpenChapter(entry.chapterId)}><span>{entry.label}</span>{entry.source === "heading" && <small>H{entry.headingLevel}</small>}</button>{entry.source === "heading" && entry.chapterId !== undefined && <button className="books-generated-toc-toggle" onClick={(event) => { event.stopPropagation(); void toggleHeading(entry); }} aria-label={entry.included === false ? `Include ${entry.label} in contents` : `Hide ${entry.label} from contents`} aria-pressed={entry.included !== false} title={entry.included === false ? "Include heading in contents" : "Hide heading from contents"}>{entry.included === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>}</div>)}</div>}
       </section>
     </div>
     {confirmation.dialog}
     </>
  );
}
