// Common styles for dark theme components

export const darkTheme = {
    // Cards
    card: "bg-slate-800 rounded-lg shadow-lg border border-slate-700 hover:shadow-xl transition-shadow",

    // Buttons
    btnPrimary: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium",
    btnSecondary: "px-4 py-2 bg-slate-700 text-slate-100 rounded-lg hover:bg-slate-600 transition-colors font-medium",
    btnCancel: "px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors",

    // Inputs  
    input: "w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
    select: "w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
    textarea: "w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none",

    // Labels
    label: "block text-sm font-medium text-slate-300 mb-2",

    // Modal
    modalOverlay: "fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50",
    modalContent: "bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6 shadow-2xl",
    modalContentLarge: "bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
    modalTitle: "text-2xl font-bold text-slate-100 mb-4",

    // Text
    title: "text-3xl font-bold text-slate-100",
    subtitle: "text-xl font-bold text-slate-100",
    textPrimary: "text-slate-100",
    textSecondary: "text-slate-300",
    textMuted: "text-slate-400",

    // Table
    table: "min-w-full bg-slate-800 rounded-lg overflow-hidden",
    tableHeader: "bg-slate-700 border-b border-slate-600",
    tableRow: "hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-700/50",
    tableCell: "px-4 py-3 text-sm text-slate-200",
    tableHeaderCell: "px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider",

    // Badges
    badgeIncome: "px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded border border-green-700",
    badgeExpense: "px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded border border-red-700",
    badgeTransfer: "px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-700",
    badgeNeutral: "px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded",

    // Empty state
    empty: "text-center py-12 text-slate-500",

    // Loading
    loading: "text-center py-4 text-slate-400",
};
