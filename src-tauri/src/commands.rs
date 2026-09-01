use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::Db;
use crate::models::{AppStats, Book, Category, Chapter, ClipboardItem, Note, Tag, TaskItem};

fn with_conn<T>(
    state: &State<Db>,
    f: impl FnOnce(&mut Connection) -> Result<T, String>,
) -> Result<T, String> {
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

// ---------- books ----------

const BOOK_STATUSES: [&str; 4] = ["draft", "revising", "ready", "published"];
const BOOK_TRIM_SIZES: [&str; 6] = ["5x8", "5.25x8", "6x9", "5.83x8.27", "8.27x11.69", "8.5x11"];
const BOOK_FONT_FAMILIES: [&str; 4] = ["serif", "humanist", "sans", "mono"];
const CHAPTER_KINDS: [&str; 10] = [
    "title_page",
    "dedication",
    "epigraph",
    "copyright",
    "prologue",
    "chapter",
    "interlude",
    "appendix",
    "acknowledgements",
    "about_author",
];

fn validate_text_length(label: &str, value: &str, maximum: usize) -> Result<(), String> {
    if value.chars().count() > maximum {
        return Err(format!(
            "{label} is too long (maximum {maximum} characters)"
        ));
    }
    Ok(())
}

fn validate_book_fields(
    title: &str,
    subtitle: &str,
    author: &str,
    description: &str,
    genre: &str,
    status: &str,
    trim_size: &str,
    font_family: &str,
    font_size: f64,
    line_height: f64,
    paragraph_spacing: f64,
    margin: f64,
    word_goal: i64,
    cover_color: &str,
    toc_title: &str,
    toc_depth: i64,
    layout_json: &str,
) -> Result<(), String> {
    validate_text_length("title", title, 500)?;
    validate_text_length("subtitle", subtitle, 1_000)?;
    validate_text_length("author", author, 500)?;
    validate_text_length("description", description, 100_000)?;
    validate_text_length("genre", genre, 250)?;
    validate_text_length("contents title", toc_title, 500)?;
    if !BOOK_STATUSES.contains(&status) {
        return Err("invalid book status".to_string());
    }
    if !BOOK_TRIM_SIZES.contains(&trim_size) {
        return Err("invalid trim size".to_string());
    }
    if !BOOK_FONT_FAMILIES.contains(&font_family) {
        return Err("invalid book font family".to_string());
    }
    if !font_size.is_finite() || !(6.0..=96.0).contains(&font_size) {
        return Err("font size must be between 6 and 96 points".to_string());
    }
    if !line_height.is_finite() || !(0.8..=3.0).contains(&line_height) {
        return Err("line height must be between 0.8 and 3".to_string());
    }
    if !paragraph_spacing.is_finite() || !(0.0..=4.0).contains(&paragraph_spacing) {
        return Err("paragraph spacing must be between 0 and 4".to_string());
    }
    if !margin.is_finite() || !(0.25..=3.0).contains(&margin) {
        return Err("page margin must be between 0.25 and 3 inches".to_string());
    }
    if !(100..=1_000_000).contains(&word_goal) {
        return Err("word goal must be between 100 and 1000000".to_string());
    }
    if cover_color.len() != 7
        || !cover_color.starts_with('#')
        || !cover_color[1..]
            .bytes()
            .all(|value| value.is_ascii_hexdigit())
    {
        return Err("cover color must be a six-digit hex color".to_string());
    }
    if !(0..=6).contains(&toc_depth) {
        return Err("contents depth must be between 0 and 6".to_string());
    }
    let layout = serde_json::from_str::<serde_json::Value>(layout_json)
        .map_err(|_| "book layout must be valid JSON".to_string())?;
    if !layout.is_object() {
        return Err("book layout must be a JSON object".to_string());
    }
    Ok(())
}

fn normalize_heading_exclusions(mut exclusions: Vec<String>) -> Result<Vec<String>, String> {
    if exclusions.len() > 500 {
        return Err("too many contents heading exclusions".to_string());
    }
    exclusions.retain(|key| !key.is_empty());
    if exclusions.iter().any(|key| key.chars().count() > 500) {
        return Err("contents heading exclusion is too long".to_string());
    }
    exclusions.sort_unstable();
    exclusions.dedup();
    Ok(exclusions)
}

fn validate_chapter_fields(chapter_kind: &str, title: &str) -> Result<(), String> {
    if !CHAPTER_KINDS.contains(&chapter_kind) {
        return Err("invalid section type".to_string());
    }
    validate_text_length("section title", title, 500)
}

const BOOK_SELECT: &str = r#"
    SELECT id, title, subtitle, author, description, genre, status,
           trim_size, font_family, font_size, line_height,
           paragraph_spacing, margin, word_goal, cover_color, dedication,
           epigraph, copyright_text, acknowledgements, toc_enabled, toc_title,
           toc_depth, toc_include_front_matter, toc_include_back_matter,
           layout_json, created_at, updated_at
    FROM books
"#;

fn row_to_book(row: &rusqlite::Row) -> rusqlite::Result<Book> {
    Ok(Book {
        id: row.get(0)?,
        title: row.get(1)?,
        subtitle: row.get(2)?,
        author: row.get(3)?,
        description: row.get(4)?,
        genre: row.get(5)?,
        status: row.get(6)?,
        trim_size: row.get(7)?,
        font_family: row.get(8)?,
        font_size: row.get(9)?,
        line_height: row.get(10)?,
        paragraph_spacing: row.get(11)?,
        margin: row.get(12)?,
        word_goal: row.get(13)?,
        cover_color: row.get(14)?,
        dedication: row.get(15)?,
        epigraph: row.get(16)?,
        copyright_text: row.get(17)?,
        acknowledgements: row.get(18)?,
        toc_enabled: row.get(19)?,
        toc_title: row.get(20)?,
        toc_depth: row.get(21)?,
        toc_include_front_matter: row.get(22)?,
        toc_include_back_matter: row.get(23)?,
        layout_json: row.get(24)?,
        created_at: row.get(25)?,
        updated_at: row.get(26)?,
    })
}

const CHAPTER_SELECT: &str = r#"
    SELECT id, book_id, chapter_kind, title, content, position, toc_include,
           toc_heading_exclusions, created_at, updated_at
    FROM book_chapters
"#;

fn parse_heading_exclusions(value: String) -> Vec<String> {
    let mut exclusions = serde_json::from_str::<Vec<String>>(&value).unwrap_or_default();
    exclusions.retain(|key| !key.is_empty());
    exclusions.sort_unstable();
    exclusions.dedup();
    exclusions
}

fn row_to_chapter(row: &rusqlite::Row) -> rusqlite::Result<Chapter> {
    Ok(Chapter {
        id: row.get(0)?,
        book_id: row.get(1)?,
        chapter_kind: row.get(2)?,
        title: row.get(3)?,
        content: row.get(4)?,
        position: row.get(5)?,
        toc_include: row.get(6)?,
        toc_heading_exclusions: parse_heading_exclusions(row.get(7)?),
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

#[tauri::command]
pub fn list_books(state: State<Db>) -> Result<Vec<Book>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!("{BOOK_SELECT} ORDER BY updated_at DESC, id DESC"))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_book)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    })
}

