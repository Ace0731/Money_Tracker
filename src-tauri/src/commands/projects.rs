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
    pub completed: Option<bool>,
    pub status: Option<String>,  // "active", "completed", "cancelled", "on_hold", "prospect", "archived"
    // SRS Fields
    pub srs_internal_link: Option<String>,
    pub srs_client_approved_link: Option<String>,
    pub srs_status: Option<String>,
    pub srs_approved_date: Option<String>,
    // Computed fields
    pub received_amount: Option<f64>,
    pub spent_amount: Option<f64>,
    pub logged_hours: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectPayment {
    pub id: i64,
    pub date: String,
    pub amount: f64,
    pub notes: Option<String>,
    pub account_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimeLog {
    pub id: Option<i64>,
    pub project_id: i64,
    pub date: String,
    pub hours: f64,
    pub task: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn get_projects(db: State<DbConnection>) -> Result<Vec<Project>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT 
                p.id, p.name, p.client_id, p.expected_amount, p.daily_rate, p.start_date, p.end_date, p.notes, p.completed, p.status,
                p.srs_internal_link, p.srs_client_approved_link, p.srs_status, p.srs_approved_date,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND direction = 'income') as received,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = p.id AND direction = 'expense') as spent,
                (SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE project_id = p.id) as hours
            FROM projects p 
            ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 WHEN 'prospect' THEN 2 WHEN 'completed' THEN 3 WHEN 'archived' THEN 4 ELSE 5 END, p.name
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
                completed: row.get(8)?,
                status: row.get(9)?,
                srs_internal_link: row.get(10)?,
                srs_client_approved_link: row.get(11)?,
                srs_status: row.get(12)?,
                srs_approved_date: row.get(13)?,
                received_amount: Some(row.get(14)?),
                spent_amount: Some(row.get(15)?),
                logged_hours: Some(row.get(16)?),
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
        "INSERT INTO projects (name, client_id, expected_amount, daily_rate, start_date, end_date, notes, completed, status, 
         srs_internal_link, srs_client_approved_link, srs_status, srs_approved_date) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            project.name,
            project.client_id,
            project.expected_amount,
            project.daily_rate.unwrap_or(0.0),
            project.start_date,
            project.end_date,
            project.notes,
            project.completed.unwrap_or(false),
            project.status.unwrap_or("active".to_string()),
            project.srs_internal_link,
            project.srs_client_approved_link,
            project.srs_status.unwrap_or("Draft".to_string()),
            project.srs_approved_date
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
        "UPDATE projects SET name = ?1, client_id = ?2, expected_amount = ?3, daily_rate = ?4, start_date = ?5, 
         end_date = ?6, notes = ?7, completed = ?8, status = ?9, srs_internal_link = ?10, 
         srs_client_approved_link = ?11, srs_status = ?12, srs_approved_date = ?13 WHERE id = ?14",
        params![
            project.name,
            project.client_id,
            project.expected_amount,
            project.daily_rate.unwrap_or(0.0),
            project.start_date,
            project.end_date,
            project.notes,
            project.completed.unwrap_or(false),
            project.status.unwrap_or("active".to_string()),
            project.srs_internal_link,
            project.srs_client_approved_link,
            project.srs_status,
            project.srs_approved_date,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_time_logs(db: State<DbConnection>, project_id: i64) -> Result<Vec<TimeLog>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, project_id, date, hours, task, start_time, end_time, created_at FROM time_logs WHERE project_id = ?1 ORDER BY date DESC")
        .map_err(|e| e.to_string())?;
    
    let logs = stmt.query_map([project_id], |row| {
        Ok(TimeLog {
            id: Some(row.get(0)?),
            project_id: row.get(1)?,
            date: row.get(2)?,
            hours: row.get(3)?,
            task: row.get(4)?,
            start_time: row.get(5)?,
            end_time: row.get(6)?,
            created_at: Some(row.get(7)?),
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    Ok(logs)
}

#[tauri::command]
pub fn create_time_log(db: State<DbConnection>, log: TimeLog) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO time_logs (project_id, date, hours, task, start_time, end_time) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![log.project_id, log.date, log.hours, log.task, log.start_time, log.end_time],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_time_log(db: State<DbConnection>, log: TimeLog) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = log.id.ok_or("Time log ID is required")?;
    conn.execute(
        "UPDATE time_logs SET date = ?1, hours = ?2, task = ?3, start_time = ?4, end_time = ?5 WHERE id = ?6",
        params![log.date, log.hours, log.task, log.start_time, log.end_time, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_time_log(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM time_logs WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
pub fn get_project_payments(db: State<DbConnection>, project_id: i64) -> Result<Vec<ProjectPayment>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT t.id, t.date, t.amount, t.notes, a.name as account_name
            FROM transactions t
            LEFT JOIN accounts a ON t.to_account_id = a.id
            WHERE t.project_id = ?1 AND t.direction = 'income'
            ORDER BY t.date DESC
        ")
        .map_err(|e| e.to_string())?;
    
    let payments = stmt
        .query_map([project_id], |row| {
            Ok(ProjectPayment {
                id: row.get(0)?,
                date: row.get(1)?,
                amount: row.get(2)?,
                notes: row.get(3)?,
                account_name: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(payments)
}
