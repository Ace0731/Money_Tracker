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
    pub investment_type: String, // 'stock', 'mf', 'fd', 'rd'
    pub account_id: i64,
    
    // Stocks/MF specific
    pub units: Option<f64>,
    pub avg_buy_price: Option<f64>,
    pub current_price: Option<f64>,
    
    // FD/RD specific
    pub principal_amount: Option<f64>,
    pub interest_rate: Option<f64>,
    pub maturity_date: Option<String>,
    pub maturity_amount: Option<f64>,
    pub monthly_deposit: Option<f64>,
    
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
        .prepare("SELECT id, name, type, account_id, units, avg_buy_price, current_price, principal_amount, interest_rate, maturity_date, maturity_amount, monthly_deposit, notes, provider_symbol, last_updated_at, principal_charges, created_at FROM investments")
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

            // Include transfers and extra expenses from transactions (legacy/manual)
            let total_transfers: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE investment_id = ?1 AND direction = 'transfer'",
                [inv_id],
                |r| r.get(0)
            ).unwrap_or(0.0);

            let total_expenses_tx: f64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE investment_id = ?1 AND direction = 'expense'",
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
                avg_buy_price,
                total_invested: total_invested_capital,
                total_expenses,
                current_valuation,
                net_gain,
                gain_percentage,
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
        "INSERT INTO investments (name, type, account_id, units, avg_buy_price, current_price, principal_amount, interest_rate, maturity_date, maturity_amount, monthly_deposit, notes, provider_symbol, principal_charges)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
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
         maturity_amount = ?10, monthly_deposit = ?11, notes = ?12, provider_symbol = ?13, principal_charges = ?14 WHERE id = ?15",
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
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE to_account_id = ?1",
            [id],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        let outgoing: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE from_account_id = ?1",
            [id],
            |r| r.get(0)
        ).unwrap_or(0.0);

        let allocated: f64 = conn.query_row(
            "SELECT COALESCE(SUM(l.quantity * l.price_per_unit + l.charges), 0)
             FROM investment_lots l
             JOIN investments i ON l.investment_id = i.id
             WHERE i.account_id = ?1",
            [id],
            |r| r.get(0)
        ).unwrap_or(0.0);
        
        Ok(PlatformBalance {
            account_id: id,
            name,
            balance: opening_balance + incoming - outgoing - allocated,
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
pub fn delete_investment_lot(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM investment_lots WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn sync_investment_prices(db: State<'_, DbConnection>) -> Result<(), String> {
    let investments = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT id, type, provider_symbol FROM investments WHERE provider_symbol IS NOT NULL AND provider_symbol != ''")
            .map_err(|e| e.to_string())?;
        
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        }).map_err(|e| e.to_string())?;
        
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    for (id, inv_type, symbol) in investments {
        let mut new_price: Option<f64> = None;

        if inv_type == "mf" {
            let url = format!("https://api.mfapi.in/mf/{}", symbol);
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(nav) = json["data"][0]["nav"].as_str() {
                        new_price = nav.parse::<f64>().ok();
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
        let url = format!("https://api.mfapi.in/mf/{}", symbol);
        println!("Mutual Fund URL: {}", url);
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
        println!("Response Status: {}", resp.status());
        
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        
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
