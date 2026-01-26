use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Client {
    pub id: Option<i64>,
    pub name: String,
    pub notes: Option<String>,
    pub status: Option<String>,  // "active", "inactive", "prospect"
}

#[tauri::command]
pub fn get_clients(db: State<DbConnection>) -> Result<Vec<Client>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, notes, status FROM clients ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'prospect' THEN 1 ELSE 2 END, name")
        .map_err(|e| e.to_string())?;
    
    let clients = stmt
        .query_map([], |row| {
            Ok(Client {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                notes: row.get(2)?,
                status: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(clients)
}

#[tauri::command]
pub fn create_client(
    db: State<DbConnection>,
    client: Client,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO clients (name, notes, status) VALUES (?1, ?2, ?3)",
        params![client.name, client.notes, client.status.unwrap_or("active".to_string())],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_client(
    db: State<DbConnection>,
    client: Client,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let id = client.id.ok_or("Client ID is required")?;
    
    conn.execute(
        "UPDATE clients SET name = ?1, notes = ?2, status = ?3 WHERE id = ?4",
        params![client.name, client.notes, client.status.unwrap_or("active".to_string()), id],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
