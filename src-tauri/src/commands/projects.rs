use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: Option<i64>,
    pub name: String,
    pub client_id: Option<i64>,
    pub expected_amount: Option<f64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_projects(db: State<DbConnection>) -> Result<Vec<Project>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, client_id, expected_amount, start_date, end_date, notes FROM projects ORDER BY name")
        .map_err(|e| e.to_string())?;
    
    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                client_id: row.get(2)?,
                expected_amount: row.get(3)?,
                start_date: row.get(4)?,
                end_date: row.get(5)?,
                notes: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(projects)
}

#[tauri::command]
pub fn create_project(
    db: State<DbConnection>,
    project: Project,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO projects (name, client_id, expected_amount, start_date, end_date, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            project.name,
            project.client_id,
            project.expected_amount,
            project.start_date,
            project.end_date,
            project.notes
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_project(
    db: State<DbConnection>,
    project: Project,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let id = project.id.ok_or("Project ID is required")?;
    
    conn.execute(
        "UPDATE projects SET name = ?1, client_id = ?2, expected_amount = ?3, start_date = ?4, end_date = ?5, notes = ?6 WHERE id = ?7",
        params![
            project.name,
            project.client_id,
            project.expected_amount,
            project.start_date,
            project.end_date,
            project.notes,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
