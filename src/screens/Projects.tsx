import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import type { Project, Client } from '../types';
import { formatCurrency } from '../utils/formatters';
import { darkTheme } from '../utils/theme';

export default function Projects() {
    const { execute, loading } = useDatabase();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<Project>({
        name: '',
        client_id: undefined,
        expected_amount: undefined,
        start_date: '',
        end_date: '',
        notes: '',
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

                        <p className="text-sm text-blue-400 mb-2">{getClientName(project.client_id)}</p>

                        {(project.start_date || project.end_date) && (
                            <div className="text-sm text-slate-400 mb-2">
                                {project.start_date && <div>Start: {project.start_date}</div>}
                                {project.end_date && <div>End: {project.end_date}</div>}
                            </div>
                        )}

                        {project.notes && <p className="text-sm text-slate-400">{project.notes}</p>}
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

                            <div>
                                <label className={darkTheme.label}>Expected Amount</label>
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
        </div>
    );
}
