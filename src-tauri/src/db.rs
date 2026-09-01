use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub struct Db(pub Mutex<Connection>);

const BOOK_COLUMNS: [(&str, &str); 12] = [
    ("word_goal", "INTEGER NOT NULL DEFAULT 50000"),
    ("cover_color", "TEXT NOT NULL DEFAULT '#a56b3e'"),
    ("dedication", "TEXT NOT NULL DEFAULT ''"),
    ("epigraph", "TEXT NOT NULL DEFAULT ''"),
    ("copyright_text", "TEXT NOT NULL DEFAULT ''"),
    ("acknowledgements", "TEXT NOT NULL DEFAULT ''"),
    ("toc_enabled", "INTEGER NOT NULL DEFAULT 1"),
    ("toc_title", "TEXT NOT NULL DEFAULT 'Contents'"),
    ("toc_depth", "INTEGER NOT NULL DEFAULT 3"),
    ("toc_include_front_matter", "INTEGER NOT NULL DEFAULT 0"),
    ("toc_include_back_matter", "INTEGER NOT NULL DEFAULT 0"),
    ("layout_json", "TEXT NOT NULL DEFAULT '{}'"),
];

fn migrate_books(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(books)")
        .map_err(|e| e.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (name, definition) in BOOK_COLUMNS {
        if !columns.iter().any(|column| column == name) {
            conn.execute(
                &format!("ALTER TABLE books ADD COLUMN {name} {definition}"),
                [],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn migrate_book_chapters(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(book_chapters)")
        .map_err(|e| e.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    if !columns.iter().any(|column| column == "chapter_kind") {
        conn.execute(
            "ALTER TABLE book_chapters ADD COLUMN chapter_kind TEXT NOT NULL DEFAULT 'chapter'",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    if !columns.iter().any(|column| column == "toc_include") {
        conn.execute(
            "ALTER TABLE book_chapters ADD COLUMN toc_include INTEGER NOT NULL DEFAULT 1",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    if !columns
        .iter()
        .any(|column| column == "toc_heading_exclusions")
    {
        conn.execute(
            "ALTER TABLE book_chapters ADD COLUMN toc_heading_exclusions TEXT NOT NULL DEFAULT '[]'",
            [],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn init(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("noteme.db")).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            color      TEXT NOT NULL DEFAULT '#8b5cf6',
            icon       TEXT NOT NULL DEFAULT 'Folder',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL DEFAULT '',
            content     TEXT NOT NULL DEFAULT '',
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            pinned      INTEGER NOT NULL DEFAULT 0,
            favorite    INTEGER NOT NULL DEFAULT 0,
            archived    INTEGER NOT NULL DEFAULT 0,
            trashed     INTEGER NOT NULL DEFAULT 0,
            trashed_at  TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tags (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#64748b'
        );

        CREATE TABLE IF NOT EXISTS note_tags (
            note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (note_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS clipboard_items (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            kind       TEXT NOT NULL DEFAULT 'text',
            content    TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS books (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            title              TEXT NOT NULL DEFAULT '',
            subtitle           TEXT NOT NULL DEFAULT '',
            author             TEXT NOT NULL DEFAULT '',
            description        TEXT NOT NULL DEFAULT '',
            genre              TEXT NOT NULL DEFAULT '',
            status             TEXT NOT NULL DEFAULT 'draft',
            trim_size          TEXT NOT NULL DEFAULT '6x9',
            font_family        TEXT NOT NULL DEFAULT 'serif',
            font_size          REAL NOT NULL DEFAULT 12.0,
            line_height        REAL NOT NULL DEFAULT 1.5,
            paragraph_spacing  REAL NOT NULL DEFAULT 0.0,
            margin             REAL NOT NULL DEFAULT 1.0,
            word_goal         INTEGER NOT NULL DEFAULT 50000,
            cover_color       TEXT NOT NULL DEFAULT '#a56b3e',
            dedication        TEXT NOT NULL DEFAULT '',
            epigraph          TEXT NOT NULL DEFAULT '',
            copyright_text    TEXT NOT NULL DEFAULT '',
            acknowledgements  TEXT NOT NULL DEFAULT '',
            toc_enabled       INTEGER NOT NULL DEFAULT 1,
            toc_title         TEXT NOT NULL DEFAULT 'Contents',
            toc_depth         INTEGER NOT NULL DEFAULT 3,
            toc_include_front_matter INTEGER NOT NULL DEFAULT 0,
            toc_include_back_matter INTEGER NOT NULL DEFAULT 0,
            layout_json       TEXT NOT NULL DEFAULT '{}',
            created_at         TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS book_chapters (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            chapter_kind TEXT NOT NULL DEFAULT 'chapter',
            title      TEXT NOT NULL DEFAULT '',
            content    TEXT NOT NULL DEFAULT '',
            position   INTEGER NOT NULL DEFAULT 0,
            toc_include INTEGER NOT NULL DEFAULT 1,
            toc_heading_exclusions TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(trashed);
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category_id);
        CREATE INDEX IF NOT EXISTS idx_books_updated ON books(updated_at);
        CREATE INDEX IF NOT EXISTS idx_book_chapters_book_position ON book_chapters(book_id, position);
        "#,
    )
    .map_err(|e| e.to_string())?;

    migrate_books(&conn)?;
    migrate_book_chapters(&conn)?;

    let db = Db(Mutex::new(conn));
    app.manage(db);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{migrate_book_chapters, migrate_books};
    use rusqlite::Connection;

    fn columns(conn: &Connection, table: &str) -> Vec<String> {
        let mut statement = conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .expect("table info should prepare");
        statement
            .query_map([], |row| row.get(1))
            .expect("table info should query")
            .collect::<Result<Vec<_>, _>>()
            .expect("columns should deserialize")
    }

    #[test]
    fn upgrades_early_book_tables_without_losing_existing_columns() {
        let conn = Connection::open_in_memory().expect("in-memory database should open");
        conn.execute_batch(
            "CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '');
             CREATE TABLE book_chapters (
               id INTEGER PRIMARY KEY,
               book_id INTEGER NOT NULL,
               title TEXT NOT NULL DEFAULT '',
               content TEXT NOT NULL DEFAULT '',
               position INTEGER NOT NULL DEFAULT 0
             );",
        )
        .expect("legacy schema should be created");

        migrate_books(&conn).expect("book migration should pass");
        migrate_book_chapters(&conn).expect("chapter migration should pass");

        let book_columns = columns(&conn, "books");
        assert!(book_columns.contains(&"title".to_string()));
        assert!(book_columns.contains(&"layout_json".to_string()));
        assert!(book_columns.contains(&"toc_depth".to_string()));

        let chapter_columns = columns(&conn, "book_chapters");
        assert!(chapter_columns.contains(&"chapter_kind".to_string()));
        assert!(chapter_columns.contains(&"toc_include".to_string()));
        assert!(chapter_columns.contains(&"toc_heading_exclusions".to_string()));
    }
}
