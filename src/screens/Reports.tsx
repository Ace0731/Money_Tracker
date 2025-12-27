import { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Reports() {
    const { execute, loading } = useDatabase();
    const [selectedYear] = useState(new Date().getFullYear());
    const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<CategorySummary[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<CategorySummary[]>([]);
    const [clientSummary, setClientSummary] = useState<ClientSummary[]>([]);
    const [overallStats, setOverallStats] = useState<OverallStats | null>(null);

    useEffect(() => {
        loadReports();
    }, [selectedYear]);

    const loadReports = async () => {
        try {
            const [monthly, incCat, expCat, clients, stats] = await Promise.all([
                execute<MonthlySummary[]>('get_monthly_summary', { year: selectedYear }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'income' }),
                execute<CategorySummary[]>('get_category_summary', { direction: 'expense' }),
                execute<ClientSummary[]>('get_client_summary'),
                execute<OverallStats>('get_overall_stats'),
            ]);

            setMonthlySummary(monthly);
            setIncomeCategories(incCat);
            setExpenseCategories(expCat);
            setClientSummary(clients);
            setOverallStats(stats);
        } catch (error) {
            console.error('Failed to load reports:', error);
        }
    };

    if (loading) {
        return <div className={darkTheme.loading}>Loading reports...</div>;
    }

    return (
        <div className="p-6">
            <h1 className={darkTheme.title + " mb-6"}>Reports & Analytics</h1>

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
                        <div className="text-sm text-slate-400">Total Transactions</div>
                        <div className="text-2xl font-bold text-blue-400 mt-2">
                            {overallStats.transaction_count}
                        </div>
                    </div>
                </div>
            )}

            {/* Monthly Trend */}
            <div className={darkTheme.card + " p-6 mb-6"}>
                <h2 className={darkTheme.subtitle + " mb-4"}>Monthly Income vs Expense ({selectedYear})</h2>
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
                        <div className={darkTheme.empty}>No income transactions yet</div>
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
                        <div className={darkTheme.empty}>No expense transactions yet</div>
                    )}
                </div>
            </div>

            {/* Client Income */}
            {clientSummary.length > 0 && (
                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4"}>Client Income</h2>
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

            {/* Top Categories Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Income */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4"}>Top Income Categories</h2>
                    <div className="space-y-2">
                        {incomeCategories.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                                <span className="text-slate-200">{cat.category_name}</span>
                                <span className="text-green-400 font-bold">{formatCurrency(cat.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Expenses */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className={darkTheme.subtitle + " mb-4"}>Top Expense Categories</h2>
                    <div className="space-y-2">
                        {expenseCategories.slice(0, 5).map((cat, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                                <span className="text-slate-200">{cat.category_name}</span>
                                <span className="text-red-400 font-bold">{formatCurrency(cat.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
