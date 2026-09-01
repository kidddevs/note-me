export const SELECTED_BOOK_SETTING = "books.selectedBookId";
export const LEGACY_ACTIVE_CHAPTER_SETTING = "books.activeChapterId";

export function activeChapterSetting(bookId: number) {
  return `${LEGACY_ACTIVE_CHAPTER_SETTING}.${bookId}`;
}

export function storedEntityId(value: string | null) {
  if (!value) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function rememberedChapterId(chapters: { id: number }[], perBookValue: string | null, legacyValue: string | null = null) {
  const remembered = storedEntityId(perBookValue) ?? storedEntityId(legacyValue);
  return chapters.some((chapter) => chapter.id === remembered)
    ? remembered
    : chapters[0]?.id ?? null;
}
