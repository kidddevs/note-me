import React, { useMemo, useState } from "react";
import { BookOpen, ClipboardList, FlaskConical, LayoutList, Paintbrush } from "lucide-react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { Toasts } from "./components/Toasts";
import { ManuscriptScreen } from "./components/BooksStudioEditor";
import { CoverScreen } from "./components/BooksCoverStudio";
import { PlanScreen } from "./components/BooksStudioPlan";
import { OutlineScreen } from "./components/BooksStudioOutline";
import { api } from "./lib/api";
import { orderBookChapters } from "./lib/bookToc";
import { serializeChapterWorkflow } from "./lib/bookWorkflow";
import { layoutForBook, serializeBookLayout } from "./lib/bookLayout";
import { createCoverDocument } from "./lib/bookCoverDoc";
import { loadCoverPreviewBook, saveCoverPreviewBook, loadCoverPreviewChapters, saveCoverPreviewChapter, patchCoverPreviewChapter, createCoverPreviewChapter, deleteCoverPreviewChapter, reorderCoverPreviewChapters } from "./lib/bookCoverPreview";
import { useBooks } from "./store/books";
import { notify } from "./store/toast";
import type { Book, Chapter } from "./lib/types";

// Development fixture only. It never opens a native database or uses real book ids.
if (!import.meta.env.DEV) throw new Error("The cover preview is available only in development.");
const PREVIEW_BOOK_ID = -701;
document.documentElement.dataset.theme = new URLSearchParams(window.location.search).get("theme") === "light" ? "light" : "dark";
const baseBook: Book = {
  id: PREVIEW_BOOK_ID, title: "The Salt Archive", subtitle: "A novel", author: "Amelia Hart",
  description: "A tidal family history, told through the objects left behind on a disappearing shore.",
  genre: "Literary fiction", status: "draft", trim_size: "6x9", font_family: "serif", font_size: 12,
  line_height: 1.5, paragraph_spacing: 0, margin: 1, word_goal: 80000, cover_color: "#123b46",
  dedication: "", epigraph: "", copyright_text: "", acknowledgements: "",
  toc_enabled: true, toc_title: "Contents", toc_depth: 3, toc_include_front_matter: false, toc_include_back_matter: false,
  layout_json: "", created_at: "", updated_at: new Date().toISOString(),
};
const baseLayout = layoutForBook(baseBook);
const doc = createCoverDocument("tidewater", baseBook, baseLayout.cover);
const initialBook: Book = { ...baseBook, layout_json: serializeBookLayout({ ...baseLayout, cover: { ...baseLayout.cover, doc } }) };
const initialChapters: Chapter[] = [
  { id: -702, book_id: PREVIEW_BOOK_ID, chapter_kind: "feature", title: "North light", content: "## The coast remembers\n\nAn archive of places and photographs. Add artwork from the studio image library to explore focal crops and captions.", position: 0, toc_include: true, toc_heading_exclusions: [], layout_json: "", created_at: "", updated_at: "" },
];
initialChapters.push(
  { ...initialChapters[0], id: -703, position: 1, chapter_kind: "photo_essay", title: "Shoreline photographs", content: "A visual record of places, light and the people who keep their stories. Collect the photographs and prepare their captions.", workflow_json: serializeChapterWorkflow({ status: "revising", wordGoal: 900, dueDate: "" }) },
  { ...initialChapters[0], id: -704, position: 2, chapter_kind: "colophon", title: "Closing notes", content: "Designed and written beside the coast. Photography and source credits are kept with each image.", toc_include: false, workflow_json: serializeChapterWorkflow({ status: "ready", wordGoal: 0, dueDate: "" }) },
);
function Preview() {
  const currentBook = useBooks((state) => state.books[0]);
  const storedChapters = useBooks((state) => state.chapters);
  const chapters = useMemo(() => orderBookChapters(storedChapters), [storedChapters]);
  const activeChapterId = useBooks((state) => state.activeChapterId);
  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0];
  const requested = new URLSearchParams(window.location.search).get("screen");
  const [screen, setScreen] = useState(requested && ["manuscript", "plan", "outline"].includes(requested) ? requested : "cover");
  const openChapter = (id: number) => { useBooks.setState({ activeChapterId: id }); setScreen("manuscript"); };
  const newChapter = () => void useBooks.getState().createChapter(PREVIEW_BOOK_ID, "New section")
    .then((chapter) => openChapter(chapter.id))
    .catch((error) => notify("error", "Section could not be created", String(error)));
  const [focusMode, setFocusMode] = useState(false);
  return (
    <div className="app" style={{ height: "100%" }}>
      <nav className="studio-preview-nav" aria-label="Studio development preview"><span><FlaskConical size={14} /> Development preview</span>{([
        ["manuscript", "Manuscript", BookOpen], ["cover", "Cover designer", Paintbrush], ["plan", "Section plan", ClipboardList], ["outline", "Outline", LayoutList],
      ] as const).map(([value, label, Icon]) => <button key={value} type="button" aria-pressed={screen === value} onClick={() => setScreen(value)}><Icon size={14} />{label}</button>)}</nav>
      <div className="app-body books-studio">
        {screen === "manuscript" ? <ManuscriptScreen book={currentBook} chapters={chapters} activeChapter={activeChapter} focusMode={focusMode} onFocusModeChange={setFocusMode} onOpenOutline={() => setScreen("outline")} onOpenSettings={() => undefined} onNewChapter={newChapter} onNavigateSection={(direction) => { const index = chapters.findIndex((chapter) => chapter.id === activeChapterId); const next = chapters[index + direction]; if (next) openChapter(next.id); }} />
          : screen === "plan" ? <PlanScreen book={currentBook} chapters={chapters} activeChapterId={activeChapterId} onNewChapter={newChapter} onOpenChapter={openChapter} />
          : screen === "outline" ? <OutlineScreen book={currentBook} chapters={chapters} onNewChapter={newChapter} onOpenChapter={openChapter} onOpenMatter={() => undefined} />
          : <CoverScreen book={currentBook} chapters={chapters} onOpenChapter={openChapter} onNavigate={(next) => { if (["manuscript", "plan", "outline", "cover"].includes(next)) setScreen(next); }} />}
      </div>
      <Toasts />
    </div>
  );
}

