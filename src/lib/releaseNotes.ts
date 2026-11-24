import packageJson from "../../package.json";

export const CURRENT_VERSION = packageJson.version;

export const CURRENT_RELEASE_NOTES = {
  version: CURRENT_VERSION,
  eyebrow: "Release highlights",
  title: "A clearer way into the studio.",
  summary: `NoteMe ${CURRENT_VERSION} makes the first launch more welcoming, the manuscript workflow easier to understand, and portable publishing more confident while keeping your work local.`,
  highlights: [
    {
      icon: "pen",
      title: "A guided first launch",
      detail: "A calm three-step welcome introduces Notes, Books Studio, and publishing with a flat, keyboard-friendly flow.",
    },
    {
      icon: "type",
      title: "Typography you can see",
      detail: "Preview installed families in their actual typeface, including weight, italic, and variable-axis coverage before choosing.",
    },
    {
      icon: "publish",
      title: "Publishing with more confidence",
      detail: "Review export readiness and carry carefully matched typography into HTML, EPUB, and Word when you have permission.",
    },
  ],
} as const;
