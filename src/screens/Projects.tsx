import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Project, Client, TimeLog, ProjectPayment } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';

export default function Projects() {
    const { execute, loading } = useDatabase();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    // Project Form State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Project>({
        name: '',
        client_id: undefined,
        expected_amount: undefined,
        daily_rate: undefined,
        start_date: '',
        end_date: '',
        notes: '',
        completed: false,
        status: 'active',
    });

    // Time Log State
    const [showTimeLog, setShowTimeLog] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
    const [showViewLogs, setShowViewLogs] = useState(false);
    const [viewLogsProjectId, setViewLogsProjectId] = useState<number | undefined>();
    const [projectTimeLogs, setProjectTimeLogs] = useState<Record<number, TimeLog[]>>({});
    const [editingLogId, setEditingLogId] = useState<number | undefined>();
    const [timeLogData, setTimeLogData] = useState({
        hours: 8,
        task: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '17:00'
    });

    // Payment Log State
    const [showPayments, setShowPayments] = useState(false);
    const [paymentLogsProjectId, setPaymentLogsProjectId] = useState<number | undefined>();
    const [projectPayments, setProjectPayments] = useState<Record<number, ProjectPayment[]>>({});

    useEffect(() => {
        loadProjects();
        loadClients();
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
                expected_amount: undefined,
                daily_rate: undefined,
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
                task: '',
                date: new Date().toISOString().split('T')[0],
                start_time: '09:00',
                end_time: '17:00'
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
            task: log.task || '',
            date: log.date,
            start_time: log.start_time || '09:00',
            end_time: log.end_time || '17:00'
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

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className={darkTheme.title}>Projects</h1>
                <button
                    onClick={() => {
                        setFormData({
                            name: '',
                            client_id: undefined,
                            expected_amount: undefined,
                            daily_rate: undefined,
                            start_date: '',
                            end_date: '',
                            notes: '',
                            completed: false,
                            status: 'active',
                        });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Project
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            <div className="space-y-8">
                {/* Active Projects */}
                <div>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-l-2 border-blue-500 pl-3">Active Projects</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.filter(p => p.status === 'active' || p.status === 'on_hold' || p.status === 'prospect').map((project) => (
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
                                    {project.status && project.status !== 'active' && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${project.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
                                                project.status === 'prospect' ? 'bg-purple-500/20 text-purple-400' :
                                                    project.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {project.status === 'on_hold' ? '⏸️ On Hold' :
                                                project.status === 'prospect' ? '🎯 Prospect' :
                                                    project.status === 'cancelled' ? '❌ Cancelled' :
                                                        project.status}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-blue-400 mb-4">{getClientName(project.client_id)}</p>

                                <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-700/50 rounded-lg">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase">Earned (Time)</div>
                                        <div className="text-sm font-bold text-slate-100">
                                            {formatCurrency(((project.logged_hours || 0) / 8) * (project.daily_rate || 0))}
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
                                        <div className="text-[10px] text-slate-400 uppercase">Spent</div>
                                        <div className="text-sm font-bold text-orange-400">
                                            {formatCurrency(project.spent_amount || 0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase">Actual Rate</div>
                                        <div className="text-sm font-bold text-green-400">
                                            {project.logged_hours && project.logged_hours > 0
                                                ? formatCurrency((project.received_amount || 0) / (project.logged_hours / 8))
                                                : '---'}
                                            <span className="text-[10px] text-slate-500 font-normal ml-1">/day</span>
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
                                    {project.daily_rate ? (
                                        <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700 font-mono">
                                            Target: {formatCurrency(project.daily_rate)}/day
                                        </span>
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
                                                <td className="px-4 py-3 text-slate-200 text-sm">{formatCurrency(((project.logged_hours || 0) / 8) * (project.daily_rate || 0))}</td>
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
                                                        ? formatCurrency((project.received_amount || 0) / (project.logged_hours / 8))
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
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {projects.length === 0 && !loading && (
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
                                    <label className={darkTheme.label}>Daily Rate (8 hrs)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.daily_rate || ''}
                                        onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                                        className={darkTheme.input}
                                        placeholder="e.g., 1000"
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

                            <div>
                                <label className={darkTheme.label}>Status</label>
                                <select
                                    value={formData.status || 'active'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any, completed: e.target.value === 'completed' })}
                                    className={darkTheme.select}
                                >
                                    <option value="active">🟢 Active</option>
                                    <option value="on_hold">⏸️ On Hold</option>
                                    <option value="prospect">🎯 Prospect</option>
                                    <option value="completed">✅ Completed</option>
                                    <option value="cancelled">❌ Cancelled</option>
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
                                    <label className={darkTheme.label}>Start Time</label>
                                    <input
                                        type="time"
                                        required
                                        value={timeLogData.start_time}
                                        onChange={(e) => {
                                            const startTime = e.target.value;
                                            const endTime = timeLogData.end_time;
                                            let hours = timeLogData.hours;

                                            if (startTime && endTime) {
                                                const startParts = startTime.split(':').map(Number);
                                                const endParts = endTime.split(':').map(Number);
                                                let diffMin = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1]);
                                                if (diffMin < 0) diffMin += 24 * 60;
                                                hours = Math.round((diffMin / 60) * 10) / 10;
                                            }

                                            setTimeLogData({ ...timeLogData, start_time: startTime, hours });
                                        }}
                                        className={darkTheme.input}
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>End Time</label>
                                    <input
                                        type="time"
                                        required
                                        value={timeLogData.end_time}
                                        onChange={(e) => {
                                            const endTime = e.target.value;
                                            const startTime = timeLogData.start_time;
                                            let hours = timeLogData.hours;

                                            if (startTime && endTime) {
                                                const startParts = startTime.split(':').map(Number);
                                                const endParts = endTime.split(':').map(Number);
                                                let diffMin = (endParts[0] * 60 + endParts[1]) - (startParts[0] * 60 + startParts[1]);
                                                if (diffMin < 0) diffMin += 24 * 60;
                                                hours = Math.round((diffMin / 60) * 10) / 10;
                                            }

                                            setTimeLogData({ ...timeLogData, end_time: endTime, hours });
                                        }}
                                        className={darkTheme.input}
                                    />
                                </div>
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
                                    <label className={darkTheme.label}>Daily Earning</label>
                                    <div className="p-2 bg-slate-700/50 rounded text-slate-200 font-mono">
                                        {formatCurrency((timeLogData.hours / 8) * (projects.find(p => p.id === selectedProjectId)?.daily_rate || 0))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={darkTheme.label}>Task Description</label>
                                <textarea
                                    value={timeLogData.task}
                                    onChange={(e) => setTimeLogData({ ...timeLogData, task: e.target.value })}
                                    className={darkTheme.textarea}
                                    rows={2}
                                    placeholder="What did you work on?"
                                />
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
                                                    {log.start_time && log.end_time && (
                                                        <span className="text-[10px] text-slate-500 font-mono italic">
                                                            ({log.start_time} - {log.end_time})
                                                        </span>
                                                    )}
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
                                        {log.task && (
                                            <p className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded">{log.task}</p>
                                        )}
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
        </div>
    );
}
