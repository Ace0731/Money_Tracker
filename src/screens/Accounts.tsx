import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Account } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Accounts() {
    const { execute, loading } = useDatabase();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Account>({
        name: '',
        account_type: 'bank',
        opening_balance: 0,
        notes: '',
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const data = await execute<Account[]>('get_accounts');
            setAccounts(data);
        } catch (error) {
            console.error('Failed to load accounts:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await execute('update_account', { account: formData });
            } else {
                await execute('create_account', { account: formData });
            }
            await loadAccounts();
            setShowForm(false);
            setFormData({ name: '', account_type: 'bank', opening_balance: 0, notes: '' });
        } catch (error) {
            console.error('Failed to save account:', error);
        }
    };

    const handleEdit = (account: Account) => {
        setFormData(account);
        setShowForm(true);
    };

    const handleDelete = async () => {
        if (!formData.id) return;
        
        const result = await Swal.fire({
            title: 'Delete Account?',
            text: 'This will permanently delete the account if it has no transactions.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#3b82f6',
            confirmButtonText: 'Yes, delete it',
            background: '#0f172a',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_account', { id: formData.id });
                Swal.fire({ title: 'Deleted!', icon: 'success', background: '#0f172a', color: '#f1f5f9', timer: 1500, showConfirmButton: false });
                setShowForm(false);
                loadAccounts();
            } catch (error: any) {
                // The error string might be passed from rust, or it might be in an Error object.
                const errMsg = typeof error === 'string' ? error : error.message || 'Failed to delete account';
                Swal.fire({ 
                    title: 'Cannot Delete', 
                    text: errMsg, 
                    icon: 'error', 
                    background: '#0f172a', 
                    color: '#f1f5f9' 
                });
            }
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>Accounts</h1>
                <button
                    onClick={() => {
                        setFormData({ name: '', account_type: 'bank', opening_balance: 0, notes: '' });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Account
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                    <div
                        key={account.id}
                        className={`${darkTheme.card} p-6 cursor-pointer`}
                        onClick={() => handleEdit(account)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold text-slate-100">{account.name}</h3>
                            <span className={darkTheme.badgeNeutral + " capitalize"}>
                                {account.account_type}
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">
                            {formatCurrency(account.current_balance ?? account.opening_balance)}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase mt-1">
                            Opening: {formatCurrency(account.opening_balance)}
                        </p>
                        {account.notes && <p className="text-sm text-slate-400 mt-2">{account.notes}</p>}
                    </div>
                ))}
            </div>

            {accounts.length === 0 && !loading && (
                <div className={darkTheme.empty}>
                    No accounts yet. Click "Add Account" to create one.
                </div>
            )}

            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>
                            {formData.id ? 'Edit Account' : 'Add Account'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Account Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={darkTheme.input}
                                    placeholder="e.g., HDFC Savings"
                                />
                            </div>

                            <div>
                                <label className={darkTheme.label}>Account Type *</label>
                                <select
                                    required
                                    value={formData.account_type}
                                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                                    className={darkTheme.select}
                                >
                                    <option value="bank">Bank</option>
                                    <option value="cash">Cash</option>
                                    <option value="investment">Investment</option>
                                    <option value="bucket">Bucket</option>
                                </select>
                            </div>

                            <div>
                                <label className={darkTheme.label}>Opening Balance *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.opening_balance}
                                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) })}
                                    className={darkTheme.input}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className={darkTheme.label}>Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.textarea}
                                    rows={3}
                                    placeholder="Optional notes..."
                                />
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                {formData.id ? (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="text-red-500 hover:text-red-400 font-medium px-2 py-1 transition"
                                    >
                                        Delete
                                    </button>
                                ) : (
                                    <div /> /* Empty div for flex spacing */
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className={darkTheme.btnCancel}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={darkTheme.btnPrimary}
                                    >
                                        {formData.id ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
