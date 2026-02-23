use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    pub id: Option<i64>,
    pub name: String,
    pub account_type: String,
    pub opening_balance: f64,
    pub current_balance: Option<f64>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_accounts(db: State<DbConnection>) -> Result<Vec<Account>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT 
                a.id, a.name, a.type, a.opening_balance, a.notes,
                a.opening_balance + 
                COALESCE((SELECT SUM(amount) FROM transactions WHERE to_account_id = a.id), 0) -
                COALESCE((SELECT SUM(amount) FROM transactions WHERE from_account_id = a.id), 0) as current_balance
            FROM accounts a 
            ORDER BY a.name
        ")
        .map_err(|e| e.to_string())?;
    
    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                account_type: row.get(2)?,
                opening_balance: row.get(3)?,
                current_balance: Some(row.get(5)?),
                notes: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(accounts)
}

#[tauri::command]
pub fn create_account(
    db: State<DbConnection>,
    account: Account,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO accounts (name, type, opening_balance, notes) VALUES (?1, ?2, ?3, ?4)",
        params![
            account.name,
            account.account_type,
            account.opening_balance,
            account.notes,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_account(
    db: State<DbConnection>,
    account: Account,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let id = account.id.ok_or("Account ID is required")?;
    
    conn.execute(
        "UPDATE accounts SET name = ?1, type = ?2, opening_balance = ?3, notes = ?4 WHERE id = ?5",
        params![
            account.name,
            account.account_type,
            account.opening_balance,
            account.notes,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
