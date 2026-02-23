import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quotation, Invoice, CompanySettings } from '../types';

/**
 * Sanitizes text for PDF rendering by replacing the Rupee symbol
 * and removing problematic hidden characters.
 */
const sanitize = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/₹/g, 'Rs.')
        .replace(/[^\x00-\x7F\u0900-\u097F]/g, ''); // Allow ASCII and Devanagari (Hindi) if needed, but mostly ASCII
};

export const generatePDF = async (
    type: 'Quotation' | 'Invoice',
    data: Quotation | Invoice,
    settings: CompanySettings,
    qrCodeDataUrl?: string
): Promise<{ bytes: Uint8Array; filename: string }> => {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        // Global Reset for character spacing to prevent glitches
        doc.setCharSpace(0);

        // Theme and Color Setup
        let themeColor = settings.pdf_theme_color || '#2563eb';
        if (!themeColor.startsWith('#')) themeColor = '#2563eb';

        const hexToRgb = (hex: string): [number, number, number] => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16)
            ] : [37, 99, 235];
        };

        const theme = hexToRgb(themeColor);
        const baseFont = settings.pdf_font_size || 10;
        const cleanCurrency = (val: number) =>
            'Rs. ' + (val || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        if (type === 'Invoice') {
            renderInvoice(doc, data as Invoice, settings, theme, baseFont, cleanCurrency, qrCodeDataUrl);
        } else {
            renderQuotation(doc, data as Quotation, settings, theme, baseFont, cleanCurrency);
        }

        const number = type === 'Invoice'
            ? (data as Invoice).invoice_number
            : (data as Quotation).quotation_number;

        const filename = `${type}_${number}.pdf`;

        // Return arraybuffer for Tauri-based saving
        return {
            bytes: new Uint8Array(doc.output('arraybuffer')),
            filename
        };
    } catch (error) {
        console.error('PDF Generator Error:', error);
        throw error;
    }
};

/* ----------------------------------------------------- */
/* SHARED RENDERERS */
/* ----------------------------------------------------- */

const renderSignatureAndFooter = (
    doc: jsPDF,
    settings: CompanySettings,
    margin: number,
    pageWidth: number,
    pageHeight: number,
    baseFont: number,
    theme: [number, number, number]
) => {
    const sigY = pageHeight - 110;

    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Authorized Signatory', pageWidth - margin, sigY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(sanitize(settings.owner_name || settings.company_name), pageWidth - margin, sigY + 40, { align: 'right' });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(theme[0], theme[1], theme[2]);
        doc.setLineWidth(2);
        doc.line(0, pageHeight - 15, pageWidth, pageHeight - 15);

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`© ${sanitize(settings.company_name)}`, margin, pageHeight - 25);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 25, { align: 'right' });
    }
};

const renderPaymentAndTotals = (
    doc: jsPDF,
    data: any,
    settings: CompanySettings,
    margin: number,
    currentY: number,
    baseFont: number,
    theme: [number, number, number],
    clean: (n: number) => string,
    qrUrl?: string
) => {
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - (margin * 2);

    // Totals Table (On the Right)
    const subtotal = data.items?.reduce((sum: number, i: any) => sum + (i.amount || 0), 0) || 0;
    const discount = data.discount || 0;
    const afterDiscount = subtotal - discount;
    const taxPercent = (data as any).tax_percentage || 0;
    const taxAmount = (afterDiscount * taxPercent) / 100;
    const total = (data as any).total_amount;

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin + (contentWidth * 0.5), right: margin },
        body: [
            ['Subtotal:', { content: clean(subtotal), styles: { halign: 'right' as const } }],
            ...(discount > 0 ? [['Discount:', { content: `- ${clean(discount)}`, styles: { halign: 'right' as const, textColor: [239, 68, 68] as [number, number, number] } }]] : []),
            ...(taxAmount > 0 ? [[`Tax (${taxPercent}%):`, { content: clean(taxAmount), styles: { halign: 'right' as const } }]] : []),
            [{ content: 'Total Amount:', styles: { fontStyle: 'bold' as const, fontSize: baseFont + 2, textColor: theme } },
            { content: clean(total), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fontSize: baseFont + 2, textColor: theme } }]
        ],
        theme: 'plain',
        styles: { fontSize: baseFont, cellPadding: 4, textColor: [71, 85, 105] as [number, number, number] },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 100 } }
    });

    const finalTotalsY = (doc as any).lastAutoTable.finalY;

    // Filter Payment Info to hide empty rows
    const paymentRows = [];
    if (settings.bank_name && settings.bank_name !== 'N/A') paymentRows.push(`Bank: ${settings.bank_name}`);
    if (settings.account_number && settings.account_number !== 'N/A') paymentRows.push(`A/C: ${settings.account_number}`);
    if (settings.ifsc_code && settings.ifsc_code !== 'N/A') paymentRows.push(`IFSC: ${settings.ifsc_code}`);
    if (settings.upi_id && settings.upi_id !== 'N/A') paymentRows.push(`UPI: ${settings.upi_id}`);

    if (paymentRows.length > 0) {
        autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin + (contentWidth * 0.5) },
            head: [['PAYMENT INFORMATION']],
            body: [[{
                content: paymentRows.join('\n'),
                styles: { fontSize: baseFont - 1 }
            }]],
            theme: 'plain',
            headStyles: { fontSize: baseFont - 2, fontStyle: 'bold' as const, textColor: theme, cellPadding: { bottom: 2 } },
            styles: { cellPadding: 0 }
        });
    }

    if (qrUrl) {
        doc.addImage(qrUrl, 'PNG', margin + (contentWidth * 0.35), currentY + 5, 60, 60);
    }

    return Math.max(finalTotalsY, (doc as any).lastAutoTable.finalY || 0) + 20;
};

