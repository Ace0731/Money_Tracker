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
pub struct CategoryBreakdown {
    pub category_name: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardGoal {
    pub id: i64,
    pub name: String,
    pub bucket_name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub status: String,
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
    pub active_goals_count: i64,
    pub completed_goals_count: i64,
    pub goals: Vec<DashboardGoal>,
    pub breakdowns: std::collections::HashMap<String, Vec<CategoryBreakdown>>,
}

#[tauri::command]
pub fn get_dashboard_data(db: State<DbConnection>) -> Result<DashboardData, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Simple approach: calculate balances directly
    let mut bank_balance = 0.0;
    let mut cash_balance = 0.0;
    let mut investment_balance = 0.0;
    let mut individual_accounts = Vec::new();
    
    // Get all accounts with their dynamic balances (recursive for parents)
    let mut accounts_stmt = conn.prepare("
        SELECT 
            id, name, type, opening_balance, parent_id,
            (
                SELECT COALESCE(SUM(amount), 0) FROM transactions 
                WHERE to_account_id = a.id 
                OR to_account_id IN (SELECT id FROM accounts WHERE parent_id = a.id)
            ) as incoming,
            (
                SELECT COALESCE(SUM(amount), 0) FROM transactions 
                WHERE from_account_id = a.id 
                OR from_account_id IN (SELECT id FROM accounts WHERE parent_id = a.id)
            ) as outgoing
        FROM accounts a
        ORDER BY name
    ").map_err(|e| e.to_string())?;
    
    let accounts_data = accounts_stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
        let name: String = row.get(1)?;
        let account_type: String = row.get(2)?;
        let opening_balance: f64 = row.get(3)?;
        let parent_id: Option<i64> = row.get(4)?;
        let incoming: f64 = row.get(5)?;
        let outgoing: f64 = row.get(6)?;
        
        let current_balance = opening_balance + incoming - outgoing;
        
        Ok((id, name, account_type, current_balance, parent_id))
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, rusqlite::Error>>().map_err(|e| e.to_string())?;
    
    for (account_id, account_name, account_type, current_balance, parent_id) in accounts_data {
        let account_type_lower = account_type.to_lowercase();
        
        individual_accounts.push(AccountBalance {
            id: account_id,
            name: account_name,
            account_type: account_type.clone(),
            balance: current_balance,
        });

        // Don't add buckets to total balances (they are already included in parents)
        // unless they are independent? (User said they are partitions)
        if parent_id.is_some() {
            continue; 
        }

        match account_type_lower.as_str() {
            "bank" => bank_balance += current_balance,
            "cash" => cash_balance += current_balance,
            "investment" => investment_balance += current_balance,
            "bucket" => {}, // Buckets are already handled if they have parents
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
    
    // Get Goal stats
    let active_goals_count: i64 = conn.query_row("SELECT COUNT(*) FROM goals WHERE status = 'active'", [], |r| r.get(0)).unwrap_or(0);
    let completed_goals_count: i64 = conn.query_row("SELECT COUNT(*) FROM goals WHERE status = 'completed'", [], |r| r.get(0)).unwrap_or(0);

    // Get Active Goals details
    let mut goals_stmt = conn.prepare("
        SELECT g.id, g.name, a.name, g.target_amount, g.current_amount, g.status
        FROM goals g
        JOIN accounts a ON g.bucket_id = a.id
        WHERE g.status = 'active'
        LIMIT 5
    ").map_err(|e| e.to_string())?;
    
    let goals = goals_stmt.query_map([], |row| {
        Ok(DashboardGoal {
            id: row.get(0)?,
            name: row.get(1)?,
            bucket_name: row.get(2)?,
            target_amount: row.get(3)?,
            current_amount: row.get(4)?,
            status: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, rusqlite::Error>>().map_err(|e| e.to_string())?;

    // Get breakdowns per account type (by category)
    // This is complex, we'll group by category and account type
    let mut breakdowns = std::collections::HashMap::new();
    let types = vec!["bank", "cash", "investment"];
    
    for t in types {
        let mut b_stmt = conn.prepare("
            SELECT c.name, SUM(t.amount) 
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            JOIN accounts a ON (t.to_account_id = a.id OR t.from_account_id = a.id)
            WHERE (LOWER(a.type) = ?1 OR a.parent_id IN (SELECT id FROM accounts WHERE LOWER(type) = ?1))
            AND (
                (t.direction = 'income' AND t.to_account_id = a.id)
                OR (t.direction = 'expense' AND t.from_account_id = a.id)
            )
            GROUP BY c.name
            ORDER BY SUM(t.amount) DESC
        ").map_err(|e| e.to_string())?;
        
        let sums = b_stmt.query_map([t], |row| {
            Ok(CategoryBreakdown {
                category_name: row.get(0)?,
                amount: row.get(1)?,
            })
        }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, rusqlite::Error>>().map_err(|e| e.to_string())?;
        
        breakdowns.insert(t.to_string(), sums);
    }

    Ok(DashboardData {
        total_balance,
        bank_balance,
        cash_balance,
        investment_balance,
        individual_accounts,
        current_month_income,
        current_month_expense,
        current_month_net: current_month_income - current_month_expense,
        active_goals_count,
        completed_goals_count,
        goals,
        breakdowns,
    })
}
