use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

// ============ INVESTMENT RATES (NPS/PPF) ============

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvestmentRate {
    pub id: Option<i64>,
    pub investment_type: String,  // 'nps' or 'ppf'
    pub rate: f64,
    pub effective_date: String,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_investment_rates(db: State<DbConnection>, investment_type: Option<String>) -> Result<Vec<InvestmentRate>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let query = match &investment_type {
        Some(_) => "SELECT id, investment_type, rate, effective_date, notes FROM investment_rates WHERE investment_type = ?1 ORDER BY effective_date DESC",
        None => "SELECT id, investment_type, rate, effective_date, notes FROM investment_rates ORDER BY effective_date DESC",
    };
    
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    
    let rates = if let Some(inv_type) = investment_type {
        stmt.query_map([inv_type], |row| {
            Ok(InvestmentRate {
                id: row.get(0)?,
                investment_type: row.get(1)?,
                rate: row.get(2)?,
                effective_date: row.get(3)?,
                notes: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], |row| {
            Ok(InvestmentRate {
                id: row.get(0)?,
                investment_type: row.get(1)?,
                rate: row.get(2)?,
                effective_date: row.get(3)?,
                notes: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    
    Ok(rates)
}

#[tauri::command]
pub fn add_investment_rate(db: State<DbConnection>, rate: InvestmentRate) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO investment_rates (investment_type, rate, effective_date, notes) VALUES (?1, ?2, ?3, ?4)",
        params![rate.investment_type, rate.rate, rate.effective_date, rate.notes],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_investment_rate(db: State<DbConnection>, rate: InvestmentRate) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = rate.id.ok_or("Rate ID is required")?;
    
    conn.execute(
        "UPDATE investment_rates SET investment_type = ?1, rate = ?2, effective_date = ?3, notes = ?4 WHERE id = ?5",
        params![rate.investment_type, rate.rate, rate.effective_date, rate.notes, id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_investment_rate(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM investment_rates WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ============ BUDGET SETTINGS ============

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSettings {
    pub salary_date: i32,
}

#[tauri::command]
pub fn get_budget_settings(db: State<DbConnection>) -> Result<BudgetSettings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let salary_date: i32 = conn.query_row(
        "SELECT salary_date FROM budget_settings WHERE id = 1",
        [],
        |r| r.get(0)
    ).unwrap_or(1);
    
    Ok(BudgetSettings { salary_date })
}

#[tauri::command]
pub fn update_budget_settings(db: State<DbConnection>, settings: BudgetSettings) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE budget_settings SET salary_date = ?1 WHERE id = 1",
        [settings.salary_date],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

// ============ MONTHLY INCOME ============

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlyIncome {
    pub id: Option<i64>,
    pub month: String,
    pub expected_income: f64,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_monthly_income(db: State<DbConnection>, month: String) -> Result<Option<MonthlyIncome>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let result = conn.query_row(
        "SELECT id, month, expected_income, notes FROM monthly_income WHERE month = ?1",
        [&month],
        |row| Ok(MonthlyIncome {
            id: row.get(0)?,
            month: row.get(1)?,
            expected_income: row.get(2)?,
            notes: row.get(3)?,
        })
    );
    
    match result {
        Ok(income) => Ok(Some(income)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_monthly_income(db: State<DbConnection>, income: MonthlyIncome) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO monthly_income (month, expected_income, notes) VALUES (?1, ?2, ?3)
         ON CONFLICT(month) DO UPDATE SET expected_income = excluded.expected_income, notes = excluded.notes",
        params![income.month, income.expected_income, income.notes],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

// ============ CATEGORY BUDGETS ============

#[derive(Debug, Serialize, Deserialize)]
pub struct Budget {
    pub id: Option<i64>,
    pub month: String,
    pub category_id: i64,
    pub budgeted_amount: f64,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn get_budgets(db: State<DbConnection>, month: String) -> Result<Vec<Budget>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, month, category_id, budgeted_amount, notes FROM budgets WHERE month = ?1"
    ).map_err(|e| e.to_string())?;
    
    let budgets = stmt.query_map([month], |row| {
        Ok(Budget {
            id: row.get(0)?,
            month: row.get(1)?,
            category_id: row.get(2)?,
            budgeted_amount: row.get(3)?,
            notes: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    Ok(budgets)
}

#[tauri::command]
pub fn set_budget(db: State<DbConnection>, budget: Budget) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO budgets (month, category_id, budgeted_amount, notes) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(month, category_id) DO UPDATE SET budgeted_amount = excluded.budgeted_amount, notes = excluded.notes",
        params![budget.month, budget.category_id, budget.budgeted_amount, budget.notes],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn delete_budget(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM budgets WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ============ BUDGET SUMMARY ============

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryBudgetSummary {
    pub category_id: i64,
    pub category_name: String,
    pub category_kind: String,
    pub budgeted: f64,
    pub actual: f64,
    pub remaining: f64,
    pub is_over_budget: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetSummary {
    pub month: String,
    pub salary_date: i32,
    pub expected_income: f64,
    pub actual_income: f64,
    pub total_budgeted: f64,
    pub total_spent: f64,
    pub total_invested: f64,
    pub savings: f64,
    pub savings_rate: f64,
    pub income_categories: Vec<CategoryBudgetSummary>,
    pub expense_categories: Vec<CategoryBudgetSummary>,
    pub investment_categories: Vec<CategoryBudgetSummary>,
}

#[tauri::command]
pub fn get_budget_summary(db: State<DbConnection>, month: String) -> Result<BudgetSummary, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // Get salary date
    let salary_date: i32 = conn.query_row(
        "SELECT salary_date FROM budget_settings WHERE id = 1",
        [],
        |r| r.get(0)
    ).unwrap_or(1);
    
    // Get expected income
    let expected_income: f64 = conn.query_row(
        "SELECT expected_income FROM monthly_income WHERE month = ?1",
        [&month],
        |r| r.get(0)
    ).unwrap_or(0.0);
    
    // Calculate date range based on salary date
    let (start_date, end_date) = calculate_budget_period(&month, salary_date);
    
    // Get actual income
    let actual_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE direction = 'income' AND date >= ?1 AND date <= ?2",
        params![start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);
    
    // Get total expenses
    let total_spent: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE direction = 'expense' AND date >= ?1 AND date <= ?2",
        params![start_date, end_date],
        |r| r.get(0)
    ).unwrap_or(0.0);
    
    // Get INCOME category budgets with actuals
    let mut income_stmt = conn.prepare(
        "SELECT c.id, c.name, c.kind, COALESCE(b.budgeted_amount, 0) as budgeted,
                COALESCE(SUM(CASE WHEN t.direction = 'income' AND t.date >= ?2 AND t.date <= ?3 THEN t.amount ELSE 0 END), 0) as actual
         FROM categories c
         LEFT JOIN budgets b ON c.id = b.category_id AND b.month = ?1
         LEFT JOIN transactions t ON c.id = t.category_id
         WHERE c.kind = 'income'
         GROUP BY c.id, c.name, c.kind, b.budgeted_amount
         ORDER BY c.name"
    ).map_err(|e| e.to_string())?;
    
    let income_categories: Vec<CategoryBudgetSummary> = income_stmt.query_map(
        params![month, start_date, end_date],
        |row| {
            let budgeted: f64 = row.get(3)?;
            let actual: f64 = row.get(4)?;
            let remaining = actual - budgeted; // For income, actual > budgeted is good
            Ok(CategoryBudgetSummary {
                category_id: row.get(0)?,
                category_name: row.get(1)?,
                category_kind: row.get(2)?,
                budgeted,
                actual,
                remaining,
                is_over_budget: false, // N/A for income
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    // Get EXPENSE category budgets with actuals
    let mut expense_stmt = conn.prepare(
        "SELECT c.id, c.name, c.kind, COALESCE(b.budgeted_amount, 0) as budgeted,
                COALESCE(SUM(CASE WHEN t.direction = 'expense' AND t.date >= ?2 AND t.date <= ?3 THEN t.amount ELSE 0 END), 0) as actual
         FROM categories c
         LEFT JOIN budgets b ON c.id = b.category_id AND b.month = ?1
         LEFT JOIN transactions t ON c.id = t.category_id
         WHERE c.kind = 'expense'
         GROUP BY c.id, c.name, c.kind, b.budgeted_amount
         ORDER BY c.name"
    ).map_err(|e| e.to_string())?;
    
    let expense_categories: Vec<CategoryBudgetSummary> = expense_stmt.query_map(
        params![month, start_date, end_date],
        |row| {
            let budgeted: f64 = row.get(3)?;
            let actual: f64 = row.get(4)?;
            let remaining = budgeted - actual;
            Ok(CategoryBudgetSummary {
                category_id: row.get(0)?,
                category_name: row.get(1)?,
                category_kind: row.get(2)?,
                budgeted,
                actual,
                remaining,
                is_over_budget: actual > budgeted && budgeted > 0.0,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    // Get INVESTMENT category budgets with actuals (categories marked as investments)
    let mut investment_stmt = conn.prepare(
        "SELECT c.id, c.name, c.kind, COALESCE(b.budgeted_amount, 0) as budgeted,
                COALESCE(SUM(CASE WHEN t.date >= ?2 AND t.date <= ?3 THEN t.amount ELSE 0 END), 0) as actual
         FROM categories c
         LEFT JOIN budgets b ON c.id = b.category_id AND b.month = ?1
         LEFT JOIN transactions t ON c.id = t.category_id
         WHERE COALESCE(c.is_investment, 0) = 1
         GROUP BY c.id, c.name, c.kind, b.budgeted_amount
         ORDER BY c.name"
    ).map_err(|e| e.to_string())?;
    
    let investment_categories: Vec<CategoryBudgetSummary> = investment_stmt.query_map(
        params![month, start_date, end_date],
        |row| {
            let budgeted: f64 = row.get(3)?;
            let actual: f64 = row.get(4)?;
            let remaining = budgeted - actual;
            Ok(CategoryBudgetSummary {
                category_id: row.get(0)?,
                category_name: row.get(1)?,
                category_kind: row.get(2)?,
                budgeted,
                actual,
                remaining,
                is_over_budget: actual > budgeted && budgeted > 0.0,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    let total_budgeted: f64 = expense_categories.iter().map(|c| c.budgeted).sum();
    let total_investment_budgeted: f64 = investment_categories.iter().map(|c| c.budgeted).sum();
    let total_actual_invested: f64 = investment_categories.iter().map(|c| c.actual).sum();
    let savings = actual_income - total_spent - total_actual_invested;
    let savings_rate = if actual_income > 0.0 { (savings / actual_income) * 100.0 } else { 0.0 };
    
    Ok(BudgetSummary {
        month,
        salary_date,
        expected_income,
        actual_income,
        total_budgeted: total_budgeted + total_investment_budgeted,
        total_spent,
        total_invested: total_actual_invested,
        savings,
        savings_rate,
        income_categories,
        expense_categories,
        investment_categories,
    })
}

fn calculate_budget_period(month: &str, _salary_date: i32) -> (String, String) {
    // Month format: "YYYY-MM"
    let parts: Vec<&str> = month.split('-').collect();
    let year: i32 = parts[0].parse().unwrap_or(2024);
    let month_num: u32 = parts[1].parse().unwrap_or(1);
    
    // Start: 1st of this month
    let start_date = format!("{:04}-{:02}-01", year, month_num);
    
    // End: last day of this month
    let last_day = match month_num {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            // Leap year check
            if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) {
                29
            } else {
                28
            }
        },
        _ => 31,
    };
    let end_date = format!("{:04}-{:02}-{:02}", year, month_num, last_day);
    
    (start_date, end_date)
}

// ============ BUDGET REPORTS ============

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlyBudgetReport {
    pub month: String,
    pub income: f64,
    pub expenses: f64,
    pub investments: f64,
    pub savings: f64,
    pub savings_rate: f64,
}

#[tauri::command]
pub fn get_budget_report(db: State<DbConnection>, year: Option<i32>) -> Result<Vec<MonthlyBudgetReport>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let target_year = year.unwrap_or(2024);
    
    let salary_date: i32 = conn.query_row(
        "SELECT salary_date FROM budget_settings WHERE id = 1",
        [],
        |r| r.get(0)
    ).unwrap_or(1);
    
    let mut reports = Vec::new();
    
    for month_num in 1..=12 {
        let month = format!("{:04}-{:02}", target_year, month_num);
        let (start_date, end_date) = calculate_budget_period(&month, salary_date);
        
        let income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE direction = 'income' AND date >= ?1 AND date <= ?2",
            params![start_date, end_date],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        let expenses: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE direction = 'expense' AND date >= ?1 AND date <= ?2",
            params![start_date, end_date],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        let investments: f64 = conn.query_row(
            "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
             JOIN accounts a ON t.to_account_id = a.id
             WHERE t.direction = 'transfer' AND a.type = 'investment' AND t.date >= ?1 AND t.date <= ?2",
            params![start_date, end_date],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        let savings = income - expenses - investments;
        let savings_rate = if income > 0.0 { (savings / income) * 100.0 } else { 0.0 };
        
        reports.push(MonthlyBudgetReport {
            month,
            income,
            expenses,
            investments,
            savings,
            savings_rate,
        });
    }
    
    Ok(reports)
}
