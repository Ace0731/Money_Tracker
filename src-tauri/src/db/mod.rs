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
    
    // 8. Add retirement fields to investments
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN retirement_age INTEGER DEFAULT 60", []);
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN current_age INTEGER", []);
    
    // 9. Create investment_rates table for NPS/PPF historical rates
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS investment_rates (
            id INTEGER PRIMARY KEY,
            investment_type TEXT NOT NULL,
            rate REAL NOT NULL,
            effective_date DATE NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    // 10. Create budget tables
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS budget_settings (
            id INTEGER PRIMARY KEY,
            salary_date INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS monthly_income (
            id INTEGER PRIMARY KEY,
            month TEXT NOT NULL UNIQUE,
            expected_income REAL NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );
    
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY,
            month TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            budgeted_amount REAL NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(month, category_id),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )",
        [],
    );
    
    // Insert default budget settings if not exists
    let _ = conn.execute(
        "INSERT OR IGNORE INTO budget_settings (id, salary_date) VALUES (1, 1)",
        [],
    );
    
    // 13. Add is_investment flag to categories
    let _ = conn.execute("ALTER TABLE categories ADD COLUMN is_investment INTEGER DEFAULT 0", []);
    
    // 14. Add status to projects (replaces 'completed' boolean)
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'", []);
    // Migrate completed boolean to status
    let _ = conn.execute(
        "UPDATE projects SET status = CASE WHEN completed = 1 THEN 'completed' ELSE 'active' END WHERE status IS NULL OR status = 'active'",
        []
    );
    
    // 15. Add status to clients
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'active'", []);
    
    // 16. Add category_id to investments for auto-tracking deposits
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN category_id INTEGER REFERENCES categories(id)", []);
    
    // 17. Add tenure_months and opening_date to investments
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN tenure_months INTEGER", []);
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN opening_date DATE", []);
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN compounding TEXT DEFAULT 'quarterly'", []);
    let _ = conn.execute("ALTER TABLE investments ADD COLUMN bank_name TEXT", []);
    
    // 19. Add SRS fields to projects
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN srs_internal_link TEXT", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN srs_client_approved_link TEXT", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN srs_status TEXT DEFAULT 'Draft'", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN srs_approved_date DATETIME", []);

    // 20. Create quotations and quotation_items
    conn.execute(
        "CREATE TABLE IF NOT EXISTS quotations (
            id INTEGER PRIMARY KEY,
            client_id INTEGER NOT NULL,
            project_id INTEGER,
            quotation_number TEXT NOT NULL UNIQUE,
            issue_date DATE NOT NULL,
            valid_till DATE NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'Draft',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS quotation_items (
            id INTEGER PRIMARY KEY,
            quotation_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            quantity REAL NOT NULL,
            rate REAL NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // 21. Create invoices, invoice_items, and invoice_payments
    conn.execute(
        "CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            invoice_number TEXT NOT NULL UNIQUE,
            stage TEXT NOT NULL,
            issue_date DATE NOT NULL,
            due_date DATE NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'Unpaid',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY,
            invoice_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS invoice_payments (
            id INTEGER PRIMARY KEY,
            invoice_id INTEGER NOT NULL,
            amount_paid REAL NOT NULL,
            payment_date DATE NOT NULL,
            payment_mode TEXT NOT NULL,
            transaction_reference TEXT,
            transaction_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id)
        )",
        [],
    )?;

    // 22. Create company_settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS company_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )",
        [],
    )?;

    // Seed default company settings if empty
    let settings_count: i64 = conn.query_row("SELECT COUNT(*) FROM company_settings", [], |r| r.get(0)).unwrap_or(0);
    if settings_count == 0 {
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('company_name', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('company_address', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('bank_name', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('account_number', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('ifsc_code', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('upi_id', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('pdf_theme_color', '#3b82f6')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('pdf_footer_text', '')", []);
        let _ = conn.execute("INSERT INTO company_settings (key, value) VALUES ('show_qr_code', 'true')", []);
    }

    // 23. Quotation Redesign Migrations
    let _ = conn.execute("ALTER TABLE quotations ADD COLUMN project_title TEXT", []);
    let _ = conn.execute("ALTER TABLE quotations ADD COLUMN payment_terms TEXT", []);
    let _ = conn.execute("ALTER TABLE quotations ADD COLUMN terms_conditions TEXT", []);
    let _ = conn.execute("ALTER TABLE quotation_items ADD COLUMN timeline TEXT", []);
    let _ = conn.execute("ALTER TABLE quotation_items ADD COLUMN features TEXT", []);

    // 24. Client Details Migrations
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN business_name TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN address TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN contact_number TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN email TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN gst TEXT", []);

    // 25. Invoice Redesign Migrations
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN discount REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN tax_percentage REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN project_reference TEXT", []);
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN notes TEXT", []);
    let _ = conn.execute("ALTER TABLE invoice_items ADD COLUMN quantity REAL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE invoice_items ADD COLUMN rate REAL", []);

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
