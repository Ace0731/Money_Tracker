use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Category {
    pub id: Option<i64>,
    pub name: String,
    pub kind: String,
    pub notes: Option<String>,
    pub is_investment: bool,
}

#[tauri::command]
pub fn get_categories(db: State<DbConnection>) -> Result<Vec<Category>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, kind, notes, COALESCE(is_investment, 0) FROM categories ORDER BY kind, name")
        .map_err(|e| e.to_string())?;
    
    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                kind: row.get(2)?,
                notes: row.get(3)?,
                is_investment: row.get::<_, i32>(4)? == 1,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(categories)
}

#[tauri::command]
pub fn create_category(
    db: State<DbConnection>,
    category: Category,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO categories (name, kind, notes, is_investment) VALUES (?1, ?2, ?3, ?4)",
        params![category.name, category.kind, category.notes, category.is_investment as i32],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_category(
    db: State<DbConnection>,
    category: Category,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let id = category.id.ok_or("Category ID is required")?;
    
    conn.execute(
        "UPDATE categories SET name = ?1, kind = ?2, notes = ?3, is_investment = ?4 WHERE id = ?5",
        params![category.name, category.kind, category.notes, category.is_investment as i32, id],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
