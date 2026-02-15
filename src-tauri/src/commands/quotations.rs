use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct QuotationItem {
    pub id: Option<i64>,
    pub quotation_id: Option<i64>,
    pub description: String,
    pub timeline: Option<String>,
    pub features: Option<String>,
    pub quantity: f64,
    pub rate: f64,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Quotation {
    pub id: Option<i64>,
    pub client_id: i64,
    pub project_id: Option<i64>,
    pub project_title: Option<String>,
    pub quotation_number: String,
    pub issue_date: String,
    pub valid_till: String,
    pub total_amount: f64,
    pub status: String,
    pub payment_terms: Option<String>,
    pub terms_conditions: Option<String>,
    pub created_at: Option<String>,
    pub items: Vec<QuotationItem>,
    pub client_name: Option<String>,
    pub client_business_name: Option<String>,
    pub client_address: Option<String>,
    pub client_phone: Option<String>,
    pub client_email: Option<String>,
    pub client_gst: Option<String>,
    pub project_name: Option<String>,
}

#[tauri::command]
pub fn get_quotations(db: State<DbConnection>) -> Result<Vec<Quotation>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT 
                q.id, q.client_id, q.project_id, q.quotation_number, q.issue_date, q.valid_till, 
                q.total_amount, q.status, q.created_at, c.name, p.name,
                q.project_title, q.payment_terms, q.terms_conditions,
                c.business_name, c.address, c.contact_number, c.email, c.gst
            FROM quotations q
            JOIN clients c ON q.client_id = c.id
            LEFT JOIN projects p ON q.project_id = p.id
            ORDER BY q.created_at DESC
        ")
        .map_err(|e| e.to_string())?;
    
    let quotations = stmt
        .query_map([], |row| {
            Ok(Quotation {
                id: Some(row.get(0)?),
                client_id: row.get(1)?,
                project_id: row.get(2)?,
                quotation_number: row.get(3)?,
                issue_date: row.get(4)?,
                valid_till: row.get(5)?,
                total_amount: row.get(6)?,
                status: row.get(7)?,
                created_at: Some(row.get(8)?),
                items: Vec::new(),
                client_name: Some(row.get(9)?),
                project_name: row.get(10)?,
                project_title: row.get(11)?,
                payment_terms: row.get(12)?,
                terms_conditions: row.get(13)?,
                client_business_name: row.get(14)?,
                client_address: row.get(15)?,
                client_phone: row.get(16)?,
                client_email: row.get(17)?,
                client_gst: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(quotations)
}

#[tauri::command]
pub fn get_quotation_details(db: State<DbConnection>, id: i64) -> Result<Quotation, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut q_stmt = conn.prepare("
        SELECT 
            q.id, q.client_id, q.project_id, q.quotation_number, q.issue_date, q.valid_till, 
            q.total_amount, q.status, q.created_at, c.name, p.name,
            q.project_title, q.payment_terms, q.terms_conditions,
            c.business_name, c.address, c.contact_number, c.email, c.gst
        FROM quotations q
        JOIN clients c ON q.client_id = c.id
        LEFT JOIN projects p ON q.project_id = p.id
        WHERE q.id = ?1
    ").map_err(|e| e.to_string())?;

    let mut quotation = q_stmt.query_row([id], |row| {
        Ok(Quotation {
            id: Some(row.get(0)?),
            client_id: row.get(1)?,
            project_id: row.get(2)?,
            quotation_number: row.get(3)?,
            issue_date: row.get(4)?,
            valid_till: row.get(5)?,
            total_amount: row.get(6)?,
            status: row.get(7)?,
            created_at: Some(row.get(8)?),
            items: Vec::new(),
            client_name: Some(row.get(9)?),
            project_name: row.get(10)?,
            project_title: row.get(11)?,
            payment_terms: row.get(12)?,
            terms_conditions: row.get(13)?,
            client_business_name: row.get(14)?,
            client_address: row.get(15)?,
            client_phone: row.get(16)?,
            client_email: row.get(17)?,
            client_gst: row.get(18)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut items_stmt = conn.prepare("
        SELECT id, quotation_id, description, quantity, rate, amount, timeline, features
        FROM quotation_items
        WHERE quotation_id = ?1
    ").map_err(|e| e.to_string())?;

    let items = items_stmt.query_map([id], |row| {
        Ok(QuotationItem {
            id: Some(row.get(0)?),
            quotation_id: Some(row.get(1)?),
            description: row.get(2)?,
            quantity: row.get(3)?,
            rate: row.get(4)?,
            amount: row.get(5)?,
            timeline: row.get(6)?,
            features: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    quotation.items = items;
    Ok(quotation)
}

#[tauri::command]
pub fn create_quotation(db: State<DbConnection>, mut quotation: Quotation) -> Result<i64, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Auto-generate quotation number if not provided
    if quotation.quotation_number.is_empty() {
        let year = chrono::Local::now().format("%Y").to_string();
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM quotations WHERE quotation_number LIKE ?",
            [format!("QTN-{}-%", year)],
            |row| row.get(0)
        ).unwrap_or(0);
        quotation.quotation_number = format!("QTN-{}-{:03}", year, count + 1);
    }

    tx.execute(
        "INSERT INTO quotations (
            client_id, project_id, quotation_number, issue_date, valid_till, 
            total_amount, status, project_title, payment_terms, terms_conditions
         ) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            quotation.client_id,
            quotation.project_id,
            quotation.quotation_number,
            quotation.issue_date,
            quotation.valid_till,
            quotation.total_amount,
            quotation.status,
            quotation.project_title,
            quotation.payment_terms,
            quotation.terms_conditions
        ],
    ).map_err(|e| e.to_string())?;

    let q_id = tx.last_insert_rowid();

    for item in &quotation.items {
        tx.execute(
            "INSERT INTO quotation_items (quotation_id, description, quantity, rate, amount, timeline, features) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![q_id, item.description, item.quantity, item.rate, item.amount, item.timeline, item.features],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(q_id)
}

#[tauri::command]
pub fn update_quotation(db: State<DbConnection>, quotation: Quotation) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let q_id = quotation.id.ok_or("Quotation ID is required")?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE quotations SET 
            client_id = ?1, project_id = ?2, quotation_number = ?3, issue_date = ?4, 
            valid_till = ?5, total_amount = ?6, status = ?7, project_title = ?8, 
            payment_terms = ?9, terms_conditions = ?10 
         WHERE id = ?11",
        params![
            quotation.client_id,
            quotation.project_id,
            quotation.quotation_number,
            quotation.issue_date,
            quotation.valid_till,
            quotation.total_amount,
            quotation.status,
            quotation.project_title,
            quotation.payment_terms,
            quotation.terms_conditions,
            q_id
        ],
    ).map_err(|e| e.to_string())?;

    // Delete existing items and re-insert
    tx.execute("DELETE FROM quotation_items WHERE quotation_id = ?1", [q_id]).map_err(|e| e.to_string())?;

    for item in &quotation.items {
        tx.execute(
            "INSERT INTO quotation_items (quotation_id, description, quantity, rate, amount, timeline, features) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![q_id, item.description, item.quantity, item.rate, item.amount, item.timeline, item.features],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_quotation(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM quotations WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}
