use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;
use chrono::{Datelike, Duration, Local, Months, NaiveDate};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduledTransaction {
    pub id: Option<i64>,
    pub name: String,
    pub amount: f64,
    pub tx_type: String, // sip, subscription, transfer, income
    pub frequency: String, // daily, weekly, monthly, yearly
    pub frequency_interval: i32,
    pub day_of_month: Option<i32>,
    pub day_of_week: Option<i32>,
    pub next_run_date: String,
    pub from_account_id: Option<i64>,
    pub to_account_id: Option<i64>,
    pub category_id: Option<i64>,
    pub investment_id: Option<i64>,
    pub is_active: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryBreakdown {
    pub name: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSummary {
    pub realized_income: f64,
    pub realized_expenses: f64,
    pub realized_investments: f64,
    pub realized_buckets: f64,
    pub expected_recurring_expenses: f64,
    pub expected_recurring_income: f64,
    pub expected_recurring_investments: f64,
    pub expected_recurring_buckets: f64,
    pub safe_to_spend: f64,
    pub breakdown_income: Vec<CategoryBreakdown>,
    pub breakdown_expenses: Vec<CategoryBreakdown>,
    pub breakdown_investments: Vec<CategoryBreakdown>,
    pub breakdown_buckets: Vec<CategoryBreakdown>,
}

#[tauri::command]
pub fn get_scheduled_transactions(db: State<DbConnection>) -> Result<Vec<ScheduledTransaction>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("
        SELECT id, name, amount, type, frequency, frequency_interval, 
               day_of_month, day_of_week, next_run_date, from_account_id, 
               to_account_id, category_id, investment_id, is_active, notes
        FROM scheduled_transactions
        ORDER BY next_run_date ASC
    ").map_err(|e| e.to_string())?;
    
    let items = stmt.query_map([], |row| {
        let is_act: i32 = row.get(13)?;
        Ok(ScheduledTransaction {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            amount: row.get(2)?,
            tx_type: row.get(3)?,
            frequency: row.get(4)?,
            frequency_interval: row.get(5)?,
            day_of_month: row.get(6)?,
            day_of_week: row.get(7)?,
            next_run_date: row.get(8)?,
            from_account_id: row.get(9)?,
            to_account_id: row.get(10)?,
            category_id: row.get(11)?,
            investment_id: row.get(12)?,
            is_active: is_act != 0,
            notes: row.get(14)?,
        })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    Ok(items)
}

#[tauri::command]
pub fn create_scheduled_transaction(db: State<DbConnection>, payload: ScheduledTransaction) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let is_act_int = if payload.is_active { 1 } else { 0 };
    
    conn.execute(
        "INSERT INTO scheduled_transactions 
         (name, amount, type, frequency, frequency_interval, day_of_month, day_of_week, 
          next_run_date, from_account_id, to_account_id, category_id, investment_id, is_active, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            payload.name, payload.amount, payload.tx_type, payload.frequency, payload.frequency_interval,
            payload.day_of_month, payload.day_of_week, payload.next_run_date,
            payload.from_account_id, payload.to_account_id, payload.category_id, payload.investment_id,
            is_act_int, payload.notes
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_scheduled_transaction(db: State<DbConnection>, payload: ScheduledTransaction) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = payload.id.ok_or("ID missing")?;
    let is_act_int = if payload.is_active { 1 } else { 0 };
    
    conn.execute(
        "UPDATE scheduled_transactions SET
         name=?1, amount=?2, type=?3, frequency=?4, frequency_interval=?5, day_of_month=?6, 
         day_of_week=?7, next_run_date=?8, from_account_id=?9, to_account_id=?10, category_id=?11, 
         investment_id=?12, is_active=?13, notes=?14
         WHERE id = ?15",
        params![
            payload.name, payload.amount, payload.tx_type, payload.frequency, payload.frequency_interval,
            payload.day_of_month, payload.day_of_week, payload.next_run_date,
            payload.from_account_id, payload.to_account_id, payload.category_id, payload.investment_id,
            is_act_int, payload.notes, id
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_scheduled_transaction(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM scheduled_transactions WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

fn calculate_next_date(current_date_str: &str, frequency: &str, interval: i32) -> Result<String, String> {
    let mut d = NaiveDate::parse_from_str(current_date_str, "%Y-%m-%d")
        .map_err(|_| "Invalid date format".to_string())?;

    match frequency {
        "daily" => {
            d += Duration::days(interval as i64);
        },
        "weekly" => {
            d += Duration::weeks(interval as i64);
        },
        "monthly" => {
            d = d.checked_add_months(Months::new(interval as u32)).unwrap_or(d);
        },
        "yearly" => {
            d = d.checked_add_months(Months::new(( interval * 12 ) as u32)).unwrap_or(d);
        },
        _ => {}
    }

    Ok(d.format("%Y-%m-%d").to_string())
}

#[tauri::command]
pub fn process_pending_schedules(db: State<DbConnection>) -> Result<i32, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let today = Local::now().format("%Y-%m-%d").to_string();
    
    // We cannot hold a mutable borrow inside the row iteration safely if we also want to mutate the DB.
    // So we collect the due records first.
    let mut due_items = Vec::new();
    {
        let mut stmt = conn.prepare("
            SELECT id, name, amount, type, frequency, frequency_interval, next_run_date, 
                   from_account_id, to_account_id, category_id, investment_id, notes, date(created_at)
            FROM scheduled_transactions
            WHERE is_active = 1 AND next_run_date <= ?1
        ").map_err(|e| e.to_string())?;

        let rows = stmt.query_map(params![today], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i32>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, Option<i64>>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, Option<i64>>(10)?,
                row.get::<_, Option<String>>(11)?,
                row.get::<_, String>(12)?, // created_at date
            ))
        }).map_err(|e| e.to_string())?;

        for r in rows {
            if let Ok(item) = r { due_items.push(item); }
        }
    }

    if due_items.is_empty() {
        return Ok(0);
    }
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut processed_count = 0;
    
    for (id, _name, amount, tx_type, freq, interval, run_date, from_acc, to_acc, cat_id, inv_id, notes, created_at_date) in due_items {
        // Prevent historical backfilling: Do not log transactions for historical dates that occurred before this rule even existed.
        let is_historical_backfill = run_date < created_at_date;

        if !is_historical_backfill {
            // Prepare mapped direction
            let mapped_dir = match tx_type.as_str() {
                "income" => "income",
                "subscription" => "expense",
                "transfer" | "sip" => "transfer",
                _ => "expense"
            };
            
            let tx_notes = format!("Auto-logged [{}]: {}", tx_type, notes.unwrap_or_default());
            let cat_val = cat_id.unwrap_or(1); // Default fallback category

            // Insert Transaction
            tx.execute(
                "INSERT INTO transactions (date, amount, direction, from_account_id, to_account_id, category_id, investment_id, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![run_date, amount, mapped_dir, from_acc, to_acc, cat_val, inv_id, tx_notes]
            ).map_err(|e| e.to_string())?;
        }

        // Calculate next date and aggressively fast-forward it if the schedule was deeply historical
        let mut next_date = calculate_next_date(&run_date, &freq, interval).unwrap_or(today.clone());
        while next_date <= today && is_historical_backfill {
            next_date = calculate_next_date(&next_date, &freq, interval).unwrap_or(today.clone());
        }

        // Update Scheduled Transaction Next Run Date
        tx.execute(
            "UPDATE scheduled_transactions SET next_run_date = ?1 WHERE id = ?2",
            params![next_date, id]
        ).map_err(|e| e.to_string())?;
        
        processed_count += 1;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(processed_count)
}

#[tauri::command]
pub fn get_monthly_budget(db: State<DbConnection>, year_month: String) -> Result<BudgetSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // We expect year_month as format "YYYY-MM"
    let start_date = format!("{}-01", year_month);
    let end_date = format!("{}-31", year_month); // works enough for sqlite strftime <= comparison
    
    // 1. Realized Income (from transactions direction income, only included categories)
    let realized_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.direction = 'income' AND c.include_in_budget = 1 
         AND t.date >= ?1 AND t.date <= ?2",
        params![start_date, end_date],
        |row| row.get(0)
    ).unwrap_or(0.0);
    
    // 2. Realized Expenses (only included categories)
    let realized_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.direction = 'expense'
         AND t.investment_id IS NULL
         AND (t.to_account_id IS NULL OR t.to_account_id NOT IN (SELECT id FROM accounts WHERE type IN ('bucket', 'investment')))
         AND c.include_in_budget = 1 
         AND t.date >= ?1 AND t.date <= ?2",
        params![start_date, end_date],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // 2b. Realized Investments (Exclude PF)
    let realized_investments: f64 = conn.query_row(
        "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
         JOIN categories c ON t.category_id = c.id
         LEFT JOIN investments i ON t.investment_id = i.id
         WHERE t.direction IN ('expense', 'transfer')
         AND (t.investment_id IS NOT NULL OR t.to_account_id IN (SELECT id FROM accounts WHERE type = 'investment'))
         AND (i.type IS NULL OR i.type != 'pf')
         AND t.from_account_id IN (SELECT id FROM accounts WHERE type IN ('bank', 'cash'))
         AND c.include_in_budget = 1 
         AND t.date >= ?1 AND t.date <= ?2",
        params![start_date, end_date],
        |row| row.get(0)
    ).unwrap_or(0.0);

    // 2c. Realized Buckets
    let realized_buckets: f64 = conn.query_row(
        "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.direction = 'transfer'
         AND t.to_account_id IN (SELECT id FROM accounts WHERE type = 'bucket')
         AND t.from_account_id IN (SELECT id FROM accounts WHERE type IN ('bank', 'cash'))
         AND c.include_in_budget = 1 
         AND t.date >= ?1 AND t.date <= ?2",
        params![start_date, end_date],
        |row| row.get(0)
    ).unwrap_or(0.0);
    
    // PREDICTIVE ENGINE FOR EXPECTED UPCOMING TRANSACTIONS
    // Instead of querying strictly if next_run_date falls in the month (which fails for future months), 
    // we fetch all active schedules and calculate their monthly equivalent weight.
    
    let mut expected_recurring_expenses = 0.0;
    let mut expected_recurring_investments = 0.0;
    let mut expected_recurring_buckets = 0.0;
    let mut expected_recurring_income = 0.0;

    let dt_target = chrono::NaiveDate::parse_from_str(&format!("{}-01", year_month), "%Y-%m-%d").unwrap_or_else(|_| chrono::Local::now().date_naive());
    let target_month_num = dt_target.month();

    let mut sched_stmt = conn.prepare("
        SELECT s.amount, s.type, s.frequency, s.frequency_interval, s.next_run_date, s.investment_id, s.to_account_id, i.type
        FROM scheduled_transactions s
        LEFT JOIN investments i ON s.investment_id = i.id
        WHERE s.is_active = 1
    ").map_err(|e| e.to_string())?;

    let iter = sched_stmt.query_map([], |row| {
        let amount: f64 = row.get(0)?;
        let tx_type: String = row.get(1)?;
        let freq: String = row.get(2)?;
        let _freq_int: i32 = row.get(3)?;
        let next_run: String = row.get(4)?;
        let inv_id: Option<i64> = row.get(5)?;
        let to_acc: Option<i64> = row.get(6)?;
        let inv_type: Option<String> = row.get(7)?;
        
        Ok((amount, tx_type, freq, next_run, inv_id, to_acc, inv_type))
    }).map_err(|e| e.to_string())?;

    for item in iter {
        if let Ok((amt, tx_type, freq, next_run, inv_id, to_acc, inv_type)) = item {
            // First check: Skip PF investments completely from budget flow
            if let Some(t) = inv_type {
                if t == "pf" { continue; }
            }

            // Second check: If the target month is BEFORE the schedule even starts, don't include it
            if let Ok(run_dt) = chrono::NaiveDate::parse_from_str(&next_run, "%Y-%m-%d") {
                // If run_dt's month is after target month, and it's in the same or future year, skip.
                if run_dt.year() > dt_target.year() || (run_dt.year() == dt_target.year() && run_dt.month() > target_month_num) {
                    continue;
                }
            }

            let mut monthly_weight = 0.0;
            match freq.as_str() {
                "daily" => monthly_weight = amt * 30.0,
                "weekly" => monthly_weight = amt * 4.33,
                "monthly" => monthly_weight = amt,
                "yearly" => {
                    // Check if run month aligns with this target month
                    if let Ok(run_dt) = chrono::NaiveDate::parse_from_str(&next_run, "%Y-%m-%d") {
                        if run_dt.month() == target_month_num {
                            monthly_weight = amt;
                        }
                    }
                },
                _ => {}
            }

            if monthly_weight > 0.0 {
                if tx_type == "income" {
                    expected_recurring_income += monthly_weight;
                } else if tx_type == "sip" || inv_id.is_some() {
                    expected_recurring_investments += monthly_weight;
                } else {
                    // It's a transfer or subscription. Need to identify if target is bucket.
                    let mut is_bucket = false;
                    let mut is_inv_acc = false;
                    if let Some(acc_id) = to_acc {
                        let acc_type: Result<String, _> = conn.query_row("SELECT type FROM accounts WHERE id = ?1", params![acc_id], |r| r.get(0));
                        if let Ok(t) = acc_type {
                            if t == "bucket" { is_bucket = true; }
                            if t == "investment" { is_inv_acc = true; }
                        }
                    }

                    if is_inv_acc {
                        expected_recurring_investments += monthly_weight;
                    } else if is_bucket {
                        expected_recurring_buckets += monthly_weight;
                    } else {
                        expected_recurring_expenses += monthly_weight;
                    }
                }
            }
        }
    }
    
    let safe_to_spend = (realized_income + expected_recurring_income) - (realized_expenses + expected_recurring_expenses + realized_investments + expected_recurring_investments + realized_buckets + expected_recurring_buckets);

    // CATEGORY BREAKDOWNS (REALIZED)
    let mut breakdown_income = Vec::new();
    let mut stmt = conn.prepare("
        SELECT c.name, COALESCE(SUM(t.amount), 0)
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.direction = 'income' AND c.include_in_budget = 1 AND t.date >= ?1 AND t.date <= ?2
        GROUP BY c.name ORDER BY SUM(t.amount) DESC
    ").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![start_date, end_date]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        breakdown_income.push(CategoryBreakdown { 
            name: row.get::<_, String>(0).map_err(|e| e.to_string())?, 
            amount: row.get::<_, f64>(1).map_err(|e| e.to_string())? 
        });
    }

    let mut breakdown_expenses = Vec::new();
    let mut stmt = conn.prepare("
        SELECT c.name, COALESCE(SUM(t.amount), 0)
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.direction = 'expense' AND t.investment_id IS NULL
        AND (t.to_account_id IS NULL OR t.to_account_id NOT IN (SELECT id FROM accounts WHERE type IN ('bucket', 'investment')))
        AND c.include_in_budget = 1 AND t.date >= ?1 AND t.date <= ?2
        GROUP BY c.name ORDER BY SUM(t.amount) DESC
    ").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![start_date, end_date]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        breakdown_expenses.push(CategoryBreakdown { 
            name: row.get::<_, String>(0).map_err(|e| e.to_string())?, 
            amount: row.get::<_, f64>(1).map_err(|e| e.to_string())? 
        });
    }

    let mut breakdown_investments = Vec::new();
    let mut stmt = conn.prepare("
        SELECT c.name, COALESCE(SUM(t.amount), 0)
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN investments i ON t.investment_id = i.id
        WHERE t.direction IN ('expense', 'transfer')
        AND (t.investment_id IS NOT NULL OR t.to_account_id IN (SELECT id FROM accounts WHERE type = 'investment'))
        AND (i.type IS NULL OR i.type != 'pf')
        AND t.from_account_id IN (SELECT id FROM accounts WHERE type IN ('bank', 'cash'))
        AND c.include_in_budget = 1 AND t.date >= ?1 AND t.date <= ?2
        GROUP BY c.name ORDER BY SUM(t.amount) DESC
    ").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![start_date, end_date]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        breakdown_investments.push(CategoryBreakdown { 
            name: row.get::<_, String>(0).map_err(|e| e.to_string())?, 
            amount: row.get::<_, f64>(1).map_err(|e| e.to_string())? 
        });
    }

    let mut breakdown_buckets = Vec::new();
    let mut stmt = conn.prepare("
        SELECT c.name, COALESCE(SUM(t.amount), 0)
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.direction = 'transfer' AND t.to_account_id IN (SELECT id FROM accounts WHERE type = 'bucket')
        AND t.from_account_id IN (SELECT id FROM accounts WHERE type IN ('bank', 'cash'))
        AND c.include_in_budget = 1 AND t.date >= ?1 AND t.date <= ?2
        GROUP BY c.name ORDER BY SUM(t.amount) DESC
    ").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![start_date, end_date]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        breakdown_buckets.push(CategoryBreakdown { 
            name: row.get::<_, String>(0).map_err(|e| e.to_string())?, 
            amount: row.get::<_, f64>(1).map_err(|e| e.to_string())? 
        });
    }

    Ok(BudgetSummary {
        realized_income,
        realized_expenses,
        realized_investments,
        realized_buckets,
        expected_recurring_expenses,
        expected_recurring_income,
        expected_recurring_investments,
        expected_recurring_buckets,
        safe_to_spend,
        breakdown_income,
        breakdown_expenses,
        breakdown_investments,
        breakdown_buckets,
    })
}
