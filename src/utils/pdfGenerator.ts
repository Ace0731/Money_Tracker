import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quotation, Invoice, CompanySettings } from '../types';

export const generatePDF = async (
    type: 'Quotation' | 'Invoice',
    data: Quotation | Invoice,
    settings: CompanySettings,
    qrCodeDataUrl?: string
) => {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        // Robust color handling
        let themeColor = settings.pdf_theme_color || '#2563eb';
        if (!themeColor.startsWith('#')) themeColor = '#2563eb';

        const baseFont = settings.pdf_font_size || 10;

        const cleanCurrency = (val: number) =>
            'Rs. ' +
            (val || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 37, g: 99, b: 235 }; // Fallback to blue
        };

        const theme = hexToRgb(themeColor);

        if (type === 'Invoice') {
            renderInvoice(
                doc,
                data as Invoice,
                settings,
                theme,
                baseFont,
                cleanCurrency,
                qrCodeDataUrl
            );
        } else {
            renderQuotation(
                doc,
                data as Quotation,
                settings,
                theme,
                baseFont,
                cleanCurrency
            );
        }

        const number =
            type === 'Invoice'
                ? (data as Invoice).invoice_number
                : (data as Quotation).quotation_number;

        doc.save(`${type}_${number}.pdf`);
    } catch (error) {
        console.error('PDF Generator Error:', error);
        throw error;
    }
};

/* ----------------------------------------------------- */
/* SHARED COMPONENTS */
/* ----------------------------------------------------- */

const renderHeader = (
    doc: jsPDF,
    title: string,
    docNumber: string,
    date: string,
    settings: CompanySettings,
    theme: { r: number; g: number; b: number },
    baseFont: number
) => {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;

    // Colored Header bar
    doc.setFillColor(theme.r, theme.g, theme.b);
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Company Logo
    if (settings.company_logo) {
        try {
            const format = settings.company_logo.includes('png') ? 'PNG' : 'JPEG';
            doc.addImage(settings.company_logo, format, margin, 15, 35, 35);
        } catch { }
    }

    // Document Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(baseFont + 16);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), pageWidth - margin, 32, { align: 'right' });

    // Document Details
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'normal');

    // Create a compact stack for number and date
    doc.text(`${title} #: ${docNumber} | Date: ${date}`, pageWidth - margin, 42, { align: 'right' });

    return 75; // Starting Y for next section
};

