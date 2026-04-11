import React, { useState } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import { formatCurrency } from '../../utils/formatters';
import Swal from 'sweetalert2';

export default function BenchmarkTab({ report, refreshData }: { report: any, refreshData: () => void }) {
    const { execute } = useDatabase();
    const [showSettings, setShowSettings] = useState(false);
    const [targetAmount, setTargetAmount] = useState(report?.benchmark?.target_amount || 10000);
    const [startDate, setStartDate] = useState(report?.benchmark?.start_date || new Date().toISOString().split('T')[0]);

    const handleSaveBenchmark = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await execute('set_investment_benchmark', { targetAmount: parseFloat(targetAmount), startDate });
            Swal.fire({
                title: 'Success!',
                text: 'Benchmark updated successfully.',
                icon: 'success',
                background: '#1e293b',
                color: '#f1f5f9',
                timer: 1500,
                showConfirmButton: false
            });
            setShowSettings(false);
            refreshData();
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: 'Failed to save benchmark.',
                icon: 'error',
                background: '#1e293b',
                color: '#f1f5f9'
            });
        }
    };

    if (!report || !report.benchmark) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-800/30 rounded-xl border border-slate-700 h-[400px]">
                <div className="text-5xl mb-4">📈</div>
                <h2 className="text-2xl font-bold text-slate-200 mb-2">No Benchmark Set</h2>
                <p className="mb-6 max-w-md text-center">Set up a monthly investment goal to track your consistency, cumulative progress, and identify gaps over time.</p>
                <button onClick={() => setShowSettings(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                    Define Investment Target
                </button>
                
                {showSettings && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700 text-left">
                            <h3 className="text-xl font-bold text-slate-100 mb-4">Set Benchmark</h3>
                            <form onSubmit={handleSaveBenchmark} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Monthly Target Amount</label>
                                    <input type="number" required value={targetAmount} onChange={e => setTargetAmount(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                                    <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white" />
                                </div>
                                <div className="flex gap-2 justify-end mt-4">
                                    <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-800 p-6 rounded-xl border border-slate-700">
                <div>
                    <h2 className="text-xl font-bold text-slate-100">Monthly Benchmark: <span className="text-blue-400">{formatCurrency(report.benchmark.target_amount)}</span></h2>
                    <p className="text-sm text-slate-400 tracking-wider">Tracking since {report.benchmark.start_date}</p>
                </div>
                <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-white px-3 py-1.5 border border-slate-600 hover:border-slate-400 rounded transition-colors bg-slate-900 text-sm">
                    ⚙️ Edit Target
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="text-sm text-slate-400">Total Cumulative Target</div>
                    <div className="text-2xl font-bold text-slate-100">{formatCurrency(report.total_target)}</div>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                    <div className="text-sm text-slate-400">Total Actual Invested</div>
                    <div className="text-2xl font-bold text-slate-100">{formatCurrency(report.total_actual)}</div>
                </div>
                <div className={`p-5 rounded-xl border ${report.total_gap >= 0 ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'}`}>
                    <div className="text-sm text-slate-400">Net Portfolio Gap</div>
                    <div className={`text-2xl font-bold ${report.total_gap >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {report.total_gap >= 0 ? '+' : ''}{formatCurrency(report.total_gap)}
                        <span className="text-sm ml-2 opacity-70">
                            ({report.total_gap >= 0 ? 'Surplus' : 'Deficit'})
                        </span>
                    </div>
                </div>
            </div>

            {report.total_gap < 0 && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 text-xl">🚀</div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-100">Path to Parity</h3>
                            <p className="text-xs text-slate-400">Smart recovery roadmap based on your best historical performance.</p>
                        </div>
                    </div>

                    {(() => {
                        const deficit = Math.abs(report.total_gap);
                        const bench = report.benchmark.target_amount;
                        const data = report.monthly_data;
                        
                        // Best Trend Calculation: max(current month, last 2 months average)
                        const thisMonth = data[data.length - 1]?.actual || 0;
                        const prev1 = data[data.length - 2]?.actual || 0;
                        const prev2 = data[data.length - 3]?.actual || 0;
                        const avgLast2 = (prev1 + prev2) / 2;
                        const bestTrend = Math.max(thisMonth, avgLast2);
                        
                        const surplusContribution = bestTrend - bench;
                        const monthsToMatch = surplusContribution > 0 ? Math.ceil(deficit / surplusContribution) : Infinity;
                        
                        const required3 = bench + (deficit / 3);
                        const required6 = bench + (deficit / 6);
                        const required12 = bench + (deficit / 12);

                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                                <div className="space-y-4">
                                    <div className="text-sm text-slate-300 font-semibold mb-2">Required Investment for Catch-up:</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">In 3 Months</div>
                                            <div className="text-blue-400 font-bold">{formatCurrency(required3)}</div>
                                            <div className="text-[10px] text-slate-600 mt-1">per month</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">In 6 Months</div>
                                            <div className="text-blue-400 font-bold">{formatCurrency(required6)}</div>
                                            <div className="text-[10px] text-slate-600 mt-1">per month</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">In 12 Months</div>
                                            <div className="text-blue-400 font-bold">{formatCurrency(required12)}</div>
                                            <div className="text-[10px] text-slate-600 mt-1">per month</div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 p-4 bg-slate-900/80 rounded-xl border border-blue-500/20">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-slate-400">Projected Recovery Base:</span>
                                            <span className="text-xs text-emerald-400 font-bold">Best Trend: {formatCurrency(bestTrend)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic">* Based on higher of current month vs last 2-mo average.</p>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center items-center p-6 bg-blue-600/5 border border-blue-500/20 rounded-2xl">
                                    <div className="text-sm text-slate-400 mb-2 uppercase tracking-widest font-bold">Estimated Parity Date</div>
                                    {monthsToMatch !== Infinity ? (
                                        <>
                                            <div className="text-4xl font-black text-blue-400 mb-2">
                                                {monthsToMatch} <span className="text-lg">Months</span>
                                            </div>
                                            <div className="text-sm text-slate-300">
                                                By {new Date(new Date().setMonth(new Date().getMonth() + monthsToMatch)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                            </div>
                                            <div className="mt-4 w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-blue-400 h-full w-2/3 animate-pulse" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center">
                                            <div className="text-red-400 font-bold mb-1">Gap is Widening</div>
                                            <p className="text-xs text-slate-500 max-w-[200px]">You need to invest at least {formatCurrency(bench)} per month + recovery amount to close the gap.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                        <tr>
                            <th className="p-4">Month</th>
                            <th className="p-4 text-right">Target</th>
                            <th className="p-4 text-right">Actual Invested</th>
                            <th className="p-4 text-right">Monthly Gap</th>
                            <th className="p-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {report.monthly_data.map((m: any) => {
                            const gap = m.actual - m.target;
                            return (
                                <tr key={m.month} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 font-medium text-slate-200">{m.label}</td>
                                    <td className="p-4 text-right text-slate-300 font-mono">{formatCurrency(m.target)}</td>
                                    <td className="p-4 text-right font-mono font-medium text-slate-100">{formatCurrency(m.actual)}</td>
                                    <td className={`p-4 text-right font-mono font-bold ${gap >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                                        {gap >= 0 ? '+' : ''}{formatCurrency(gap)}
                                    </td>
                                    <td className="p-4 text-center">
                                        {gap >= 0 ? (
                                            <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded text-xs">✓ Met</span>
                                        ) : (
                                            <span className="bg-red-500/10 text-red-400 px-2.5 py-1 rounded text-xs">✗ Missed</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {showSettings && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700 text-left shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-100 mb-4">Edit Benchmark</h3>
                        <form onSubmit={handleSaveBenchmark} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Monthly Target Amount</label>
                                <input type="number" required value={targetAmount} onChange={e => setTargetAmount(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                                <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500" />
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg">Save Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
