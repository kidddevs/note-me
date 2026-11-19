use rusqlite::{params, Connection, OptionalExtension};

/// Restore text and keep the current draft as a safety checkpoint in one commit.
pub fn restore_chapter_snapshot(
    conn: &mut Connection,
    chapter_id: i64,
    snapshot_id: i64,
    draft_title: &str,
    draft_content: &str,
    word_count: i64,
) -> Result<(), String> {
    let transaction = conn.transaction().map_err(|e| e.to_string())?;
    let (book_id, title, content): (i64, String, String) = transaction
        .query_row(
            "SELECT c.book_id, s.title, s.content FROM book_chapters c
             JOIN book_snapshots s ON s.chapter_id = c.id AND s.book_id = c.book_id
             WHERE c.id = ?1 AND s.id = ?2",
            params![chapter_id, snapshot_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "checkpoint not found for this section".to_string())?;
    transaction
        .execute(
            "INSERT INTO book_snapshots (chapter_id, book_id, title, content, reason, word_count)
             VALUES (?1, ?2, ?3, ?4, 'safety', ?5)",
            params![
                chapter_id,
                book_id,
                draft_title,
                draft_content,
                word_count.max(0)
            ],
        )
        .map_err(|e| e.to_string())?;
    transaction
        .execute(
            "UPDATE book_chapters SET title = ?1, content = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![title, content, chapter_id],
        )
        .map_err(|e| e.to_string())?;
    let changed = transaction
        .execute(
            "UPDATE books SET updated_at = datetime('now') WHERE id = ?1",
            [book_id],
        )
        .map_err(|e| e.to_string())?;
    if changed != 1 {
        return Err("book not found".into());
    }
    transaction
        .execute(
            "DELETE FROM book_snapshots WHERE chapter_id = ?1 AND id NOT IN (
               SELECT id FROM book_snapshots WHERE chapter_id = ?1
               ORDER BY created_at DESC, id DESC LIMIT 50
             )",
            [chapter_id],
        )
        .map_err(|e| e.to_string())?;
    transaction.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::restore_chapter_snapshot;
    use rusqlite::Connection;

    fn database() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"CREATE TABLE books(id INTEGER PRIMARY KEY, updated_at TEXT DEFAULT 'before');
             CREATE TABLE book_chapters(id INTEGER PRIMARY KEY,book_id INTEGER,title TEXT,content TEXT,
               chapter_kind TEXT DEFAULT 'feature',layout_json TEXT DEFAULT '{}',workflow_json TEXT DEFAULT '{}',
               toc_include INTEGER DEFAULT 0,updated_at TEXT DEFAULT 'before');
             CREATE TABLE book_snapshots(id INTEGER PRIMARY KEY,chapter_id INTEGER,book_id INTEGER,
               title TEXT,content TEXT,reason TEXT,word_count INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
             INSERT INTO books(id) VALUES(1);
             INSERT INTO book_chapters(id,book_id,title,content,layout_json,workflow_json)
               VALUES(2,1,'Current','Current draft','{"paper":"cream"}','{"status":"ready"}');
             INSERT INTO book_snapshots VALUES(3,2,1,'Earlier','Earlier words','manual',2,'2026-01-01');
             INSERT INTO book_snapshots VALUES(4,99,1,'Other section','Other words','manual',2,'2026-01-02');"#,
        ).unwrap();
        conn
    }

    #[test]
    fn restore_saves_the_unsaved_draft_and_preserves_section_metadata() {
        let mut conn = database();
        restore_chapter_snapshot(&mut conn, 2, 3, "Unsaved title", "Unsaved manuscript", 2)
            .unwrap();
        let row: (String, String, String, String, String, i64) = conn.query_row(
            "SELECT title,content,chapter_kind,layout_json,workflow_json,toc_include FROM book_chapters WHERE id=2",
            [], |row| Ok((row.get(0)?,row.get(1)?,row.get(2)?,row.get(3)?,row.get(4)?,row.get(5)?)),
        ).unwrap();
        assert_eq!(
            row,
            (
                "Earlier".into(),
                "Earlier words".into(),
                "feature".into(),
                r#"{"paper":"cream"}"#.into(),
                r#"{"status":"ready"}"#.into(),
                0
            )
        );
        let safety: (String, String, i64) = conn
            .query_row(
                "SELECT title,content,word_count FROM book_snapshots WHERE reason='safety'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(
            safety,
            ("Unsaved title".into(), "Unsaved manuscript".into(), 2)
        );
    }

    #[test]
    fn missing_or_cross_section_snapshots_and_write_failures_leave_the_draft_intact() {
        let mut conn = database();
        assert!(restore_chapter_snapshot(&mut conn, 2, 4, "Draft", "Keep me", 2).is_err());
        conn.execute(
            "UPDATE book_snapshots SET chapter_id=2,book_id=99 WHERE id=4",
            [],
        )
        .unwrap();
        assert!(restore_chapter_snapshot(&mut conn, 2, 4, "Draft", "Keep me", 2).is_err());
        assert!(restore_chapter_snapshot(&mut conn, 2, 999, "Draft", "Keep me", 2).is_err());
        conn.execute_batch("CREATE TRIGGER reject_safety BEFORE INSERT ON book_snapshots BEGIN SELECT RAISE(FAIL,'disk error'); END;").unwrap();
        assert!(restore_chapter_snapshot(&mut conn, 2, 3, "Draft", "Keep me", 2).is_err());
        conn.execute_batch("DROP TRIGGER reject_safety; CREATE TRIGGER reject_book_update BEFORE UPDATE ON books BEGIN SELECT RAISE(FAIL,'book update failed'); END;").unwrap();
        assert!(restore_chapter_snapshot(&mut conn, 2, 3, "Draft", "Keep me", 2).is_err());
        let content: String = conn
            .query_row("SELECT content FROM book_chapters WHERE id=2", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(content, "Current draft");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM book_snapshots", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn restoring_the_oldest_retained_snapshot_keeps_the_new_safety_copy() {
        let mut conn = database();
        for id in 5..54 {
            conn.execute("INSERT INTO book_snapshots(id,chapter_id,book_id,title,content,reason,word_count) VALUES(?1,2,1,'Later','Later draft','auto',2)", [id]).unwrap();
        }
        restore_chapter_snapshot(&mut conn, 2, 3, "Latest", "Latest draft", 2).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM book_snapshots WHERE chapter_id=2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 50);
        let latest: String = conn
            .query_row(
                "SELECT content FROM book_snapshots WHERE chapter_id=2 ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(latest, "Latest draft");
        let content: String = conn
            .query_row("SELECT content FROM book_chapters WHERE id=2", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(content, "Earlier words");
    }
}