async function startPreview() {
  const [stored, storedChapters] = await Promise.all([loadCoverPreviewBook(), loadCoverPreviewChapters()]);
  const chapters = storedChapters.length ? storedChapters : stored ? [] : initialChapters;
  if (!stored) await saveCoverPreviewBook(initialBook);
  if (!storedChapters.length) for (const chapter of chapters) await saveCoverPreviewChapter(chapter);
  const fixtureBook = (id: number) => { if (id !== PREVIEW_BOOK_ID) throw new Error("Only the development fixture can be changed here."); };
  api.listChapters = async (id) => { fixtureBook(id); return loadCoverPreviewChapters(); };
  api.createChapter = async (id, input) => { fixtureBook(id); return createCoverPreviewChapter(input); };
  api.updateChapter = async (id, title, content, chapterKind = "chapter", tocInclude = true, tocHeadingExclusions = []) => { await patchCoverPreviewChapter(id, { title, content, chapter_kind: chapterKind, toc_include: tocInclude, toc_heading_exclusions: tocHeadingExclusions }); };
  api.updateChapterLayout = async (id, layoutJson) => { await patchCoverPreviewChapter(id, { layout_json: layoutJson }); };
  api.updateChapterWorkflow = async (id, workflow) => patchCoverPreviewChapter(id, { workflow_json: serializeChapterWorkflow(workflow) });
  api.deleteChapter = deleteCoverPreviewChapter;
  api.reorderChapters = async (id, ids) => { fixtureBook(id); await reorderCoverPreviewChapters(ids); };
  let initialBooks = [stored ?? initialBook];
  useBooks.setState({
    books: initialBooks,
    chapters,
    selectedBookId: PREVIEW_BOOK_ID,
    activeChapterId: chapters[0]?.id ?? null,
    loaded: true,
    error: null,
    updateBook: async (id, input) => {
      const next: Book = {
        ...initialBooks[0], id, title: input.title, subtitle: input.subtitle, author: input.author,
        description: input.description, genre: input.genre, status: input.status,
        trim_size: input.trimSize, font_family: input.fontFamily, font_size: input.fontSize,
        line_height: input.lineHeight, paragraph_spacing: input.paragraphSpacing, margin: input.margin,
        word_goal: input.wordGoal ?? initialBooks[0].word_goal, cover_color: input.coverColor ?? initialBooks[0].cover_color, dedication: input.dedication ?? initialBooks[0].dedication,
        epigraph: input.epigraph ?? initialBooks[0].epigraph, copyright_text: input.copyrightText ?? initialBooks[0].copyright_text, acknowledgements: input.acknowledgements ?? initialBooks[0].acknowledgements,
        toc_enabled: input.tocEnabled ?? initialBooks[0].toc_enabled, toc_title: input.tocTitle ?? initialBooks[0].toc_title, toc_depth: input.tocDepth ?? initialBooks[0].toc_depth,
        toc_include_front_matter: input.tocIncludeFrontMatter ?? initialBooks[0].toc_include_front_matter, toc_include_back_matter: input.tocIncludeBackMatter ?? initialBooks[0].toc_include_back_matter,
        layout_json: input.layoutJson ?? initialBooks[0].layout_json, updated_at: new Date().toISOString(),
      };
      await saveCoverPreviewBook(next);
      initialBooks = [next];
      useBooks.setState({ books: [next] });
    },
  });

  const root = import.meta.hot?.data.root ?? ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<React.StrictMode><Preview /></React.StrictMode>);
}

void startPreview().catch((error) => {
  const element = document.getElementById("root");
  if (element) element.textContent = `Cover preview could not start: ${String(error)}`;
});
