import { useMemo } from 'react';
import type { TransactionWithDetails } from '../../types/transactions';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface TimelineViewProps {
    transactions: TransactionWithDetails[];
    onViewTransaction: (transaction: TransactionWithDetails) => void;
}

// ─── Animations & Styles ───────────────────────────────────────────────────────
const STYLES = `
@keyframes tva-pulse-orange {
    0%, 100% { box-shadow: 0 0 12px 2px rgba(245,158,11,0.3); }
    50%       { box-shadow: 0 0 20px 4px rgba(245,158,11,0.5); }
}
@keyframes tva-line-glow {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(245,158,11,0.6)); }
    50%       { filter: drop-shadow(0 0 10px rgba(245,158,11,0.9)); }
}
@keyframes tva-slide-in {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
}
.timeline-line { animation: tva-line-glow 4s ease-in-out infinite; }
.timeline-card { animation: tva-slide-in 0.4s ease forwards; opacity: 0; }
.timeline-dot:hover { transform: scale(1.4); filter: brightness(1.2); }
`;

// ─── Transaction Type Config ──────────────────────────────────────────────────
const TYPE_CONFIG = {
    income: {
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.07)',
        glow: 'rgba(34,197,94,0.15)',
        icon: '◈',
        prefix: '+',
    },
    expense: {
        color: '#f43f5e',
        bg: 'rgba(244,63,94,0.07)',
        glow: 'rgba(244,63,94,0.15)',
        icon: '▲',
        prefix: '−',
    },
    investment: {
        color: '#f59e0b', // AMBER
        bg: 'rgba(245,158,11,0.07)',
        glow: 'rgba(245,158,11,0.15)',
        icon: '⬢',
        prefix: '→',
    },
};

