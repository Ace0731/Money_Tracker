use rusqlite::Result;
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountBalance {
    pub id: i64,
    pub name: String,
    pub account_type: String,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardData {
    pub total_balance: f64,
    pub bank_balance: f64,
    pub cash_balance: f64,
    pub investment_balance: f64,
    pub individual_accounts: Vec<AccountBalance>,
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
    let mut individual_accounts = Vec::new();
    
    // Get all accounts with their dynamic balances
    let mut accounts_stmt = conn.prepare("
        SELECT 
            id, name, type, opening_balance,
            (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = a.id) as incoming,
            (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = a.id) as outgoing
        FROM accounts a
        ORDER BY name
    ").map_err(|e| e.to_string())?;
    
    let accounts_data = accounts_stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
        let name: String = row.get(1)?;
        let account_type: String = row.get(2)?;
        let opening_balance: f64 = row.get(3)?;
        let incoming: f64 = row.get(4)?;
        let outgoing: f64 = row.get(5)?;
        
        let current_balance = opening_balance + incoming - outgoing;
        
        Ok((id, name, account_type, current_balance))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, rusqlite::Error>>().map_err(|e| e.to_string())?;
    
    for (account_id, account_name, account_type, current_balance) in accounts_data {
        let account_type_lower = account_type.to_lowercase();
        
        individual_accounts.push(AccountBalance {
            id: account_id,
            name: account_name,
            account_type: account_type.clone(),
            balance: current_balance,
        });

        match account_type_lower.as_str() {
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
        individual_accounts,
        current_month_income,
        current_month_expense,
        current_month_net: current_month_income - current_month_expense,
    })
}
