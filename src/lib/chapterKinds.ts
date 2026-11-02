import type { ChapterKind } from "./types";

export interface ChapterKindOption {
  value: ChapterKind;
  label: string;
  group: "front" | "story" | "back";
}

/**
 * The section vocabulary is intentionally broader than a novel's. Magazines,
 * newsletters, and photo books share the same manuscript engine, so the type
 * list carries their cover, masthead, feature, department, and listing pages.
 */
export const CHAPTER_KIND_OPTIONS: ChapterKindOption[] = [
  { value: "title_page", label: "Title page", group: "front" },
  { value: "cover", label: "Cover", group: "front" },
  { value: "masthead", label: "Masthead", group: "front" },
  { value: "contents_page", label: "Contents page", group: "front" },
  { value: "dedication", label: "Dedication", group: "front" },
  { value: "epigraph", label: "Epigraph", group: "front" },
  { value: "copyright", label: "Copyright", group: "front" },
  { value: "editorial", label: "Editor's letter", group: "story" },
  { value: "prologue", label: "Prologue", group: "story" },
  { value: "chapter", label: "Chapter", group: "story" },
  { value: "feature", label: "Feature", group: "story" },
  { value: "department", label: "Department", group: "story" },
  { value: "column", label: "Column", group: "story" },
  { value: "profile", label: "Profile", group: "story" },
  { value: "interview", label: "Interview", group: "story" },
  { value: "review", label: "Review", group: "story" },
  { value: "photo_essay", label: "Photo essay", group: "story" },
  { value: "recipe", label: "Recipe", group: "story" },
  { value: "listing", label: "Listing", group: "story" },
  { value: "interlude", label: "Interlude", group: "story" },
  { value: "appendix", label: "Appendix", group: "back" },
  { value: "acknowledgements", label: "Acknowledgements", group: "back" },
  { value: "about_author", label: "About the author", group: "back" },
  { value: "advertisement", label: "Advertisement", group: "back" },
  { value: "colophon", label: "Colophon", group: "back" },
];

export function chapterKindLabel(kind: string) {
  return CHAPTER_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? "Chapter";
}

export function chapterGroup(kind: ChapterKind) {
  return CHAPTER_KIND_OPTIONS.find((option) => option.value === kind)?.group ?? "story";
}

export function chapterIsOpeningPage(kind: ChapterKind) {
  return kind === "title_page" || kind === "cover";
}

export function chapterIsStoryKind(kind: ChapterKind) {
  return chapterGroup(kind) === "story";
}
