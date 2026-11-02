import {
  BOOK_PAPER_PRESETS,
  DEFAULT_BOOK_LAYOUT,
  paperPresetLayout,
  serializeBookLayout,
  type BookPaperPreset,
} from "./bookLayout";
import type { BookInput, ChapterKind } from "./types";

export type BookTemplateId = "novel" | "nonfiction" | "magazine" | "newsletter" | "photo-book" | "recipe-book";

export type BookTemplateIcon = "novel" | "nonfiction" | "magazine" | "newsletter" | "photo" | "recipe";

export interface BookTemplateChapter {
  kind: ChapterKind;
  title: string;
  content: string;
}

export interface BookTemplate {
  id: BookTemplateId;
  label: string;
  description: string;
  icon: BookTemplateIcon;
  title: string;
  genre: string;
  descriptionText: string;
  trimSize: string;
  presetId: string;
  wordGoal: number;
  tocTitle: string;
  tocEnabled: boolean;
  coverColor: string;
  chapters: BookTemplateChapter[];
}

const MAGAZINE_BODY = `A magazine begins with a point of view. This starter issue gives you a cover, masthead, editor's letter, feature well, and a department to shape around your own work.

Use the section rail to add interviews, profiles, reviews, photo essays, recipes, listings, and advertisements. Every page shares the same trim size, but each section can carry its own canvas objects and paragraph styles.`;

export const BOOK_TEMPLATES: BookTemplate[] = [
  {
    id: "novel",
    label: "Novel",
    description: "A title page and first chapter at standard 6 × 9 trade size.",
    icon: "novel",
    title: "Untitled novel",
    genre: "Literary fiction",
    descriptionText: "A first draft of a long-form work.",
    trimSize: "6x9",
    presetId: "manuscript",
    wordGoal: 80000,
    tocTitle: "Contents",
    tocEnabled: true,
    coverColor: "#a56b3e",
    chapters: [
      { kind: "title_page", title: "Untitled novel", content: "A novel\n\nby Your Name" },
      { kind: "chapter", title: "Chapter 1", content: "Begin here. Write the first image that arrives, then follow it.\n\n" },
    ],
  },
  {
    id: "nonfiction",
    label: "Nonfiction",
    description: "An introduction and chapter structure for essays or reportage.",
    icon: "nonfiction",
    title: "Untitled nonfiction",
    genre: "Nonfiction",
    descriptionText: "A book-length argument or narrative.",
    trimSize: "6x9",
    presetId: "manuscript",
    wordGoal: 60000,
    tocTitle: "Contents",
    tocEnabled: true,
    coverColor: "#356b5b",
    chapters: [
      { kind: "title_page", title: "Untitled nonfiction", content: "A nonfiction book\n\nby Your Name" },
      { kind: "chapter", title: "Introduction", content: "Open with the question that made this book necessary.\n\n" },
      { kind: "chapter", title: "Chapter 1", content: "Build the first movement of the argument.\n\n" },
    ],
  },
  {
    id: "magazine",
    label: "Magazine issue",
    description: "Cover, masthead, editor's letter, feature well, and department at newsstand size.",
    icon: "magazine",
    title: "Untitled magazine",
    genre: "Independent magazine",
    descriptionText: "An editorial issue with a feature well and front-of-book.",
    trimSize: "8.5x11",
    presetId: "magazine",
    wordGoal: 12000,
    tocTitle: "In this issue",
    tocEnabled: true,
    coverColor: "#b04a31",
    chapters: [
      {
        kind: "cover",
        title: "The Slow Issue",
        content: "Issue 04 · Summer 2026\n\nThe quiet craft of paying attention.\n\n**On the cover:** North light, 6:40 a.m.",
      },
      {
        kind: "masthead",
        title: "Masthead",
        content: "**Editor & publisher** — Your Name\n\n**Art direction** — Your Name\n\n**Contributing editors** — Add your team\n\n**Contact** — hello@example.com\n\nPublished independently. Printed with care.",
      },
      {
        kind: "editorial",
        title: "A case for slow looking",
        content: "Some issues begin with a question. This one begins with a pause.\n\nWe spent the season looking at ordinary things for longer than usual: a kitchen window, a bus shelter, the last of the light on a tiled floor. The pieces that follow are the result.\n\nThank you for reading slowly.\n\n— The editor",
      },
      {
        kind: "feature",
        title: "The Shape of a City",
        content: MAGAZINE_BODY,
      },
      {
        kind: "department",
        title: "Field Notes",
        content: "A recurring department for short observations, places, objects, and conversations.\n\nKeep it close to the magazine's voice and let each issue accumulate into a world.",
      },
      {
        kind: "colophon",
        title: "Colophon",
        content: "Set in your chosen editorial typeface. Printed in small runs, kept for a long time.\n\nThank you to every contributor, reader, and stockist who made this issue possible.",
      },
    ],
  },
  {
    id: "newsletter",
    label: "Newsletter",
    description: "A masthead, lead story, department, and listing page for a client or community.",
    icon: "newsletter",
    title: "Untitled newsletter",
    genre: "Newsletter",
    descriptionText: "A periodic bulletin with a lead story and notices.",
    trimSize: "8.5x11",
    presetId: "newsletter",
    wordGoal: 3000,
    tocTitle: "Inside",
    tocEnabled: true,
    coverColor: "#356b5b",
    chapters: [
      { kind: "masthead", title: "Masthead", content: "**Published by** — Your organisation\n\n**Editor** — Your Name\n\n**Frequency** — Monthly" },
      { kind: "feature", title: "Lead story", content: "Open with the most useful thing you learned or made this month.\n\nKeep the lead generous and practical, then close with what happens next." },
      { kind: "department", title: "Department", content: "A regular section for people, projects, and short updates." },
      { kind: "listing", title: "Notices", content: "**Upcoming** — Add events, deadlines, and opportunities.\n\n**New** — Add launches, releases, and links.\n\n**Contact** — Tell readers how to reach you." },
      { kind: "colophon", title: "Colophon", content: "Thanks for reading. Forward this issue to someone who would find it useful." },
    ],
  },
  {
    id: "photo-book",
    label: "Photo book",
    description: "A 9 × 12 portfolio with title page, photo essays, and colophon.",
    icon: "photo",
    title: "Untitled photo book",
    genre: "Photography",
    descriptionText: "A sequence of visual essays and plates.",
    trimSize: "9x12",
    presetId: "lookbook",
    wordGoal: 2000,
    tocTitle: "Plates",
    tocEnabled: true,
    coverColor: "#29231e",
    chapters: [
      { kind: "title_page", title: "Untitled photo book", content: "Photographs by Your Name" },
      { kind: "photo_essay", title: "Rooms in Light", content: "Add photographs, captions, and short passages. Use Design canvas to place full-bleed plates and text frames." },
      { kind: "photo_essay", title: "Coastline", content: "A second visual sequence. Let the edit carry the argument." },
      { kind: "colophon", title: "Colophon", content: "Made with NoteMe. Printed on uncoated paper." },
    ],
  },
  {
    id: "recipe-book",
    label: "Recipe book",
    description: "An 8 × 10 recipe collection with full-page recipes and a colophon.",
    icon: "recipe",
    title: "Untitled recipe book",
    genre: "Cookbook",
    descriptionText: "A collection of recipes, notes, and seasonal ingredients.",
    trimSize: "8x10",
    presetId: "recipe",
    wordGoal: 10000,
    tocTitle: "Recipes",
    tocEnabled: true,
    coverColor: "#b04a31",
    chapters: [
      { kind: "title_page", title: "Untitled recipe book", content: "Recipes and notes by Your Name" },
      { kind: "recipe", title: "Tomato season", content: "**Serves 4**\n\nA dish for the weeks when tomatoes are better than almost anything else.\n\n**Ingredients**\n\n- Ripe tomatoes\n- Good olive oil\n- Salt, pepper, and a little vinegar\n\n**Method**\n\n1. Slice the tomatoes and season them early.\n2. Let them sit until they release their juices.\n3. Finish with oil, vinegar, and torn herbs." },
      { kind: "recipe", title: "Bread, patience", content: "A recipe that rewards waiting.\n\nWrite the method in short, calm steps. Keep ingredients and quantities easy to scan." },
      { kind: "colophon", title: "Colophon", content: "A note on the kitchen, the season, and the people who shared the table." },
    ],
  },
];

