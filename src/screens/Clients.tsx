import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Client, Project } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Clients() {
    const { execute, loading } = useDatabase();
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
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
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [cData, pData] = await Promise.all([
                execute<Client[]>('get_clients'),
                execute<Project[]>('get_projects')
            ]);
            setClients(cData);
            setProjects(pData);
        } catch (error) {
            console.error('Failed to load clients data:', error);
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
            await loadData();
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

    // Overall client analytics
    const totalProjValue = projects.reduce((sum, p) => sum + (p.expected_amount || 0), 0);
    const totalEffortValue = projects.reduce((sum, p) => sum + ((p.logged_hours || 0) * (p.hourly_rate || 0)), 0);
    const totalLoggedHours = projects.reduce((sum, p) => sum + (p.logged_hours || 0), 0);
    const totalReceivedAmount = projects.reduce((sum, p) => sum + (p.received_amount || 0), 0);
    const overallActualRate = totalLoggedHours > 0 ? totalReceivedAmount / totalLoggedHours : 0;
    const overallTargetRate = totalLoggedHours > 0 ? totalEffortValue / totalLoggedHours : 0;
    const overallEfficiency = overallTargetRate > 0 ? (overallActualRate / overallTargetRate) * 100 : (totalEffortValue > 0 ? (totalReceivedAmount / totalEffortValue) * 100 : 0);

    return (
        <div className="p-6 pb-20">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Clients</h1>
                    <p className="text-sm text-slate-400">Manage client profiles, effort value, and billing performance</p>
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

            {/* Top Client Analytics Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Cumulative Projects Value</div>
                    <div className="text-2xl font-bold text-blue-400">{formatCurrency(totalProjValue)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Across all clients</div>
                </div>

                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Cumulative Effort Value</div>
                    <div className="text-2xl font-bold text-purple-400">{formatCurrency(totalEffortValue)}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{totalLoggedHours.toFixed(1)}h client hours</div>
                </div>

                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Client Actual Hourly Rate</div>
                    <div className="text-2xl font-bold text-emerald-400">{formatCurrency(overallActualRate)}<small className="text-xs text-slate-500">/hr</small></div>
                    <div className="text-[11px] text-slate-500 mt-1">Realized per logged hour</div>
                </div>

                <div className="card bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Overall Client Efficiency</div>
                    <div className={`text-2xl font-bold ${overallEfficiency >= 100 ? 'text-green-400' : overallEfficiency >= 75 ? 'text-blue-400' : 'text-orange-400'}`}>
                        {overallEfficiency.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Realized vs target rate</div>
                </div>
            </div>

            {/* Client Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map((client) => {
                    const clientProjects = projects.filter(p => p.client_id === client.id);
                    const cumProjVal = clientProjects.reduce((sum, p) => sum + (p.expected_amount || 0), 0);
                    const cumEffortVal = clientProjects.reduce((sum, p) => sum + ((p.logged_hours || 0) * (p.hourly_rate || 0)), 0);
                    const cumLogged = clientProjects.reduce((sum, p) => sum + (p.logged_hours || 0), 0);
                    const cumRecv = clientProjects.reduce((sum, p) => sum + (p.received_amount || 0), 0);
                    const actualRate = cumLogged > 0 ? cumRecv / cumLogged : 0;
                    const targetRate = cumLogged > 0 ? cumEffortVal / cumLogged : 0;
                    const efficiency = targetRate > 0 ? (actualRate / targetRate) * 100 : (cumEffortVal > 0 ? (cumRecv / cumEffortVal) * 100 : 0);

                    return (
                        <div
                            key={client.id}
                            className={`${darkTheme.card} p-6 cursor-pointer hover:border-blue-500/50 transition-all group flex flex-col justify-between`}
                            onClick={() => handleEdit(client)}
                        >
                            <div>
                                <div className="flex justify-between items-start mb-2">
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
                                    <p className="text-sm text-blue-300 mb-3 font-medium">{client.business_name}</p>
                                )}

                                {/* Client Effort & Value Breakdown */}
                                <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/50 my-3 space-y-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Projects Value ({clientProjects.length}):</span>
                                        <span className="font-bold text-blue-400">{formatCurrency(cumProjVal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Effort Value ({cumLogged.toFixed(1)}h):</span>
                                        <span className="font-bold text-purple-400">{formatCurrency(cumEffortVal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                        <span className="text-slate-400">Actual Hourly Rate:</span>
                                        <span className="font-bold text-emerald-400">{formatCurrency(actualRate)}/hr</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Efficiency Score:</span>
                                        <span className={`font-bold px-2 py-0.5 rounded ${efficiency >= 100 ? 'bg-green-500/20 text-green-400' : efficiency > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                                            {efficiency > 0 ? `${efficiency.toFixed(0)}%` : '---'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 mt-2 border-t border-white/5 pt-3">
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
                    );
                })}
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

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Client Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Business Name</label>
                                    <input
                                        type="text"
                                        value={formData.business_name || ''}
                                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Contact Number</label>
                                    <input
                                        type="text"
                                        value={formData.contact_number || ''}
                                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="+1 234 567 890"
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>GST / Tax ID</label>
                                    <input
                                        type="text"
                                        value={formData.gst || ''}
                                        onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="GSTIN or Tax Number"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Address</label>
                                    <input
                                        type="text"
                                        value={formData.address || ''}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="Billing address"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={darkTheme.label}>Notes</label>
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className={darkTheme.textarea}
                                    rows={3}
                                    placeholder="Client notes or billing details..."
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>Cancel</button>
                                <button type="submit" className={darkTheme.btnPrimary}>Save Client</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
