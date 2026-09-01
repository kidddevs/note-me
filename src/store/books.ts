import { create } from "zustand";
import { api } from "../lib/api";
import { DEFAULT_BOOK_LAYOUT, serializeBookLayout } from "../lib/bookLayout";
import { activeChapterSetting, LEGACY_ACTIVE_CHAPTER_SETTING, rememberedChapterId, SELECTED_BOOK_SETTING, storedEntityId } from "../lib/bookSession";
import type { Book, BookInput, Chapter, ChapterKind } from "../lib/types";

let selectionPersistence = Promise.resolve();

function persistSelection(bookId: number | null, chapterId: number | null) {
  selectionPersistence = selectionPersistence
    .then(() => {
      const writes = [
        api.setSetting(SELECTED_BOOK_SETTING, bookId === null ? "" : String(bookId)),
        api.setSetting(LEGACY_ACTIVE_CHAPTER_SETTING, chapterId === null ? "" : String(chapterId)),
      ];
      if (bookId !== null) {
        writes.push(api.setSetting(activeChapterSetting(bookId), chapterId === null ? "" : String(chapterId)));
      }
      return Promise.all(writes);
    })
    .then(() => undefined, () => undefined);
}

export const DEFAULT_BOOK: BookInput = {
  title: "Untitled manuscript",
  subtitle: "",
  author: "",
  description: "",
  genre: "",
  status: "draft",
  trimSize: "6x9",
  fontFamily: "serif",
  fontSize: 12,
  lineHeight: 1.5,
  paragraphSpacing: 0,
  margin: 1,
  wordGoal: 50000,
  coverColor: "#a56b3e",
  dedication: "",
  epigraph: "",
  copyrightText: "",
  acknowledgements: "",
  tocEnabled: true,
  tocTitle: "Contents",
  tocDepth: 3,
  tocIncludeFrontMatter: false,
  tocIncludeBackMatter: false,
  layoutJson: serializeBookLayout(DEFAULT_BOOK_LAYOUT),
};

interface BooksState {
  books: Book[];
  chapters: Chapter[];
  selectedBookId: number | null;
  activeChapterId: number | null;
  loaded: boolean;
  error: string | null;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  selectBook: (id: number | null) => Promise<void>;
  selectChapter: (id: number | null) => void;
  createBook: (input?: Partial<BookInput>) => Promise<Book>;
  updateBook: (id: number, input: BookInput) => Promise<void>;
  deleteBook: (id: number) => Promise<void>;
  createChapter: (bookId: number, title?: string, chapterKind?: ChapterKind) => Promise<Chapter>;
  updateChapter: (id: number, title: string, content: string, chapterKind?: ChapterKind, tocInclude?: boolean, tocHeadingExclusions?: string[]) => Promise<void>;
  deleteChapter: (id: number) => Promise<void>;
  reorderChapters: (ids: number[]) => Promise<void>;
}

