import { useEffect, useState, useMemo } from 'react';
import { useDatabase } from '../hooks/useDatabase';
import { darkTheme } from '../utils/theme';
import type { BudgetSummary, Account } from '../types';

interface DecisionInputs {
    salary: number;
    freelance: number;
    expenses: number;
    currentEmergency: number;
    hdfcBalance: number;
    sbiBalance: number;
    sliceBalance: number;
    cycleStart: string;
}

interface DecisionOutput {
    totalIncome: number;
    extraFreelance: number;
    totalSIP: number;
    emergencyAllocation: number;
    funAllocation: number;
    savingsAllocation: number;
    finalSalaryBuffer: number;
    status: 'Stable' | 'Tight' | 'Risky' | 'Critical' | 'Disabled';
}

interface TransferInstruction {
    from: string;
    to: string;
    amount: number;
}

const CONSTANTS = {
    BASE_SALARY: 18000,
    BASE_FREELANCE: 12000,
    BASE_SIP: 10000,
    EXPENSE_CAP: 10000,
    EMERGENCY_TARGET: 60000,
    MIN_BUFFER: 2000,
    SYSTEM_START_DATE: '2026-04-01',
    SIP_START_DATE: '2026-05-07',
};

const r3 = (val: number) => Math.round(val * 1000) / 1000;

const format3 = (amount: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
}).format(amount);

