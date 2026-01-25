import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Category } from '../types';
import { darkTheme } from '../utils/theme';

export default function Categories() {
    const { execute, loading } = useDatabase();
    const [categories, setCategories] = useState<Category[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Category>({
        name: '',
        kind: 'expense',
        notes: '',
        is_investment: false,
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
            } else {
                await execute('create_category', { category: formData });
            }
            await loadCategories();
            setShowForm(false);
            setFormData({ name: '', kind: 'expense', notes: '', is_investment: false });
        } catch (error) {
            console.error('Failed to save category:', error);
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
                        setFormData({ name: '', kind: 'expense', notes: '', is_investment: false });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Category
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

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
                                {category.is_investment && <span className="inline-block mt-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">📈 Investment</span>}
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
                                {category.is_investment && <span className="inline-block mt-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">📈 Investment</span>}
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
                                {category.is_investment && <span className="inline-block mt-2 text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">📈 Investment</span>}
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

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_investment"
                                    checked={formData.is_investment || false}
                                    onChange={(e) => setFormData({ ...formData, is_investment: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                />
                                <label htmlFor="is_investment" className="text-sm text-slate-300">
                                    📈 Mark as Investment (shows in Budget → Investments)
                                </label>
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