export default function TimelineView({ transactions, onViewTransaction }: TimelineViewProps) {
    // 1. Precise Logic for Classification
    const processedTransactions = useMemo(() => {
        return transactions
            .filter(t => {
                const isInvest = (t.direction === 'expense' || t.direction === 'transfer') && 
                                (!!t.investment_id || t.category_is_investment);
                
                // Show income, expenses, and ONLY investment-linked transfers
                if (t.direction === 'income') return true;
                if (t.direction === 'expense') return true;
                if (t.direction === 'transfer' && isInvest) return true;
                
                return false;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);

    const metrics = useMemo(() => {
        let income = 0;
        let expenses = 0;
        let invested = 0;

        processedTransactions.forEach(tx => {
            const isInvest = (tx.direction === 'expense' || tx.direction === 'transfer') && 
                            (!!tx.investment_id || tx.category_is_investment);
            if (tx.direction === 'income') income += tx.amount;
            else if (isInvest) invested += tx.amount;
            else if (tx.direction === 'expense') expenses += tx.amount;
        });

        return { income, expenses, invested, net: income - (expenses + invested) };
    }, [processedTransactions]);

    return (
        <div className="relative pb-20">
            <style>{STYLES}</style>

            {/* ── TVA HUD Header ────────────────────────────────────────── */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-amber-600/30 rounded-2xl p-6 mb-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent" />
                
                <div className="flex flex-col items-center">
                    <div className="text-[10px] tracking-[0.3em] font-black text-amber-600/80 mb-6 flex items-center gap-2">
                        <span className="opacity-40">━━━━</span> ◈ TEMPORAL VARIANT TIMELINE ◈ <span className="opacity-40">━━━━</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl text-center">
                        <div>
                            <div className="text-[10px] text-green-500/60 font-bold mb-1">INCOME</div>
                            <div className="text-2xl font-black text-green-400 font-mono tracking-tighter">
                                {formatCurrency(metrics.income)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-red-500/60 font-bold mb-1">EXPENSES</div>
                            <div className="text-2xl font-black text-red-400 font-mono tracking-tighter">
                                {formatCurrency(metrics.expenses)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-amber-500/60 font-bold mb-1">INVESTED</div>
                            <div className="text-2xl font-black text-amber-500 font-mono tracking-tighter">
                                {formatCurrency(metrics.invested)}
                            </div>
                        </div>
                        <div>
                            <div className={`text-[10px] font-bold mb-1 ${metrics.net >= 0 ? 'text-emerald-500/60' : 'text-amber-500/60'}`}>
                                {metrics.net >= 0 ? 'SURPLUS' : 'DEFICIT'}
                            </div>
                            <div className={`text-2xl font-black font-mono tracking-tighter ${metrics.net >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {metrics.net >= 0 ? '+' : ''}{formatCurrency(metrics.net)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── THE SACRED TIMELINE (Vertical Stream) ────────────────────── */}
            <div className="relative max-w-4xl mx-auto pl-12 md:pl-0">
                
                {/* Central Backbone */}
                <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-600/50 via-amber-500/20 to-transparent md:-translate-x-1/2 timeline-line" />

                <div className="space-y-12 relative">
                    {processedTransactions.map((tx, idx) => {
                        const isInvest = (tx.direction === 'expense' || tx.direction === 'transfer') && 
                                        (!!tx.investment_id || tx.category_is_investment);
                        const typeKey = tx.direction === 'income' ? 'income' : (isInvest ? 'investment' : 'expense');
                        const config = TYPE_CONFIG[typeKey];
                        const isEven = idx % 2 === 0;

                        return (
                            <div key={tx.id} className="relative group">
                                {/* Chronological Marker (Dot) */}
                                <div 
                                    className="absolute left-[13px] md:left-1/2 top-10 w-4 h-4 rounded-full border-2 border-slate-900 z-10 -translate-x-1/2 timeline-dot transition-all duration-300 cursor-crosshair"
                                    style={{ 
                                        backgroundColor: config.color,
                                        boxShadow: `0 0 10px ${config.color}`,
                                    }}
                                />

                                {/* Content Container (Alternating) */}
                                <div className={`flex w-full ${isEven ? 'md:justify-start' : 'md:justify-end'}`}>
                                    <div 
                                        className={`timeline-card w-full md:w-[45%] cursor-pointer group-hover:scale-[1.02] transition-transform`}
                                        style={{ animationDelay: `${idx * 60}ms` }}
                                        onClick={() => onViewTransaction(tx)}
                                    >
                                        <div 
                                            className="p-5 rounded-2xl border backdrop-blur-sm relative overflow-hidden"
                                            style={{ 
                                                backgroundColor: config.bg,
                                                borderColor: `${config.color}33`,
                                                boxShadow: `0 10px 30px -10px ${config.glow}`,
                                            }}
                                        >
                                            {/* Type Badge */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span style={{ color: config.color }} className="text-sm font-bold">{config.icon}</span>
                                                    <span className="text-[10px] tracking-widest font-black text-slate-500 uppercase">
                                                        {typeKey} VARIANT
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-500">
                                                    {formatDate(tx.date)}
                                                </div>
                                            </div>

                                            {/* Amount */}
                                            <div className="text-2xl font-black font-mono mb-1" style={{ color: config.color }}>
                                                {config.prefix} {formatCurrency(tx.amount)}
                                            </div>

                                            {/* Details */}
                                            <div className="text-sm font-bold text-slate-200 mb-1">
                                                {tx.category_name}
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-700/30">
                                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                                    <span className="opacity-40">⊚</span> {tx.direction === 'income' ? tx.to_account_name : tx.from_account_name}
                                                </div>
                                                {tx.client_name && (
                                                    <div className="text-[11px] text-blue-400 flex items-center gap-1.5">
                                                        <span className="opacity-40">👤</span> {tx.client_name}
                                                    </div>
                                                )}
                                                {tx.investment_name && (
                                                    <div className="text-[11px] text-amber-400 flex items-center gap-1.5">
                                                        <span className="opacity-40">📈</span> {tx.investment_name}
                                                    </div>
                                                )}
                                            </div>

                                            {tx.notes && (
                                                <div className="mt-3 py-2 px-3 bg-black/20 rounded-lg text-[11px] text-slate-500 italic border-l-2 border-slate-700/50">
                                                    "{tx.notes}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Empty State ────────────────────────────────────────────── */}
            {transactions.length === 0 && (
                <div className="text-center py-40 opacity-40">
                    <div className="text-5xl mb-4">⌛</div>
                    <div className="text-xl font-bold tracking-tighter">THE TIMELINE IS EMPTY</div>
                    <div className="text-sm">No transaction events detected in this sector.</div>
                </div>
            )}
        </div>
    );
}
