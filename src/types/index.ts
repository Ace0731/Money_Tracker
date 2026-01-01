export interface Account {
    id?: number;
    name: string;
    account_type: string;
    opening_balance: number;
    notes?: string;
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
    created_at?: string;
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
    notes?: string;
    created_at?: string;
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