const renderAddressBlock = (
    doc: jsPDF,
    label: string,
    name: string,
    address: string | undefined,
    phone: string | undefined,
    email: string | undefined,
    gst: string | undefined,
    x: number,
    y: number,
    baseFont: number
) => {
    let currentY = y;

    // Label
    doc.setFontSize(baseFont - 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(label.toUpperCase(), x, currentY);
    currentY += 12;

    // Name
    doc.setFontSize(baseFont + 1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(name, x, currentY);
    currentY += 12;

    // Details
    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85); // Slate-700

    if (address) {
        const addrLines = doc.splitTextToSize(address, 220);
        doc.text(addrLines, x, currentY);
        currentY += (addrLines.length * 10);
    }

    if (phone || email) {
        doc.text(`${phone || ''}`, x, currentY);
        if (email) {
            currentY += 10;
            doc.text(`${email}`, x, currentY);
        }
        currentY += 10;
    }

    if (gst) {
        doc.setFont('helvetica', 'bold');
        doc.text(`GSTIN: ${gst}`, x, currentY);
        currentY += 10;
    }

    return currentY;
};

/* ----------------------------------------------------- */
/* QUOTATION RENDERER */
/* ----------------------------------------------------- */

const renderQuotation = (
    doc: jsPDF,
    data: Quotation,
    settings: CompanySettings,
    theme: { r: number; g: number; b: number },
    baseFont: number,
    cleanCurrency: (val: number) => string
) => {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    let currentY = renderHeader(doc, 'Quotation', data.quotation_number, data.issue_date, settings, theme, baseFont);

    // Client Info
    renderAddressBlock(
        doc,
        'Proposal For',
        data.client_business_name || data.client_name || 'Valued Client',
        data.client_address,
        data.client_phone,
        data.client_email,
        undefined, // No GST for quote usually, or add if needed
        margin,
        currentY,
        baseFont
    );

    // Project Title
    currentY += 75;
    doc.setFontSize(baseFont + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(theme.r, theme.g, theme.b);
    doc.text(data.project_title || 'Project Proposal', margin, currentY);

    // Line separator
    doc.setDrawColor(theme.r, theme.g, theme.b);
    doc.setLineWidth(1);
    doc.line(margin, currentY + 3, margin + 200, currentY + 3);

    currentY += 20;

    // Items Table
    const tableData = data.items?.map((item, i) => {
        let description = item.description;
        // Append features if available for "3 lines description" effect
        if (item.features) {
            const featuresList = item.features.split('\n')
                .slice(0, 3) // Max 3 lines as requested
                .map(f => f.trim().replace(/^[•*-]\s*/, ''))
                .filter(f => f.length > 0);

            if (featuresList.length > 0) {
                // Add features with bullet points to description
                description += '\n' + featuresList.map(f => `• ${f}`).join('\n');
            }
        }
        if (item.timeline) {
            description += `\nTimeline: ${item.timeline}`;
        }

        return [
            i + 1,
            description,
            cleanCurrency(item.amount)
        ];
    }) || [];

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'Description & Features', 'Amount']],
        body: tableData,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: {
            fillColor: [theme.r, theme.g, theme.b],
            textColor: 255,
            fontSize: baseFont,
            fontStyle: 'bold',
            halign: 'left'
        },
        bodyStyles: {
            fontSize: baseFont - 1,
            textColor: 50,
            cellPadding: 8,
            valign: 'top'
        },
        columnStyles: {
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 100, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: () => {
            // Optional: custom styling for description column to ensure wrapping
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Total
    renderTotalBlock(doc, data.total_amount, undefined, undefined, undefined, currentY, pageWidth, margin, baseFont, theme, cleanCurrency);

    currentY += 40;

    // Terms & Conditions block
    renderTermsBlock(doc, data.payment_terms, data.terms_conditions, margin, pageWidth, currentY, baseFont);

    // Bottom Signature
    renderSignatureAndFooter(doc, settings, margin, pageWidth, doc.internal.pageSize.height, baseFont, theme);
};

/* ----------------------------------------------------- */
/* INVOICE RENDERER */
/* ----------------------------------------------------- */

const renderInvoice = (
    doc: jsPDF,
    data: Invoice,
    settings: CompanySettings,
    theme: { r: number; g: number; b: number },
    baseFont: number,
    cleanCurrency: (val: number) => string,
    qrCodeDataUrl?: string
) => {
    const pageWidth = doc.internal.pageSize.width;
    const margin = 40;
    let currentY = renderHeader(doc, 'Invoice', data.invoice_number, data.issue_date, settings, theme, baseFont);

    // Two Columns: Billed To | From
    const colWidth = (pageWidth - (margin * 2)) / 2;

    // Billed To
    renderAddressBlock(
        doc,
        'Billed To',
        data.client_business_name || data.client_name || 'Client',
        data.client_address,
        data.client_phone,
        data.client_email,
        (data as any).client_gst, // Assuming strict typing might miss this if not in interface, checking fallback
        margin,
        currentY,
        baseFont
    );

    // From
    renderAddressBlock(
        doc,
        'From',
        settings.company_name,
        settings.company_address,
        settings.company_phone,
        settings.company_email,
        undefined, // Company GST usually in settings or footer, but we can add if available
        margin + colWidth,
        currentY,
        baseFont
    );

    currentY += 50;

    // Project Summary (Progressive Invoicing)
    const summary = (data as any).projectSummary;
    if (summary) {
        autoTable(doc, {
            startY: currentY,
            head: [['Project Total Value', 'Received to Date', 'Balance Remaining']],
            body: [[
                cleanCurrency(summary.totalValue),
                cleanCurrency(summary.paidAmount),
                cleanCurrency(summary.pendingAmount)
            ]],
            margin: { left: margin, right: margin },
            theme: 'grid', // Plain grid
            headStyles: {
                fillColor: [248, 250, 252], // Slate-50
                textColor: [71, 85, 105], // Slate-600
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                lineColor: [226, 232, 240], // Slate-200
                lineWidth: 0.1
            },
            bodyStyles: {
                fontSize: 10,
                textColor: [30, 41, 59], // Slate-800
                halign: 'center',
                fontStyle: 'bold',
                cellPadding: 8,
                lineColor: [226, 232, 240],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { textColor: [22, 163, 74] }, // Green-600
                2: { textColor: [37, 99, 235] }  // Blue-600
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 30;
    } else {
        currentY += 30;
    }

    // Reset any potential spacing issues
    doc.setCharSpace(0);
    doc.setFont('helvetica', 'normal');

    // Items Table
    const tableData = data.items?.map((item, i) => [
        i + 1,
        (item.description || '').replace(/[^\x20-\x7E]/g, ''), // Sanitize only printable ASCII
        item.quantity,
        cleanCurrency(item.rate),
        cleanCurrency(item.amount)
    ]) || [];

    console.log('PDF Table Data:', JSON.stringify(tableData, null, 2));

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'Description', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: {
            fillColor: [theme.r, theme.g, theme.b],
            textColor: 255,
            fontSize: baseFont,
            fontStyle: 'bold',
            font: 'helvetica'
        },
        bodyStyles: {
            fontSize: baseFont - 1,
            textColor: 50,
            cellPadding: 8,
            font: 'helvetica'
        },
        columnStyles: {
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 40, halign: 'center' },
            3: { cellWidth: 70, halign: 'right' },
            4: { cellWidth: 80, halign: 'right', fontStyle: 'bold' }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Notes
    if (data.notes) {
        doc.setFontSize(baseFont - 1);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('NOTES:', margin, currentY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const noteLines = doc.splitTextToSize(data.notes, 300);
        doc.text(noteLines, margin, currentY + 12);
    }

    // Totals Block
    const discount = data.discount || 0;
    const subtotal = data.items?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
    const afterDiscount = subtotal - discount;
    const tax = (afterDiscount * (data.tax_percentage || 0)) / 100;

    renderTotalBlock(doc, data.total_amount, subtotal, discount, { percent: data.tax_percentage || 0, amount: tax }, currentY, pageWidth, margin, baseFont, theme, cleanCurrency);

    // Bank & Payment Info
    currentY += 80; // Move down
    // Ensure we have space
    if (currentY > doc.internal.pageSize.height - 150) {
        doc.addPage();
        currentY = 40;
    }

    renderPaymentBlock(doc, settings, margin, currentY, baseFont, theme, qrCodeDataUrl);

    // Signature
    renderSignatureAndFooter(doc, settings, margin, pageWidth, doc.internal.pageSize.height, baseFont, theme);
};

/* ----------------------------------------------------- */
/* COMMON BLOCKS */
/* ----------------------------------------------------- */

const renderTotalBlock = (
    doc: jsPDF,
    total: number,
    subtotal: number | undefined,
    discount: number | undefined,
    tax: { percent: number, amount: number } | undefined,
    y: number,
    pageWidth: number,
    margin: number,
    baseFont: number,
    theme: { r: number; g: number; b: number },
    clean: (n: number) => string
) => {
    const startX = pageWidth - margin - 200;
    let currentY = y;

    if (subtotal !== undefined) {
        doc.setFontSize(baseFont);
        doc.setTextColor(100, 116, 139);
        doc.text('Subtotal:', startX, currentY);
        doc.text(clean(subtotal), pageWidth - margin, currentY, { align: 'right' });
        currentY += 15;
    }

    if (discount !== undefined && discount > 0) {
        doc.setTextColor(239, 68, 68); // Red for discount
        doc.text('Discount:', startX, currentY);
        doc.text(`- ${clean(discount)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 15;
    }

    if (tax && tax.amount > 0) {
        doc.setTextColor(100, 116, 139);
        doc.text(`Tax (${tax.percent}%):`, startX, currentY);
        doc.text(clean(tax.amount), pageWidth - margin, currentY, { align: 'right' });
        currentY += 15;
    }

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(startX, currentY, pageWidth - margin, currentY);
    currentY += 15;

    // Grand Total
    doc.setFontSize(baseFont + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(theme.r, theme.g, theme.b);
    doc.text('Total:', startX, currentY);
    doc.text(clean(total), pageWidth - margin, currentY, { align: 'right' });
};

const renderPaymentBlock = (
    doc: jsPDF,
    settings: CompanySettings,
    x: number,
    y: number,
    baseFont: number,
    theme: { r: number; g: number; b: number },
    qrUrl?: string
) => {
    // Payment Info Container

    doc.setFontSize(baseFont);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(theme.r, theme.g, theme.b);
    doc.text('Bank Details & Payment Info', x, y);

    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    let textY = y + 15;
    if (settings.bank_name) doc.text(`Bank: ${settings.bank_name}`, x, textY);
    if (settings.account_number) { textY += 12; doc.text(`Account No: ${settings.account_number}`, x, textY); }
    if (settings.ifsc_code) { textY += 12; doc.text(`IFSC: ${settings.ifsc_code}`, x, textY); }
    if (settings.upi_id) { textY += 12; doc.text(`UPI ID: ${settings.upi_id}`, x, textY); }

    // QR Code
    if (qrUrl) {
        doc.addImage(qrUrl, 'PNG', x + 250, y, 70, 70);
    }
};

const renderTermsBlock = (
    doc: jsPDF,
    paymentTerms: string | undefined,
    terms: string | undefined,
    x: number,
    pageWidth: number,
    y: number,
    baseFont: number
) => {
    if (!paymentTerms && !terms) return;

    let currentY = y;
    const maxWid = pageWidth - (x * 2);

    if (paymentTerms) {
        doc.setFontSize(baseFont);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Payment Terms:', x, currentY);
        currentY += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(baseFont - 1);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(paymentTerms, maxWid);
        doc.text(lines, x, currentY);
        currentY += (lines.length * 10) + 10;
    }

    if (terms) {
        doc.setFontSize(baseFont);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Terms & Conditions:', x, currentY);
        currentY += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(baseFont - 1);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(terms, maxWid);
        doc.text(lines, x, currentY);
    }
};

const renderSignatureAndFooter = (
    doc: jsPDF,
    settings: CompanySettings,
    margin: number,
    pageWidth: number,
    pageHeight: number,
    baseFont: number,
    theme: { r: number; g: number; b: number }
) => {
    // Signature at fixed position near bottom
    const sigY = pageHeight - 110;

    doc.setFontSize(baseFont - 1);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Authorized Signatory', pageWidth - margin, sigY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(settings.owner_name || settings.company_name, pageWidth - margin, sigY + 40, { align: 'right' });

    // Footer - Page Numbers & Copyright
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(theme.r, theme.g, theme.b);
        doc.setLineWidth(2);
        doc.line(0, pageHeight - 15, pageWidth, pageHeight - 15); // Bottom colored strip

        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // Muted
        doc.text(`© ${settings.company_name}`, margin, pageHeight - 25);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 25, { align: 'right' });
    }
};
