use serde::{Serialize, Deserialize};
use rusqlite::params;
use crate::db::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct EstimatorModule {
    pub id: Option<i32>,
    pub name: String,
    pub avg_hours: f64,
    pub usage_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EstimatorProject {
    pub id: Option<i32>,
    pub name: String,
    pub project_type: Option<String>,
    pub base_hours: f64,
    pub adjusted_hours: f64,
    pub learning_factor: f64,
    pub final_hours: f64,
    pub hourly_rate: f64,
    pub estimated_price: f64,
    pub actual_hours: Option<f64>,
    pub actual_price: Option<f64>,
    pub ratio: Option<f64>,
    pub complexity: String,
    pub urgency: String,
    pub risk: String,
    pub is_completed: i32,
    pub is_high_value: i32,
    pub suggested_price_at_creation: Option<f64>,
    pub module_ids: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateActuals {
    pub project_id: i32,
    pub actual_hours: f64,
}

#[tauri::command]
pub fn get_estimator_modules(db: tauri::State<DbConnection>) -> Result<Vec<EstimatorModule>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, avg_hours, usage_count FROM estimator_modules ORDER BY name").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(EstimatorModule {
            id: row.get(0)?,
            name: row.get(1)?,
            avg_hours: row.get(2)?,
            usage_count: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut modules = Vec::new();
    for row in rows {
        modules.push(row.map_err(|e| e.to_string())?);
    }
    Ok(modules)
}

#[tauri::command]
pub fn create_estimator_module(db: tauri::State<DbConnection>, name: String, hours: f64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO estimator_modules (name, avg_hours) VALUES (?, ?)",
        params![name, hours],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_estimator_projects(db: tauri::State<DbConnection>) -> Result<Vec<EstimatorProject>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, project_type, base_hours, adjusted_hours, learning_factor, final_hours, hourly_rate, estimated_price, actual_hours, actual_price, ratio, complexity, urgency, risk, is_completed, is_high_value, suggested_price_at_creation, module_ids, created_at FROM estimator_projects ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(EstimatorProject {
            id: row.get(0)?,
            name: row.get(1)?,
            project_type: row.get(2)?,
            base_hours: row.get(3)?,
            adjusted_hours: row.get(4)?,
            learning_factor: row.get(5)?,
            final_hours: row.get(6)?,
            hourly_rate: row.get(7)?,
            estimated_price: row.get(8)?,
            actual_hours: row.get(9)?,
            actual_price: row.get(10)?,
            ratio: row.get(11)?,
            complexity: row.get(12)?,
            urgency: row.get(13)?,
            risk: row.get(14)?,
            is_completed: row.get(15)?,
            is_high_value: row.get(16)?,
            suggested_price_at_creation: row.get(17)?,
            module_ids: row.get(18)?,
            created_at: row.get(19)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
pub fn create_estimator_project(
    db: tauri::State<DbConnection>,
    name: String,
    project_type: String,
    base_hours: f64,
    adjusted_hours: f64,
    learning_factor: f64,
    final_hours: f64,
    hourly_rate: f64,
    estimated_price: f64,
    complexity: String,
    urgency: String,
    risk: String,
    is_high_value: i32,
    suggested_price_at_creation: f64,
    module_ids: String
) -> Result<i32, String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO estimator_projects (name, project_type, base_hours, adjusted_hours, learning_factor, final_hours, hourly_rate, estimated_price, complexity, urgency, risk, is_high_value, suggested_price_at_creation, module_ids) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![name, project_type, base_hours, adjusted_hours, learning_factor, final_hours, hourly_rate, estimated_price, complexity, urgency, risk, is_high_value, suggested_price_at_creation, module_ids],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid() as i32)
}

#[tauri::command]
pub fn update_estimator_actuals(
    db: tauri::State<DbConnection>,
    project_id: i32,
    actual_hours: f64,
    actual_price: f64,
    _module_ids: Vec<i32>
) -> Result<(), String> {
    let mut conn = db.0.lock().unwrap();

    // 1. Get project details
    let project: EstimatorProject = conn.query_row(
        "SELECT id, name, project_type, base_hours, adjusted_hours, learning_factor, final_hours, hourly_rate, estimated_price, actual_hours, actual_price, ratio, complexity, urgency, risk, is_completed, is_high_value, suggested_price_at_creation, module_ids, created_at 
         FROM estimator_projects WHERE id = ?",
        params![project_id],
        |row| {
            Ok(EstimatorProject {
                id: row.get(0)?,
                name: row.get(1)?,
                project_type: row.get(2)?,
                base_hours: row.get(3)?,
                adjusted_hours: row.get(4)?,
                learning_factor: row.get(5)?,
                final_hours: row.get(6)?,
                hourly_rate: row.get(7)?,
                estimated_price: row.get(8)?,
                actual_hours: row.get(9)?,
                actual_price: row.get(10)?,
                ratio: row.get(11)?,
                complexity: row.get(12)?,
                urgency: row.get(13)?,
                risk: row.get(14)?,
                is_completed: row.get(15)?,
                is_high_value: row.get(16)?,
                suggested_price_at_creation: row.get(17)?,
                module_ids: row.get(18)?,
                created_at: row.get(19)?,
            })
        },
    ).map_err(|e| e.to_string())?;

    let time_ratio = (actual_hours / project.final_hours).clamp(0.5, 2.0);
    let suggested_price = project.suggested_price_at_creation.unwrap_or(project.estimated_price);
    let price_ratio = (actual_price / suggested_price).clamp(0.5, 1.5);

    // 2. Update project record
    conn.execute(
        "UPDATE estimator_projects SET actual_hours = ?, actual_price = ?, ratio = ?, is_completed = 1 WHERE id = ?",
        params![actual_hours, actual_price, time_ratio, project_id],
    ).map_err(|e| e.to_string())?;

    // 3. Dynamic Alpha Logic
    let is_high_val = project.is_high_value == 1;
    let count_key = if is_high_val { "market_premium_high_value_count" } else { "market_premium_standard_count" };
    
    let count_str: String = conn.query_row(
        "SELECT value FROM estimator_settings WHERE key = ?",
        params![count_key],
        |r| r.get(0),
    ).unwrap_or("0".to_string());
    let count: i32 = count_str.parse().unwrap_or(0);
    let effective_count = count.min(20);

    let mut alpha = if effective_count < 5 { 0.4 } else if effective_count < 15 { 0.25 } else { 0.15 };
    if is_high_val { alpha *= 0.8; }

    // 4. Update Time Learning Factor (EMA)
    let old_lf_str: String = conn.query_row("SELECT value FROM estimator_settings WHERE key = 'learning_factor'", [], |r| r.get(0)).unwrap_or("0.8".to_string());
    let old_lf: f64 = old_lf_str.parse().unwrap_or(0.8);
    let new_lf = (alpha * time_ratio) + (1.0 - alpha) * old_lf;
    let _ = conn.execute("UPDATE estimator_settings SET value = ? WHERE key = 'learning_factor'", [new_lf.to_string()]);

    // 5. Update Pricing Power (Market Premium EMA)
    let premium_key = if is_high_val { "market_premium_high_value" } else { "market_premium" };
    let old_premium_str: String = conn.query_row("SELECT value FROM estimator_settings WHERE key = ?", [premium_key], |r| r.get(0)).unwrap_or(if is_high_val { "1.2" } else { "1.0" }.to_string());
    let old_premium: f64 = old_premium_str.parse().unwrap_or(1.0);

    // Smooth Weighting
    let weight = if price_ratio >= 1.0 { 1.0 } else if price_ratio <= 0.5 { 0.2 } else { 0.2 + (price_ratio - 0.5) * 1.6 };
    
    // Safety Guard: if weight is too low, dampen alpha
    let mut pricing_alpha = alpha;
    if weight < 0.25 { pricing_alpha *= 0.5; }

    let effective_price_ratio = (1.0 + (price_ratio - 1.0) * weight).clamp(0.7, 1.5);
    let new_premium = (pricing_alpha * effective_price_ratio + (1.0 - pricing_alpha) * old_premium).clamp(0.8, 1.8);

    // Save trend before updating current
    let old_premium_save_key = if is_high_val { "market_premium_high_value_old" } else { "market_premium_old" };
    let _ = conn.execute("UPDATE estimator_settings SET value = ? WHERE key = ?", [old_premium.to_string(), old_premium_save_key.to_string()]);
    let _ = conn.execute("UPDATE estimator_settings SET value = ? WHERE key = ?", [new_premium.to_string(), premium_key.to_string()]);
    
    // Update usage count
    let _ = conn.execute("UPDATE estimator_settings SET value = ? WHERE key = ?", [(count + 1).to_string(), count_key.to_string()]);

    // 6. Dynamic Threshold Evolution
    if !is_high_val {
        let mut stmt = conn.prepare("SELECT actual_price FROM estimator_projects WHERE is_completed = 1 ORDER BY created_at DESC LIMIT 5").unwrap();
        let prices: Vec<f64> = stmt.query_map([], |r| r.get(0)).unwrap().filter_map(|r| r.ok()).collect();
        
        if prices.len() >= 3 {
            let avg_price: f64 = prices.iter().sum::<f64>() / prices.len() as f64;
            let old_threshold_str: String = conn.query_row("SELECT value FROM estimator_settings WHERE key = 'market_premium_threshold'", [], |r| r.get(0)).unwrap_or("20000".to_string());
            let old_threshold: f64 = old_threshold_str.parse().unwrap_or(20000.0);
            
            let raw_new_threshold = 0.7 * old_threshold + 0.3 * (avg_price * new_premium);
            let final_threshold = raw_new_threshold.min(avg_price * 1.5);
            let _ = conn.execute("UPDATE estimator_settings SET value = ? WHERE key = 'market_premium_threshold'", [final_threshold.to_string()]);
        }
    }

    // 7. Update Module Averages
    let module_ids_str = project.module_ids.clone().unwrap_or_default();
    let module_ids: Vec<i32> = module_ids_str.split(',').filter_map(|s| s.parse().ok()).collect();
    for mid in module_ids {
        if let Ok((old_avg, usage_count)) = conn.query_row(
            "SELECT avg_hours, usage_count FROM estimator_modules WHERE id = ?",
            params![mid],
            |row| Ok((row.get::<_, f64>(0)?, row.get::<_, i32>(1)?)),
        ) {
            let estimated_actual_for_module = old_avg * time_ratio;
            let new_avg = ((old_avg * usage_count as f64) + estimated_actual_for_module) / (usage_count as f64 + 1.0);
            let _ = conn.execute("UPDATE estimator_modules SET avg_hours = ?, usage_count = usage_count + 1 WHERE id = ?", params![new_avg, mid]);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_estimator_settings(db: tauri::State<DbConnection>) -> Result<std::collections::HashMap<String, String>, String> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT key, value FROM estimator_settings").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;

    let mut settings = std::collections::HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|e| e.to_string())?;
        settings.insert(key, value);
    }
    Ok(settings)
}

#[tauri::command]
pub fn update_estimator_setting(db: tauri::State<DbConnection>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE estimator_settings SET value = ? WHERE key = ?",
        params![value, key],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_estimator_module(db: tauri::State<DbConnection>, id: i32, name: String, hours: f64) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "UPDATE estimator_modules SET name = ?, avg_hours = ? WHERE id = ?",
        params![name, hours, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_estimator_module(db: tauri::State<DbConnection>, id: i32) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "DELETE FROM estimator_modules WHERE id = ?",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