#[tauri::command]
pub fn get_book(state: State<Db>, id: i64) -> Result<Option<Book>, String> {
    with_conn(&state, |conn| {
        conn.query_row(
            &format!("{BOOK_SELECT} WHERE id = ?1"),
            params![id],
            row_to_book,
        )
        .optional()
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn create_book(
    state: State<Db>,
    title: String,
    subtitle: String,
    author: String,
    description: String,
    genre: String,
    status: String,
    trim_size: String,
    font_family: String,
    font_size: f64,
    line_height: f64,
    paragraph_spacing: f64,
    margin: f64,
    word_goal: i64,
    cover_color: String,
    dedication: String,
    epigraph: String,
    copyright_text: String,
    acknowledgements: String,
    toc_enabled: bool,
    toc_title: String,
    toc_depth: i64,
    toc_include_front_matter: bool,
    toc_include_back_matter: bool,
    layout_json: String,
) -> Result<Book, String> {
    validate_book_fields(
        &title,
        &subtitle,
        &author,
        &description,
        &genre,
        &status,
        &trim_size,
        &font_family,
        font_size,
        line_height,
        paragraph_spacing,
        margin,
        word_goal,
        &cover_color,
        &toc_title,
        toc_depth,
        &layout_json,
    )?;
    let id = with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO books (
                 title, subtitle, author, description, genre, status, trim_size,
                 font_family, font_size, line_height, paragraph_spacing, margin,
                 word_goal, cover_color, dedication, epigraph, copyright_text,
                   acknowledgements, toc_enabled, toc_title, toc_depth,
                   toc_include_front_matter, toc_include_back_matter, layout_json
               ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                         ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            params![
                title,
                subtitle,
                author,
                description,
                genre,
                status,
                trim_size,
                font_family,
                font_size,
                line_height,
                paragraph_spacing,
                margin,
                word_goal,
                cover_color,
                dedication,
                epigraph,
                copyright_text,
                acknowledgements,
                toc_enabled,
                toc_title,
                toc_depth,
                toc_include_front_matter,
                toc_include_back_matter,
                layout_json,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })?;

    get_book(state, id)?.ok_or_else(|| "book not found after create".to_string())
}

#[tauri::command]
pub fn update_book(
    state: State<Db>,
    id: i64,
    title: String,
    subtitle: String,
    author: String,
    description: String,
    genre: String,
    status: String,
    trim_size: String,
    font_family: String,
    font_size: f64,
    line_height: f64,
    paragraph_spacing: f64,
    margin: f64,
    word_goal: i64,
    cover_color: String,
    dedication: String,
    epigraph: String,
    copyright_text: String,
    acknowledgements: String,
    toc_enabled: bool,
    toc_title: String,
    toc_depth: i64,
    toc_include_front_matter: bool,
    toc_include_back_matter: bool,
    layout_json: String,
) -> Result<(), String> {
    validate_book_fields(
        &title,
        &subtitle,
        &author,
        &description,
        &genre,
        &status,
        &trim_size,
        &font_family,
        font_size,
        line_height,
        paragraph_spacing,
        margin,
        word_goal,
        &cover_color,
        &toc_title,
        toc_depth,
        &layout_json,
    )?;
    with_conn(&state, |conn| {
        let updated = conn
            .execute(
                "UPDATE books SET
                 title = ?1, subtitle = ?2, author = ?3, description = ?4,
                  genre = ?5, status = ?6, trim_size = ?7, font_family = ?8,
                  font_size = ?9, line_height = ?10, paragraph_spacing = ?11,
                  margin = ?12, word_goal = ?13, cover_color = ?14,
                  dedication = ?15, epigraph = ?16, copyright_text = ?17,
                   acknowledgements = ?18, toc_enabled = ?19, toc_title = ?20,
                   toc_depth = ?21, toc_include_front_matter = ?22,
                   toc_include_back_matter = ?23, layout_json = ?24,
                   updated_at = datetime('now')
               WHERE id = ?25",
                params![
                    title,
                    subtitle,
                    author,
                    description,
                    genre,
                    status,
                    trim_size,
                    font_family,
                    font_size,
                    line_height,
                    paragraph_spacing,
                    margin,
                    word_goal,
                    cover_color,
                    dedication,
                    epigraph,
                    copyright_text,
                    acknowledgements,
                    toc_enabled,
                    toc_title,
                    toc_depth,
                    toc_include_front_matter,
                    toc_include_back_matter,
                    layout_json,
                    id,
                ],
            )
            .map_err(|e| e.to_string())?;
        if updated != 1 {
            return Err("book not found".to_string());
        }
        Ok(())
    })
}

#[tauri::command]
pub fn delete_book(state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        let deleted = conn
            .execute("DELETE FROM books WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if deleted != 1 {
            return Err("book not found".to_string());
        }
        Ok(())
    })
}

fn get_chapter(state: &State<Db>, id: i64) -> Result<Option<Chapter>, String> {
    with_conn(state, |conn| {
        conn.query_row(
            &format!("{CHAPTER_SELECT} WHERE id = ?1"),
            params![id],
            row_to_chapter,
        )
        .optional()
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn list_chapters(state: State<Db>, book_id: i64) -> Result<Vec<Chapter>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(&format!(
                "{CHAPTER_SELECT} WHERE book_id = ?1 ORDER BY position ASC, id ASC"
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![book_id], row_to_chapter)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    })
}

#[tauri::command]
pub fn create_chapter(
    state: State<Db>,
    book_id: i64,
    chapter_kind: String,
    title: String,
    content: String,
    position: Option<i64>,
    toc_include: bool,
    toc_heading_exclusions: Vec<String>,
) -> Result<Chapter, String> {
    validate_chapter_fields(&chapter_kind, &title)?;
    if position.is_some_and(|value| value < 0) {
        return Err("section position cannot be negative".to_string());
    }
    let toc_heading_exclusions = normalize_heading_exclusions(toc_heading_exclusions)?;
    let id = with_conn(&state, |conn| {
        let position = match position {
            Some(position) => position,
            None => conn
                .query_row(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM book_chapters WHERE book_id = ?1",
                    params![book_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?,
        };

        conn.execute(
            "INSERT INTO book_chapters (book_id, chapter_kind, title, content, position, toc_include, toc_heading_exclusions)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                book_id,
                chapter_kind,
                title,
                content,
                position,
                toc_include,
                serde_json::to_string(&toc_heading_exclusions).map_err(|e| e.to_string())?,
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE books SET updated_at = datetime('now') WHERE id = ?1",
            params![book_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    })?;

    get_chapter(&state, id)?.ok_or_else(|| "chapter not found after create".to_string())
}

#[tauri::command]
pub fn update_chapter(
    state: State<Db>,
    id: i64,
    chapter_kind: String,
    title: String,
    content: String,
    toc_include: bool,
    toc_heading_exclusions: Vec<String>,
) -> Result<(), String> {
    validate_chapter_fields(&chapter_kind, &title)?;
    let toc_heading_exclusions = normalize_heading_exclusions(toc_heading_exclusions)?;
    with_conn(&state, |conn| {
        let book_id: Option<i64> = conn
            .query_row(
                "SELECT book_id FROM book_chapters WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let book_id = book_id.ok_or_else(|| "chapter not found".to_string())?;

        conn.execute(
            "UPDATE book_chapters SET chapter_kind = ?1, title = ?2, content = ?3,
             toc_include = ?4, toc_heading_exclusions = ?5,
             updated_at = datetime('now') WHERE id = ?6",
            params![
                chapter_kind,
                title,
                content,
                toc_include,
                serde_json::to_string(&toc_heading_exclusions).map_err(|e| e.to_string())?,
                id,
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE books SET updated_at = datetime('now') WHERE id = ?1",
            params![book_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn delete_chapter(state: State<Db>, id: i64) -> Result<(), String> {
    with_conn(&state, |conn| {
        let book_id: Option<i64> = conn
            .query_row(
                "SELECT book_id FROM book_chapters WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let deleted = conn
            .execute("DELETE FROM book_chapters WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        if deleted != 1 {
            return Err("chapter not found".to_string());
        }
        if let Some(book_id) = book_id {
            conn.execute(
                "UPDATE books SET updated_at = datetime('now') WHERE id = ?1",
                params![book_id],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn reorder_chapters(
    state: State<Db>,
    book_id: i64,
    chapter_ids: Vec<i64>,
) -> Result<(), String> {
    with_conn(&state, |conn| {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        let book_exists: Option<i64> = tx
            .query_row(
                "SELECT id FROM books WHERE id = ?1",
                params![book_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if book_exists.is_none() {
            return Err("book not found".to_string());
        }

        let chapter_count: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM book_chapters WHERE book_id = ?1",
                params![book_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if chapter_count != chapter_ids.len() as i64 {
            return Err("chapter_ids must include every chapter in the book".to_string());
        }

        let mut seen = HashSet::with_capacity(chapter_ids.len());
        if chapter_ids.iter().any(|id| !seen.insert(*id)) {
            return Err("chapter_ids must not contain duplicates".to_string());
        }

        for (position, chapter_id) in chapter_ids.iter().enumerate() {
            let updated = tx
                .execute(
                    "UPDATE book_chapters SET position = ?1, updated_at = datetime('now')
                     WHERE id = ?2 AND book_id = ?3",
                    params![position as i64, chapter_id, book_id],
                )
                .map_err(|e| e.to_string())?;
            if updated != 1 {
                return Err("chapter_ids contains a chapter from another book".to_string());
            }
        }

        tx.execute(
            "UPDATE books SET updated_at = datetime('now') WHERE id = ?1",
            params![book_id],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    })
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
pub fn create_tag(
    app: AppHandle,
    state: State<Db>,
    name: String,
    color: String,
) -> Result<i64, String> {
    let id = with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO tags (name, color) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET color = excluded.color",
            params![name, color],
        )
        .map_err(|e| e.to_string())?;
        conn.query_row("SELECT id FROM tags WHERE name = ?1", params![name], |r| {
            r.get(0)
        })
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
        conn.execute("DELETE FROM note_tags WHERE note_id = ?1", params![note_id])
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
            conn.execute(
                "DELETE FROM clipboard_items WHERE id = ?1",
                params![existing],
            )
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
        conn.execute("DELETE FROM clipboard_items", [])
            .map_err(|e| e.to_string())?;
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
                .query_row("SELECT COUNT(*) FROM notes WHERE trashed = 0", [], |r| {
                    r.get(0)
                })
                .map_err(|e| e.to_string())?,
            favorites: conn
                .query_row(
                    "SELECT COUNT(*) FROM notes WHERE trashed = 0 AND favorite = 1",
                    [],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?,
            trashed: conn
                .query_row("SELECT COUNT(*) FROM notes WHERE trashed = 1", [], |r| {
                    r.get(0)
                })
                .map_err(|e| e.to_string())?,
        })
    })
}

// ---------- tasks ----------

fn parse_task_line(line: &str) -> Option<(bool, String)> {
    let trimmed = line.trim_start();
    for marker in ["- [ ] ", "* [ ] ", "- [x] ", "* [x] ", "- [X] ", "* [X] "] {
        if let Some(rest) = trimmed.strip_prefix(marker) {
            let done = marker.contains('x') || marker.contains('X');
            return Some((done, rest.to_string()));
        }
    }
    None
}

#[tauri::command]
pub fn list_tasks(state: State<Db>) -> Result<Vec<TaskItem>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content FROM notes
                 WHERE trashed = 0 AND archived = 0
                 ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<(i64, String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut tasks = Vec::new();
        for (id, title, content) in rows {
            for (i, line) in content.split('\n').enumerate() {
                if let Some((done, text)) = parse_task_line(line) {
                    tasks.push(TaskItem {
                        note_id: id,
                        note_title: if title.is_empty() {
                            "Untitled".to_string()
                        } else {
                            title.clone()
                        },
                        line_index: i as i64,
                        text,
                        done,
                    });
                }
            }
        }
        // open tasks first, then by note recency (rows already sorted)
        tasks.sort_by_key(|t| t.done);
        Ok(tasks)
    })
}

// ---------- attachments ----------

#[tauri::command]
pub fn save_attachment(app: AppHandle, data: Vec<u8>, ext: String) -> Result<String, String> {
    use std::io::Write;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("attachments");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let safe_ext: String = ext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(5)
        .collect();
    let file_name = format!("img-{nanos}.{safe_ext}");
    let path = dir.join(&file_name);
    let mut f = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    f.write_all(&data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

// ---------- maintenance ----------

#[tauri::command]
pub fn purge_old_trash(app: AppHandle, state: State<Db>) -> Result<i64, String> {
    let purged = with_conn(&state, |conn| {
        let n = conn
            .execute(
                "DELETE FROM notes WHERE trashed = 1
                 AND trashed_at IS NOT NULL
                 AND trashed_at < datetime('now', '-30 days')",
                [],
            )
            .map_err(|e| e.to_string())?;
        Ok(n as i64)
    })?;
    if purged > 0 {
        emit_notes_changed(&app);
    }
    Ok(purged)
}

#[cfg(test)]
mod tests {
    use super::{normalize_heading_exclusions, validate_book_fields, validate_chapter_fields};

    fn validate_default_book() -> Result<(), String> {
        validate_book_fields(
            "Untitled manuscript",
            "",
            "",
            "",
            "",
            "draft",
            "6x9",
            "serif",
            12.0,
            1.5,
            0.0,
            1.0,
            50_000,
            "#a56b3e",
            "Contents",
            3,
            "{}",
        )
    }

    #[test]
    fn accepts_the_default_book_contract() {
        assert_eq!(validate_default_book(), Ok(()));
    }

    #[test]
    fn rejects_invalid_publishing_values() {
        let result = validate_book_fields(
            "Book", "", "", "", "", "unknown", "6x9", "serif", 12.0, 1.5, 0.0, 1.0, 50_000,
            "#a56b3e", "Contents", 3, "{}",
        );
        assert_eq!(result, Err("invalid book status".to_string()));

        let invalid_layout = validate_book_fields(
            "Book", "", "", "", "", "draft", "6x9", "serif", 12.0, 1.5, 0.0, 1.0, 50_000,
            "#a56b3e", "Contents", 3, "[]",
        );
        assert_eq!(
            invalid_layout,
            Err("book layout must be a JSON object".to_string())
        );
    }

    #[test]
    fn validates_section_kinds_and_normalizes_heading_exclusions() {
        assert_eq!(validate_chapter_fields("chapter", "A beginning"), Ok(()));
        assert_eq!(
            validate_chapter_fields("unknown", "A beginning"),
            Err("invalid section type".to_string())
        );
        assert_eq!(
            normalize_heading_exclusions(vec!["b".into(), "".into(), "a".into(), "b".into()]),
            Ok(vec!["a".into(), "b".into()]),
        );
    }
}
