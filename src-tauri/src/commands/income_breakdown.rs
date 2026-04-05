use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryHour {
    pub id: Option<i64>,
    pub category_id: i64,
    pub date: String,
    pub hours: f64,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomeBreakdownItem {
    pub category_id: i64,
    pub category_name: String,
    pub income: f64,
    pub hours: f64,
    pub hourly_rate: f64,
    pub is_project_based: bool,
    pub projects: Vec<ProjectBreakdownItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectBreakdownItem {
    pub project_id: i64,
    pub project_name: String,
    pub income: f64,
    pub hours: f64,
    pub hourly_rate: f64,
}

#[tauri::command]
pub fn get_category_hours(
    db: State<DbConnection>,
    category_id: i64,
    month: String, // YYYY-MM
) -> Result<Vec<CategoryHour>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, category_id, date, hours, notes, created_at FROM category_hours WHERE category_id = ?1 AND strftime('%Y-%m', date) = ?2 ORDER BY date DESC")
        .map_err(|e| e.to_string())?;
    
    let hours = stmt
        .query_map(params![category_id, month], |row| {
            Ok(CategoryHour {
                id: Some(row.get(0)?),
                category_id: row.get(1)?,
                date: row.get(2)?,
                hours: row.get(3)?,
                notes: row.get(4)?,
                created_at: Some(row.get(5)?),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(hours)
}

#[tauri::command]
pub fn create_category_hour(db: State<DbConnection>, hour: CategoryHour) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO category_hours (category_id, date, hours, notes) VALUES (?1, ?2, ?3, ?4)",
        params![hour.category_id, hour.date, hour.hours, hour.notes],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_category_hour(db: State<DbConnection>, hour: CategoryHour) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = hour.id.ok_or("ID is required")?;
    conn.execute(
        "UPDATE category_hours SET date = ?1, hours = ?2, notes = ?3 WHERE id = ?4",
        params![hour.date, hour.hours, hour.notes, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_category_hour(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM category_hours WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_income_breakdown(
    db: State<DbConnection>,
    month: String, // YYYY-MM
) -> Result<Vec<IncomeBreakdownItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // 1. Get all categories marked for breakdown
    let mut stmt = conn.prepare("SELECT id, name FROM categories WHERE include_in_income_breakdown = 1").map_err(|e| e.to_string())?;
    let categories: Vec<(i64, String)> = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    let mut results = Vec::new();

    for (cat_id, cat_name) in categories {
        // 2. Get manual hours for this category
        let manual_hours: f64 = conn.query_row(
            "SELECT COALESCE(SUM(hours), 0) FROM category_hours WHERE category_id = ?1 AND strftime('%Y-%m', date) = ?2",
            params![cat_id, month],
            |row| row.get(0)
        ).unwrap_or(0.0);

        // 3. Get income from transactions for this category (non-project)
        let manual_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE category_id = ?1 AND project_id IS NULL AND direction = 'income' AND strftime('%Y-%m', date) = ?2",
            params![cat_id, month],
            |row| row.get(0)
        ).unwrap_or(0.0);

        // 4. Get projects related to this category for this month
        // A project is "related" if there are transactions for it with this category id this month
        let mut proj_stmt = conn.prepare("
            SELECT DISTINCT p.id, p.name 
            FROM projects p
            JOIN transactions t ON t.project_id = p.id
            WHERE t.category_id = ?1 AND strftime('%Y-%m', t.date) = ?2
        ").map_err(|e| e.to_string())?;
        
        let related_projects: Vec<(i64, String)> = proj_stmt.query_map(params![cat_id, month], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut project_items = Vec::new();
        let mut total_project_income = 0.0;
        let mut total_project_hours = 0.0;

        for (p_id, p_name) in related_projects {
            let p_income: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE project_id = ?1 AND category_id = ?2 AND direction = 'income' AND strftime('%Y-%m', date) = ?3",
                params![p_id, cat_id, month],
                |row| row.get(0)
            ).unwrap_or(0.0);

            let p_hours: f64 = conn.query_row(
                "SELECT COALESCE(SUM(hours), 0) FROM time_logs WHERE project_id = ?1 AND strftime('%Y-%m', date) = ?2",
                params![p_id, month],
                |row| row.get(0)
            ).unwrap_or(0.0);

            let p_rate = if p_hours > 0.0 { p_income / p_hours } else { 0.0 };

            project_items.push(ProjectBreakdownItem {
                project_id: p_id,
                project_name: p_name,
                income: p_income,
                hours: p_hours,
                hourly_rate: p_rate,
            });

            total_project_income += p_income;
            total_project_hours += p_hours;
        }

        let total_income = manual_income + total_project_income;
        let total_hours = manual_hours + total_project_hours;
        let total_rate = if total_hours > 0.0 { total_income / total_hours } else { 0.0 };

        results.push(IncomeBreakdownItem {
            category_id: cat_id,
            category_name: cat_name,
            income: total_income,
            hours: total_hours,
            hourly_rate: total_rate,
            is_project_based: !project_items.is_empty(),
            projects: project_items,
        });
    }

    Ok(results)
}
