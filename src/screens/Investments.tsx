import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Investment, InvestmentSummary, Account, PlatformBalance, InvestmentLot } from '../types';
import { formatCurrency, formatUnits, formatRelativeTime } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Swal from 'sweetalert2';
import {
    calculateFDMaturity,
    calculateRDMaturity,
    calculatePPFBalance,
    calculateNPSValue,
    fetchNPSNAV,
    getDaysRemaining
} from '../utils/investmentCalculations';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

export default function Investments() {
    const { execute, loading } = useDatabase();
    const [summaries, setSummaries] = useState<InvestmentSummary[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [platformBalances, setPlatformBalances] = useState<PlatformBalance[]>([]);

    const [showLotForm, setShowLotForm] = useState(false);
    const [filter, setFilter] = useState<'all' | 'stock' | 'mf' | 'fd' | 'rd' | 'nps' | 'ppf' | 'pf'>('all');
    const [timePeriod, setTimePeriod] = useState<'all' | 'today' | 'month' | 'year'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showViewLots, setShowViewLots] = useState(false);
    const [viewLotsSummary, setViewLotsSummary] = useState<InvestmentSummary | null>(null);
    const [lotFormData, setLotFormData] = useState<InvestmentLot>({
        investment_id: 0,
        quantity: 0,
        price_per_unit: 0,
        charges: 0,
        date: new Date().toISOString().split('T')[0],
        lot_type: 'buy'
    });
    const [showForm, setShowForm] = useState(false);
    const [fetchingPrice, setFetchingPrice] = useState(false);
    const [editingLotId, setEditingLotId] = useState<number | null>(null);
    const [bankAmount, setBankAmount] = useState<string>('');
    const [formData, setFormData] = useState<Investment>({
        name: '',
        investment_type: 'stock',
        account_id: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [sumData, accData, platData] = await Promise.all([
                execute<InvestmentSummary[]>('get_investments_summary'),
                execute<Account[]>('get_accounts'),
                execute<PlatformBalance[]>('get_investment_platform_summary'),
            ]);
            setSummaries(sumData);
            setAccounts(accData.filter(a => a.account_type === 'investment'));
            setPlatformBalances(platData);
        } catch (error) {
            console.error('Failed to load investment data:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let newId = formData.id;
            const isNew = !formData.id;
            const type = formData.investment_type;

            if (formData.id) {
                await execute('update_investment', { investment: formData });
            } else {
                newId = await execute('create_investment', { investment: formData }) as number;
            }
            await loadData();
            setShowForm(false);
            setFormData({ name: '', investment_type: 'stock', account_id: 0 });

            if (isNew) {
                handleAddLot(newId as number, type);
            }
        } catch (error) {
            console.error('Failed to save investment:', error);
        }
    };

    const handleEdit = (inv: Investment) => {
        setFormData(inv);
        setShowForm(true);
    };

    const openLotsModal = (summary: InvestmentSummary) => {
        setViewLotsSummary(summary);
        setShowViewLots(true);
    };

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete investment?',
            text: "This will remove the asset and all its lots!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Yes, delete it',
            background: '#0f172a',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_investment', { id });
                await loadData();
                Swal.fire({
                    title: 'Deleted!',
                    icon: 'success',
                    background: '#0f172a',
                    color: '#f1f5f9',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (error) {
                console.error('Failed to delete investment:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to delete investment',
                    icon: 'error',
                    background: '#0f172a',
                    color: '#f1f5f9'
                });
            }
        }
    };

    const totalUnallocated = platformBalances.reduce((acc, p) => acc + p.balance, 0);

    // Time period filtering helpers
    const getDateRange = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (timePeriod) {
            case 'today':
                return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            case 'month':
                return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
            case 'year':
                return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31, 23, 59, 59) };
            default:
                return null;
        }
    };

    // Get available years from investment lots
    const getAvailableYears = () => {
        const years = new Set<number>();
        summaries.forEach(s => {
            s.lots.forEach(lot => {
                const year = new Date(lot.date).getFullYear();
                years.add(year);
            });
        });
        return Array.from(years).sort((a, b) => b - a);
    };

    const availableYears = getAvailableYears();

    const isLotInPeriod = (lotDate: string) => {
        if (timePeriod === 'all') return true;
        const range = getDateRange();
        if (!range) return true;

        const lot = new Date(lotDate);
        return lot >= range.start && lot <= range.end;
    };

    // Filter summaries by time period
    const timeFilteredSummaries = summaries.map(summary => {
        if (timePeriod === 'all') return summary;

        const filteredLots = summary.lots.filter(lot => isLotInPeriod(lot.date));
        if (filteredLots.length === 0) return null;

        const totalInvested = filteredLots.reduce((sum, lot) =>
            sum + (lot.quantity * lot.price_per_unit + lot.charges), 0);
        const totalUnits = filteredLots.reduce((sum, lot) => sum + lot.quantity, 0);
        const currentValuation = totalUnits * (summary.investment.current_price || 0);
        const avgBuyPrice = totalUnits > 0 ? totalInvested / totalUnits : 0;
        const netGain = currentValuation - totalInvested;
        const gainPercentage = totalInvested > 0 ? (netGain / totalInvested) * 100 : 0;

        return {
            ...summary,
            lots: filteredLots,
            total_invested: totalInvested,
            total_units: totalUnits,
            current_valuation: currentValuation,
            avg_buy_price: avgBuyPrice,
            net_gain: netGain,
            gain_percentage: gainPercentage,
        };
    }).filter(s => s !== null) as InvestmentSummary[];



    const handleAddLot = (invId: number, type?: string) => {
        setLotFormData({
            investment_id: invId,
            quantity: type === 'fd' || type === 'rd' || type === 'nps' || type === 'ppf' || type === 'pf' ? 1 : 0,
            price_per_unit: 0,
            charges: 0,
            date: new Date().toISOString().split('T')[0],
            lot_type: 'buy'
        });
        setEditingLotId(null);
        setBankAmount('');
        setShowLotForm(true);
    };

    const handleEditLot = (lot: InvestmentLot) => {
        setLotFormData({
            ...lot,
            investment_id: lot.investment_id,
            date: lot.date || new Date().toISOString().split('T')[0]
        });
        setEditingLotId(lot.id!);
        
        // Defensive number conversion for bankAmount calculation
        const qty = Number(lot.quantity) || 0;
        const price = Number(lot.price_per_unit) || 0;
        const chg = Number(lot.charges) || 0;
        setBankAmount((qty * price + chg).toFixed(2));
        
        setShowLotForm(true);
    };

    const handleLotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingLotId) {
                await execute('update_investment_lot', { lot: { ...lotFormData, id: editingLotId } });
            } else {
                await execute('add_investment_lot', { lot: lotFormData });
            }
            await loadData();
            setShowLotForm(false);
            setEditingLotId(null);
            setBankAmount('');
        } catch (error) {
            console.error('Failed to submit lot:', error);
            Swal.fire('Error', error as string, 'error');
        }
    };

    const handleDeleteLot = async (lotId: number) => {
        const result = await Swal.fire({
            title: 'Delete this lot?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Delete',
            background: '#0f172a',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_investment_lot', { id: lotId });
                await loadData();
            } catch (error) {
                console.error('Failed to delete lot:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to delete lot',
                    icon: 'error',
                    background: '#0f172a',
                    color: '#f1f5f9'
                });
            }
        }
    };

    const fetchLivePrice = async () => {
        if (!formData.provider_symbol) return;
        console.log('Frontend: Fetching price for', formData.provider_symbol, 'Type:', formData.investment_type);
        setFetchingPrice(true);
        try {
            const price = await execute('get_live_market_price', {
                symbol: formData.provider_symbol,
                invType: formData.investment_type
            });
            console.log('Frontend: Received price:', price);
            setFormData({ ...formData, current_price: price as number });
        } catch (error: any) {
            console.error('Failed to fetch live price:', error);
            const errorMsg = typeof error === 'string' ? error : (error.message || 'Check your internet or symbol');
            Swal.fire({
                title: 'Fetch Failed',
                text: errorMsg,
                icon: 'error',
                background: '#0f172a',
                color: '#f1f5f9'
            });
        } finally {
            setFetchingPrice(false);
        }
    };

    const calculateMaturity = () => {
        if (!formData.interest_rate) return;

        // Calculate months from tenure or maturity date
        let tenureMonths = formData.tenure_months || 12;
        if (formData.maturity_date) {
            const startDate = formData.opening_date ? new Date(formData.opening_date) : new Date();
            const endDate = new Date(formData.maturity_date);
            tenureMonths = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        }
        if (tenureMonths <= 0) return;

        let principal = formData.principal_amount || 0;
        if (formData.id && !principal) {
            const summary = summaries.find(s => s.investment.id === formData.id);
            principal = summary?.total_invested || 0;
        }

        const compounding = formData.compounding || 'quarterly';

        if (formData.investment_type === 'fd' && principal > 0) {
            const result = calculateFDMaturity(principal, formData.interest_rate, tenureMonths, compounding);
            setFormData(prev => ({ ...prev, maturity_amount: result.maturityAmount }));
        } else if (formData.investment_type === 'rd' && formData.monthly_deposit) {
            const result = calculateRDMaturity(formData.monthly_deposit, formData.interest_rate, tenureMonths, compounding === 'monthly' ? 'monthly' : 'quarterly');
            setFormData(prev => ({ ...prev, maturity_amount: result.maturityAmount }));
        } else if (formData.investment_type === 'ppf' && principal > 0) {
            const yearsCompleted = Math.floor(tenureMonths / 12);
            const result = calculatePPFBalance(principal, yearsCompleted, formData.interest_rate);
            setFormData(prev => ({ ...prev, maturity_amount: result.currentBalance }));
        }
    };

    // Fetch NPS NAV from API
    const handleFetchNPSNAV = async () => {
        if (!formData.provider_symbol) {
            Swal.fire('Error', 'Please select a fund manager and scheme type first', 'warning');
            return;
        }

        setFetchingPrice(true);
        try {
            const navData = await fetchNPSNAV(formData.provider_symbol);
            if (navData) {
                setFormData(prev => ({
                    ...prev,
                    current_price: navData.nav,
                    last_updated_at: navData.date
                }));
                Swal.fire('Success', `Current NAV: ₹${navData.nav} (as of ${navData.date})`, 'success');
            } else {
                Swal.fire('Error', 'Could not fetch NAV. Please try again later.', 'error');
            }
        } catch (error) {
            console.error('Failed to fetch NPS NAV:', error);
            Swal.fire('Error', 'Failed to fetch NAV', 'error');
        }
        setFetchingPrice(false);
    };

    useEffect(() => {
        if (showForm && (formData.investment_type === 'fd' || formData.investment_type === 'rd' || formData.investment_type === 'ppf')) {
            calculateMaturity();
        }
    }, [formData.interest_rate, formData.maturity_date, formData.monthly_deposit, formData.investment_type, formData.principal_amount, formData.tenure_months, formData.compounding, showForm]);

    const getChartData = () => {
        const dataSource = timeFilteredSummaries;
        if (filter === 'all') {
            const categories = dataSource.reduce((acc, s) => {
                const type = s.investment.investment_type;
                acc[type] = (acc[type] || 0) + s.current_valuation;
                return acc;
            }, {} as Record<string, number>);

            return Object.entries(categories).map(([name, value]) => ({
                name: name.toUpperCase(),
                value,
                originalName: name
            }));
        } else {
            return dataSource
                .filter(s => s.investment.investment_type === filter)
                .map(s => ({
                    name: s.investment.name,
                    value: s.current_valuation,
                    originalName: s.investment.name
                }))
                .sort((a, b) => b.value - a.value);
        }
    };

    const chartData = getChartData();
    const filteredSummaries = filter === 'all'
        ? timeFilteredSummaries
        : timeFilteredSummaries.filter(s => s.investment.investment_type === filter);

    const filteredPortfolio = filteredSummaries.reduce((sum, s) => sum + s.current_valuation, 0);
    const filteredInvested = filteredSummaries.reduce((sum, s) => sum + s.total_invested, 0);
    const filteredGain = filteredPortfolio - filteredInvested;
    const filteredGainPercentage = filteredInvested > 0 ? (filteredGain / filteredInvested) * 100 : 0;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>Investment Portfolio</h1>
                <button
                    onClick={() => {
                        setFormData({ name: '', investment_type: 'stock', account_id: accounts[0]?.id || 0 });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Investment
                </button>
            </div>

            {(
                <>
                {/* Filter Bars */}
                <div className="space-y-3 mb-6">
                    {/* Asset Type Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {(['all', 'stock', 'mf', 'fd', 'rd', 'nps', 'ppf', 'pf'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === t
                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                }`}
                        >
                            {t.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Time Period Filter */}
                <div className="flex gap-2 items-center overflow-x-auto pb-2 scrollbar-hide">
                    {(['all', 'today', 'month', 'year'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTimePeriod(t)}
                            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${timePeriod === t
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                }`}
                        >
                            {t === 'all' ? 'ALL TIME' : t === 'today' ? 'TODAY' : t === 'month' ? 'THIS MONTH' : 'THIS YEAR'}
                        </button>
                    ))}

                    {timePeriod === 'year' && availableYears.length > 0 && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500 focus:outline-none focus:border-emerald-500"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Portfolio Summary & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={darkTheme.card + " p-6"}>
                            <div className="text-sm text-slate-400 mb-1">Portfolio Value</div>
                            <div className="text-2xl font-bold text-slate-100">{formatCurrency(filteredPortfolio)}</div>
                        </div>
                        <div className={darkTheme.card + " p-6"}>
                            <div className="text-sm text-slate-400 mb-1">Total Invested</div>
                            <div className="text-2xl font-bold text-slate-100">{formatCurrency(filteredInvested)}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={darkTheme.card + " p-6"}>
                            <div className="text-sm text-slate-400 mb-1">Returns</div>
                            <div className={`text-2xl font-bold ${filteredGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {filteredGain >= 0 ? '+' : ''}{formatCurrency(filteredGain)} ({filteredGainPercentage.toFixed(1)}%)
                            </div>
                        </div>
                        <div className={darkTheme.card + " p-6"}>
                            <div className="text-sm text-slate-400 mb-1">Platform Cash</div>
                            <div className="text-2xl font-bold text-blue-400">{formatCurrency(totalUnallocated)}</div>
                        </div>
                    </div>
                </div>

                <div className={darkTheme.card + " p-4 flex flex-col items-center justify-center min-h-[300px]"}>
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 self-start">
                        {filter === 'all' ? 'Allocation by Category' : `Allocation: ${filter.toUpperCase()}`}
                    </h3>
                    {chartData.length > 0 ? (
                        <div className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
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
                                                        <div className="text-xl font-mono text-slate-100">
                                                            {formatCurrency(Number(entry.value))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-slate-600 italic text-sm">No data for chart</div>
                    )}
                </div>
            </div>

            {loading && <div className={darkTheme.loading}>Loading portfolio...</div>}

            <div className="space-y-8">
                {/* Platform Wallets Section */}
                <section>
                    <h2 className={darkTheme.subtitle + " mb-4 flex items-center gap-2"}>
                        <span>💳</span> Investment Platforms / Wallets
                    </h2>
                    <div className="flex flex-wrap gap-4">
                        {platformBalances.map((plat) => (
                            <div key={plat.account_id} className={darkTheme.card + " px-4 py-3 flex items-center gap-4 min-w-[200px]"}>
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 text-xl">🏦</div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase font-semibold">{plat.name}</div>
                                    <div className="text-lg font-bold text-slate-100">{formatCurrency(plat.balance)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                {/* Stocks & MFs Section */}
                {(filter === 'all' || filter === 'stock' || filter === 'mf') && (
                    <section>
                        <h2 className={darkTheme.subtitle + " mb-4 flex items-center gap-2"}>
                            <span>📈</span> Stocks & Mutual Funds
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredSummaries
                                .filter(s => ['stock', 'mf'].includes(s.investment.investment_type))
                                .map((s) => (
                                    <div key={s.investment.id} className={darkTheme.card + " overflow-hidden"}>
                                        <div
                                            className="p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                                            onClick={() => openLotsModal(s)}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                                                        {s.investment.name}
                                                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                                                            📋 View Lots
                                                        </span>
                                                    </h3>
                                                    <div className="text-xs text-slate-400 uppercase tracking-wider">
                                                        {s.investment.investment_type} • {s.account_name} • <span className="text-blue-400/80">{formatRelativeTime(s.investment.last_updated_at)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAddLot(s.investment.id!, s.investment.investment_type)} className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 bg-blue-400/10 rounded">+ Add</button>
                                                    <button onClick={() => handleEdit(s.investment)} className="text-slate-400 hover:text-white">✏️</button>
                                                    <button onClick={() => handleDelete(s.investment.id!)} className="text-slate-400 hover:text-red-400">🗑️</button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 border-t border-slate-700/50 pt-3">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase">Total Value</div>
                                                    <div className="text-sm font-medium text-slate-100">{formatCurrency(s.current_valuation)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase">Avg Price</div>
                                                    <div className="text-sm font-medium text-slate-300">{formatUnits(s.avg_buy_price)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-slate-500 uppercase">Returns</div>
                                                    <div className={`text-sm font-bold ${s.net_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {s.gain_percentage.toFixed(1)}% ({s.net_gain >= 0 ? '+' : ''}{formatCurrency(s.net_gain)})
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </section>
                )}

                {/* FD & RD Section */}
                {(filter === 'all' || filter === 'fd' || filter === 'rd') && (
                    <section>
                        <h2 className={darkTheme.subtitle + " mb-4 flex items-center gap-2"}>
                            <span>🏦</span> Fixed Income (FD & RD)
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredSummaries
                                .filter(s => ['fd', 'rd'].includes(s.investment.investment_type))
                                .map((s) => (
                                    <div key={s.investment.id} className={darkTheme.card + " p-4"}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-slate-100 text-lg">{s.investment.name}</h3>
                                                <div className="text-xs text-slate-400 uppercase tracking-wider">
                                                    {s.investment.investment_type} • {s.account_name} • <span className="text-blue-400/80">{formatRelativeTime(s.investment.last_updated_at)}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAddLot(s.investment.id!, s.investment.investment_type)} className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 bg-blue-400/10 rounded">+ Add</button>
                                                <button onClick={() => handleEdit(s.investment)} className="text-slate-400 hover:text-white">✏️</button>
                                                <button onClick={() => handleDelete(s.investment.id!)} className="text-slate-400 hover:text-red-400">🗑️</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 border-t border-slate-700/50 pt-3">
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">Net Invested</div>
                                                <div className="text-sm font-medium text-slate-300">{formatCurrency(s.total_invested - s.total_expenses)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">Interest</div>
                                                <div className="text-sm font-medium text-slate-100">{s.investment.interest_rate}%</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase">Maturity</div>
                                                <div className="text-sm font-medium text-slate-300">
                                                    {s.investment.maturity_amount ? formatCurrency(s.investment.maturity_amount) : (s.investment.maturity_date || 'N/A')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <div className="text-[10px] text-slate-500 flex justify-between bg-slate-900/50 p-1.5 rounded">
                                                <span>Gross Capital:</span>
                                                <span className="text-slate-300">{formatCurrency(s.total_invested)}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex justify-between bg-slate-900/50 p-1.5 rounded">
                                                <span>Bank Charges:</span>
                                                <span className="text-red-400">{formatCurrency(s.total_expenses)}</span>
                                            </div>
                                        </div>

                                        {s.investment.investment_type === 'rd' && s.investment.monthly_deposit && (
                                            <div className="mt-2 text-[10px] text-blue-400 text-right">
                                                Monthly Deposit: {formatCurrency(s.investment.monthly_deposit)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </section>
                )}

                {/* NPS & PPF Retirement Section */}
                {(filter === 'all' || filter === 'nps' || filter === 'ppf' || filter === 'pf') && (
                    <section>
                        <h2 className={darkTheme.subtitle + " mb-4 flex items-center gap-2"}>
                            <span>🎯</span> Retirement (NPS, PPF, PF)
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredSummaries
                                .filter(s => ['nps', 'ppf', 'pf'].includes(s.investment.investment_type))
                                .map((s) => {
                                    // Calculate NPS value if NAV available
                                    const npsValue = s.investment.investment_type === 'nps' && s.total_units && s.investment.current_price
                                        ? calculateNPSValue(s.total_units, s.investment.current_price, s.total_invested)
                                        : null;

                                    // Calculate PPF estimated balance
                                    const ppfBalance = (s.investment.investment_type === 'ppf' || s.investment.investment_type === 'pf') && s.investment.opening_date
                                        ? calculatePPFBalance(
                                            s.total_invested,
                                            Math.floor((new Date().getTime() - new Date(s.investment.opening_date).getTime()) / (1000 * 60 * 60 * 24 * 365)),
                                            s.investment.interest_rate || 7.1
                                        )
                                        : null;

                                    const daysToMaturity = s.investment.maturity_date ? getDaysRemaining(s.investment.maturity_date) : null;

                                    return (
                                        <div key={s.investment.id} className={darkTheme.card + " p-4"}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-slate-100 text-lg">{s.investment.name}</h3>
                                                    <div className="text-xs text-slate-400 uppercase tracking-wider">
                                                        {s.investment.investment_type.toUpperCase()} • {s.account_name}
                                                        {s.investment.bank_name && ` • ${s.investment.bank_name}`}
                                                        {s.investment.last_updated_at && ` • `}
                                                        {s.investment.last_updated_at && <span className="text-blue-400/80">{formatRelativeTime(s.investment.last_updated_at)}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAddLot(s.investment.id!, s.investment.investment_type)} className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 bg-blue-400/10 rounded">+ Add</button>
                                                    <button onClick={() => handleEdit(s.investment)} className="text-slate-400 hover:text-white">✏️</button>
                                                    <button onClick={() => handleDelete(s.investment.id!)} className="text-slate-400 hover:text-red-400">🗑️</button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4 border-t border-slate-700/50 pt-3">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase">Total Invested</div>
                                                    <div className="text-sm font-medium text-slate-100">{formatCurrency(s.total_invested)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase">
                                                        {s.investment.investment_type === 'nps' ? 'Current Value' : 'Est. Balance'}
                                                    </div>
                                                    <div className="text-sm font-medium text-emerald-400">
                                                        {npsValue ? formatCurrency(npsValue.currentValue) :
                                                            ppfBalance ? formatCurrency(ppfBalance.currentBalance) :
                                                                formatCurrency(s.current_valuation)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-500 uppercase">
                                                        {s.investment.investment_type === 'nps' ? 'Returns' : 'Interest Earned'}
                                                    </div>
                                                    <div className={`text-sm font-medium ${(npsValue?.absoluteReturn || ppfBalance?.interestEarned || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                                                        }`}>
                                                        {npsValue ? `${formatCurrency(npsValue.absoluteReturn)} (${npsValue.percentageReturn.toFixed(1)}%)` :
                                                            ppfBalance ? formatCurrency(ppfBalance.interestEarned) :
                                                                '---'}
                                                    </div>
                                                </div>
                                            </div>

                                            {s.investment.investment_type === 'nps' && s.investment.current_price && (
                                                <div className="mt-2 flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">
                                                        NAV: {formatCurrency(s.investment.current_price)} • Units: {formatUnits(s.total_units)}
                                                    </span>
                                                    {s.investment.last_updated_at && (
                                                        <span className="text-slate-600">as of {s.investment.last_updated_at}</span>
                                                    )}
                                                </div>
                                            )}

                                            {s.investment.investment_type === 'ppf' && daysToMaturity !== null && (
                                                <div className="mt-2 text-xs text-blue-400">
                                                    {daysToMaturity > 0
                                                        ? `📅 ${Math.ceil(daysToMaturity / 365)} years remaining (${daysToMaturity} days)`
                                                        : '✅ Matured'}
                                                </div>
                                            )}

                                            {s.investment.monthly_deposit && (
                                                <div className="mt-2 text-[10px] text-blue-400 text-right">
                                                    Monthly SIP: {formatCurrency(s.investment.monthly_deposit)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            {filteredSummaries.filter(s => ['nps', 'ppf', 'pf'].includes(s.investment.investment_type)).length === 0 && (
                                <div className="text-slate-500 text-sm italic col-span-2">
                                    No NPS/PPF/PF investments. Add one using the "Add Investment" button.
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
            </>
            )}

            {/* Investment Form Modal */}
            {
                showForm && (
                    <div className={darkTheme.modalOverlay}>
                        <div className={darkTheme.modalContentLarge}>
                            <h2 className={darkTheme.modalTitle}>
                                {formData.id ? 'Edit Investment' : 'Add Investment'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={darkTheme.label}>Name *</label>
                                        <input
                                            type="text" required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className={darkTheme.input}
                                            placeholder="e.g., Nifty 50 Index Fund"
                                        />
                                    </div>
                                    <div>
                                        <label className={darkTheme.label}>Type *</label>
                                        <select
                                            value={formData.investment_type}
                                            onChange={(e) => setFormData({ ...formData, investment_type: e.target.value as any })}
                                            className={darkTheme.select}
                                        >
                                            <option value="stock">Stock</option>
                                            <option value="mf">Mutual Fund</option>
                                            <option value="fd">Fixed Deposit</option>
                                            <option value="rd">Recurring Deposit</option>
                                            <option value="nps">NPS (National Pension)</option>
                                            <option value="ppf">PPF (Public Provident Fund)</option>
                                            <option value="pf">PF (Provident Fund)</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={darkTheme.label}>Platform / Account *</label>
                                    <select
                                        required
                                        value={formData.account_id}
                                        onChange={(e) => setFormData({ ...formData, account_id: parseInt(e.target.value) })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">Select Platform</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {(formData.investment_type === 'stock' || formData.investment_type === 'mf') && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={darkTheme.label}>Market Symbol</label>
                                                <input
                                                    type="text"
                                                    value={formData.provider_symbol || ''}
                                                    onChange={(e) => setFormData({ ...formData, provider_symbol: e.target.value })}
                                                    className={darkTheme.input}
                                                    placeholder={formData.investment_type === 'stock' ? 'e.g. RELIANCE.NS or RELIANCE.BO' : 'e.g. 120505'}
                                                />
                                            </div>
                                            <div>
                                                <label className={darkTheme.label}>Current Market Price</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number" step="0.000001"
                                                        value={formData.current_price || ''}
                                                        onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) })}
                                                        className={darkTheme.input + " flex-1"}
                                                        placeholder="Price per unit"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={fetchLivePrice}
                                                        className="px-3 bg-slate-800 rounded text-green-400 hover:bg-slate-700"
                                                        disabled={fetchingPrice || !formData.provider_symbol}
                                                        title="Fetch Live Price"
                                                    >
                                                        {fetchingPrice ? '...' : '⚡'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {formData.id && (
                                            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-xs text-blue-300">
                                                💡 Units and Buy Price are managed via <b>Lots</b> in the main view.
                                            </div>
                                        )}
                                    </>
                                )}

                                {(formData.investment_type === 'fd' || formData.investment_type === 'rd') && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={darkTheme.label}>Interest (%)</label>
                                                <input
                                                    type="number" step="0.000001"
                                                    value={formData.interest_rate || ''}
                                                    onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                                                    className={darkTheme.input}
                                                    placeholder="e.g. 7.5"
                                                />
                                            </div>
                                            <div>
                                                <label className={darkTheme.label}>Maturity Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.maturity_date || ''}
                                                    onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
                                                    className={darkTheme.input}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={darkTheme.label}>Maturity Amount</label>
                                                <input
                                                    type="number" step="0.000001"
                                                    value={formData.maturity_amount || ''}
                                                    onChange={(e) => setFormData({ ...formData, maturity_amount: parseFloat(e.target.value) })}
                                                    className={darkTheme.input}
                                                    placeholder="Expected at end"
                                                />
                                            </div>
                                            <div>
                                                <label className={darkTheme.label}>Current Value (Override)</label>
                                                <input
                                                    type="number" step="0.000001"
                                                    value={formData.current_price || ''}
                                                    onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) })}
                                                    className={darkTheme.input}
                                                    placeholder="Optional market value"
                                                />
                                            </div>
                                        </div>
                                        {formData.investment_type === 'rd' && (
                                            <div>
                                                <label className={darkTheme.label}>Monthly Deposit</label>
                                                <input
                                                    type="number" step="0.01"
                                                    value={formData.monthly_deposit || ''}
                                                    onChange={(e) => setFormData({ ...formData, monthly_deposit: parseFloat(e.target.value) })}
                                                    className={darkTheme.input}
                                                    placeholder="Recurring amount"
                                                />
                                            </div>
                                        )}

                                        {formData.id && (
                                            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-xs text-blue-300">
                                                💡 Principal investments are managed via <b>Lots</b>.
                                            </div>
                                        )}
                                    </>
                                )}

                                {(formData.investment_type === 'nps' || formData.investment_type === 'ppf' || formData.investment_type === 'pf') && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={darkTheme.label}>
                                                    {formData.investment_type === 'nps' ? 'Fund Manager' : 'Employer / Bank'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.bank_name || ''}
                                                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                                    className={darkTheme.input}
                                                    placeholder={formData.investment_type === 'nps' ? 'e.g., SBI, HDFC' : 'e.g., TCS, Post Office'}
                                                />
                                            </div>
                                            <div>
                                                <label className={darkTheme.label}>Interest Rate (%)</label>
                                                <input
                                                    type="number" step="0.01"
                                                    value={formData.interest_rate || ((formData.investment_type === 'ppf' || formData.investment_type === 'pf') ? 7.1 : '')}
                                                    onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                                                    className={darkTheme.input}
                                                    placeholder={(formData.investment_type === 'ppf' || formData.investment_type === 'pf') ? '7.1' : '---'}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={darkTheme.label}>Opening Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.opening_date || ''}
                                                    onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                                                    className={darkTheme.input}
                                                />
                                            </div>
                                            <div>
                                                <label className={darkTheme.label}>Maturity Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.maturity_date || ''}
                                                    onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
                                                    className={darkTheme.input}
                                                />
                                            </div>
                                        </div>

                                        {formData.investment_type === 'nps' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={darkTheme.label}>Scheme ID (for NAV)</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={formData.provider_symbol || ''}
                                                            onChange={(e) => setFormData({ ...formData, provider_symbol: e.target.value })}
                                                            className={darkTheme.input + " flex-1"}
                                                            placeholder="e.g., SM001001"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleFetchNPSNAV}
                                                            className="px-3 bg-emerald-800 rounded text-emerald-300 hover:bg-emerald-700 text-sm"
                                                            disabled={fetchingPrice || !formData.provider_symbol}
                                                            title="Fetch NPS NAV"
                                                        >
                                                            {fetchingPrice ? '...' : '📡 NAV'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={darkTheme.label}>Current NAV</label>
                                                    <input
                                                        type="number" step="0.0001"
                                                        value={formData.current_price || ''}
                                                        onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) })}
                                                        className={darkTheme.input}
                                                        placeholder="₹xx.xxxx"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {formData.id && (
                                            <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-800/50 rounded-lg text-xs text-emerald-300">
                                                💡 Contributions are managed via <b>Lots</b>. Use "+ Add" button on the card to record deposits.
                                            </div>
                                        )}
                                    </>
                                )}

                                <div>
                                    <label className={darkTheme.label}>Notes</label>
                                    <textarea
                                        value={formData.notes || ''}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className={darkTheme.textarea}
                                        rows={2}
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>Cancel</button>
                                    <button type="submit" className={darkTheme.btnPrimary}>{formData.id ? 'Update' : 'Create'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {
                showLotForm && (
                    <div className={darkTheme.modalOverlayTop}>
                        <div className={darkTheme.modalContent}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className={darkTheme.modalTitle}>Record Buy / Lot</h2>
                                <button onClick={() => setShowLotForm(false)} className="text-slate-400 hover:text-white">✕</button>
                            </div>
                            <form onSubmit={handleLotSubmit} className="space-y-4">
                                {(() => {
                                    const inv = summaries.find(s => s.investment.id === lotFormData.investment_id)?.investment;
                                    const isMarket = inv?.investment_type === 'stock' || inv?.investment_type === 'mf';
                                    
                                    // Make variables available by expanding the scope or returning the whole form
                                    return (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={darkTheme.label}>{isMarket ? 'Quantity *' : 'Quantity / Multiplier *'}</label>
                                                    <input
                                                        type="number" step="0.000001" required
                                                        value={lotFormData.quantity ? Number(lotFormData.quantity.toFixed(4)) : ''}
                                                        onChange={(e) => setLotFormData({ ...lotFormData, quantity: parseFloat(e.target.value) })}
                                                        className={darkTheme.input}
                                                        placeholder={isMarket ? "Units bought" : "Default 1"}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={darkTheme.label}>{isMarket ? 'Price per Unit *' : 'Principal Amount *'}</label>
                                                    <input
                                                        type="number" step="0.000001" required
                                                        value={lotFormData.price_per_unit ? Number(lotFormData.price_per_unit.toFixed(4)) : ''}
                                                        onChange={(e) => setLotFormData({ ...lotFormData, price_per_unit: parseFloat(e.target.value) })}
                                                        className={darkTheme.input}
                                                        placeholder={isMarket ? "Cost per share" : "Invested amount"}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={darkTheme.label}>{isMarket ? 'Total Amount Paid (Bank)' : 'Total Principal Paid'}</label>
                                                    <input
                                                        type="number" step="0.01"
                                                        value={bankAmount}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setBankAmount(val);
                                                            const total = parseFloat(val) || 0;
                                                            const subtotal = (lotFormData.quantity || 0) * (lotFormData.price_per_unit || 0);
                                                            const calculatedCharges = Math.max(0, total - subtotal);
                                                setLotFormData({ ...lotFormData, charges: parseFloat(calculatedCharges.toFixed(4)) });
                                                        }}
                                                        className={darkTheme.input + " border-blue-500/30"}
                                                        placeholder="Total debited from bank"
                                                    />
                                                </div>
                                                <div>
                                                    <label className={darkTheme.label}>Charges (Auto-calculated)</label>
                                                    <input
                                                        type="number" step="0.000001"
                                                        value={lotFormData.charges ? Number(lotFormData.charges.toFixed(4)) : ''}
                                                        onChange={(e) => setLotFormData({ ...lotFormData, charges: parseFloat(e.target.value) })}
                                                        className={darkTheme.input + " bg-slate-800/50"}
                                                        placeholder="Brokerage/Tax"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}



                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={darkTheme.label}>Date</label>
                                        <input
                                            type="date" required
                                            value={lotFormData.date.split(' ')[0]}
                                            onChange={(e) => setLotFormData({ ...lotFormData, date: e.target.value })}
                                            className={darkTheme.input}
                                        />
                                    </div>
                                    <div>
                                        <label className={darkTheme.label}>Lot Type</label>
                                        <select
                                            value={lotFormData.lot_type}
                                            onChange={(e) => setLotFormData({ ...lotFormData, lot_type: e.target.value as 'buy' | 'sell' })}
                                            className={darkTheme.input}
                                        >
                                            <option value="buy">Buy / Deposit</option>
                                            <option value="sell">Sell / Withdrawal</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-slate-800/30 p-3 rounded text-xs text-slate-400">
                                    <div className="flex justify-between mb-1">
                                        <span>Subtotal (Qty * Price):</span>
                                        <span>{formatCurrency((lotFormData.quantity || 0) * (lotFormData.price_per_unit || 0))}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-slate-200">
                                        <span>Total Investment Value:</span>
                                        <span>{formatCurrency((lotFormData.quantity || 0) * (lotFormData.price_per_unit || 0) + (lotFormData.charges || 0))}</span>
                                    </div>
                                    <p className="mt-2 text-[10px] text-slate-500 italic">
                                        * Enter Quantity and Price first, then the Total Bank Amount to auto-calculate charges.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <button type="button" onClick={() => {
                                        setShowLotForm(false);
                                        setEditingLotId(null);
                                    }} className={darkTheme.btnCancel}>Cancel</button>
                                    <button type="submit" className={darkTheme.btnPrimary}>{editingLotId ? 'Update Lot' : 'Record Lot'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* View Lots Modal */}
            {showViewLots && viewLotsSummary && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge}>
                        <h2 className={darkTheme.modalTitle}>
                            Investment Lots - {viewLotsSummary.investment.name}
                        </h2>

                        <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500">Current Price:</span>
                                    <span className="ml-2 text-slate-200 font-mono">{formatUnits(viewLotsSummary.investment.current_price || 0)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Total Units:</span>
                                    <span className="ml-2 text-slate-200 font-mono">{formatUnits(viewLotsSummary.total_units)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Avg Buy Price:</span>
                                    <span className="ml-2 text-slate-200 font-mono">{formatUnits(viewLotsSummary.avg_buy_price)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            {viewLotsSummary.lots.length > 0 ? (
                                <table className="w-full text-sm text-left text-slate-300">
                                    <thead className="text-slate-500 uppercase text-xs border-b border-slate-700 sticky top-0 bg-slate-900">
                                        <tr>
                                            <th className="py-3 px-2">Date</th>
                                            <th className="py-3 px-2 text-right">Quantity</th>
                                            <th className="py-3 px-2 text-right">Price/Unit</th>
                                            <th className="py-3 px-2 text-right">Charges</th>
                                            <th className="py-3 px-2 text-right">Gain/Loss</th>
                                            <th className="py-3 px-2 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewLotsSummary.lots.map(lot => {
                                            const lotCost = lot.quantity * lot.price_per_unit + lot.charges;
                                            const lotValue = lot.quantity * (viewLotsSummary.investment.current_price || 0);
                                            const lotGain = lotValue - lotCost;
                                            return (
                                                <tr key={lot.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                    <td className="py-3 px-2 font-mono text-blue-400">{lot.date.split(' ')[0]}</td>
                                                    <td className="py-3 px-2 text-right font-medium font-mono">{formatUnits(lot.quantity)}</td>
                                                    <td className="py-3 px-2 text-right font-mono">{formatUnits(lot.price_per_unit)}</td>
                                                    <td className="py-3 px-2 text-right text-slate-500">{formatCurrency(lot.charges)}</td>
                                                    <td className={`py-3 px-2 text-right font-bold ${lotGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {lotGain >= 0 ? '+' : ''}{formatCurrency(lotGain)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right">
                                                        <button
                                                            onClick={() => handleEditLot(lot)}
                                                            className="text-slate-600 hover:text-blue-400 text-lg mr-3"
                                                            title="Edit Lot"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteLot(lot.id!)}
                                                            className="text-slate-600 hover:text-red-400 text-lg"
                                                            title="Delete Lot"
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 italic mb-2">No lots recorded yet.</p>
                                    <p className="text-xs text-slate-600">Click "+ Buy" to add your first lot.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowViewLots(false)}
                                className={darkTheme.btnCancel}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
