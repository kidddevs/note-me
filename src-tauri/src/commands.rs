use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Emitter, State};

use crate::db::Db;
use crate::models::{AppStats, Category, ClipboardItem, Note, Tag};

fn with_conn<T>(state: &State<Db>, f: impl FnOnce(&mut Connection) -> Result<T, String>) -> Result<T, String> {
    let mut guard = state.0.lock().map_err(|_| "db lock poisoned".to_string())?;
    f(&mut guard)
}

pub fn emit_notes_changed(app: &AppHandle) {
    let _ = app.emit("notes-changed", ());
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        category_id: row.get(3)?,
        category_name: row.get(4)?,
        category_color: row.get(5)?,
        pinned: row.get::<_, i64>(6)? != 0,
        favorite: row.get::<_, i64>(7)? != 0,
        archived: row.get::<_, i64>(8)? != 0,
        trashed: row.get::<_, i64>(9)? != 0,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        tags: Vec::new(),
        snippet: String::new(),
    })
}

const NOTE_SELECT: &str = r#"
    SELECT n.id, n.title, n.content, n.category_id, c.name, c.color,
           n.pinned, n.favorite, n.archived, n.trashed,
           n.created_at, n.updated_at
    FROM notes n
    LEFT JOIN categories c ON c.id = n.category_id
"#;

#[tauri::command]
pub fn list_notes(state: State<Db>) -> Result<Vec<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 WHERE n.trashed = 0 AND n.archived = 0
                 ORDER BY n.pinned DESC, n.updated_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

#[tauri::command]
pub fn list_archived(state: State<Db>) -> Result<Vec<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 WHERE n.trashed = 0 AND n.archived = 1
                 ORDER BY n.updated_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

#[tauri::command]
pub fn list_trashed(state: State<Db>) -> Result<Vec<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 WHERE n.trashed = 1
                 ORDER BY n.trashed_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

#[tauri::command]
pub fn list_favorites(state: State<Db>) -> Result<Vec<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 WHERE n.trashed = 0 AND n.favorite = 1
                 ORDER BY n.updated_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

#[tauri::command]
pub fn notes_by_category(state: State<Db>, category_id: i64) -> Result<Vec<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 WHERE n.trashed = 0 AND n.category_id = ?1
                 ORDER BY n.pinned DESC, n.updated_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![category_id], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

#[tauri::command]
pub fn notes_by_tag(state: State<Db>, tag_id: i64) -> Result<Vec<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 JOIN note_tags nt ON nt.note_id = n.id
                 WHERE n.trashed = 0 AND nt.tag_id = ?1
                 ORDER BY n.updated_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![tag_id], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

#[tauri::command]
pub fn search_notes(state: State<Db>, query: String) -> Result<Vec<Note>, String> {
    let q = format!("%{}%", query.trim());
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{NOTE_SELECT}
                 WHERE n.trashed = 0
                   AND (n.title LIKE ?1 OR n.content LIKE ?1)
                 ORDER BY CASE
                    WHEN n.title LIKE ?1 THEN 0
                    ELSE 1 END, n.updated_at DESC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![q], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);
        Ok(fill_tags(conn, rows)?)
    })
}

fn fill_tags(conn: &mut Connection, mut notes: Vec<Note>) -> Result<Vec<Note>, String> {
    for note in notes.iter_mut() {
        note.tags = get_note_tags(conn, note.id)?;
        note.snippet = note
            .content
            .chars()
            .filter(|c| !c.is_whitespace())
            .take(200)
            .collect();
    }
    Ok(notes)
}

fn get_note_tags(conn: &Connection, note_id: i64) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color, COUNT(nt2.note_id)
             FROM tags t
             JOIN note_tags nt ON nt.tag_id = t.id
             LEFT JOIN note_tags nt2 ON nt2.tag_id = t.id AND nt2.note_id != ?1
             WHERE nt.note_id = ?1
             GROUP BY t.id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![note_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                note_count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn get_note(state: State<Db>, id: i64) -> Result<Option<Note>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!("{NOTE_SELECT} WHERE n.id = ?1"))
            .map_err(|e| e.to_string())?;
        let mut note = stmt
            .query_row(params![id], row_to_note)
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(n) = note.as_mut() {
            n.tags = get_note_tags(conn, id)?;
            n.snippet = n
                .content
                .chars()
                .filter(|c| !c.is_whitespace())
                .take(200)
                .collect();
        }
        Ok(note)
    })
}

#[tauri::command]
pub fn create_note(
    app: AppHandle,
    state: State<Db>,
    title: String,
    content: String,
    category_id: Option<i64>,
) -> Result<Note, String> {
    let id = with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO notes (title, content, category_id) VALUES (?1, ?2, ?3)",
            params![title, content, category_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })?;
    emit_notes_changed(&app);
    let note = get_note(state, id)?.ok_or("note not found")?;
    Ok(note)
}

