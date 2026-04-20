import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import type { Client, Project } from '../types';
import BenchmarkTab from '../components/investments/BenchmarkTab';
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

interface NetWorthPoint {
    month: string;
    cash: number;
    invested: number;
    total: number;
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

interface SourceCategorySummary {
    direction: string;
    source_name: string;
    category_name: string;
    total: number;
    count: number;
}

interface ReportFilters {
    start_date: string;
    end_date: string;
    client_id?: number;
    project_id?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/** Move a YYYY-MM-DD string by `delta` months, clamping to calendar boundaries. */
function shiftMonth(dateStr: string, delta: number, boundaryType: 'start' | 'end'): string {
    const [year, month] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (boundaryType === 'start') {
        return `${y}-${String(m).padStart(2, '0')}-01`;
    } else {
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
}

function getMonthLabel(dateStr: string) {
    const [year, month] = dateStr.split('-').map(Number);
    return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export default function Reports() {
    const { execute, loading } = useDatabase();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<'visuals' | 'numbers' | 'benchmark'>('visuals');

    // Data State
    const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<CategorySummary[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<CategorySummary[]>([]);
    const [investmentCategories, setInvestmentCategories] = useState<CategorySummary[]>([]);
    const [categoryPieType, setCategoryPieType] = useState<'income' | 'expense' | 'investment'>('expense');
    const [projectIncomeReport, setProjectIncomeReport] = useState<ProjectIncomeSummary[]>([]);
    const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
    const [netWorthTrend, setNetWorthTrend] = useState<NetWorthPoint[]>([]);
    const [benchmarkReport, setBenchmarkReport] = useState<any>(null);
    const [sourceCategoryBreakdown, setSourceCategoryBreakdown] = useState<SourceCategorySummary[]>([]);
    const [sourceBreakdownType, setSourceBreakdownType] = useState<'income' | 'expense' | 'transfer'>('expense');
    const [visualSourceBreakdownType, setVisualSourceBreakdownType] = useState<'income' | 'expense' | 'transfer'>('expense');

    // Metadata for Filters
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Filter State
    const [filters, setFilters] = useState<ReportFilters>({
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
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

            const [monthly, incCat, expCat, invCat, projectInc, stats, netWorth, benchReport, sourceBreakdown] = await Promise.all([
                execute<MonthlySummary[]>('get_monthly_summary', { year: selectedYear, filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'income', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'expense', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'investment', filters: backendFilters }),
                execute<ProjectIncomeSummary[]>('get_project_income_report', { year: selectedYear }),
                execute<OverallStats>('get_overall_stats', { filters: backendFilters }),
                execute<NetWorthPoint[]>('get_net_worth_trend'),
                execute<any>('get_investment_benchmark_report'),
                execute<SourceCategorySummary[]>('get_source_category_breakdown', { filters: backendFilters }),
            ]);

            setMonthlySummary(monthly);
            setIncomeCategories(incCat);
            setExpenseCategories(expCat);
            setInvestmentCategories(invCat);
            setProjectIncomeReport(projectInc);
            setOverallStats(stats);
            setNetWorthTrend(netWorth);
            setBenchmarkReport(benchReport);
            setSourceCategoryBreakdown(sourceBreakdown);
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

    // Navigate by calendar month
    const navigateMonth = (delta: number) => {
        setFilters(prev => ({
            ...prev,
            start_date: shiftMonth(prev.start_date, delta, 'start'),
            end_date: shiftMonth(prev.start_date, delta, 'end'),
        }));
    };

    const getSurvivalData = () => {
        if (monthlySummary.length === 0 || netWorthTrend.length === 0) return {
            months: 0, total: 0, liquid: 0, burn: 0, colorClass: 'text-slate-400', borderClass: 'border-slate-500', bgClass: 'bg-slate-500/5', formatted: '0 Days'
        };

        const last2 = monthlySummary.slice(-2);
        const burn = last2.reduce((sum, m) => sum + m.expense, 0) / Math.max(1, last2.length);
        const currentLiquid = netWorthTrend[netWorthTrend.length - 1].cash;
        const currentTotal = netWorthTrend[netWorthTrend.length - 1].total;
        const runwayMonths = burn > 0 ? currentLiquid / burn : (currentLiquid > 0 ? Infinity : 0);

        let formatted = '';
        if (runwayMonths === Infinity) {
            formatted = 'Infinite';
        } else if (runwayMonths === 0) {
            formatted = '0 Days';
        } else {
            const totalDays = Math.round(runwayMonths * 30.437);
            const years = Math.floor(totalDays / 365);
            const months = Math.floor((totalDays % 365) / 30.437);
            const days = Math.round((totalDays % 365) % 30.437);
            const parts = [];
            if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
            if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
            if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);
            formatted = parts.join(', ');
        }

        let colorClass = 'text-green-400';
        let borderClass = 'border-green-500';
        let bgClass = 'bg-green-500/5';

        if (runwayMonths < 2) { colorClass = 'text-red-400'; borderClass = 'border-red-500'; bgClass = 'bg-red-500/5'; }
        else if (runwayMonths < 6) { colorClass = 'text-orange-400'; borderClass = 'border-orange-500'; bgClass = 'bg-orange-500/5'; }
        else if (runwayMonths < 12) { colorClass = 'text-blue-400'; borderClass = 'border-blue-500'; bgClass = 'bg-blue-500/5'; }

        return { months: runwayMonths, total: currentTotal, liquid: currentLiquid, burn, colorClass, borderClass, bgClass, formatted };
    };

    const survival = getSurvivalData();

    const tabs = [
        { id: 'visuals', label: '📊 Charts & Visuals' },
        { id: 'numbers', label: '🔢 Detailed Numbers' },
        { id: 'benchmark', label: '🎯 Investment Benchmark' },
    ] as const;

    // Current month label for the navigator
    const currentMonthLabel = getMonthLabel(filters.start_date);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className={darkTheme.title}>Reports & Analytics</h1>

                {/* Date Navigator + Filters */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 w-full md:w-auto">
                    {/* Month Navigation with Arrow Keys */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-sm font-bold"
                            title="Previous Month"
                        >
                            ‹
                        </button>
                        <span className="text-xs text-slate-200 font-semibold min-w-[110px] text-center">{currentMonthLabel}</span>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-sm font-bold"
                            title="Next Month"
                        >
                            ›
                        </button>
                    </div>

                    <div className="w-px h-6 bg-slate-600" />

                    {/* Calendar Date Inputs */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">From:</span>
                        <input
                            type="date"
                            className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1"
                            value={filters.start_date}
                            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                        />
                        <span className="text-slate-500">—</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">To:</span>
                        <input
                            type="date"
                            className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1"
                            value={filters.end_date}
                            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                        />
                    </div>

                    <div className="w-px h-6 bg-slate-600" />

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Client:</span>
                        <select
                            className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1 min-w-[100px]"
                            value={filters.client_id || ''}
                            onChange={(e) => setFilters({ ...filters, client_id: e.target.value ? parseInt(e.target.value) : undefined })}
                        >
                            <option value="">All</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Project:</span>
                        <select
                            className="bg-slate-900 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1 min-w-[100px]"
                            value={filters.project_id || ''}
                            onChange={(e) => setFilters({ ...filters, project_id: e.target.value ? parseInt(e.target.value) : undefined })}
                        >
                            <option value="">All</option>
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

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-800/60 p-1 rounded-xl border border-slate-700 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                            : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && <div className={darkTheme.loading}>Updating reports...</div>}

            {/* ─── VISUALS TAB ─── */}
            {activeTab === 'visuals' && (
                <div className="space-y-6">
                    {/* Key Health Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Financial Runway */}
                        <div className={`${darkTheme.card} p-6 border-l-4 ${survival.borderClass} ${survival.bgClass}`}>
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Survival Time</span>
                                <div className="group relative">
                                    <span className="cursor-help text-slate-500 hover:text-blue-400 transition-colors text-[10px]">ⓘ</span>
                                    <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-800 text-[10px] text-slate-200 rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-700 leading-tight">
                                        How long you can live off your Liquid Assets only (Bank/Cash) using current expenses.
                                    </div>
                                </div>
                            </div>
                            <div className={`text-2xl font-bold ${survival.colorClass} leading-tight`}>
                                {survival.formatted}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2">Liquid Cash vs Consumption</div>
                        </div>

                        {/* Monthly Burn */}
                        <div className={darkTheme.card + " p-6 border-l-4 border-red-500"}>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Monthly Burn Rate</div>
                            <div className="text-2xl font-bold text-red-400">
                                {(() => {
                                    const last2 = monthlySummary.slice(-2);
                                    const avg = last2.reduce((sum, m) => sum + m.expense, 0) / Math.max(1, last2.length);
                                    return formatCurrency(avg);
                                })()}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2 italic">Essential Lifestyle Spending</div>
                        </div>

                        {/* Savings Rate */}
                        <div className={darkTheme.card + " p-6 border-l-4 border-blue-500 bg-blue-500/5"}>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Savings Efficiency</div>
                            <div className={`text-2xl font-bold ${overallStats?.net_balance && overallStats.total_income > 0 ? (overallStats.net_balance / overallStats.total_income * 100 > 20 ? 'text-green-400' : 'text-blue-400') : 'text-slate-100'}`}>
                                {overallStats && overallStats.total_income > 0 ? ((overallStats.net_balance / overallStats.total_income) * 100).toFixed(2) + '%' : '0.00%'}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2">Portion of income "kept"</div>
                        </div>

                        {/* Net Worth */}
                        <div className={darkTheme.card + " p-6 border-l-4 border-cyan-400"}>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Wealth</div>
                            <div className="text-2xl font-bold text-cyan-400">
                                {formatCurrency(netWorthTrend.length > 0 ? netWorthTrend[netWorthTrend.length - 1].total : 0)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-2 italic">Liquid + Invested Capital</div>
                        </div>
                    </div>

                    {/* Monthly Trend Chart */}
                    <div className={darkTheme.card + " p-6"}>
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
                                data={monthlySummary.map(m => ({ ...m, savings_display: Math.max(m.net, 0) }))}
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
                                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}k`} />
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
                                            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '12px 16px', fontSize: 13, minWidth: 200 }}>
                                                <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: 10, fontSize: 12 }}>{label}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80' }} />
                                                        <span style={{ color: '#94a3b8' }}>Income</span>
                                                    </div>
                                                    <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 15 }}>{formatCurrency(m.income)}</span>
                                                </div>
                                                <div style={{ borderTop: '1px solid #1e293b', marginBottom: 10 }} />
                                                {[
                                                    { color: '#ef4444', label: 'Expenses', value: m.expense },
                                                    { color: '#06b6d4', label: 'Invested', value: m.investment },
                                                    { color: savingsColor, label: savingsLabel, value: m.net },
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
                                <Bar dataKey="expense" stackId="a" fill="#ef4444" name="Expenses" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="investment" stackId="a" fill="#06b6d4" name="Invested" radius={[0, 0, 0, 0]} />
                                <Bar
                                    dataKey="savings_display"
                                    stackId="a"
                                    fill="#3b82f6"
                                    name="Savings"
                                    radius={[6, 6, 0, 0]}
                                    label={(props: any) => {
                                        const { x, y, width, index } = props;
                                        const income = monthlySummary[index]?.income ?? 0;
                                        if (!income) return <g />;
                                        return (
                                            <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#4ade80" fontSize={11} fontWeight={700}>
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

                    {/* Category Pie Chart */}
                    <div className={darkTheme.card + " p-6"}>
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
                            const data = categoryPieType === 'income' ? incomeCategories : categoryPieType === 'expense' ? expenseCategories : investmentCategories;
                            const colors = categoryPieType === 'investment' ? ['#06b6d4', '#22d3ee', '#0891b2', '#0e7490', '#155e75'] : COLORS;
                            const titleColor = categoryPieType === 'income' ? 'text-green-400' : categoryPieType === 'expense' ? 'text-red-400' : 'text-cyan-400';
                            const emptyMessage = categoryPieType === 'investment'
                                ? 'No investment categories. Mark categories as investments in Categories screen.'
                                : `No ${categoryPieType} transactions for selected period.`;

                            return data.length > 0 ? (
                                <div className="flex flex-col lg:flex-row gap-6">
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height={350}>
                                            <PieChart>
                                                <Pie data={data} dataKey="total" nameKey="category_name" cx="50%" cy="50%" innerRadius={70} outerRadius={130}>
                                                    {data.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                                                </Pie>
                                                <Tooltip
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const entry = payload[0];
                                                            return (
                                                                <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-lg shadow-2xl min-w-[160px]">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <div className="w-2 h-2 rounded-full" style={{ background: entry.payload.fill || entry.color }} />
                                                                        <span className="text-slate-200 font-bold">{entry.name}</span>
                                                                    </div>
                                                                    <div className="text-xl font-mono text-slate-100">{formatCurrency(Number(entry.value))}</div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
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
                                                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} />
                                                    <span className="text-slate-300 truncate max-w-[130px]">{cat.category_name}</span>
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

                    {/* Source Distribution Stacked Chart */}
                    <div className={darkTheme.card + " p-6"}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.subtitle}>Source vs Category Distribution</h2>
                            <select
                                value={visualSourceBreakdownType}
                                onChange={(e) => setVisualSourceBreakdownType(e.target.value as any)}
                                className="bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="income">💵 Income Source Flow</option>
                                <option value="expense">💸 Expense Source Flow</option>
                                <option value="transfer">🔄 Transfer Source Flow</option>
                            </select>
                        </div>
                        {(() => {
                            const filtered = sourceCategoryBreakdown.filter(i => i.direction === visualSourceBreakdownType);
                            if (filtered.length === 0) return <div className={darkTheme.empty}>No data for the selected type in this period.</div>;

                            // Transform data for stacked bar chart: { source: string, Category1: amount, Category2: amount, ... }
                            const sourcesMap: Record<string, any> = {};
                            const categories = new Set<string>();

                            filtered.forEach(item => {
                                if (!sourcesMap[item.source_name]) {
                                    sourcesMap[item.source_name] = { source: item.source_name, total: 0 };
                                }
                                sourcesMap[item.source_name][item.category_name] = item.total;
                                sourcesMap[item.source_name].total += item.total;
                                categories.add(item.category_name);
                            });

                            const data = Object.values(sourcesMap).sort((a, b) => b.total - a.total);
                            const categoryList = Array.from(categories);
                            const colors = visualSourceBreakdownType === 'income' ? ['#10b981', '#34d399', '#059669', '#047857', '#065f46'] : 
                                           visualSourceBreakdownType === 'expense' ? ['#ef4444', '#f87171', '#dc2626', '#b91c1c', '#991b1b'] : 
                                           ['#3b82f6', '#60a5fa', '#2563eb', '#1d4ed8', '#1e40af'];

                            return (
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={data}
                                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                            barSize={30}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                                            <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                            <YAxis type="category" dataKey="source" stroke="#94a3b8" fontSize={11} width={120} />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const total = payload.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
                                                        return (
                                                            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-lg shadow-2xl min-w-[200px]">
                                                                <p className="text-slate-100 font-bold mb-2 border-b border-slate-700 pb-1">{label}</p>
                                                                {payload.map((entry: any, index: number) => (
                                                                    <div key={index} className="flex justify-between gap-4 text-xs mb-1">
                                                                        <div className="flex items-center gap-2 text-slate-400">
                                                                            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                                                                            <span>{entry.name}:</span>
                                                                        </div>
                                                                        <span className="text-slate-100 font-mono">{formatCurrency(entry.value)}</span>
                                                                    </div>
                                                                ))}
                                                                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between font-bold text-xs">
                                                                    <span className="text-slate-300">Total</span>
                                                                    <span className="text-slate-100 font-mono">{formatCurrency(total)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            {categoryList.map((cat, idx) => (
                                                <Bar 
                                                    key={cat} 
                                                    dataKey={cat} 
                                                    stackId="a" 
                                                    fill={colors[idx % colors.length]} 
                                                    radius={idx === categoryList.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} 
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Project Income Performance Chart */}
                    {projectIncomeReport.length > 0 && (
                        <div className={darkTheme.card + " p-6"}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className={darkTheme.subtitle}>Project Income Performance</h2>
                                <div className="flex gap-4 text-xs">
                                    {[{ bg: 'bg-green-500', label: 'Actual (Achieved)' }, { bg: 'bg-orange-500', label: 'Target Gap' }, { bg: 'bg-emerald-400', label: 'Surplus' }].map(({ bg, label }) => (
                                        <div key={label} className="flex items-center gap-1.5">
                                            <span className={`w-3 h-3 ${bg} rounded-sm`}></span>
                                            <span className="text-slate-400">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={projectIncomeReport.map(m => ({
                                        ...m,
                                        achieved: Math.min(m.actual_income, m.expected_income),
                                        gap: Math.max(0, m.expected_income - m.actual_income),
                                        surplus: Math.max(0, m.actual_income - m.expected_income)
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickFormatter={(val) => {
                                            const [y, m] = val.split('-');
                                            return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short' });
                                        }} />
                                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => formatCurrency(val)} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-lg shadow-2xl">
                                                            <p className="text-slate-400 font-bold mb-2">{label}</p>
                                                            {payload.map((entry: any, index: number) => (
                                                                <div key={index} className="flex justify-between gap-4 text-xs mb-1">
                                                                    <span style={{ color: entry.color }} className="font-medium">{entry.name}:</span>
                                                                    <span className="text-slate-100 font-mono">{formatCurrency(entry.value)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="achieved" stackId="p" fill="#22c55e" radius={[0, 0, 0, 0]} name="Achieved" barSize={32} />
                                        <Bar dataKey="gap" stackId="p" fill="#f97316" radius={[4, 4, 0, 0]} name="Gap" barSize={32} />
                                        <Bar dataKey="surplus" stackId="p" fill="#34d399" radius={[4, 4, 0, 0]} name="Surplus" barSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── NUMBERS TAB ─── */}
            {activeTab === 'numbers' && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {overallStats && (
                            <>
                                <div className={darkTheme.card + " p-5"}>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Income</div>
                                    <div className="text-2xl font-bold text-green-400">{formatCurrency(overallStats.total_income)}</div>
                                </div>
                                <div className={darkTheme.card + " p-5"}>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Expense</div>
                                    <div className="text-2xl font-bold text-red-400">{formatCurrency(overallStats.total_expense)}</div>
                                </div>
                                <div className={darkTheme.card + " p-5"}>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Invested</div>
                                    <div className="text-2xl font-bold text-cyan-400">{formatCurrency(overallStats.total_invested)}</div>
                                </div>
                                <div className={darkTheme.card + " p-5"}>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Cash Remaining</div>
                                    <div className={`text-2xl font-bold ${overallStats.net_balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                        {formatCurrency(overallStats.net_balance)}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Monthly Breakdown Table */}
                    <div className={darkTheme.card + " p-6"}>
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
                                                <td className={`text-right py-2 px-3 ${rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{rate.toFixed(2)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top Income/Expense/Investment tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className={darkTheme.card + " p-6"}>
                            <h2 className={darkTheme.subtitle + " mb-4"}>💵 Top Income Sources</h2>
                            <div className="space-y-2">
                                {incomeCategories.length > 0 ? incomeCategories.slice(0, 8).map((cat, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors">
                                        <span className="text-slate-200">{cat.category_name}</span>
                                        <span className="text-green-400 font-bold">{formatCurrency(cat.total)}</span>
                                    </div>
                                )) : <div className="text-slate-500 text-sm italic">No data</div>}
                            </div>
                        </div>
                        <div className={darkTheme.card + " p-6"}>
                            <h2 className={darkTheme.subtitle + " mb-4"}>💸 Top Expense Items</h2>
                            <div className="space-y-2">
                                {expenseCategories.length > 0 ? expenseCategories.slice(0, 8).map((cat, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors">
                                        <span className="text-slate-200">{cat.category_name}</span>
                                        <span className="text-red-400 font-bold">{formatCurrency(cat.total)}</span>
                                    </div>
                                )) : <div className="text-slate-500 text-sm italic">No data</div>}
                            </div>
                        </div>
                        <div className={darkTheme.card + " p-6"}>
                            <h2 className={darkTheme.subtitle + " mb-4"}>📈 Investments</h2>
                            <div className="space-y-2">
                                {investmentCategories.length > 0 ? investmentCategories.slice(0, 8).map((cat, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded hover:bg-slate-700 transition-colors">
                                        <span className="text-slate-200">{cat.category_name}</span>
                                        <span className="text-cyan-400 font-bold">{formatCurrency(cat.total)}</span>
                                    </div>
                                )) : <div className="text-slate-500 text-sm italic">No investment categories found. Mark categories as investments in the Categories screen.</div>}
                            </div>
                            {investmentCategories.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-sm font-bold">
                                    <span className="text-slate-400">Total Invested</span>
                                    <span className="text-cyan-400">{formatCurrency(investmentCategories.reduce((s, c) => s + c.total, 0))}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Project Income Detailed Table */}
                    {projectIncomeReport.length > 0 && (
                        <div className={darkTheme.card + " p-6"}>
                            <h2 className={darkTheme.subtitle + " mb-4"}>Project Income Detailed View</h2>
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
                                                    <td className="px-4 py-3 text-right text-slate-400 font-bold">{formatCurrency(monthData.expected_income)}</td>
                                                    <td className="px-4 py-3 text-right text-green-400 font-bold">{formatCurrency(monthData.actual_income)}</td>
                                                    <td className="px-4 py-3 text-right text-slate-500 text-[10px] uppercase">Month Total</td>
                                                </tr>
                                                {monthData.projects.map((project) => (
                                                    <tr key={`${monthData.month}-${project.project_id}`} className="hover:bg-blue-500/5 transition-colors text-[11px]">
                                                        <td className="px-8 py-2 text-slate-400 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                                            {project.project_name}
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-slate-500">{project.expected > 0 ? formatCurrency(project.expected) : '-'}</td>
                                                        <td className="px-4 py-2 text-right text-slate-300">{project.actual > 0 ? formatCurrency(project.actual) : '-'}</td>
                                                        <td className={`px-4 py-2 text-right font-mono ${project.outstanding_balance > 0 ? 'text-orange-400/80' : 'text-slate-600'}`}>
                                                            {project.outstanding_balance > 0 ? `Pending: ${formatCurrency(project.outstanding_balance)}` : 'Settled'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Source Breakdown Table */}
                    <div className={darkTheme.card + " p-6"}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.subtitle}>Source Breakdown</h2>
                            <select
                                value={sourceBreakdownType}
                                onChange={(e) => setSourceBreakdownType(e.target.value as any)}
                                className="bg-slate-900 text-sm text-slate-200 border border-slate-700 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="income">💵 Income (Client → Category)</option>
                                <option value="expense">💸 Expense (Account → Category)</option>
                                <option value="transfer">🔄 Transfer (Account → Destination)</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto bg-slate-900/40 rounded-xl border border-slate-700/50">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Source</th>
                                        <th className="px-4 py-3">Category / Destination</th>
                                        <th className="px-4 py-3 text-right">Count</th>
                                        <th className="px-4 py-3 text-right">Total Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {sourceCategoryBreakdown
                                        .filter(item => item.direction === sourceBreakdownType)
                                        .map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3 font-semibold text-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                            item.direction === 'income' ? 'bg-green-500' : 
                                                            item.direction === 'expense' ? 'bg-red-500' : 'bg-blue-500'
                                                        }`}></div>
                                                        {item.source_name}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-400 font-medium">{item.category_name}</td>
                                                <td className="px-4 py-3 text-right text-slate-500 font-mono italic">{item.count}tx</td>
                                                <td className={`px-4 py-3 text-right font-bold font-mono ${
                                                    item.direction === 'income' ? 'text-green-400' : 
                                                    item.direction === 'expense' ? 'text-red-400' : 'text-blue-400'
                                                }`}>
                                                    {formatCurrency(item.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    {sourceCategoryBreakdown.filter(item => item.direction === sourceBreakdownType).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-12 text-center text-slate-500 italic bg-slate-900/20">
                                                No breakdown data for the selected type and filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Report Summary */}
                    <div className={darkTheme.card + " p-6 bg-blue-500/5 border-blue-500/20"}>
                        <h2 className={darkTheme.subtitle + " mb-4 text-blue-400"}>Report Summary</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                            <div className="p-4 bg-slate-900/50 rounded-lg">
                                <div className="text-slate-400 mb-1">Period</div>
                                <div className="text-slate-100 font-bold">{filters.start_date} → {filters.end_date}</div>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-lg">
                                <div className="text-slate-400 mb-1">Savings Rate</div>
                                <div className={`font-bold ${overallStats?.net_balance && overallStats.total_income > 0 ? (overallStats.net_balance / overallStats.total_income * 100 > 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-400'}`}>
                                    {overallStats && overallStats.total_income > 0 ? ((overallStats.net_balance / overallStats.total_income) * 100).toFixed(2) + '%' : '0.00%'}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-lg">
                                <div className="text-slate-400 mb-1">Investment Rate</div>
                                <div className="text-cyan-400 font-bold">
                                    {overallStats && overallStats.total_income > 0 ? ((overallStats.total_invested / overallStats.total_income) * 100).toFixed(2) + '%' : '0.00%'}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900/50 rounded-lg">
                                <div className="text-slate-400 mb-1">Transactions</div>
                                <div className="text-slate-100 font-bold">{overallStats?.transaction_count ?? 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── BENCHMARK TAB ─── */}
            {activeTab === 'benchmark' && (
                <BenchmarkTab report={benchmarkReport} refreshData={() => loadReports()} />
            )}
        </div>
    );
}
