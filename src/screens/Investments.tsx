import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Investment, InvestmentSummary, Account, PlatformBalance, InvestmentLot } from '../types';
import { formatCurrency, formatUnits } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Swal from 'sweetalert2';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

export default function Investments() {
    const { execute } = useDatabase();
    const [summaries, setSummaries] = useState<InvestmentSummary[]>([]);
    const [allInvestmentAccounts, setAllInvestmentAccounts] = useState<Account[]>([]);
    const [platformBalances, setPlatformBalances] = useState<PlatformBalance[]>([]);
    
    const initialFormData: Investment = {
        name: '',
        investment_type: 'stock',
        account_id: 0,
        principal_amount: undefined,
        interest_rate: undefined,
        opening_date: new Date().toISOString().split('T')[0],
        tenure_months: undefined,
        compounding: 'quarterly',
        monthly_deposit: undefined,
    };
    
    const [activeTab, setActiveTab] = useState<'dashboard' | 'holdings' | 'settings'>('dashboard');
    const [filter, setFilter] = useState<'all' | 'stock' | 'mf' | 'fd' | 'rd'>('all');
    const [timePeriod, setTimePeriod] = useState<'all' | 'today' | 'month' | 'year'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isSyncing, setIsSyncing] = useState(false);
    const [chartViewMode, setChartViewMode] = useState<'category' | 'individual'>('category');
    const [allocViewMode, setAllocViewMode] = useState<'heatmap' | 'rebalancer' | 'donut'>('heatmap');

    // Form states
    const [showForm, setShowForm] = useState(false);
    const [fetchingPrice, setFetchingPrice] = useState(false);
    const [formData, setFormData] = useState<Investment>(initialFormData);

    // Lot states
    const [showLotForm, setShowLotForm] = useState(false);
    const [editingLotId, setEditingLotId] = useState<number | null>(null);
    const [lotFormData, setLotFormData] = useState<InvestmentLot>({
        investment_id: 0,
        quantity: 0,
        price_per_unit: 0,
        charges: 0,
        date: new Date().toISOString().split('T')[0],
        lot_type: 'buy'
    });

    const [showViewLots, setShowViewLots] = useState(false);
    const [viewLotsSummary, setViewLotsSummary] = useState<InvestmentSummary | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await execute('update_fixed_income_daily');
                await execute('sync_investment_prices', { force: false });
                loadData();
            } catch (err) {
                console.error("Initialization error:", err);
            }
        };
        init();
    }, []);

    const loadData = async () => {
        try {
            const [sumData, accData, platData] = await Promise.all([
                execute<InvestmentSummary[]>('get_investments_summary'),
                execute<Account[]>('get_accounts'),
                execute<PlatformBalance[]>('get_investment_platform_summary'),
            ]);
            
            setAllInvestmentAccounts(accData.filter(a => a.account_type === 'investment'));
            setSummaries(sumData.filter(s => ['stock', 'mf', 'fd', 'rd'].includes(s.investment.investment_type)));
            setPlatformBalances(platData);
        } catch (error) {
            console.error('Failed to load investment data:', error);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await Promise.all([
                execute('sync_investment_prices', { force: true }),
                execute('update_fixed_income_daily')
            ]);
            await loadData();
            Swal.fire({
                title: 'Success',
                text: 'Portfolio synced successfully!',
                icon: 'success',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
                background: '#0f172a',
                color: '#f1f5f9'
            });
        } catch (error) {
            console.error('Sync failed:', error);
            Swal.fire('Error', 'Sync failed', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleToggleAccount = async (account: Account) => {
        try {
            await execute('update_account', { 
                account: { 
                    ...account, 
                    is_investment_active: !account.is_investment_active 
                } 
            });
            await loadData();
        } catch (error) {
            console.error('Failed to toggle account:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let invId = formData.id;
            const isNew = !invId;
            const type = formData.investment_type;

            if (formData.id) {
                await execute('update_investment', { investment: formData });
            } else {
                invId = await execute('create_investment', { investment: formData }) as number;
            }
            
            // Recalculate interest immediately for FD/RD
            if (type === 'fd' || type === 'rd') {
                await execute('update_fixed_income_daily');
            }
            
            setShowForm(false);
            setFormData(initialFormData);
            await loadData();

            if (isNew && invId) {
                handleAddLot(invId, type, formData.opening_date);
            }
        } catch (error) {
            console.error('Failed to save investment:', error);
        }
    };

    const handleEdit = (inv: Investment) => {
        setFormData({ 
            ...inv,
            opening_date: inv.opening_date || new Date().toISOString().split('T')[0],
            compounding: inv.compounding || 'quarterly'
        });
        setShowForm(true);
    };

    const openLotsModal = (summary: InvestmentSummary) => {
        setFormData({ ...summary.investment }); // Sync formData to the current investment
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
            } catch (error) {
                console.error('Delete failed:', error);
            }
        }
    };

    const handleAddLot = (invId: number, type?: string, prefDate?: string) => {
        setLotFormData({
            investment_id: invId,
            quantity: type === 'fd' || type === 'rd' ? 1 : 0,
            price_per_unit: 0,
            charges: 0,
            date: prefDate || formData.opening_date || new Date().toISOString().split('T')[0],
            lot_type: 'buy'
        });
        setEditingLotId(null);
        setShowLotForm(true);
    };

    const handleEditLot = (lot: InvestmentLot) => {
        setLotFormData({ ...lot });
        setEditingLotId(lot.id!);
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
            const [sumData] = await Promise.all([
                execute<InvestmentSummary[]>('get_investments_summary'),
                loadData()
            ]);
            
            // Refresh the current view lots modal data
            if (viewLotsSummary) {
                const updated = sumData.find(s => s.investment.id === viewLotsSummary.investment.id);
                if (updated) setViewLotsSummary(updated);
            }
            
            setShowLotForm(false);
            setEditingLotId(null);
        } catch (error) {
            console.error('Lot submit failed:', error);
        }
    };

    const handleDeleteLot = async (lotId: number) => {
        const result = await Swal.fire({
            title: 'Delete this lot?',
            text: "This transaction will be removed from your holdings.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Yes, delete',
            background: '#0f172a',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_investment_lot', { id: lotId });
                const [sumData] = await Promise.all([
                    execute<InvestmentSummary[]>('get_investments_summary'),
                    loadData()
                ]);

                if (viewLotsSummary) {
                    const updated = sumData.find(s => s.investment.id === viewLotsSummary.investment.id);
                    if (updated) setViewLotsSummary(updated);
                }
            } catch (error) {
                console.error('Lot delete failed:', error);
            }
        }
    };

    const fetchPrice = async () => {
        if (!formData.provider_symbol) return;
        setFetchingPrice(true);
        try {
            const price = await execute('get_live_market_price', {
                symbol: formData.provider_symbol,
                invType: formData.investment_type
            });
            setFormData(prev => ({ ...prev, current_price: price as number }));
        } catch (error) {
            console.error('Price fetch failed:', error);
        } finally {
            setFetchingPrice(false);
        }
    };

    // Filtering logic
    const getDateRange = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        switch (timePeriod) {
            case 'today': return { start, end: now };
            case 'month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
            case 'year': return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31) };
            default: return null;
        }
    };

    const isLotInPeriod = (date: string) => {
        if (timePeriod === 'all') return true;
        const range = getDateRange();
        if (!range) return true;
        const d = new Date(date);
        return d >= range.start && d <= range.end;
    };

    const timeFilteredSummaries = summaries.map(s => {
        if (timePeriod === 'all') return s;
        const filteredLots = s.lots.filter(l => isLotInPeriod(l.date));
        if (filteredLots.length === 0) return null;
        
        const totalInvested = filteredLots.reduce((acc, l) => acc + (l.quantity * l.price_per_unit + l.charges), 0);
        const totalUnits = filteredLots.reduce((acc, l) => acc + l.quantity, 0);
        const valuation = totalUnits * (s.investment.current_price || 0);
        
        return { 
            ...s, 
            lots: filteredLots, 
            total_invested: totalInvested, 
            total_units: totalUnits, 
            current_valuation: valuation,
            net_gain: valuation - totalInvested,
            gain_percentage: totalInvested > 0 ? ((valuation - totalInvested) / totalInvested) * 100 : 0
        };
    }).filter(s => s !== null) as InvestmentSummary[];

    const activeFilteredSummaries = filter === 'all' 
        ? timeFilteredSummaries 
        : timeFilteredSummaries.filter(s => s.investment.investment_type === filter);

    const totalPortfolio = activeFilteredSummaries.reduce((acc, s) => acc + s.current_valuation, 0);
    const totalInvested = activeFilteredSummaries.reduce((acc, s) => acc + s.total_invested, 0);
    const totalGain = totalPortfolio - totalInvested;
    const gainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    const allocationData = chartViewMode === 'category' 
        ? Object.entries(activeFilteredSummaries.reduce((acc, s) => {
            acc[s.investment.investment_type] = (acc[s.investment.investment_type] || 0) + s.current_valuation;
            return acc;
          }, {} as Record<string, number>)).map(([name, value]) => ({ name: name.toUpperCase(), value }))
        : activeFilteredSummaries.map(s => ({ name: s.investment.name, value: s.current_valuation }));

    const performanceData = activeFilteredSummaries.map(s => ({
        name: s.investment.name,
        invested: s.total_invested,
        current: s.current_valuation
    })).sort((a, b) => b.current - a.current).slice(0, 10);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Investment Portfolio</h1>
                    <p className="text-slate-400 text-sm">Manage your wealth across platforms</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleSync} disabled={isSyncing} className={`${darkTheme.btnSecondary} flex items-center gap-2 ${isSyncing ? 'animate-pulse' : ''}`}>
                        {isSyncing ? '⌛ Syncing...' : '🔄 Sync Prices'}
                    </button>
                    <button 
                        onClick={() => {
                            setFormData(initialFormData);
                            setShowForm(true);
                        }} 
                        className={darkTheme.btnPrimary}
                    >
                        + Add Investment
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="inline-flex p-1 bg-slate-800/40 rounded-2xl border border-slate-700/30 backdrop-blur-sm gap-1">
                    {(['dashboard', 'holdings', 'settings'] as const).map(tab => {
                        const isActive = activeTab === tab;
                        const config = {
                            dashboard: { label: 'Dashboard', icon: '📊' },
                            holdings: { label: 'Holdings', icon: '🔢' },
                            settings: { label: 'Settings', icon: '⚙️' }
                        }[tab];

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    flex items-center gap-2.5 px-6 py-2 rounded-xl text-sm font-bold transition-all duration-500 relative
                                    ${isActive 
                                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] ring-1 ring-white/10' 
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'}
                                `}
                            >
                                <span className={isActive ? 'scale-110' : 'opacity-60 grayscale'}>{config.icon}</span>
                                <span className={isActive ? 'tracking-wide' : ''}>{config.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Global Filters */}
                {activeTab !== 'settings' && (
                    <div className="flex flex-wrap justify-center gap-3 bg-slate-800/20 p-2 rounded-2xl border border-slate-700/30">
                        <div className="flex gap-1">
                            {(['all', 'stock', 'mf', 'fd', 'rd'] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all ${filter === f ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-700/50'}`}>
                                    {f.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div className="h-6 w-[1px] bg-slate-700 mx-1 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                            <select value={timePeriod} onChange={(e) => setTimePeriod(e.target.value as any)} className="bg-transparent text-slate-200 text-xs font-bold px-2 py-1 cursor-pointer outline-none">
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="month">This Month</option>
                                <option value="year">Specific Year</option>
                            </select>
                            {timePeriod === 'year' && (
                                <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-16 bg-slate-700/50 text-white text-xs px-2 py-1 rounded border-none font-bold" />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className={`${darkTheme.card} p-4`}>
                            <p className="text-slate-400 text-xs mb-1">Total Valuation</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(totalPortfolio)}</p>
                        </div>
                        <div className={`${darkTheme.card} p-4`}>
                            <p className="text-slate-400 text-xs mb-1">Total Invested</p>
                            <p className="text-2xl font-bold text-slate-200">{formatCurrency(totalInvested)}</p>
                        </div>
                        <div className={`${darkTheme.card} p-4`}>
                            <p className="text-slate-400 text-xs mb-1">Total Gain/Loss</p>
                            <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
                            </p>
                        </div>
                        <div className={`${darkTheme.card} p-4`}>
                            <p className="text-slate-400 text-xs mb-1">Overall Return</p>
                            <p className={`text-2xl font-bold ${gainPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {gainPercent.toFixed(2)}%
                            </p>
                        </div>
                    </div>

                    {/* Platform Balance Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {platformBalances.map(p => (
                            <div key={p.name} className={`${darkTheme.card} p-4 border border-slate-700/30 bg-gradient-to-br from-slate-800/50 to-slate-900/50`}>
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">{p.name}</div>
                                <div className="text-xl font-bold text-white">{formatCurrency(p.balance)}</div>
                                <div className="mt-2 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500" style={{ width: p.balance > 0 ? '100%' : '0' }}></div>
                                </div>
                            </div>
                        ))}
                        {platformBalances.length === 0 && <div className={`${darkTheme.card} p-4 text-slate-500 italic text-sm`}>No active accounts.</div>}
                    </div>

                    {/* Upgraded Asset Allocation Section */}
                    <div className={`${darkTheme.card} p-6`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                    <span>Asset Allocation & Portfolio Matrix</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono">
                                        Total: {formatCurrency(totalPortfolio)}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Real-time wealth distribution, portfolio weightings & smart rebalancing</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/60">
                                    {[
                                        { id: 'heatmap', label: '🧱 Heatmap Matrix' },
                                        { id: 'rebalancer', label: '⚖️ Smart Rebalancer' },
                                        { id: 'donut', label: '🍩 Donut Chart' },
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setAllocViewMode(m.id as any)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                                allocViewMode === m.id
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                {allocViewMode === 'donut' && (
                                    <select 
                                        value={chartViewMode} 
                                        onChange={(e) => setChartViewMode(e.target.value as any)}
                                        className="bg-slate-800 text-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-700 outline-none cursor-pointer hover:bg-slate-700/50 transition-colors"
                                    >
                                        <option value="category">BY CATEGORY</option>
                                        <option value="individual">BY INDIVIDUAL ASSET</option>
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* MODE 1: PROPORTIONAL HEATMAP MATRIX */}
                        {allocViewMode === 'heatmap' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {Object.entries(activeFilteredSummaries.reduce((acc, s) => {
                                        const type = s.investment.investment_type;
                                        if (!acc[type]) {
                                            acc[type] = {
                                                type,
                                                valuation: 0,
                                                invested: 0,
                                                count: 0,
                                                name: type === 'stock' ? 'Equity Stocks' : type === 'mf' ? 'Mutual Funds' : type === 'fd' ? 'Fixed Deposits' : type === 'rd' ? 'Recurring Deposits' : type.toUpperCase(),
                                                icon: type === 'stock' ? '📈' : type === 'mf' ? '🧺' : type === 'fd' ? '🔒' : type === 'rd' ? '⏱️' : '💼'
                                            };
                                        }
                                        acc[type].valuation += s.current_valuation;
                                        acc[type].invested += s.total_invested;
                                        acc[type].count += 1;
                                        return acc;
                                    }, {} as Record<string, { type: string; valuation: number; invested: number; count: number; name: string; icon: string }>))
                                    .map(([key, cat]) => {
                                        const share = totalPortfolio > 0 ? (cat.valuation / totalPortfolio) * 100 : 0;
                                        const gain = cat.valuation - cat.invested;
                                        const gainPc = cat.invested > 0 ? (gain / cat.invested) * 100 : 0;

                                        return (
                                            <div 
                                                key={key} 
                                                className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/70 hover:border-blue-500/40 transition-all flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xl">{cat.icon}</span>
                                                        <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                                                            {share.toFixed(1)}% share
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-100">{cat.name}</div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">{cat.count} holdings</div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-slate-800">
                                                    <div className="text-lg font-bold text-blue-400">{formatCurrency(cat.valuation)}</div>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-slate-500">Invested: {formatCurrency(cat.invested)}</span>
                                                        <span className={`text-[10px] font-bold ${gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {gain >= 0 ? '+' : ''}{gainPc.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    {/* Share Progress Bar */}
                                                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                                        <div 
                                                            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" 
                                                            style={{ width: `${Math.min(100, share)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Top Asset Allocation Cards */}
                                <div className="mt-6 pt-6 border-t border-slate-700/50">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Top Individual Holdings Share</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {activeFilteredSummaries.slice(0, 6).map((s) => {
                                            const share = totalPortfolio > 0 ? (s.current_valuation / totalPortfolio) * 100 : 0;
                                            return (
                                                <div key={s.investment.id} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex justify-between items-center">
                                                    <div className="min-w-0 flex-1 pr-2">
                                                        <div className="text-xs font-bold text-slate-200 truncate">{s.investment.name}</div>
                                                        <div className="text-[10px] text-slate-400">{s.account_name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-bold text-cyan-400">{formatCurrency(s.current_valuation)}</div>
                                                        <div className="text-[10px] font-semibold text-slate-400">{share.toFixed(1)}% of total</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODE 2: SMART PORTFOLIO REBALANCER */}
                        {allocViewMode === 'rebalancer' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Portfolio Health & Target Allocation</div>
                                        <div className="text-sm text-slate-300 mt-0.5">Automated rebalancing assistant based on 60/25/15 target risk matrix</div>
                                    </div>
                                    <span className="text-2xl">⚖️</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { 
                                            group: 'Equity & Growth', 
                                            types: ['stock', 'mf'], 
                                            targetPc: 70,
                                            icon: '🚀',
                                            desc: 'Stocks & Growth Mutual Funds' 
                                        },
                                        { 
                                            group: 'Fixed Income & Safety', 
                                            types: ['fd', 'rd'], 
                                            targetPc: 30,
                                            icon: '🔒',
                                            desc: 'FDs & Recurring Deposits' 
                                        },
                                    ].map((target) => {
                                        const actualVal = activeFilteredSummaries
                                            .filter(s => target.types.includes(s.investment.investment_type))
                                            .reduce((acc, s) => acc + s.current_valuation, 0);

                                        const actualPc = totalPortfolio > 0 ? (actualVal / totalPortfolio) * 100 : 0;
                                        const diffPc = actualPc - target.targetPc;
                                        const targetVal = (totalPortfolio * target.targetPc) / 100;
                                        const valDiff = actualVal - targetVal;

                                        const isOver = diffPc > 5;
                                        const isUnder = diffPc < -5;

                                        return (
                                            <div key={target.group} className="p-5 bg-slate-900/80 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xl">{target.icon}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            isOver ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                            isUnder ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        }`}>
                                                            {isOver ? `Overweight (+${diffPc.toFixed(1)}%)` :
                                                             isUnder ? `Underweight (${diffPc.toFixed(1)}%)` :
                                                             'Optimal Target ✅'}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-white">{target.group}</div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">{target.desc}</div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-slate-800">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="text-lg font-bold text-emerald-400">{formatCurrency(actualVal)}</span>
                                                        <span className="text-xs font-bold text-slate-300">{actualPc.toFixed(1)}% <span className="text-slate-500 font-normal">/ target {target.targetPc}%</span></span>
                                                    </div>

                                                    {/* Progress bar comparison */}
                                                    <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden relative">
                                                        <div 
                                                            className={`h-full rounded-full ${isOver ? 'bg-orange-400' : isUnder ? 'bg-blue-400' : 'bg-emerald-400'}`} 
                                                            style={{ width: `${Math.min(100, actualPc)}%` }}
                                                        />
                                                    </div>

                                                    <div className="text-[10px] text-slate-400 mt-2 font-medium">
                                                        {valDiff > 0 
                                                            ? `Rebalance: Consider shifting ${formatCurrency(Math.abs(valDiff))} into under-allocated assets.` 
                                                            : valDiff < 0 
                                                            ? `Rebalance: Add ${formatCurrency(Math.abs(valDiff))} to reach recommended weight.` 
                                                            : 'Perfect alignment with recommended portfolio strategy.'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* MODE 3: CLASSIC DONUT CHART */}
                        {allocViewMode === 'donut' && (
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={allocationData} 
                                            innerRadius={chartViewMode === 'category' ? 100 : 120} 
                                            outerRadius={chartViewMode === 'category' ? 140 : 160} 
                                            paddingAngle={5} 
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} 
                                            itemStyle={{ color: '#f1f5f9', fontWeight: 'bold', fontSize: '12px' }}
                                            labelStyle={{ display: 'none' }}
                                        />
                                        <Legend iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Performance Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className={`${darkTheme.card} p-6`}>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Asset Performance</h3>
                                <p className="text-xs text-slate-500 mb-6">Invested vs Current Valuation (Top 10)</p>
                            </div>
                            <div className="h-[380px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={performanceData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v/1000}k`} />
                                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: '#33415520' }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                            itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="invested" name="Invested" fill="#475569" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="current" name="Valuation" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Gainers & Losers Ranking */}
                        <div className={`${darkTheme.card} p-6`}>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Top Performers (% Return)</h3>
                                <p className="text-xs text-slate-500 mb-6">Holdings sorted by Return on Investment (%)</p>
                            </div>
                            <div className="h-[380px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={summaries
                                            .map(s => ({
                                                name: s.investment.name,
                                                return_pc: parseFloat((s.gain_percentage || 0).toFixed(2)),
                                                gain_pc: s.gain_percentage || 0
                                            }))
                                            .sort((a, b) => b.return_pc - a.return_pc)
                                            .slice(0, 8)
                                        }
                                        layout="vertical"
                                        margin={{ left: 20, right: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${v}%`} />
                                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                                        <Tooltip
                                            cursor={{ fill: '#33415520' }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                            formatter={(val: any) => [`${val}%`, 'Return %']}
                                        />
                                        <Bar dataKey="return_pc" name="Return %" radius={[0, 4, 4, 0]}>
                                            {summaries
                                                .map(s => s.gain_percentage || 0)
                                                .slice(0, 8)
                                                .map((gainPc, index) => (
                                                    <Cell key={`cell-${index}`} fill={gainPc >= 0 ? '#10b981' : '#f43f5e'} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'holdings' && (
                <div className="space-y-4">
                    <div className={`${darkTheme.card} overflow-hidden`}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-700">
                                    <th className="p-4">Investment</th>
                                    <th className="p-4 text-right">Units/Principal</th>
                                    <th className="p-4 text-right">Avg Buy/Interest</th>
                                    <th className="p-4 text-right">Current Value</th>
                                    <th className="p-4 text-right">Returns/Gain</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {activeFilteredSummaries.map(s => (
                                    <tr key={s.investment.id} className="hover:bg-slate-800/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-medium text-white">{s.investment.name}</div>
                                            <div className="text-[10px] text-slate-500 uppercase flex gap-2">
                                                <span>{s.investment.investment_type}</span>
                                                {s.investment.provider_symbol && <span>• {s.investment.provider_symbol}</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-xs">
                                            {s.investment.investment_type === 'stock' || s.investment.investment_type === 'mf' 
                                                ? formatUnits(s.total_units) 
                                                : formatCurrency(s.total_invested)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="text-white text-sm">{formatCurrency(s.investment.current_price || 0)}</div>
                                            <div className="text-[10px] text-slate-500">
                                                {(s.investment.investment_type === 'fd' || s.investment.investment_type === 'rd') 
                                                    ? `Rate: ${s.investment.interest_rate}%` 
                                                    : `Avg: ${formatCurrency(s.avg_buy_price)}`}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="text-white font-medium">{formatCurrency(s.current_valuation)}</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className={`text-sm font-medium ${s.net_gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatCurrency(s.net_gain)}
                                            </div>
                                            <div className={`text-[10px] ${s.gain_percentage >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                                {s.gain_percentage.toFixed(2)}%
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openLotsModal(s)} className="text-blue-400 hover:text-blue-300">📊</button>
                                                <button onClick={() => handleEdit(s.investment)} className="text-slate-400 hover:text-white">✏️</button>
                                                <button onClick={() => handleDelete(s.investment.id!)} className="text-slate-500 hover:text-rose-400">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {activeFilteredSummaries.length === 0 && (
                            <div className="p-12 text-center text-slate-500 italic">No investments found matching filters.</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className={`${darkTheme.card} p-6 max-w-2xl`}>
                    <h3 className="text-lg font-semibold mb-6 text-slate-200">Active Investment Platforms</h3>
                    <p className="text-slate-400 text-sm mb-6">Choose which accounts to include in your portfolio summary. Only accounts marked as "Investment" type are shown here.</p>
                    <div className="space-y-4">
                        {allInvestmentAccounts.map(acc => (
                            <div key={acc.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                                <div>
                                    <div className="font-medium text-white">{acc.name}</div>
                                    <div className="text-xs text-slate-500 capitalize">{acc.account_type} Account</div>
                                </div>
                                <button
                                    onClick={() => handleToggleAccount(acc)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${acc.is_investment_active ? 'bg-blue-600' : 'bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${acc.is_investment_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge}>
                        <h2 className={darkTheme.modalTitle}>{formData.id ? 'Edit Investment' : 'New Investment'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Name</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={darkTheme.input} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Type</label>
                                    <select value={formData.investment_type} onChange={e => setFormData({ ...formData, investment_type: e.target.value as any })} className={darkTheme.input}>
                                        <option value="stock">Stock</option>
                                        <option value="mf">Mutual Fund</option>
                                        <option value="fd">Fixed Deposit</option>
                                        <option value="rd">Recurring Deposit</option>
                                    </select>
                                </div>
                            </div>

                            {/* Symbol field only for stocks/mf */}
                            {(formData.investment_type === 'stock' || formData.investment_type === 'mf') && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Platform/Account</label>
                                        <select required value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: parseInt(e.target.value) })} className={darkTheme.input}>
                                            <option value={0}>Select Platform</option>
                                            {allInvestmentAccounts.filter(a => a.is_investment_active).map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Symbol/Code (Optional)</label>
                                        <div className="flex gap-2">
                                            <input value={formData.provider_symbol || ''} onChange={e => setFormData({ ...formData, provider_symbol: e.target.value })} className={darkTheme.input} placeholder="RELIANCE.NS" />
                                            <button type="button" onClick={fetchPrice} disabled={fetchingPrice} className="px-3 bg-slate-700 hover:bg-slate-600 rounded text-xs">
                                                {fetchingPrice ? '...' : '🔍'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Platform only for FD/RD */}
                            {(formData.investment_type === 'fd' || formData.investment_type === 'rd') && (
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Platform/Account</label>
                                    <select required value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: parseInt(e.target.value) })} className={darkTheme.input}>
                                        <option value={0}>Select Platform</option>
                                        {allInvestmentAccounts.filter(a => a.is_investment_active).map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
    
                            {/* Dynamic Fields for FD/RD */}
                            {(formData.investment_type === 'fd' || formData.investment_type === 'rd') && (
                                <div className="space-y-4 pt-2 border-t border-slate-700/50">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400">{formData.investment_type === 'fd' ? 'Principal Amount' : 'Monthly Deposit'}</label>
                                            <input 
                                                type="number" 
                                                required 
                                                value={formData.investment_type === 'fd' ? (formData.principal_amount || '') : (formData.monthly_deposit || '')} 
                                                onChange={e => setFormData({ 
                                                    ...formData, 
                                                    [formData.investment_type === 'fd' ? 'principal_amount' : 'monthly_deposit']: parseFloat(e.target.value) 
                                                })} 
                                                className={darkTheme.input} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400">Interest Rate (%)</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                required 
                                                value={formData.interest_rate || ''} 
                                                onChange={e => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })} 
                                                className={darkTheme.input} 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400">Opening Date</label>
                                            <input 
                                                type="date" 
                                                required 
                                                value={formData.opening_date || ''} 
                                                onChange={e => setFormData({ ...formData, opening_date: e.target.value })} 
                                                className={darkTheme.input} 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400">Tenure (Months)</label>
                                            <input 
                                                type="number" 
                                                required 
                                                value={formData.tenure_months || ''} 
                                                onChange={e => setFormData({ ...formData, tenure_months: parseInt(e.target.value) })} 
                                                className={darkTheme.input} 
                                            />
                                        </div>
                                    </div>
                                    {formData.investment_type === 'fd' && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400">Compounding</label>
                                            <select 
                                                value={formData.compounding} 
                                                onChange={e => setFormData({ ...formData, compounding: e.target.value as any })} 
                                                className={darkTheme.input}
                                            >
                                                <option value="monthly">Monthly</option>
                                                <option value="quarterly">Quarterly</option>
                                                <option value="yearly">Yearly</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>Cancel</button>
                                <button type="submit" className={darkTheme.btnPrimary}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add/Edit Lot Modal */}
            {showLotForm && (
                <div className={darkTheme.modalOverlayTop}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>{editingLotId ? 'Edit Lot' : 'Add Lot'}</h2>
                        <form onSubmit={handleLotSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {((viewLotsSummary?.investment.investment_type || formData.investment_type) === 'stock' || (viewLotsSummary?.investment.investment_type || formData.investment_type) === 'mf') ? (
                                    <>
                                        <div>
                                            <label className="block text-xs mb-1">Quantity</label>
                                            <input type="number" step="any" value={lotFormData.quantity} onChange={e => setLotFormData({ ...lotFormData, quantity: parseFloat(e.target.value) })} className={darkTheme.input} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">Price per Unit</label>
                                            <input type="number" step="any" value={lotFormData.price_per_unit} onChange={e => setLotFormData({ ...lotFormData, price_per_unit: parseFloat(e.target.value) })} className={darkTheme.input} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="col-span-2">
                                        <label className="block text-xs mb-1">Deposit Amount</label>
                                        <input 
                                            type="number" 
                                            step="any" 
                                            value={lotFormData.quantity === 1 ? lotFormData.price_per_unit : lotFormData.quantity} 
                                            onChange={e => setLotFormData({ 
                                                ...lotFormData, 
                                                quantity: parseFloat(e.target.value),
                                                price_per_unit: 1 
                                            })} 
                                            className={darkTheme.input} 
                                            placeholder="10000"
                                        />
                                    </div>
                                )}
                                <div className="col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs mb-1">Date</label>
                                        <input type="date" value={lotFormData.date} onChange={e => setLotFormData({ ...lotFormData, date: e.target.value })} className={darkTheme.input} />
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1">Charges (Taxes, Fees)</label>
                                        <input type="number" step="any" value={lotFormData.charges} onChange={e => setLotFormData({ ...lotFormData, charges: parseFloat(e.target.value) })} className={darkTheme.input} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowLotForm(false)} className={darkTheme.btnCancel}>Cancel</button>
                                <button type="submit" className={darkTheme.btnPrimary}>Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showViewLots && viewLotsSummary && (
                <div className={darkTheme.modalOverlay}>
                <div className={darkTheme.modalContentLarge}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">{viewLotsSummary.investment.name}</h2>
                                <p className="text-slate-400 text-xs uppercase tracking-wider">{viewLotsSummary.investment.investment_type} Holdings</p>
                            </div>
                            <button onClick={() => handleAddLot(viewLotsSummary.investment.id!, viewLotsSummary.investment.investment_type)} className={darkTheme.btnPrimary}>+ Buy</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead>
                                    <tr className="text-slate-500 border-b border-slate-700">
                                        <th className="py-2">Date</th>
                                        <th className="py-2 text-right">{viewLotsSummary.investment.investment_type === 'stock' || viewLotsSummary.investment.investment_type === 'mf' ? 'Units' : 'Deposit'}</th>
                                        <th className="py-2 text-right">{viewLotsSummary.investment.investment_type === 'stock' || viewLotsSummary.investment.investment_type === 'mf' ? 'Price' : 'Investment'}</th>
                                        <th className="py-2 text-right">Total</th>
                                        <th className="py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewLotsSummary.lots.map(lot => (
                                        <tr key={lot.id} className="border-b border-slate-800">
                                            <td className="py-2">{lot.date}</td>
                                            <td className="py-2 text-right">{lot.quantity}</td>
                                            <td className="py-2 text-right">{formatCurrency(lot.price_per_unit)}</td>
                                            <td className="py-2 text-right">{formatCurrency(lot.quantity * lot.price_per_unit + lot.charges)}</td>
                                            <td className="py-2 text-center">
                                                <button onClick={() => handleEditLot(lot)} className="text-blue-400 mr-3">✏️</button>
                                                <button onClick={() => handleDeleteLot(lot.id!)} className="text-rose-400">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowViewLots(false)} className={darkTheme.btnCancel}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

