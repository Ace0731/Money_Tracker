import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { darkTheme } from '../utils/theme';
import { formatCurrency } from '../utils/formatters';
import type { Quotation, QuotationItem, Client, CompanySettings } from '../types';
import { generatePDF } from '../utils/pdfGenerator';
import Swal from 'sweetalert2';

const DEFAULT_PAYMENT_TERMS = "• 30% Advance\n• 40% After Demo\n• 30% On Deployment";
const DEFAULT_TERMS_CONDITIONS = "• The scope of work is limited to the features mentioned above.\n• Hosting and Domain charges are separate and recurring annually.\n• Up to 3 major revisions are included in the above cost.\n• 1 year of free technical support is provided after deployment.";

export default function Quotations() {
    const { execute, loading } = useDatabase();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanySettings | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState<Quotation>({
        client_id: 0,
        project_title: '',
        quotation_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        valid_till: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_amount: 0,
        status: 'Draft',
        payment_terms: DEFAULT_PAYMENT_TERMS,
        terms_conditions: DEFAULT_TERMS_CONDITIONS,
        items: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [qData, cData, sData] = await Promise.all([
                execute<Quotation[]>('get_quotations'),
                execute<Client[]>('get_clients'),
                execute<Record<string, string>>('get_company_settings')
            ]);
            setQuotations(qData);
            setClients(cData.filter(c => (c.status as string) !== 'archived'));

            if (sData) {
                setCompanyInfo({
                    company_name: sData.company_name,
                    company_subtitle: sData.company_subtitle,
                    company_address: sData.company_address,
                    owner_name: sData.owner_name,
                    company_phone: sData.company_phone,
                    company_email: sData.company_email,
                    company_logo: sData.company_logo,
                    bank_name: sData.bank_name,
                    account_number: sData.account_number,
                    ifsc_code: sData.ifsc_code,
                    upi_id: sData.upi_id,
                    pdf_theme_color: sData.pdf_theme_color,
                    pdf_footer_text: sData.pdf_footer_text,
                    show_qr_code: sData.show_qr_code === 'true',
                    pdf_header_style: sData.pdf_header_style as any,
                    pdf_font_size: parseInt(sData.pdf_font_size || '10')
                });
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    const handleAddSection = () => {
        const newSection: QuotationItem = {
            description: '',
            timeline: '',
            features: '',
            quantity: 1,
            rate: 0,
            amount: 0
        };
        setFormData({
            ...formData,
            items: [...(formData.items || []), newSection]
        });
    };

    const handleRemoveSection = (index: number) => {
        const newItems = [...(formData.items || [])];
        newItems.splice(index, 1);
        calculateTotal(newItems);
    };

    const handleSectionChange = (index: number, field: keyof QuotationItem, value: any) => {
        const newItems = [...(formData.items || [])];
        const item = { ...newItems[index], [field]: value };

        if (field === 'rate') {
            item.amount = (item.rate || 0);
        }

        newItems[index] = item;
        calculateTotal(newItems);
    };

    const calculateTotal = (items: QuotationItem[]) => {
        const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        setFormData({ ...formData, items, total_amount: total });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.client_id === 0) {
            Swal.fire('Error', 'Please select a client', 'error');
            return;
        }
        if (!formData.project_title) {
            Swal.fire('Error', 'Please enter a project title', 'error');
            return;
        }
        if (!formData.items || formData.items.length === 0) {
            Swal.fire('Error', 'Please add at least one section', 'error');
            return;
        }

        try {
            if (formData.id) {
                await execute('update_quotation', { quotation: formData });
            } else {
                await execute('create_quotation', { quotation: formData });
            }
            await loadData();
            setShowForm(false);
            resetForm();
            Swal.fire({
                title: 'Success!',
                text: 'Quotation saved successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#f1f5f9'
            });
        } catch (error) {
            console.error('Failed to save quotation:', error);
            Swal.fire('Error', 'Failed to save quotation', 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            client_id: 0,
            project_title: '',
            quotation_number: '',
            issue_date: new Date().toISOString().split('T')[0],
            valid_till: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            total_amount: 0,
            status: 'Draft',
            payment_terms: DEFAULT_PAYMENT_TERMS,
            terms_conditions: DEFAULT_TERMS_CONDITIONS,
            items: []
        });
    };

    const handleEdit = async (q: Quotation) => {
        try {
            const details = await execute<Quotation>('get_quotation_details', { id: q.id });
            setFormData(details);
            setShowForm(true);
        } catch (error) {
            console.error('Failed to load quotation details:', error);
        }
    };

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            background: '#1e293b',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                await execute('delete_quotation', { id });
                await loadData();
                Swal.fire('Deleted!', 'Quotation has been deleted.', 'success');
            } catch (error) {
                Swal.fire('Error', 'Failed to delete quotation', 'error');
            }
        }
    };

    const handleExportPDF = async (q: Quotation) => {
        if (!companyInfo) {
            Swal.fire('Error', 'Company settings not found', 'error');
            return;
        }

        try {
            const details = await execute<Quotation>('get_quotation_details', { id: q.id });
            await generatePDF('Quotation', details, companyInfo, '');
            Swal.fire({
                title: 'PDF Generated',
                text: 'Your quotation has been saved to your downloads folder.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end',
                background: '#1e293b',
                color: '#f1f5f9'
            });
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            Swal.fire('Error', 'Failed to generate PDF', 'error');
        }
    };

    const handleConvertToProject = async (q: Quotation) => {
        const result = await Swal.fire({
            title: 'Create Project?',
            text: `Create a new project for "${q.project_title}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, create it!',
            background: '#1e293b',
            color: '#f1f5f9'
        });

        if (result.isConfirmed) {
            try {
                // 1. Create Project
                const pData = {
                    name: q.project_title,
                    client_id: q.client_id,
                    expected_amount: q.total_amount,
                    status: 'active',
                    notes: `Created from Quotation #${q.quotation_number}`
                };

                // Try to get ID from return, or fetch
                const createRes = await execute<any>('create_project', { project: pData });
                let newProjectId = createRes?.id || createRes;

                if (!newProjectId || typeof newProjectId !== 'number') {
                    // Fallback: fetch projects and find the one we just made
                    const allProjects = await execute<any[]>('get_projects');
                    // Find most recent with matching name
                    const match = allProjects.find(p => p.name === q.project_title && p.client_id === q.client_id);
                    if (match) newProjectId = match.id;
                }

                if (newProjectId) {
                    // 2. Update Quotation with Link
                    await execute('update_quotation', { quotation: { ...q, project_id: newProjectId } });
                    await loadData();
                    Swal.fire({
                        title: 'Project Created!',
                        text: 'Quotation linked successfully.',
                        icon: 'success',
                        timer: 2000,
                        background: '#1e293b',
                        color: '#f1f5f9'
                    });
                } else {
                    throw new Error('Could not retrieve new Project ID');
                }

            } catch (error) {
                console.error('Failed to convert:', error);
                Swal.fire('Error', 'Failed to create linked project', 'error');
            }
        }
    };


    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Quotation Maker</h1>
                    <p className="text-sm text-slate-400">Design professional proposals for your clients</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className={darkTheme.btnPrimary}
                >
                    + Create New Quotation
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quotations.map((q) => (
                    <div key={q.id} className={darkTheme.card + " p-6 flex flex-col group hover:border-blue-500/50 transition-all"}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-100 truncate">{q.project_title || q.quotation_number}</h3>
                                <p className="text-sm text-blue-400">{q.client_name}</p>
                            </div>
                            <span className={`ml-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${q.status === 'Approved' ? 'bg-green-900/40 text-green-400 border border-green-700' :
                                q.status === 'Sent' ? 'bg-blue-900/40 text-blue-400 border border-blue-700' :
                                    q.status === 'Rejected' ? 'bg-red-900/40 text-red-400 border border-red-700' :
                                        'bg-slate-700 text-slate-300'
                                }`}>
                                {q.status}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Total Investment:</span>
                                <span className="font-bold text-slate-100">{formatCurrency(q.total_amount)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Date:</span>
                                <span className="text-slate-300">{q.issue_date}</span>
                            </div>
                        </div>

                        <div className="mt-auto flex gap-2 pt-4 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleExportPDF(q)}
                                title="Download PDF"
                                className="flex-1 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-600/20 transition-colors"
                            >
                                PDF
                            </button>
                            <button
                                onClick={() => handleEdit(q)}
                                title="Edit Quotation"
                                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-white/5 transition-colors"
                            >
                                EDIT
                            </button>
                            <button
                                onClick={() => q.id && handleDelete(q.id)}
                                title="Delete"
                                className="px-3 py-1.5 bg-red-900/10 hover:bg-red-900/20 text-red-400 rounded border border-red-900/20 transition-colors"
                            >
                                🗑️
                            </button>
                        </div>

                        {/* Convert to Project Action */}
                        {q.status === 'Approved' && !q.project_id && (
                            <button
                                onClick={() => handleConvertToProject(q)}
                                className="w-full mt-3 py-2 bg-green-600/10 hover:bg-green-600/20 text-green-400 text-xs font-bold rounded border border-green-600/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
                            >
                                📂 Convert to Project
                            </button>
                        )}
                        {q.project_id && (
                            <div className="w-full mt-3 py-2 text-center text-xs text-slate-500 font-mono opacity-0 group-hover:opacity-100">
                                Linked Project ID: {q.project_id}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {
                quotations.length === 0 && !loading && (
                    <div className={darkTheme.empty + " min-h-[400px]"}>
                        <div className="text-4xl mb-4">📜</div>
                        <p>No quotations yet. Start by creating a premium proposal!</p>
                    </div>
                )
            }

            {
                showForm && (
                    <div className={darkTheme.modalOverlay}>
                        <div className={darkTheme.modalContentLarge + " max-w-5xl h-[90vh] flex flex-col"}>
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                                <h2 className={darkTheme.modalTitle}>
                                    {formData.id ? 'Edit Proposal' : 'Design New Proposal'}
                                </h2>
                                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                {/* Section A: Client & Project Basic */}
                                <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 space-y-6">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                        Core Information
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="md:col-span-2">
                                            <label className={darkTheme.label}>Project Title *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.project_title}
                                                onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
                                                className={darkTheme.input}
                                                placeholder="e.g., E-commerce Website + Admin Panel"
                                            />
                                        </div>
                                        <div>
                                            <label className={darkTheme.label}>Client *</label>
                                            <select
                                                required
                                                value={formData.client_id}
                                                onChange={(e) => setFormData({ ...formData, client_id: parseInt(e.target.value) })}
                                                className={darkTheme.select}
                                            >
                                                <option value={0}>Select a Client</option>
                                                {clients.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className={darkTheme.label}>Quotation #</label>
                                            <input
                                                type="text"
                                                value={formData.quotation_number}
                                                onChange={(e) => setFormData({ ...formData, quotation_number: e.target.value })}
                                                className={darkTheme.input}
                                                placeholder="Leave empty for auto-gen"
                                            />
                                        </div>
                                        <div>
                                            <label className={darkTheme.label}>Issue Date</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.issue_date}
                                                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                                                className={darkTheme.input}
                                            />
                                        </div>
                                        <div>
                                            <label className={darkTheme.label}>Valid Until</label>
                                            <input
                                                type="date"
                                                required
                                                value={formData.valid_till}
                                                onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })}
                                                className={darkTheme.input}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section B: Scope Sections */}
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                            Scope Breakdown
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={handleAddSection}
                                            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-bold shadow-lg shadow-blue-500/20"
                                        >
                                            + Add Scope Section
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {formData.items?.map((section, idx) => (
                                            <div key={idx} className="bg-slate-800/40 p-6 rounded-xl border border-white/5 relative group animate-in fade-in slide-in-from-top-2 duration-300">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSection(idx)}
                                                    className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-red-500/20 border border-red-500/50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                                >
                                                    ✕
                                                </button>

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                                                    <div className="md:col-span-2">
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Section Title</label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={section.description}
                                                            onChange={(e) => handleSectionChange(idx, 'description', e.target.value)}
                                                            className={darkTheme.input + " border-slate-700 focus:border-blue-500 bg-slate-900/50"}
                                                            placeholder="e.g., Frontend Development"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Timeline (Days)</label>
                                                        <input
                                                            type="text"
                                                            value={section.timeline || ''}
                                                            onChange={(e) => handleSectionChange(idx, 'timeline', e.target.value)}
                                                            className={darkTheme.input + " border-slate-700 focus:border-blue-500 bg-slate-900/50"}
                                                            placeholder="e.g., 15 Days"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Cost (₹)</label>
                                                        <input
                                                            type="number"
                                                            required
                                                            value={section.rate}
                                                            onChange={(e) => handleSectionChange(idx, 'rate', parseFloat(e.target.value))}
                                                            className={darkTheme.input + " border-slate-700 focus:border-blue-500 bg-slate-900/50"}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Features / Bullet List (One per line)</label>
                                                    <textarea
                                                        value={section.features || ''}
                                                        onChange={(e) => handleSectionChange(idx, 'features', e.target.value)}
                                                        className={darkTheme.input + " min-h-[100px] border-slate-700 focus:border-blue-500 bg-slate-900/50 font-mono text-sm"}
                                                        placeholder="• Fully Responsive Design&#10;• SEO Optimization&#10;• Payment Gateway Integration"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {(!formData.items || formData.items.length === 0) && (
                                            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                                                <p className="text-slate-500 italic">No scope sections added yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section C: Investment Summary */}
                                <div className="bg-slate-900/80 p-6 rounded-xl border border-blue-500/20">
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                        Investment Summary
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-white/5 text-slate-500">
                                                    <th className="text-left py-2 font-normal">Description</th>
                                                    <th className="text-right py-2 font-normal">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {formData.items?.map((item, i) => (
                                                    <tr key={i}>
                                                        <td className="py-3 text-slate-300">{item.description || `Section ${i + 1}`}</td>
                                                        <td className="py-3 text-right text-slate-100 font-mono">{formatCurrency(item.amount)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="text-lg">
                                                    <td className="py-4 font-bold text-slate-100">Grand Total Investment</td>
                                                    <td className="py-4 text-right font-bold text-blue-400 font-mono">
                                                        {formatCurrency(formData.total_amount)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Section D: Payment & Terms */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                            Payment Structure
                                        </h3>
                                        <textarea
                                            value={formData.payment_terms}
                                            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                            className={darkTheme.input + " min-h-[150px] border-slate-700 focus:border-blue-500 bg-slate-900/50"}
                                            placeholder="e.g., • 50% Advance..."
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                            Terms & Conditions
                                        </h3>
                                        <textarea
                                            value={formData.terms_conditions}
                                            onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                                            className={darkTheme.input + " min-h-[150px] border-slate-700 focus:border-blue-500 bg-slate-900/50"}
                                        />
                                    </div>
                                </div>
                            </form>

                            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-white/5 bg-slate-900/50 -mx-6 -mb-6 p-6 px-12">
                                <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>
                                    Discard
                                </button>
                                <button
                                    onClick={(e) => handleSubmit(e as any)}
                                    className={darkTheme.btnPrimary + " px-12"}
                                >
                                    {formData.id ? 'Save Changes' : 'Finalize Proposal'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div >
    );
}
