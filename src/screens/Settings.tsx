import React, { useEffect, useState } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { darkTheme } from '../utils/theme';
import type { CompanySettings } from '../types';
import Swal from 'sweetalert2';

export default function Settings() {
    const { execute, loading } = useDatabase();
    const [settings, setSettings] = useState<CompanySettings>({
        company_name: '',
        company_subtitle: '',
        company_address: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        upi_id: '',
        pdf_theme_color: '#3b82f6',
        pdf_footer_text: '',
        show_qr_code: true,
        company_logo: '',
        pdf_header_style: 'Logo-Left',
        pdf_font_size: 10,
        owner_name: '',
        company_phone: '',
        company_email: ''
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await execute<Record<string, string>>('get_company_settings');
            if (data) {
                setSettings({
                    company_name: data.company_name || '',
                    company_subtitle: data.company_subtitle || '',
                    company_address: data.company_address || '',
                    bank_name: data.bank_name || '',
                    account_number: data.account_number || '',
                    ifsc_code: data.ifsc_code || '',
                    upi_id: data.upi_id || '',
                    pdf_theme_color: data.pdf_theme_color || '#3b82f6',
                    pdf_footer_text: data.pdf_footer_text || '',
                    show_qr_code: data.show_qr_code === 'true',
                    company_logo: data.company_logo || '',
                    pdf_header_style: (data.pdf_header_style as any) || 'Logo-Left',
                    pdf_font_size: parseInt(data.pdf_font_size || '10'),
                    owner_name: data.owner_name || '',
                    company_phone: data.company_phone || '',
                    company_email: data.company_email || ''
                });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dataToSave: Record<string, string> = {
                company_name: settings.company_name,
                company_subtitle: settings.company_subtitle || '',
                company_address: settings.company_address,
                bank_name: settings.bank_name,
                account_number: settings.account_number,
                ifsc_code: settings.ifsc_code,
                upi_id: settings.upi_id,
                pdf_theme_color: settings.pdf_theme_color,
                pdf_footer_text: settings.pdf_footer_text,
                show_qr_code: settings.show_qr_code.toString(),
                company_logo: settings.company_logo || '',
                pdf_header_style: settings.pdf_header_style || 'Logo-Left',
                pdf_font_size: (settings.pdf_font_size || 10).toString(),
                owner_name: settings.owner_name || '',
                company_phone: settings.company_phone || '',
                company_email: settings.company_email || ''
            };
            await execute('update_company_settings', { settings: dataToSave });
            Swal.fire({
                title: 'Success!',
                text: 'Settings saved successfully',
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                background: '#1e293b',
                color: '#f1f5f9'
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
            Swal.fire('Error', 'Failed to save settings', 'error');
        }
    };

    return (
        <div className="p-6">
            <h1 className={darkTheme.title}>Settings</h1>
            <p className="text-slate-400 mb-8">Configure your company identity and PDF invoice branding.</p>

            <form onSubmit={handleSave} className="max-w-4xl space-y-8">
                {/* Company Information */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                        <span>🏢</span> Company Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className={darkTheme.label}>Company Name</label>
                            <input
                                type="text"
                                value={settings.company_name}
                                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                                className={darkTheme.input}
                                placeholder="Your Awesome Company"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Company Subtitle / Tagline</label>
                            <input
                                type="text"
                                value={settings.company_subtitle}
                                onChange={(e) => setSettings({ ...settings, company_subtitle: e.target.value })}
                                className={darkTheme.input}
                                placeholder="Freelance Web & Mobile App Development"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Owner/Contact Person</label>
                            <input
                                type="text"
                                value={settings.owner_name}
                                onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
                                className={darkTheme.input}
                                placeholder="Anand Kushwaha"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Contact Phone</label>
                            <input
                                type="text"
                                value={settings.company_phone}
                                onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                                className={darkTheme.input}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Contact Email</label>
                            <input
                                type="email"
                                value={settings.company_email}
                                onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                                className={darkTheme.input}
                                placeholder="contact@acetech.com"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Business Address</label>
                            <textarea
                                value={settings.company_address}
                                onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                                className={darkTheme.textarea}
                                rows={3}
                                placeholder="123 Freelance Lane, Digital City"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Brand Logo</label>
                            <div className="flex items-center gap-4">
                                {settings.company_logo && (
                                    <div className="w-20 h-20 bg-slate-800 rounded border border-slate-700 p-1">
                                        <img src={settings.company_logo} alt="Logo Preview" className="w-full h-full object-contain" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setSettings({ ...settings, company_logo: reader.result as string });
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="hidden"
                                        id="logo-upload"
                                    />
                                    <label
                                        htmlFor="logo-upload"
                                        className="inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded cursor-pointer transition-colors"
                                    >
                                        📁 Choose Logo
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, company_logo: '' })}
                                        className="ml-2 text-xs text-red-500 hover:text-red-400"
                                    >
                                        Remove
                                    </button>
                                    <p className="text-[10px] text-slate-500 mt-2">Recommended: Square/Landscape, transparent PNG.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank & Payment Details */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                        <span>🏦</span> Payment Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={darkTheme.label}>Bank Name</label>
                            <input
                                type="text"
                                value={settings.bank_name}
                                onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                                className={darkTheme.input}
                                placeholder="HDFC, ICICI, etc."
                            />
                        </div>
                        <div>
                            <label className={darkTheme.label}>Account Number</label>
                            <input
                                type="text"
                                value={settings.account_number}
                                onChange={(e) => setSettings({ ...settings, account_number: e.target.value })}
                                className={darkTheme.input}
                                placeholder="1234567890"
                            />
                        </div>
                        <div>
                            <label className={darkTheme.label}>IFSC Code</label>
                            <input
                                type="text"
                                value={settings.ifsc_code}
                                onChange={(e) => setSettings({ ...settings, ifsc_code: e.target.value })}
                                className={darkTheme.input}
                                placeholder="IFSC0001234"
                            />
                        </div>
                        <div>
                            <label className={darkTheme.label}>UPI ID</label>
                            <input
                                type="text"
                                value={settings.upi_id}
                                onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
                                className={darkTheme.input}
                                placeholder="username@upi"
                            />
                        </div>
                    </div>
                </div>

                {/* PDF Customization */}
                <div className={darkTheme.card + " p-6"}>
                    <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
                        <span>🎨</span> PDF Customization
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={darkTheme.label}>Theme Color</label>
                            <div className="flex gap-3 items-center">
                                <input
                                    type="color"
                                    value={settings.pdf_theme_color}
                                    onChange={(e) => setSettings({ ...settings, pdf_theme_color: e.target.value })}
                                    className="w-12 h-10 bg-transparent border-0 cursor-pointer"
                                />
                                <span className="text-sm font-mono text-slate-400">{settings.pdf_theme_color}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="show_qr"
                                checked={settings.show_qr_code}
                                onChange={(e) => setSettings({ ...settings, show_qr_code: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="show_qr" className="text-sm text-slate-200">
                                Generate UPI QR Code on Invoices
                            </label>
                        </div>
                        <div className="md:col-span-2">
                            <label className={darkTheme.label}>Footer Note (Terms & Conditions)</label>
                            <textarea
                                value={settings.pdf_footer_text}
                                onChange={(e) => setSettings({ ...settings, pdf_footer_text: e.target.value })}
                                className={darkTheme.textarea}
                                rows={3}
                                placeholder="e.g., Please pay within 7 days of receiving the invoice."
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Header Style</label>
                            <select
                                value={settings.pdf_header_style || 'Logo-Left'}
                                onChange={(e) => setSettings({ ...settings, pdf_header_style: e.target.value as any })}
                                className={darkTheme.select}
                            >
                                <option value="Logo-Left">Logo Left, Text Right</option>
                                <option value="Logo-Center">Logo Center (Stacked)</option>
                                <option value="No-Logo">Text Only (Classic)</option>
                            </select>
                        </div>

                        <div className="md:col-span-1">
                            <label className={darkTheme.label}>Text Font Size</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="8"
                                    max="14"
                                    step="1"
                                    value={settings.pdf_font_size || 10}
                                    onChange={(e) => setSettings({ ...settings, pdf_font_size: parseInt(e.target.value) })}
                                    className="flex-1"
                                />
                                <span className="text-sm font-mono text-slate-400">{settings.pdf_font_size || 10}px</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className={darkTheme.btnPrimary + " px-8 py-3 text-lg"}
                    >
                        {loading ? 'Saving...' : '💾 Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
}
