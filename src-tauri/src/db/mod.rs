use rusqlite::{Connection, Result};
use std::sync::Mutex;
use std::path::PathBuf;

pub struct DbConnection(pub Mutex<Connection>);

pub fn initialize_database() -> Result<DbConnection> {
    // Get the app data directory path
    let app_data_dir = get_app_data_dir();
    
    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)
        .expect("Failed to create app data directory");
    
    // Database path in AppData
    let db_path = app_data_dir.join("money_tracker.db");
    
    println!("Database location: {:?}", db_path);
    
    let conn = Connection::open(&db_path)?;
    
    // Read and execute schema
    let schema = include_str!("../../../database/schema.sql");
    conn.execute_batch(schema)?;

    // Safe migrations for updates
    // 1. Add daily_rate to projects if it doesn't exist
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN daily_rate REAL DEFAULT 0.0", []);
    
    // 1b. Add completed to projects if it doesn't exist
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN completed INTEGER DEFAULT 0", []);

    // 2. Create time_logs table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS time_logs (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            date DATE NOT NULL,
            hours REAL NOT NULL,
            task TEXT,
            start_time TEXT,
            end_time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )",
        [],
    )?;

    // 2b. Add start_time and end_time to time_logs if they don't exist
    let _ = conn.execute("ALTER TABLE time_logs ADD COLUMN start_time TEXT", []);
    let _ = conn.execute("ALTER TABLE time_logs ADD COLUMN end_time TEXT", []);

    // 3. Create investments table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS investments (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            account_id INTEGER NOT NULL,
            units REAL,
            avg_buy_price REAL,
            current_price REAL,
            principal_amount REAL,
            interest_rate REAL,
            maturity_date DATE,
            maturity_amount REAL,
            monthly_deposit REAL,
            notes TEXT,
            provider_symbol TEXT,
            last_updated_at DATETIME,
            principal_charges REAL DEFAULT 0.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        )",
        [],
    )?;

    // 4. Add investment_id to transactions if it doesn't exist
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN investment_id INTEGER REFERENCES investments(id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_investment ON transactions(investment_id)", []);
    
    // 5. Add provider_symbol and last_updated_at to investments
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN provider_symbol TEXT", []);
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN last_updated_at DATETIME", []);
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN principal_charges REAL DEFAULT 0.0", []);
    
    // 6. Create investment_lots
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS investment_lots (
            id INTEGER PRIMARY KEY,
            investment_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            price_per_unit REAL NOT NULL,
            charges REAL DEFAULT 0.0,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            lot_type TEXT DEFAULT 'buy',
            FOREIGN KEY (investment_id) REFERENCES investments(id)
        )",
        [],
    );
    
    // 7. Seed initial lots from old investment data (only if lots are empty)
    let lot_count: i64 = conn.query_row("SELECT COUNT(*) FROM investment_lots", [], |r| r.get(0)).unwrap_or(0);
    if lot_count == 0 {
        let _ = conn.execute(
            "INSERT INTO investment_lots (investment_id, quantity, price_per_unit, charges, date)
             SELECT id, units, avg_buy_price, principal_charges, created_at 
             FROM investments 
             WHERE units > 0 AND avg_buy_price > 0",
            [],
        );
    }
    
    Ok(DbConnection(Mutex::new(conn)))
}

fn get_app_data_dir() -> PathBuf {
    // For Windows: C:\Users\Username\AppData\Roaming\com.moneytracker.app
    if let Some(data_dir) = dirs::data_dir() {
        data_dir.join("com.moneytracker.app")
    } else {
        // Fallback to current directory if we can't get AppData
        PathBuf::from(".")
    }
}
