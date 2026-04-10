import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import type { Client, Project } from '../types';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface MonthlySummary {
    month: string;
    income: number;
    expense: number;
    investment: number;
    net: number;
}

interface CategorySummary {
    category_name: string;
    total: number;
    count: number;
}



interface OverallStats {
    total_income: number;
    total_expense: number;
    total_invested: number;
    net_balance: number;
    transaction_count: number;
}

interface ProjectDetail {
    project_id: number;
    project_name: string;
    expected: number;
    actual: number;
    outstanding_balance: number;
}

interface ProjectIncomeSummary {
    month: string;
    actual_income: number;
    expected_income: number;
    projects: ProjectDetail[];
}

interface ReportFilters {
    start_date: string;
    end_date: string;
    client_id?: number;
    project_id?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Reports() {
    const { execute, loading } = useDatabase();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Data State
    const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<CategorySummary[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<CategorySummary[]>([]);
    const [investmentCategories, setInvestmentCategories] = useState<CategorySummary[]>([]);
    const [categoryPieType, setCategoryPieType] = useState<'income' | 'expense' | 'investment'>('expense');

    const [projectIncomeReport, setProjectIncomeReport] = useState<ProjectIncomeSummary[]>([]);
    const [overallStats, setOverallStats] = useState<OverallStats | null>(null);

    // Metadata for Filters
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Filter State
    const [filters, setFilters] = useState<ReportFilters>({
        start_date: `${selectedYear}-01-01`,
        end_date: `${selectedYear}-12-31`,
        client_id: undefined,
        project_id: undefined,
    });

    useEffect(() => {
        loadMetadata();
    }, []);

    useEffect(() => {
        loadReports();
    }, [selectedYear, filters]);

    const loadMetadata = async () => {
        try {
            const [c, p] = await Promise.all([
                execute<Client[]>('get_clients'),
                execute<Project[]>('get_projects')
            ]);
            setClients(c);
            setProjects(p);
        } catch (error) {
            console.error('Failed to load metadata:', error);
        }
    };

    const loadReports = async () => {
        try {
            const backendFilters = {
                start_date: filters.start_date || undefined,
                end_date: filters.end_date || undefined,
                client_id: filters.client_id || null,
                project_id: filters.project_id || null,
            };

            const [monthly, incCat, expCat, invCat, projectInc, stats] = await Promise.all([
                execute<MonthlySummary[]>('get_monthly_summary', { year: selectedYear, filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'income', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'expense', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'investment', filters: backendFilters }),
                execute<ProjectIncomeSummary[]>('get_project_income_report', { year: selectedYear }),
                execute<OverallStats>('get_overall_stats', { filters: backendFilters }),
            ]);

            setMonthlySummary(monthly);
            setIncomeCategories(incCat);
            setExpenseCategories(expCat);
            setInvestmentCategories(invCat);
            setProjectIncomeReport(projectInc);
            setOverallStats(stats);
        } catch (error) {
            console.error('Failed to load reports:', error);
        }
    };

    const handleClearFilters = () => {
        const year = new Date().getFullYear();
        setSelectedYear(year);
        setFilters({
            start_date: `${year}-01-01`,
            end_date: `${year}-12-31`,
            client_id: undefined,
            project_id: undefined,
        });
    };

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className={darkTheme.title}>Reports & Analytics</h1>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold uppercase">Date:</span>
                        <input
                            type="date"
                            className="bg-slate-900 text-xs text-slate-200 border-none rounded p-1"
                            value={filters.start_date}
                            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                        />
                        <span className="text-slate-500">—</span>
                        <input
                            type="date"
                            className="bg-slate-900 text-xs text-slate-200 border-none rounded p-1"
                            value={filters.end_date}
                            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold uppercase">Client:</span>
                        <select
                            className="bg-slate-900 text-xs text-slate-200 border-none rounded p-1 min-w-[120px]"
                            value={filters.client_id || ''}
                            onChange={(e) => setFilters({ ...filters, client_id: e.target.value ? parseInt(e.target.value) : undefined })}
                        >
                            <option value="">All Clients</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold uppercase">Project:</span>
                        <select
                            className="bg-slate-900 text-xs text-slate-200 border-none rounded p-1 min-w-[120px]"
                            value={filters.project_id || ''}
                            onChange={(e) => setFilters({ ...filters, project_id: e.target.value ? parseInt(e.target.value) : undefined })}
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleClearFilters}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase bg-blue-400/10 px-2 py-1 rounded"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {loading && <div className={darkTheme.loading}>Updating reports...</div>}

            {/* Overall Stats */}
            {overallStats && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    <div className={darkTheme.card + " p-6"}>
                        <div className="text-sm text-slate-400">Total Income</div>
                        <div className="text-2xl font-bold text-green-400 mt-2">
                            {formatCurrency(overallStats.total_income)}
                        </div>
                    </div>
                    <div className={darkTheme.card + " p-6"}>
                        <div className="text-sm text-slate-400">Total Expense</div>
                        <div className="text-2xl font-bold text-red-400 mt-2">
                            {formatCurrency(overallStats.total_expense)}
                        </div>
                    </div>
                    <div className={darkTheme.card + " p-6"}>
                        <div className="text-sm text-slate-400">Investments</div>
                        <div className="text-2xl font-bold text-cyan-400 mt-2">
                            {formatCurrency(overallStats.total_invested)}
                        </div>
                    </div>
                    <div className={darkTheme.card + " p-6"}>
                        <div className="text-sm text-slate-400">Net Balance</div>
                        <div className={`text-2xl font-bold mt-2 ${overallStats.net_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(overallStats.net_balance)}
                        </div>
                    </div>
                    <div className={darkTheme.card + " p-6"}>
                        <div className="text-sm text-slate-400">Transactions</div>
                        <div className="text-2xl font-bold text-blue-400 mt-2">
                            {overallStats.transaction_count}
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly Trend — single stacked bar: expense + investment + savings = income */}
            <div className={darkTheme.card + " p-6 mb-6"}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={darkTheme.subtitle}>Monthly Trend ({selectedYear})</h2>
                    <div className="flex items-center gap-4 text-xs">
                        {[
                            { color: '#4ade80', label: 'Income' },
                            { color: '#ef4444', label: 'Expenses' },
                            { color: '#06b6d4', label: 'Invested' },
                            { color: '#3b82f6', label: 'Savings' },
                        ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1.5">
                                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                                <span className="text-slate-400">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={340}>
                    <BarChart
                        data={monthlySummary.map(m => ({
                            ...m,
                            savings_display: Math.max(m.net, 0),
                        }))}
                        barSize={40}
                        margin={{ top: 32, right: 16, left: 8, bottom: 4 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                            dataKey="month"
                            stroke="#64748b"
                            fontSize={11}
                            tickFormatter={(val: string) => {
                                const [y, mo] = val.split('-');
                                return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('default', { month: 'short' });
                            }}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={11}
                            tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const m = payload[0].payload as MonthlySummary & { savings_display: number };
                                const [y, mo] = m.month.split('-');
                                const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                                const savingsLabel = m.net >= 0 ? 'Savings' : 'Deficit';
                                const savingsColor = m.net >= 0 ? '#3b82f6' : '#f43f5e';
                                return (
                                    <div style={{
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: 12,
                                        padding: '12px 16px',
                                        fontSize: 13,
                                        minWidth: 200,
                                    }}>
                                        {/* Month label */}
                                        <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: 10, fontSize: 12, letterSpacing: '0.05em' }}>
                                            {label}
                                        </div>
                                        {/* Income row — top, prominent */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80' }} />
                                                <span style={{ color: '#94a3b8' }}>Income</span>
                                            </div>
                                            <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 15 }}>
                                                {formatCurrency(m.income)}
                                            </span>
                                        </div>
                                        {/* Divider */}
                                        <div style={{ borderTop: '1px solid #1e293b', marginBottom: 10 }} />
                                        {/* Breakdown rows */}
                                        {[
                                            { color: '#ef4444', label: 'Expenses',       value: m.expense },
                                            { color: '#06b6d4', label: 'Invested',        value: m.investment },
                                            { color: savingsColor, label: savingsLabel,   value: m.net },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: 2, background: row.color }} />
                                                    <span style={{ color: '#64748b' }}>{row.label}</span>
                                                </div>
                                                <span style={{ color: row.color, fontWeight: 600 }}>
                                                    {row.value < -0.005 ? '−' : ''}{formatCurrency(Math.abs(row.value))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        />
                        {/* Bottom: Expenses */}
                        <Bar dataKey="expense" stackId="a" fill="#ef4444" name="Expenses" radius={[0,0,0,0]} />
                        {/* Middle: Investments */}
                        <Bar dataKey="investment" stackId="a" fill="#06b6d4" name="Invested" radius={[0,0,0,0]} />
                        {/* Top: Savings — carries the income label */}
                        <Bar
                            dataKey="savings_display"
                            stackId="a"
                            fill="#3b82f6"
                            name="Savings"
                            radius={[6,6,0,0]}
                            label={(props: any) => {
                                const { x, y, width, index } = props;
                                const income = monthlySummary[index]?.income ?? 0;
                                if (!income) return <g />;
                                return (
                                    <text
                                        x={x + width / 2}
                                        y={y - 8}
                                        textAnchor="middle"
                                        fill="#4ade80"
                                        fontSize={11}
                                        fontWeight={700}
                                    >
                                        {`₹${(income / 1000).toFixed(1)}k`}
                                    </text>
                                );
                            }}
                        />
                    </BarChart>
                </ResponsiveContainer>
                {monthlySummary.some(m => m.net < 0) && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-400/80">
                        <span>⚠</span>
                        <span>Months with a deficit show no savings segment — you spent more than you earned.</span>
                    </div>
                )}
            </div>

            {/* Monthly Breakdown */}
            <div className={darkTheme.card + " p-6 mb-6"}>
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
                            {monthlySummary.map(m => {
                                const mIncome = m.income || 0;
                                const rate = mIncome > 0 ? (m.net / mIncome) * 100 : 0;
                                return (
                                <tr key={m.month} className="border-b border-slate-800 hover:bg-slate-800/50">
                                    <td className="py-2 px-3 text-slate-300">{new Date(m.month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                                    <td className="text-right py-2 px-3 text-green-400">{formatCurrency(m.income)}</td>
                                    <td className="text-right py-2 px-3 text-red-400">{formatCurrency(m.expense)}</td>
                                    <td className="text-right py-2 px-3 text-cyan-400">{formatCurrency(m.investment)}</td>
                                    <td className={`text-right py-2 px-3 ${m.net >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{formatCurrency(m.net)}</td>
                                    <td className={`text-right py-2 px-3 ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{rate.toFixed(1)}%</td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Category Breakdown with Selector */}
            <div className={darkTheme.card + " p-6 mb-6"}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className={darkTheme.subtitle}>Category Breakdown</h2>
                    <select
                        value={categoryPieType}
                        onChange={(e) => setCategoryPieType(e.target.value as any)}
                        className="bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded px-3 py-1.5"
                    >
                        <option value="income">💵 Income</option>
                        <option value="expense">💸 Expense</option>
                        <option value="investment">📈 Investment</option>
                    </select>
                </div>
                {(() => {
                    const data = categoryPieType === 'income' ? incomeCategories
                        : categoryPieType === 'expense' ? expenseCategories
                            : investmentCategories;
                    const colors = categoryPieType === 'investment'
                        ? ['#06b6d4', '#22d3ee', '#0891b2', '#0e7490', '#155e75']
                        : COLORS;
                    const titleColor = categoryPieType === 'income' ? 'text-green-400'
                        : categoryPieType === 'expense' ? 'text-red-400'
                            : 'text-cyan-400';
                    const emptyMessage = categoryPieType === 'investment'
                        ? 'No investment categories. Mark categories as investments in Categories screen.'
                        : `No ${categoryPieType} transactions for selected period.`;

                    return data.length > 0 ? (
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height={450}>
                                    <PieChart>
                                        <Pie
                                            data={data}
                                            dataKey="total"
                                            nameKey="category_name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={160}
                                        >
                                            {data.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                            formatter={(value: number) => formatCurrency(value)}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="lg:w-64 space-y-2">
                                <div className={`text-sm font-bold uppercase ${titleColor} mb-3`}>
                                    {categoryPieType.charAt(0).toUpperCase() + categoryPieType.slice(1)} Categories
                                </div>
                                {data.map((cat, index) => (
                                    <div key={cat.category_name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-sm"
                                                style={{ backgroundColor: colors[index % colors.length] }}
                                            />
                                            <span className="text-slate-300 truncate max-w-[120px]">{cat.category_name}</span>
                                        </div>
                                        <span className="text-slate-400 font-mono">{formatCurrency(cat.total)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-slate-700 pt-2 mt-3 flex justify-between text-sm font-bold">
                                    <span className="text-slate-400">Total</span>
                                    <span className={titleColor}>{formatCurrency(data.reduce((sum, c) => sum + c.total, 0))}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={darkTheme.empty}>{emptyMessage}</div>
                    );
                })()}
            </div>

            {/* Project Income Performance */}
            {projectIncomeReport.length > 0 && (
                <div className={darkTheme.card + " p-6 mb-6"}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className={darkTheme.subtitle}>Project Income Performance</h2>
                        <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-green-500 rounded-sm"></span>
                                <span className="text-slate-400">Actual (Achieved)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-orange-500 rounded-sm"></span>
                                <span className="text-slate-400">Target Gap</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-emerald-400 rounded-sm"></span>
                                <span className="text-slate-400">Surplus</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={projectIncomeReport.map(m => ({
                                    ...m,
                                    achieved: Math.min(m.actual_income, m.expected_income),
                                    gap: Math.max(0, m.expected_income - m.actual_income),
                                    surplus: Math.max(0, m.actual_income - m.expected_income)
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#64748b"
                                        fontSize={11}
                                        tickFormatter={(val) => {
                                            const [y, m] = val.split('-');
                                            const date = new Date(parseInt(y), parseInt(m) - 1);
                                            return date.toLocaleString('default', { month: 'short' });
                                        }}
                                    />
                                    <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => formatCurrency(val)} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                                        formatter={(value: number, name: string) => {
                                            if (name === 'achieved') return [formatCurrency(value), 'Achieved'];
                                            if (name === 'gap')      return [formatCurrency(value), 'Gap'];
                                            if (name === 'surplus')  return [formatCurrency(value), 'Surplus'];
                                            return [formatCurrency(value), name];
                                        }}
                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="achieved" stackId="p" fill="#22c55e" radius={[0, 0, 0, 0]} name="achieved" barSize={32} />
                                    <Bar dataKey="gap"      stackId="p" fill="#f97316" radius={[4, 4, 0, 0]} name="gap"      barSize={32} />
                                    <Bar dataKey="surplus"  stackId="p" fill="#34d399" radius={[4, 4, 0, 0]} name="surplus"  barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 overflow-hidden">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Month / Project</th>
                                        <th className="px-4 py-3 text-right">Target</th>
                                        <th className="px-4 py-3 text-right">Actual</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {projectIncomeReport.map((monthData) => (
                                        <React.Fragment key={monthData.month}>
                                            <tr className="bg-slate-800/20 border-l-2 border-green-500">
                                                <td className="px-4 py-3 font-bold text-slate-100 italic">
                                                    {new Date(monthData.month + '-01').toLocaleString('default', { month: 'long' })}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400 font-bold">
                                                    {formatCurrency(monthData.expected_income)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-green-400 font-bold">
                                                    {formatCurrency(monthData.actual_income)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500 text-[10px] uppercase">
                                                    Month Total
                                                </td>
                                            </tr>
                                            {monthData.projects.map((project) => {
                                                return (
                                                    <tr key={`${monthData.month}-${project.project_id}`} className="hover:bg-blue-500/5 transition-colors text-[11px]">
                                                        <td className="px-8 py-2 text-slate-400 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                                            {project.project_name}
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-slate-500">
                                                            {project.expected > 0 ? formatCurrency(project.expected) : '-'}
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-slate-300">
                                                            {project.actual > 0 ? formatCurrency(project.actual) : '-'}
                                                        </td>
                                                        <td className={`px-4 py-2 text-right font-mono ${project.outstanding_balance > 0 ? 'text-orange-400/80' : 'text-slate-600'}`}>
                                                            {project.outstanding_balance > 0 ? `Pending: ${formatCurrency(project.outstanding_balance)}` : 'Settled'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4"}>Top Income Sources</h2>
                    <div className="space-y-2">
                        {incomeCategories.length > 0 ? incomeCategories.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors">
                                <span className="text-slate-200">{cat.category_name}</span>
                                <span className="text-green-400 font-bold">{formatCurrency(cat.total)}</span>
                            </div>
                        )) : <div className="text-slate-500 text-sm italic">No data</div>}
                    </div>
                </div>

                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4"}>Top Expense Items</h2>
                    <div className="space-y-2">
                        {expenseCategories.length > 0 ? expenseCategories.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors">
                                <span className="text-slate-200">{cat.category_name}</span>
                                <span className="text-red-400 font-bold">{formatCurrency(cat.total)}</span>
                            </div>
                        )) : <div className="text-slate-500 text-sm italic">No data</div>}
                    </div>
                </div>
            </div>

            {/* Simple Summary */}
            <div className={darkTheme.card + " p-6 mt-6 bg-blue-500/5 border-blue-500/20"}>
                <h2 className={darkTheme.subtitle + " mb-4 text-blue-400"}>Report Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-400 mb-1">Period</div>
                        <div className="text-slate-100 font-bold">{filters.start_date} to {filters.end_date}</div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-400 mb-1">Savings Rate</div>
                        <div className={`font-bold ${overallStats?.net_balance && overallStats.total_income > 0 ? (overallStats.net_balance / overallStats.total_income * 100 > 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-400'}`}>
                            {overallStats && overallStats.total_income > 0 ? ((overallStats.net_balance / overallStats.total_income) * 100).toFixed(1) + '%' : '0%'}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-400 mb-1">Investment Rate</div>
                        <div className="text-cyan-400 font-bold">
                            {overallStats && overallStats.total_income > 0
                                ? ((overallStats.total_invested / overallStats.total_income) * 100).toFixed(1) + '%'
                                : '0%'}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-lg">
                        <div className="text-slate-400 mb-1">Avg Daily Spend</div>
                        <div className="text-red-400 font-bold">
                            {overallStats ? formatCurrency(overallStats.total_expense / 30) : '₹0'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
