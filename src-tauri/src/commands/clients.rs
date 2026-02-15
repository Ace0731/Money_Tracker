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
    pub business_name: Option<String>,
    pub address: Option<String>,
    pub contact_number: Option<String>,
    pub email: Option<String>,
    pub gst: Option<String>,
}

#[tauri::command]
pub fn get_clients(db: State<DbConnection>) -> Result<Vec<Client>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, name, notes, status, business_name, address, contact_number, email, gst FROM clients ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'prospect' THEN 1 WHEN 'inactive' THEN 2 WHEN 'archived' THEN 3 ELSE 4 END, name")
        .map_err(|e| e.to_string())?;
    
    let clients = stmt
        .query_map([], |row| {
            Ok(Client {
                id: Some(row.get(0)?),
                name: row.get(1)?,
                notes: row.get(2)?,
                status: row.get(3)?,
                business_name: row.get(4)?,
                address: row.get(5)?,
                contact_number: row.get(6)?,
                email: row.get(7)?,
                gst: row.get(8)?,
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
        "INSERT INTO clients (name, notes, status, business_name, address, contact_number, email, gst) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            client.name, 
            client.notes, 
            client.status.unwrap_or("active".to_string()),
            client.business_name,
            client.address,
            client.contact_number,
            client.email,
            client.gst
        ],
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
        "UPDATE clients SET 
            name = ?1, notes = ?2, status = ?3, business_name = ?4, 
            address = ?5, contact_number = ?6, email = ?7, gst = ?8 
         WHERE id = ?9",
        params![
            client.name, 
            client.notes, 
            client.status.unwrap_or("active".to_string()), 
            client.business_name,
            client.address,
            client.contact_number,
            client.email,
            client.gst,
            id
        ],
    )
    .map_err(|e| e.to_string())?;
    
    Ok(())
}
