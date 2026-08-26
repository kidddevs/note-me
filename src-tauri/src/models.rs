use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub sort_order: i64,
    pub created_at: String,
    pub note_count: i64,
}

#[derive(Serialize, Clone)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub note_count: i64,
}

#[derive(Serialize, Clone)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub pinned: bool,
    pub favorite: bool,
    pub archived: bool,
    pub trashed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<Tag>,
    pub snippet: String,
}

#[derive(Serialize, Clone)]
pub struct ClipboardItem {
    pub id: i64,
    pub kind: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct AppStats {
    pub total_notes: i64,
    pub favorites: i64,
    pub trashed: i64,
}

#[derive(Serialize, Clone)]
pub struct TaskItem {
    pub note_id: i64,
    pub note_title: String,
    pub line_index: i64,
    pub text: String,
    pub done: bool,
}
