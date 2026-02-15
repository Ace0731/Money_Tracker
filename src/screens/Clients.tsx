import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Client } from '../types';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Clients() {
    const { execute, loading } = useDatabase();
    const [clients, setClients] = useState<Client[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Client>({
        name: '',
        notes: '',
        status: 'active',
        business_name: '',
        address: '',
        contact_number: '',
        email: '',
        gst: ''
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
            setFormData({
                name: '', notes: '', status: 'active',
                business_name: '', address: '', contact_number: '',
                email: '', gst: ''
            });
            Swal.fire({
                title: 'Data Saved',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#f1f5f9'
            });
        } catch (error) {
            Swal.fire('Error', 'Failed to save client', 'error');
        }
    };

    const handleEdit = (client: Client) => {
        setFormData({
            ...client,
            business_name: client.business_name || '',
            address: client.address || '',
            contact_number: client.contact_number || '',
            email: client.email || '',
            gst: client.gst || ''
        });
        setShowForm(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Clients</h1>
                    <p className="text-sm text-slate-400">Manage client profiles and billing information</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({
                            name: '', notes: '', status: 'active',
                            business_name: '', address: '', contact_number: '',
                            email: '', gst: ''
                        });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    + Add New Client
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map((client) => (
                    <div
                        key={client.id}
                        className={`${darkTheme.card} p-6 cursor-pointer hover:border-blue-500/50 transition-all group`}
                        onClick={() => handleEdit(client)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                                {client.name}
                            </h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${client.status === 'inactive' ? 'bg-slate-500/10 text-slate-500 border border-slate-500/20' :
                                client.status === 'prospect' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                    'bg-green-500/10 text-green-400 border border-green-500/20'
                                }`}>
                                {client.status}
                            </span>
                        </div>

                        {client.business_name && (
                            <p className="text-sm text-blue-300 mb-1 font-medium">{client.business_name}</p>
                        )}

                        <div className="space-y-1 mt-4 border-t border-white/5 pt-4">
                            {client.email && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span>📧</span> {client.email}
                                </div>
                            )}
                            {client.contact_number && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span>📞</span> {client.contact_number}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {clients.length === 0 && !loading && (
                <div className={darkTheme.empty + " min-h-[400px]"}>
                    <div className="text-4xl mb-4">👥</div>
                    <p>No clients yet. Add your first client to get started!</p>
                </div>
            )}

            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge + " max-w-2xl"}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.modalTitle}>
                                {formData.id ? 'Edit Client Profile' : 'New Client Registration'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={darkTheme.label}>Display Name (Personal/Main) *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="e.g., John Doe"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={darkTheme.label}>Business / Legal Name</label>
                                    <input
                                        type="text"
                                        value={formData.business_name || ''}
                                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="e.g., Acme Solutions Pvt Ltd"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={darkTheme.label}>Business Address</label>
                                    <textarea
                                        value={formData.address || ''}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className={darkTheme.input + " min-h-[80px]"}
                                        placeholder="Street, City, State, PIN"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Contact Number</label>
                                    <input
                                        type="text"
                                        value={formData.contact_number || ''}
                                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="+91 XXXXX XXXXX"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="client@example.com"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>GST Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.gst || ''}
                                        onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="29AAAAA0000A1Z5"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Status</label>
                                    <select
                                        value={formData.status || 'active'}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className={darkTheme.select}
                                    >
                                        <option value="active">Active</option>
                                        <option value="prospect">Prospect</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={darkTheme.label}>Internal Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.input + " min-h-[60px]"}
                                    placeholder="Any internal reminders..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>
                                    Discard
                                </button>
                                <button type="submit" className={darkTheme.btnPrimary + " px-8"}>
                                    {formData.id ? 'Save Changes' : 'Register Client'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
