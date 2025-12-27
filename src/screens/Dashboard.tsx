import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';

interface DashboardData {
    total_balance: number;
    bank_balance: number;
    cash_balance: number;
    investment_balance: number;
    current_month_income: number;
    current_month_expense: number;
    current_month_net: number;
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
            const dashboardData = await execute<DashboardData>('get_dashboard_data');
            setData(dashboardData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
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
                <div className="card p-8 text-center">
                    <div className="text-sm text-slate-400 mb-2">Total Balance</div>
                    <div className="text-5xl font-bold text-blue-400">
                        {formatCurrency(data.total_balance)}
                    </div>
                </div>
            </div>

            {/* Account Balances by Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-6 border-l-4 border-blue-500">
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

                <div className="card p-6 border-l-4 border-green-500">
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

                <div className="card p-6 border-l-4 border-purple-500">
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

            {/* Current Month Summary */}
            <div className="mb-6">
                <h2 className="text-xl font-bold mb-4 text-slate-100">This Month</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-6">
                        <div className="text-sm text-slate-400">Income</div>
                        <div className="text-2xl font-bold text-green-400 mt-2">
                            {formatCurrency(data.current_month_income)}
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="text-sm text-slate-400">Expense</div>
                        <div className="text-2xl font-bold text-red-400 mt-2">
                            {formatCurrency(data.current_month_expense)}
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="text-sm text-slate-400">Net</div>
                        <div className={`text-2xl font-bold mt-2 ${data.current_month_net >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                            {formatCurrency(data.current_month_net)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-6">
                <h2 className="text-xl font-bold mb-4 text-slate-100">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => navigate('/transactions')}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center"
                    >
                        <div className="text-2xl mb-2">💳</div>
                        <div className="text-sm text-slate-200">Add Transaction</div>
                    </button>
                    <button
                        onClick={() => navigate('/accounts')}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center"
                    >
                        <div className="text-2xl mb-2">🏦</div>
                        <div className="text-sm text-slate-200">Manage Accounts</div>
                    </button>
                    <button
                        onClick={() => navigate('/categories')}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center"
                    >
                        <div className="text-2xl mb-2">📁</div>
                        <div className="text-sm text-slate-200">Categories</div>
                    </button>
                    <button
                        onClick={() => navigate('/reports')}
                        className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-center"
                    >
                        <div className="text-2xl mb-2">📊</div>
                        <div className="text-sm text-slate-200">View Reports</div>
                    </button>
                </div>
            </div>

            {/* Getting Started Guide (only if no data) */}
            {data.total_balance === 0 && data.current_month_income === 0 && data.current_month_expense === 0 && (
                <div className="card p-6 mt-6 border-2 border-blue-600">
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
