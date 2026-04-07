import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, DollarSign, Activity, Percent, Building2, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const EMI = () => {
    const { user } = useAuth();
    const [emis, setEmis] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState(''); // Local error for modal

    // Form State
    const [formData, setFormData] = useState({
        emi_title: '',
        lender_name: '',
        total_loan_amount: '',
        interest_rate: '',
        tenure_months: '',
        start_date: new Date().toISOString().split('T')[0],
        emi_day: '1',
        account_id: '',
        category_id: ''
    });

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [emisRes, accountsRes, categoriesRes] = await Promise.all([
                api.get(`/emi/${user.User_ID}`),
                api.get(`/accounts/${user.User_ID}`),
                api.get(`/categories/${user.User_ID}`)
            ]);

            setEmis(emisRes.data);
            setAccounts(accountsRes.data);

            // Filter expense categories
            const expenseCats = categoriesRes.data.filter(c => c.Category_Type === 'Expense');
            setCategories(expenseCats);

            // Set default category if exists (e.g., 'Loans' or 'Bills') or first one
            const loanCat = expenseCats.find(c => c.Category_Name.toLowerCase().includes('loan') || c.Category_Name.toLowerCase().includes('emi'));
            if (loanCat) {
                setFormData(prev => ({ ...prev, category_id: loanCat.Category_ID }));
            } else if (expenseCats.length > 0) {
                setFormData(prev => ({ ...prev, category_id: expenseCats[0].Category_ID }));
            }

            if (accountsRes.data.length > 0) {
                setFormData(prev => ({ ...prev, account_id: accountsRes.data[0].Account_ID }));
            }

            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Failed to load data');
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');

        if (parseFloat(formData.total_loan_amount) <= 0 || parseFloat(formData.interest_rate) < 0 || parseInt(formData.tenure_months) <= 0) {
            setFormError("Please enter valid positive numbers for amount, interest, and tenure.");
            return;
        }

        if (!formData.account_id) {
            setFormError("Please select a linked account.");
            return;
        }

        try {
            await api.post('/emi', {
                user_id: user.User_ID,
                ...formData
            });
            setShowAddModal(false);
            fetchData(); // Refresh list
            // Reset form (keep some defaults)
            setFormData(prev => ({
                ...prev,
                emi_title: '',
                lender_name: '',
                total_loan_amount: '',
                interest_rate: '',
                tenure_months: ''
            }));
        } catch (err) {
            console.error(err);
            setFormError(err.response?.data?.error || 'Failed to create EMI');
        }
    };

    const handlePayNow = async (emiId) => {
        if (!window.confirm("Process this EMI payment manually now?")) return;
        try {
            await api.post(`/emi/process/${emiId}`);
            toast.success("EMI processed successfully!");
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Failed to process EMI");
        }
    };

    const handleDelete = async (emiId) => {
        if (window.confirm('Are you sure you want to delete this Loan record?')) {
            try {
                await api.delete(`/emi/${emiId}`);
                fetchData();
            } catch (err) {
                console.error(err);
                setError('Failed to delete EMI');
            }
        }
    };

    // Calculate estimated EMI for preview
    const calculatePreviewEMI = () => {
        const P = parseFloat(formData.total_loan_amount);
        const r = parseFloat(formData.interest_rate) / 12 / 100;
        const n = parseInt(formData.tenure_months);

        if (!P || !n) return 0;
        if (r === 0 || isNaN(r)) return (P / n).toFixed(2);

        const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        return isNaN(emi) ? 0 : emi.toFixed(2);
    };

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

    return (
        <div className="space-y-6 pb-20 overflow-y-auto h-screen p-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
                <div>
                    <h2 className="text-3xl font-black text-white mb-2">EMI Management</h2>
                    <p className="text-slate-400">Track and manage your loans automatically</p>
                </div>
                <button
                    onClick={() => { setShowAddModal(true); setFormError(''); }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all transform hover:scale-105"
                >
                    <Plus className="w-5 h-5" />
                    Add New Loan
                </button>
            </div>

            {error && <div className="bg-red-500/10 text-red-500 p-4 rounded-xl border border-red-500/20">{error}</div>}

            {/* List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {emis.map((emi) => (
                    <div key={emi.EMI_ID} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-purple-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button
                                onClick={() => handlePayNow(emi.EMI_ID)}
                                className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                                title="Pay Now"
                            >
                                <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(emi.EMI_ID)}
                                className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                                title="Delete Loan"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{emi.EMI_Title}</h3>
                                <p className="text-sm text-slate-400">{emi.Lender_Name}</p>
                            </div>
                            <div className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${emi.Status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>
                                {emi.Status}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30">
                                <p className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                                    <DollarSign className="w-3 h-3" /> Monthly EMI
                                </p>
                                <p className="text-lg font-bold text-white">₹{emi.EMI_Amount.toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/30">
                                <p className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Next Due
                                </p>
                                <p className="text-lg font-bold text-white">Day {emi.EMI_Day}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-slate-400 mb-2">
                                <span>Paid: ₹{emi.Amount_Paid?.toLocaleString()} ({emi.Months_Paid}/{emi.Tenure_Months} mos)</span>
                                <span>Total: ₹{emi.Total_Payable?.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                    style={{ width: `${Math.min(100, (emi.Months_Paid / emi.Tenure_Months) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-700/30">
                            <div className="text-xs text-slate-400">
                                <p>Remaining Balance</p>
                                <p className="text-sm font-bold text-white">₹{emi.Remaining_Balance?.toLocaleString()}</p>
                            </div>
                            <div className="text-xs text-right text-slate-400">
                                <p>Rate</p>
                                <p className="text-sm font-bold text-white">{emi.Interest_Rate}%</p>
                            </div>
                            <div className="text-xs text-right text-slate-400">
                                <p>End Date</p>
                                <p className="text-sm font-bold text-white">{new Date(emi.End_Date).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {emis.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No active loans. Add a new EMI to get started.</p>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                            <h3 className="text-xl font-bold text-white">Add New Loan</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        {formError && (
                            <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreate} className="p-6 space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Loan Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        placeholder="e.g. Home Loan"
                                        value={formData.emi_title}
                                        onChange={e => setFormData({ ...formData, emi_title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Lender / Bank</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        placeholder="e.g. HDFC Bank"
                                        value={formData.lender_name}
                                        onChange={e => setFormData({ ...formData, lender_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Total Loan Amount</label>
                                    <div className="relative">
                                        <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            onKeyDown={(e) => {
                                                if (["e", "E", "+", "-"].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            value={formData.total_loan_amount}
                                            onChange={e => setFormData({ ...formData, total_loan_amount: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Interest Rate (%)</label>
                                    <div className="relative">
                                        <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            onKeyDown={(e) => {
                                                if (["e", "E", "+", "-"].includes(e.key)) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            value={formData.interest_rate}
                                            onChange={e => setFormData({ ...formData, interest_rate: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Tenure (Months)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        onKeyDown={(e) => {
                                            if (["e", "E", "+", "-"].includes(e.key)) {
                                                e.preventDefault();
                                            }
                                        }}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        value={formData.tenure_months}
                                        onChange={e => setFormData({ ...formData, tenure_months: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Calculated Preview */}
                            {(formData.total_loan_amount && formData.tenure_months) && (
                                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl flex items-center gap-3">
                                    <TrendingUp className="w-5 h-5 text-purple-400" />
                                    <div>
                                        <p className="text-xs text-purple-300">Estimated Monthly EMI</p>
                                        <p className="text-lg font-bold text-white">₹{Number(calculatePreviewEMI()).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Auto-Deduction Day</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        value={formData.emi_day}
                                        onChange={e => setFormData({ ...formData, emi_day: e.target.value })}
                                    >
                                        {[...Array(28)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Linked Account</label>
                                <select
                                    required
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    value={formData.account_id}
                                    onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.Account_ID} value={acc.Account_ID}>
                                            {acc.Account_Name} (₹{acc.Balance?.toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all mt-4"
                            >
                                Create Loan Record
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EMI;
