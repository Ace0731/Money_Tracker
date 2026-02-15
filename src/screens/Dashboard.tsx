import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import type { Project } from '../types';

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
    project_stats?: {
        total_expected: number;
        total_received: number;
        total_pending: number;
    };
}

export default function Dashboard() {
    const { execute, loading } = useDatabase();
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [dashboardData, projects] = await Promise.all([
                execute<DashboardData>('get_dashboard_data'),
                execute<Project[]>('get_projects')
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
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    };

    const getAccountIcon = (type: string) => {
        switch (type) {
            case 'bank': return '🏦';
            case 'cash': return '💵';
            case 'investment': return '📈';
            default: return '💰';
        }
    };

    if (loading || !data) {
        return <div className={darkTheme.loading}>Loading dashboard...</div>;
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-slate-100">Dashboard</h1>

            {/* Total Balance */}
            <div className="mb-6">
                <div className="card p-8 text-center text-white bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700">
                    <div className="text-sm text-slate-400 mb-2">Total Balance</div>
                    <div className="text-5xl font-bold text-blue-400">
                        {formatCurrency(data.total_balance)}
                    </div>
                </div>
            </div>

            {/* Account Balances by Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-6 border-l-4 border-blue-500 bg-slate-800 rounded-xl shadow-lg border-y border-r border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-400">Bank Accounts</div>
                            <div className="text-2xl font-bold text-slate-100 mt-2">
                                {formatCurrency(data.bank_balance)}
                            </div>
                        </div>
                        <div className="text-4xl">🏦</div>
                    </div>
                </div>

                <div className="card p-6 border-l-4 border-green-500 bg-slate-800 rounded-xl shadow-lg border-y border-r border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-400">Cash</div>
                            <div className="text-2xl font-bold text-slate-100 mt-2">
                                {formatCurrency(data.cash_balance)}
                            </div>
                        </div>
                        <div className="text-4xl">💵</div>
                    </div>
                </div>

                <div className="card p-6 border-l-4 border-purple-500 bg-slate-800 rounded-xl shadow-lg border-y border-r border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-400">Investments</div>
                            <div className="text-2xl font-bold text-slate-100 mt-2">
                                {formatCurrency(data.investment_balance)}
                            </div>
                        </div>
                        <div className="text-4xl">📈</div>
                    </div>
                </div>
            </div>

            {/* Individual Account Balances */}
            {data.individual_accounts && data.individual_accounts.length > 0 && (
                <div className="mb-6">
                    <h2 className="text-xl font-bold mb-4 text-slate-100">Individual Accounts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {data.individual_accounts.map((account) => (
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

            {/* Getting Started Guide (only if no data) */}
            {data.total_balance === 0 && data.current_month_income === 0 && data.current_month_expense === 0 && (
                <div className="card p-6 mt-6 border-2 border-blue-600 bg-slate-800/50 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold mb-4 text-slate-100">Getting Started</h2>
                    <div className="space-y-3 text-slate-300">
                        <p>✅ All screens are functional and ready to use</p>
                        <p>✅ Database is integrated and working</p>
                        <p>💡 Start by adding your accounts in the Accounts screen</p>
                        <p>💡 Then create categories for income and expenses</p>
                        <p>💡 Finally, record your first transaction!</p>
                    </div>
                </div>
            )}
        </div>
    );
}
