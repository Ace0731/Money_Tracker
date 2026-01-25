import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import type { Category, BudgetSummary, BudgetSettings, Budget, MonthlyBudgetReport, InvestmentRate } from '../types';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Swal from 'sweetalert2';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

export default function BudgetScreen() {
    const { execute, loading } = useDatabase();
    const [summary, setSummary] = useState<BudgetSummary | null>(null);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [settings, setSettings] = useState<BudgetSettings>({ salary_date: 1 });
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [yearlyReport, setYearlyReport] = useState<MonthlyBudgetReport[]>([]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [budgetForm, setBudgetForm] = useState<Budget>({ month: '', category_id: 0, budgeted_amount: 0 });
    const [investmentRates, setInvestmentRates] = useState<InvestmentRate[]>([]);
    const [rateForm, setRateForm] = useState<InvestmentRate>({ investment_type: 'nps', rate: 10, effective_date: new Date().toISOString().split('T')[0] });
    const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'rates'>('overview');
    const [budgetType, setBudgetType] = useState<'income' | 'expense' | 'transfer'>('expense');
    const [pieChartType, setPieChartType] = useState<'expense' | 'income' | 'investment'>('expense');

    useEffect(() => {
        loadData();
    }, [selectedMonth]);

    const loadData = async () => {
        try {
            const [sumData, catData, settingsData, yearData, ratesData] = await Promise.all([
                execute<BudgetSummary>('get_budget_summary', { month: selectedMonth }),
                execute<Category[]>('get_categories'),
                execute<BudgetSettings>('get_budget_settings'),
                execute<MonthlyBudgetReport[]>('get_budget_report', { year: parseInt(selectedMonth.slice(0, 4)) }),
                execute<InvestmentRate[]>('get_investment_rates'),
            ]);
            setSummary(sumData);
            setAllCategories(catData);
            setSettings(settingsData);
            setYearlyReport(yearData);
            setInvestmentRates(ratesData);
        } catch (error) {
            console.error('Failed to load budget data:', error);
        }
    };

    const handleSetBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await execute('set_budget', { budget: { ...budgetForm, month: selectedMonth } });
            setShowBudgetModal(false);
            loadData();
            Swal.fire({ title: 'Budget Set!', icon: 'success', background: '#0f172a', color: '#f1f5f9', timer: 1500, showConfirmButton: false });
        } catch (error) {
            console.error('Failed to set budget:', error);
        }
    };

    const handleUpdateSettings = async () => {
        try {
            await execute('update_budget_settings', { settings });
            setShowSettingsModal(false);
            loadData();
        } catch (error) {
            console.error('Failed to update settings:', error);
        }
    };

    const handleAddRate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await execute('add_investment_rate', { rate: rateForm });
            setRateForm({ investment_type: 'nps', rate: 10, effective_date: new Date().toISOString().split('T')[0] });
            loadData();
            Swal.fire({ title: 'Rate Added!', icon: 'success', background: '#0f172a', color: '#f1f5f9', timer: 1500, showConfirmButton: false });
        } catch (error) {
            console.error('Failed to add rate:', error);
        }
    };

    const handleDeleteRate = async (id: number) => {
        try {
            await execute('delete_investment_rate', { id });
            loadData();
        } catch (error) {
            console.error('Failed to delete rate:', error);
        }
    };

    const openBudgetModal = (categoryId: number, kind: 'income' | 'expense' | 'transfer', currentBudget: number = 0) => {
        setBudgetType(kind);
        setBudgetForm({ month: selectedMonth, category_id: categoryId, budgeted_amount: currentBudget });
        setShowBudgetModal(true);
    };

    const monthOptions = () => {
        const months = [];
        const now = new Date();
        for (let i = -6; i <= 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            months.push(d.toISOString().slice(0, 7));
        }
        return months;
    };

    const getMonthLabel = (m: string) => {
        const [year, month] = m.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    // Dynamic pie data based on selection
    const getPieData = () => {
        if (!summary) return [];
        if (pieChartType === 'expense') {
            return summary.expense_categories.filter(c => c.actual > 0).map(c => ({ name: c.category_name, value: c.actual }));
        } else if (pieChartType === 'income') {
            return summary.income_categories.filter(c => c.actual > 0).map(c => ({ name: c.category_name, value: c.actual }));
        } else {
            return summary.investment_categories.filter(c => c.actual > 0).map(c => ({ name: c.category_name, value: c.actual }));
        }
    };
    const pieData = getPieData();

    // Calculate totals for income section
    const totalExpectedIncome = summary?.income_categories.reduce((sum, c) => sum + c.budgeted, 0) || 0;
    const totalActualIncome = summary?.actual_income || 0;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>💰 Budget</h1>
                <div className="flex gap-2 items-center">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className={darkTheme.select + " w-40"}
                    >
                        {monthOptions().map(m => (
                            <option key={m} value={m}>{getMonthLabel(m)}</option>
                        ))}
                    </select>
                    <button onClick={() => setShowSettingsModal(true)} className={darkTheme.btnSecondary}>⚙️</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {(['overview', 'reports', 'rates'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {tab === 'overview' ? '📊 Overview' : tab === 'reports' ? '📈 Reports' : '💹 NPS/PPF Rates'}
                    </button>
                ))}
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            {activeTab === 'overview' && summary && (
                <div className="space-y-6">
                    {/* ========== INCOME SECTION ========== */}
                    <section className={darkTheme.card + " p-4"}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                                <span>💵</span> Income
                            </h2>
                            <div className="text-right">
                                <div className="text-xs text-slate-500">Expected vs Actual</div>
                                <div className="text-sm">
                                    <span className="text-slate-400">{formatCurrency(totalExpectedIncome)}</span>
                                    <span className="text-slate-600 mx-1">/</span>
                                    <span className="text-green-400 font-bold">{formatCurrency(totalActualIncome)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {summary.income_categories.map(cat => (
                                <div
                                    key={cat.category_id}
                                    className="bg-slate-900/50 rounded-lg p-3 cursor-pointer hover:bg-slate-800/50 transition-colors border border-slate-700/50"
                                    onClick={() => openBudgetModal(cat.category_id, 'income', cat.budgeted)}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-300">{cat.category_name}</span>
                                        <span className="text-xs text-slate-500">✏️</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Expected: {formatCurrency(cat.budgeted)}</span>
                                        <span className="text-green-400 font-medium">Actual: {formatCurrency(cat.actual)}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${Math.min((cat.actual / (cat.budgeted || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {summary.income_categories.length === 0 && (
                                <div className="text-slate-500 text-sm italic col-span-3">No income categories found. Add categories in the Categories screen.</div>
                            )}
                        </div>
                    </section>

                    {/* ========== EXPENSE SECTION ========== */}
                    <section className={darkTheme.card + " p-4"}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                <span>💸</span> Expenses
                            </h2>
                            <div className="text-right">
                                <div className="text-xs text-slate-500">Budgeted vs Spent</div>
                                <div className="text-sm">
                                    <span className="text-slate-400">{formatCurrency(summary.total_budgeted)}</span>
                                    <span className="text-slate-600 mx-1">/</span>
                                    <span className="text-red-400 font-bold">{formatCurrency(summary.total_spent)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                            {summary.expense_categories.map(cat => (
                                <div
                                    key={cat.category_id}
                                    className="bg-slate-900/50 rounded-lg p-3 cursor-pointer hover:bg-slate-800/50 transition-colors border border-slate-700/50"
                                    onClick={() => openBudgetModal(cat.category_id, 'expense', cat.budgeted)}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-300">{cat.category_name}</span>
                                        <span className={`text-xs font-medium ${cat.is_over_budget ? 'text-red-400' : 'text-green-400'}`}>
                                            {cat.budgeted > 0 ? (cat.is_over_budget ? '⚠️ Over!' : '✓') : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Budget: {formatCurrency(cat.budgeted)}</span>
                                        <span className={cat.is_over_budget ? 'text-red-400' : 'text-slate-300'}>Spent: {formatCurrency(cat.actual)}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className={`h-full ${cat.is_over_budget ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min((cat.actual / (cat.budgeted || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                    {cat.budgeted > 0 && (
                                        <div className="text-xs text-slate-500 mt-1">
                                            {cat.remaining >= 0 ? `${formatCurrency(cat.remaining)} left` : `${formatCurrency(-cat.remaining)} over`}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ========== INVESTMENTS SECTION ========== */}
                    <section className={darkTheme.card + " p-4"}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                <span>📈</span> Investments
                            </h2>
                            <div className="text-right">
                                <div className="text-xs text-slate-500">Expected vs Actual</div>
                                <div className="text-sm">
                                    <span className="text-slate-400">{formatCurrency(summary.investment_categories.reduce((sum, c) => sum + c.budgeted, 0))}</span>
                                    <span className="text-slate-600 mx-1">/</span>
                                    <span className="text-amber-400 font-bold">{formatCurrency(summary.total_invested)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {summary.investment_categories.map(cat => (
                                <div
                                    key={cat.category_id}
                                    className="bg-slate-900/50 rounded-lg p-3 cursor-pointer hover:bg-slate-800/50 transition-colors border border-slate-700/50"
                                    onClick={() => openBudgetModal(cat.category_id, 'transfer', cat.budgeted)}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-300">{cat.category_name}</span>
                                        <span className="text-xs text-slate-500">✏️</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Expected: {formatCurrency(cat.budgeted)}</span>
                                        <span className="text-amber-400 font-medium">Actual: {formatCurrency(cat.actual)}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500"
                                            style={{ width: `${Math.min((cat.actual / (cat.budgeted || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {summary.investment_categories.length === 0 && (
                                <div className="text-slate-500 text-sm italic col-span-3">No investment categories found.</div>
                            )}
                        </div>
                    </section>                    {/* ========== SAVINGS SECTION ========== */}
                    <section className={darkTheme.card + " p-4"}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                                <span>🏦</span> Savings
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-900/50 rounded-lg p-4 border border-green-800/30">
                                <div className="text-xs text-slate-500 uppercase">Total Income</div>
                                <div className="text-xl font-bold text-green-400">{formatCurrency(totalActualIncome)}</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-4 border border-red-800/30">
                                <div className="text-xs text-slate-500 uppercase">Total Expenses</div>
                                <div className="text-xl font-bold text-red-400">{formatCurrency(summary.total_spent)}</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-4 border border-amber-800/30">
                                <div className="text-xs text-slate-500 uppercase">Investments</div>
                                <div className="text-xl font-bold text-amber-400">{formatCurrency(summary.total_invested)}</div>
                            </div>
                            <div className="bg-slate-900/50 rounded-lg p-4 border border-blue-800/30">
                                <div className="text-xs text-slate-500 uppercase">Net Savings</div>
                                <div className={`text-xl font-bold ${summary.savings >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                    {formatCurrency(summary.savings)}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{summary.savings_rate.toFixed(1)}% savings rate</div>
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-slate-500 text-center">
                            Savings = Income - Expenses - Investments
                        </div>
                    </section>

                    {/* Pie Chart */}
                    <section className={darkTheme.card + " p-6"}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase">Category Breakdown</h3>
                            <select
                                value={pieChartType}
                                onChange={(e) => setPieChartType(e.target.value as any)}
                                className="bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded px-3 py-1"
                            >
                                <option value="expense">💸 Expenses</option>
                                <option value="income">💵 Income</option>
                                <option value="investment">📈 Investments</option>
                            </select>
                        </div>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <PieChart>
                                    <Pie data={pieData} innerRadius={80} outerRadius={150} dataKey="value" paddingAngle={2}>
                                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-slate-500 py-12">No {pieChartType} data for this period</div>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'reports' && (
                <div className="space-y-6">
                    <div className={darkTheme.card + " p-4"}>
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Monthly Trend - {selectedMonth.slice(0, 4)}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={yearlyReport}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => getMonthLabel(v).split(' ')[0]} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} formatter={(v: number) => formatCurrency(v)} />
                                <Legend />
                                <Bar dataKey="income" fill="#10b981" name="Income" />
                                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                                <Bar dataKey="investments" fill="#f59e0b" name="Investments" />
                                <Bar dataKey="savings" fill="#6366f1" name="Savings" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={darkTheme.card + " p-4"}>
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Monthly Breakdown</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2 px-3 text-slate-400">Month</th>
                                        <th className="text-right py-2 px-3 text-slate-400">Income</th>
                                        <th className="text-right py-2 px-3 text-slate-400">Expenses</th>
                                        <th className="text-right py-2 px-3 text-slate-400">Investments</th>
                                        <th className="text-right py-2 px-3 text-slate-400">Savings</th>
                                        <th className="text-right py-2 px-3 text-slate-400">Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {yearlyReport.map(r => (
                                        <tr key={r.month} className="border-b border-slate-800 hover:bg-slate-800/50">
                                            <td className="py-2 px-3 text-slate-300">{getMonthLabel(r.month)}</td>
                                            <td className="text-right py-2 px-3 text-green-400">{formatCurrency(r.income)}</td>
                                            <td className="text-right py-2 px-3 text-red-400">{formatCurrency(r.expenses)}</td>
                                            <td className="text-right py-2 px-3 text-amber-400">{formatCurrency(r.investments)}</td>
                                            <td className={`text-right py-2 px-3 ${r.savings >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatCurrency(r.savings)}</td>
                                            <td className={`text-right py-2 px-3 ${r.savings_rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{r.savings_rate.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'rates' && (
                <div className="space-y-6">
                    <div className={darkTheme.card + " p-4"}>
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Add Interest Rate</h3>
                        <form onSubmit={handleAddRate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className={darkTheme.label}>Type</label>
                                <select
                                    value={rateForm.investment_type}
                                    onChange={(e) => setRateForm({ ...rateForm, investment_type: e.target.value })}
                                    className={darkTheme.select}
                                >
                                    <option value="nps">NPS</option>
                                    <option value="ppf">PPF</option>
                                </select>
                            </div>
                            <div>
                                <label className={darkTheme.label}>Rate (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={rateForm.rate}
                                    onChange={(e) => setRateForm({ ...rateForm, rate: parseFloat(e.target.value) })}
                                    className={darkTheme.input}
                                    required
                                />
                            </div>
                            <div>
                                <label className={darkTheme.label}>Effective From</label>
                                <input
                                    type="date"
                                    value={rateForm.effective_date}
                                    onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })}
                                    className={darkTheme.input}
                                    required
                                />
                            </div>
                            <div className="flex items-end">
                                <button type="submit" className={darkTheme.btnPrimary + " w-full"}>Add Rate</button>
                            </div>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {['nps', 'ppf'].map(type => (
                            <div key={type} className={darkTheme.card + " p-4"}>
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">{type.toUpperCase()} Rate History</h3>
                                <div className="space-y-2">
                                    {investmentRates.filter(r => r.investment_type === type).map(rate => (
                                        <div key={rate.id} className="flex justify-between items-center bg-slate-900/50 rounded-lg p-3">
                                            <div>
                                                <div className="text-lg font-bold text-slate-100">{rate.rate}%</div>
                                                <div className="text-xs text-slate-500">From {rate.effective_date}</div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRate(rate.id!)}
                                                className="text-slate-400 hover:text-red-400"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                    {investmentRates.filter(r => r.investment_type === type).length === 0 && (
                                        <div className="text-center text-slate-500 py-4">No rates set</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>Budget Settings</h2>
                        <div className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Salary Day of Month</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="28"
                                    value={settings.salary_date}
                                    onChange={(e) => setSettings({ ...settings, salary_date: parseInt(e.target.value) })}
                                    className={darkTheme.input}
                                />
                                <p className="text-xs text-slate-500 mt-1">Budget period: {settings.salary_date}th to {settings.salary_date - 1 > 0 ? settings.salary_date - 1 : 28}th of next month</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleUpdateSettings} className={darkTheme.btnPrimary}>Save</button>
                            <button onClick={() => setShowSettingsModal(false)} className={darkTheme.btnSecondary}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Budget Modal */}
            {showBudgetModal && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>
                            Set {budgetType === 'income' ? 'Expected Income' : 'Budget'} for {getMonthLabel(selectedMonth)}
                        </h2>
                        <form onSubmit={handleSetBudget} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Category</label>
                                <select
                                    value={budgetForm.category_id}
                                    onChange={(e) => setBudgetForm({ ...budgetForm, category_id: parseInt(e.target.value) })}
                                    className={darkTheme.select}
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {allCategories.filter(c => c.kind === budgetType).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={darkTheme.label}>{budgetType === 'income' ? 'Expected Amount' : 'Budget Amount'}</label>
                                <input
                                    type="number"
                                    value={budgetForm.budgeted_amount}
                                    onChange={(e) => setBudgetForm({ ...budgetForm, budgeted_amount: parseFloat(e.target.value) })}
                                    className={darkTheme.input}
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className={darkTheme.btnPrimary}>Save</button>
                                <button type="button" onClick={() => setShowBudgetModal(false)} className={darkTheme.btnSecondary}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
