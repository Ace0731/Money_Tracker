import React, { useEffect, useState, useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Account } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Accounts() {
    const { execute, loading } = useDatabase();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Account>({
        name: '',
        account_type: 'bank',
        opening_balance: 0,
        parent_id: undefined,
        bucket_role: 'none',
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

    // Grouping logic
    const { physicalAccounts, independentBuckets, bucketsByParent } = useMemo(() => {
        const physical = accounts.filter(a => a.account_type !== 'bucket');
        const buckets = accounts.filter(a => a.account_type === 'bucket');
        
        const byParent: Record<number, Account[]> = {};
        const independent: Account[] = [];

        buckets.forEach(b => {
            if (b.parent_id) {
                if (!byParent[b.parent_id]) byParent[b.parent_id] = [];
                byParent[b.parent_id].push(b);
            } else {
                independent.push(b);
            }
        });

        return { physicalAccounts: physical, independentBuckets: independent, bucketsByParent: byParent };
    }, [accounts]);

    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedAccounts);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedAccounts(newSet);
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
            setFormData({ name: '', account_type: 'bank', opening_balance: 0, parent_id: undefined, bucket_role: 'none', notes: '' });
        } catch (error) {
            console.error('Failed to save account:', error);
        }
    };

    const handleEdit = (account: Account, e?: React.MouseEvent) => {
        e?.stopPropagation();
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

    const renderAccountCard = (account: Account) => {
        const accountBuckets = bucketsByParent[account.id!] || [];
        const hasBuckets = accountBuckets.length > 0;
        const isExpanded = expandedAccounts.has(account.id!);
        const allocatedBalance = accountBuckets.reduce((sum, b) => sum + (b.current_balance ?? b.opening_balance), 0);
        const totalBalance = account.current_balance ?? account.opening_balance;
        const unallocatedBalance = totalBalance - allocatedBalance;

        return (
            <div
                key={account.id}
                className={`${darkTheme.card} overflow-hidden flex flex-col`}
            >
                {/* Main Card Header */}
                <div 
                    className="p-6 cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => handleEdit(account)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                {account.account_type === 'bank' ? '🏦' : account.account_type === 'investment' ? '📈' : '💵'} 
                                {account.name}
                            </h3>
                            <span className={darkTheme.badgeNeutral + " capitalize inline-block mt-1"}>
                                {account.account_type}
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">
                            {formatCurrency(totalBalance)}
                        </p>
                    </div>
                    {account.notes && <p className="text-sm text-slate-400 mt-2 line-clamp-1">{account.notes}</p>}
                </div>

                {/* Unallocated / Breakdown Section */}
                {hasBuckets && (
                    <div className="border-t border-slate-700 bg-slate-900/50">
                        <div 
                            className="flex justify-between items-center px-6 py-3 cursor-pointer select-none hover:bg-slate-700/20"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(account.id!);
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                    {accountBuckets.length} Buckets
                                </span>
                                {!isExpanded && unallocatedBalance !== 0 && (
                                    <span className="text-[11px] text-emerald-400 font-medium bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                                        {formatCurrency(unallocatedBalance)} Available
                                    </span>
                                )}
                            </div>
                            <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500" 
                                    style={{ width: `${Math.min(100, (allocatedBalance / totalBalance) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="px-6 pb-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                                    <span className="text-sm text-slate-400">Unallocated Funds</span>
                                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(unallocatedBalance)}</span>
                                </div>
                                {accountBuckets.map(bucket => (
                                    <div 
                                        key={bucket.id} 
                                        className="flex justify-between items-center hover:bg-slate-700/50 -mx-2 px-2 py-1.5 rounded transition-colors cursor-pointer group"
                                        onClick={(e) => handleEdit(bucket, e)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-200 group-hover:text-blue-400 flex items-center gap-1.5">
                                                🎯 {bucket.name}
                                            </span>
                                            {bucket.bucket_role !== 'none' && (
                                                <span className="text-[9px] uppercase font-bold text-slate-500 ml-5">{bucket.bucket_role}</span>
                                            )}
                                        </div>
                                        <span className="text-sm font-bold text-blue-200">
                                            {formatCurrency(bucket.current_balance ?? bucket.opening_balance)}
                                        </span>
                                    </div>
                                ))}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFormData({ 
                                            name: '', 
                                            account_type: 'bucket', 
                                            opening_balance: 0, 
                                            parent_id: account.id, 
                                            bucket_role: 'none', 
                                            notes: '' 
                                        });
                                        setShowForm(true);
                                    }}
                                    className="w-full mt-2 py-2 border border-dashed border-slate-600 rounded text-xs text-slate-400 hover:text-blue-400 hover:border-blue-400 transition-all font-medium"
                                >
                                    + Add New Bucket
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                {!hasBuckets && (
                   <div className="pb-4 px-6 mt-auto">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setFormData({ 
                                    name: '', 
                                    account_type: 'bucket', 
                                    opening_balance: 0, 
                                    parent_id: account.id, 
                                    bucket_role: 'none', 
                                    notes: '' 
                                });
                                setShowForm(true);
                            }}
                            className="text-[11px] text-slate-500 hover:text-blue-400 font-medium transition-colors"
                        >
                            + Setup Buckets
                        </button>
                   </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Accounts</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage physical accounts and their virtual buckets.</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ name: '', account_type: 'bank', opening_balance: 0, parent_id: undefined, bucket_role: 'none', notes: '' });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Account
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading accounts...</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {physicalAccounts.map(renderAccountCard)}
            </div>

            {independentBuckets.length > 0 && (
                <div className="mt-12">
                    <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                        🎯 Independent Buckets
                        <span className="text-xs font-normal text-slate-500">(Not linked to any bank)</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {independentBuckets.map((bucket) => (
                            <div
                                key={bucket.id}
                                className={`${darkTheme.card} p-4 cursor-pointer hover:border-blue-500 transition-all`}
                                onClick={() => handleEdit(bucket)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-100 italic">🎯 {bucket.name}</h3>
                                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 uppercase font-bold">
                                        {bucket.bucket_role}
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-blue-400">
                                    {formatCurrency(bucket.current_balance ?? bucket.opening_balance)}
                                </p>
                                {bucket.notes && <p className="text-xs text-slate-500 mt-2 truncate">{bucket.notes}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                    placeholder={formData.account_type === 'bucket' ? "e.g., Emergency Fund" : "e.g., HDFC Savings"}
                                />
                            </div>

                            <div>
                                <label className={darkTheme.label}>Account Type *</label>
                                <select
                                    required
                                    value={formData.account_type}
                                    onChange={(e) => setFormData({ 
                                        ...formData, 
                                        account_type: e.target.value, 
                                        bucket_role: e.target.value === 'bucket' ? formData.bucket_role : 'none',
                                        parent_id: e.target.value === 'bucket' ? formData.parent_id : undefined 
                                    })}
                                    className={darkTheme.select}
                                >
                                    <option value="bank">Bank</option>
                                    <option value="cash">Cash</option>
                                    <option value="investment">Investment</option>
                                    <option value="bucket">Bucket</option>
                                </select>
                            </div>

                            {formData.account_type === 'bucket' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={darkTheme.label}>Parent Account</label>
                                        <select
                                            value={formData.parent_id || ''}
                                            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                            className={darkTheme.select}
                                        >
                                            <option value="">No Parent</option>
                                            {physicalAccounts.filter(a => a.id !== formData.id).map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={darkTheme.label}>Bucket Role</label>
                                        <select
                                            value={formData.bucket_role}
                                            onChange={(e) => setFormData({ ...formData, bucket_role: e.target.value as any })}
                                            className={darkTheme.select}
                                        >
                                            <option value="none">Generic</option>
                                            <option value="emergency">Emergency</option>
                                            <option value="asset">Asset</option>
                                            <option value="travel">Travel</option>
                                        </select>
                                    </div>
                                </div>
                            )}

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
                                    <div /> 
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