/* ----------------------------------------------------- */
/* QUOTATION TEMPLATE */
/* ----------------------------------------------------- */

const renderQuotation = (
    doc: jsPDF,
    data: Quotation,
    settings: CompanySettings,
    theme: [number, number, number],
    baseFont: number,
    clean: (n: number) => string
) => {
    const margin = 40;
    const pageWidth = doc.internal.pageSize.width;

    // Modern Header Block
    doc.setFillColor(theme[0], theme[1], theme[2]);
    doc.rect(0, 0, pageWidth, 120, 'F');

    if (settings.company_logo) {
        try { doc.addImage(settings.company_logo, 'PNG', margin, 20, 45, 45); } catch { }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(baseFont + 12);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitize(settings.company_name.toUpperCase()), margin + (settings.company_logo ? 55 : 0), 40);

    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'normal');
    const displayAddr = settings.company_address?.split(',').slice(0, 2).join(',') || '';
    doc.text(sanitize(displayAddr), margin + (settings.company_logo ? 55 : 0), 52);

    doc.setFontSize(baseFont + 20);
    doc.setFont('helvetica', 'bold');
    doc.text('QUOTATION', pageWidth - margin, 45, { align: 'right' });

    doc.setFontSize(baseFont);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${data.quotation_number}`, pageWidth - margin, 65, { align: 'right' });
    doc.text(`Date: ${data.issue_date}`, pageWidth - margin, 77, { align: 'right' });

    // Client and Quote Info Gird
    autoTable(doc, {
        startY: 135,
        margin: { left: margin, right: margin },
        head: [['PROPOSAL FOR', 'DOCUMENT DETAILS']],
        body: [[
            { content: sanitize(`${data.client_business_name || data.client_name}\n${data.client_address || ''}\n${data.client_phone || ''}`), styles: { cellPadding: { top: 5, bottom: 10 } } },
            { content: sanitize(`${data.project_title || 'General Services'}\nValid Until: ${data.valid_till}`), styles: { cellPadding: { top: 5, bottom: 10 } } }
        ]],
        theme: 'plain',
        headStyles: { fontSize: baseFont - 2, textColor: theme, fontStyle: 'bold' as const },
        styles: { fontSize: baseFont, textColor: [15, 23, 42] as [number, number, number] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Items Table
    const tableData = data.items?.map((item, i) => [
        i + 1,
        { content: sanitize(`${item.description}\n${item.features ? item.features.split('\n').map(f => `• ${f.trim()}`).join('\n') : ''}`), styles: { fontSize: baseFont - 1 } },
        { content: clean(item.amount), styles: { halign: 'right' as const, fontStyle: 'bold' as const } }
    ]) || [];

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['#', 'Description & Scoping', 'Amount']],
        body: tableData as any,
        theme: 'grid',
        headStyles: { fillColor: theme, textColor: 255, fontSize: baseFont, fontStyle: 'bold' as const },
        bodyStyles: { cellPadding: 10, valign: 'top' as const },
        columnStyles: { 0: { cellWidth: 30, halign: 'center' as const }, 2: { cellWidth: 100 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Totals and Payment
    currentY = renderPaymentAndTotals(doc, data, settings, margin, currentY, baseFont, theme, clean);

    // Terms
    if (data.payment_terms || data.terms_conditions) {
        autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin + (pageWidth - margin * 2) * 0.4 },
            head: [['TERMS & CONDITIONS']],
            body: [[sanitize(`${data.payment_terms || ''}\n${data.terms_conditions || ''}`)]],
            theme: 'plain',
            headStyles: { fontSize: baseFont - 2, textColor: theme, fontStyle: 'bold' as const },
            styles: { fontSize: baseFont - 2, textColor: [100, 116, 139] as [number, number, number] }
        });
    }

    renderSignatureAndFooter(doc, settings, margin, pageWidth, doc.internal.pageSize.height, baseFont, theme);
};

/* ----------------------------------------------------- */
/* INVOICE TEMPLATE */
/* ----------------------------------------------------- */

const renderInvoice = (
    doc: jsPDF,
    data: Invoice,
    settings: CompanySettings,
    theme: [number, number, number],
    baseFont: number,
    clean: (n: number) => string,
    qrUrl?: string
) => {
    const margin = 40;
    const pageWidth = doc.internal.pageSize.width;

    // Header Color Block
    doc.setFillColor(theme[0], theme[1], theme[2]);
    doc.rect(0, 0, pageWidth, 120, 'F');

    if (settings.company_logo) {
        try { doc.addImage(settings.company_logo, 'PNG', margin, 20, 45, 45); } catch { }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(baseFont + 12);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitize(settings.company_name.toUpperCase()), margin + (settings.company_logo ? 55 : 0), 40);

    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitize(settings.company_address || ''), margin + (settings.company_logo ? 55 : 0), 52);

    doc.setFontSize(baseFont * 3);
    doc.text('INVOICE', pageWidth - margin, 45, { align: 'right' });

    doc.setFontSize(baseFont);
    doc.text(`# ${data.invoice_number}`, pageWidth - margin, 65, { align: 'right' });
    doc.text(`Due: ${data.due_date}`, pageWidth - margin, 77, { align: 'right' });

    // Billed To Grid
    autoTable(doc, {
        startY: 135,
        margin: { left: margin, right: margin },
        head: [['BILLED TO', 'INVOICE DETAILS']],
        body: [[
            { content: sanitize(`${data.client_business_name || data.client_name}\n${data.client_address || ''}\n${data.client_email || ''}`), styles: { cellPadding: { top: 5, bottom: 10 } } },
            { content: sanitize(`Project: ${data.project_name}\nStage: ${data.stage}\nDate: ${data.issue_date}`), styles: { cellPadding: { top: 5, bottom: 10 } } }
        ]],
        theme: 'plain',
        headStyles: { fontSize: baseFont - 2, textColor: theme, fontStyle: 'bold' as const },
        styles: { fontSize: baseFont, textColor: [15, 23, 42] as [number, number, number] }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Project Progress Summary
    const summary = (data as any).projectSummary;
    if (summary) {
        autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin },
            body: [[
                { content: `Total Value: ${clean(summary.totalValue)}    |    Received: ${clean(summary.paidAmount)}    |    Pending: ${clean(summary.pendingAmount)}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: [100, 116, 139] as [number, number, number] } }
            ]],
            theme: 'plain',
            styles: { fontSize: baseFont - 2, cellPadding: 8, fillColor: [248, 250, 252] as [number, number, number] }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Line Items
    const tableData = data.items?.map((item, i) => [
        i + 1,
        sanitize(item.description),
        item.quantity,
        clean(item.rate),
        { content: clean(item.amount), styles: { halign: 'right' as const, fontStyle: 'bold' as const } }
    ]) || [];

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['#', 'Description', 'Qty', 'Rate', 'Total']],
        body: tableData as any,
        theme: 'grid',
        headStyles: { fillColor: theme, textColor: 255, fontSize: baseFont, fontStyle: 'bold' as const },
        bodyStyles: { cellPadding: 8 },
        columnStyles: { 0: { cellWidth: 30, halign: 'center' as const }, 2: { cellWidth: 40, halign: 'center' as const }, 3: { cellWidth: 80, halign: 'right' as const }, 4: { cellWidth: 90 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Totals and Payment
    currentY = renderPaymentAndTotals(doc, data, settings, margin, currentY, baseFont, theme, clean, qrUrl);

    // Notes
    if (data.notes) {
        doc.setFontSize(baseFont - 2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(148, 163, 184);
        doc.text('INTERNAL NOTES:', margin, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(sanitize(data.notes), margin, currentY + 10);
    }

    renderSignatureAndFooter(doc, settings, margin, pageWidth, doc.internal.pageSize.height, baseFont, theme);
};
