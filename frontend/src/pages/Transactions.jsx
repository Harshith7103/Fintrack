import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, ArrowUpRight, ArrowDownRight, Trash2, Edit2, X, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api, getAccounts } from '../services/api';
import { FraudBadge } from '../components/FraudAlerts';
import toast from 'react-hot-toast';

const Transactions = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [filterType, setFilterType] = useState('All');

    // Form State
    const [formData, setFormData] = useState({
        amount: '',
        type: 'Expense',
        category_id: '',
        account_id: '',
        description: '',
        reference: 'Manual'
    });

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const userId = user.User_ID || user.id;
            const [txRes, catRes, accRes] = await Promise.all([
                api.get(`/transactions/${userId}`),
                api.get(`/categories/${userId}`),
                getAccounts(userId)
            ]);

            setTransactions(txRes.data);
            setCategories(catRes.data);
            setAccounts(accRes);

            // Set default category if available
            if (catRes.data.length > 0) {
                setFormData(prev => ({ ...prev, category_id: catRes.data[0].Category_ID }));
            }
            // Set default account if available
            if (accRes.length > 0) {
                setFormData(prev => ({ ...prev, account_id: accRes[0].Account_ID }));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!formData.category_id || !formData.account_id) {
                toast.error("Please select a category and account");
                return;
            }

            if (parseFloat(formData.amount) <= 0) {
                toast.error("Amount must be a positive number");
                return;
            }

            const payload = {
                user_id: user.User_ID || user.id,
                account_id: formData.account_id,
                category_id: formData.category_id,
                amount: parseFloat(formData.amount),
                transaction_type: formData.type,
                description: formData.description,
                reference_type: 'Manual'
            };

            await api.post('/transactions', payload);

            // Reset form and refresh
            setFormData(prev => ({
                ...prev,
                amount: '',
                description: ''
            }));
            toast.success("Transaction added successfully!");
            fetchData();

        } catch (error) {
            console.error("Error adding transaction:", error);
            toast.error(error.response?.data?.error || "Failed to add transaction.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this transaction?")) return;

        try {
            const userId = user.User_ID || user.id;
            await api.delete(`/transactions/${id}?user_id=${userId}`);
            setTransactions(transactions.filter(t => t.Transaction_ID !== id));
            toast.success("Transaction deleted successfully");
        } catch (error) {
            console.error("Error deleting transaction:", error);
            toast.error(error.response?.data?.error || "Failed to delete.");
        }
    };

    const startEdit = (tx) => {
        setEditingId(tx.Transaction_ID);
        setFormData({
            ...formData,
            amount: tx.Amount,
            type: tx.Transaction_Type,
            category_id: tx.Category_ID,
            account_id: tx.Account_ID || formData.account_id,
            description: tx.Description || ''
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData(prev => ({
            ...prev,
            amount: '',
            description: ''
        }));
    };

    const handleUpdate = async (id) => {
        try {
            await api.put(`/transactions/${id}`, {
                user_id: user.User_ID || user.id,
                amount: parseFloat(formData.amount),
                description: formData.description,
                category_id: formData.category_id
            });
            setEditingId(null);
            setFormData(prev => ({ ...prev, amount: '', description: '' }));
            fetchData();
            toast.success("Transaction updated!");
        } catch (error) {
            console.error("Error updating transaction:", error);
            toast.error(error.response?.data?.error || "Update failed.");
        }
    };

    const filteredTransactions = transactions.filter(tx => {
        if (filterType === 'All') return true;
        return tx.Transaction_Type === filterType;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-3xl font-bold text-white">Transactions</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="glass-panel p-6 h-fit sticky top-6">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        {editingId ? <Edit2 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                        {editingId ? "Edit Transaction" : "New Transaction"}
                    </h3>

                    <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Type</label>
                            <div className="flex bg-slate-800 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'Expense' })}
                                    className={`flex-1 py-2 rounded-md transition-all ${formData.type === 'Expense' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400'}`}
                                    disabled={!!editingId}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'Income' })}
                                    className={`flex-1 py-2 rounded-md transition-all ${formData.type === 'Income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'}`}
                                    disabled={!!editingId}
                                >
                                    Income
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Account</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                                value={formData.account_id}
                                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                            >
                                {accounts.map(acc => (
                                    <option key={acc.Account_ID} value={acc.Account_ID}>
                                        {acc.Account_Name} (₹{acc.Balance})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Amount (INR)</label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="0.00"
                                required
                                min="0"
                                onKeyDown={(e) => {
                                    if (["e", "E", "+", "-"].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Category</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                                value={formData.category_id}
                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            >
                                {categories.map(cat => (
                                    <option key={cat.Category_ID} value={cat.Category_ID}>
                                        {cat.Category_Name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Description</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                                placeholder="e.g. Dinner, Taxi, etc."
                            />
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-600/20 transition-all">
                                {editingId ? "Update" : "Add Transaction"}
                            </button>
                            {editingId && (
                                <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Table Section */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-white">Transaction Summary</h3>
                        
                        {/* Filter Dropdown */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">Filter:</span>
                            <select 
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none w-32 focus:ring-2 focus:ring-indigo-500"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="All">All Types</option>
                                <option value="Expense">Expense Only</option>
                                <option value="Income">Income Only</option>
                            </select>
                        </div>
                    </div>

                    <div className="glass-panel overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-700 bg-slate-800/50">
                                        <th className="p-4 text-slate-400 font-medium">Date</th>
                                        <th className="p-4 text-slate-400 font-medium">Category</th>
                                        <th className="p-4 text-slate-400 font-medium">Description</th>
                                        <th className="p-4 text-slate-400 font-medium">Type</th>
                                        <th className="p-4 text-slate-400 font-medium">Fraud</th>
                                        <th className="p-4 text-slate-400 font-medium text-right">Amount</th>
                                        <th className="p-4 text-slate-400 font-medium text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400">Loading transactions...</td>
                                        </tr>
                                    ) : filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-500">No transactions found. Add one!</td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map((tx) => (
                                            <tr key={tx.Transaction_ID} className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors ${editingId === tx.Transaction_ID ? 'bg-indigo-500/10' : ''}`}>
                                                <td className="p-4 text-slate-300">
                                                    {new Date(tx.Transaction_DateTime).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-white font-medium">
                                                    {tx.Category_Name || 'Uncategorized'}
                                                </td>
                                                <td className="p-4 text-slate-400 text-sm">
                                                    {tx.Description || tx.Reference_Type}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.Transaction_Type === 'Expense' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                        {tx.Transaction_Type}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <FraudBadge status={tx.fraud_status || 'Safe'} />
                                                </td>
                                                <td className={`p-4 text-right font-bold ${tx.Transaction_Type === 'Expense' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                    {tx.Transaction_Type === 'Expense' ? '-' : '+'}{tx.Amount}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => startEdit(tx)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-all" title="Edit">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(tx.Transaction_ID)} className="p-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-rose-400 transition-all" title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Transactions;
