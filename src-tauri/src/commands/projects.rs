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
    pub daily_rate: Option<f64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
    // Computed fields
    pub received_amount: Option<f64>,
    pub spent_amount: Option<f64>,
    pub logged_hours: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimeLog {
    pub id: Option<i64>,
    pub project_id: i64,
    pub date: String,
    pub hours: f64,
    pub task: Option<String>,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn get_projects(db: State<DbConnection>) -> Result<Vec<Project>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT 
                p.id, p.name, p.client_id, p.expected_amount, p.daily_rate, p.start_date, p.end_date, p.notes,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND direction = 'income') as received,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND direction = 'expense') as spent,
                (SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE project_id = p.id) as hours
            FROM projects p 
            ORDER BY p.name
        ")
        .map_err(|e| e.to_string())?;
    
    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                client_id: row.get(2)?,
                expected_amount: row.get(3)?,
                daily_rate: row.get(4)?,
                start_date: row.get(5)?,
                end_date: row.get(6)?,
                notes: row.get(7)?,
                received_amount: Some(row.get(8)?),
                spent_amount: Some(row.get(9)?),
                logged_hours: Some(row.get(10)?),
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
        "INSERT INTO projects (name, client_id, expected_amount, daily_rate, start_date, end_date, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            project.name,
            project.client_id,
            project.expected_amount,
            project.daily_rate.unwrap_or(0.0),
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
        "UPDATE projects SET name = ?1, client_id = ?2, expected_amount = ?3, daily_rate = ?4, start_date = ?5, end_date = ?6, notes = ?7 WHERE id = ?8",
        params![
            project.name,
            project.client_id,
            project.expected_amount,
            project.daily_rate.unwrap_or(0.0),
            project.start_date,
            project.end_date,
            project.notes,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_time_logs(db: State<DbConnection>, project_id: i64) -> Result<Vec<TimeLog>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, project_id, date, hours, task, created_at FROM time_logs WHERE project_id = ?1 ORDER BY date DESC")
        .map_err(|e| e.to_string())?;
    
    let logs = stmt.query_map([project_id], |row| {
        Ok(TimeLog {
            id: Some(row.get(0)?),
            project_id: row.get(1)?,
            date: row.get(2)?,
            hours: row.get(3)?,
            task: row.get(4)?,
            created_at: Some(row.get(5)?),
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    Ok(logs)
}

#[tauri::command]
pub fn create_time_log(db: State<DbConnection>, log: TimeLog) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO time_logs (project_id, date, hours, task) VALUES (?1, ?2, ?3, ?4)",
        params![log.project_id, log.date, log.hours, log.task],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn delete_time_log(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM time_logs WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
