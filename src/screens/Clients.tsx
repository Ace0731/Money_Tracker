import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Client } from '../types';
import { darkTheme } from '../utils/theme';

export default function Clients() {
    const { execute, loading } = useDatabase();
    const [clients, setClients] = useState<Client[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Client>({
        name: '',
        notes: '',
        status: 'active',
    });

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            const data = await execute<Client[]>('get_clients');
            setClients(data);
        } catch (error) {
            console.error('Failed to load clients:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await execute('update_client', { client: formData });
            } else {
                await execute('create_client', { client: formData });
            }
            await loadClients();
            setShowForm(false);
            setFormData({ name: '', notes: '', status: 'active' });
        } catch (error) {
            console.error('Failed to save client:', error);
        }
    };

    const handleEdit = (client: Client) => {
        setFormData(client);
        setShowForm(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>Clients</h1>
                <button
                    onClick={() => {
                        setFormData({ name: '', notes: '', status: 'active' });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Client
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => (
                    <div
                        key={client.id}
                        className={`${darkTheme.card} p-6 cursor-pointer`}
                        onClick={() => handleEdit(client)}
                    >
                        <h3 className="text-xl font-bold text-slate-100 mb-2">
                            {client.name}
                            {client.status && client.status !== 'active' && (
                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${client.status === 'inactive' ? 'bg-slate-500/20 text-slate-400' :
                                        client.status === 'prospect' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-slate-500/20 text-slate-400'
                                    }`}>
                                    {client.status === 'inactive' ? '💤 Inactive' :
                                        client.status === 'prospect' ? '🎯 Prospect' :
                                            client.status}
                                </span>
                            )}
                        </h3>
                        {client.notes && <p className="text-sm text-slate-400">{client.notes}</p>}
                    </div>
                ))}
            </div>

            {clients.length === 0 && !loading && (
                <div className={darkTheme.empty}>
                    No clients yet. Click "Add Client" to create one.
                </div>
            )}

            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>
                            {formData.id ? 'Edit Client' : 'Add Client'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Client Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={darkTheme.input}
                                    placeholder="e.g., ABC Corp"
                                />
                            </div>

                            <div>
                                <label className={darkTheme.label}>Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.textarea}
                                    rows={3}
                                    placeholder="Contact details, requirements, etc."
                                />
                            </div>

                            <div>
                                <label className={darkTheme.label}>Status</label>
                                <select
                                    value={formData.status || 'active'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className={darkTheme.select}
                                >
                                    <option value="active">🟢 Active</option>
                                    <option value="prospect">🎯 Prospect</option>
                                    <option value="inactive">💤 Inactive</option>
                                </select>
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
