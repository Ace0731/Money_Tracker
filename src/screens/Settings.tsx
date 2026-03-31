import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Category, Account, Goal, AllocationSettings, AllocationRule } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Settings() {
    const { execute, loading } = useDatabase();
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [rules, setRules] = useState<AllocationRule[]>([]);
    const [settings, setSettings] = useState<AllocationSettings>({
        emergency_target: 100000,
        trigger_category_id: undefined,
        is_enabled: true
    });

    const [showGoalForm, setShowGoalForm] = useState(false);
    const [goalForm, setGoalForm] = useState<Partial<Goal>>({
        name: '',
        target_amount: 0,
        current_amount: 0,
        bucket_id: undefined,
        status: 'active'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [categoriesData, accountsData, goalsData, settingsData, rulesData] = await Promise.all([
                execute<Category[]>('get_categories'),
                execute<Account[]>('get_accounts'),
                execute<Goal[]>('get_goals'),
                execute<AllocationSettings>('get_allocation_settings'),
                execute<AllocationRule[]>('get_allocation_rules')
            ]);
            setCategories(categoriesData.filter(c => c.kind === 'income'));
            setAccounts(accountsData.filter(a => a.account_type === 'bucket'));
            setGoals(goalsData || []);
            setRules(rulesData || []);
            if (settingsData) setSettings(settingsData);
        } catch (error) {
            console.error('Failed to load settings data:', error);
        }
    };

    const handleSaveSettings = async () => {
        try {
            await execute('update_allocation_settings', { settings });
            Swal.fire({ title: 'Settings Saved', icon: 'success', background: '#0f172a', color: '#f1f5f9', timer: 1500, showConfirmButton: false });
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    const handleUpdateRule = async (rule: AllocationRule) => {
        const total = rule.emergency_pc + rule.asset_pc + rule.travel_pc;
        if (Math.abs(total - 1) > 0.001) {
            Swal.fire({
                title: 'Invalid Percentage',
                text: `Total must be 100%. Current sum: ${Math.round(total * 100)}%`,
                icon: 'error',
                background: '#0f172a',
                color: '#f1f5f9'
            });
            return;
        }

        try {
            await execute('update_allocation_rule', { rule });
            Swal.fire({ title: 'Rule Updated', icon: 'success', background: '#0f172a', color: '#f1f5f9', timer: 1000, showConfirmButton: false });
            loadData();
        } catch (error) {
            console.error('Failed to update rule:', error);
        }
    };

    const handleRuleChange = (index: number, field: string, value: string) => {
        const newRules = [...rules];
        const numValue = parseFloat(value) / 100;
        newRules[index] = { ...newRules[index], [field]: isNaN(numValue) ? 0 : numValue };
        setRules(newRules);
    };

    const handleCreateGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await execute('create_goal', { goal: goalForm });
            setShowGoalForm(false);
            setGoalForm({ name: '', target_amount: 0, current_amount: 0, bucket_id: undefined, status: 'active' });
            loadData();
            Swal.fire({ title: 'Goal Created!', icon: 'success', background: '#0f172a', color: '#f1f5f9', timer: 1500, showConfirmButton: false });
        } catch (error) {
            console.error('Failed to create goal:', error);
        }
    };

    const handleDeleteGoal = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete Goal?',
            text: 'This will remove the goal tracking.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: '#0f172a',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_goal', { id });
                loadData();
            } catch (error) {
                console.error('Failed to delete goal:', error);
            }
        }
    };

    const getTierTitle = (tier: number) => {
        switch (tier) {
            case 1: return 'Tier 1: Emergency Fund < 50%';
            case 2: return 'Tier 2: Emergency Fund 50% - 100%';
            case 3: return 'Tier 3: Emergency Fund Completed (> 100%)';
            default: return `Tier ${tier}`;
        }
    };

    if (loading && categories.length === 0) {
        return <div className={darkTheme.loading}>Loading settings...</div>;
    }


    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className={darkTheme.title}>Settings</h1>

            {/* Allocation Settings */}
            <div className={`${darkTheme.card} p-6 mb-8`}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Automated Income Allocation</h2>
                        <p className="text-sm text-slate-400 mt-1">Configure your personalized distribution rules</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Automation</span>
                        <button 
                            onClick={() => setSettings({ ...settings, is_enabled: !settings.is_enabled })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.is_enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.is_enabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className={darkTheme.label}>Emergency Fund Target (₹)</label>
                        <input 
                            type="number"
                            value={settings.emergency_target}
                            onChange={(e) => setSettings({ ...settings, emergency_target: parseInt(e.target.value) })}
                            className={darkTheme.input}
                        />
                    </div>
                    <div>
                        <label className={darkTheme.label}>Trigger Category (e.g. Freelance Income)</label>
                        <select 
                            value={settings.trigger_category_id || ''}
                            onChange={(e) => setSettings({ ...settings, trigger_category_id: e.target.value ? parseInt(e.target.value) : undefined })}
                            className={darkTheme.select}
                        >
                            <option value="">Select Category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Allocation Percentages by Tier</h3>
                    <div className="space-y-4">
                        {rules.map((rule, idx) => (
                            <div key={rule.id} className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">{getTierTitle(rule.tier)}</span>
                                    <button 
                                        onClick={() => handleUpdateRule(rule)}
                                        className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-1 rounded border border-blue-500/20 hover:bg-blue-600/30 font-bold"
                                    >
                                        Save Rule
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Emergency (%)</label>
                                        <input 
                                            type="number"
                                            value={Math.round(rule.emergency_pc * 100)}
                                            onChange={(e) => handleRuleChange(idx, 'emergency_pc', e.target.value)}
                                            className={`${darkTheme.input} !py-1 text-center`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Asset (%)</label>
                                        <input 
                                            type="number"
                                            value={Math.round(rule.asset_pc * 100)}
                                            onChange={(e) => handleRuleChange(idx, 'asset_pc', e.target.value)}
                                            className={`${darkTheme.input} !py-1 text-center`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold">Travel (%)</label>
                                        <input 
                                            type="number"
                                            value={Math.round(rule.travel_pc * 100)}
                                            onChange={(e) => handleRuleChange(idx, 'travel_pc', e.target.value)}
                                            className={`${darkTheme.input} !py-1 text-center`}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={handleSaveSettings} className={darkTheme.btnPrimary}>
                        Save General Config
                    </button>
                </div>
            </div>


            {/* Goal Management */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-100">Financial Goals</h2>
                <button 
                    onClick={() => setShowGoalForm(true)}
                    className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-bold hover:bg-blue-600/30 transition-colors"
                >
                    + Add Goal
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {goals.map(goal => (
                    <div key={goal.id} className={`${darkTheme.card} p-4 flex items-center justify-between group`}>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-slate-100">{goal.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${goal.status === 'active' ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-slate-500/30 text-slate-400 bg-slate-500/10'} uppercase font-bold`}>
                                    {goal.status}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex gap-4">
                                <span>Bucket: <b className="text-slate-300">{accounts.find(a => a.id === goal.bucket_id)?.name}</b></span>
                                <span>Progress: <b className="text-blue-400">{formatCurrency(goal.current_amount)}</b> / {formatCurrency(goal.target_amount)}</span>
                            </div>
                            <div className="w-full bg-slate-700 h-1 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500" 
                                    style={{ width: `${Math.min(100, (goal.current_amount / goal.target_amount) * 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                            <button 
                                onClick={() => handleDeleteGoal(goal.id!)}
                                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                title="Delete Goal"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
                {goals.length === 0 && (
                    <div className="p-8 text-center bg-slate-800/30 rounded-xl border border-dashed border-slate-700 text-slate-500 italic">
                        No goals created. Link your buckets to specific financial objectives!
                    </div>
                )}
            </div>

            {/* Goal Form Modal */}
            {showGoalForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>Create Financial Goal</h2>
                        <form onSubmit={handleCreateGoal} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Goal Name *</label>
                                <input 
                                    type="text"
                                    required
                                    value={goalForm.name}
                                    onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                                    className={darkTheme.input}
                                    placeholder="e.g., Buy iPhone 16"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Target Amount (₹) *</label>
                                    <input 
                                        type="number"
                                        required
                                        value={goalForm.target_amount}
                                        onChange={(e) => setGoalForm({ ...goalForm, target_amount: parseFloat(e.target.value) })}
                                        className={darkTheme.input}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Bucket *</label>
                                    <select 
                                        required
                                        value={goalForm.bucket_id || ''}
                                        onChange={(e) => setGoalForm({ ...goalForm, bucket_id: parseInt(e.target.value) })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">Select Bucket</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowGoalForm(false)} className={darkTheme.btnCancel}>
                                    Cancel
                                </button>
                                <button type="submit" className={darkTheme.btnPrimary}>
                                    Create Goal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
