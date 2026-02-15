import React, { useEffect, useState, useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { darkTheme } from '../utils/theme';
import { formatCurrency } from '../utils/formatters';
import type { Invoice, InvoiceItem, InvoicePayment, Project, CompanySettings } from '../types';
import { generatePDF } from '../utils/pdfGenerator';
import { QRCodeCanvas } from 'qrcode.react';
import Swal from 'sweetalert2';

export default function Invoices() {
    const { execute, loading } = useDatabase();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanySettings | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [qrValue, setQrValue] = useState('');

    const [formData, setFormData] = useState<Invoice>({
        project_id: 0,
        invoice_number: '',
        stage: 'Advance',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_amount: 0,
        status: 'Unpaid',
        discount: 0,
        tax_percentage: 0,
        project_reference: '',
        notes: '',
        items: [],
        payments: []
    });

    const [paymentData, setPaymentData] = useState<Partial<InvoicePayment>>({
        amount_paid: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'UPI'
    });

    const [projectSummary, setProjectSummary] = useState({
        totalValue: 0,
        paidAmount: 0,
        pendingAmount: 0
    });

    useEffect(() => {
        if (formData.project_id && projects.length > 0) {
            const project = projects.find(p => p.id === formData.project_id);
            if (project) {
                // Use project's expected amount (set from Quotation) or 0
                const totalValue = project.expected_amount || 0;
                // Use project's received amount (tracked by payments) 
                // Fallback to summing paid invoices if project amount is 0/undefined
                let paidAmount = project.received_amount || 0;

                if (paidAmount === 0 && invoices.length > 0) {
                    const projectInvoices = invoices.filter(i => i.project_id === formData.project_id && (i.status === 'Paid' || i.status === 'Partially Paid'));
                    paidAmount = projectInvoices.reduce((sum, inv) => {
                        const paid = inv.payments?.reduce((pSum, p) => pSum + p.amount_paid, 0) || 0;
                        // If status is Paid but no payments recorded, assume total? No, safer to rely on payments.
                        // But for simplicity, if status is 'Paid' and no payments, we might assume full amount?
                        // Let's stick to received_amount from project if possible, otherwise 0.
                        return sum + paid;
                    }, 0);
                }

                setProjectSummary({
                    totalValue,
                    paidAmount,
                    pendingAmount: totalValue - paidAmount
                });
            }
        } else {
            setProjectSummary({ totalValue: 0, paidAmount: 0, pendingAmount: 0 });
        }
    }, [formData.project_id, projects, invoices]);

    const handleAutoFill = (type: 'Advance' | 'Milestone' | 'Final') => {
        let amount = 0;
        let desc = '';
        const total = projectSummary.totalValue;

        if (total === 0) {
            Swal.fire('Info', 'Project has no expected value set.', 'info');
            return;
        }

        if (type === 'Advance') {
            amount = Math.round(total * 0.30);
            desc = `Advance Payment (30% of ${formatCurrency(total)})`;
        } else if (type === 'Milestone') {
            amount = Math.round(total * 0.50);
            desc = `Milestone Payment (50% of ${formatCurrency(total)})`;
        } else {
            amount = projectSummary.pendingAmount;
            desc = `Final Balance Payment`;
        }

        setFormData(prev => {
            const newItems = [...(prev.items || [])];
            // Filter out empty placeholder items
            const filtered = newItems.filter(i => i.description || i.amount > 0);
            filtered.push({
                description: desc,
                quantity: 1,
                rate: amount,
                amount: amount
            });
            return calculateInvoiceTotals({ ...prev, stage: type, items: filtered });
        });
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [iData, pData, sData] = await Promise.all([
                execute<Invoice[]>('get_invoices'),
                execute<Project[]>('get_projects'),
                execute<Record<string, string>>('get_company_settings')
            ]);
            setInvoices(iData);
            setProjects(pData.filter(p => p.status !== 'archived'));

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

    const handleAddItem = () => {
        const newItem: InvoiceItem = {
            description: '',
            quantity: 1,
            rate: 0,
            amount: 0
        };
        setFormData(prev => ({
            ...prev,
            items: [...(prev.items || []), newItem]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setFormData(prev => {
            const newItems = [...(prev.items || [])];
            newItems.splice(index, 1);
            return calculateInvoiceTotals({ ...prev, items: newItems });
        });
    };

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        setFormData(prev => {
            const newItems = [...(prev.items || [])];
            const item = { ...newItems[index], [field]: value };

            if (field === 'quantity' || field === 'rate') {
                item.amount = (item.quantity || 0) * (item.rate || 0);
            }

            newItems[index] = item;
            return calculateInvoiceTotals({ ...prev, items: newItems });
        });
    };

    const calculateInvoiceTotals = (data: Invoice): Invoice => {
        const subtotal = (data.items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
        const discountVal = data.discount || 0;
        const afterDiscount = subtotal - discountVal;
        const taxVal = (afterDiscount * (data.tax_percentage || 0)) / 100;
        const total = afterDiscount + taxVal;

        return { ...data, total_amount: total };
    };

    const handleTotalModifiersChange = (field: 'discount' | 'tax_percentage', value: number) => {
        setFormData(prev => calculateInvoiceTotals({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.project_id === 0) {
            Swal.fire('Error', 'Please select a project', 'error');
            return;
        }
        if (!formData.items || formData.items.length === 0) {
            Swal.fire('Error', 'Please add at least one item', 'error');
            return;
        }

        let submissionData = { ...formData };
        if (!submissionData.invoice_number.trim()) {
            const nextId = (invoices.length > 0 ? Math.max(...invoices.map(i => i.id || 0)) : 0) + 1;
            submissionData.invoice_number = `INV-${new Date().getFullYear()}-${String(nextId).padStart(3, '0')}`;
        }

        try {
            await execute('create_invoice', { invoice: submissionData });
            await loadData();
            setShowForm(false);
            resetForm();
            Swal.fire({
                title: 'Success!',
                text: 'Invoice generated successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                background: '#1e293b',
                color: '#f1f5f9'
            });
        } catch (error) {
            console.error('Invoice creation failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            Swal.fire('Error', `Failed to create invoice: ${message}`, 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            project_id: 0,
            invoice_number: '',
            stage: 'Advance',
            issue_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            total_amount: 0,
            status: 'Unpaid',
            discount: 0,
            tax_percentage: 0,
            project_reference: '',
            notes: '',
            items: [],
            payments: []
        });
    };

    const liveQrValue = useMemo(() => {
        if (companyInfo?.upi_id && formData.total_amount > 0) {
            return `upi://pay?pa=${companyInfo.upi_id}&pn=${encodeURIComponent(companyInfo.company_name)}&am=${formData.total_amount.toFixed(2)}&cu=INR`;
        }
        return '';
    }, [companyInfo, formData.total_amount]);

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        try {
            await execute('add_invoice_payment', {
                payment: { ...paymentData, invoice_id: selectedInvoice.id }
            });
            await loadData();
            setShowPaymentModal(false);
            Swal.fire('Success!', 'Payment recorded successfully', 'success');
        } catch (error) {
            Swal.fire('Error', 'Failed to record payment', 'error');
        }
    };

    const viewDetails = async (invoice: Invoice) => {
        if (!companyInfo) {
            Swal.fire('Error', 'Company settings not found', 'error');
            return;
        }

        try {
            const details = await execute<Invoice>('get_invoice_details', { id: invoice.id });

            let qrDataUrl = '';
            if (companyInfo.show_qr_code && companyInfo.upi_id) {
                const curated = `upi://pay?pa=${companyInfo.upi_id}&pn=${encodeURIComponent(companyInfo.company_name)}&am=${invoice.total_amount.toFixed(2)}&cu=INR`;
                setQrValue(curated);

                await new Promise(resolve => setTimeout(resolve, 200));

                const canvas = document.getElementById('qr-gen-canvas') as HTMLCanvasElement;
                if (canvas) {
                    qrDataUrl = canvas.toDataURL('image/png');
                }
            }

            // Inject Project Summary
            const project = projects.find(p => p.id === invoice.project_id);
            const summary = project ? {
                totalValue: project.expected_amount || 0,
                paidAmount: project.received_amount || 0,
                pendingAmount: (project.expected_amount || 0) - (project.received_amount || 0)
            } : undefined;

            const pdfData = { ...details, projectSummary: summary };

            await generatePDF('Invoice', pdfData, companyInfo, qrDataUrl);
            Swal.fire({
                title: 'PDF Exported',
                text: 'Invoice has been saved to your downloads.',
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

    return (
        <div className="p-6">
            {/* Hidden QR Generator for PDF */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                {qrValue && (
                    <QRCodeCanvas id="qr-gen-canvas" value={qrValue} size={512} level="H" />
                )}
            </div>

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title}>Invoices</h1>
                    <p className="text-sm text-slate-400">Professional billing and payment tracking</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className={darkTheme.btnPrimary}
                >
                    + Create Invoice
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {invoices.map((inv) => {
                    const totalPaid = inv.payments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;
                    const balance = inv.total_amount - totalPaid;

                    return (
                        <div key={inv.id} className={darkTheme.card + " p-6 flex flex-col group hover:border-blue-500/50 transition-all"}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-slate-100 truncate">{inv.invoice_number}</h3>
                                    <p className="text-sm text-blue-400 truncate">{inv.project_name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{inv.stage} Stage</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${inv.status === 'Paid' ? 'bg-green-900/40 text-green-400 border border-green-700' :
                                    inv.status === 'Partially Paid' ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700' :
                                        'bg-red-900/40 text-red-400 border border-red-700'
                                    }`}>
                                    {inv.status}
                                </span>
                            </div>

                            <div className="space-y-3 mb-4 bg-white/5 p-3 rounded-lg">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Invoice Total:</span>
                                    <span className="font-bold text-slate-100 font-mono">{formatCurrency(inv.total_amount)}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                                    <span className="text-slate-400">Balance Due:</span>
                                    <span className={`font-bold font-mono ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {formatCurrency(balance)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-auto flex gap-2 pt-4 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => viewDetails(inv)}
                                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-white/5 transition-colors"
                                >
                                    📄 PDF
                                </button>
                                {balance > 0 && (
                                    <button
                                        onClick={() => { setSelectedInvoice(inv); setPaymentData({ ...paymentData, amount_paid: balance }); setShowPaymentModal(true); }}
                                        className="flex-1 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-600/20 transition-colors"
                                    >
                                        💰 Record
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {invoices.length === 0 && !loading && (
                <div className={darkTheme.empty + " min-h-[400px]"}>
                    <div className="text-4xl mb-4">💳</div>
                    <p>No invoices found. Bill your projects to see them here!</p>
                </div>
            )}

            {/* Create Invoice Modal */}
            {showForm && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContentLarge + " max-w-5xl h-[90vh] flex flex-col"}>
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                            <h2 className={darkTheme.modalTitle}>Generate New Invoice</h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {/* Header Info */}
                            <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 space-y-6">
                                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                    Invoice Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="md:col-span-2">
                                        <label className={darkTheme.label}>Project *</label>
                                        <select
                                            required
                                            value={formData.project_id}
                                            onChange={(e) => setFormData({ ...formData, project_id: parseInt(e.target.value) })}
                                            className={darkTheme.select}
                                        >
                                            <option value={0}>Select a Project</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={darkTheme.label}>Billing Stage</label>
                                        <select
                                            value={formData.stage}
                                            onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                                            className={darkTheme.select}
                                        >
                                            <option value="Advance">Advance</option>
                                            <option value="Milestone">Milestone</option>
                                            <option value="Final">Final Payment</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={darkTheme.label}>Project Ref</label>
                                        <input
                                            type="text"
                                            value={formData.project_reference || ''}
                                            onChange={(e) => setFormData({ ...formData, project_reference: e.target.value })}
                                            className={darkTheme.input}
                                            placeholder="e.g. QTN-2024-001"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className={darkTheme.label}>Invoice #</label>
                                        <input
                                            type="text"
                                            value={formData.invoice_number}
                                            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                            className={darkTheme.input}
                                            placeholder="Auto-generated if empty"
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
                                        <label className={darkTheme.label}>Due Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.due_date}
                                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                            className={darkTheme.input}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Project Financial Summary Panel */}
                            {formData.project_id > 0 && (
                                <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 space-y-4">
                                    <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                        Project Financials
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 p-4 bg-slate-900/50 rounded-lg">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Total Value</div>
                                            <div className="text-lg font-mono text-slate-200">{formatCurrency(projectSummary.totalValue)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Received</div>
                                            <div className="text-lg font-mono text-green-400">{formatCurrency(projectSummary.paidAmount)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Balance</div>
                                            <div className="text-lg font-mono text-blue-400">{formatCurrency(projectSummary.pendingAmount)}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <button type="button" onClick={() => handleAutoFill('Advance')} className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-xs text-slate-300 rounded border border-white/5 transition-colors">
                                            ✨ Add 30% Advance
                                        </button>
                                        <button type="button" onClick={() => handleAutoFill('Milestone')} className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-xs text-slate-300 rounded border border-white/5 transition-colors">
                                            ✨ Add 50% Milestone
                                        </button>
                                        <button type="button" onClick={() => handleAutoFill('Final')} className={darkTheme.btnPrimary + " text-center text-xs py-1.5"}>
                                            ✨ Claim Balance
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Billing Items */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                        Itemized Billing
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-xs bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/30 hover:bg-blue-500/30 font-bold transition-all"
                                    >
                                        + Add Line Item
                                    </button>
                                </div>

                                <div className="bg-slate-800/20 rounded-xl overflow-hidden border border-white/5">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500">
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 w-24">Qty</th>
                                                <th className="px-4 py-3 w-32">Rate</th>
                                                <th className="px-4 py-3 w-32">Amount</th>
                                                <th className="px-4 py-3 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {formData.items?.map((item, index) => (
                                                <tr key={index} className="group hover:bg-white/[0.02]">
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            required
                                                            value={item.description}
                                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                            className={darkTheme.input + " border-transparent bg-transparent focus:border-blue-500/50"}
                                                            placeholder="Work Description"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            required
                                                            value={item.quantity}
                                                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                                                            className={darkTheme.input + " border-transparent bg-transparent focus:border-blue-500/50 font-mono"}
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            required
                                                            value={item.rate}
                                                            onChange={(e) => handleItemChange(index, 'rate', parseFloat(e.target.value))}
                                                            className={darkTheme.input + " border-transparent bg-transparent focus:border-blue-500/50 font-mono"}
                                                        />
                                                    </td>
                                                    <td className="p-2 font-mono text-sm text-slate-300 text-right px-4">
                                                        {formatCurrency(item.amount)}
                                                    </td>
                                                    <td className="p-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="text-slate-600 hover:text-red-400 transition-colors"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {(!formData.items || formData.items.length === 0) && (
                                        <div className="py-12 text-center text-slate-500 italic">No billing items added yet.</div>
                                    )}
                                </div>
                            </div>

                            {/* Summary & QR */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-slate-800/40 p-6 rounded-xl border border-white/5 space-y-4">
                                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                            Adjustments
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={darkTheme.label}>Discount (Flat ₹)</label>
                                                <input
                                                    type="number"
                                                    value={formData.discount || 0}
                                                    onChange={(e) => handleTotalModifiersChange('discount', parseFloat(e.target.value))}
                                                    className={darkTheme.input + " font-mono"}
                                                />
                                            </div>
                                            <div>
                                                <label className={darkTheme.label}>Tax (GST %)</label>
                                                <input
                                                    type="number"
                                                    value={formData.tax_percentage || 0}
                                                    onChange={(e) => handleTotalModifiersChange('tax_percentage', parseFloat(e.target.value))}
                                                    className={darkTheme.input + " font-mono"}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={darkTheme.label}>Internal Notes</label>
                                            <textarea
                                                value={formData.notes || ''}
                                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                className={darkTheme.input + " min-h-[80px] text-sm"}
                                                placeholder="Notes for your reference..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/60 p-6 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                    <div className="w-full mb-6">
                                        <div className="flex justify-between text-slate-400 text-sm mb-2">
                                            <span>Subtotal</span>
                                            <span className="font-mono text-slate-200">{formatCurrency((formData.items || []).reduce((s, i) => s + (i.amount || 0), 0))}</span>
                                        </div>
                                        {formData.discount ? (
                                            <div className="flex justify-between text-red-400 text-sm mb-2">
                                                <span>Discount</span>
                                                <span className="font-mono">- {formatCurrency(formData.discount)}</span>
                                            </div>
                                        ) : null}
                                        {formData.tax_percentage ? (
                                            <div className="flex justify-between text-slate-400 text-sm mb-4">
                                                <span>Tax ({formData.tax_percentage}%)</span>
                                                <span className="font-mono text-slate-200">
                                                    {formatCurrency((((formData.items || []).reduce((s, i) => s + (i.amount || 0), 0) - (formData.discount || 0)) * (formData.tax_percentage || 0)) / 100)}
                                                </span>
                                            </div>
                                        ) : null}
                                        <div className="flex justify-between text-blue-400 text-xl font-bold border-t border-white/10 pt-4">
                                            <span>GRAND TOTAL</span>
                                            <span className="font-mono">{formatCurrency(formData.total_amount)}</span>
                                        </div>
                                    </div>

                                    {companyInfo?.show_qr_code && liveQrValue && (
                                        <div className="bg-white p-3 rounded-lg shadow-2xl animate-in zoom-in-95 duration-500">
                                            <QRCodeCanvas value={liveQrValue} size={140} level="M" />
                                            <p className="text-[10px] text-slate-900 font-bold text-center mt-2 uppercase tracking-tighter">Scan to Pay via UPI</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-white/5 bg-slate-900/50 -mx-6 -mb-6 p-6 px-12">
                            <button type="button" onClick={() => setShowForm(false)} className={darkTheme.btnCancel}>Discard</button>
                            <button onClick={(e) => handleSubmit(e as any)} className={darkTheme.btnPrimary + " px-12"}>Save & Generate Invoice</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedInvoice && (
                <div className={darkTheme.modalOverlay}>
                    <div className={darkTheme.modalContent + " animate-in zoom-in-95"}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className={darkTheme.modalTitle}>Record Payment</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <p className="text-sm text-slate-400 mb-6 bg-blue-500/5 p-3 rounded border border-blue-500/20">
                            Recording payment for <span className="font-bold text-blue-400">{selectedInvoice.invoice_number}</span>
                        </p>

                        <form onSubmit={handleAddPayment} className="space-y-4">
                            <div>
                                <label className={darkTheme.label}>Amount Paid (₹)</label>
                                <input
                                    type="number"
                                    required
                                    value={paymentData.amount_paid}
                                    onChange={(e) => setPaymentData({ ...paymentData, amount_paid: parseFloat(e.target.value) })}
                                    className={darkTheme.input + " text-xl font-bold text-green-400 font-mono"}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={darkTheme.label}>Payment Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={paymentData.payment_date}
                                        onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                                        className={darkTheme.input}
                                    />
                                </div>
                                <div>
                                    <label className={darkTheme.label}>Mode</label>
                                    <select
                                        value={paymentData.payment_mode}
                                        onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value as any })}
                                        className={darkTheme.select}
                                    >
                                        <option value="UPI">UPI</option>
                                        <option value="Bank">Bank Transfer</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-6">
                                <button type="button" onClick={() => setShowPaymentModal(false)} className={darkTheme.btnCancel + " flex-1"}>Cancel</button>
                                <button type="submit" className={darkTheme.btnPrimary + " flex-1"}>Confirm Payment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
            `}</style>
        </div>
    );
}
