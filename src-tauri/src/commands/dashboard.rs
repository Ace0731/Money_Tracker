use rusqlite::Result;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardData {
    pub total_balance: f64,
    pub bank_balance: f64,
    pub cash_balance: f64,
    pub investment_balance: f64,
    pub current_month_income: f64,
    pub current_month_expense: f64,
    pub current_month_net: f64,
}

#[tauri::command]
pub fn get_dashboard_data(db: State<DbConnection>) -> Result<DashboardData, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Simple approach: calculate balances directly
    let mut bank_balance = 0.0;
    let mut cash_balance = 0.0;
    let mut investment_balance = 0.0;
    
    // Get all accounts
    let mut accounts_stmt = conn.prepare(
        "SELECT id, type, opening_balance FROM accounts"
    ).map_err(|e| e.to_string())?;
    
    let accounts_iter = accounts_stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
    }).map_err(|e| e.to_string())?;
    
    for account_result in accounts_iter {
        let (account_id, account_type, opening_balance) = account_result.map_err(|e| e.to_string())?;
        
        // Get incoming transactions
        let incoming: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ?1",
            [account_id],
            |row| row.get(0)
        ).unwrap_or(0.0);
        
        // Get outgoing transactions
        let outgoing: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = ?1",
            [account_id],
            |row| row.get(0)
        ).unwrap_or(0.0);
        
        let current_balance = opening_balance + incoming - outgoing;
        
        match account_type.as_str() {
            "bank" => bank_balance += current_balance,
            "cash" => cash_balance += current_balance,
            "investment" => investment_balance += current_balance,
            _ => {}
        }
    }
    
    // Get current month stats
    let current_month_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions 
         WHERE direction = 'income' 
         AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')",
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);
    
    let current_month_expense: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions 
         WHERE direction = 'expense' 
         AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')",
        [],
        |row| row.get(0)
    ).unwrap_or(0.0);
    
    let total_balance = bank_balance + cash_balance + investment_balance;
    
    Ok(DashboardData {
        total_balance,
        bank_balance,
        cash_balance,
        investment_balance,
        current_month_income,
        current_month_expense,
        current_month_net: current_month_income - current_month_expense,
    })
}
