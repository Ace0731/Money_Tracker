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
