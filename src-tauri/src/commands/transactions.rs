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
    pub investment_id: Option<i64>,
    pub goal_id: Option<i64>,
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
    pub investment_id: Option<i64>,
    pub investment_name: Option<String>,
    pub goal_id: Option<i64>,
    pub goal_name: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub category_is_investment: bool,
}

#[derive(Debug, Deserialize)]
pub struct TransactionFilters {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub direction: Option<String>,
    pub from_account_id: Option<i64>,
    pub to_account_id: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AccountBalance {
    pub account_id: i64,
    pub account_name: String,
    pub account_type: String,
    pub opening_balance: f64,
    pub current_balance: f64,
}

#[derive(Debug, Serialize)]
pub struct TransactionBalances {
    pub accounts: Vec<AccountBalance>,
    pub total_opening_balance: f64,
    pub total_current_balance: f64,
}

#[tauri::command]
pub fn get_transaction_balances(
    db: State<DbConnection>,
    filters: Option<TransactionFilters>,
) -> Result<TransactionBalances, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Get all accounts with their opening balances, names, and types
    let mut stmt = conn
        .prepare("SELECT id, name, type, opening_balance FROM accounts ORDER BY name")
        .map_err(|e| e.to_string())?;
    
    let accounts: Vec<(i64, String, String, f64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    let mut account_balances = Vec::new();
    let mut total_opening_balance = 0.0;
    let mut total_current_balance = 0.0;
    
    // Get start date from filters or use current month start
    let start_date = if let Some(ref f) = filters {
        f.start_date.clone()
    } else {
        None
    };
    
    let end_date = if let Some(ref f) = filters {
        f.end_date.clone()
    } else {
        None
    };
    
    // Calculate balances for each account
    for (account_id, account_name, account_type, account_opening_balance) in accounts {
        // Calculate balance at start of period (opening balance)
        let incoming_before: f64 = if let Some(ref start) = start_date {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ?1 AND date < ?2",
                params![account_id, start.clone()],
                |row| row.get(0)
            ).unwrap_or(0.0)
        } else {
            0.0
        };
        
        let outgoing_before: f64 = if let Some(ref start) = start_date {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = ?1 AND date < ?2",
                params![account_id, start.clone()],
                |row| row.get(0)
            ).unwrap_or(0.0)
        } else {
            0.0
        };
        
        let account_opening = account_opening_balance + incoming_before - outgoing_before;
        
