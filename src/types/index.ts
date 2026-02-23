export interface Account {
    id?: number;
    name: string;
    account_type: string;
    opening_balance: number;
    current_balance?: number;
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

    // FD/RD/PPF specific
    principal_amount?: number;
    interest_rate?: number;
    maturity_date?: string;
    maturity_amount?: number;
    monthly_deposit?: number;
    tenure_months?: number;
    opening_date?: string;
    compounding?: 'monthly' | 'quarterly' | 'yearly';
    bank_name?: string;

    // Category link for auto-tracking deposits
    category_id?: number;

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
    is_investment: boolean;
}

export interface Client {
    id?: number;
    name: string;
    notes?: string;
    status?: 'active' | 'inactive' | 'prospect' | 'archived';
    business_name?: string;
    address?: string;
    contact_number?: string;
    email?: string;
    gst?: string;
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
    status?: 'active' | 'completed' | 'cancelled' | 'on_hold' | 'prospect' | 'archived';

    // SRS Fields
    srs_internal_link?: string;
    srs_client_approved_link?: string;
    srs_status?: 'Draft' | 'Sent' | 'Approved';
    srs_approved_date?: string;

    // Computed fields
    received_amount?: number;
    spent_amount?: number;
    logged_hours?: number;
}

// Quotation Types
export interface QuotationItem {
    id?: number;
    quotation_id?: number;
    description: string;
    timeline?: string;
    features?: string; // Newline separated
    quantity: number;
    rate: number;
    amount: number;
}

export interface Quotation {
    id?: number;
    client_id: number;
    project_id?: number;
    project_title?: string;
    quotation_number: string;
    issue_date: string;
    valid_till: string;
    total_amount: number;
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
    payment_terms?: string;
    terms_conditions?: string;
    created_at?: string;
    items?: QuotationItem[];
    client_name?: string;
    project_name?: string;
    client_business_name?: string;
    client_address?: string;
    client_phone?: string;
    client_email?: string;
    client_gst?: string;
}

// Invoice Types
export interface InvoiceItem {
    id?: number;
    invoice_id?: number;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface InvoicePayment {
    id?: number;
    invoice_id: number;
    amount_paid: number;
    payment_date: string;
    payment_mode: 'UPI' | 'Bank' | 'Cash' | 'Other';
    transaction_reference?: string;
    transaction_id?: number;
    created_at?: string;
}

export interface Invoice {
    id?: number;
    project_id: number;
    invoice_number: string;
    stage: 'Advance' | 'Milestone' | 'Final';
    issue_date: string;
    due_date: string;
    total_amount: number;
    status: 'Unpaid' | 'Partially Paid' | 'Paid';
    discount?: number;
    tax_percentage?: number;
    project_reference?: string;
    notes?: string;
    created_at?: string;
    items?: InvoiceItem[];
    payments?: InvoicePayment[];
    project_name?: string;
    client_name?: string;
    client_business_name?: string;
    client_address?: string;
    client_phone?: string;
    client_email?: string;
    client_gst?: string;
}

export interface CompanySettings {
    company_name: string;
    company_subtitle?: string;
    company_address: string;
    owner_name?: string;
    company_phone?: string;
    company_email?: string;
    company_logo?: string; // Base64 or URL
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    upi_id: string;
    pdf_theme_color: string;
    pdf_footer_text: string;
    show_qr_code: boolean;
    pdf_header_style?: 'Logo-Left' | 'Logo-Center' | 'No-Logo';
    pdf_font_size?: number;
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
    investment_categories: CategoryBudgetSummary[];
}

export interface MonthlyBudgetReport {
    month: string;
    income: number;
    expenses: number;
    investments: number;
    savings: number;
    savings_rate: number;
}
