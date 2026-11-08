use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct ChapterWorkflow {
    status: String,
    word_goal: i64,
    due_date: String,
}

impl Default for ChapterWorkflow {
    fn default() -> Self {
        Self {
            status: "draft".into(),
            word_goal: 0,
            due_date: String::new(),
        }
    }
}

fn valid_due_date(value: &str) -> bool {
    if value.is_empty() {
        return true;
    }
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes
            .iter()
            .enumerate()
            .any(|(i, byte)| i != 4 && i != 7 && !byte.is_ascii_digit())
    {
        return false;
    }
    let year = value[..4].parse::<u32>().unwrap_or(0);
    let month = value[5..7].parse::<usize>().unwrap_or(0);
    let day = value[8..].parse::<u32>().unwrap_or(0);
    if !(1000..=9999).contains(&year) || !(1..=12).contains(&month) || day == 0 {
        return false;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    day <= [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ][month - 1]
}

pub fn validated_workflow_json(value: &str) -> Result<String, String> {
    if value.len() > 4096 {
        return Err("section plan is too large".into());
    }
    let raw: serde_json::Value =
        serde_json::from_str(value).map_err(|_| "section plan must be valid JSON".to_string())?;
    if !raw.is_object() {
        return Err("section plan must be a JSON object".into());
    }
    let workflow: ChapterWorkflow = serde_json::from_value(raw).map_err(|_| {
        "section plan must contain valid status, word budget and date fields".to_string()
    })?;
    if !["draft", "revising", "ready"].contains(&workflow.status.as_str()) {
        return Err("invalid section workflow status".into());
    }
    if !(0..=1_000_000).contains(&workflow.word_goal) {
        return Err("section word budget must be between 0 and 1000000".into());
    }
    if !valid_due_date(&workflow.due_date) {
        return Err("section due date must be a valid YYYY-MM-DD calendar date".into());
    }
    serde_json::to_string(&workflow).map_err(|e| e.to_string())
}

/** Planning never writes manuscript text, page layout or reader navigation. */
pub fn save_chapter_workflow(conn: &mut Connection, id: i64, value: &str) -> Result<(), String> {
    let canonical = validated_workflow_json(value)?;
    let transaction = conn.transaction().map_err(|e| e.to_string())?;
    let book_id: i64 = transaction
        .query_row(
            "SELECT book_id FROM book_chapters WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "chapter not found".to_string())?;
    transaction.execute("UPDATE book_chapters SET workflow_json = ?1, updated_at = datetime('now') WHERE id = ?2", params![canonical, id]).map_err(|e| e.to_string())?;
    let changed = transaction
        .execute(
            "UPDATE books SET updated_at = datetime('now') WHERE id = ?1",
            [book_id],
        )
        .map_err(|e| e.to_string())?;
    if changed != 1 {
        return Err("book not found".into());
    }
    transaction.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{save_chapter_workflow, validated_workflow_json};
    use rusqlite::Connection;

    fn database() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE books(id INTEGER PRIMARY KEY, updated_at TEXT DEFAULT 'before');
            CREATE TABLE book_chapters(id INTEGER PRIMARY KEY, book_id INTEGER, title TEXT, content TEXT, layout_json TEXT, workflow_json TEXT DEFAULT '{}', updated_at TEXT DEFAULT 'before');
            INSERT INTO books(id) VALUES(1);
            INSERT INTO book_chapters(id,book_id,title,content,layout_json) VALUES(2,1,'North','Original manuscript','{\"paper\":\"cream\"}');").unwrap();
        conn
    }

    #[test]
    fn validates_status_budget_and_real_calendar_dates() {
        assert!(validated_workflow_json(
            r#"{"status":"revising","wordGoal":1800,"dueDate":"2028-02-29"}"#
        )
        .is_ok());
        for value in [
            r#"[]"#,
            r#"{"status":"published"}"#,
            r#"{"wordGoal":-1}"#,
            r#"{"wordGoal":1.5}"#,
            r#"{"wordGoal":1000001}"#,
            r#"{"dueDate":"2026-02-29"}"#,
            r#"{"dueDate":"2100-02-29"}"#,
            r#"{"dueDate":"2026-04-31"}"#,
            r#"{"dueDate":"0999-12-31"}"#,
        ] {
            assert!(
                validated_workflow_json(value).is_err(),
                "should reject {value}"
            );
        }
    }

    #[test]
    fn persists_planning_without_overwriting_writing_or_layout() {
        let mut conn = database();
        conn.execute(
            "UPDATE book_chapters SET content = 'New writing' WHERE id = 2",
            [],
        )
        .unwrap();
        save_chapter_workflow(
            &mut conn,
            2,
            r#"{"status":"ready","wordGoal":2000,"dueDate":"2026-12-01"}"#,
        )
        .unwrap();
        let row: (String, String, String, String) = conn
            .query_row(
                "SELECT title,content,layout_json,workflow_json FROM book_chapters WHERE id=2",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(row.0, "North");
        assert_eq!(row.1, "New writing");
        assert_eq!(row.2, r#"{"paper":"cream"}"#);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&row.3).unwrap()["status"],
            "ready"
        );
        conn.execute(
            "UPDATE book_chapters SET content = 'Later writing' WHERE id = 2",
            [],
        )
        .unwrap();
        let persisted: String = conn
            .query_row(
                "SELECT workflow_json FROM book_chapters WHERE id=2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(persisted, row.3);
    }

    #[test]
    fn missing_sections_and_failed_book_updates_leave_planning_unchanged() {
        let mut conn = database();
        assert!(save_chapter_workflow(&mut conn, 99, r#"{"status":"ready"}"#).is_err());
        conn.execute_batch("CREATE TRIGGER reject_book_update BEFORE UPDATE ON books BEGIN SELECT RAISE(FAIL, 'test failure'); END;").unwrap();
        assert!(save_chapter_workflow(&mut conn, 2, r#"{"status":"ready"}"#).is_err());
        let persisted: String = conn
            .query_row(
                "SELECT workflow_json FROM book_chapters WHERE id=2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(persisted, "{}");
    }
}
