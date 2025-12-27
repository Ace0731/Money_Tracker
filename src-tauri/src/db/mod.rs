use rusqlite::{Connection, Result};
use std::sync::Mutex;

pub struct DbConnection(pub Mutex<Connection>);

pub fn initialize_database() -> Result<DbConnection> {
    let conn = Connection::open("money_tracker.db")?;
    
    // Read and execute schema
    let schema = include_str!("../../../database/schema.sql");
    conn.execute_batch(schema)?;
    
    Ok(DbConnection(Mutex::new(conn)))
}
