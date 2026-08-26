import { useEffect, useState, useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Category } from '../types';
import { formatCurrency, getFiscalYearRange } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';

interface Transaction {
    id: number;
    account_id: number;
    category_id: number;
    amount: number;
    direction: string;
    date: string;
    notes?: string;
}

export default function Taxes() {
    const { execute, loading } = useDatabase();
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedFY] = useState(getFiscalYearRange());

    // Deductions input state for Old Regime estimation
    const [deduction80C] = useState<number>(150000);
    const [deduction80D] = useState<number>(25000);
    const [deductionNPS] = useState<number>(50000);

    useEffect(() => {
        loadData();
    }, [selectedFY]);

    const loadData = async () => {
        try {
            const [catData, txData] = await Promise.all([
                execute<Category[]>('get_categories'),
                execute<Transaction[]>('get_transactions')
            ]);
            setCategories(catData || []);
            setTransactions(txData || []);
        } catch (error) {
            console.error('Failed to load tax data:', error);
        }
    };

    // Filter taxable categories
    const taxableCategoryIds = useMemo(() => {
        return new Set(categories.filter(c => c.include_in_tax).map(c => c.id));
    }, [categories]);

    // Calculate gross taxable income within selected Fiscal Year
    const taxableIncomeBreakdown = useMemo(() => {
        const fyTx = transactions.filter(t => {
            return t.direction === 'income' &&
                taxableCategoryIds.has(t.category_id) &&
                t.date >= selectedFY.start_date &&
                t.date <= selectedFY.end_date;
        });

        const categoryMap = new Map<number, { categoryName: string; total: number; count: number }>();
        let grossTaxable = 0;

        fyTx.forEach(t => {
            grossTaxable += t.amount;
            const cat = categories.find(c => c.id === t.category_id);
            const catName = cat ? cat.name : 'Taxable Income';
            const existing = categoryMap.get(t.category_id) || { categoryName: catName, total: 0, count: 0 };
            existing.total += t.amount;
            existing.count += 1;
            categoryMap.set(t.category_id, existing);
        });

        return {
            grossTaxable,
            items: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
            totalTxCount: fyTx.length
        };
    }, [transactions, taxableCategoryIds, selectedFY, categories]);

    // ─── NEW TAX REGIME COMPUTATION (FY 2025-26 / 2026-27 Slabs) ───
    const newRegimeTax = useMemo(() => {
        const gross = taxableIncomeBreakdown.grossTaxable;
        const stdDeduction = Math.min(gross, 75000);
        const netTaxable = Math.max(0, gross - stdDeduction);

        let tax = 0;
        const slabs = [];

        // Slab 1: 0 to 3L (0%)
        if (netTaxable > 300000) {
            slabs.push({ range: '₹0 - ₹3,00,000', rate: '0%', tax: 0 });
        } else {
            slabs.push({ range: '₹0 - ₹3,00,000', rate: '0%', tax: 0 });
        }

        // Slab 2: 3L to 7L (5%)
        if (netTaxable > 300000) {
            const taxableAmt = Math.min(netTaxable - 300000, 400000);
            const slabTax = taxableAmt * 0.05;
            tax += slabTax;
            slabs.push({ range: '₹3,00,001 - ₹7,00,000', rate: '5%', tax: slabTax });
        }

        // Slab 3: 7L to 10L (10%)
        if (netTaxable > 700000) {
            const taxableAmt = Math.min(netTaxable - 700000, 300000);
            const slabTax = taxableAmt * 0.10;
            tax += slabTax;
            slabs.push({ range: '₹7,00,001 - ₹10,00,000', rate: '10%', tax: slabTax });
        }

        // Slab 4: 10L to 12L (15%)
        if (netTaxable > 1000000) {
            const taxableAmt = Math.min(netTaxable - 1000000, 200000);
            const slabTax = taxableAmt * 0.15;
            tax += slabTax;
            slabs.push({ range: '₹10,00,001 - ₹12,00,000', rate: '15%', tax: slabTax });
        }

        // Slab 5: 12L to 15L (20%)
        if (netTaxable > 1200000) {
            const taxableAmt = Math.min(netTaxable - 1200000, 300000);
            const slabTax = taxableAmt * 0.20;
            tax += slabTax;
            slabs.push({ range: '₹12,00,001 - ₹15,00,000', rate: '20%', tax: slabTax });
        }

        // Slab 6: Above 15L (30%)
        if (netTaxable > 1500000) {
            const taxableAmt = netTaxable - 1500000;
            const slabTax = taxableAmt * 0.30;
            tax += slabTax;
            slabs.push({ range: 'Above ₹15,00,000', rate: '30%', tax: slabTax });
        }

        // Section 87A Rebate (Full tax rebate if net taxable <= 7L)
        let rebate87A = 0;
        if (netTaxable <= 700000) {
            rebate87A = tax;
            tax = 0;
        }

        const cess = tax * 0.04;
        const totalTaxLiability = tax + cess;

        return {
            gross,
            stdDeduction,
            netTaxable,
            slabs,
            rebate87A,
            taxBeforeCess: tax,
            cess,
            totalTaxLiability
        };
    }, [taxableIncomeBreakdown]);

    // ─── OLD TAX REGIME COMPUTATION ───
    const oldRegimeTax = useMemo(() => {
        const gross = taxableIncomeBreakdown.grossTaxable;
        const stdDeduction = Math.min(gross, 50000);
        const allowed80C = Math.min(deduction80C, 150000);
        const allowed80D = Math.min(deduction80D, 50000);
        const allowedNPS = Math.min(deductionNPS, 50000);
        const totalDeductions = stdDeduction + allowed80C + allowed80D + allowedNPS;
        const netTaxable = Math.max(0, gross - totalDeductions);

        let tax = 0;
        // Slab 1: 0 to 2.5L (0%)
        // Slab 2: 2.5L to 5L (5%)
        if (netTaxable > 250000) {
            const taxableAmt = Math.min(netTaxable - 250000, 250000);
            tax += taxableAmt * 0.05;
        }
        // Slab 3: 5L to 10L (20%)
        if (netTaxable > 500000) {
            const taxableAmt = Math.min(netTaxable - 500000, 500000);
            tax += taxableAmt * 0.20;
        }
        // Slab 4: Above 10L (30%)
        if (netTaxable > 1000000) {
            const taxableAmt = netTaxable - 1000000;
            tax += taxableAmt * 0.30;
        }

        // Section 87A Rebate for Old Regime (net taxable <= 5L)
        let rebate87A = 0;
        if (netTaxable <= 500000) {
            rebate87A = tax;
            tax = 0;
        }

        const cess = tax * 0.04;
        const totalTaxLiability = tax + cess;

        return {
            gross,
            totalDeductions,
            netTaxable,
            rebate87A,
            taxBeforeCess: tax,
            cess,
            totalTaxLiability
        };
    }, [taxableIncomeBreakdown, deduction80C, deduction80D, deductionNPS]);

    // Recommended regime savings
    const recommendedRegime = newRegimeTax.totalTaxLiability <= oldRegimeTax.totalTaxLiability ? 'new' : 'old';
    const taxDifference = Math.abs(newRegimeTax.totalTaxLiability - oldRegimeTax.totalTaxLiability);

    // Data for Regime Comparison Bar Chart
    const regimeComparisonChartData = useMemo(() => {
        return [
            {
                metric: 'Gross Income',
                'New Regime': newRegimeTax.gross,
                'Old Regime': oldRegimeTax.gross,
            },
            {
                metric: 'Deductions',
                'New Regime': newRegimeTax.stdDeduction,
                'Old Regime': oldRegimeTax.totalDeductions,
            },
            {
                metric: 'Net Taxable',
                'New Regime': newRegimeTax.netTaxable,
                'Old Regime': oldRegimeTax.netTaxable,
            },
            {
                metric: 'Final Tax Liability',
                'New Regime': newRegimeTax.totalTaxLiability,
                'Old Regime': oldRegimeTax.totalTaxLiability,
            },
        ];
    }, [newRegimeTax, oldRegimeTax]);

    // Effective Tax & Take Home Pay Pie Data
    const takeHomePieData = useMemo(() => {
        const gross = taxableIncomeBreakdown.grossTaxable;
        const finalTax = newRegimeTax.totalTaxLiability;
        const takeHome = Math.max(0, gross - finalTax);
        return [
            { name: 'Post-Tax Take Home Pay', value: takeHome, color: '#10b981' },
            { name: 'Income Tax Liability', value: finalTax, color: '#06b6d4' },
        ];
    }, [taxableIncomeBreakdown, newRegimeTax]);

    const effectiveTaxRate = taxableIncomeBreakdown.grossTaxable > 0 
        ? ((newRegimeTax.totalTaxLiability / taxableIncomeBreakdown.grossTaxable) * 100).toFixed(1) 
        : '0.0';

    return (
        <div className="p-6 pb-20 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className={darkTheme.title}>Income Tax Estimator</h1>
                    <p className="text-sm text-slate-400">Calculate estimated annual tax liability based on marked taxable income categories</p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-bold">Fiscal Year:</span>
                    <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-400">
                        {selectedFY.label} ({selectedFY.start_date} to {selectedFY.end_date})
                    </div>
                </div>
            </div>

            {loading && <div className={darkTheme.loading}>Calculating tax estimates...</div>}

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Gross Taxable Income</div>
                    <div className="text-2xl font-bold text-emerald-400">{formatCurrency(taxableIncomeBreakdown.grossTaxable)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{taxableIncomeBreakdown.totalTxCount} marked tax transactions</div>
                </div>

                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">New Regime Tax (Default)</div>
                    <div className="text-2xl font-bold text-cyan-400">{formatCurrency(newRegimeTax.totalTaxLiability)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Effective Rate: <span className="font-bold text-cyan-300">{effectiveTaxRate}%</span></div>
                </div>

                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Old Regime Tax</div>
                    <div className="text-2xl font-bold text-purple-400">{formatCurrency(oldRegimeTax.totalTaxLiability)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">With 80C, 80D & NPS deductions</div>
                </div>

                <div className={`card p-5 rounded-xl border ${recommendedRegime === 'new' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Optimal Tax Regime</div>
                    <div className="text-xl font-bold text-white uppercase">
                        {recommendedRegime === 'new' ? '✨ New Regime' : '🏛️ Old Regime'}
                    </div>
                    <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
                        Saves {formatCurrency(taxDifference)} in tax liability
                    </div>
                </div>
            </div>

            {/* Visual Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Dual Bar Chart: New Regime vs Old Regime */}
                <div className={darkTheme.card + " p-6 lg:col-span-2"}>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className={darkTheme.subtitle}>New vs. Old Regime Breakdown</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Compare Gross Income, Deductions, Net Taxable & Liability</p>
                        </div>
                        <span className="text-xl">📊</span>
                    </div>

                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={regimeComparisonChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="metric" stroke="#64748b" fontSize={11} />
                                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    cursor={{ fill: '#33415520' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                    formatter={(val: any) => [formatCurrency(val), 'Amount']}
                                />
                                <Legend />
                                <Bar dataKey="New Regime" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Old Regime" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Take-Home Pay vs Tax Donut Chart */}
                <div className={darkTheme.card + " p-6"}>
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h3 className={darkTheme.subtitle}>Post-Tax Retention</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Take-Home Income vs Tax Paid</p>
                        </div>
                        <span className="text-xl">💰</span>
                    </div>

                    <div className="h-[260px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={takeHomePieData}
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {takeHomePieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                    formatter={(val: any) => [formatCurrency(val), 'Amount']}
                                />
                                <Legend iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 text-center">
                        <div className="text-xs text-slate-400">Effective Tax Rate</div>
                        <div className="text-xl font-bold text-cyan-400 mt-0.5">{effectiveTaxRate}%</div>
                    </div>
                </div>
            </div>

            {/* Taxable Categories Breakdown & Regime Comparison Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Taxable Income Categories List */}
                <div className={darkTheme.card + " p-6 space-y-4"}>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-3">
                        <h3 className={darkTheme.subtitle}>Taxable Income Sources</h3>
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">
                            {taxableCategoryIds.size} Taxable Categories
                        </span>
                    </div>

                    {taxableIncomeBreakdown.items.length > 0 ? (
                        <div className="space-y-3">
                            {taxableIncomeBreakdown.items.map((item, idx) => (
                                <div key={idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40 flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-bold text-slate-200">{item.categoryName}</div>
                                        <div className="text-[11px] text-slate-400">{item.count} transaction(s)</div>
                                    </div>
                                    <div className="text-sm font-bold text-emerald-400">
                                        {formatCurrency(item.total)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500 text-xs italic">
                            No transactions in categories marked for tax use during this fiscal year.
                            Go to <span className="text-blue-400">Categories</span> screen and check "For Tax Use".
                        </div>
                    )}
                </div>

                {/* New Tax Regime Detailed Slabs */}
                <div className={darkTheme.card + " p-6 space-y-4 lg:col-span-2"}>
                    <div className="flex justify-between items-center border-b border-slate-700/60 pb-3">
                        <div>
                            <h3 className={darkTheme.subtitle}>New Tax Regime Slab Computation</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Standard Deduction: ₹75,000 • Section 87A Rebate up to ₹7.0L</p>
                        </div>
                        <span className="text-xs font-bold bg-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded-md">Default Budget Slabs</span>
                    </div>

                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between p-2.5 bg-slate-900/60 rounded-lg text-slate-400 font-bold">
                            <span>Income Tax Slab</span>
                            <span>Tax Rate</span>
                            <span>Calculated Tax</span>
                        </div>

                        {newRegimeTax.slabs.map((slab, i) => (
                            <div key={i} className="flex justify-between p-2.5 border-b border-slate-800 text-slate-200">
                                <span>{slab.range}</span>
                                <span className="font-mono text-cyan-300">{slab.rate}</span>
                                <span className="font-mono font-bold text-slate-100">{formatCurrency(slab.tax)}</span>
                            </div>
                        ))}

                        {newRegimeTax.rebate87A > 0 && (
                            <div className="flex justify-between p-2.5 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg">
                                <span>Section 87A Tax Rebate (Income ≤ ₹7.0L)</span>
                                <span>− {formatCurrency(newRegimeTax.rebate87A)}</span>
                            </div>
                        )}

                        <div className="flex justify-between p-2.5 text-slate-300">
                            <span>Health & Education Cess (4%)</span>
                            <span className="font-bold text-slate-200">{formatCurrency(newRegimeTax.cess)}</span>
                        </div>

                        <div className="flex justify-between p-3 bg-cyan-600/20 rounded-xl border border-cyan-500/30 text-sm font-bold text-white pt-3">
                            <span>Total Estimated New Regime Tax</span>
                            <span className="text-cyan-400">{formatCurrency(newRegimeTax.totalTaxLiability)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
