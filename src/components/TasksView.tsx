import { ListChecks, StickyNote } from "lucide-react";
import { useMemo, useState } from "react";
import type { TaskItem } from "../lib/types";
import { useNotes, openNoteInTab } from "../store/notes";
import { playTaskCheck } from "../lib/sounds";

type Filter = "all" | "open" | "done";

export function TasksView() {
  const tasks = useNotes((s) => s.tasks);
  const toggleTask = useNotes((s) => s.toggleTask);
  const [filter, setFilter] = useState<Filter>("open");

  const filtered = useMemo(
    () =>
      tasks.filter((t) =>
        filter === "all" ? true : filter === "open" ? !t.done : t.done
      ),
    [tasks, filter]
  );

  const grouped = useMemo(() => {
    const map = new Map<number, { title: string; items: TaskItem[] }>();
    for (const t of filtered) {
      if (!map.has(t.note_id))
        map.set(t.note_id, { title: t.note_title, items: [] });
      map.get(t.note_id)!.items.push(t);
    }
    return [...map.entries()];
  }, [filtered]);

  const openCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - openCount;

  return (
    <div className="note-list">
      <div className="list-header">
        <span style={{ display: "flex", alignItems: "center" }}>
          <ListChecks size={15} color="var(--indigo)" />
        </span>
        <h2>Tasks</h2>
        <span className="count">
          {openCount} open · {doneCount} done
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        <div className="seg">
          {(["all", "open", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "0 5px",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="tasks-scroll">
        {grouped.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <ListChecks size={24} />
            </div>
            <h3>No tasks {filter !== "all" ? `marked ${filter}` : "found"}</h3>
            <p>
              Type <code>- [ ] task</code> in any note and it will automatically
              appear here.
            </p>
          </div>
        ) : (
          grouped.map(([noteId, group]) => (
            <div key={noteId} className="task-group">
              <button
                className="task-group-title"
                title="Open parent note"
                onClick={() => {
                  const note =
                    useNotes.getState().notes.find((n) => n.id === noteId) ??
                    useNotes.getState().archived.find((n) => n.id === noteId);
                  openNoteInTab(note);
                }}
              >
                <StickyNote size={12} color="var(--accent)" /> {group.title || "Untitled Note"}
              </button>
              {group.items.map((t, i) => (
                <label
                  key={`${t.line_index}-${i}`}
                  className={`task-row ${t.done ? "done" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => {
                      playTaskCheck();
                      toggleTask(t.note_id, t.line_index);
                    }}
                  />
                  <span className="task-text">{t.text}</span>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
