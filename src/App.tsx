import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { TitleBar, TabContextMenu } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { ViewTab } from "./components/ViewTab";
import { HomeView } from "./components/HomeView";
import { ClipboardPanel } from "./components/ClipboardPanel";
import { QuickCapture } from "./components/QuickCapture";
import { Palette } from "./components/Palette";
import { Toasts } from "./components/Toasts";
import { SettingsModal } from "./components/Modals";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { AboutModal } from "./components/AboutModal";
import { useNotes, openNoteInTab } from "./store/notes";
import { useTabs } from "./store/tabs";
import { useTheme } from "./store/theme";
import { useWorkspace } from "./store/workspace";
import { notify } from "./store/toast";
import { importFilesAsNotes } from "./lib/actions";

const BooksStudio = lazy(() => import("./components/BooksStudio").then(({ BooksStudio: Studio }) => ({ default: Studio })));

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
      const name = (n.title || "Untitled")
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 120);
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

export default function App() {
  const loaded = useNotes((s) => s.loaded);
  const workspace = useWorkspace((s) => s.mode);
  const sidebarCollapsed = useTheme((s) => s.sidebarCollapsed);
  const clipboardOpen = useNotes((s) => s.clipboardOpen);
  const toggleClipboardPanel = useNotes((s) => s.toggleClipboardPanel);
  const refresh = useNotes((s) => s.refresh);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activeTab = tabs.find((t) => t.id === activeId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updatesRequested, setUpdatesRequested] = useState(0);
  const clipboardWatch = useRef<number | null>(null);
  const lastClip = useRef("");
  const pendingFileOpens = useRef<string[]>([]);

  useEffect(() => {
    useWorkspace.getState().init();
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
    listen<string[]>("open-files", (e) => {
      const paths = e.payload;
      if (!Array.isArray(paths) || paths.length === 0) return;
      if (!useNotes.getState().loaded) {
        pendingFileOpens.current.push(...paths);
        return;
      }
      useWorkspace.getState().setMode("notes");
      void importFilesAsNotes(paths);
    }).then((u) => unlisteners.push(u));
    listen<string>("menu", (e) => {
      switch (e.payload) {
        case "new-note":
          useWorkspace.getState().setMode("notes");
          useNotes.getState().createNote().then((n) => n && openNoteInTab(n));
          break;
        case "new-tab":
          useWorkspace.getState().setMode("notes");
          useTabs.getState().openHome();
          break;
        case "workspace-notes":
          useWorkspace.getState().setMode("notes");
          break;
        case "workspace-books":
          useWorkspace.getState().setMode("books");
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
        case "shortcuts":
          setShortcutsOpen(true);
          break;
        case "about":
          setAboutOpen(true);
          break;
        case "check-updates":
          setAboutOpen(true);
          setUpdatesRequested((count) => count + 1);
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
        case "print-note":
          window.print();
          break;
        case "import-files":
          importFilesAsNotes();
          break;
      }
    }).then((u) => unlisteners.push(u));
    return () => unlisteners.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!loaded || pendingFileOpens.current.length === 0) return;
    const paths = pendingFileOpens.current.splice(0);
    useWorkspace.getState().setMode("notes");
    void importFilesAsNotes(paths);
  }, [loaded]);

  // poll clipboard for changes (cross-platform history capture)
  useEffect(() => {
    clipboardWatch.current = window.setInterval(async () => {
      try {
        const { readText } = await import(
          "@tauri-apps/plugin-clipboard-manager"
        );
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
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    const onOpenSettings = () => setSettingsOpen(true);
    const onOpenShortcuts = () => setShortcutsOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-settings", onOpenSettings);
    window.addEventListener("open-shortcuts", onOpenShortcuts);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-settings", onOpenSettings);
      window.removeEventListener("open-shortcuts", onOpenShortcuts);
    };
  }, []);

  // drag & drop import of .md/.txt files anywhere in the app
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      const textFiles = files.filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
      if (textFiles.length === 0) return;
      e.preventDefault();
      const paths = textFiles
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => !!p);
      if (paths.length === 0) {
        notify("info", "Drop images onto the editor to attach them");
        return;
      }
      importFilesAsNotes(paths);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        {workspace === "books" ? (
          <Suspense fallback={<div className="books-loading"><div className="spinner" /><span>Opening Books Studio...</span></div>}>
            <BooksStudio />
          </Suspense>
        ) : (
          <>
            <Sidebar collapsed={sidebarCollapsed} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                background: "var(--bg)",
              }}
            >
              {!loaded ? (
                <div className="empty-state" style={{ flex: 1 }}>
                  <div className="spinner" />
                </div>
              ) : activeTab ? (
                activeTab.kind === "note" ? (
                  <Editor noteId={activeTab.noteId!} tabId={activeTab.id} />
                ) : activeTab.view?.kind === "all" ? (
                  <HomeView />
                ) : (
                  <ViewTab view={activeTab.view!} title={activeTab.title} />
                )
              ) : (
                <HomeView />
              )}
            </div>
            {clipboardOpen && <ClipboardPanel />}
          </>
        )}
      </div>
      {workspace === "notes" && <QuickCapture />}
      {workspace === "notes" && <Palette />}
      <Toasts />
      <TabContextMenu />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      {aboutOpen && (
        <AboutModal
          onClose={() => setAboutOpen(false)}
          autoCheckKey={updatesRequested}
        />
      )}
    </div>
  );
}
