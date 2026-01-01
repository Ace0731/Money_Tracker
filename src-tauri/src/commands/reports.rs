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

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportFilters {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub client_id: Option<i64>,
    pub project_id: Option<i64>,
}

fn apply_filters(query: &mut String, filters: &ReportFilters, params: &mut Vec<rusqlite::types::Value>) {
    if let Some(start) = &filters.start_date {
        query.push_str(" AND date >= ?");
        params.push(start.clone().into());
    }
    if let Some(end) = &filters.end_date {
        query.push_str(" AND date <= ?");
        params.push(end.clone().into());
    }
    if let Some(client_id) = filters.client_id {
        query.push_str(" AND client_id = ?");
        params.push(client_id.into());
    }
    if let Some(project_id) = filters.project_id {
        query.push_str(" AND project_id = ?");
        params.push(project_id.into());
    }
}

#[tauri::command]
pub fn get_monthly_summary(
    db: State<DbConnection>,
    year: i32,
    filters: ReportFilters,
) -> Result<Vec<MonthlySummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut query = String::from("
        SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END) as expense
        FROM transactions
        WHERE strftime('%Y', date) = ?
    ");
    
    let mut params_vec: Vec<rusqlite::types::Value> = vec![year.to_string().into()];
    apply_filters(&mut query, &filters, &mut params_vec);
    
    query.push_str(" GROUP BY month ORDER BY month");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map(rusqlite::params_from_iter(params_vec), |row| {
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
    filters: ReportFilters,
) -> Result<Vec<CategorySummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut query = String::from("
        SELECT c.name, SUM(t.amount) as total, COUNT(*) as count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.direction = ?
    ");
    
    let mut params_vec: Vec<rusqlite::types::Value> = vec![direction.into()];
    apply_filters(&mut query, &filters, &mut params_vec);
    
    query.push_str(" GROUP BY c.name ORDER BY total DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map(rusqlite::params_from_iter(params_vec), |row| {
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
pub fn get_client_summary(db: State<DbConnection>, filters: ReportFilters) -> Result<Vec<ClientSummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut query = String::from("
        SELECT c.name, SUM(t.amount) as total, COUNT(*) as count
        FROM transactions t
        JOIN clients c ON t.client_id = c.id
        WHERE t.direction = 'income' AND t.client_id IS NOT NULL
    ");
    
    let mut params_vec: Vec<rusqlite::types::Value> = vec![];
    apply_filters(&mut query, &filters, &mut params_vec);
    
    query.push_str(" GROUP BY c.name ORDER BY total DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map(rusqlite::params_from_iter(params_vec), |row| {
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
pub fn get_overall_stats(db: State<DbConnection>, filters: ReportFilters) -> Result<OverallStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut query = String::from("
        SELECT 
            SUM(CASE WHEN direction = 'income' THEN amount ELSE 0 END) as total_income,
            SUM(CASE WHEN direction = 'expense' THEN amount ELSE 0 END) as total_expense,
            COUNT(*) as transaction_count
        FROM transactions
        WHERE 1=1
    ");
    
    let mut params_vec: Vec<rusqlite::types::Value> = vec![];
    apply_filters(&mut query, &filters, &mut params_vec);
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let stats = stmt.query_row(rusqlite::params_from_iter(params_vec), |row| {
        let income: f64 = row.get(0).unwrap_or(0.0);
        let expense: f64 = row.get(1).unwrap_or(0.0);
        Ok(OverallStats {
            total_income: income,
            total_expense: expense,
            net_balance: income - expense,
            transaction_count: row.get(2).unwrap_or(0),
        })
    }).map_err(|e| e.to_string())?;
    
    Ok(stats)
}