export default function DecisionMaker() {
    const { execute } = useDatabase();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [inputs, setInputs] = useState<DecisionInputs>({
        salary: 0,
        freelance: 0,
        expenses: 0,
        currentEmergency: 0,
        hdfcBalance: 0,
        sbiBalance: 0,
        sliceBalance: 0,
        cycleStart: '',
    });

    useEffect(() => {
        loadAutomatedData();
    }, [selectedMonth]);

    const loadAutomatedData = async () => {
        try {
            // Calculate previous month
            const year = parseInt(selectedMonth.split('-')[0]);
            const month = parseInt(selectedMonth.split('-')[1]);
            const prevMonthDate = new Date(year, month - 2, 1);
            const prevMonthString = prevMonthDate.toISOString().slice(0, 7);

            const [currentSummary, prevSummary, accounts] = await Promise.all([
                execute<BudgetSummary>('get_budget_summary', { month: selectedMonth }),
                execute<BudgetSummary>('get_budget_summary', { month: prevMonthString }),
                execute<Account[]>('get_accounts'),
            ]);

            // Find categories for Salary and Freelance
            const findActual = (summary: BudgetSummary, name: string) =>
                summary?.income_categories?.find(c => c.category_name.toLowerCase().includes(name))?.actual || 0;

            const salaryActual = r3(findActual(currentSummary, 'salary'));
            const freelanceActual = r3(findActual(prevSummary, 'freelance'));

            // Find bank accounts
            const hdfc = accounts.find(a => a.name.toLowerCase().includes('hdfc'));
            const slice = accounts.find(a => a.name.toLowerCase().includes('slice'));
            const sbi = accounts.find(a => a.name.toLowerCase().includes('sbi'));

            setInputs({
                salary: salaryActual,
                freelance: freelanceActual,
                expenses: r3(currentSummary.total_spent || 0),
                currentEmergency: r3(slice?.current_balance || 0),
                hdfcBalance: r3(hdfc?.current_balance || 0),
                sbiBalance: r3(sbi?.current_balance || 0),
                sliceBalance: r3(slice?.current_balance || 0),
                cycleStart: currentSummary.month,
            });
        } catch (error) {
            console.error('Failed to load automated data:', error);
        }
    };

    const decision = useMemo(() => {
        const totalIncome = inputs.salary + inputs.freelance;
        const extraFreelance = Math.max(inputs.freelance - CONSTANTS.BASE_FREELANCE, 0);

        // Final Decision logic
        let output: DecisionOutput = {
            totalIncome,
            extraFreelance,
            totalSIP: 0,
            emergencyAllocation: 0,
            funAllocation: 0,
            savingsAllocation: 0,
            finalSalaryBuffer: 0,
            status: 'Stable'
        };

        // System Start Date Check
        const cycleDate = new Date(selectedMonth + "-01");
        const systemStart = new Date(CONSTANTS.SYSTEM_START_DATE);
        if (cycleDate < systemStart) {
            output.status = 'Disabled';
            return output;
        }

        // SIP Activation Check (Logic cycle must be >= May 7)
        // Note: selectedMonth "2026-05" starts on May 7 due to backend fix
        const isSIPActive = cycleDate >= new Date("2026-05-01");

        if (totalIncome < 30000) {
            if (isSIPActive) {
                output.totalSIP = Math.max(totalIncome - CONSTANTS.EXPENSE_CAP - CONSTANTS.MIN_BUFFER, 0);
            }
            // If income is zero, status is critical
            output.status = totalIncome < (CONSTANTS.EXPENSE_CAP + CONSTANTS.MIN_BUFFER) ? 'Risky' : 'Tight';
            if (totalIncome <= 0) output.status = 'Critical';

            output.finalSalaryBuffer = Math.max(totalIncome - output.totalSIP - CONSTANTS.EXPENSE_CAP, 0);
        } else {
            // Base allocations
            if (isSIPActive) {
                output.totalSIP = CONSTANTS.BASE_SIP;
                output.emergencyAllocation = 10000;

                // Emergency overflow
                if (inputs.currentEmergency >= CONSTANTS.EMERGENCY_TARGET) {
                    output.totalSIP += 10000;
                    output.emergencyAllocation = 0;
                }

                // Extra Freelance logic
                if (extraFreelance > 0) {
                    if (inputs.currentEmergency < CONSTANTS.EMERGENCY_TARGET) {
                        output.emergencyAllocation += extraFreelance * 0.7;
                        output.totalSIP += extraFreelance * 0.3;
                    } else {
                        if (inputs.freelance > 15000) {
                            output.totalSIP += extraFreelance * 0.6;
                            output.funAllocation = extraFreelance * 0.2;
                            output.savingsAllocation = extraFreelance * 0.2;
                        } else {
                            output.totalSIP += extraFreelance * 0.8;
                            output.savingsAllocation = extraFreelance * 0.2;
                        }
                    }
                }
            } else {
                // April Transition - No SIP, all savings to emergency
                output.emergencyAllocation = totalIncome - CONSTANTS.EXPENSE_CAP - CONSTANTS.MIN_BUFFER;
                output.status = 'Stable';
            }
        }

        const allocated = output.totalSIP + output.emergencyAllocation + output.funAllocation + output.savingsAllocation + CONSTANTS.EXPENSE_CAP;
        output.finalSalaryBuffer = Math.max(totalIncome - (allocated - output.finalSalaryBuffer), 0);

        return output;
    }, [inputs, selectedMonth]);

    const transfers = useMemo(() => {
        if (decision.status === 'Disabled') return [];
        const list: TransferInstruction[] = [];
        const hdfcTarget = CONSTANTS.EXPENSE_CAP + CONSTANTS.MIN_BUFFER;

        let availableSlice = inputs.sliceBalance;

        // Requirement 1: HDFC needs hdfcTarget (12k)
        // Usually, Salary lands in HDFC. If it's less than 12k, we pull from Slice.
        // If it's more, we push to SBI/Slice.
        // For the decision UI, we use the logic: "What moves based on this month's plan"
        const hdfcSurplus = inputs.salary - hdfcTarget;

        if (hdfcSurplus > 0) {
            // Push from HDFC
            const toSBI = Math.min(hdfcSurplus, decision.totalSIP);
            if (toSBI > 0) list.push({ from: 'HDFC', to: 'SBI', amount: toSBI });

            const remaining = hdfcSurplus - toSBI;
            if (remaining > 0) list.push({ from: 'HDFC', to: 'Slice', amount: remaining });
        } else if (hdfcSurplus < 0) {
            // Pull from Slice to HDFC
            const neededForHDFC = Math.abs(hdfcSurplus);
            const actualPull = Math.min(neededForHDFC, availableSlice);
            if (actualPull > 0) {
                list.push({ from: 'Slice', to: 'HDFC', amount: actualPull });
                availableSlice -= actualPull;
            }
        }

        // Requirement 2: Fun SIP Total in SBI
        const sbiTarget = decision.totalSIP;
        const currentSBITransferFromHDFC = hdfcSurplus > 0 ? Math.min(hdfcSurplus, decision.totalSIP) : 0;
        const sbiStillNeeded = sbiTarget - currentSBITransferFromHDFC;

        if (sbiStillNeeded > 0) {
            const pullFromSlice = Math.min(sbiStillNeeded, availableSlice);
            if (pullFromSlice > 0) {
                list.push({ from: 'Slice', to: 'SBI', amount: pullFromSlice });
                availableSlice -= pullFromSlice;
            }
        }

        return list;
    }, [inputs, decision]);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className={darkTheme.title + " flex items-center gap-2 mb-0"}>
                        <span>🔥</span> Monthly Decision Maker
                    </h1>
                    <p className="text-slate-400 text-sm">Strict financial logic engine</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className={darkTheme.input + " w-40"}
                    />
                    <button
                        onClick={loadAutomatedData}
                        className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                        title="Refresh Data"
                    >
                        🔄
                    </button>
                </div>
            </div>

            {decision.status === 'Disabled' ? (
                <div className={darkTheme.card + " p-12 text-center"}>
                    <p className="text-slate-500 italic">Decision engine is inactive for cycles before April 2026.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Inputs Area */}
                    <div className="space-y-6">
                        <section className={darkTheme.card + " p-6"}>
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex justify-between">
                                <span>Cycle Inputs</span>
                                {selectedMonth === '2026-05' && <span className="text-[10px] text-blue-400 font-normal">SIP START PHASE</span>}
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Curr. Salary</label>
                                        <p className="text-lg font-bold text-slate-100">{format3(inputs.salary)}</p>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/30">
                                        <label className="text-[10px] text-blue-400 uppercase font-bold block mb-1">Prev. Freelance</label>
                                        <p className="text-lg font-bold text-blue-400">{format3(inputs.freelance)}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={darkTheme.label}>Expenses Paid</label>
                                        <input
                                            type="number"
                                            value={inputs.expenses || ''}
                                            onChange={(e) => setInputs({ ...inputs, expenses: parseFloat(e.target.value) || 0 })}
                                            className={darkTheme.input}
                                        />
                                    </div>
                                    <div>
                                        <label className={darkTheme.label}>Emerg. Balance</label>
                                        <input
                                            type="number"
                                            value={inputs.currentEmergency || ''}
                                            onChange={(e) => setInputs({ ...inputs, currentEmergency: parseFloat(e.target.value) || 0 })}
                                            className={darkTheme.input}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Decision Summary */}
                        <section className={`${darkTheme.card} p-6 border-l-4 ${decision.status === 'Stable' ? 'border-green-500' :
                            decision.status === 'Tight' ? 'border-yellow-500' :
                                'border-red-500'
                            }`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Financial Status</h2>
                                    <p className={`text-2xl font-bold ${decision.status === 'Stable' ? 'text-green-400' :
                                        decision.status === 'Tight' ? 'text-yellow-400' :
                                            'text-red-400'
                                        }`}>{decision.status}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">Effective Income</p>
                                    <p className="text-xl font-bold text-slate-100">{format3(decision.totalIncome)}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t border-slate-700/50">
                                <div className={decision.totalSIP === 0 ? 'opacity-30' : ''}>
                                    <p className="text-xs text-slate-500">Total SIP</p>
                                    <p className="text-lg font-bold text-blue-400">{format3(decision.totalSIP)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Emergency</p>
                                    <p className="text-lg font-bold text-amber-400">{format3(decision.emergencyAllocation)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Fun / Buffer</p>
                                    <p className="text-lg font-bold text-pink-400">{format3(decision.funAllocation + decision.finalSalaryBuffer)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Savings</p>
                                    <p className="text-lg font-bold text-emerald-400">{format3(decision.savingsAllocation)}</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Transfer Guide */}
                    <div className="space-y-6">
                        <section className={darkTheme.card + " p-6 h-full"}>
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Execution Guide</h2>
                            <div className="space-y-4">
                                {transfers.length === 0 ? (
                                    <p className="text-slate-500 italic text-center py-8">Account balances are aligned with the plan.</p>
                                ) : (
                                    transfers.map((t, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                            <div className="flex-1">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">From</p>
                                                <p className="text-base font-bold text-slate-100">{t.from}</p>
                                            </div>
                                            <div className="px-3">
                                                <span className="text-blue-400 text-lg">→</span>
                                            </div>
                                            <div className="flex-1 text-center">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">To</p>
                                                <p className="text-base font-bold text-slate-100">{t.to}</p>
                                            </div>
                                            <div className="flex-1 text-right ml-4 pl-4 border-l border-slate-700/50">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase">Amount</p>
                                                <p className="text-lg font-black text-green-400">{format3(t.amount)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-8 p-4 bg-blue-600/5 rounded-lg border border-blue-500/10">
                                <h3 className="text-xs font-bold text-blue-400 uppercase mb-2">Strategy: Stable Freelance</h3>
                                <ul className="text-[11px] text-slate-400 space-y-2">
                                    <li>• Using **Freelance from Previous Month** to avoid timing risks.</li>
                                    <li>• **April 2026** is Transition Month (SIP = 0).</li>
                                    <li>• **May 7, 2026** onwards: Sacred ₹2,000 Buffer + ₹10,000 SIP.</li>
                                </ul>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            <p className="mt-8 text-[10px] text-slate-600 uppercase tracking-widest text-center">
                Strict Decision Engine v1.7 • Stable Strategy Enabled
            </p>
        </div>
    );
}
