import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Clipboard, FilePlus2, StickyNote } from "lucide-react";
import { TitleBar, TabContextMenu } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { ViewTab } from "./components/ViewTab";
import { ClipboardPanel } from "./components/ClipboardPanel";
import { QuickCapture } from "./components/QuickCapture";
import { Palette } from "./components/Palette";
import { Toasts } from "./components/Toasts";
import { SettingsModal } from "./components/Modals";
import { useNotes, openNoteInTab } from "./store/notes";
import { useTabs } from "./store/tabs";
import { useTheme } from "./store/theme";
import { notify } from "./store/toast";

async function exportAllNotes() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const dir = await open({ directory: true, title: "Choose export folder" });
    if (typeof dir !== "string" || !dir) return;
    const s = useNotes.getState();
    const all = [...s.notes, ...s.archived];
    let count = 0;
    for (const n of all) {
      const name = (n.title || "Untitled").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
      try {
        const md = `# ${n.title || "Untitled"}\n\n${n.content}\n\n---\n_Created ${n.created_at} · Updated ${n.updated_at}_`;
        await writeTextFile(`${dir}/${name}.md`, md);
        count++;
      } catch {
        // skip unreadable files
      }
    }
    notify("success", `Exported ${count} notes`, dir);
  } catch {
    notify("error", "Export failed", "Could not write export folder");
  }
}

function EmptyWorkspace() {
  const createNote = useNotes((s) => s.createNote);
  const openHome = useTabs((s) => s.openHome);
  return (
    <div className="empty-state" style={{ flex: 1 }}>
      <div className="empty-icon"><StickyNote size={24} /></div>
      <h3>Welcome to NoteMe</h3>
      <p>Open a note from the sidebar, or start fresh with a new tab.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={() => createNote().then((n) => n && openNoteInTab(n))}>
          <FilePlus2 size={14} /> New Note
        </button>
        <button className="btn" onClick={openHome}>
          <Clipboard size={14} /> Browse All Notes
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const loaded = useNotes((s) => s.loaded);
  const sidebarCollapsed = useTheme((s) => s.sidebarCollapsed);
  const clipboardOpen = useNotes((s) => s.clipboardOpen);
  const toggleClipboardPanel = useNotes((s) => s.toggleClipboardPanel);
  const refresh = useNotes((s) => s.refresh);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activeTab = tabs.find((t) => t.id === activeId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const clipboardWatch = useRef<number | null>(null);
  const lastClip = useRef("");

  useEffect(() => {
    useTheme.getState().init().then(() => {
      useNotes.getState().init();
    });
  }, []);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    listen("notes-changed", () => refresh()).then((u) => unlisteners.push(u));
    listen("clipboard-changed", () => refresh()).then((u) => unlisteners.push(u));
    listen("global-shortcut", (e) => {
      if (e.payload === "toggle-clipboard") toggleClipboardPanel();
    }).then((u) => unlisteners.push(u));
    listen<string>("menu", (e) => {
      switch (e.payload) {
        case "new-note":
          useNotes.getState().createNote().then((n) => n && openNoteInTab(n));
          break;
        case "new-tab":
          useTabs.getState().openHome();
          break;
        case "close-tab":
          useTabs.getState().closeTab(useTabs.getState().activeId ?? "");
          break;
        case "palette":
          window.dispatchEvent(new CustomEvent("open-palette"));
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "toggle-theme":
          useTheme.getState().cycleTheme();
          break;
        case "toggle-sidebar":
          useTheme.getState().toggleSidebar();
          break;
        case "next-tab":
          useTabs.getState().activateRelative(1);
          break;
        case "prev-tab":
          useTabs.getState().activateRelative(-1);
          break;
        case "export-all":
          exportAllNotes();
          break;
      }
    }).then((u) => unlisteners.push(u));
    return () => unlisteners.forEach((u) => u());
  }, []);

  // poll clipboard for changes (cross-platform history capture)
  useEffect(() => {
    clipboardWatch.current = window.setInterval(async () => {
      try {
        const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
        const text = await readText();
        if (text && text.trim() && text !== lastClip.current) {
          lastClip.current = text;
          await useNotes.getState().captureClipboard();
        }
      } catch {
        // clipboard unavailable
      }
    }, 1500);
    return () => {
      if (clipboardWatch.current) window.clearInterval(clipboardWatch.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar collapsed={sidebarCollapsed} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
          {!loaded ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="spinner" />
            </div>
          ) : activeTab ? (
            activeTab.kind === "note" ? (
              <Editor noteId={activeTab.noteId!} tabId={activeTab.id} />
            ) : (
              <ViewTab view={activeTab.view!} title={activeTab.title} />
            )
          ) : (
            <EmptyWorkspace />
          )}
        </div>
        {clipboardOpen && <ClipboardPanel />}
      </div>
      <QuickCapture />
      <Palette />
      <Toasts />
      <TabContextMenu />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
