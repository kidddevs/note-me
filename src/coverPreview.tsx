import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { CoverScreen } from "./components/BooksCoverStudio";
import { layoutForBook, serializeBookLayout } from "./lib/bookLayout";
import { createCoverDocument } from "./lib/bookCoverDoc";
import { loadCoverPreviewBook, saveCoverPreviewBook } from "./lib/bookCoverPreview";
import { useBooks } from "./store/books";
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
const chapters: Chapter[] = [
  { id: -702, book_id: PREVIEW_BOOK_ID, chapter_kind: "feature", title: "North light", content: "word ".repeat(2400), position: 0, toc_include: true, toc_heading_exclusions: [], layout_json: "", created_at: "", updated_at: "" },
];
function Preview() {
  const currentBook = useBooks((state) => state.books[0]);
  return (
    <div className="app" style={{ height: "100%" }}>
      <div style={{ height: 54, flexShrink: 0 }} />
      <div className="app-body books-studio">
        <CoverScreen book={currentBook} chapters={chapters} onOpenChapter={() => undefined} onNavigate={() => undefined} />
      </div>
    </div>
  );
}

async function startPreview() {
  const stored = await loadCoverPreviewBook();
  let initialBooks = [stored ?? initialBook];
  useBooks.setState({
    books: initialBooks,
    chapters,
    selectedBookId: PREVIEW_BOOK_ID,
    activeChapterId: -702,
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