export function bookTemplate(id: BookTemplateId): BookTemplate {
  return BOOK_TEMPLATES.find((template) => template.id === id) ?? BOOK_TEMPLATES[0];
}

function presetFor(id: string): BookPaperPreset | undefined {
  return BOOK_PAPER_PRESETS.find((preset) => preset.id === id);
}

export function bookTemplateLayout(template: BookTemplate) {
  const preset = presetFor(template.presetId);
  const layout = preset ? paperPresetLayout(DEFAULT_BOOK_LAYOUT, preset) : DEFAULT_BOOK_LAYOUT;
  return {
    ...layout,
    pageMargins: preset ? { top: preset.margin, right: preset.margin, bottom: preset.margin, left: preset.margin } : layout.pageMargins,
  };
}

export function bookTemplateInput(template: BookTemplate, title?: string): BookInput {
  const layout = bookTemplateLayout(template);
  const preset = presetFor(template.presetId);
  return {
    title: title?.trim() || template.title,
    subtitle: "",
    author: "",
    description: template.descriptionText,
    genre: template.genre,
    status: "draft",
    trimSize: template.trimSize,
    fontFamily: preset?.fontFamily ?? "serif",
    fontSize: preset?.fontSize ?? 12,
    lineHeight: preset?.lineHeight ?? 1.5,
    paragraphSpacing: preset?.paragraphSpacing ?? 0,
    margin: preset?.margin ?? 1,
    wordGoal: template.wordGoal,
    coverColor: template.coverColor,
    dedication: "",
    epigraph: "",
    copyrightText: "",
    acknowledgements: "",
    tocEnabled: template.tocEnabled,
    tocTitle: template.tocTitle,
    tocDepth: 3,
    tocIncludeFrontMatter: false,
    tocIncludeBackMatter: false,
    layoutJson: serializeBookLayout(layout),
  };
}
