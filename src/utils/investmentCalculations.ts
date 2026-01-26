// Investment calculation utilities

/**
 * Calculate FD maturity amount
 * Formula: A = P × (1 + r/n)^(n×t)
 * @param principal Principal amount
 * @param rate Annual interest rate (e.g., 7.0 for 7%)
 * @param tenureMonths Tenure in months
 * @param compounding 'monthly' | 'quarterly' | 'yearly'
 */
export function calculateFDMaturity(
    principal: number,
    rate: number,
    tenureMonths: number,
    compounding: 'monthly' | 'quarterly' | 'yearly' = 'quarterly'
): { maturityAmount: number; interestEarned: number } {
    const r = rate / 100; // Convert percentage to decimal
    const t = tenureMonths / 12; // Convert months to years
    const n = compounding === 'monthly' ? 12 : compounding === 'quarterly' ? 4 : 1;

    const maturityAmount = principal * Math.pow(1 + r / n, n * t);
    const interestEarned = maturityAmount - principal;

    return {
        maturityAmount: Math.round(maturityAmount * 100) / 100,
        interestEarned: Math.round(interestEarned * 100) / 100
    };
}

/**
 * Calculate RD maturity amount
 * Each monthly deposit earns compound interest for remaining tenure
 * @param monthlyDeposit Monthly deposit amount
 * @param rate Annual interest rate (e.g., 6.5 for 6.5%)
 * @param tenureMonths Total tenure in months
 * @param compounding Compounding frequency
 */
export function calculateRDMaturity(
    monthlyDeposit: number,
    rate: number,
    tenureMonths: number,
    compounding: 'quarterly' | 'monthly' = 'quarterly'
): { maturityAmount: number; totalDeposited: number; interestEarned: number } {
    const r = rate / 100;
    const n = compounding === 'monthly' ? 12 : 4;

    let maturityAmount = 0;

    // Each monthly deposit earns interest for the remaining period
    for (let month = 1; month <= tenureMonths; month++) {
        const remainingMonths = tenureMonths - month + 1;
        const remainingYears = remainingMonths / 12;
        const amount = monthlyDeposit * Math.pow(1 + r / n, n * remainingYears);
        maturityAmount += amount;
    }

    const totalDeposited = monthlyDeposit * tenureMonths;
    const interestEarned = maturityAmount - totalDeposited;

    return {
        maturityAmount: Math.round(maturityAmount * 100) / 100,
        totalDeposited,
        interestEarned: Math.round(interestEarned * 100) / 100
    };
}

/**
 * Calculate PPF interest and balance
 * PPF has 7.1% interest, compounded annually (credited on March 31)
 * Interest calculated on min balance between 5th and end of month
 * @param deposits Array of deposits with dates and amounts
 * @param rate Annual interest rate (default 7.1%)
 */
export function calculatePPFBalance(
    totalDeposited: number,
    yearsCompleted: number,
    rate: number = 7.1
): { currentBalance: number; interestEarned: number; maturityYears: number } {
    // Simplified PPF calculation
    // For accurate calculation, we'd need monthly balances
    const r = rate / 100;

    // Approximate using compound interest formula
    // This is a simplified version; actual PPF is more complex
    let balance = 0;
    const avgYearlyDeposit = totalDeposited / Math.max(yearsCompleted, 1);

    for (let year = 1; year <= yearsCompleted; year++) {
        balance = (balance + avgYearlyDeposit) * (1 + r);
    }

    const interestEarned = balance - totalDeposited;

    return {
        currentBalance: Math.round(balance * 100) / 100,
        interestEarned: Math.round(interestEarned * 100) / 100,
        maturityYears: 15 // PPF matures after 15 years
    };
}

/**
 * Calculate NPS current value
 * @param totalUnits Total units held
 * @param currentNAV Current NAV value
 * @param totalContributed Total amount contributed
 */
export function calculateNPSValue(
    totalUnits: number,
    currentNAV: number,
    totalContributed: number
): { currentValue: number; absoluteReturn: number; percentageReturn: number } {
    const currentValue = totalUnits * currentNAV;
    const absoluteReturn = currentValue - totalContributed;
    const percentageReturn = totalContributed > 0
        ? (absoluteReturn / totalContributed) * 100
        : 0;

    return {
        currentValue: Math.round(currentValue * 100) / 100,
        absoluteReturn: Math.round(absoluteReturn * 100) / 100,
        percentageReturn: Math.round(percentageReturn * 100) / 100
    };
}

/**
 * Calculate days remaining until maturity
 */
export function getDaysRemaining(maturityDate: string): number {
    const today = new Date();
    const maturity = new Date(maturityDate);
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}

/**
 * Calculate months completed for RD
 */
export function getMonthsCompleted(openingDate: string): number {
    const start = new Date(openingDate);
    const today = new Date();
    const months = (today.getFullYear() - start.getFullYear()) * 12 +
        (today.getMonth() - start.getMonth());
    return Math.max(0, months);
}

/**
 * Fetch NPS NAV from npsnav.in API
 */
export async function fetchNPSNAV(schemeId: string): Promise<{ nav: number; date: string } | null> {
    try {
        const response = await fetch(`https://npsnav.in/api/scheme/${schemeId}`);
        if (!response.ok) {
            console.error('Failed to fetch NPS NAV');
            return null;
        }
        const data = await response.json();
        return {
            nav: parseFloat(data.nav),
            date: data.date || new Date().toISOString().split('T')[0]
        };
    } catch (error) {
        console.error('Error fetching NPS NAV:', error);
        return null;
    }
}

/**
 * Get NPS scheme ID for fund manager and scheme type
 */
export function getNPSSchemeId(fundManager: string, schemeType: string): string {
    // Common NPS scheme IDs (Tier 1)
    const schemes: Record<string, Record<string, string>> = {
        'SBI': { 'E': 'SM001001', 'C': 'SM001002', 'G': 'SM001003' },
        'HDFC': { 'E': 'SM006001', 'C': 'SM006002', 'G': 'SM006003' },
        'ICICI': { 'E': 'SM003001', 'C': 'SM003002', 'G': 'SM003003' },
        'UTI': { 'E': 'SM005001', 'C': 'SM005002', 'G': 'SM005003' },
        'Kotak': { 'E': 'SM004001', 'C': 'SM004002', 'G': 'SM004003' },
        'Birla': { 'E': 'SM008001', 'C': 'SM008002', 'G': 'SM008003' },
        'LIC': { 'E': 'SM002001', 'C': 'SM002002', 'G': 'SM002003' },
    };

    return schemes[fundManager]?.[schemeType] || '';
}

// NPS Fund Manager options
export const NPS_FUND_MANAGERS = [
    'SBI',
    'HDFC',
    'ICICI',
    'UTI',
    'Kotak',
    'Birla',
    'LIC'
];

// NPS Scheme types
export const NPS_SCHEME_TYPES = [
    { value: 'E', label: 'Equity (E)' },
    { value: 'C', label: 'Corporate Bond (C)' },
    { value: 'G', label: 'Govt Securities (G)' },
    { value: 'A', label: 'Alternative (A)' }
];
