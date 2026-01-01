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

    // 2. Create time_logs table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS time_logs (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            date DATE NOT NULL,
            hours REAL NOT NULL,
            task TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )",
        [],
    )?;
    
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
