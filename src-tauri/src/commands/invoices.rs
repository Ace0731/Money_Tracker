use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub id: Option<i64>,
    pub invoice_id: Option<i64>,
    pub description: String,
    pub quantity: f64,
    pub rate: f64,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvoicePayment {
    pub id: Option<i64>,
    pub invoice_id: i64,
    pub amount_paid: f64,
    pub payment_date: String,
    pub payment_mode: String,
    pub transaction_reference: Option<String>,
    pub transaction_id: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Invoice {
    pub id: Option<i64>,
    pub project_id: i64,
    pub invoice_number: String,
    pub stage: String,
    pub issue_date: String,
    pub due_date: String,
    pub total_amount: f64,
    pub status: String,
    pub discount: Option<f64>,
    pub tax_percentage: Option<f64>,
    pub project_reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
    pub items: Vec<InvoiceItem>,
    pub payments: Vec<InvoicePayment>,
    pub project_name: Option<String>,
    pub client_name: Option<String>,
    pub client_business_name: Option<String>,
    pub client_address: Option<String>,
    pub client_phone: Option<String>,
    pub client_email: Option<String>,
    pub client_gst: Option<String>,
}

#[tauri::command]
pub fn get_invoices(db: State<DbConnection>) -> Result<Vec<Invoice>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn
        .prepare("
            SELECT 
                i.id, i.project_id, i.invoice_number, i.stage, i.issue_date, i.due_date, 
                i.total_amount, i.status, i.created_at, p.name, c.name,
                i.discount, i.tax_percentage, i.project_reference, i.notes,
                c.business_name, c.address, c.contact_number, c.email, c.gst
            FROM invoices i
            JOIN projects p ON i.project_id = p.id
            JOIN clients c ON p.client_id = c.id
            ORDER BY i.created_at DESC
        ")
        .map_err(|e| e.to_string())?;
    
    let invoices = stmt
        .query_map([], |row| {
            Ok(Invoice {
                id: Some(row.get(0)?),
                project_id: row.get(1)?,
                invoice_number: row.get(2)?,
                stage: row.get(3)?,
                issue_date: row.get(4)?,
                due_date: row.get(5)?,
                total_amount: row.get(6)?,
                status: row.get(7)?,
                created_at: Some(row.get(8)?),
                items: Vec::new(),
                payments: Vec::new(),
                project_name: Some(row.get(9)?),
                client_name: Some(row.get(10)?),
                discount: row.get(11)?,
                tax_percentage: row.get(12)?,
                project_reference: row.get(13)?,
                notes: row.get(14)?,
                client_business_name: row.get(15)?,
                client_address: row.get(16)?,
                client_phone: row.get(17)?,
                client_email: row.get(18)?,
                client_gst: row.get(19)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    Ok(invoices)
}

#[tauri::command]
pub fn get_invoice_details(db: State<DbConnection>, id: i64) -> Result<Invoice, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut i_stmt = conn.prepare("
        SELECT 
            i.id, i.project_id, i.invoice_number, i.stage, i.issue_date, i.due_date, 
            i.total_amount, i.status, i.created_at, p.name, c.name,
            i.discount, i.tax_percentage, i.project_reference, i.notes,
            c.business_name, c.address, c.contact_number, c.email, c.gst
        FROM invoices i
        JOIN projects p ON i.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        WHERE i.id = ?1
    ").map_err(|e| e.to_string())?;

    let mut invoice = i_stmt.query_row([id], |row| {
        Ok(Invoice {
            id: Some(row.get(0)?),
            project_id: row.get(1)?,
            invoice_number: row.get(2)?,
            stage: row.get(3)?,
            issue_date: row.get(4)?,
            due_date: row.get(5)?,
            total_amount: row.get(6)?,
            status: row.get(7)?,
            created_at: Some(row.get(8)?),
            items: Vec::new(),
            payments: Vec::new(),
            project_name: Some(row.get(9)?),
            client_name: Some(row.get(10)?),
            discount: row.get(11)?,
            tax_percentage: row.get(12)?,
            project_reference: row.get(13)?,
            notes: row.get(14)?,
            client_business_name: row.get(15)?,
            client_address: row.get(16)?,
            client_phone: row.get(17)?,
            client_email: row.get(18)?,
            client_gst: row.get(19)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut items_stmt = conn.prepare("
        SELECT id, invoice_id, description, quantity, rate, amount
        FROM invoice_items
        WHERE invoice_id = ?1
    ").map_err(|e| e.to_string())?;

    let items = items_stmt.query_map([id], |row| {
        Ok(InvoiceItem {
            id: Some(row.get(0)?),
            invoice_id: Some(row.get(1)?),
            description: row.get(2)?,
            quantity: row.get(3)?,
            rate: row.get(4)?,
            amount: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    let mut payments_stmt = conn.prepare("
        SELECT id, invoice_id, amount_paid, payment_date, payment_mode, transaction_reference, transaction_id, created_at
        FROM invoice_payments
        WHERE invoice_id = ?1
    ").map_err(|e| e.to_string())?;

    let payments = payments_stmt.query_map([id], |row| {
        Ok(InvoicePayment {
            id: Some(row.get(0)?),
            invoice_id: row.get(1)?,
            amount_paid: row.get(2)?,
            payment_date: row.get(3)?,
            payment_mode: row.get(4)?,
            transaction_reference: row.get(5)?,
            transaction_id: row.get(6)?,
            created_at: Some(row.get(7)?),
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    invoice.items = items;
    invoice.payments = payments;
    Ok(invoice)
}

#[tauri::command]
pub fn create_invoice(db: State<DbConnection>, mut invoice: Invoice) -> Result<i64, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    if invoice.invoice_number.is_empty() {
        let year = chrono::Local::now().format("%Y").to_string();
        let count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE ?",
            [format!("INV-{}-%", year)],
            |row| row.get(0)
        ).unwrap_or(0);
        invoice.invoice_number = format!("INV-{}-{:03}", year, count + 1);
    }

    tx.execute(
        "INSERT INTO invoices (
            project_id, invoice_number, stage, issue_date, due_date, 
            total_amount, status, discount, tax_percentage, project_reference, notes
         ) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            invoice.project_id,
            invoice.invoice_number,
            invoice.stage,
            invoice.issue_date,
            invoice.due_date,
            invoice.total_amount,
            invoice.status,
            invoice.discount.unwrap_or(0.0),
            invoice.tax_percentage.unwrap_or(0.0),
            invoice.project_reference,
            invoice.notes
        ],
    ).map_err(|e| e.to_string())?;

    let i_id = tx.last_insert_rowid();

    for item in &invoice.items {
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![i_id, item.description, item.quantity, item.rate, item.amount],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(i_id)
}

#[tauri::command]
pub fn add_invoice_payment(db: State<DbConnection>, payment: InvoicePayment) -> Result<i64, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO invoice_payments (invoice_id, amount_paid, payment_date, payment_mode, transaction_reference, transaction_id) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            payment.invoice_id,
            payment.amount_paid,
            payment.payment_date,
            payment.payment_mode,
            payment.transaction_reference,
            payment.transaction_id
        ],
    ).map_err(|e| e.to_string())?;

    let p_id = tx.last_insert_rowid();

    // Update invoice status
    let (total, paid): (f64, f64) = tx.query_row(
        "SELECT i.total_amount, COALESCE(SUM(p.amount_paid), 0) 
         FROM invoices i 
         LEFT JOIN invoice_payments p ON i.id = p.invoice_id 
         WHERE i.id = ?1",
        [payment.invoice_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| e.to_string())?;

    let new_status = if paid >= total {
        "Paid"
    } else if paid > 0.0 {
        "Partially Paid"
    } else {
        "Unpaid"
    };

    tx.execute(
        "UPDATE invoices SET status = ?1 WHERE id = ?2",
        params![new_status, payment.invoice_id],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(p_id)
}
