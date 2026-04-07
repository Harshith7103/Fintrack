import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Calendar, CreditCard, PieChart, AlertTriangle, ChevronRight, Calculator, Wallet, CheckCircle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { RadialBarChart, RadialBar, Legend, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const Budgets = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);

    // Selected Event for Details/Expense
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Create Budget Form State
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        total_budget: '',
        account_id: '',
        categories: [{ name: 'Travel', amount: '' }, { name: 'Food', amount: '' }]
    });

    // Expense Form State
    const [expenseData, setExpenseData] = useState({
        category_id: '',
        amount: '',
        description: ''
    });

    useEffect(() => {
        if (user) {
            fetchEvents();
            fetchAccounts();
        }
    }, [user]);

    const fetchEvents = async () => {
        try {
            const res = await api.get(`/events/${user.User_ID || user.id}`);
            setEvents(res.data);
        } catch (error) {
            console.error("Failed to fetch events:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await api.get(`/accounts/${user.User_ID || user.id}`);
            setAccounts(res.data);
        } catch (error) {
            console.error("Failed to fetch accounts:", error);
        }
    };

    const handleCreateBudget = async (e) => {
        e.preventDefault();

        // Final Validation
        const total = parseFloat(formData.total_budget);
        const allocated = formData.categories.reduce((sum, cat) => sum + (parseFloat(cat.amount) || 0), 0);

        if (Math.abs(total - allocated) > 1) {
            toast.error(`Allocation mismatch! Total: ${total}, Allocated: ${allocated}`);
            return;
        }

        try {
            await api.post('/events/create', {
                user_id: user.User_ID || user.id,
                ...formData
            });
            setShowCreateModal(false);
            resetCreateForm();
            fetchEvents();
            toast.success("Budget created successfully! Funds have been allocated.");
        } catch (error) {
            console.error("Create failed:", error);
            toast.error(error.response?.data?.error || "Failed to create budget.");
        }
    };

    const handleRecordExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/events/${selectedEvent.Event_ID}/expense`, expenseData);
            setShowExpenseModal(false);
            setExpenseData({ category_id: '', amount: '', description: '' });
            fetchEvents(); // Refresh list to show updated progress
            toast.success("Expense recorded successfully!");
        } catch (error) {
            console.error("Expense failed:", error);
            toast.error(error.response?.data?.error || "Failed to record expense.");
        }
    };

    const resetCreateForm = () => {
        setFormData({
            title: '',
            description: '',
            total_budget: '',
            account_id: '',
            categories: [{ name: 'Travel', amount: '' }, { name: 'Food', amount: '' }]
        });
        setStep(1);
    };

    // Category Splitter Helper
    const updateCategory = (index, field, value) => {
        const newCats = [...formData.categories];
        newCats[index][field] = value;
        setFormData({ ...formData, categories: newCats });
    };

    const addCategory = () => {
        setFormData({ ...formData, categories: [...formData.categories, { name: '', amount: '' }] });
    };

    const removeCategory = (index) => {
        const newCats = formData.categories.filter((_, i) => i !== index);
        setFormData({ ...formData, categories: newCats });
    };

    const getUnallocatedAmount = () => {
        const total = parseFloat(formData.total_budget) || 0;
        const allocated = formData.categories.reduce((sum, cat) => sum + (parseFloat(cat.amount) || 0), 0);
        return total - allocated;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white">Event Budgets</h2>
                    <p className="text-slate-400 mt-1">Manage special trips, parties, and projects.</p>
                </div>
                <button
                    onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white rounded-xl font-medium shadow-lg shadow-orange-600/30 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    New Event
                </button>
            </div>

            {/* Event List */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {events.map(event => (
                    <div key={event.Event_ID} className="glass-panel p-6 border-l-4 border-orange-500 group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-1">{event.Title}</h3>
                                <p className="text-sm text-slate-400">{event.Description || 'No description'}</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${event.Status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                                }`}>
                                {event.Status}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white font-medium">Budget Usage</span>
                                <span className="text-orange-400 font-bold">
                                    {Math.round(((event.Total_Budget - event.Remaining_Budget) / event.Total_Budget) * 100)}%
                                </span>
                            </div>
                            <div className="w-full h-4 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000"
                                    style={{ width: `${((event.Total_Budget - event.Remaining_Budget) / event.Total_Budget) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 text-xs text-slate-400">
                                <span>Spent: {formatCurrency(event.Total_Budget - event.Remaining_Budget)}</span>
                                <span>Total: {formatCurrency(event.Total_Budget)}</span>
                            </div>
                        </div>

                        {/* Categories Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {event.categories.map(cat => (
                                <div key={cat.Category_ID} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-300">{cat.Category_Name}</span>
                                        <span className={cat.Spent_Amount >= cat.Allocated_Amount ? "text-red-400" : "text-emerald-400"}>
                                            {formatCurrency(cat.Allocated_Amount - cat.Spent_Amount)} left
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${cat.Spent_Amount >= cat.Allocated_Amount ? 'bg-red-500' : 'bg-orange-400'}`}
                                            style={{ width: `${Math.min(100, (cat.Spent_Amount / cat.Allocated_Amount) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                            <button
                                onClick={() => { setSelectedEvent(event); setShowExpenseModal(true); }}
                                className="flex-1 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-orange-600/30"
                                disabled={event.Status !== 'Active'}
                            >
                                <CreditCard className="w-4 h-4" /> Record Expense
                            </button>
                        </div>
                    </div>
                ))}

                {events.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl">
                        <PieChart className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg">No active event budgets.</p>
                        <p className="text-sm">Create one to start tracking a trip or project.</p>
                    </div>
                )}
            </div>

            {/* Create Budget Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in relative">
                    <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-700">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {step === 1 ? <Plus className="w-5 h-5 text-orange-500" /> : <PieChart className="w-5 h-5 text-orange-500" />}
                                {step === 1 ? 'Create New Budget' : 'Allocate Categories'}
                            </h3>
                            <div className="flex gap-2 mt-4">
                                <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-orange-500' : 'bg-slate-700'}`} />
                                <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-orange-500' : 'bg-slate-700'}`} />
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {step === 1 ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Event Title</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                            placeholder="e.g. Trip to Goa 2026"
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Description</label>
                                        <textarea
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                            placeholder="Brief details..."
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Total Budget (₹)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none font-bold"
                                                placeholder="15000"
                                                value={formData.total_budget}
                                                onChange={e => setFormData({ ...formData, total_budget: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Source Account</label>
                                            <select
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                                value={formData.account_id}
                                                onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                            >
                                                <option value="">Select Source</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.Account_ID} value={acc.Account_ID}>
                                                        {acc.Account_Name} (₹{acc.Balance.toLocaleString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-slate-800 p-4 rounded-xl flex justify-between items-center mb-4">
                                        <span className="text-slate-400">Total Budget</span>
                                        <span className="text-xl font-bold text-white">{formatCurrency(formData.total_budget)}</span>
                                    </div>

                                    <div className={`p-3 rounded-lg text-sm flex justify-between items-center mb-4 border ${getUnallocatedAmount() === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                        <span>Unallocated Amount:</span>
                                        <span className="font-bold">{formatCurrency(getUnallocatedAmount())}</span>
                                    </div>

                                    {formData.categories.map((cat, index) => (
                                        <div key={index} className="flex gap-3">
                                            <input
                                                type="text"
                                                placeholder="Category Name"
                                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-orange-500 outline-none"
                                                value={cat.name}
                                                onChange={e => updateCategory(index, 'name', e.target.value)}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Amount"
                                                className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-orange-500 outline-none text-right"
                                                value={cat.amount}
                                                onChange={e => updateCategory(index, 'amount', e.target.value)}
                                            />
                                            <button
                                                onClick={() => removeCategory(index)}
                                                className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}

                                    <button onClick={addCategory} className="text-sm text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1">
                                        <Plus className="w-4 h-4" /> Add Category
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-700 flex justify-between">
                            {step === 1 ? (
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-2 text-slate-400 hover:text-white font-medium"
                                >
                                    Cancel
                                </button>
                            ) : (
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-6 py-2 text-slate-400 hover:text-white font-medium"
                                >
                                    Back
                                </button>
                            )}

                            {step === 1 ? (
                                <button
                                    onClick={() => {
                                        if (formData.title && formData.total_budget && formData.account_id) setStep(2);
                                        else toast.error("Please fill all fields");
                                    }}
                                    className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                                >
                                    Next <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleCreateBudget}
                                    disabled={getUnallocatedAmount() !== 0}
                                    className={`px-6 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ${getUnallocatedAmount() === 0
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    <CheckCircle className="w-4 h-4" /> Finalize Budget
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Expense Modal */}
            {showExpenseModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Record Expense for {selectedEvent.Title}</h3>
                        <form onSubmit={handleRecordExpense} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Category</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                    value={expenseData.category_id}
                                    onChange={e => setExpenseData({ ...expenseData, category_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {selectedEvent.categories.map(cat => (
                                        <option key={cat.Category_ID} value={cat.Category_ID}>
                                            {cat.Category_Name} (Left: {formatCurrency(cat.Allocated_Amount - cat.Spent_Amount)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                    value={expenseData.amount}
                                    onChange={e => setExpenseData({ ...expenseData, amount: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Description</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 outline-none"
                                    value={expenseData.description}
                                    onChange={e => setExpenseData({ ...expenseData, description: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowExpenseModal(false)}
                                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-600/20"
                                >
                                    Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Budgets;
