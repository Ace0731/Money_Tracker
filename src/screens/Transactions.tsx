import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Transaction, Account, Category, Client, Project, Tag, Investment } from '../types';
import type { TransactionWithDetails, TransactionBalances } from '../types/transactions';
import { formatCurrency, formatDate, getDirectionColor } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';


export default function Transactions() {
    const { execute, loading } = useDatabase();
    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [balances, setBalances] = useState<TransactionBalances>({
        accounts: [],
        total_opening_balance: 0,
        total_current_balance: 0
    });
    const [showBalances, setShowBalances] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [viewOnly, setViewOnly] = useState(false);

    const [filters, setFilters] = useState<{
        start_date: string;
        end_date: string;
        direction: string;
        from_account_id?: number;
        to_account_id?: number;
    }>({
        start_date: '',
        end_date: '',
        direction: '',
        from_account_id: undefined,
        to_account_id: undefined,
    });

    // Reference data
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [goals, setGoals] = useState<any[]>([]);

    // Form state
    const [formData, setFormData] = useState<Transaction>({
        date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
        amount: 0,
        direction: 'expense',
        from_account_id: undefined,
        to_account_id: undefined,
        category_id: 0,
        client_id: undefined,
        project_id: undefined,
        investment_id: undefined,
        goal_id: undefined,
        notes: '',
    });
    const [selectedTags, setSelectedTags] = useState<number[]>([]);

    // Set default date filters on mount
    useEffect(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDayNum = new Date(year, month + 1, 0).getDate();
        const lastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

        setFilters({
            start_date: firstDay,
            end_date: lastDay,
            direction: '',
            from_account_id: undefined,
            to_account_id: undefined,
        });
    }, []);

    useEffect(() => {
        if (filters.start_date || filters.end_date || filters.direction) {
            loadTransactions();
            loadBalances();
        }
        loadReferenceData();
    }, [filters]);

    const loadTransactions = async () => {
        try {
            const data = await execute<TransactionWithDetails[]>('get_transactions', { filters });
            setTransactions(data);
        } catch (error) {
            console.error('Failed to load transactions:', error);
        }
    };

    const loadBalances = async () => {
        try {
            const data = await execute<TransactionBalances>('get_transaction_balances', { filters });
            setBalances(data);
        } catch (error) {
            console.error('Failed to load balances:', error);
        }
    };

    const loadReferenceData = async () => {
        try {
            const [accountsData, categoriesData, clientsData, projectsData, tagsData, investmentsData] = await Promise.all([
                execute<Account[]>('get_accounts'),
                execute<Category[]>('get_categories'),
                execute<Client[]>('get_clients'),
                execute<Project[]>('get_projects'),
                execute<Tag[]>('get_tags'),
                execute<Investment[]>('get_investments'),
            ]);
            setAccounts(accountsData);
            setCategories(categoriesData);
            setClients(clientsData);
            setProjects(projectsData);
            setTags(tagsData);
            setInvestments(investmentsData);
            
            const goalsData = await execute<any[]>('get_goals');
            setGoals(goalsData);
        } catch (error) {
            console.error('Failed to load reference data:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await execute('update_transaction', { transaction: formData, tagIds: selectedTags });
            } else {
                await execute('create_transaction', { transaction: formData, tagIds: selectedTags });
            }
            await loadTransactions();
            await loadBalances();
            setShowForm(false);
            resetForm();
        } catch (error) {
            console.error('Failed to save transaction:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to save transaction: ' + (error as any),
                icon: 'error',
                background: '#1e293b',
                color: '#f1f5f9'
            });
        }
    };

    const handleDelete = async () => {
        if (!formData.id) return;
        
        const result = await Swal.fire({
            title: 'Delete Transaction?',
            text: 'This will revert its effect on account balances.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: '#1e293b',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_transaction', { id: formData.id });
                await loadTransactions();
                await loadBalances();
                setShowForm(false);
                resetForm();
            } catch (error) {
                console.error('Failed to delete transaction:', error);
            }
        }
    };

    const handleEdit = async (transaction: TransactionWithDetails) => {
        const tagIds = await execute<number[]>('get_transaction_tags', { transactionId: transaction.id });

        setFormData({
            id: transaction.id,
            date: transaction.date,
            amount: transaction.amount,
            direction: transaction.direction,
            from_account_id: transaction.from_account_id,
            to_account_id: transaction.to_account_id,
            category_id: transaction.category_id,
            client_id: transaction.client_id,
            project_id: transaction.project_id,
            investment_id: transaction.investment_id,
            goal_id: transaction.goal_id,
            notes: transaction.notes,
        });
        setSelectedTags(tagIds);
        setViewOnly(false);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            direction: 'expense',
            from_account_id: undefined,
            to_account_id: undefined,
            category_id: 0,
            client_id: undefined,
            project_id: undefined,
            investment_id: undefined,
            goal_id: undefined,
            notes: '',
        });
        setSelectedTags([]);
        setViewOnly(false);
    };

    const filteredCategories = categories.filter(c => c.kind === formData.direction);
    const filteredProjects = formData.client_id
        ? projects.filter(p => p.client_id === formData.client_id)
        : projects;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>Transactions</h1>
                <button
                    onClick={() => {
                        resetForm();
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Transaction
                </button>
            </div>



            {/* Balance Table */}
            <div className={darkTheme.card + " mb-6 overflow-hidden"}>
                <div
                    className="p-4 border-b border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => setShowBalances(!showBalances)}
                >
                    <h2 className="text-lg font-semibold text-slate-200">Account Balances</h2>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                            Total: <span className="text-green-400 font-semibold">{formatCurrency(balances.total_current_balance)}</span>
                        </div>
                        <svg
                            className={`w-5 h-5 text-slate-400 transition-transform ${showBalances ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                {showBalances && (
                    <div className="overflow-x-auto">
                        <table className={darkTheme.table}>
                            <thead className={darkTheme.tableHeader}>
                                <tr>
                                    <th className={darkTheme.tableHeaderCell}>Account</th>
                                    <th className={darkTheme.tableHeaderCell}>Type</th>
                                    <th className={darkTheme.tableHeaderCell}>Opening Balance</th>
                                    <th className={darkTheme.tableHeaderCell}>Current Balance</th>
                                    <th className={darkTheme.tableHeaderCell}>Change</th>
                                </tr>
                            </thead>
                            <tbody>
                                {balances.accounts.map((account) => {
                                    const change = account.current_balance - account.opening_balance;
                                    return (
                                        <tr key={account.account_id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                            <td className={darkTheme.tableCell + " font-medium"}>{account.account_name}</td>
                                            <td className={darkTheme.tableCell}>
                                                <span className={
                                                    account.account_type === 'bank' ? 'text-blue-400' :
                                                        account.account_type === 'cash' ? 'text-green-400' :
                                                            'text-purple-400'
                                                }>
                                                    {account.account_type}
                                                </span>
                                            </td>
                                            <td className={darkTheme.tableCell + " text-blue-400 font-semibold"}>
                                                {formatCurrency(account.opening_balance)}
                                            </td>
                                            <td className={darkTheme.tableCell + " text-green-400 font-semibold"}>
                                                {formatCurrency(account.current_balance)}
                                            </td>
                                            <td className={darkTheme.tableCell}>
                                                <span className={change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    {change >= 0 ? '+' : ''}{formatCurrency(change)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {balances.accounts.length > 0 && (
                                    <tr className="bg-slate-700/50 font-bold">
                                        <td className={darkTheme.tableCell} colSpan={2}>Total</td>
                                        <td className={darkTheme.tableCell + " text-blue-400 text-lg"}>
                                            {formatCurrency(balances.total_opening_balance)}
                                        </td>
                                        <td className={darkTheme.tableCell + " text-green-400 text-lg"}>
                                            {formatCurrency(balances.total_current_balance)}
                                        </td>
                                        <td className={darkTheme.tableCell}>
                                            <span className={
                                                (balances.total_current_balance - balances.total_opening_balance) >= 0
                                                    ? 'text-green-400'
                                                    : 'text-red-400'
                                            }>
                                                {(balances.total_current_balance - balances.total_opening_balance) >= 0 ? '+' : ''}
                                                {formatCurrency(balances.total_current_balance - balances.total_opening_balance)}
                                            </span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {balances.accounts.length === 0 && (
                            <div className="p-8 text-center text-slate-500">
                                No accounts found
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className={darkTheme.card + " p-4 mb-6"}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Start Date</label>
                            <input
                                type="date"
                                value={filters.start_date}
                                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                                className={darkTheme.input}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>End Date</label>
                            <input
                                type="date"
                                value={filters.end_date}
                                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                                className={darkTheme.input}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Direction</label>
                            <select
                                value={filters.direction}
                                onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
                                className={darkTheme.select}
                            >
                                <option value="">All</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                                <option value="transfer">Transfer</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Source Account</label>
                            <select
                                value={filters.from_account_id || ''}
                                onChange={(e) => setFilters({ ...filters, from_account_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                className={darkTheme.select}
                            >
                                <option value="">All Sources</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Destination Account</label>
                            <select
                                value={filters.to_account_id || ''}
                                onChange={(e) => setFilters({ ...filters, to_account_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                className={darkTheme.select}
                            >
                                <option value="">All Destinations</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                </div>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}


            {/* Transactions Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
                <table className={darkTheme.table}>
                    <thead className={darkTheme.tableHeader}>
                        <tr>
                            <th className={darkTheme.tableHeaderCell}>Date</th>
                            <th className={darkTheme.tableHeaderCell}>Amount</th>
                            <th className={darkTheme.tableHeaderCell}>Direction</th>
                            <th className={darkTheme.tableHeaderCell}>Account(s)</th>
                            <th className={darkTheme.tableHeaderCell}>Category</th>
                            <th className={darkTheme.tableHeaderCell}>Client/Project</th>
                            <th className={darkTheme.tableHeaderCell}>Tags</th>
                            <th className={darkTheme.tableHeaderCell}>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction) => (
                            <tr
                                key={transaction.id}
                                onClick={() => handleEdit(transaction)}
                                className={darkTheme.tableRow}
                            >
                                <td className={darkTheme.tableCell}>{formatDate(transaction.date)}</td>
                                <td className={`${darkTheme.tableCell} font-bold ${getDirectionColor(transaction.direction)}`}>
                                    {formatCurrency(transaction.amount)}
                                </td>
                                <td className={darkTheme.tableCell}>
                                    <span className={
                                        transaction.direction === 'income' ? darkTheme.badgeIncome :
                                            transaction.direction === 'expense' ? darkTheme.badgeExpense :
                                                darkTheme.badgeTransfer
                                    }>
                                        {transaction.direction}
                                    </span>
                                </td>
                                <td className={darkTheme.tableCell}>
                                    {transaction.direction === 'income' && transaction.to_account_name}
                                    {transaction.direction === 'expense' && transaction.from_account_name}
                                    {transaction.direction === 'transfer' &&
                                        `${transaction.from_account_name} → ${transaction.to_account_name}`
                                    }
                                </td>
                                <td className={darkTheme.tableCell}>{transaction.category_name}</td>
                                <td className={darkTheme.tableCell}>
                                    {transaction.client_name && <div className="text-blue-400">{transaction.client_name}</div>}
                                    {transaction.project_name && <div className="text-sm text-slate-500">{transaction.project_name}</div>}
                                    {transaction.investment_name && <div className="text-xs text-purple-400">🔗 {transaction.investment_name}</div>}
                                    {transaction.goal_name && <div className="text-xs text-blue-400">🎯 {transaction.goal_name}</div>}
                                </td>
                                <td className={darkTheme.tableCell}>
                                    <div className="flex flex-wrap gap-1">
                                        {transaction.tags.map((tag, idx) => (
                                            <span key={idx} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className={darkTheme.tableCell + " max-w-xs truncate"}>
                                    {transaction.notes}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {transactions.length === 0 && !loading && (
                    <div className={darkTheme.empty}>
                        No transactions found. Click "Add Transaction" to create one.
                    </div>
                )}
            </div>

            {/* Transaction Form Modal */}
            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className={darkTheme.modalTitle} style={{ margin: 0 }}>
                                {viewOnly ? '🔍 View Transaction' : (formData.id ? 'Edit Transaction' : 'Add Transaction')}
                            </h2>
                            {viewOnly && (
                                <button
                                    onClick={() => setViewOnly(false)}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: '8px',
                                        background: 'rgba(245,158,11,0.15)',
                                        border: '1px solid rgba(245,158,11,0.4)',
                                        color: '#fbbf24',
                                        fontWeight: 600,
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✏️ Edit
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Direction */}
                            <div>
                                <label className={darkTheme.label}>Direction *</label>
                                <div className="flex gap-2">
                                    {['income', 'expense', 'transfer'].map((dir) => (
                                        <button
                                            key={dir}
                                            type="button"
                                            disabled={viewOnly}
                                            onClick={() => {
                                                if (viewOnly) return;
                                                const newDir = dir as any;
                                                setFormData({
                                                    ...formData,
                                                    direction: newDir,
                                                    // Clear irrelevant accounts
                                                    from_account_id: newDir === 'income' ? undefined : formData.from_account_id,
                                                    to_account_id: newDir === 'expense' ? undefined : formData.to_account_id
                                                });
                                            }}
                                            className={`px-4 py-2 rounded capitalize transition-colors ${formData.direction === dir
                                                ? dir === 'income' ? 'bg-green-600 text-white' :
                                                    dir === 'expense' ? 'bg-red-600 text-white' :
                                                        'bg-blue-600 text-white'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                } ${viewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {dir}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Amount & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Amount *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        readOnly={viewOnly}
                                        value={formData.amount || ''}
                                        onChange={(e) => {
                                            if (viewOnly) return;
                                            const value = e.target.value;
                                            setFormData({
                                                ...formData,
                                                amount: value === '' ? 0 : parseFloat(value)
                                            });
                                        }}
                                        className={darkTheme.input + (viewOnly ? ' opacity-60 cursor-not-allowed' : '')}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Date *</label>
                                    <input
                                        type="date"
                                        required
                                        readOnly={viewOnly}
                                        value={formData.date}
                                        onChange={(e) => { if (!viewOnly) setFormData({ ...formData, date: e.target.value }); }}
                                        className={darkTheme.input + (viewOnly ? ' opacity-60 cursor-not-allowed' : '')}
                                    />
                                </div>
                            </div>

                            {/* Accounts */}
                            {formData.direction !== 'income' && (
                                <div>
                                    <label className={darkTheme.label}>From Account *</label>
                                    <select
                                        required
                                        value={formData.from_account_id || ''}
                                        onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">Select Account</option>
                                        {accounts.map((acc) => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {formData.direction !== 'expense' && (
                                <div>
                                    <label className={darkTheme.label}>To Account *</label>
                                    <select
                                        required
                                        value={formData.to_account_id || ''}
                                        onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">Select Account</option>
                                        {accounts.map((acc) => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Goal Selection (only for buckets) */}
                            {((formData.direction === 'expense' && accounts.find(a => a.id === formData.from_account_id)?.account_type === 'bucket') ||
                              (formData.direction === 'transfer' && accounts.find(a => a.id === formData.to_account_id)?.account_type === 'bucket')) && (
                                <div>
                                    <label className={darkTheme.label}>Linked Goal (Optional)</label>
                                    <select
                                        value={formData.goal_id || ''}
                                        onChange={(e) => setFormData({ ...formData, goal_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">None</option>
                                        {goals
                                            .filter(g => g.status === 'active' && 
                                                (g.bucket_id === formData.from_account_id || g.bucket_id === formData.to_account_id))
                                            .map((goal) => (
                                                <option key={goal.id} value={goal.id}>{goal.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}

                            {/* Category */}
                            <div>
                                <label className={darkTheme.label}>Category *</label>
                                <select
                                    required
                                    value={formData.category_id || ''}
                                    onChange={(e) => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
                                    className={darkTheme.select}
                                >
                                    <option value="">Select Category</option>
                                    {filteredCategories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Client & Project */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Client (Optional)</label>
                                    <select
                                        value={formData.client_id || ''}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            client_id: e.target.value ? parseInt(e.target.value) : undefined,
                                            project_id: undefined
                                        })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">None</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {formData.client_id ? (
                                    <div>
                                        <label className={darkTheme.label}>Project (Optional)</label>
                                        <select
                                            value={formData.project_id || ''}
                                            onChange={(e) => setFormData({ ...formData, project_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                            className={darkTheme.select}
                                        >
                                            <option value="">None</option>
                                            {filteredProjects.map((project) => (
                                                <option key={project.id} value={project.id}>{project.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className={darkTheme.label}>Link to Investment (Optional)</label>
                                        <select
                                            value={formData.investment_id || ''}
                                            onChange={(e) => setFormData({ ...formData, investment_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                            className={darkTheme.select}
                                        >
                                            <option value="">None</option>
                                            {investments.map((inv) => (
                                                <option key={inv.id} value={inv.id}>{inv.name} ({inv.investment_type})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Tags */}
                            <div>
                                <label className={darkTheme.label}>Tags (Optional)</label>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() => {
                                                if (selectedTags.includes(tag.id!)) {
                                                    setSelectedTags(selectedTags.filter(t => t !== tag.id));
                                                } else {
                                                    setSelectedTags([...selectedTags, tag.id!]);
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedTags.includes(tag.id!)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className={darkTheme.label}>Notes (Optional)</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.textarea}
                                    rows={3}
                                    placeholder="Add any notes..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center pt-4">
                                <div>
                                    {formData.id && !viewOnly && (
                                        <button 
                                            type="button" 
                                            onClick={handleDelete}
                                            className="px-4 py-2 text-red-400 hover:text-red-300 font-bold transition-colors"
                                        >
                                            Delete Transaction
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className={darkTheme.btnCancel}>
                                        Close
                                    </button>
                                    {!viewOnly && (
                                        <button type="submit" className={darkTheme.btnPrimary}>
                                            {formData.id ? 'Update' : 'Create'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
