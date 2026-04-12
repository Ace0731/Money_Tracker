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

/**
 * Format date to relative time (e.g., 2h ago)
 */
export const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Never';
    
    // Convert SQLite YYYY-MM-DD HH:MM:SS to ISO for cross-browser reliability
    const isoString = dateString.includes(' ') ? dateString.replace(' ', 'T') : dateString;
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 0) return 'Just now'; // Future date handle
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