        // Calculate balance at end of period (current balance)
        let incoming_upto: f64 = if let Some(ref end) = end_date {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ?1 AND date <= ?2",
                params![account_id, end.clone()],
                |row| row.get(0)
            ).unwrap_or(0.0)
        } else {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ?1",
                [account_id],
                |row| row.get(0)
            ).unwrap_or(0.0)
        };
        
        let outgoing_upto: f64 = if let Some(ref end) = end_date {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = ?1 AND date <= ?2",
                params![account_id, end.clone()],
                |row| row.get(0)
            ).unwrap_or(0.0)
        } else {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = ?1",
                [account_id],
                |row| row.get(0)
            ).unwrap_or(0.0)
        };
        
        let account_current = account_opening_balance + incoming_upto - outgoing_upto;
        
        // Add to totals
        total_opening_balance += account_opening;
        total_current_balance += account_current;
        
        // Add account balance to result
        account_balances.push(AccountBalance {
            account_id,
            account_name,
            account_type,
            opening_balance: account_opening,
            current_balance: account_current,
        });
    }
    
    Ok(TransactionBalances {
        accounts: account_balances,
        total_opening_balance,
        total_current_balance,
    })
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
            t.investment_id, i.name as investment_name,
            t.goal_id, g.name as goal_name,
            t.notes, c.is_investment as category_is_investment
        FROM transactions t
        LEFT JOIN accounts fa ON t.from_account_id = fa.id
        LEFT JOIN accounts ta ON t.to_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN clients cl ON t.client_id = cl.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN investments i ON t.investment_id = i.id
        LEFT JOIN goals g ON t.goal_id = g.id
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
        if let Some(from_id) = f.from_account_id {
            sql.push_str(&format!(" AND t.from_account_id = {}", from_id));
        }
        if let Some(to_id) = f.to_account_id {
            sql.push_str(&format!(" AND t.to_account_id = {}", to_id));
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
                investment_id: row.get(14)?,
                investment_name: row.get(15)?,
                goal_id: row.get(16)?,
                goal_name: row.get(17)?,
                notes: row.get(18)?,
                category_is_investment: row.get::<_, i32>(19)? != 0,
                tags: Vec::new(),
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
    
    let mut from_account_id = transaction.from_account_id;
    let mut to_account_id = transaction.to_account_id;

    // Sanitize account IDs based on direction
    match transaction.direction.as_str() {
        "income" => from_account_id = None,
        "expense" => to_account_id = None,
        _ => {} // Transfers keep both
    }

    conn.execute(
        "INSERT INTO transactions (date, amount, direction, from_account_id, to_account_id, category_id, client_id, project_id, investment_id, notes, goal_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            transaction.date,
            transaction.amount,
            transaction.direction,
            from_account_id,
            to_account_id,
            transaction.category_id,
            transaction.client_id,
            transaction.project_id,
            transaction.investment_id,
            transaction.notes,
            transaction.goal_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    let transaction_id = conn.last_insert_rowid();

    // AUTO-ALLOCATION HOOK
    if transaction.direction == "income" {
        if let Some(target_acc_id) = to_account_id {
            let _ = auto_allocate_if_matched(&conn, target_acc_id, transaction.category_id, transaction.amount, &transaction.date);
        }
    }
    
    // Insert tags
    for tag_id in tag_ids {
        conn.execute(
            "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?1, ?2)",
            params![transaction_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }
    
    if let Some(gid) = transaction.goal_id {
        let _ = sync_goal_progress(&conn, gid);
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
    
    let old_goal_id: Option<i64> = conn.query_row(
        "SELECT goal_id FROM transactions WHERE id = ?1",
        [id],
        |row| row.get(0)
    ).unwrap_or(None);

    let mut from_account_id = transaction.from_account_id;
    let mut to_account_id = transaction.to_account_id;

    // Sanitize account IDs based on direction
    match transaction.direction.as_str() {
        "income" => from_account_id = None,
        "expense" => to_account_id = None,
        _ => {} // Transfers keep both
    }

    conn.execute(
        "UPDATE transactions SET date = ?1, amount = ?2, direction = ?3, from_account_id = ?4, 
         to_account_id = ?5, category_id = ?6, client_id = ?7, project_id = ?8, investment_id = ?9, 
         goal_id = ?10, notes = ?11 
         WHERE id = ?12",
        params![
            transaction.date,
            transaction.amount,
            transaction.direction,
            from_account_id,
            to_account_id,
            transaction.category_id,
            transaction.client_id,
            transaction.project_id,
            transaction.investment_id,
            transaction.goal_id,
            transaction.notes,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    if let Some(og) = old_goal_id {
        let _ = sync_goal_progress(&conn, og);
    }
    if let Some(ng) = transaction.goal_id {
        if Some(ng) != old_goal_id {
            let _ = sync_goal_progress(&conn, ng);
        }
    }

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
fn auto_allocate_if_matched(conn: &rusqlite::Connection, account_id: i64, cat_id: i64, amount: f64, date: &str) -> Result<(), String> {
    // 1. Fetch settings
    let (target, trigger_cat, enabled): (f64, Option<i64>, i32) = conn.query_row(
        "SELECT emergency_target, trigger_category_id, is_enabled FROM bucket_allocation_settings WHERE id = 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))
    ).unwrap_or((100000.0, None, 0));

    if enabled == 0 { return Ok(()); }
    if let Some(triggered_cat) = trigger_cat {
        if cat_id != triggered_cat { return Ok(()); }
    } else {
        return Ok(()); // No trigger set
    }

    // 2. Find bucket IDs for roles linked to this parent account
    let mut emergency_id = None;
    let mut asset_id = None;
    let mut travel_id = None;

    let mut stmt = conn.prepare("SELECT id, bucket_role FROM accounts WHERE parent_id = ?1").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([account_id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    for row in rows {
        if let Ok((id, role)) = row {
            match role.as_str() {
                "emergency" => emergency_id = Some(id),
                "asset" => asset_id = Some(id),
                "travel" => travel_id = Some(id),
                _ => {}
            }
        }
    }

    if emergency_id.is_none() || asset_id.is_none() || travel_id.is_none() {
        return Ok(()); // Need all 3 for the formula
    }

    // 3. Get current emergency balance
    let em_id = emergency_id.unwrap();
    let opening: f64 = conn.query_row("SELECT opening_balance FROM accounts WHERE id = ?1", [em_id], |r| r.get(0)).unwrap_or(0.0);
    let incoming: f64 = conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ?1", [em_id], |r| r.get(0)).unwrap_or(0.0);
    let outgoing: f64 = conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = ?1", [em_id], |r| r.get(0)).unwrap_or(0.0);
    let current_em_bal = opening + incoming - outgoing;

    // 4. Get percentages from dynamic rules
    let (per_em, per_asset, per_travel): (f64, f64, f64) = if current_em_bal < target * 0.5 {
        conn.query_row("SELECT emergency_pc, asset_pc, travel_pc FROM allocation_rules WHERE tier = 1", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).map_err(|e| e.to_string())?
    } else if current_em_bal < target {
        conn.query_row("SELECT emergency_pc, asset_pc, travel_pc FROM allocation_rules WHERE tier = 2", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).map_err(|e| e.to_string())?
    } else {
        conn.query_row("SELECT emergency_pc, asset_pc, travel_pc FROM allocation_rules WHERE tier = 3", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))).map_err(|e| e.to_string())?
    };

    let amt_em = amount * per_em;
    let amt_asset = amount * per_asset;
    let amt_travel = amount * per_travel;

    // 5. Create transfers
    let splits = vec![
        (emergency_id, amt_em, "Auto-Allocation: Emergency"),
        (asset_id, amt_asset, "Auto-Allocation: Asset"),
        (travel_id, amt_travel, "Auto-Allocation: Travel"),
    ];

    for (target_id, amt, note) in splits {
        if let Some(tid) = target_id {
            if amt > 0.0 {
                let _ = conn.execute(
                    "INSERT INTO transactions (date, amount, direction, from_account_id, to_account_id, category_id, notes)
                     VALUES (?1, ?2, 'transfer', ?3, ?4, ?5, ?6)",
                    params![date, amt, account_id, tid, cat_id, note],
                );
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn delete_transaction(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let goal_id: Option<i64> = conn.query_row(
        "SELECT goal_id FROM transactions WHERE id = ?1",
        [id],
        |row| row.get(0)
    ).unwrap_or(None);

    conn.execute("DELETE FROM transaction_tags WHERE transaction_id = ?1", [id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transactions WHERE id = ?1", [id]).map_err(|e| e.to_string())?;

    if let Some(gid) = goal_id {
        let _ = sync_goal_progress(&conn, gid);
    }
    
    Ok(())
}

fn sync_goal_progress(conn: &rusqlite::Connection, goal_id: i64) -> Result<(), String> {
    // 1. Get goal info
    let (target, _bucket_id): (f64, i64) = conn.query_row(
        "SELECT target_amount, bucket_id FROM goals WHERE id = ?1",
        [goal_id],
        |r| Ok((r.get(0)?, r.get(1)?))
    ).map_err(|e| e.to_string())?;

    // 2. Sum net contributions linked to this goal
    let incoming: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = (SELECT bucket_id FROM goals WHERE id = ?1) AND goal_id = ?1",
        [goal_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let outgoing: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = (SELECT bucket_id FROM goals WHERE id = ?1) AND goal_id = ?1",
        [goal_id],
        |r| r.get(0)
    ).unwrap_or(0.0);

    let current = incoming - outgoing;
    let status = if current >= target { "completed" } else { "active" };

    conn.execute(
        "UPDATE goals SET current_amount = ?1, status = ?2 WHERE id = ?3",
        params![current, status, goal_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
