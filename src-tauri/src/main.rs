// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod commands;

use db::initialize_database;
use commands::*;

fn main() {
    // Initialize database
    let db = initialize_database().expect("Failed to initialize database");
    
    tauri::Builder::default()
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            create_account,
            update_account,
            get_categories,
            create_category,
            update_category,
            get_clients,
            create_client,
            update_client,
            get_projects,
            create_project,
            update_project,
            get_tags,
            create_tag,
            get_transactions,
            get_transaction_balances,
            create_transaction,
            update_transaction,
            get_transaction_tags,
            get_monthly_summary,
            get_category_summary,
            get_client_summary,
            get_project_income_report,
            get_overall_stats,
            get_dashboard_data,
            get_time_logs,
            create_time_log,
            update_time_log,
            delete_time_log,
            get_investments,
            get_investments_summary,
            create_investment,
            update_investment,
            delete_investment,
            get_investment_platform_summary,
            sync_investment_prices,
            add_investment_lot,
            delete_investment_lot,
            get_live_market_price,
            get_project_payments,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