#[tauri::command]
pub fn update_note(
    app: AppHandle,
    state: State<Db>,
    id: i64,
    title: String,
    content: String,
    category_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET title = ?1, content = ?2, category_id = ?3,
             updated_at = datetime('now') WHERE id = ?4",
            params![title, content, category_id, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_note_category(
    app: AppHandle,
    state: State<Db>,
    id: i64,
    category_id: Option<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET category_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![category_id, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn toggle_pin(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET pinned = 1 - pinned, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn toggle_favorite(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET favorite = 1 - favorite, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn toggle_archive(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET archived = 1 - archived, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn trash_note(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET trashed = 1, trashed_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn restore_note(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET trashed = 0, trashed_at = NULL WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn delete_note_forever(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn empty_trash(app: AppHandle, state: State<Db>) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM notes WHERE trashed = 1", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    emit_notes_changed(&app);
    Ok(())
}

// ---------- categories ----------

#[tauri::command]
pub fn list_categories(state: State<Db>) -> Result<Vec<Category>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.color, c.icon, c.sort_order, c.created_at,
                        (SELECT COUNT(*) FROM notes n
                         WHERE n.category_id = c.id AND n.trashed = 0 AND n.archived = 0)
                 FROM categories c
                 ORDER BY c.sort_order, c.name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    icon: row.get(3)?,
                    sort_order: row.get(4)?,
                    created_at: row.get(5)?,
                    note_count: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    })
}

#[tauri::command]
pub fn create_category(
    app: AppHandle,
    state: State<Db>,
    name: String,
    color: String,
    icon: String,
) -> Result<i64, String> {
    let max = with_conn(&state, |conn| {
        let next: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO categories (name, color, icon, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![name, color, icon, next],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })?;
    let _ = app.emit("categories-changed", ());
    Ok(max)
}

#[tauri::command]
pub fn update_category(
    app: AppHandle,
    state: State<Db>,
    id: i64,
    name: String,
    color: String,
    icon: String,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE categories SET name = ?1, color = ?2, icon = ?3 WHERE id = ?4",
            params![name, color, icon, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    let _ = app.emit("categories-changed", ());
    Ok(())
}

#[tauri::command]
pub fn delete_category(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE notes SET category_id = NULL WHERE category_id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM categories WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    let _ = app.emit("categories-changed", ());
    emit_notes_changed(&app);
    Ok(())
}

// ---------- tags ----------

#[tauri::command]
pub fn list_tags(state: State<Db>) -> Result<Vec<Tag>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT t.id, t.name, t.color,
                        (SELECT COUNT(*) FROM note_tags nt
                         JOIN notes n ON n.id = nt.note_id
                         WHERE nt.tag_id = t.id AND n.trashed = 0)
                 FROM tags t
                 ORDER BY t.name",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Tag {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    note_count: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    })
}

#[tauri::command]
pub fn create_tag(app: AppHandle, state: State<Db>, name: String, color: String) -> Result<i64, String> {
    let id = with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO tags (name, color) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET color = excluded.color",
            params![name, color],
        )
        .map_err(|e| e.to_string())?;
        conn.query_row("SELECT id FROM tags WHERE name = ?1", params![name], |r| r.get(0))
            .map_err(|e| e.to_string())
    })?;
    let _ = app.emit("tags-changed", ());
    Ok(id)
}

#[tauri::command]
pub fn delete_tag(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    let _ = app.emit("tags-changed", ());
    emit_notes_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_note_tags(
    app: AppHandle,
    state: State<Db>,
    note_id: i64,
    tag_ids: Vec<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "DELETE FROM note_tags WHERE note_id = ?1",
            params![note_id],
        )
        .map_err(|e| e.to_string())?;
        for tid in tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
                params![note_id, tid],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    })?;
    let _ = app.emit("tags-changed", ());
    emit_notes_changed(&app);
    Ok(())
}

// ---------- clipboard ----------

#[tauri::command]
pub fn list_clipboard_items(state: State<Db>, limit: i64) -> Result<Vec<ClipboardItem>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, kind, content, created_at FROM clipboard_items ORDER BY id DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(ClipboardItem {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    })
}

#[tauri::command]
pub fn save_clipboard_item(
    app: AppHandle,
    state: State<Db>,
    content: String,
) -> Result<i64, String> {
    let trimmed = content.trim().to_string();
    if trimmed.is_empty() {
        return Ok(-1);
    }
    let id = with_conn(&state, |conn| {
        let dup: Option<i64> = conn
            .query_row(
                "SELECT id FROM clipboard_items WHERE content = ?1 ORDER BY id DESC LIMIT 1",
                params![trimmed],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(existing) = dup {
            conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![existing])
                .map_err(|e| e.to_string())?;
        }
        conn.execute(
            "INSERT INTO clipboard_items (kind, content) VALUES ('text', ?1)",
            params![trimmed],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })?;
    let _ = app.emit("clipboard-changed", ());
    Ok(id)
}

#[tauri::command]
pub fn delete_clipboard_item(app: AppHandle, state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    })?;
    let _ = app.emit("clipboard-changed", ());
    Ok(())
}

#[tauri::command]
pub fn clear_clipboard_history(app: AppHandle, state: State<Db>) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute("DELETE FROM clipboard_items", []).map_err(|e| e.to_string())?;
        Ok(())
    })?;
    let _ = app.emit("clipboard-changed", ());
    Ok(())
}

// ---------- settings ----------

#[tauri::command]
pub fn get_setting(state: State<Db>, key: String) -> Result<Option<String>, String> {
    with_conn(&state, |conn| {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn set_setting(state: State<Db>, key: String, value: String) -> Result<(), String> {
    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

// ---------- stats ----------

#[tauri::command]
pub fn app_stats(state: State<Db>) -> Result<AppStats, String> {
    with_conn(&state, |conn| {
        Ok(AppStats {
            total_notes: conn
                .query_row(
                    "SELECT COUNT(*) FROM notes WHERE trashed = 0",
                    [],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?,
            favorites: conn
                .query_row(
                    "SELECT COUNT(*) FROM notes WHERE trashed = 0 AND favorite = 1",
                    [],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?,
            trashed: conn
                .query_row("SELECT COUNT(*) FROM notes WHERE trashed = 1", [], |r| r.get(0))
                .map_err(|e| e.to_string())?,
        })
    })
}
