use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub id: Option<i64>,
    pub name: String,
}

#[tauri::command]
pub fn get_tags(db: State<DbConnection>) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: Some(row.get(0)?),
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(
    db: State<DbConnection>,
    tag: Tag,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO tags (name) VALUES (?1)",
        params![tag.name],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}
