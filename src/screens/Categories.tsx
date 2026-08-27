import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useDatabase } from '../hooks/useDatabase';
import type { Category } from '../types';
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

export default function Categories() {
    const { execute, loading } = useDatabase();
    const [categories, setCategories] = useState<Category[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Category>({
        name: '',
        kind: 'expense',
        notes: '',
        is_investment: false,
        include_in_income_breakdown: false,
        include_in_tax: false,
    });

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const data = await execute<Category[]>('get_categories');
            setCategories(data);
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await execute('update_category', { category: formData });
                Swal.fire({ title: 'Category Updated!', icon: 'success', timer: 1500, showConfirmButton: false, background: '#0f172a', color: '#f1f5f9' });
            } else {
                await execute('create_category', { category: formData });
                Swal.fire({ title: 'Category Created!', icon: 'success', timer: 1500, showConfirmButton: false, background: '#0f172a', color: '#f1f5f9' });
            }
            await loadCategories();
            setShowForm(false);
            setFormData({ name: '', kind: 'expense', notes: '', is_investment: false, include_in_income_breakdown: false, include_in_tax: false });
        } catch (error) {
            console.error('Failed to save category:', error);
            Swal.fire({ title: 'Error', text: 'Failed to save category', icon: 'error', background: '#0f172a', color: '#f1f5f9' });
        }
    };

    const handleEdit = (category: Category) => {
        setFormData(category);
        setShowForm(true);
    };

    const groupedCategories = {
        income: categories.filter(c => c.kind === 'income'),
        expense: categories.filter(c => c.kind === 'expense'),
        transfer: categories.filter(c => c.kind === 'transfer'),
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>Categories</h1>
                <button
                    onClick={() => {
                        setFormData({ name: '', kind: 'expense', notes: '', is_investment: false, include_in_income_breakdown: false, include_in_tax: false });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Category
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            {/* Categories Visual Overview Charts Grid */}
            {categories.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Kind Distribution Donut Chart */}
                    <div className={darkTheme.card + " p-6"}>
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Category Classification</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Income vs Expense vs Transfer</p>
                            </div>
                            <span className="text-xl">🏷️</span>
                        </div>

                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Income', value: categories.filter(c => c.kind === 'income').length, color: '#10b981' },
                                            { name: 'Expense', value: categories.filter(c => c.kind === 'expense').length, color: '#f43f5e' },
                                            { name: 'Transfer', value: categories.filter(c => c.kind === 'transfer').length, color: '#3b82f6' },
                                        ].filter(d => d.value > 0)}
                                        innerRadius={50}
                                        outerRadius={75}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {[
                                            { color: '#10b981' },
                                            { color: '#f43f5e' },
                                            { color: '#3b82f6' }
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                        formatter={(val: any) => [`${val} Categories`, 'Count']}
                                    />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Category Flags Bar Chart */}
                    <div className={darkTheme.card + " p-6 lg:col-span-2"}>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Special Category Badges</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Taxable, Investment, and Budgeted Categories</p>
                            </div>
                            <span className="text-xl">📊</span>
                        </div>

                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: '🏷️ Taxable', Count: categories.filter(c => c.include_in_tax).length },
                                        { name: '📈 Investment', Count: categories.filter(c => c.is_investment).length },
                                        { name: '⏱️ Breakdown', Count: categories.filter(c => c.include_in_income_breakdown).length },
                                        { name: '✓ Budgeted', Count: categories.filter(c => c.include_in_budget !== false && c.kind === 'expense').length },
                                    ]}
                                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                                    <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }}
                                        formatter={(val: any) => [`${val} Categories`, 'Count']}
                                    />
                                    <Bar dataKey="Count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* Income Categories */}
                <div>
                    <h2 className="text-xl font-bold mb-3 text-green-400">Income Categories</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {groupedCategories.income.map((category) => (
                            <div
                                key={category.id}
                                onClick={() => handleEdit(category)}
                                className="bg-green-900/20 border-2 border-green-700/50 p-4 rounded-lg cursor-pointer hover:bg-green-900/30 hover:border-green-600 transition-all"
                            >
                                <h3 className="font-bold text-green-300">{category.name}</h3>
                                {category.notes && <p className="text-sm text-green-400/70 mt-1">{category.notes}</p>}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {category.is_investment && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">📈 Investment</span>}
                                    {category.include_in_tax && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">🏷️ Taxable</span>}
                                    {category.include_in_income_breakdown && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">⏱️ Breakdown</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Expense Categories */}
                <div>
                    <h2 className="text-xl font-bold mb-3 text-red-400">Expense Categories</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {groupedCategories.expense.map((category) => (
                            <div
                                key={category.id}
                                onClick={() => handleEdit(category)}
                                className="bg-red-900/20 border-2 border-red-700/50 p-4 rounded-lg cursor-pointer hover:bg-red-900/30 hover:border-red-600 transition-all"
                            >
                                <h3 className="font-bold text-red-300">{category.name}</h3>
                                {category.notes && <p className="text-sm text-red-400/70 mt-1">{category.notes}</p>}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {category.is_investment && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">📈 Investment</span>}
                                    {category.include_in_tax && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">🏷️ Taxable</span>}
                                    {category.include_in_budget !== false && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">✓ Budgeted</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Transfer Categories */}
                <div>
                    <h2 className="text-xl font-bold mb-3 text-blue-400">Transfer Categories</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {groupedCategories.transfer.map((category) => (
                            <div
                                key={category.id}
                                onClick={() => handleEdit(category)}
                                className="bg-blue-900/20 border-2 border-blue-700/50 p-4 rounded-lg cursor-pointer hover:bg-blue-900/30 hover:border-blue-600 transition-all"
                            >
                                <h3 className="font-bold text-blue-300">{category.name}</h3>
                                {category.notes && <p className="text-sm text-blue-400/70 mt-1">{category.notes}</p>}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {category.is_investment && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">📈 Investment</span>}
                                    {category.include_in_tax && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">🏷️ Taxable</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>
                            {formData.id ? 'Edit Category' : 'Add Category'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Category Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={darkTheme.input}
                                    placeholder="e.g., Salary, Groceries"
                                />
                            </div>

                            <div>
                                <label className={darkTheme.label}>Type *</label>
                                <select
                                    required
                                    value={formData.kind}
                                    onChange={(e) => setFormData({ ...formData, kind: e.target.value as any })}
                                    className={darkTheme.select}
                                >
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                    <option value="transfer">Transfer</option>
                                </select>
                            </div>

                            <div>
                                <label className={darkTheme.label}>Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.textarea}
                                    rows={3}
                                    placeholder="Optional notes..."
                                />
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-700/60">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="include_in_tax"
                                        checked={formData.include_in_tax || false}
                                        onChange={(e) => setFormData({ ...formData, include_in_tax: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="include_in_tax" className="text-sm text-slate-300 font-medium">
                                        🏷️ For Tax Use (Include in Estimated Tax Calculations)
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="is_investment"
                                        checked={formData.is_investment || false}
                                        onChange={(e) => setFormData({ ...formData, is_investment: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                    />
                                    <label htmlFor="is_investment" className="text-sm text-slate-300">
                                        📈 Mark as Investment
                                    </label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="include_in_income_breakdown"
                                        checked={formData.include_in_income_breakdown || false}
                                        onChange={(e) => setFormData({ ...formData, include_in_income_breakdown: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                                    />
                                    <label htmlFor="include_in_income_breakdown" className="text-sm text-slate-300">
                                        ⏱️ Include in Income Breakdown (Hourly/Freelance tracking)
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>
                                    Cancel
                                </button>
                                <button type="submit" className={darkTheme.btnPrimary}>
                                    {formData.id ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
