import {
  Calendar,
  Download,
  FileCode,
  FileDown,
  FileText,
  Info,
  ListTree,
  Printer,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo } from "react";
import type { Note } from "../lib/types";
import { formatFull } from "../lib/format";
import { exportNoteMarkdown } from "../lib/actions";
import { notify } from "../store/toast";

interface HeadingItem {
  level: number;
  text: string;
  lineIndex: number;
}

export function NoteInspector({
  note,
  content,
  onClose,
  onJumpToLine,
}: {
  note: Note;
  content: string;
  onClose: () => void;
  onJumpToLine?: (lineIndex: number) => void;
}) {
  const stats = useMemo(() => {
    const raw = content.trim();
    if (!raw) {
      return {
        words: 0,
        chars: 0,
        charsNoSpace: 0,
        paragraphs: 0,
        lines: 0,
        readingTimeMin: 0,
        speakingTimeMin: 0,
      };
    }
    const words = (raw.match(/\b\S+\b/g) || []).length;
    const chars = raw.length;
    const charsNoSpace = raw.replace(/\s+/g, "").length;
    const paragraphs = raw.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
    const lines = raw.split("\n").length;
    const readingTimeMin = Math.max(1, Math.ceil(words / 220));
    const speakingTimeMin = Math.max(1, Math.ceil(words / 130));

    return {
      words,
      chars,
      charsNoSpace,
      paragraphs,
      lines,
      readingTimeMin,
      speakingTimeMin,
    };
  }, [content]);

  const headings = useMemo<HeadingItem[]>(() => {
    const lines = content.split("\n");
    const list: HeadingItem[] = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        list.push({
          level: match[1].length,
          text: match[2].trim(),
          lineIndex: index,
        });
      }
    });
    return list;
  }, [content]);

  const exportHtml = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: `${(note.title || "note").replace(/[\\/:*?"<>|]/g, "_")}.html`,
        filters: [{ name: "HTML Document", extensions: ["html"] }],
      });
      if (path) {
        const htmlDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${note.title || "Untitled"}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1d1d1f; line-height: 1.6; }
h1, h2, h3 { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; }
code { background: #f2f2f5; padding: 2px 5px; border-radius: 4px; font-family: ui-monospace, monospace; }
pre { background: #f5f5f7; padding: 14px; border-radius: 8px; overflow-x: auto; }
blockquote { border-left: 3px solid #007aff; margin: 0; padding-left: 14px; color: #555; }
</style>
</head>
<body>
<h1>${note.title || "Untitled"}</h1>
<hr>
<div>${content.replace(/\n/g, "<br>")}</div>
</body>
</html>`;
        await writeTextFile(path, htmlDoc);
        notify("success", "HTML exported", path);
      }
    } catch {
      notify("error", "HTML export failed");
    }
  };

  const exportTxt = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        defaultPath: `${(note.title || "note").replace(/[\\/:*?"<>|]/g, "_")}.txt`,
        filters: [{ name: "Plain Text", extensions: ["txt"] }],
      });
      if (path) {
        await writeTextFile(path, content);
        notify("success", "Text exported", path);
      }
    } catch {
      notify("error", "Text export failed");
    }
  };

  return (
    <aside className="clip-panel" style={{ width: 280, minWidth: 280 }}>
      <div className="clip-header">
        <Info size={14} color="var(--accent)" />
        <h3>Note Inspector</h3>
        <button className="icon-btn" onClick={onClose} title="Close Inspector">
          <X size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 20px" }}>
        {/* Outline / Table of Contents */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            <ListTree size={12} />
            Table of Contents
          </div>
          {headings.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--text-3)", padding: "4px 0" }}>
              No headings found in this note. Use <code># Heading</code> to generate an outline.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {headings.map((h, i) => (
                <button
                  key={i}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "4px 6px",
                    paddingLeft: (h.level - 1) * 12 + 6,
                    fontSize: 12,
                    borderRadius: 5,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => onJumpToLine?.(h.lineIndex)}
                  title={`Jump to line ${h.lineIndex + 1}`}
                >
                  <span style={{ color: "var(--text-3)", marginRight: 4 }}>
                    {"#".repeat(h.level)}
                  </span>
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detailed Stats */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            <Sparkles size={12} />
            Document Statistics
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              background: "var(--surface-2)",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                {stats.words}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Words</div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                {stats.chars}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Characters</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>
                {stats.paragraphs}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Paragraphs</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>
                {stats.lines}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>Lines</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 11.5,
              color: "var(--text-2)",
            }}
          >
            <span>📖 ~{stats.readingTimeMin} min read</span>
            <span>🎙️ ~{stats.speakingTimeMin} min speak</span>
          </div>
        </div>

        {/* Timestamps & Info */}
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            <Calendar size={12} />
            Information
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 5 }}>
            <div>
              <span style={{ color: "var(--text-3)" }}>Created: </span>
              {formatFull(note.created_at)}
            </div>
            <div>
              <span style={{ color: "var(--text-3)" }}>Modified: </span>
              {formatFull(note.updated_at)}
            </div>
            {note.category_name && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "var(--text-3)" }}>Category: </span>
                <span
                  className="category-dot"
                  style={{ width: 7, height: 7, background: note.category_color ?? "#007aff" }}
                />
                <span style={{ fontWeight: 550, color: "var(--text)" }}>{note.category_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Export Actions */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            <Download size={12} />
            Export Note
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              className="btn small"
              style={{ justifyContent: "flex-start" }}
              onClick={() => exportNoteMarkdown(note.title, content)}
            >
              <FileDown size={13} /> Export as Markdown (.md)
            </button>
            <button
              className="btn small"
              style={{ justifyContent: "flex-start" }}
              onClick={exportHtml}
            >
              <FileCode size={13} /> Export as HTML (.html)
            </button>
            <button
              className="btn small"
              style={{ justifyContent: "flex-start" }}
              onClick={exportTxt}
            >
              <FileText size={13} /> Export as Plain Text (.txt)
            </button>
            <button
              className="btn small"
              style={{ justifyContent: "flex-start" }}
              onClick={() => window.print()}
            >
              <Printer size={13} /> Print / Save as PDF…
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
