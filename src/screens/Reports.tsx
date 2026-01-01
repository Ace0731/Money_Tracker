import { useEffect, useState } from 'react';
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
    net_balance: number;
    transaction_count: number;
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
    const [clientSummary, setClientSummary] = useState<ClientSummary[]>([]);
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

            const [monthly, incCat, expCat, clientSum, stats] = await Promise.all([
                execute<MonthlySummary[]>('get_monthly_summary', { year: selectedYear, filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'income', filters: backendFilters }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'expense', filters: backendFilters }),
                execute<ClientSummary[]>('get_client_summary', { filters: backendFilters }),
                execute<OverallStats>('get_overall_stats', { filters: backendFilters }),
            ]);

            setMonthlySummary(monthly);
            setIncomeCategories(incCat);
            setExpenseCategories(expCat);
            setClientSummary(clientSum);
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Income Categories */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4 text-green-400"}>Income by Category</h2>
                    {incomeCategories.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={incomeCategories}
                                    dataKey="total"
                                    nameKey="category_name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(entry) => `${entry.category_name}: ${formatCurrency(entry.total)}`}
                                    labelLine={false}
                                >
                                    {incomeCategories.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className={darkTheme.empty}>No income transactions for filters</div>
                    )}
                </div>

                {/* Expense Categories */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4 text-red-400"}>Expense by Category</h2>
                    {expenseCategories.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={expenseCategories}
                                    dataKey="total"
                                    nameKey="category_name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(entry) => `${entry.category_name}: ${formatCurrency(entry.total)}`}
                                    labelLine={false}
                                >
                                    {expenseCategories.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className={darkTheme.empty}>No expense transactions for filters</div>
                    )}
                </div>
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
                        <div className="text-blue-400 font-bold">
                            {(() => {
                                const totalInvested = expenseCategories
                                    .filter(c =>
                                        (c.category_name.toLowerCase().includes('investment') && !c.category_name.toLowerCase().includes('self')) ||
                                        c.category_name.toLowerCase().includes('money') ||
                                        c.category_name.toLowerCase().includes('stable')
                                    )
                                    .reduce((acc, curr) => acc + curr.total, 0);
                                return overallStats && overallStats.total_income > 0
                                    ? ((totalInvested / overallStats.total_income) * 100).toFixed(1) + '%'
                                    : '0%';
                            })()}
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
