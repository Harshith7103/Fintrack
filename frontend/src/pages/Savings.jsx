import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Target, Plus, Calendar, TrendingUp, Calculator, Trash2, CheckCircle, X, Edit2, Zap, Clock, AlertCircle, ChevronDown, ChevronUp, IndianRupee } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

const Savings = () => {
    const { user } = useAuth();
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showContributeModal, setShowContributeModal] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [editingGoalId, setEditingGoalId] = useState(null);
    const [expandedHistory, setExpandedHistory] = useState(null);
    const [emiHistory, setEmiHistory] = useState({});
    const [formError, setFormError] = useState(''); // Global form error state for modals

    // Form State
    const [formData, setFormData] = useState({
        goal_title: '',
        target_amount: '',
        current_amount: '0',
        start_date: new Date().toISOString().slice(0, 10),
        duration_months: '',
        emi_enabled: false,
        emi_amount: '',
        emi_date: '1',
        account_id: ''
    });

    const [contributionAmount, setContributionAmount] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');

    useEffect(() => {
        if (user) {
            fetchGoals();
            fetchAccounts();
        }
    }, [user]);

    const fetchGoals = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/savings/${user.User_ID || user.id}`);
            setGoals(res.data);
        } catch (error) {
            console.error("Failed to fetch goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const res = await api.get(`/accounts/${user.User_ID || user.id}`);
            setAccounts(res.data);
            if (res.data.length > 0) {
                const cashAcc = res.data.find(a => a.Account_Type === 'Cash');
                setSelectedAccount(cashAcc ? cashAcc.Account_ID : res.data[0].Account_ID);
            }
        } catch (error) {
            console.error("Failed to fetch accounts:", error);
        }
    };

    const fetchEMIHistory = async (goalId) => {
        try {
            const res = await api.get(`/savings/${goalId}/emi-history`);
            setEmiHistory(prev => ({ ...prev, [goalId]: res.data }));
        } catch (error) {
            console.error("Failed to fetch EMI history:", error);
        }
    };

    const toggleHistory = (goalId) => {
        if (expandedHistory === goalId) {
            setExpandedHistory(null);
        } else {
            setExpandedHistory(goalId);
            if (!emiHistory[goalId]) {
                fetchEMIHistory(goalId);
            }
        }
    };

    // Derived Calculations for New/Edit Goal
    const calculateProjection = () => {
        const target = parseFloat(formData.target_amount) || 0;
        const current = parseFloat(formData.current_amount) || 0;
        const months = parseInt(formData.duration_months) || 0;
        const start = new Date(formData.start_date);

        if (months <= 0) return { monthly: 0, endDate: '-' };

        const required = Math.max(0, (target - current) / months);
        const endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + months);

        return {
            monthly: required,
            endDate: endDate.toLocaleDateString()
        };
    };

    const projection = calculateProjection();

    // Auto-fill EMI amount from projection
    useEffect(() => {
        if (formData.emi_enabled && projection.monthly > 0 && !editingGoalId) {
            setFormData(prev => ({
                ...prev,
                emi_amount: Math.ceil(projection.monthly).toString()
            }));
        }
    }, [formData.emi_enabled, formData.target_amount, formData.current_amount, formData.duration_months]);

    const handleEdit = (goal) => {
        const startDate = new Date(goal.Start_Date);
        const targetDate = new Date(goal.Target_Date);

        let months = (targetDate.getFullYear() - startDate.getFullYear()) * 12;
        months -= startDate.getMonth();
        months += targetDate.getMonth();
        months = Math.max(1, months);

        setFormData({
            goal_title: goal.Goal_Title,
            target_amount: goal.Target_Amount.toString(),
            current_amount: goal.Current_Amount.toString(),
            start_date: goal.Start_Date ? goal.Start_Date.split('T')[0] : new Date().toISOString().slice(0, 10),
            duration_months: months.toString(),
            emi_enabled: !!goal.EMI_Enabled,
            emi_amount: goal.EMI_Amount ? goal.EMI_Amount.toString() : '',
            emi_date: goal.EMI_Date ? goal.EMI_Date.toString() : '1',
            account_id: goal.Account_ID ? goal.Account_ID.toString() : '',
            initial_account_id: '' // Used only for new goals
        });
        setEditingGoalId(goal.Goal_ID);
        setShowModal(true);
    };

    const handleAddOrUpdateGoal = async (e) => {
        e.preventDefault();
        setFormError('');

        const target = parseFloat(formData.target_amount);
        const current = parseFloat(formData.current_amount);
        const duration = parseInt(formData.duration_months);

        if (target <= 0 || duration <= 0) {
            setFormError("Amount and duration must be positive values.");
            return;
        }

        if (current >= target) {
            setFormError("Current saved amount cannot exceed or equal target.");
            return;
        }

            // Validate Initial Deposit against Account Balance
            if (!editingGoalId && current > 0) {
                if (!formData.initial_account_id) {
                    setFormError("Please select an account for the initial saved amount.");
                    return;
                }
                const initAcc = accounts.find(a => String(a.Account_ID) === String(formData.initial_account_id));
                if (initAcc && current > parseFloat(initAcc.Balance)) {
                    setFormError(`Initial amount (₹${current.toLocaleString()}) exceeds account balance (₹${parseFloat(initAcc.Balance).toLocaleString()}).`);
                    return;
                }
            }

            if (formData.emi_enabled) {
                const emiAmt = parseFloat(formData.emi_amount);
                if (!emiAmt || emiAmt <= 0) {
                    setFormError("Please enter a valid EMI amount.");
                    return;
                }
                if (!formData.account_id) {
                    setFormError("Please select an account for EMI deduction.");
                    return;
                }
                // Validate EMI against Account Balance
                const selectedAcc = accounts.find(a => String(a.Account_ID) === String(formData.account_id));
                if (selectedAcc && emiAmt > parseFloat(selectedAcc.Balance)) {
                    setFormError(`EMI amount (₹${emiAmt.toLocaleString()}) exceeds account balance (₹${parseFloat(selectedAcc.Balance).toLocaleString()}).`);
                    return;
                }
                // Validate EMI against remaining goal
                const remaining = target - current;
                if (emiAmt > remaining) {
                    setFormError(`EMI amount cannot exceed remaining goal amount (₹${remaining.toLocaleString()}).`);
                    return;
                }
            }

        try {
            const startDate = new Date(formData.start_date);
            const targetDate = new Date(startDate);
            targetDate.setMonth(targetDate.getMonth() + duration);

            const payload = {
                user_id: user.User_ID || user.id,
                goal_title: formData.goal_title,
                target_amount: target,
                current_amount: current,
                start_date: formData.start_date,
                target_date: targetDate.toISOString().slice(0, 10),
                status: 'Active',
                emi_enabled: formData.emi_enabled,
                emi_amount: formData.emi_enabled ? parseFloat(formData.emi_amount) : null,
                emi_date: formData.emi_enabled ? parseInt(formData.emi_date) : null,
                account_id: formData.emi_enabled ? parseInt(formData.account_id) : null,
                initial_account_id: (!editingGoalId && current > 0 && formData.initial_account_id) ? parseInt(formData.initial_account_id) : null
            };

            if (editingGoalId) {
                await api.put(`/savings/${editingGoalId}`, payload);
            } else {
                await api.post('/savings', payload);
            }

            setShowModal(false);
            resetForm();
            fetchGoals();
            fetchAccounts();
        } catch (error) {
            console.error("Error saving goal:", error);
            setFormError(error.response?.data?.error || "Failed to save goal.");
        }
    };

    const resetForm = () => {
        setFormData({
            goal_title: '',
            target_amount: '',
            current_amount: '0',
            start_date: new Date().toISOString().slice(0, 10),
            duration_months: '',
            emi_enabled: false,
            emi_amount: '',
            emi_date: '1',
            account_id: '',
            initial_account_id: ''
        });

        setEditingGoalId(null);
        setFormError('');
    };

    const handleContribute = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!selectedGoal || !contributionAmount || !selectedAccount) return;

        const amt = parseFloat(contributionAmount);
        if (amt <= 0) {
            setFormError("Contribution must be positive");
            return;
        }

        // Validate Account Balance
        const acc = accounts.find(a => String(a.Account_ID) === String(selectedAccount));
        if (acc && amt > parseFloat(acc.Balance)) {
            setFormError(`Insufficient funds! Amount ₹${amt.toLocaleString()} exceeds balance ₹${parseFloat(acc.Balance).toLocaleString()}`);
            return;
        }

        // Validate Remaining Goal Amount
        const remaining = parseFloat(selectedGoal.Target_Amount) - parseFloat(selectedGoal.Current_Amount);
        if (amt > remaining) {
            setFormError(`Contribution exceeds remaining goal amount (₹${remaining.toLocaleString()}).`);
            return;
        }

        try {
            await api.post(`/savings/${selectedGoal.Goal_ID}/contribute`, {
                amount: amt,
                account_id: selectedAccount
            });
            setShowContributeModal(false);
            setContributionAmount('');
            setSelectedGoal(null);
            fetchGoals();
            fetchAccounts();
        } catch (error) {
            console.error("Error contributing:", error);
            setFormError(error.response?.data?.error || "Failed to add contribution.");
        }
    };

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();

        if (!id) {
            toast.error("Error: Cannot delete goal (Invalid ID)");
            return;
        }

        if (!window.confirm("Delete this savings goal?")) return;

        try {
            await api.delete(`/savings/${id}`);
            setGoals(prev => prev.filter(g => g.Goal_ID !== id));
            toast.success("Goal deleted successfully");
        } catch (error) {
            console.error("Error deleting goal:", error);
            toast.error("Failed to delete goal. Please try again.");
            fetchGoals();
        }
    };

    // Helper metrics
    const getGoalMetrics = (goal) => {
        const target = parseFloat(goal.Target_Amount);
        const current = parseFloat(goal.Current_Amount);
        const remaining = Math.max(0, target - current);

        const today = new Date();
        const targetDate = new Date(goal.Target_Date);
        const diffTime = targetDate - today;
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
        const monthlyReq = diffMonths > 0 ? (remaining / diffMonths) : remaining;

        // Calculate next EMI date
        let nextEmiDate = null;
        if (goal.EMI_Enabled && goal.EMI_Date) {
            const now = new Date();
            nextEmiDate = new Date(now.getFullYear(), now.getMonth(), goal.EMI_Date);
            if (nextEmiDate <= now) {
                nextEmiDate = new Date(now.getFullYear(), now.getMonth() + 1, goal.EMI_Date);
            }
        }

        return {
            monthlyReq,
            remaining,
            daysRemaining: Math.ceil(diffTime / (1000 * 60 * 60 * 24)),
            progress: Math.min(100, (current / target) * 100),
            nextEmiDate
        };
    };

    // Generate date options 1-28
    const dateOptions = Array.from({ length: 28 }, (_, i) => i + 1);

    return (
        <div className="space-y-8 animate-fade-in relative min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white">Savings & Goals</h2>
                    <p className="text-slate-400 mt-1">Plan for your dreams, one step at a time.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); setFormError(''); }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add New Goal
                </button>
            </div>

            {/* Goals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <p className="text-slate-400">Loading goals...</p>
                ) : goals.length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
                        <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white">No active goals</h3>
                        <p className="text-slate-400 mt-2">Create your first savings goal to get started!</p>
                    </div>
                ) : (
                    goals.map(goal => {
                        const metrics = getGoalMetrics(goal);
                        const history = emiHistory[goal.Goal_ID] || [];
                        const isExpanded = expandedHistory === goal.Goal_ID;

                        return (
                            <div key={goal.Goal_ID} className="glass-panel p-6 flex flex-col justify-between group hover:border-indigo-500/50 transition-all">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${goal.Status === 'Achieved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                            {goal.Status === 'Achieved' ? <CheckCircle className="w-6 h-6" /> : <Target className="w-6 h-6" />}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            {goal.EMI_Enabled ? (
                                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 flex items-center gap-1">
                                                    <Zap className="w-3 h-3" /> Auto EMI
                                                </span>
                                            ) : null}
                                            <button
                                                onClick={() => handleEdit(goal)}
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                                title="Edit Goal"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center ${goal.Status === 'Achieved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                                                {goal.Status}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-1">{goal.Goal_Title}</h3>
                                    <p className="text-slate-400 text-sm mb-4 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Target: {goal.Target_Date ? new Date(goal.Target_Date).toLocaleDateString() : 'N/A'}
                                    </p>

                                    <div className="space-y-4">
                                        {/* Progress Bar */}
                                        <div>
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-slate-400">Progress</span>
                                                <span className="text-white font-medium">{metrics.progress.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${goal.Status === 'Achieved' ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                                                    style={{ width: `${metrics.progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Saved / Target / Remaining */}
                                        <div className="grid grid-cols-3 gap-3 py-4 border-y border-slate-700/50">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wider">Saved</p>
                                                <p className="text-base font-bold text-emerald-400">₹{parseFloat(goal.Current_Amount).toLocaleString()}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider">Remaining</p>
                                                <p className="text-base font-bold text-amber-400">₹{metrics.remaining.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider">Target</p>
                                                <p className="text-base font-bold text-white">₹{parseFloat(goal.Target_Amount).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* EMI Info or Monthly Requirement */}
                                        {goal.Status !== 'Achieved' && (
                                            goal.EMI_Enabled ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-amber-300 bg-amber-500/10 p-3 rounded-lg text-sm">
                                                        <Zap className="w-4 h-4 flex-shrink-0" />
                                                        <span>Auto EMI: <span className="font-bold">₹{parseFloat(goal.EMI_Amount).toLocaleString()}</span> on <span className="font-bold">{goal.EMI_Date}{getDateSuffix(goal.EMI_Date)}</span> of month</span>
                                                    </div>
                                                    {metrics.nextEmiDate && (
                                                        <div className="flex items-center gap-2 text-slate-400 text-xs pl-1">
                                                            <Clock className="w-3 h-3" />
                                                            Next EMI: {metrics.nextEmiDate.toLocaleDateString()}
                                                        </div>
                                                    )}
                                                    {goal.Account_Name && (
                                                        <div className="flex items-center gap-2 text-slate-400 text-xs pl-1">
                                                            <IndianRupee className="w-3 h-3" />
                                                            From: {goal.Account_Name} (₹{parseFloat(goal.Account_Balance || 0).toLocaleString()})
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-indigo-300 bg-indigo-500/10 p-3 rounded-lg text-sm">
                                                    <TrendingUp className="w-4 h-4 flex-shrink-0" />
                                                    Save <span className="font-bold">₹{Math.ceil(metrics.monthlyReq).toLocaleString()}</span> / month
                                                </div>
                                            )
                                        )}

                                        {/* EMI History Toggle */}
                                        {goal.EMI_Enabled && (
                                            <button
                                                onClick={() => toggleHistory(goal.Goal_ID)}
                                                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-300 transition-colors py-1"
                                            >
                                                <span>EMI History</span>
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        )}

                                        {/* EMI History List */}
                                        {isExpanded && (
                                            <div className="max-h-40 overflow-y-auto space-y-1.5 animate-fade-in">
                                                {history.length === 0 ? (
                                                    <p className="text-xs text-slate-500 text-center py-2">No EMI history yet</p>
                                                ) : (
                                                    history.map(h => (
                                                        <div key={h.History_ID} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${h.Status === 'Success' ? 'bg-emerald-500/5 text-emerald-400' : 'bg-rose-500/5 text-rose-400'}`}>
                                                            <div className="flex items-center gap-2">
                                                                {h.Status === 'Success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                                <span>₹{parseFloat(h.EMI_Amount).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span>{new Date(h.Deduction_Date).toLocaleDateString()}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${h.Status === 'Success' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                                                    {h.Status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700/30">
                                    {!goal.EMI_Enabled && (
                                        <button
                                            onClick={() => { setSelectedGoal(goal); setShowContributeModal(true); setFormError(''); }}
                                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
                                            disabled={goal.Status === 'Achieved'}
                                        >
                                            <Plus className="w-4 h-4" /> Manual Add
                                        </button>
                                    )}
                                    {goal.EMI_Enabled && (
                                        <button
                                            onClick={() => { setSelectedGoal(goal); setShowContributeModal(true); setFormError(''); }}
                                            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm"
                                            disabled={goal.Status === 'Achieved'}
                                        >
                                            + Extra Payment
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleDelete(goal.Goal_ID, e)}
                                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ============ Add/Edit Goal Modal ============ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-[#1e293b] w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-[#1e293b] z-10">
                            <h3 className="text-xl font-bold text-white">{editingGoalId ? 'Edit Goal' : 'Create New Goal'}</h3>
                            <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {formError && (
                            <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <form onSubmit={handleAddOrUpdateGoal} className="p-6 space-y-4 pt-4">
                            {/* Goal Title */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Goal Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                    placeholder="e.g. iPhone 17 Pro Max"
                                    value={formData.goal_title}
                                    onChange={e => setFormData({ ...formData, goal_title: e.target.value })}
                                />
                            </div>

                            {/* Target Amount + Current Saved */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Target Amount (₹)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        onKeyDown={(e) => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                        placeholder="150000"
                                        value={formData.target_amount}
                                        onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Current Saved (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        onKeyDown={(e) => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                        placeholder="0"
                                        value={formData.current_amount}
                                        onChange={e => setFormData({ ...formData, current_amount: e.target.value })}
                                        disabled={!!editingGoalId}
                                    />
                                </div>
                            </div>

                            {/* Initial Account Selection (Only for New Goals with Initial Balance) */}
                            {!editingGoalId && parseFloat(formData.current_amount) > 0 && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm text-slate-400 mb-1">Deduct Initial Saved From</label>
                                    <select
                                        required
                                        className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-4 py-3 text-white focus:border-emerald-500 outline-none"
                                        value={formData.initial_account_id}
                                        onChange={e => setFormData({ ...formData, initial_account_id: e.target.value })}
                                    >
                                        <option value="">Select Account</option>
                                        {accounts.map(acc => (
                                            <option key={acc.Account_ID} value={acc.Account_ID}>
                                                {acc.Account_Name} (₹{parseFloat(acc.Balance).toLocaleString()})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-emerald-400 mt-1 pl-1">This amount will be deducted from your account immediately.</p>
                                </div>
                            )}

                            {/* Start Date + Duration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Duration (Months)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        onKeyDown={(e) => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                        placeholder="e.g. 12"
                                        value={formData.duration_months}
                                        onChange={e => setFormData({ ...formData, duration_months: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Plan Summary */}
                            <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
                                <h4 className="text-indigo-400 font-semibold mb-2 flex items-center gap-2">
                                    <Calculator className="w-4 h-4" /> Plan Summary
                                </h4>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Monthly Contribution:</span>
                                    <span className="text-white font-bold">₹{Math.ceil(projection.monthly).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mt-1">
                                    <span className="text-slate-400">Completion Date:</span>
                                    <span className="text-white font-medium">{projection.endDate}</span>
                                </div>
                            </div>

                            {/* ====== EMI Toggle Section ====== */}
                            <div className="border border-slate-700 rounded-xl p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-white font-semibold flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-amber-400" /> Auto-Deduct EMI
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-0.5">Automatically deduct from your account monthly</p>
                                    </div>
                                    {/* Toggle Switch */}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, emi_enabled: !formData.emi_enabled })}
                                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${formData.emi_enabled ? 'bg-amber-500' : 'bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${formData.emi_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>

                                {/* EMI Fields (shown when toggle is ON) */}
                                {formData.emi_enabled && (
                                    <div className="space-y-3 animate-fade-in border-t border-slate-700/50 pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">EMI Amount (₹)</label>
                                                <input
                                                    type="number"
                                                    required={formData.emi_enabled}
                                                    min="1"
                                                    onKeyDown={(e) => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); }}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-amber-500 outline-none"
                                                    placeholder="2500"
                                                    value={formData.emi_amount}
                                                    onChange={e => setFormData({ ...formData, emi_amount: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-1">Deduction Day (1-28)</label>
                                                <select
                                                    required={formData.emi_enabled}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-amber-500 outline-none"
                                                    value={formData.emi_date}
                                                    onChange={e => setFormData({ ...formData, emi_date: e.target.value })}
                                                >
                                                    {dateOptions.map(d => (
                                                        <option key={d} value={d}>{d}{getDateSuffix(d)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-1">Deduct From Account</label>
                                            <select
                                                required={formData.emi_enabled}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-amber-500 outline-none"
                                                value={formData.account_id}
                                                onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                                            >
                                                <option value="">Select Account</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.Account_ID} value={acc.Account_ID}>
                                                        {acc.Account_Name} (₹{parseFloat(acc.Balance).toLocaleString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 mt-2">
                                {editingGoalId ? 'Update Goal' : 'Create Goal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ Contribution Modal ============ */}
            {showContributeModal && selectedGoal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-1">Add to {selectedGoal.Goal_Title}</h3>
                        <p className="text-slate-400 text-sm mb-2">
                            Remaining: <span className="text-amber-400 font-semibold">₹{(parseFloat(selectedGoal.Target_Amount) - parseFloat(selectedGoal.Current_Amount)).toLocaleString()}</span>
                        </p>
                        <p className="text-slate-500 text-xs mb-4">How much would you like to save today?</p>

                        {formError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        <form onSubmit={handleContribute} className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    required
                                    autoFocus
                                    min="0"
                                    onKeyDown={(e) => { if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault(); }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-xl font-bold text-white focus:border-emerald-500 outline-none"
                                    placeholder="500"
                                    value={contributionAmount}
                                    onChange={e => setContributionAmount(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">From Account</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500 outline-none"
                                    value={selectedAccount}
                                    onChange={e => setSelectedAccount(e.target.value)}
                                    required
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.Account_ID} value={acc.Account_ID}>
                                            {acc.Account_Name} (₹{parseFloat(acc.Balance).toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowContributeModal(false)}
                                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20"
                                    disabled={!selectedAccount || !contributionAmount}
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

// Helper: get ordinal suffix for date (1st, 2nd, 3rd, etc)
function getDateSuffix(day) {
    const d = parseInt(day);
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

export default Savings;
