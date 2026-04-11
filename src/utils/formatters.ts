/**
 * Format amount in Indian Rupee style
 */
export const formatCurrency = (amount: number): string => {
    // Prevent negative zero (-0) display
    const normalizedAmount = Math.abs(amount) < 0.005 ? 0 : amount;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(normalizedAmount);
};

/**
 * Format quantity or price with up to 6 decimal places
 */
export const formatUnits = (amount: number, decimals: number = 4): string => {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
    }).format(amount);
};

/**
 * Format date to DD/MM/YYYY
 */
export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN');
};

/**
 * Get color class for transaction direction
 */
export const getDirectionColor = (direction: string): string => {
    const colors: Record<string, string> = {
        income: 'text-green-600',
        expense: 'text-red-600',
        transfer: 'text-blue-600',
    };
    return colors[direction] || 'text-gray-600';
};

/**
 * Get background color class for transaction direction
 */
export const getDirectionBgColor = (direction: string): string => {
    const colors: Record<string, string> = {
        income: 'bg-green-50',
        expense: 'bg-red-50',
        transfer: 'bg-blue-50',
    };
    return colors[direction] || 'bg-gray-50';
};
