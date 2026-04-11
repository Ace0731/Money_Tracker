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
            delete_account,
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
            delete_transaction,
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
            update_investment_lot,
            delete_investment_lot,
            get_live_market_price,
            get_project_payments,
            get_investment_benchmark,
            set_investment_benchmark,
            get_investment_benchmark_report,
            // Budget & Scheduled Transactions
            get_scheduled_transactions,
            create_scheduled_transaction,
            update_scheduled_transaction,
            delete_scheduled_transaction,
            process_pending_schedules,
            get_monthly_budget,
            // Goals & Allocation
            get_goals,
            create_goal,
            update_goal,
            delete_goal,
            get_allocation_settings,
            update_allocation_settings,
            get_allocation_rules,
            update_allocation_rule,
            // Company Settings commands
            save_pdf,
            open_file_folder,
            // Income Breakdown
            get_category_hours,
            create_category_hour,
            update_category_hour,
            delete_category_hour,
            get_income_breakdown,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
