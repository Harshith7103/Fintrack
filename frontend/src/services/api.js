import axios from 'axios';

/** 
 * Dev: same-origin `/api` via Vite proxy → backend :5000. 
 * Prod (Azure): set VITE_API_URL to your App Service URL.
 */
const API_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? '/api' : 'https://fintrack-api-prod.azurewebsites.net');

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ==================== AUTH ====================
export const getUserProfile = async (userId) => {
    const response = await api.get(`/auth/profile/${userId}`);
    return response.data;
};

export const updateUserProfile = async (userId, data) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
};

// ==================== DASHBOARD ====================
export const getDashboard = async (userId) => {
    const response = await api.get(`/dashboard/${userId}`);
    return response.data;
};

export const updateDashboardStat = async (userId, type, value) => {
    try {
        const response = await api.post('/dashboard/update-stat', { userId, type, value });
        return response.data;
    } catch (error) {
        console.error('Error updating stat:', error);
        throw error;
    }
};

// ==================== ACCOUNTS ====================
export const getAccounts = async (userId) => {
    const response = await api.get(`/accounts/${userId}`);
    return response.data;
};

export const createAccount = async (data) => {
    const response = await api.post('/accounts', data);
    return response.data;
};

export const updateAccount = async (accountId, data) => {
    const response = await api.put(`/accounts/${accountId}`, data);
    return response.data;
};

export const deleteAccount = async (accountId) => {
    const response = await api.delete(`/accounts/${accountId}`);
    return response.data;
};

export const transferBetweenAccounts = async (data) => {
    const response = await api.post('/accounts/transfer', data);
    return response.data;
};

// ==================== CATEGORIES ====================
export const getCategories = async (userId) => {
    const response = await api.get(`/categories/${userId}`);
    return response.data;
};

export const createCategory = async (data) => {
    const response = await api.post('/categories', data);
    return response.data;
};

export const updateCategory = async (categoryId, data) => {
    const response = await api.put(`/categories/${categoryId}`, data);
    return response.data;
};

export const deleteCategory = async (categoryId) => {
    const response = await api.delete(`/categories/${categoryId}`);
    return response.data;
};

// ==================== TRANSACTIONS ====================
export const getTransactions = async (userId, filters = {}) => {
    const response = await api.get(`/transactions/${userId}`, { params: filters });
    return response.data;
};

export const createTransaction = async (data) => {
    const response = await api.post('/transactions', data);
    return response.data;
};

export const updateTransaction = async (transactionId, data) => {
    const response = await api.put(`/transactions/${transactionId}`, data);
    return response.data;
};

export const deleteTransaction = async (transactionId) => {
    const response = await api.delete(`/transactions/${transactionId}`);
    return response.data;
};

// ==================== SALARY ====================
export const getSalaries = async (userId) => {
    const response = await api.get(`/salary/${userId}`);
    return response.data;
};

export const configureSalary = async (data) => {
    const response = await api.post('/salary/configure', data);
    return response.data;
};

export const creditSalaryManually = async (data) => {
    const response = await api.post('/salary/credit', data);
    return response.data;
};

export const updateSalary = async (salaryId, data) => {
    const response = await api.put(`/salary/${salaryId}`, data);
    return response.data;
};

export const deleteSalary = async (salaryId) => {
    const response = await api.delete(`/salary/${salaryId}`);
    return response.data;
};

export const processSalaryAutomatically = async (salaryId) => {
    const response = await api.post(`/salary/process/${salaryId}`);
    return response.data;
};

// ==================== EMI ====================
export const getEMIs = async (userId) => {
    const response = await api.get(`/emi/${userId}`);
    return response.data;
};

export const createEMI = async (data) => {
    const response = await api.post('/emi', data);
    return response.data;
};

export const updateEMI = async (emiId, data) => {
    const response = await api.put(`/emi/${emiId}`, data);
    return response.data;
};

export const deleteEMI = async (emiId) => {
    const response = await api.delete(`/emi/${emiId}`);
    return response.data;
};

export const processEMIAutomatically = async (emiId) => {
    const response = await api.post(`/emi/process/${emiId}`);
    return response.data;
};

// ==================== SAVINGS ====================
export const getSavingsGoals = async (userId) => {
    const response = await api.get(`/savings/${userId}`);
    return response.data;
};

export const createSavingsGoal = async (data) => {
    const response = await api.post('/savings', data);
    return response.data;
};

export const updateSavingsGoal = async (goalId, data) => {
    const response = await api.put(`/savings/${goalId}`, data);
    return response.data;
};

export const deleteSavingsGoal = async (goalId) => {
    const response = await api.delete(`/savings/${goalId}`);
    return response.data;
};

export const contributeToSavingsGoal = async (goalId, data) => {
    const response = await api.post(`/savings/${goalId}/contribute`, data);
    return response.data;
};

export const getSavingsEmiHistory = async (goalId) => {
    const response = await api.get(`/savings/${goalId}/emi-history`);
    return response.data;
};

// ==================== BUDGET ====================
export const getBudgets = async (userId, filters = {}) => {
    const response = await api.get(`/budget/${userId}`, { params: filters });
    return response.data;
};

export const getBudgetAnalysis = async (userId, monthYear) => {
    const response = await api.get(`/budget/${userId}/analysis`, { params: { month_year: monthYear } });
    return response.data;
};

export const createOrUpdateBudget = async (data) => {
    const response = await api.post('/budget', data);
    return response.data;
};

export const deleteBudget = async (budgetId) => {
    const response = await api.delete(`/budget/${budgetId}`);
    return response.data;
};

// ==================== AUDIT ====================
export const getAuditLogs = async (userId) => {
    const response = await api.get(`/audit/${userId}`);
    return response.data;
};

export const getMongoStats = async (userId) => {
    const response = await api.get(`/mongodb/stats/summary/${userId}`);
    return response.data;
};

// ==================== FRAUD DETECTION ====================
export const predictFraud = async (data) => {
    const response = await api.post('/fraud/predict', data);
    return response.data;
};

export const getFraudHistory = async (userId) => {
    const response = await api.get(`/fraud/${userId}`);
    return response.data;
};

export const getFraudStats = async (userId) => {
    const response = await api.get(`/fraud/stats/${userId}`);
    return response.data;
};

// ==================== CHATBOT ====================
export const sendChatMessage = async (userId, message, context = {}) => {
    const response = await api.post('/chatbot/message', { user_id: userId, message, context });
    return response.data;
};
