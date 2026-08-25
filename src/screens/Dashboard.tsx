import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import type { Project } from '../types';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';

interface AccountBalance {
    id: number;
    name: string;
    account_type: string;
    balance: number;
}

interface DashboardData {
    total_balance: number;
    bank_balance: number;
    cash_balance: number;
    investment_balance: number;
    individual_accounts: AccountBalance[];
    current_month_income: number;
    current_month_expense: number;
    current_month_net: number;
    active_goals_count: number;
    completed_goals_count: number;
    project_stats?: {
        total_expected: number;
        total_received: number;
        total_pending: number;
    };
}

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

function StatCard({ title, amount, icon, color }: { 
    title: string, 
    amount: number, 
    icon: string, 
    color: string
}) {
    return (
        <div className={`card bg-slate-800 rounded-xl shadow-lg border-y border-r border-slate-700 overflow-hidden`}>
            <div className={`p-6 border-l-4 ${color}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{title}</div>
                        <div className="text-2xl font-bold text-slate-100 mt-1">
                            {formatCurrency(amount)}
                        </div>
                    </div>
                    <div className="text-3xl">{icon}</div>
                </div>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { execute, loading } = useDatabase();
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
    const [netWorthTrend, setNetWorthTrend] = useState<NetWorthPoint[]>([]);
    const [chartMonths, setChartMonths] = useState<6 | 12>(12);

    const getChartDateRange = (monthsCount: number) => {
        const today = new Date();
        const end = today.toISOString().split('T')[0];
        const startDateObj = new Date(today.getFullYear(), today.getMonth() - monthsCount + 1, 1);
        const start = startDateObj.toISOString().split('T')[0];
        return { start, end };
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    useEffect(() => {
        loadChartMonthlyData(chartMonths);
    }, [chartMonths]);

    const loadChartMonthlyData = async (monthsCount: number) => {
        const range = getChartDateRange(monthsCount);
        const year = new Date().getFullYear();
        try {
            const monthly = await execute<MonthlySummary[]>('get_monthly_summary', {
                year,
                filters: { start_date: range.start, end_date: range.end }
            });
            setMonthlySummary(monthly || []);
        } catch (error) {
            console.error('Failed to load monthly summary for chart:', error);
        }
    };

    const loadDashboard = async () => {
        try {
            const [dashboardData, projects, netWorth] = await Promise.all([
                execute<DashboardData>('get_dashboard_data'),
                execute<Project[]>('get_projects'),
                execute<NetWorthPoint[]>('get_net_worth_trend'),
            ]);

            const stats = projects.reduce((acc, p) => {
                const pending = (p.expected_amount || 0) - (p.received_amount || 0);
                return {
                    total_expected: acc.total_expected + (p.expected_amount || 0),
                    total_received: acc.total_received + (p.received_amount || 0),
                    total_pending: acc.total_pending + (pending > 0 ? pending : 0)
                };
            }, { total_expected: 0, total_received: 0, total_pending: 0 });

            setData({ ...dashboardData, project_stats: stats });
            setNetWorthTrend(netWorth || []);
            await loadChartMonthlyData(chartMonths);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    };

    const combinedChartData = useMemo(() => {
        const map = new Map<string, { month: string; net_worth: number; income: number; expense: number; investment: number }>();
        const range = getChartDateRange(chartMonths);
        const startMonthStr = range.start.slice(0, 7);
        const endMonthStr = range.end.slice(0, 7);

        netWorthTrend.forEach(nw => {
            if (nw.month >= startMonthStr && nw.month <= endMonthStr) {
                map.set(nw.month, {
                    month: nw.month,
                    net_worth: nw.total,
                    income: 0,
                    expense: 0,
                    investment: 0
                });
            }
        });

        monthlySummary.forEach(m => {
            const existing = map.get(m.month) || { month: m.month, net_worth: 0, income: 0, expense: 0, investment: 0 };
            existing.income = m.income;
            existing.expense = m.expense;
            existing.investment = m.investment;
            map.set(m.month, existing);
        });

        return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }, [netWorthTrend, monthlySummary, chartMonths]);

    const getAccountIcon = (type: string) => {
        switch (type) {
            case 'bank': return '🏦';
            case 'cash': return '💵';
            case 'investment': return '📈';
            case 'bucket': return '🎯';
            default: return '💰';
        }
    };

    if (loading || !data) {
        return <div className={darkTheme.loading}>Loading dashboard...</div>;
    }

    return (
        <div className="p-6 pb-20">
            <h1 className="text-3xl font-bold mb-6 text-slate-100">Dashboard</h1>

            {/* Total Balance */}
            <div className="mb-6">
                <div className="card p-8 text-center text-white bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700">
                    <div className="text-sm text-slate-400 mb-2">Total Net Worth</div>
                    <div className="text-5xl font-bold text-blue-400">
                        {formatCurrency(data.total_balance)}
                    </div>
                </div>
            </div>

            {/* Account Balances by Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard 
                    title="Bank Accounts" 
                    amount={data.bank_balance} 
                    icon="🏦" 
                    color="border-blue-500" 
                />
                <StatCard 
                    title="Cash" 
                    amount={data.cash_balance} 
                    icon="💵" 
                    color="border-green-500" 
                />
                <StatCard 
                    title="Investments" 
                    amount={data.investment_balance} 
                    icon="📈" 
                    color="border-purple-500" 
                />
            </div>

            {/* Net Worth & Cash Flow Trend Plot Chart */}
            <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            📈 Net Worth & Cash Flow Trend
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Track net worth movement along with Income, Expenses & Investments</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Legend preview */}
                        <div className="hidden lg:flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
                                <span className="text-slate-300">Net Worth</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                                <span className="text-slate-300">Income</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                                <span className="text-slate-300">Expenses</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span>
                                <span className="text-slate-300">Investments</span>
                            </div>
                        </div>

                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                            <button
                                onClick={() => setChartMonths(6)}
                                className={`px-3 py-1 text-xs font-bold rounded ${chartMonths === 6 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                6 Months
                            </button>
                            <button
                                onClick={() => setChartMonths(12)}
                                className={`px-3 py-1 text-xs font-bold rounded ${chartMonths === 12 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                12 Months
                            </button>
                        </div>
                    </div>
                </div>

                <div className="h-[350px]">
                    {combinedChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={combinedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis 
                                    dataKey="month" 
                                    stroke="#64748b" 
                                    fontSize={11}
                                    tickFormatter={(val: string) => {
                                        const [y, m] = val.split('-');
                                        return new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short' });
                                    }}
                                />
                                <YAxis 
                                    stroke="#64748b" 
                                    fontSize={11} 
                                    tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}k`} 
                                />
                                <Tooltip 
                                    cursor={{ stroke: '#334155', strokeDasharray: '3 3' }}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload || !payload.length) return null;
                                        const [y, m] = (label || '').split('-');
                                        const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                                        return (
                                            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[200px]">
                                                <div className="text-slate-400 font-bold mb-3 text-xs border-b border-slate-800 pb-1.5">{monthName}</div>
                                                {payload.map((entry: any, index: number) => (
                                                    <div key={index} className="flex justify-between items-center text-xs mb-1.5 gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                                                            <span className="text-slate-300 font-medium">{entry.name}:</span>
                                                        </div>
                                                        <span className="font-mono font-bold" style={{ color: entry.color }}>
                                                            {formatCurrency(Number(entry.value))}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="net_worth" 
                                    name="Net Worth" 
                                    stroke="#06b6d4" 
                                    strokeWidth={3} 
                                    fill="url(#netWorthGrad)" 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="income" 
                                    name="Income" 
                                    stroke="#34d399" 
                                    strokeWidth={2.5} 
                                    dot={{ r: 4, fill: '#34d399' }}
                                    activeDot={{ r: 6 }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="expense" 
                                    name="Expenses" 
                                    stroke="#f87171" 
                                    strokeWidth={2.5} 
                                    dot={{ r: 4, fill: '#f87171' }}
                                    activeDot={{ r: 6 }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="investment" 
                                    name="Investments" 
                                    stroke="#c084fc" 
                                    strokeWidth={2} 
                                    strokeDasharray="4 4"
                                    dot={{ r: 3, fill: '#c084fc' }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 italic text-sm">
                            No monthly cash flow data recorded yet.
                        </div>
                    )}
                </div>
            </div>

            {/* Individual Account Balances */}
            {data.individual_accounts && data.individual_accounts.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-xl font-bold mb-4 text-slate-100">Individual Accounts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {data.individual_accounts.filter(a => a.account_type !== 'bucket').map((account) => (
                            <div key={account.id} className="card p-4 bg-slate-800 rounded-xl shadow-lg border border-slate-700 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => navigate('/transactions', { state: { accountId: account.id } })}>
                                <div className="flex items-start justify-between">
                                    <div className="overflow-hidden">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 opacity-70">{account.account_type}</div>
                                        <div className="text-base font-semibold text-slate-100 truncate pr-2" title={account.name}>{account.name}</div>
                                        <div className="text-lg font-bold text-slate-100 mt-2">
                                            {formatCurrency(account.balance)}
                                        </div>
                                    </div>
                                    <div className="text-2xl opacity-80">{getAccountIcon(account.account_type)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Project Finance Summary */}
            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4 text-slate-100">Project Tracker Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                        <div className="text-sm text-slate-400">Total Project Value</div>
                        <div className="text-2xl font-bold text-blue-400 mt-2">
                            {formatCurrency(data.project_stats?.total_expected || 0)}
                        </div>
                    </div>
                    <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                        <div className="text-sm text-slate-400">Total Received</div>
                        <div className="text-2xl font-bold text-green-400 mt-2">
                            {formatCurrency(data.project_stats?.total_received || 0)}
                        </div>
                    </div>
                    <div className="card p-6 border-2 border-red-500/20 bg-slate-800 rounded-xl shadow-lg">
                        <div className="text-sm text-slate-400">Total Pending</div>
                        <div className="text-2xl font-bold text-red-500 mt-2">
                            {formatCurrency(data.project_stats?.total_pending || 0)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Month Summary */}
            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4 text-slate-100">This Month</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                        <div className="text-sm text-slate-400">Income</div>
                        <div className="text-2xl font-bold text-green-400 mt-2">
                            {formatCurrency(data.current_month_income)}
                        </div>
                    </div>
                    <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                        <div className="text-sm text-slate-400">Expense</div>
                        <div className="text-2xl font-bold text-red-400 mt-2">
                            {formatCurrency(data.current_month_expense)}
                        </div>
                    </div>
                    <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                        <div className="text-sm text-slate-400">Net</div>
                        <div className={`text-2xl font-bold mt-2 ${data.current_month_net >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                            {formatCurrency(data.current_month_net)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                <h2 className="text-xl font-bold mb-4 text-slate-100">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => navigate('/transactions')}
                        className="p-4 bg-slate-700 hover:bg-white/10 rounded-lg transition-colors text-center border border-slate-600"
                    >
                        <div className="text-2xl mb-2">💳</div>
                        <div className="text-sm text-slate-200">Add Transaction</div>
                    </button>
                    <button
                        onClick={() => navigate('/accounts')}
                        className="p-4 bg-slate-700 hover:bg-white/10 rounded-lg transition-colors text-center border border-slate-600"
                    >
                        <div className="text-2xl mb-2">🏦</div>
                        <div className="text-sm text-slate-200">Manage Accounts</div>
                    </button>
                    <button
                        onClick={() => navigate('/categories')}
                        className="p-4 bg-slate-700 hover:bg-white/10 rounded-lg transition-colors text-center border border-slate-600"
                    >
                        <div className="text-2xl mb-2">📁</div>
                        <div className="text-sm text-slate-200">Categories</div>
                    </button>
                    <button
                        onClick={() => navigate('/reports')}
                        className="p-4 bg-slate-700 hover:bg-white/10 rounded-lg transition-colors text-center border border-slate-600"
                    >
                        <div className="text-2xl mb-2">📊</div>
                        <div className="text-sm text-slate-200">View Reports</div>
                    </button>
                </div>
            </div>
        </div>
    );
}
