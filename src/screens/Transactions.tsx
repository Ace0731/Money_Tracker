import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Transaction, Account, Category, Client, Project, Tag, Investment } from '../types';
import type { TransactionWithDetails } from '../types/transactions';
import { formatCurrency, formatDate, getDirectionColor } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Transactions() {
    const { execute, loading } = useDatabase();
    const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
    const [showForm, setShowForm] = useState(false);

    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        direction: '',
    });

    // Reference data
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);

    // Form state
    const [formData, setFormData] = useState<Transaction>({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        direction: 'expense',
        from_account_id: undefined,
        to_account_id: undefined,
        category_id: 0,
        client_id: undefined,
        project_id: undefined,
        investment_id: undefined,
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
        });
    }, []);

    useEffect(() => {
        if (filters.start_date || filters.end_date || filters.direction) {
            loadTransactions();
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
            notes: transaction.notes,
        });
        setSelectedTags(tagIds);
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
            notes: '',
        });
        setSelectedTags([]);
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

            {/* Filters */}
            <div className={darkTheme.card + " p-4 mb-6"}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={darkTheme.label}>Start Date</label>
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                            className={darkTheme.input}
                        />
                    </div>
                    <div>
                        <label className={darkTheme.label}>End Date</label>
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                            className={darkTheme.input}
                        />
                    </div>
                    <div>
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
                        <h2 className={darkTheme.modalTitle}>
                            {formData.id ? 'Edit Transaction' : 'Add Transaction'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Direction */}
                            <div>
                                <label className={darkTheme.label}>Direction *</label>
                                <div className="flex gap-2">
                                    {['income', 'expense', 'transfer'].map((dir) => (
                                        <button
                                            key={dir}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, direction: dir as any })}
                                            className={`px-4 py-2 rounded capitalize transition-colors ${formData.direction === dir
                                                ? dir === 'income' ? 'bg-green-600 text-white' :
                                                    dir === 'expense' ? 'bg-red-600 text-white' :
                                                        'bg-blue-600 text-white'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
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
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                        className={darkTheme.input}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className={darkTheme.input}
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
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>
                                    Cancel
                                </button>
                                <button type="submit" className={darkTheme.btnPrimary}>
                                    {formData.id ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