export const useBooks = create<BooksState>((set, get) => ({
  books: [],
  chapters: [],
  selectedBookId: null,
  activeChapterId: null,
  loaded: false,
  error: null,

  init: async () => {
    set({ loaded: false, error: null });
    try {
      const [books, savedBookValue, legacyChapterValue] = await Promise.all([
        api.listBooks(),
        api.getSetting(SELECTED_BOOK_SETTING).catch(() => null),
        api.getSetting(LEGACY_ACTIVE_CHAPTER_SETTING).catch(() => null),
      ]);
      const savedBookId = storedEntityId(savedBookValue);
      const selectedBookId = books.some((book) => book.id === savedBookId) ? savedBookId : null;
      const chapters = selectedBookId === null ? [] : await api.listChapters(selectedBookId);
      const savedChapterValue = selectedBookId === null
        ? null
        : await api.getSetting(activeChapterSetting(selectedBookId)).catch(() => null);
      const activeChapterId = rememberedChapterId(chapters, savedChapterValue, legacyChapterValue);
      set({ books, selectedBookId, chapters, activeChapterId, loaded: true, error: null });
      if (selectedBookId !== savedBookId || activeChapterId !== storedEntityId(savedChapterValue)) {
        persistSelection(selectedBookId, activeChapterId);
      }
    } catch (error) {
      set({ loaded: true, error: error instanceof Error ? error.message : String(error) });
    }
  },

  refresh: async () => {
    const books = await api.listBooks();
    const selectedBookId = get().selectedBookId;
    const selectedStillExists = selectedBookId !== null && books.some((book) => book.id === selectedBookId);
    if (!selectedStillExists) {
      set({ books, selectedBookId: null, chapters: [], activeChapterId: null });
      persistSelection(null, null);
      return;
    }
    const chapters = await api.listChapters(selectedBookId);
    const activeChapterId = chapters.some((chapter) => chapter.id === get().activeChapterId)
      ? get().activeChapterId
      : chapters[0]?.id ?? null;
    set({ books, chapters, activeChapterId });
    persistSelection(selectedBookId, activeChapterId);
  },

  selectBook: async (id) => {
    if (id === null) {
      set({ selectedBookId: null, chapters: [], activeChapterId: null });
      persistSelection(null, null);
      return;
    }
    const [chapters, savedChapterValue] = await Promise.all([
      api.listChapters(id),
      api.getSetting(activeChapterSetting(id)).catch(() => null),
    ]);
    const activeChapterId = rememberedChapterId(chapters, savedChapterValue);
    set({ selectedBookId: id, chapters, activeChapterId });
    persistSelection(id, activeChapterId);
  },

  selectChapter: (id) => {
    set({ activeChapterId: id });
    persistSelection(get().selectedBookId, id);
  },

  createBook: async (input = {}) => {
    const book = await api.createBook({ ...DEFAULT_BOOK, ...input });
    const books = await api.listBooks();
    set({ books, selectedBookId: book.id, chapters: [], activeChapterId: null });
    persistSelection(book.id, null);
    return book;
  },

  updateBook: async (id, input) => {
    await api.updateBook(id, input);
    set((state) => ({
      books: state.books.map((book) =>
        book.id === id
          ? {
              ...book,
              title: input.title,
              subtitle: input.subtitle,
              author: input.author,
              description: input.description,
              genre: input.genre,
              status: input.status,
              trim_size: input.trimSize,
              font_family: input.fontFamily,
              font_size: input.fontSize,
               line_height: input.lineHeight,
               paragraph_spacing: input.paragraphSpacing,
               margin: input.margin,
               word_goal: input.wordGoal ?? book.word_goal,
               cover_color: input.coverColor ?? book.cover_color,
               dedication: input.dedication ?? book.dedication,
               epigraph: input.epigraph ?? book.epigraph,
               copyright_text: input.copyrightText ?? book.copyright_text,
               acknowledgements: input.acknowledgements ?? book.acknowledgements,
               toc_enabled: input.tocEnabled ?? book.toc_enabled,
               toc_title: input.tocTitle ?? book.toc_title,
               toc_depth: input.tocDepth ?? book.toc_depth,
                toc_include_front_matter: input.tocIncludeFrontMatter ?? book.toc_include_front_matter,
                toc_include_back_matter: input.tocIncludeBackMatter ?? book.toc_include_back_matter,
                layout_json: input.layoutJson ?? book.layout_json,
             }
          : book,
      ),
    }));
  },

  deleteBook: async (id) => {
    await api.deleteBook(id);
    void api.setSetting(activeChapterSetting(id), "").catch(() => undefined);
    const books = await api.listBooks();
    if (get().selectedBookId === id) {
      set({ books, selectedBookId: null, chapters: [], activeChapterId: null });
      persistSelection(null, null);
    } else {
      set({ books });
    }
  },

  createChapter: async (bookId, title = "New chapter", chapterKind = "chapter") => {
    const chapter = await api.createChapter(bookId, { title, content: "", chapterKind, tocInclude: true, tocHeadingExclusions: [] });
    const chapters = await api.listChapters(bookId);
    set({ chapters, activeChapterId: chapter.id });
    persistSelection(bookId, chapter.id);
    return chapter;
  },

  updateChapter: async (id, title, content, chapterKind, tocInclude, tocHeadingExclusions) => {
    const previousChapter = get().chapters.find((chapter) => chapter.id === id);
    const nextChapter = previousChapter
      ? { ...previousChapter, title, content, chapter_kind: chapterKind ?? previousChapter.chapter_kind, toc_include: tocInclude ?? previousChapter.toc_include, toc_heading_exclusions: tocHeadingExclusions ?? previousChapter.toc_heading_exclusions }
      : undefined;
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.id === id
          ? nextChapter ?? chapter
          : chapter,
      ),
    }));
    try {
      await api.updateChapter(id, title, content, chapterKind, tocInclude, tocHeadingExclusions);
    } catch (error) {
      if (nextChapter && previousChapter) {
        set((state) => ({
          chapters: state.chapters.map((chapter) => {
            const stillOptimistic = chapter.id === id
              && chapter.title === nextChapter.title
              && chapter.content === nextChapter.content
              && chapter.chapter_kind === nextChapter.chapter_kind
              && chapter.toc_include === nextChapter.toc_include
              && chapter.toc_heading_exclusions.join("\u0000") === nextChapter.toc_heading_exclusions.join("\u0000");
            return stillOptimistic ? previousChapter : chapter;
          }),
        }));
      }
      throw error;
    }
  },

  deleteChapter: async (id) => {
    const previousChapters = get().chapters;
    const previousActiveChapterId = get().activeChapterId;
    const remaining = get().chapters.filter((chapter) => chapter.id !== id);
    set((state) => ({
      chapters: remaining,
      activeChapterId: state.activeChapterId === id ? remaining[0]?.id ?? null : state.activeChapterId,
    }));
    try {
      await api.deleteChapter(id);
      persistSelection(get().selectedBookId, get().activeChapterId);
    } catch (error) {
      set({ chapters: previousChapters, activeChapterId: previousActiveChapterId });
      throw error;
    }
  },

  reorderChapters: async (ids) => {
    const previousChapters = get().chapters;
    const byId = new Map(previousChapters.map((chapter) => [chapter.id, chapter]));
    set({ chapters: ids.map((id, position) => ({ ...byId.get(id)!, position })) });
    const bookId = get().selectedBookId;
    if (bookId !== null) {
      try {
        await api.reorderChapters(bookId, ids);
      } catch (error) {
        set({ chapters: previousChapters });
        throw error;
      }
    }
  },
}));
