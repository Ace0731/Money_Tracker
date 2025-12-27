use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub id: Option<i64>,
    pub date: String,
    pub amount: f64,
    pub direction: String,
    pub from_account_id: Option<i64>,
    pub to_account_id: Option<i64>,
    pub category_id: i64,
    pub client_id: Option<i64>,
    pub project_id: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionWithDetails {
    pub id: i64,
    pub date: String,
    pub amount: f64,
    pub direction: String,
    pub from_account_id: Option<i64>,
    pub from_account_name: Option<String>,
    pub to_account_id: Option<i64>,
    pub to_account_name: Option<String>,
    pub category_id: i64,
    pub category_name: String,
    pub client_id: Option<i64>,
    pub client_name: Option<String>,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TransactionFilters {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub direction: Option<String>,
}

#[tauri::command]
pub fn get_transactions(
    db: State<DbConnection>,
    filters: Option<TransactionFilters>,
) -> Result<Vec<TransactionWithDetails>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut sql = String::from(
        "SELECT 
            t.id, t.date, t.amount, t.direction,
            t.from_account_id, fa.name as from_account_name,
            t.to_account_id, ta.name as to_account_name,
            t.category_id, c.name as category_name,
            t.client_id, cl.name as client_name,
            t.project_id, p.name as project_name,
            t.notes
        FROM transactions t
        LEFT JOIN accounts fa ON t.from_account_id = fa.id
        LEFT JOIN accounts ta ON t.to_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN clients cl ON t.client_id = cl.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE 1=1"
    );
    
    if let Some(f) = &filters {
        if let Some(start) = &f.start_date {
            sql.push_str(&format!(" AND t.date >= '{}'", start));
        }
        if let Some(end) = &f.end_date {
            sql.push_str(&format!(" AND t.date <= '{}'", end));
        }
        if let Some(dir) = &f.direction {
            if !dir.is_empty() {
                sql.push_str(&format!(" AND t.direction = '{}'", dir));
            }
        }
    }
    
    sql.push_str(" ORDER BY t.date DESC, t.id DESC");
    
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut transactions = stmt
        .query_map([], |row| {
            Ok(TransactionWithDetails {
                id: row.get(0)?,
                date: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                from_account_id: row.get(4)?,
                from_account_name: row.get(5)?,
                to_account_id: row.get(6)?,
                to_account_name: row.get(7)?,
                category_id: row.get(8)?,
                category_name: row.get(9)?,
                client_id: row.get(10)?,
                client_name: row.get(11)?,
                project_id: row.get(12)?,
                project_name: row.get(13)?,
                notes: row.get(14)?,
                tags: Vec::new(), // Will be populated separately
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    // Load tags for each transaction
    for transaction in &mut transactions {
        let mut tag_stmt = conn
            .prepare("SELECT t.name FROM tags t JOIN transaction_tags tt ON t.id = tt.tag_id WHERE tt.transaction_id = ?1")
            .map_err(|e| e.to_string())?;
        
        let tags = tag_stmt
            .query_map([transaction.id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| e.to_string())?;
        
        transaction.tags = tags;
    }
    
    Ok(transactions)
}

#[tauri::command]
pub fn create_transaction(
    db: State<DbConnection>,
    transaction: Transaction,
    tag_ids: Vec<i64>,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO transactions (date, amount, direction, from_account_id, to_account_id, category_id, client_id, project_id, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            transaction.date,
            transaction.amount,
            transaction.direction,
            transaction.from_account_id,
            transaction.to_account_id,
            transaction.category_id,
            transaction.client_id,
            transaction.project_id,
            transaction.notes,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    let transaction_id = conn.last_insert_rowid();
    
    // Insert tags
    for tag_id in tag_ids {
        conn.execute(
            "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?1, ?2)",
            params![transaction_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    
    Ok(transaction_id)
}

#[tauri::command]
pub fn update_transaction(
    db: State<DbConnection>,
    transaction: Transaction,
    tag_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let id = transaction.id.ok_or("Transaction ID is required")?;
    
    conn.execute(
        "UPDATE transactions SET date = ?1, amount = ?2, direction = ?3, from_account_id = ?4, 
         to_account_id = ?5, category_id = ?6, client_id = ?7, project_id = ?8, notes = ?9 
         WHERE id = ?10",
        params![
            transaction.date,
            transaction.amount,
            transaction.direction,
            transaction.from_account_id,
            transaction.to_account_id,
            transaction.category_id,
            transaction.client_id,
            transaction.project_id,
            transaction.notes,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    // Update tags - delete and re-insert
    conn.execute(
        "DELETE FROM transaction_tags WHERE transaction_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    
    for tag_id in tag_ids {
        conn.execute(
            "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?1, ?2)",
            params![id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_transaction_tags(
    db: State<DbConnection>,
    transaction_id: i64,
) -> Result<Vec<i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT tag_id FROM transaction_tags WHERE transaction_id = ?1")
        .map_err(|e| e.to_string())?;
    
    let tags = stmt
        .query_map([transaction_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(tags)
}
