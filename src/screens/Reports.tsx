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
    Legend,
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

interface ClientSummary {
    client_name: string;
    total_income: number;
    transaction_count: number;
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
    const [clientSummary, setClientSummary] = useState<ClientSummary[]>([]);
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

            const [monthly, incCat, expCat, invCat, clientSum, projectInc, stats] = await Promise.all([
                execute<MonthlySummary[]>('get_monthly_summary', { year: selectedYear, filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'income', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'expense', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'investment', filters: backendFilters }),
                execute<ClientSummary[]>('get_client_summary', { filters: backendFilters }),
                execute<ProjectIncomeSummary[]>('get_project_income_report', { year: selectedYear }),
                execute<OverallStats>('get_overall_stats', { filters: backendFilters }),
            ]);

            setMonthlySummary(monthly);
            setIncomeCategories(incCat);
            setExpenseCategories(expCat);
            setInvestmentCategories(invCat);
            setClientSummary(clientSum);
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
                        <div className="text-2xl font-bold text-amber-400 mt-2">
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

            {/* Monthly Trend */}
            <div className={darkTheme.card + " p-6 mb-6"}>
                <h2 className={darkTheme.subtitle + " mb-4"}>Monthly Trend ({selectedYear})</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlySummary}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis dataKey="month" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                            labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend />
                        <Bar dataKey="income" fill="#10b981" name="Income" />
                        <Bar dataKey="expense" fill="#ef4444" name="Expense" />
                        <Bar dataKey="investment" fill="#f59e0b" name="Investment" />
                    </BarChart>
                </ResponsiveContainer>
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
                        ? ['#f59e0b', '#fbbf24', '#d97706', '#f97316', '#ea580c']
                        : COLORS;
                    const titleColor = categoryPieType === 'income' ? 'text-green-400'
                        : categoryPieType === 'expense' ? 'text-red-400'
                            : 'text-amber-400';
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

            {/* Client Income */}
            {clientSummary.length > 0 && !filters.client_id && (
                <div className={darkTheme.card + " p-6 mb-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4"}>Client Income Breakdown</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={clientSummary} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis type="number" stroke="#94a3b8" />
                            <YAxis dataKey="client_name" type="category" stroke="#94a3b8" width={150} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Bar dataKey="total_income" fill="#3b82f6" name="Income" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Project Income Performance */}
            {projectIncomeReport.length > 0 && (
                <div className={darkTheme.card + " p-6 mb-6"}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className={darkTheme.subtitle}>Project Income Performance</h2>
                        <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-blue-500 rounded-sm"></span>
                                <span className="text-slate-400">Actual Income</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 bg-slate-600 rounded-sm"></span>
                                <span className="text-slate-400">Expected (Budget)</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={projectIncomeReport}>
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
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="actual_income" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual" barSize={32} />
                                    <Bar dataKey="expected_income" fill="#475569" radius={[4, 4, 0, 0]} name="Expected" barSize={32} />
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
                                            <tr className="bg-slate-800/20 border-l-2 border-blue-500">
                                                <td className="px-4 py-3 font-bold text-slate-100 italic">
                                                    {new Date(monthData.month + '-01').toLocaleString('default', { month: 'long' })}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400 font-bold">
                                                    {formatCurrency(monthData.expected_income)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-blue-400 font-bold">
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
                        <div className="text-amber-400 font-bold">
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
