import { useState } from "react";
import { createRoot } from "react-dom/client";
import { FlaskConical, FolderOpen, Save, X } from "lucide-react";
import { Editor } from "./components/Editor";
import { Toasts } from "./components/Toasts";
import { api } from "./lib/api";
import { createBookStudioCloseHandler } from "./lib/bookStudioClose";
import type { Note } from "./lib/types";
import { useNotes } from "./store/notes";
import { useTabs } from "./store/tabs";
import { useTheme } from "./store/theme";
import { notify } from "./store/toast";
import "./styles.css";

// Never mount App here: no native database, settings reads or clipboard polling.
if (!import.meta.env.DEV) throw new Error("Notes fixtures run only in development.");
const root: ReturnType<typeof createRoot> = import.meta.hot?.data.notesRoot ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.notesRoot = root;
const IDS = [-901, -902];
const assertId = (id: number) => { if (!IDS.includes(id)) throw new Error("Only synthetic note fixtures are allowed."); };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("noteme-notes-preview", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("notes", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readNotes(): Promise<Note[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("notes").objectStore("notes").getAll();
      request.onsuccess = () => resolve(request.result.filter((note: Note) => IDS.includes(note.id)));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
async function writeNote(note: Note) {
  assertId(note.id);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("notes", "readwrite");
      transaction.objectStore("notes").put(note);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Fixture save failed."));
    });
  } finally { db.close(); }
}

function Preview() {
  const tabs = useTabs((state) => state.tabs);
  const active = useTabs((state) => state.activeId);
  const tab = tabs.find((item) => item.id === active);
  const [closed, setClosed] = useState(false);
  const closeWindow = async () => {
    let prevented = false;
    const finish = async () => { useTabs.getState().closeAllTabs(); setClosed(true); };
    const guard = createBookStudioCloseHandler(finish, (error) => notify("error", "Fixture close stayed open", String(error)));
    await guard({ preventDefault: () => { prevented = true; } });
    if (!prevented) await finish();
  };
  const open = (id: number) => { setClosed(false); useTabs.getState().openNote(id, id === -901 ? "Spacing sample" : "Second sample"); };
  return <div className="app">
    <nav className="studio-preview-nav" aria-label="Notes fixture controls">
      <span><FlaskConical size={15} /> Synthetic notes only</span>
      <button onClick={() => open(-901)}><FolderOpen size={14} /> Spacing sample</button>
      <button onClick={() => open(-902)}><FolderOpen size={14} /> Second sample</button>
      <button disabled={!tab} onClick={() => tab && useTabs.getState().closeTab(tab.id)}><X size={14} /> Close tab</button>
      <button onClick={() => void closeWindow()}><Save size={14} /> Simulate window close</button>
    </nav>
    <div className="app-body">{tab ? <Editor noteId={tab.noteId!} tabId={tab.id} /> : <div className="empty-state"><p>{closed ? "Fixture window closed after saving." : "Fixture tab closed."}</p><button onClick={() => open(-901)}>Reopen spacing sample</button></div>}</div>
    <Toasts />
  </div>;
}

async function start() {
  let notes = await readNotes();
  if (!notes.length) {
    const base: Note = { id: -901, title: "Spacing sample", content: "Mock first line\nMock second line\n\n\nMock after two blank rows\n\n**Bold mock text**\nTwo  spaces and\ta tab", category_id: null, category_name: null, category_color: null, pinned: false, favorite: false, archived: false, trashed: false, created_at: "2026-11-22", updated_at: "2026-11-22", tags: [], snippet: "Synthetic spacing fixture" };
    notes = [base, { ...base, id: -902, title: "Second sample", content: "Second mock note\nIndependent spacing\n\nFinal mock line" }];
    for (const note of notes) await writeNote(note);
  }
  api.updateNote = async (id, title, content, categoryId = null) => {
    assertId(id);
    const previous = (await readNotes()).find((note) => note.id === id);
    if (!previous) throw new Error("Synthetic note not found.");
    await writeNote({ ...previous, title, content, category_id: categoryId, updated_at: new Date().toISOString() });
  };
  api.listNotes = readNotes;
  api.getNote = async (id) => { assertId(id); return (await readNotes()).find((note) => note.id === id) ?? null; };
  api.setSetting = async () => {};
  useNotes.setState({ notes, archived: [], trashed: [], categories: [], tags: [], loaded: true, loading: false });
  useTheme.setState({ ready: true, editorMode: "edit", spellcheck: false, soundEffects: false });
  document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark";
  useTabs.getState().openNote(-901, "Spacing sample");
  root.render(<Preview />);
}

void start().catch(() => { document.getElementById("root")!.textContent = "Synthetic notes fixture could not start."; });
