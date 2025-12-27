use rusqlite::Result;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlySummary {
    pub month: String,
    pub income: f64,
    pub expense: f64,
    pub net: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategorySummary {
    pub category_name: String,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientSummary {
    pub client_name: String,
    pub total_income: f64,
    pub transaction_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OverallStats {
    pub total_income: f64,
    pub total_expense: f64,
    pub net_balance: f64,
    pub transaction_count: i64,
}

#[tauri::command]
pub fn get_monthly_summary(
    db: State<DbConnection>,
    year: i32,
) -> Result<Vec<MonthlySummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE strftime('%Y', date) = ?1
        GROUP BY month
        ORDER BY month"
    ).map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map([year.to_string()], |row| {
            let income: f64 = row.get(1)?;
            let expense: f64 = row.get(2)?;
            Ok(MonthlySummary {
                month: row.get(0)?,
                income,
                expense,
                net: income - expense,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(summaries)
}

#[tauri::command]
pub fn get_category_summary(
    db: State<DbConnection>,
    direction: String,
) -> Result<Vec<CategorySummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT c.name, SUM(t.amount) as total, COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.direction = ?1
        GROUP BY c.name
        ORDER BY total DESC"
    ).map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map([direction], |row| {
            Ok(CategorySummary {
                category_name: row.get(0)?,
                total: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(summaries)
}

#[tauri::command]
pub fn get_client_summary(db: State<DbConnection>) -> Result<Vec<ClientSummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT c.name, SUM(t.amount) as total, COUNT(*) as count
        FROM transactions t
        JOIN clients c ON t.client_id = c.id
        WHERE t.direction = 'income' AND t.client_id IS NOT NULL
        GROUP BY c.name
        ORDER BY total DESC"
    ).map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map([], |row| {
            Ok(ClientSummary {
                client_name: row.get(0)?,
                total_income: row.get(1)?,
                transaction_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(summaries)
}

#[tauri::command]
pub fn get_overall_stats(db: State<DbConnection>) -> Result<OverallStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT 
            SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END) as total_expense,
            COUNT(*) as transaction_count
        FROM transactions"
    ).map_err(|e| e.to_string())?;
    
    let stats = stmt.query_row([], |row| {
        let income: f64 = row.get(0)?;
        let expense: f64 = row.get(1)?;
        Ok(OverallStats {
            total_income: income,
            total_expense: expense,
            net_balance: income - expense,
            transaction_count: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;
    
    Ok(stats)
}
