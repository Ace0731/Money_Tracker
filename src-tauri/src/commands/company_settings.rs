use rusqlite::{params, Result};
use std::collections::HashMap;
use tauri::State;
use crate::db::DbConnection;

#[tauri::command]
pub fn get_company_settings(db: State<DbConnection>) -> Result<HashMap<String, String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM company_settings").map_err(|e| e.to_string())?;
    
    let settings = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?
    .collect::<Result<HashMap<_, _>, _>>().map_err(|e| e.to_string())?;
    
    Ok(settings)
}

#[tauri::command]
pub fn update_company_settings(db: State<DbConnection>, settings: HashMap<String, String>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    for (key, value) in settings {
        conn.execute(
            "INSERT OR REPLACE INTO company_settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
