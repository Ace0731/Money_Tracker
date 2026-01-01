import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Project, Client } from '../types';
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
    });

    // Time Log State
    const [showTimeLog, setShowTimeLog] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
    const [timeLogData, setTimeLogData] = useState({
        hours: 8,
        task: '',
        date: new Date().toISOString().split('T')[0],
    });

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
            await execute('create_time_log', {
                log: {
                    project_id: selectedProjectId,
                    ...timeLogData
                }
            });
            await loadProjects();
            setShowTimeLog(false);
            setTimeLogData({
                hours: 8,
                task: '',
                date: new Date().toISOString().split('T')[0],
            });
        } catch (error) {
            console.error('Failed to log time:', error);
        }
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
                        });
                        setShowForm(true);
                    }}
                    className={darkTheme.btnPrimary}
                >
                    Add Project
                </button>
            </div>

            {loading && <div className={darkTheme.loading}>Loading...</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                    <div
                        key={project.id}
                        className={`${darkTheme.card} p-6 cursor-pointer`}
                        onClick={() => handleEdit(project)}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold text-slate-100">{project.name}</h3>
                            {project.expected_amount && (
                                <span className="text-sm font-bold text-green-400">
                                    {formatCurrency(project.expected_amount)}
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
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase">Received</div>
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
                            {project.logged_hours && project.logged_hours > 0 ? (
                                <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full border border-green-500/20 font-mono">
                                    Actual: {formatCurrency((project.received_amount! / project.logged_hours) * 8)}/day
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
                        </div>
                    </div>
                ))}
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
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent}>
                        <h2 className={darkTheme.modalTitle}>Log Work Time</h2>
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
                                    <label className={darkTheme.label}>Hours</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        required
                                        value={timeLogData.hours}
                                        onChange={(e) => setTimeLogData({ ...timeLogData, hours: parseFloat(e.target.value) })}
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
                                <button type="button" onClick={() => setShowTimeLog(false)} className={darkTheme.btnCancel}>
                                    Cancel
                                </button>
                                <button type="submit" className={darkTheme.btnPrimary}>
                                    Save Log
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
