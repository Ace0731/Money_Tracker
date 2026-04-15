use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvestmentLot {
    pub id: Option<i64>,
    pub investment_id: i64,
    pub quantity: f64,
    pub price_per_unit: f64,
    pub charges: f64,
    pub date: String,
    pub lot_type: String, // 'buy', 'sell'
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Investment {
    pub id: Option<i64>,
    pub name: String,
    pub investment_type: String, // 'stock', 'mf', 'fd', 'rd', 'nps', 'ppf'
    pub account_id: i64,
    
    // Stocks/MF specific
    pub units: Option<f64>,
    pub avg_buy_price: Option<f64>,
    pub current_price: Option<f64>,
    
    // FD/RD/PPF specific
    pub principal_amount: Option<f64>,
    pub interest_rate: Option<f64>,
    pub maturity_date: Option<String>,
    pub maturity_amount: Option<f64>,
    pub monthly_deposit: Option<f64>,
    pub tenure_months: Option<i32>,
    pub opening_date: Option<String>,
    pub compounding: Option<String>, // "monthly", "quarterly", "yearly"
    pub bank_name: Option<String>,
    
    // Category link for auto-tracking deposits
    pub category_id: Option<i64>,
    
    pub notes: Option<String>,
    pub provider_symbol: Option<String>,
    pub last_updated_at: Option<String>,
    pub principal_charges: Option<f64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvestmentSummary {
    pub investment: Investment,
    pub account_name: String,
    pub lots: Vec<InvestmentLot>,
    pub total_units: f64,
    pub avg_buy_price: f64,
    pub total_invested: f64, // Cost of all lots + charges
    pub total_expenses: f64, // Just charges part
    pub current_valuation: f64,
    pub net_gain: f64,
    pub gain_percentage: f64,
}

#[tauri::command]
pub fn get_investments(db: State<DbConnection>) -> Result<Vec<Investment>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, type, account_id, units, avg_buy_price, current_price, principal_amount, interest_rate, maturity_date, maturity_amount, monthly_deposit, notes, provider_symbol, last_updated_at, principal_charges, created_at, tenure_months, opening_date, compounding, bank_name, category_id FROM investments")
        .map_err(|e| e.to_string())?;
    
    let investments = stmt
        .query_map([], |row| {
            Ok(Investment {
                id: row.get(0)?,
                name: row.get(1)?,
                investment_type: row.get(2)?,
                account_id: row.get(3)?,
                units: row.get(4)?,
                avg_buy_price: row.get(5)?,
                current_price: row.get(6)?,
                principal_amount: row.get(7)?,
                interest_rate: row.get(8)?,
                maturity_date: row.get(9)?,
                maturity_amount: row.get(10)?,
                monthly_deposit: row.get(11)?,
                notes: row.get(12)?,
                provider_symbol: row.get(13)?,
                last_updated_at: row.get(14)?,
                principal_charges: row.get(15)?,
                created_at: row.get(16)?,
                tenure_months: row.get(17)?,
                opening_date: row.get(18)?,
                compounding: row.get(19)?,
                bank_name: row.get(20)?,
                category_id: row.get(21)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(investments)
}

#[tauri::command]
pub fn get_investments_summary(db: State<DbConnection>) -> Result<Vec<InvestmentSummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT 
                i.id, i.name, i.type, i.account_id, i.units, i.avg_buy_price, i.current_price, 
                i.principal_amount, i.interest_rate, i.maturity_date, i.maturity_amount, i.monthly_deposit, i.notes, 
                i.provider_symbol, i.last_updated_at, i.principal_charges, i.created_at,
                a.name as account_name
            FROM investments i
            JOIN accounts a ON i.account_id = a.id
        ")
        .map_err(|e| e.to_string())?;
    
    let summaries = stmt
        .query_map([], |row| {
            let inv_id: i64 = row.get(0)?;
            let inv_type: String = row.get(2)?;
            let current_price: Option<f64> = row.get(6)?;

            let investment = Investment {
                id: Some(inv_id),
                name: row.get(1)?,
                investment_type: inv_type.clone(),
                account_id: row.get(3)?,
                units: row.get(4)?,
                avg_buy_price: row.get(5)?,
                current_price,
                principal_amount: row.get(7)?,
                interest_rate: row.get(8)?,
                maturity_date: row.get(9)?,
                maturity_amount: row.get(10)?,
                monthly_deposit: row.get(11)?,
                notes: row.get(12)?,
                provider_symbol: row.get(13)?,
                last_updated_at: row.get(14)?,
                principal_charges: row.get(15)?,
                created_at: row.get(16)?,
                tenure_months: None,
                opening_date: None,
                compounding: None,
                bank_name: None,
                category_id: None,
            };

            let account_name: String = row.get(17)?;

            // Fetch Lots
            let mut lot_stmt = conn.prepare("SELECT id, investment_id, quantity, price_per_unit, charges, date, lot_type FROM investment_lots WHERE investment_id = ?1 ORDER BY date DESC").unwrap();
            let lots = lot_stmt.query_map([inv_id], |lr| {
                Ok(InvestmentLot {
                    id: lr.get(0)?,
                    investment_id: lr.get(1)?,
                    quantity: lr.get(2)?,
                    price_per_unit: lr.get(3)?,
                    charges: lr.get(4)?,
                    date: lr.get(5)?,
                    lot_type: lr.get(6)?,
                })
            }).unwrap().collect::<Result<Vec<_>, _>>().unwrap();

            // Aggregate Lots
            let mut total_units = 0.0;
            let mut total_invested = 0.0;
            let mut total_expenses_lots = 0.0;

            for lot in &lots {
                match lot.lot_type.as_str() {
                    "buy" => {
                        total_units += lot.quantity;
                        total_invested += (lot.quantity * lot.price_per_unit) + lot.charges;
                        total_expenses_lots += lot.charges;
                    },
                    "sell" => {
                        total_units -= lot.quantity;
                        // For sells, we don't necessarily subtract from "invested" in a simple way for ROI
                        // but for simplicity let's keep it basic for now.
                        total_expenses_lots += lot.charges;
                    },
                    _ => {}
                }
            }
            
            // Round sums to 2 decimal places to eliminate floating point residue
            total_invested = (total_invested * 100.0).round() / 100.0;
            total_expenses_lots = (total_expenses_lots * 100.0).round() / 100.0;
            total_units = (total_units * 10000.0).round() / 10000.0; // Keep units at 4 decimals

            // Include transfers and extra expenses from transactions (legacy/manual)
            let total_transfers: f64 = conn.query_row(
                "SELECT COALESCE(ROUND(SUM(amount), 2), 0) FROM transactions WHERE investment_id = ?1 AND direction = 'transfer'",
                [inv_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let total_expenses_tx: f64 = conn.query_row(
                "SELECT COALESCE(ROUND(SUM(amount), 2), 0) FROM transactions WHERE investment_id = ?1 AND direction = 'expense'",
                [inv_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let total_expenses = total_expenses_tx + total_expenses_lots;
            // Total invested capital is lots cost + manual transfers
            let total_invested_capital = total_invested + total_transfers;
            
            let avg_buy_price = if total_units > 0.0 { total_invested / total_units } else { 0.0 };

            // Current valuation logic
            let current_valuation = match inv_type.as_str() {
                "stock" | "mf" => {
                    if let Some(p) = current_price {
                        total_units * p
                    } else {
                        total_invested_capital - total_expenses
                    }
                },
                "fd" | "rd" => {
                    current_price.unwrap_or(total_invested_capital - total_expenses)
                },
                _ => total_invested_capital - total_expenses,
            };

            let net_capital = total_invested_capital - total_expenses;
            let net_gain = current_valuation - net_capital;
            let gain_percentage = if net_capital > 0.0 { (net_gain / net_capital) * 100.0 } else { 0.0 };

            Ok(InvestmentSummary {
                investment,
                account_name,
                lots,
                total_units,
                avg_buy_price: (avg_buy_price * 10000.0).round() / 10000.0,
                total_invested: (total_invested_capital * 100.0).round() / 100.0,
                total_expenses: (total_expenses * 100.0).round() / 100.0,
                current_valuation: (current_valuation * 100.0).round() / 100.0,
                net_gain: (net_gain * 100.0).round() / 100.0,
                gain_percentage: (gain_percentage * 100.0).round() / 100.0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(summaries)
}

#[tauri::command]
pub fn create_investment(db: State<DbConnection>, investment: Investment) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO investments (name, type, account_id, units, avg_buy_price, current_price, principal_amount, interest_rate, maturity_date, maturity_amount, monthly_deposit, notes, provider_symbol, principal_charges, tenure_months, opening_date, compounding, bank_name, category_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
        params![
            investment.name,
            investment.investment_type,
            investment.account_id,
            investment.units,
            investment.avg_buy_price,
            investment.current_price,
            investment.principal_amount,
            investment.interest_rate,
            investment.maturity_date,
            investment.maturity_amount,
            investment.monthly_deposit,
            investment.notes,
            investment.provider_symbol,
            investment.principal_charges,
            investment.tenure_months,
            investment.opening_date,
            investment.compounding,
            investment.bank_name,
            investment.category_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_investment(db: State<DbConnection>, investment: Investment) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = investment.id.ok_or("Investment ID is required")?;
    
    conn.execute(
        "UPDATE investments SET name = ?1, type = ?2, account_id = ?3, units = ?4, avg_buy_price = ?5, 
         current_price = ?6, principal_amount = ?7, interest_rate = ?8, maturity_date = ?9, 
         maturity_amount = ?10, monthly_deposit = ?11, notes = ?12, provider_symbol = ?13, principal_charges = ?14,
         tenure_months = ?15, opening_date = ?16, compounding = ?17, bank_name = ?18, category_id = ?19 WHERE id = ?20",
        params![
            investment.name,
            investment.investment_type,
            investment.account_id,
            investment.units,
            investment.avg_buy_price,
            investment.current_price,
            investment.principal_amount,
            investment.interest_rate,
            investment.maturity_date,
            investment.maturity_amount,
            investment.monthly_deposit,
            investment.notes,
            investment.provider_symbol,
            investment.principal_charges,
            investment.tenure_months,
            investment.opening_date,
            investment.compounding,
            investment.bank_name,
            investment.category_id,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_investment(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // First clear references in transactions
    conn.execute("UPDATE transactions SET investment_id = NULL WHERE investment_id = ?1", [id])
        .map_err(|e| e.to_string())?;
        
    conn.execute("DELETE FROM investments WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
        
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformBalance {
    pub account_id: i64,
    pub name: String,
    pub balance: f64,
}

#[tauri::command]
pub fn get_investment_platform_summary(db: State<DbConnection>) -> Result<Vec<PlatformBalance>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, opening_balance FROM accounts WHERE type = 'investment'"
    ).map_err(|e| e.to_string())?;
    
    let accounts_iter = stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
        let name: String = row.get(1)?;
        let opening_balance: f64 = row.get(2)?;
        
        let incoming: f64 = conn.query_row(
            "SELECT COALESCE(ROUND(SUM(amount), 2), 0) FROM transactions WHERE to_account_id = ?1",
            [id],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        let outgoing: f64 = conn.query_row(
            "SELECT COALESCE(ROUND(SUM(amount), 2), 0) FROM transactions WHERE from_account_id = ?1",
            [id],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let allocated: f64 = conn.query_row(
            "SELECT COALESCE(ROUND(SUM(l.quantity * l.price_per_unit + l.charges), 2), 0)
             FROM investment_lots l
             JOIN investments i ON l.investment_id = i.id
             WHERE i.account_id = ?1",
            [id],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        Ok(PlatformBalance {
            account_id: id,
            name,
            balance: ((opening_balance + incoming - outgoing - allocated) * 100.0).round() / 100.0,
        })
    }).map_err(|e| e.to_string())?;
    
    let balances = accounts_iter
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        
    Ok(balances)
}

#[tauri::command]
pub fn add_investment_lot(db: State<DbConnection>, lot: InvestmentLot) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO investment_lots (investment_id, quantity, price_per_unit, charges, date, lot_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            lot.investment_id,
            lot.quantity,
            lot.price_per_unit,
            lot.charges,
            lot.date,
            lot.lot_type,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_investment_lot(db: State<DbConnection>, lot: InvestmentLot) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = lot.id.ok_or("Lot ID is required")?;
    
    conn.execute(
        "UPDATE investment_lots SET quantity = ?1, price_per_unit = ?2, charges = ?3, date = ?4, lot_type = ?5 WHERE id = ?6",
        params![
            lot.quantity,
            lot.price_per_unit,
            lot.charges,
            lot.date,
            lot.lot_type,
            id,
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_investment_lot(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM investment_lots WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_investment_prices(db: State<'_, DbConnection>, force: bool) -> Result<(), String> {
    let investments = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT id, type, provider_symbol, last_updated_at FROM investments WHERE provider_symbol IS NOT NULL AND provider_symbol != ''")
            .map_err(|e| e.to_string())?;
        
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, Option<String>>(3)?))
        }).map_err(|e| e.to_string())?;
        
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let now_dt = chrono::Local::now();
    let cooldown_seconds = 24 * 60 * 60;

    for (id, inv_type, symbol, last_updated) in investments {
        // Skip if not forced and updated within last 24h
        if !force {
            if let Some(last_ts) = last_updated {
                use chrono::TimeZone;
                if let Ok(last_naive) = chrono::NaiveDateTime::parse_from_str(&last_ts, "%Y-%m-%d %H:%M:%S") {
                    if let Some(last_local) = chrono::Local.from_local_datetime(&last_naive).single() {
                        let diff = now_dt.signed_duration_since(last_local);
                        if diff.num_seconds() < cooldown_seconds {
                            continue;
                        }
                    }
                }
            }
        }

        let mut new_price: Option<f64> = None;

        if inv_type == "mf" {
            let url = format!("https://api.mfapi.in/mf/{}/latest", symbol);
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(body) = resp.text().await {
                    let trimmed = body.trim_start_matches('\u{feff}').trim();
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        if let Some(data) = json["data"].as_array() {
                            if !data.is_empty() {
                                if let Some(nav) = data[0]["nav"].as_str() {
                                    new_price = nav.parse::<f64>().ok();
                                }
                            }
                        }
                    }
                }
            }
        } else if inv_type == "stock" {
            let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=1d", symbol);
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(result) = json["chart"]["result"].as_array() {
                        if !result.is_empty() {
                            if let Some(price) = result[0]["meta"]["regularMarketPrice"].as_f64() {
                                new_price = Some(price);
                            }
                        }
                    }
                }
            }
        }

        if let Some(price) = new_price {
            let conn = db.0.lock().map_err(|e| e.to_string())?;
            let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            conn.execute(
                "UPDATE investments SET current_price = ?1, last_updated_at = ?2 WHERE id = ?3",
                params![price, now, id]
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_live_market_price(symbol: String, inv_type: String) -> Result<f64, String> {
    let symbol = symbol.trim().to_string();
    if symbol.is_empty() {
        return Err("Symbol cannot be empty".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    println!("Fetching live price for symbol: {} (type: {})", symbol, inv_type);

    if inv_type == "mf" {
        let url = format!("https://api.mfapi.in/mf/{}/latest", symbol);
        println!("Mutual Fund URL: {}", url);
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        
        let status = resp.status();
        let body = resp.text().await.map_err(|e| e.to_string())?;
        
        println!("Response Status: {}", status);
        
        if !status.is_success() {
            return Err(format!("MF API returned error {}: {}", status, body));
        }

        let trimmed = body.trim_start_matches('\u{feff}').trim();
        let json: serde_json::Value = serde_json::from_str(trimmed).map_err(|e| {
            format!("Failed to parse MF response: {}. Body: {}", e, trimmed)
        })?;
        
        if let Some(data) = json["data"].as_array() {
            println!("Data records found: {}", data.len());
            if data.is_empty() {
                return Err(format!("No data found for scheme code: {}. Please verify it on mfapi.in", symbol));
            }
            if let Some(nav) = data[0]["nav"].as_str() {
                println!("Latest NAV: {}", nav);
                return nav.parse::<f64>().map_err(|e| e.to_string());
            }
        }
    } else if inv_type == "stock" {
        let url = format!("https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=1d", symbol);
        println!("Stock URL (v8): {}", url);
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        println!("Response Status: {}", resp.status());

        if resp.status() == 401 {
            return Err("Yahoo Finance returned 401 Unauthorized. Ensure the symbol has the correct suffix (e.g., .NS or .BO for Indian stocks).".to_string());
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if let Some(result) = json["chart"]["result"].as_array() {
            if !result.is_empty() {
                if let Some(price) = result[0]["meta"]["regularMarketPrice"].as_f64() {
                    println!("Latest Price (v8): {}", price);
                    return Ok(price);
                }
            }
        }
        println!("No stock results found in v8 response for symbol: {}", symbol);
    }

    Err("Could not fetch price".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvestmentBenchmark {
    pub id: Option<i64>,
    pub target_amount: f64,
    pub start_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkMonthReport {
    pub month: String, // format "YYYY-MM"
    pub label: String, // e.g., "Nov 2025"
    pub target: f64,
    pub actual: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvestmentBenchmarkReport {
    pub benchmark: Option<InvestmentBenchmark>,
    pub monthly_data: Vec<BenchmarkMonthReport>,
    pub total_target: f64,
    pub total_actual: f64,
    pub total_gap: f64, 
}

#[tauri::command]
pub fn get_investment_benchmark(db: State<DbConnection>) -> Result<Option<InvestmentBenchmark>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, target_amount, start_date FROM investment_benchmarks ORDER BY id DESC LIMIT 1")
        .map_err(|e| e.to_string())?;
        
    let iter = stmt.query_map([], |r| {
        Ok(InvestmentBenchmark {
            id: Some(r.get(0)?),
            target_amount: r.get(1)?,
            start_date: r.get(2)?,
        })
    }).map_err(|e| e.to_string())?;
    
    for item in iter {
        if let Ok(b) = item {
            return Ok(Some(b));
        }
    }
    
    Ok(None)
}

#[tauri::command]
pub fn set_investment_benchmark(db: State<DbConnection>, target_amount: f64, start_date: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // We only keep one active benchmark for simplicity, or just update the latest
    conn.execute("DELETE FROM investment_benchmarks", []).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO investment_benchmarks (target_amount, start_date) VALUES (?1, ?2)",
        params![target_amount, start_date]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_investment_benchmark_report(db: State<DbConnection>) -> Result<InvestmentBenchmarkReport, String> {
    // 1. Fetch benchmark
    let benchmark_opt = get_investment_benchmark(db.clone())?;
    
    let benchmark = match benchmark_opt {
        Some(b) => b,
        None => return Ok(InvestmentBenchmarkReport {
            benchmark: None,
            monthly_data: Vec::new(),
            total_target: 0.0,
            total_actual: 0.0,
            total_gap: 0.0,
        })
    };
    
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // 2. We need to generate months from start_date to "today"
    use chrono::{NaiveDate, Local, Datelike, Months};
    let start_d = NaiveDate::parse_from_str(&benchmark.start_date, "%Y-%m-%d")
        .map_err(|_| "Invalid start_date in benchmark".to_string())?;
        
    let today = Local::now().date_naive();
    
    // If start_date is in the future and today is behind it, we'll still show up to the start_date's month
    let mut current_d = start_d.with_day(1).unwrap_or(start_d);
    let end_d = today.with_day(1).unwrap_or(today);
    
    // We want to generate months.
    let mut target_months = Vec::new();
    while current_d <= end_d || (current_d.year() == end_d.year() && current_d.month() == end_d.month()) {
        let label = current_d.format("%b %Y").to_string(); // e.g. "Nov 2025"
        let str_key = current_d.format("%Y-%m").to_string(); // e.g. "2025-11"
        target_months.push((str_key, label));
        current_d = current_d.checked_add_months(Months::new(1)).unwrap_or(current_d);
        if target_months.len() > 120 { break; } // safety fallback
    }
    
    // 3. Query actual invested amounts:
    //    Source A: investment_lots (formal lot entries)
    //    Source B: transactions whose category is type='investment' (covers category-tagged transfers)
    let mut stmt = conn.prepare("
        SELECT mth, SUM(total) FROM (
            -- Source A: investment lots
            SELECT strftime('%Y-%m', il.date) as mth,
                   SUM(CASE WHEN il.lot_type = 'sell' THEN -(il.quantity * il.price_per_unit)
                            ELSE (il.quantity * il.price_per_unit + il.charges) END) as total
            FROM investment_lots il
            JOIN investments i ON il.investment_id = i.id
            WHERE strftime('%Y-%m', il.date) >= ?1 AND i.type != 'pf'
            GROUP BY mth

            UNION ALL

            -- Source B: transactions tagged with an investment category (is_investment flag)
            SELECT strftime('%Y-%m', t.date) as mth,
                   ROUND(SUM(t.amount), 2) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE COALESCE(c.is_investment, 0) = 1
              AND strftime('%Y-%m', t.date) >= ?1
            GROUP BY mth
        )
        GROUP BY mth
    ").map_err(|e| e.to_string())?;
    
    let start_mth_str = start_d.format("%Y-%m").to_string();
    let actuals_iter = stmt.query_map(params![start_mth_str], |r| {
        let mth: String = r.get(0)?;
        let sum: f64 = r.get(1)?;
        Ok((mth, sum))
    }).map_err(|e| e.to_string())?;
    
    let mut actuals_map = std::collections::HashMap::new();
    for item in actuals_iter {
        if let Ok((m, val)) = item {
            actuals_map.insert(m, val);
        }
    }
    
    let mut monthly_data = Vec::new();
    let mut total_target = 0.0;
    let mut total_actual = 0.0;
    
    for (mth_key, label) in target_months {
        let actual = actuals_map.get(&mth_key).copied().unwrap_or(0.0);
        
        monthly_data.push(BenchmarkMonthReport {
            month: mth_key,
            label,
            target: benchmark.target_amount,
            actual,
        });
        
        total_target += benchmark.target_amount;
        total_actual += actual;
    }
    
    Ok(InvestmentBenchmarkReport {
        benchmark: Some(benchmark),
        monthly_data,
        total_target,
        total_actual,
        total_gap: total_actual - total_target,
    })
}
