import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSalaries, configureSalary, creditSalaryManually, deleteSalary, getAccounts } from '../services/api';
import { Loader, Plus, Trash2, DollarSign, Calendar, CheckCircle, RefreshCw, Briefcase } from 'lucide-react';

const SalaryManager = () => {
    const { user } = useAuth();
    const [salaries, setSalaries] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        account_id: '',
        amount: '',
        salary_day: '1'
    });

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            const userId = user.User_ID || user.id;
            const [salData, accData] = await Promise.all([
                getSalaries(userId),
                getAccounts(userId)
            ]);
            setSalaries(salData);
            setAccounts(accData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSalary = async (e) => {
        e.preventDefault();
        try {
            await configureSalary({
                user_id: user.User_ID || user.id,
                ...formData
            });
            setShowAddModal(false);
            setFormData({ account_id: '', amount: '', salary_day: '1' }); // Reset
            loadData();
        } catch (err) {
            toast.error('Error adding salary: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleCredit = async (salary) => {
        if (!window.confirm(`Credit ₹${salary.Amount} to ${salary.Account_Name} now?`)) return;
        try {
            await creditSalaryManually({
                user_id: user.User_ID || user.id,
                account_id: salary.Account_ID,
                amount: salary.Amount,
                description: 'Manual Salary Credit via Manager'
            });
            alert('Salary Credited! Check your transactions.');
        } catch (err) {
            alert('Error: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this salary configuration?')) return;
        try {
            await deleteSalary(id);
            loadData();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
        </div>
    );

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-24">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Salary Manager</h1>
                    <p className="text-slate-400 mt-1">Manage your income sources and auto-credits.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition disabled:opacity-50"
                    disabled={accounts.length === 0}
                >
                    <Plus className="w-5 h-5" /> Add Salary
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {salaries.map(salary => (
                    <div key={salary.Salary_ID} className="glass-panel p-6 relative group border border-slate-700/50 hover:border-emerald-500/50 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-emerald-500/20 p-3 rounded-lg text-emerald-400">
                                <Briefcase className="w-6 h-6" />
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${salary.Status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                {salary.Status}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-white">₹{salary.Amount}</h3>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                <DollarSign className="w-4 h-4" /> Account: {salary.Account_Name}
                            </p>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Day: {salary.Salary_Day} of every month
                            </p>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => handleCredit(salary)}
                                className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" /> Credit Now
                            </button>
                            <button
                                onClick={() => handleDelete(salary.Salary_ID)}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {salaries.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-500">
                        No salary configurations found. Add one to get started.
                    </div>
                )}
            </div>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md animate-scale-in">
                        <h2 className="text-xl font-bold text-white mb-4">Add Salary Configuration</h2>
                        <form onSubmit={handleAddSalary} className="space-y-4">
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">Select Account to Credit</label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.account_id}
                                    onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.Account_ID} value={acc.Account_ID}>{acc.Account_Name} (₹{acc.Balance})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">Salary Amount (₹)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="e.g. 50000"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 text-sm mb-1">Day of Month (1-31)</label>
                                <input
                                    type="number"
                                    min="1" max="31"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.salary_day}
                                    onChange={e => setFormData({ ...formData, salary_day: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl hover:bg-slate-800 text-slate-300 transition">Cancel</button>
                                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition">Save Salary</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalaryManager;
