import { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import type { IncomeBreakdownItem, CategoryHour, Category } from '../types';
import Swal from 'sweetalert2';

export default function IncomeBreakdown() {
    const { execute } = useDatabase();
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [breakdown, setBreakdown] = useState<IncomeBreakdownItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showHourForm, setShowHourForm] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [hourLogs, setHourLogs] = useState<CategoryHour[]>([]);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        hours: 0,
        notes: ''
    });

    useEffect(() => {
        loadData();
    }, [month]);

    const loadData = async () => {
        try {
            const [data, cats] = await Promise.all([
                execute<IncomeBreakdownItem[]>('get_income_breakdown', { month }),
                execute<Category[]>('get_categories')
            ]);
            setBreakdown(data);
            setCategories(cats.filter(c => c.kind === 'income'));
        } catch (error) {
            console.error('Failed to load breakdown:', error);
        }
    };

    const loadHourLogs = async (catId: number) => {
        try {
            const logs = await execute<CategoryHour[]>('get_category_hours', { categoryId: catId, month });
            setHourLogs(logs);
        } catch (error) {
            console.error('Failed to load hour logs:', error);
        }
    };

    const handleOpenHourForm = (catId: number) => {
        setSelectedCategoryId(catId);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            hours: 0,
            notes: ''
        });
        loadHourLogs(catId);
        setShowHourForm(true);
    };

    const handleSaveHours = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategoryId) return;

        try {
        await execute('create_category_hour', {
                hour: {
                    category_id: selectedCategoryId,
                    date: formData.date,
                    hours: formData.hours,
                    notes: formData.notes || null,
                }
            });
            await loadHourLogs(selectedCategoryId);
            await loadData();
            setFormData({ ...formData, hours: 0, notes: '' });
            Swal.fire({ title: 'Hours Logged!', icon: 'success', timer: 1200, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
        } catch (error) {
            console.error('Failed to save hours:', error);
            Swal.fire('Error', 'Failed to save hours.', 'error');
        }
    };

    const handleDeleteHour = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete this log?',
            text: 'This hour entry will be permanently removed.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ef4444',
            background: '#1e293b',
            color: '#f1f5f9',
        });
        if (!result.isConfirmed) return;
        try {
            await execute('delete_category_hour', { id });
            if (selectedCategoryId) await loadHourLogs(selectedCategoryId);
            await loadData();
            Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1200, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
        } catch (error) {
            console.error('Failed to delete hour log:', error);
            Swal.fire('Error', 'Failed to delete hour log.', 'error');
        }
    };

    const totalIncome = breakdown.reduce((sum, item) => sum + item.income, 0);
    const totalHours = breakdown.reduce((sum, item) => sum + item.hours, 0);
    const avgRate = totalHours > 0 ? totalIncome / totalHours : 0;

    return (
        <div className="p-6 pb-20">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Income Breakdown</h1>
                    <p className="text-slate-400 text-sm mt-1">Hourly rate tracking for Income categories</p>
                </div>
                <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">💰</div>
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Income</div>
                    <div className="text-3xl font-bold text-slate-100">{formatCurrency(totalIncome)}</div>
                </div>
                <div className="card bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">⏱️</div>
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Hours</div>
                    <div className="text-3xl font-bold text-blue-400">{totalHours.toFixed(1)}h</div>
                </div>
                <div className="card bg-blue-600/20 p-6 rounded-xl border border-blue-500/30 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl group-hover:scale-110 transition-transform">📈</div>
                    <div className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Avg Hourly Rate</div>
                    <div className="text-3xl font-bold text-blue-400">{formatCurrency(avgRate)}/hr</div>
                </div>
            </div>

            {/* Breakdown List */}
            <div className="space-y-6">
                {breakdown.map((item) => (
                    <div key={item.category_id} className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden shadow-lg animate-fade-in">
                        <div className="p-6 border-b border-slate-700 bg-slate-800/30">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                        {item.category_name}
                                        {item.is_project_based && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">Project Based</span>}
                                    </h3>
                                    <div className="text-slate-400 text-sm mt-1">
                                        Income: {formatCurrency(item.income)} • Hours: {item.hours.toFixed(1)}h
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-blue-400">{formatCurrency(item.hourly_rate)}<small className="text-xs ml-1 text-slate-500">/hr</small></div>
                                    {!item.is_project_based && (
                                        <button 
                                            onClick={() => handleOpenHourForm(item.category_id)}
                                            className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-slate-300 mt-2 transition-colors border border-slate-600"
                                        >
                                            ➕ Log Hours
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {item.is_project_based && item.projects.length > 0 && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {item.projects.map((proj) => (
                                    <div key={proj.project_id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                                        <div className="text-sm font-bold text-slate-200 mb-2 truncate">{proj.project_name}</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-slate-500 uppercase tracking-tighter">Income</div>
                                                <div className="text-slate-300 font-mono">{formatCurrency(proj.income)}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 uppercase tracking-tighter">Hours</div>
                                                <div className="text-slate-300 font-mono">{proj.hours.toFixed(1)}h</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Hourly Rate</span>
                                            <span className="text-sm font-bold text-blue-400">{formatCurrency(proj.hourly_rate)}/hr</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {breakdown.length === 0 && (
                    <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                        <div className="text-4xl mb-4 opacity-20">⏱️</div>
                        <h3 className="text-xl font-bold text-slate-400">No Breakdown Categories</h3>
                        <p className="text-slate-500 mt-2">Go to Categories screen and mark income categories to include in breakdown.</p>
                    </div>
                )}
            </div>

            {/* Log Hours Modal */}
            {showHourForm && selectedCategoryId && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>Log Hours - {categories.find(c => c.id === selectedCategoryId)?.name}</h2>
                        
                        <form onSubmit={handleSaveHours} className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className={darkTheme.input}
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Hours</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={formData.hours || ''}
                                        onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
                                        className={darkTheme.input}
                                        placeholder="0.0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={darkTheme.label}>Notes</label>
                                <input
                                    type="text"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.input}
                                    placeholder="Optional notes"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowHourForm(false)} className={darkTheme.btnCancel}>Close</button>
                                <button type="submit" className={darkTheme.btnPrimary}>Add Hours</button>
                            </div>
                        </form>

                        <div className="border-t border-slate-700 pt-4">
                            <h3 className="text-sm font-bold text-slate-100 mb-3 uppercase tracking-wider opacity-50">Log History</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {hourLogs.map((log) => (
                                    <div key={log.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex justify-between items-center group">
                                        <div>
                                            <div className="text-sm font-mono text-blue-400">{log.date}</div>
                                            {log.notes && <div className="text-[10px] text-slate-500 mt-0.5">{log.notes}</div>}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-lg font-bold text-slate-100">{log.hours}h</span>
                                            <button 
                                                onClick={() => log.id && handleDeleteHour(log.id)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {hourLogs.length === 0 && (
                                    <div className="text-center py-8 text-slate-600 italic text-sm">No logs for this month yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
