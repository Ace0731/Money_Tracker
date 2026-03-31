use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Goal {
    pub id: Option<i64>,
    pub bucket_id: i64,
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub status: String, // active, completed
    pub deadline: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AllocationSettings {
    pub emergency_target: f64,
    pub trigger_category_id: Option<i64>,
    pub is_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AllocationRule {
    pub id: Option<i64>,
    pub tier: i64,
    pub emergency_pc: f64,
    pub asset_pc: f64,
    pub travel_pc: f64,
}

#[tauri::command]
pub fn get_goals(db: State<DbConnection>, bucket_id: Option<i64>) -> Result<Vec<Goal>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut sql = String::from("SELECT id, bucket_id, name, target_amount, current_amount, status, deadline FROM goals");
    if let Some(bid) = bucket_id {
        sql.push_str(&format!(" WHERE bucket_id = {}", bid));
    }
    
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let goals = stmt.query_map([], |row| {
        Ok(Goal {
            id: Some(row.get(0)?),
            bucket_id: row.get(1)?,
            name: row.get(2)?,
            target_amount: row.get(3)?,
            current_amount: row.get(4)?,
            status: row.get(5)?,
            deadline: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    Ok(goals)
}

#[tauri::command]
pub fn create_goal(db: State<DbConnection>, goal: Goal) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO goals (bucket_id, name, target_amount, current_amount, status, deadline) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![goal.bucket_id, goal.name, goal.target_amount, goal.current_amount, goal.status, goal.deadline],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_goal(db: State<DbConnection>, goal: Goal) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = goal.id.ok_or("Goal ID required")?;
    
    conn.execute(
        "UPDATE goals SET name = ?1, target_amount = ?2, current_amount = ?3, status = ?4, deadline = ?5 WHERE id = ?6",
        params![goal.name, goal.target_amount, goal.current_amount, goal.status, goal.deadline, id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_goal(db: State<DbConnection>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM goals WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_allocation_settings(db: State<DbConnection>) -> Result<AllocationSettings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let settings = conn.query_row(
        "SELECT emergency_target, trigger_category_id, is_enabled FROM bucket_allocation_settings WHERE id = 1",
        [],
        |row| {
            let enabled: i32 = row.get(2)?;
            Ok(AllocationSettings {
                emergency_target: row.get(0)?,
                trigger_category_id: row.get(1)?,
                is_enabled: enabled != 0,
            })
        }
    ).unwrap_or(AllocationSettings { emergency_target: 100000.0, trigger_category_id: None, is_enabled: true });
    
    Ok(settings)
}

#[tauri::command]
pub fn get_allocation_rules(db: State<DbConnection>) -> Result<Vec<AllocationRule>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, tier, emergency_pc, asset_pc, travel_pc FROM allocation_rules ORDER BY tier ASC").map_err(|e| e.to_string())?;
    let rules = stmt.query_map([], |row| {
        Ok(AllocationRule {
            id: Some(row.get(0)?),
            tier: row.get(1)?,
            emergency_pc: row.get(2)?,
            asset_pc: row.get(3)?,
            travel_pc: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    
    Ok(rules)
}

#[tauri::command]
pub fn update_allocation_rule(db: State<DbConnection>, rule: AllocationRule) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = rule.id.ok_or("Rule ID required")?;
    
    conn.execute(
        "UPDATE allocation_rules SET emergency_pc = ?1, asset_pc = ?2, travel_pc = ?3 WHERE id = ?4",
        params![rule.emergency_pc, rule.asset_pc, rule.travel_pc, id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn update_allocation_settings(db: State<DbConnection>, settings: AllocationSettings) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let enabled = if settings.is_enabled { 1 } else { 0 };
    
    conn.execute(
        "INSERT OR REPLACE INTO bucket_allocation_settings (id, emergency_target, trigger_category_id, is_enabled) VALUES (1, ?1, ?2, ?3)",
        params![settings.emergency_target, settings.trigger_category_id, enabled],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
