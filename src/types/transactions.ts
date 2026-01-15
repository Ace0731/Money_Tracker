export interface TransactionWithDetails {
    id: number;
    date: string;
    amount: number;
    direction: 'income' | 'expense' | 'transfer';
    from_account_id?: number;
    from_account_name?: string;
    to_account_id?: number;
    to_account_name?: string;
    category_id: number;
    category_name: string;
    client_id?: number;
    client_name?: string;
    project_id?: number;
    project_name?: string;
    investment_id?: number;
    investment_name?: string;
    notes?: string;
    tags: string[];
}
export interface AccountBalance {
    account_id: number;
    account_name: string;
    account_type: string;
    opening_balance: number;
    current_balance: number;
}

export interface TransactionBalances {
    accounts: AccountBalance[];
    total_opening_balance: number;
    total_current_balance: number;
}
