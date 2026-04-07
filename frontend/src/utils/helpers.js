// Format number to Indian Rupee currency
export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0';

    const num = parseFloat(amount);
    if (isNaN(num)) return '₹0';

    // Indian number formatting with commas
    const formatted = num.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

    return `₹${formatted}`;
};

// Format date to readable format
export const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };

    return date.toLocaleString('en-IN', options);
};

// Format date to YYYY-MM-DD for input fields
export const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
};

// Get current month in YYYY-MM format
export const getCurrentMonth = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// Get month name from YYYY-MM format
export const getMonthName = (monthYear) => {
    if (!monthYear) return '';
    const [year, month] = monthYear.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

// Calculate percentage
export const calculatePercentage = (value, total) => {
    if (!total || total === 0) return 0;
    return ((value / total) * 100).toFixed(1);
};

// Get greeting based on time
export const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
};

// Validate Indian phone number
export const isValidIndianPhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
};

// Get transaction type color
export const getTransactionTypeColor = (type) => {
    return type === 'Income' ? 'emerald' : 'rose';
};

// Get account type icon
export const getAccountTypeIcon = (type) => {
    const icons = {
        'Cash': '💵',
        'Bank': '🏦',
        'Wallet': '👛',
        'Credit Card': '💳'
    };
    return icons[type] || '💰';
};

// Get category icon
export const getCategoryIcon = (categoryName) => {
    const icons = {
        'Salary': '💰',
        'Food': '🍔',
        'Travel': '🚗',
        'Bills': '📄',
        'Entertainment': '🎬',
        'Shopping': '🛍️',
        'Health': '⚕️',
        'Education': '📚',
        'EMI': '💳',
        'Savings': '🏦'
    };
    return icons[categoryName] || '💵';
};
