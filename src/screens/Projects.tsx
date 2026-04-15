import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Project, Client, Category, TimeLog, ProjectPayment } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';
import Swal from 'sweetalert2';

export default function Projects() {
    const { execute, loading } = useDatabase();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<'projects' | 'clients'>('projects');

    // Client Form State
    const [showClientForm, setShowClientForm] = useState(false);
    const [clientFormData, setClientFormData] = useState<Client>({
        name: '', notes: '', status: 'active',
        business_name: '', address: '', contact_number: '',
        email: '', gst: ''
    });

    // Project Form State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Project>({
        name: '',
        client_id: undefined,
        category_id: undefined,
        expected_amount: undefined,
        hourly_rate: undefined,
        start_date: '',
        end_date: '',
        notes: '',
        completed: false,
        status: 'active',
    });
    const [showArchived, setShowArchived] = useState(false);
    const [showOnHold, setShowOnHold] = useState(false);

    // Time Log State
    const [showTimeLog, setShowTimeLog] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
    const [showViewLogs, setShowViewLogs] = useState(false);
    const [viewLogsProjectId, setViewLogsProjectId] = useState<number | undefined>();
    const [projectTimeLogs, setProjectTimeLogs] = useState<Record<number, TimeLog[]>>({});
    const [editingLogId, setEditingLogId] = useState<number | undefined>();
    const [timeLogData, setTimeLogData] = useState({
        hours: 8,
        date: new Date().toISOString().split('T')[0],
    });

    // Payment Log State
    const [showPayments, setShowPayments] = useState(false);
    const [paymentLogsProjectId, setPaymentLogsProjectId] = useState<number | undefined>();
    const [projectPayments, setProjectPayments] = useState<Record<number, ProjectPayment[]>>({});

    useEffect(() => {
        loadProjects();
        loadClients();
        loadCategories();
    }, []);

    const loadProjects = async () => {
        try {
            const data = await execute<Project[]>('get_projects');
            setProjects(data);
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    };

    const loadClients = async () => {
        try {
            const data = await execute<Client[]>('get_clients');
            setClients(data);
        } catch (error) {
            console.error('Failed to load clients:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await execute<Category[]>('get_categories');
            setCategories(data.filter(c => c.kind === 'income'));
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const handleClientSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (clientFormData.id) {
                await execute('update_client', { client: clientFormData });
            } else {
                await execute('create_client', { client: clientFormData });
            }
            await loadClients();
            setShowClientForm(false);
            setClientFormData({ name: '', notes: '', status: 'active', business_name: '', address: '', contact_number: '', email: '', gst: '' });
            Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
        } catch {
            Swal.fire('Error', 'Failed to save client', 'error');
        }
    };

    const handleClientEdit = (client: Client) => {
        setClientFormData({ ...client, business_name: client.business_name || '', address: client.address || '', contact_number: client.contact_number || '', email: client.email || '', gst: client.gst || '' });
        setShowClientForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await execute('update_project', { project: formData });
            } else {
                await execute('create_project', { project: formData });
            }
            await loadProjects();
            setShowForm(false);
            setFormData({
                name: '',
                client_id: undefined,
                category_id: undefined,
                expected_amount: undefined,
                hourly_rate: undefined,
                start_date: '',
                end_date: '',
                notes: '',
                completed: false,
                status: 'active',
            });
        } catch (error) {
            console.error('Failed to save project:', error);
        }
    };

    const handleEdit = (project: Project) => {
        setFormData(project);
        setShowForm(true);
    };

    const handleLogTime = (projectId: number) => {
        const project = projects.find(p => p.id === projectId);
        if (project && project.srs_status !== 'Approved') {
            Swal.fire({
                title: 'SRS Not Approved',
                text: 'Development cannot start until the SRS is approved by the client.',
                icon: 'warning',
                background: '#1e293b',
                color: '#f1f5f9'
            });
            return;
        }
        setSelectedProjectId(projectId);
        setShowTimeLog(true);
    };

    const handleTimeLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingLogId) {
                await execute('update_time_log', {
                    log: {
                        id: editingLogId,
                        project_id: selectedProjectId,
                        ...timeLogData
                    }
                });
            } else {
                await execute('create_time_log', {
                    log: {
                        project_id: selectedProjectId,
                        ...timeLogData
                    }
                });
            }
            if (selectedProjectId) {
                await loadTimeLogs(selectedProjectId);
            }
            await loadProjects();
            setShowTimeLog(false);
            setEditingLogId(undefined);
            setTimeLogData({
                hours: 8,
                date: new Date().toISOString().split('T')[0],
            });
        } catch (error) {
            console.error('Failed to log time:', error);
        }
    };

    const handleEditTimeLog = (log: TimeLog) => {
        setEditingLogId(log.id);
        setSelectedProjectId(log.project_id);
        setTimeLogData({
            hours: log.hours,
            date: log.date,
        });
        setShowTimeLog(true);
    };

    const handleDeleteTimeLog = async (logId: number, projectId: number) => {
        if (!window.confirm('Are you sure you want to delete this time log?')) return;
        try {
            await execute('delete_time_log', { id: logId });
            await loadTimeLogs(projectId);
            await loadProjects();
        } catch (error) {
            console.error('Failed to delete time log:', error);
        }
    };

    const loadTimeLogs = async (projectId: number) => {
        try {
            const logs = await execute<TimeLog[]>('get_time_logs', { projectId: projectId });
            setProjectTimeLogs(prev => ({ ...prev, [projectId]: logs }));
        } catch (error) {
            console.error('Failed to load time logs:', error);
        }
    };

    const openTimeLogs = async (projectId: number) => {
        setViewLogsProjectId(projectId);
        setShowViewLogs(true);
        if (!projectTimeLogs[projectId]) {
            await loadTimeLogs(projectId);
        }
    };

    const loadPayments = async (projectId: number) => {
        try {
            const payments = await execute<ProjectPayment[]>('get_project_payments', { projectId: projectId });
            setProjectPayments(prev => ({ ...prev, [projectId]: payments }));
        } catch (error) {
            console.error('Failed to load payments:', error);
        }
    };

    const openPayments = async (projectId: number) => {
        setPaymentLogsProjectId(projectId);
        setShowPayments(true);
        await loadPayments(projectId);
    };

    const getClientName = (clientId?: number) => {
        const client = clients.find(c => c.id === clientId);
        return client?.name || 'No Client';
    };

    const getCategoryName = (catId?: number) => {
        const category = categories.find(c => c.id === catId);
        return category?.name || '';
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className={darkTheme.title}>Projects & Clients</h1>
                    <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 gap-1">
                        <button
                            onClick={() => setActiveTab('projects')}
                            className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'projects' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            📋 Projects
                        </button>
                        <button
                            onClick={() => setActiveTab('clients')}
                            className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'clients' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            👥 Clients
                        </button>
                    </div>
                </div>
                {activeTab === 'projects' ? (
                    <button
                        onClick={() => {
                            setFormData({ name: '', client_id: undefined, category_id: undefined, expected_amount: undefined, hourly_rate: undefined, start_date: '', end_date: '', notes: '', completed: false, status: 'active' });
                            setShowForm(true);
                        }}
                        className={darkTheme.btnPrimary}
                    >
                        Add Project
                    </button>
                ) : (
                    <button
                        onClick={() => {
                            setClientFormData({ name: '', notes: '', status: 'active', business_name: '', address: '', contact_number: '', email: '', gst: '' });
                            setShowClientForm(true);
                        }}
                        className={darkTheme.btnPrimary}
                    >
                        + Add Client
                    </button>
                )}
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            {/* ─── PROJECTS TAB ─── */}
            {activeTab === 'projects' && (
                <div className="space-y-8">
                {/* Active Projects */}
                <div>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-l-2 border-blue-500 pl-3">Active Projects</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.filter(p => p.status === 'active' || p.status === 'prospect').map((project) => (
                            <div
                                key={project.id}
                                className={`${darkTheme.card} p-6 cursor-pointer relative group`}
                                onClick={() => handleEdit(project)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-bold text-slate-100">{project.name}</h3>
                                    {project.expected_amount && (
                                        <span className="text-sm font-bold text-green-400">
                                            {formatCurrency(project.expected_amount)}
                                        </span>
                                    )}
                                    {project.status === 'prospect' && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-400">
                                            🎯 Prospect
                                        </span>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-sm text-blue-400">{getClientName(project.client_id)}</p>
                                    {project.category_id && (
                                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-bold uppercase tracking-widest">
                                            {getCategoryName(project.category_id)}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-700/50 rounded-lg">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase">Earned (Time)</div>
                                        <div className="text-sm font-bold text-slate-100">
                                            {formatCurrency((project.logged_hours || 0) * (project.hourly_rate || 0))}
                                        </div>
                                    </div>
                                    <div className="hover:bg-green-500/10 transition-colors rounded p-1" onClick={(e) => { e.stopPropagation(); project.id && openPayments(project.id); }}>
                                        <div className="text-[10px] text-slate-400 uppercase flex justify-between items-center">
                                            Received
                                            <span className="text-[8px] text-green-500 font-bold">VIEW 👁️</span>
                                        </div>
                                        <div className="text-sm font-bold text-green-400">
                                            {formatCurrency(project.received_amount || 0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase">SRS Status</div>
                                        <div className={`text-sm font-bold ${project.srs_status === 'Approved' ? 'text-green-400' :
                                            project.srs_status === 'Sent' ? 'text-blue-400' : 'text-slate-400'
                                            }`}>
                                            {project.srs_status || 'Draft'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase">Remaining</div>
                                        <div className="text-sm font-bold text-blue-400">
                                            {formatCurrency((project.expected_amount || 0) - (project.received_amount || 0))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 items-center mb-4">
                                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-bold">
                                        ⏱️ {project.logged_hours || 0}h Logged
                                    </span>
                                    {project.hourly_rate ? (
                                        <div className="flex gap-2">
                                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700 font-mono">
                                                Target: {formatCurrency(project.hourly_rate)}/hr
                                            </span>
                                            {project.logged_hours && project.logged_hours > 0 ? (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                                                    ((project.received_amount || 0) / project.logged_hours) >= (project.hourly_rate || 0)
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                }`}>
                                                    Actual: {formatCurrency((project.received_amount || 0) / project.logged_hours)}/hr
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>

                                {(project.start_date || project.end_date) && (
                                    <div className="text-xs text-slate-400 mb-2 flex justify-between">
                                        {project.start_date && <span>Start: {project.start_date}</span>}
                                        {project.end_date && <span>End: {project.end_date}</span>}
                                    </div>
                                )}

                                {project.notes && <p className="text-sm text-slate-400 truncate mb-4">{project.notes}</p>}

                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleLogTime(project.id!)}
                                        className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold rounded transition-colors border border-blue-600/30"
                                    >
                                        ⏱️ Log Time
                                    </button>
                                    <button
                                        onClick={() => openTimeLogs(project.id!)}
                                        className="flex-1 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition-colors border border-slate-600"
                                    >
                                        📋 Time Logs
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* On-Hold Projects */}
                <div>
                    <button
                        onClick={() => setShowOnHold(!showOnHold)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 hover:text-slate-400 transition-colors"
                    >
                        <span>{showOnHold ? '▼' : '▶'} On-Hold Projects ({projects.filter(p => p.status === 'on_hold').length})</span>
                    </button>

                    {showOnHold && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                            {projects.filter(p => p.status === 'on_hold').map((project) => (
                                <div
                                    key={project.id}
                                    className={`${darkTheme.card} p-6 cursor-pointer relative group border-yellow-500/20`}
                                    onClick={() => handleEdit(project)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-xl font-bold text-slate-300">{project.name}</h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-center">
                                            ⏸️ On Hold
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-4">{getClientName(project.client_id)}</p>
                                    <div className="text-xs text-slate-500 italic">
                                        Received: {formatCurrency(project.received_amount || 0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Completed Projects */}
                {projects.some(p => p.completed) && (
                    <div>
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-l-2 border-green-500 pl-3">Completed Projects</h2>
                        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-900/50 text-xs text-slate-400 uppercase">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-slate-700">Project</th>
                                            <th className="px-4 py-3 border-b border-slate-700">Client</th>
                                            <th className="px-4 py-3 border-b border-slate-700">Earned</th>
                                            <th className="px-4 py-3 border-b border-slate-700">Received</th>
                                            <th className="px-4 py-3 border-b border-slate-700">Actual Rate</th>
                                            <th className="px-4 py-3 border-b border-slate-700">Hours</th>
                                            <th className="px-4 py-3 border-b border-slate-700 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {projects.filter(p => p.status === 'completed' || p.status === 'cancelled').map((project) => (
                                            <tr key={project.id} className="hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3 text-slate-200 font-bold">{project.name}</td>
                                                <td className="px-4 py-3 text-blue-400 text-sm">{getClientName(project.client_id)}</td>
                                                <td className="px-4 py-3 text-slate-200 text-sm">{formatCurrency((project.logged_hours || 0) * (project.hourly_rate || 0))}</td>
                                                <td className="px-4 py-3 text-green-400 font-bold group/received">
                                                    <div className="flex items-center gap-2">
                                                        {formatCurrency(project.received_amount || 0)}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); project.id && openPayments(project.id); }}
                                                            className="text-[10px] text-slate-500 hover:text-green-400 opacity-0 group-hover/received:opacity-100 transition-opacity"
                                                        >
                                                            👁️
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-200 text-sm">
                                                    {project.logged_hours && project.logged_hours > 0
                                                        ? formatCurrency((project.received_amount || 0) / project.logged_hours)
                                                        : '---'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-400 text-sm">{project.logged_hours || 0}h</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(project); }}
                                                            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                                                            title="Edit"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openTimeLogs(project.id!); }}
                                                            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                                                            title="Logs"
                                                        >
                                                            📋
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {/* Archived Projects */}
                                <div>
                                    <button
                                        onClick={() => setShowArchived(!showArchived)}
                                        className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 hover:text-slate-400 transition-colors"
                                    >
                                        <span>{showArchived ? '▼' : '▶'} Archived Projects ({projects.filter(p => p.status === 'archived').length})</span>
                                    </button>

                                    {showArchived && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                                            {projects.filter(p => p.status === 'archived').map((project) => (
                                                <div
                                                    key={project.id}
                                                    className={`${darkTheme.card} p-6 cursor-pointer relative group border-slate-800`}
                                                    onClick={() => handleEdit(project)}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="text-xl font-bold text-slate-400">{project.name}</h3>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-500 border border-slate-700">
                                                            📁 Archived
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-500 mb-4">{getClientName(project.client_id)}</p>
                                                    <div className="text-xs text-slate-500 italic">
                                                        Value: {formatCurrency(project.expected_amount || 0)}
                                                    </div>
                                                </div>
                                            ))}
                                            {projects.filter(p => p.status === 'archived').length === 0 && (
                                                <div className="col-span-full py-8 text-center text-slate-600 italic border-2 border-dashed border-slate-800 rounded-xl">
                                                    No archived projects. Archive old projects to declutter your view.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {projects.length === 0 && !loading && activeTab === 'projects' && (
                <div className={darkTheme.empty}>
                    No projects yet. Click "Add Project" to create one.
                </div>
            )}

            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge}>
                        <h2 className={darkTheme.modalTitle}>
                            {formData.id ? 'Edit Project' : 'Add Project'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Project Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={darkTheme.input}
                                    placeholder="e.g., Website Redesign"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Client</label>
                                    <select
                                        value={formData.client_id || ''}
                                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className={darkTheme.select}
                                    >
                                        <option value="">No Client</option>
                                        {clients.map(client => (
                                            <option key={client.id} value={client.id}>{client.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Default Category (For Breakdown) *</label>
                                    <select
                                        value={formData.category_id || ''}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className={darkTheme.select}
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Expected Total</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.expected_amount || ''}
                                        onChange={(e) => setFormData({ ...formData, expected_amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        className={darkTheme.input}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Hourly Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.hourly_rate || ''}
                                        onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        className={darkTheme.input}
                                        placeholder="e.g., 500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.start_date || ''}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className={darkTheme.input}
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>End Date</label>
                                    <input
                                        type="date"
                                        value={formData.end_date || ''}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        className={darkTheme.input}
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
                                    placeholder="Project details, milestones, etc."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-slate-700 pt-4">
                                <div>
                                    <label className={darkTheme.label}>SRS Status</label>
                                    <select
                                        value={formData.srs_status || 'Draft'}
                                        onChange={(e) => setFormData({ ...formData, srs_status: e.target.value as any })}
                                        className={darkTheme.select}
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Sent">Sent</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={darkTheme.label}>SRS Approved Date</label>
                                    <input
                                        type="date"
                                        value={formData.srs_approved_date || ''}
                                        onChange={(e) => setFormData({ ...formData, srs_approved_date: e.target.value })}
                                        className={darkTheme.input}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className={darkTheme.label}>SRS Internal Link</label>
                                    <input
                                        type="url"
                                        value={formData.srs_internal_link || ''}
                                        onChange={(e) => setFormData({ ...formData, srs_internal_link: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="Internal doc link"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className={darkTheme.label}>Client Approved SRS Link</label>
                                    <input
                                        type="url"
                                        value={formData.srs_client_approved_link || ''}
                                        onChange={(e) => setFormData({ ...formData, srs_client_approved_link: e.target.value })}
                                        className={darkTheme.input}
                                        placeholder="Signed/Approved doc link"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={darkTheme.label}>Status</label>
                                <select
                                    value={formData.status || 'active'}
                                    onChange={async (e) => {
                                        const newStatus = e.target.value;
                                        if (newStatus === 'completed') {
                                            // Check invoices
                                            try {
                                                const invoices = await execute<any[]>('get_invoices');
                                                const projectInvoices = invoices.filter(i => i.project_id === formData.id);
                                                const hasPending = projectInvoices.some(i => i.status !== 'Paid');
                                                if (hasPending) {
                                                    Swal.fire({
                                                        title: 'Payment Pending',
                                                        text: 'Project cannot be completed until all invoices are fully paid.',
                                                        icon: 'error',
                                                        background: '#1e293b',
                                                        color: '#f1f5f9'
                                                    });
                                                    return;
                                                }
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }
                                        setFormData({ ...formData, status: newStatus as any, completed: newStatus === 'completed' });
                                    }}
                                    className={darkTheme.select}
                                >
                                    <option value="active">🟢 Active</option>
                                    <option value="on_hold">⏸️ On Hold</option>
                                    <option value="prospect">🎯 Prospect</option>
                                    <option value="completed">✅ Completed</option>
                                    <option value="cancelled">❌ Cancelled</option>
                                    <option value="archived">📁 Archived</option>
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

            {showTimeLog && (
                <div className={`${darkTheme.modalOverlay} z-[60]`}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>{editingLogId ? 'Edit Work Log' : 'Log Work Time'}</h2>
                        <form onSubmit={handleTimeLogSubmit} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Date</label>
                                <input
                                    type="date"
                                    required
                                    value={timeLogData.date}
                                    onChange={(e) => setTimeLogData({ ...timeLogData, date: e.target.value })}
                                    className={darkTheme.input}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Total Hours</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={timeLogData.hours}
                                        onChange={(e) => setTimeLogData({ ...timeLogData, hours: parseFloat(e.target.value) || 0 })}
                                        className={darkTheme.input}
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Log Earning</label>
                                    <div className="p-2 bg-slate-700/50 rounded text-slate-200 font-mono">
                                        {formatCurrency(timeLogData.hours * (projects.find(p => p.id === selectedProjectId)?.hourly_rate || 0))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowTimeLog(false); setEditingLogId(undefined); }}
                                    className={darkTheme.btnCancel}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className={darkTheme.btnPrimary}>
                                    {editingLogId ? 'Update Log' : 'Save Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showViewLogs && viewLogsProjectId && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.modalTitle}>
                                Time Log History - {projects.find(p => p.id === viewLogsProjectId)?.name}
                            </h2>
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold border border-blue-500/20">
                                Total: {projectTimeLogs[viewLogsProjectId]?.reduce((sum, log) => sum + log.hours, 0) || 0}h
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {projectTimeLogs[viewLogsProjectId]?.length > 0 ? (
                                projectTimeLogs[viewLogsProjectId].map((log) => (
                                    <div key={log.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 group/log">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className="text-sm font-mono text-blue-400">{log.date}</span>
                                                {log.created_at && (
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        Logged: {new Date(log.created_at).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-lg font-bold text-green-400 block leading-none">{log.hours}h</span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover/log:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditTimeLog(log)}
                                                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400 transition-colors"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => log.id && handleDeleteTimeLog(log.id, viewLogsProjectId)}
                                                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 italic mb-2">No time logs yet.</p>
                                    <p className="text-xs text-slate-600">Click "Log Time" to add your first entry.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowViewLogs(false)}
                                className={darkTheme.btnCancel}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Logs Modal */}
            {showPayments && paymentLogsProjectId && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.modalTitle}>
                                Payment History - {projects.find(p => p.id === paymentLogsProjectId)?.name}
                            </h2>
                            <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-bold border border-green-500/20">
                                Total Received: {formatCurrency(projectPayments[paymentLogsProjectId]?.reduce((sum, p) => sum + p.amount, 0) || 0)}
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {projectPayments[paymentLogsProjectId]?.length > 0 ? (
                                projectPayments[paymentLogsProjectId].map((payment) => (
                                    <div key={payment.id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-mono text-blue-400">{payment.date}</span>
                                                    <span className="text-[10px] px-2 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-700 font-medium">
                                                        {payment.account_name}
                                                    </span>
                                                </div>
                                                {payment.notes && (
                                                    <p className="text-sm text-slate-300 mt-2 bg-slate-900/30 p-2 rounded italic">
                                                        "{payment.notes}"
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-green-400">
                                                    {formatCurrency(payment.amount)}
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                                                    Transaction #{payment.id}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 italic mb-2">No payments recorded for this project.</p>
                                    <p className="text-xs text-slate-600">Link income transactions to this project in the Transactions screen.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowPayments(false)}
                                className={darkTheme.btnCancel}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── CLIENTS TAB ─── */}
            {activeTab === 'clients' && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        {clients.map((client) => (
                            <div
                                key={client.id}
                                className={`${darkTheme.card} p-6 cursor-pointer hover:border-purple-500/50 transition-all group`}
                                onClick={() => handleClientEdit(client)}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-purple-400 transition-colors">
                                        {client.name}
                                    </h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        client.status === 'inactive' ? 'bg-slate-500/10 text-slate-500 border border-slate-500/20' :
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
                                        <div className="flex items-center gap-2 text-xs text-slate-400"><span>📧</span> {client.email}</div>
                                    )}
                                    {client.contact_number && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400"><span>📞</span> {client.contact_number}</div>
                                    )}
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-700/50">
                                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Projects</div>
                                    <div className="text-sm font-bold text-slate-300 mt-1">
                                        {projects.filter(p => p.client_id === client.id).length} project(s)
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {clients.length === 0 && !loading && (
                        <div className={darkTheme.empty + " min-h-[300px]"}>
                            <div className="text-4xl mb-4">👥</div>
                            <p>No clients yet. Add your first client to get started!</p>
                        </div>
                    )}
                </div>
            )}

            {/* Client Form Modal */}
            {showClientForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge + " max-w-2xl"}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.modalTitle}>
                                {clientFormData.id ? 'Edit Client Profile' : 'New Client Registration'}
                            </h2>
                            <button onClick={() => setShowClientForm(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleClientSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className={darkTheme.label}>Display Name (Personal/Main) *</label>
                                    <input type="text" required value={clientFormData.name} onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })} className={darkTheme.input} placeholder="e.g., John Doe" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={darkTheme.label}>Business / Legal Name</label>
                                    <input type="text" value={clientFormData.business_name || ''} onChange={(e) => setClientFormData({ ...clientFormData, business_name: e.target.value })} className={darkTheme.input} placeholder="e.g., Acme Solutions Pvt Ltd" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={darkTheme.label}>Business Address</label>
                                    <textarea value={clientFormData.address || ''} onChange={(e) => setClientFormData({ ...clientFormData, address: e.target.value })} className={darkTheme.input + " min-h-[80px]"} placeholder="Street, City, State, PIN" />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Contact Number</label>
                                    <input type="text" value={clientFormData.contact_number || ''} onChange={(e) => setClientFormData({ ...clientFormData, contact_number: e.target.value })} className={darkTheme.input} placeholder="+91 XXXXX XXXXX" />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Email Address</label>
                                    <input type="email" value={clientFormData.email || ''} onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })} className={darkTheme.input} placeholder="client@example.com" />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>GST Number (Optional)</label>
                                    <input type="text" value={clientFormData.gst || ''} onChange={(e) => setClientFormData({ ...clientFormData, gst: e.target.value })} className={darkTheme.input} placeholder="29AAAAA0000A1Z5" />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Status</label>
                                    <select value={clientFormData.status || 'active'} onChange={(e) => setClientFormData({ ...clientFormData, status: e.target.value as any })} className={darkTheme.select}>
                                        <option value="active">Active</option>
                                        <option value="prospect">Prospect</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={darkTheme.label}>Internal Notes</label>
                                <textarea value={clientFormData.notes || ''} onChange={(e) => setClientFormData({ ...clientFormData, notes: e.target.value })} className={darkTheme.input + " min-h-[60px]"} placeholder="Any internal reminders..." />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowClientForm(false)} className={darkTheme.btnCancel}>Discard</button>
                                <button type="submit" className={darkTheme.btnPrimary + " px-8"}>
                                    {clientFormData.id ? 'Save Changes' : 'Register Client'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}


