export interface Account {
    id?: number;
    name: string;
    account_type: string;
    opening_balance: number;
    notes?: string;
}

export interface InvestmentLot {
    id?: number;
    investment_id: number;
    quantity: number;
    price_per_unit: number;
    charges: number;
    date: string;
    lot_type: 'buy' | 'sell';
}

export interface Investment {
    id?: number;
    name: string;
    investment_type: 'stock' | 'mf' | 'fd' | 'rd' | 'nps' | 'ppf';
    account_id: number;

    // Stocks/MF specific
    units?: number;
    avg_buy_price?: number;
    current_price?: number;

    // FD/RD specific
    principal_amount?: number;
    interest_rate?: number;
    maturity_date?: string;
    maturity_amount?: number;
    monthly_deposit?: number;

    // Retirement (NPS/PPF) specific
    retirement_age?: number;
    current_age?: number;

    notes?: string;
    provider_symbol?: string;
    last_updated_at?: string;
    principal_charges?: number;
    created_at?: string;
}

export interface InvestmentSummary {
    investment: Investment;
    account_name: string;
    lots: InvestmentLot[];
    total_units: number;
    avg_buy_price: number;
    total_invested: number;
    total_expenses: number;
    current_valuation: number;
    net_gain: number;
    gain_percentage: number;
}

export interface PlatformBalance {
    account_id: number;
    name: string;
    balance: number;
}

export interface Category {
    id?: number;
    name: string;
    kind: 'income' | 'expense' | 'transfer';
    notes?: string;
}

export interface Client {
    id?: number;
    name: string;
    notes?: string;
    created_at?: string;
}

export interface Project {
    id?: number;
    name: string;
    client_id?: number;
    expected_amount?: number;
    daily_rate?: number;
    start_date?: string;
    end_date?: string;
    notes?: string;
    completed?: boolean;
    // Computed fields
    received_amount?: number;
    spent_amount?: number;
    logged_hours?: number;
}

export interface TimeLog {
    id?: number;
    project_id: number;
    date: string;
    hours: number;
    task?: string;
    start_time?: string;
    end_time?: string;
    created_at?: string;
}

export interface ProjectPayment {
    id: number;
    date: string;
    amount: number;
    notes?: string;
    account_name?: string;
}

export interface Tag {
    id?: number;
    name: string;
}

export interface Transaction {
    id?: number;
    date: string;
    amount: number;
    direction: 'income' | 'expense' | 'transfer';
    from_account_id?: number;
    to_account_id?: number;
    category_id: number;
    client_id?: number;
    project_id?: number;
    investment_id?: number;
    // Details
    from_account_name?: string;
    to_account_name?: string;
    category_name?: string;
    client_name?: string;
    project_name?: string;
    investment_name?: string;
    notes?: string;
    created_at?: string;
    tags?: string[];
}

export interface TransactionFilters {
    start_date?: string;
    end_date?: string;
    account_ids?: number[];
    category_ids?: number[];
    client_ids?: number[];
    project_ids?: number[];
    tag_ids?: number[];
}

// ============ BUDGET TYPES ============

export interface InvestmentRate {
    id?: number;
    investment_type: string;
    rate: number;
    effective_date: string;
    notes?: string;
}

export interface BudgetSettings {
    salary_date: number;
}

export interface MonthlyIncome {
    id?: number;
    month: string;
    expected_income: number;
    notes?: string;
}

export interface Budget {
    id?: number;
    month: string;
    category_id: number;
    budgeted_amount: number;
    notes?: string;
}

export interface CategoryBudgetSummary {
    category_id: number;
    category_name: string;
    category_kind: string;
    budgeted: number;
    actual: number;
    remaining: number;
    is_over_budget: boolean;
}

export interface BudgetSummary {
    month: string;
    salary_date: number;
    expected_income: number;
    actual_income: number;
    total_budgeted: number;
    total_spent: number;
    total_invested: number;
    savings: number;
    savings_rate: number;
    income_categories: CategoryBudgetSummary[];
    expense_categories: CategoryBudgetSummary[];
}

export interface MonthlyBudgetReport {
    month: string;
    income: number;
    expenses: number;
    investments: number;
    savings: number;
    savings_rate: number;
}
