import type { Note } from "./types";
import { useNotes } from "../store/notes";
import { useTabs } from "../store/tabs";
import { notify } from "../store/toast";

export async function duplicateNote(note: Note) {
  const copy = await useNotes
    .getState()
    .createNote(`${note.title || "Untitled"} (copy)`, note.content, note.category_id);
  if (copy) useTabs.getState().openNote(copy.id, copy.title || "Untitled", false);
  return copy;
}

export async function copyText(text: string, message = "Copied to clipboard") {
  try {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    await useNotes.getState().captureClipboard();
    notify("success", message);
  } catch {
    notify("error", "Copy failed");
  }
}

export async function exportNoteMarkdown(title: string, content: string) {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: `${(title || "note").replace(/[\\/:*?"<>|]/g, "_")}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (path) {
      await writeTextFile(path, content);
      notify("success", "Note exported", path);
    }
  } catch {
    notify("error", "Export failed");
  }
}

export function todayString(): string {
  return new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function isoDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const TEMPLATES: Record<string, { title: () => string; content: () => string; label: string }> = {
  daily: {
    label: "Daily Note",
    title: () => `Daily — ${isoDate()}`,
    content: () =>
      `# ${todayString()}\n\n## Focus\n- \n\n## Tasks\n- [ ] \n\n## Notes\n\n`,
  },
  meeting: {
    label: "Meeting Notes",
    title: () => `Meeting — ${isoDate()}`,
    content: () =>
      `# Meeting — ${todayString()}\n\n**Attendees:** \n\n## Agenda\n\n## Discussion\n\n## Action Items\n- [ ] \n`,
  },
  journal: {
    label: "Journal Entry",
    title: () => `Journal — ${isoDate()}`,
    content: () =>
      `# ${todayString()}\n\n**Mood:** \n\n## Highlights\n- \n\n## Thoughts\n\n`,
  },
};

export async function createFromTemplate(key: keyof typeof TEMPLATES) {
  const t = TEMPLATES[key];
  if (!t) return;
  // reuse today's daily note if it already exists
  if (key === "daily") {
    const existing = useNotes.getState().notes.find((n) => n.title === t.title());
    if (existing) {
      useTabs.getState().openNote(existing.id, existing.title, existing.pinned);
      notify("info", "Today's daily note already exists", "Opened it for you");
      return;
    }
  }
  const note = await useNotes.getState().createNote(t.title(), t.content());
  if (note) useTabs.getState().openNote(note.id, note.title || t.label, false);
}

export async function importFilesAsNotes(paths?: string[]) {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    let selected = paths;
    if (!selected) {
      selected = ((await open({
        multiple: true,
        filters: [{ name: "Markdown / Text", extensions: ["md", "markdown", "txt"] }],
      })) as string[] | null) ?? undefined;
    }
    if (!selected || selected.length === 0) return;
    let count = 0;
    for (const p of selected) {
      try {
        const content = await readTextFile(p);
        const base = p.split("/").pop() ?? "Imported note";
        const title = base.replace(/\.(md|markdown|txt)$/i, "");
        const note = await useNotes.getState().createNote(title, content);
        count++;
        if (note && count <= 3) useTabs.getState().openNote(note.id, note.title, false);
      } catch {
        // skip unreadable file
      }
    }
    notify("success", `Imported ${count} ${count === 1 ? "note" : "notes"}`);
  } catch {
    notify("error", "Import failed");
  }
}
