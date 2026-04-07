import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
    Plus, Wallet, TrendingDown, X, ArrowUpCircle, Shuffle,
    History, Trash2, PieChart, AlertCircle, CheckCircle,
    ChevronRight, Clock, Ban, RefreshCw, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

// ==================== BUDGET TYPES ====================
const BUDGET_TYPES = [
    { emoji: '🏠', label: 'Household' },
    { emoji: '✈️', label: 'Trip' },
    { emoji: '💒', label: 'Wedding' },
    { emoji: '🛍️', label: 'Shopping' },
    { emoji: '📅', label: 'Monthly' },
    { emoji: '🚨', label: 'Emergency' },
    { emoji: '💼', label: 'Project' },
    { emoji: '🎉', label: 'Festival' },
    { emoji: '🎓', label: 'Education' },
    { emoji: '🏥', label: 'Medical' },
];

// ==================== EVENT NAME OPTIONS ====================
const EVENT_NAME_OPTIONS = [
    'Food', 'Travel', 'Hotel Stay', 'Transport', 'Shopping',
    'Groceries', 'Electricity Bill', 'Water Bill', 'Gas Bill', 'Rent',
    'Catering', 'Decoration', 'Photography', 'Videography', 'Venue',
    'Clothes', 'Gifts', 'Entertainment', 'Tuition Fee', 'Books',
    'Medicine', 'Doctor Visit', 'Insurance', 'Fuel', 'Maintenance',
    'Internet', 'Phone Bill', 'Subscription', 'Miscellaneous',
];

const BudgetManager = () => {
    const { user } = useAuth();
    const userId = user?.User_ID || user?.id;

    const [budgets, setBudgets] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState(null);
    const [activeTab, setActiveTab] = useState('events');
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Create form — includes inline events
    const [createForm, setCreateForm] = useState({
        name: '', amount: '', accountId: '',
        events: [{ name: '', amount: '' }]  // start with 1 event row
    });

    // Action forms
    const [spendForm, setSpendForm] = useState({ eventId: '', amount: '', description: '' });
    const [increaseForm, setIncreaseForm] = useState({ amount: '' });
    const [reallocateForm, setReallocateForm] = useState({ eventId: '', amount: '' });
    const [formError, setFormError] = useState('');
    const [addEventForm, setAddEventForm] = useState({ name: '', amount: '' });

    // ==================== DATA FETCHING ====================
    const fetchBudgets = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/budget-funds/${userId}`);
            setBudgets(res.data);
        } catch (err) {
            console.error('Error fetching budgets:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchAccounts = useCallback(async () => {
        try {
            const res = await api.get(`/accounts/${userId}`);
            setAccounts(res.data);
        } catch (err) {
            console.error('Error fetching accounts:', err);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) { fetchBudgets(); fetchAccounts(); }
    }, [userId, fetchBudgets, fetchAccounts]);

    const refreshSelected = async (budgetId) => {
        const res = await api.get(`/budget-funds/${userId}`);
        setBudgets(res.data);
        const updated = res.data.find(b => b.Budget_ID === budgetId);
        setSelectedBudget(updated || null);
        fetchAccounts();
    };

    const fetchHistory = async (budgetId) => {
        setHistoryLoading(true);
        try {
            const res = await api.get(`/budget-funds/history/${budgetId}`);
            setHistory(res.data);
        } catch (err) {
            console.error('Error fetching history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // ==================== CREATE FORM: EVENT ROWS ====================
    const addEventRow = () => {
        setCreateForm(prev => ({ ...prev, events: [...prev.events, { name: '', amount: '', isCustom: false }] }));
    };

    const removeEventRow = (idx) => {
        if (createForm.events.length <= 1) return;
        setCreateForm(prev => ({ ...prev, events: prev.events.filter((_, i) => i !== idx) }));
    };

    // Fixed: accepts an object of fields to update atomically (avoids stale state bug)
    const updateEventRow = (idx, fieldsObj) => {
        setCreateForm(prev => {
            const updated = [...prev.events];
            updated[idx] = { ...updated[idx], ...fieldsObj };
            return { ...prev, events: updated };
        });
    };

    const totalEventAllocation = createForm.events.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // ==================== HANDLERS ====================
    const handleCreate = async (e) => {
        e.preventDefault();
        const budgetAmount = parseFloat(createForm.amount);

        if (budgetAmount <= 0) { setFormError('Budget amount must be greater than 0'); setTimeout(() => setFormError(''), 5000); return; }

        // Validate against account balance
        const selectedAcc = accounts.find(a => String(a.Account_ID) === String(createForm.accountId));
        if (selectedAcc && budgetAmount > parseFloat(selectedAcc.Balance)) {
            setFormError(`Insufficient balance! Budget ₹${budgetAmount.toLocaleString()} exceeds account balance ₹${parseFloat(selectedAcc.Balance).toLocaleString()}`);
            setTimeout(() => setFormError(''), 5000);
            return;
        }

        // Validate events total doesn't exceed budget
        const validEvents = createForm.events.filter(ev => ev.name.trim() && parseFloat(ev.amount) > 0);
        const eventsTotal = validEvents.reduce((s, ev) => s + parseFloat(ev.amount), 0);

        if (eventsTotal > budgetAmount) {
            setFormError(`Total allocation (₹${eventsTotal.toLocaleString()}) exceeds budget (₹${budgetAmount.toLocaleString()})`);
            setTimeout(() => setFormError(''), 5000);
            return;
        }

        // Validate no individual event is negative
        for (const ev of validEvents) {
            if (parseFloat(ev.amount) <= 0) { setFormError(`Event "${ev.name}" amount must be positive.`); setTimeout(() => setFormError(''), 5000); return; }
        }

        try {
            // 1. Create the budget
            const res = await api.post('/budget-funds/create', {
                userId,
                budgetName: createForm.name,
                budgetAmount: createForm.amount,
                sourceAccountId: createForm.accountId
            });

            const newBudgetId = res.data.budgetId;

            // 2. Add events
            for (const ev of validEvents) {
                await api.post('/budget-funds/event', {
                    budgetId: newBudgetId,
                    eventName: ev.name,
                    allocatedAmount: ev.amount
                });
            }

            setShowCreateModal(false);
            setCreateForm({ name: '', amount: '', accountId: '', events: [{ name: '', amount: '' }] });
            setFormError('');
            fetchBudgets();
            fetchAccounts();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to create budget');
            setTimeout(() => setFormError(''), 5000);
        }
    };

    const handleSpend = async (e) => {
        e.preventDefault();
        const spendAmt = parseFloat(spendForm.amount);
        if (!spendAmt || spendAmt <= 0) { setFormError('Amount must be greater than 0'); setTimeout(() => setFormError(''), 5000); return; }

        const selectedEvt = selectedBudget.events?.find(ev => String(ev.Event_ID) === String(spendForm.eventId));
        const unallocated = parseFloat(selectedBudget.Unallocated_Amount || 0);
        
        if (selectedEvt && spendAmt > (parseFloat(selectedEvt.Remaining_Event_Amount) + unallocated)) {
            setFormError(`Insufficient balance! Event has ₹${parseFloat(selectedEvt.Remaining_Event_Amount).toLocaleString()} + ₹${unallocated.toLocaleString()} unallocated, but you entered ₹${spendAmt.toLocaleString()}.`);
            setTimeout(() => setFormError(''), 5000);
            return;
        }
        
        if (spendAmt > parseFloat(selectedBudget.Remaining_Budget_Amount)) {
            setFormError(`Insufficient balance! Amount ₹${spendAmt.toLocaleString()} exceeds total budget remaining ₹${parseFloat(selectedBudget.Remaining_Budget_Amount).toLocaleString()}`);
            setTimeout(() => setFormError(''), 5000);
            return;
        }

        try {
            await api.post('/budget-funds/spend', {
                budgetId: selectedBudget.Budget_ID,
                eventId: spendForm.eventId,
                amount: spendForm.amount,
                description: spendForm.description
            });
            setSpendForm({ eventId: '', amount: '', description: '' });
            setFormError('');
            refreshSelected(selectedBudget.Budget_ID);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to record expense');
            setTimeout(() => setFormError(''), 5000);
        }
    };

    const handleIncrease = async (e) => {
        e.preventDefault();
        const incAmt = parseFloat(increaseForm.amount);
        if (!incAmt || incAmt <= 0) { setFormError('Amount must be greater than 0'); setTimeout(() => setFormError(''), 5000); return; }
        const accBal = parseFloat(selectedBudget.Account_Balance);
        if (incAmt > accBal) {
            setFormError(`Insufficient balance! Amount ₹${incAmt.toLocaleString()} exceeds account balance ₹${accBal.toLocaleString()}`);
            setTimeout(() => setFormError(''), 5000);
            return;
        }
        try {
            await api.post('/budget-funds/increase', {
                budgetId: selectedBudget.Budget_ID,
                increaseAmount: increaseForm.amount
            });
            setIncreaseForm({ amount: '' });
            setFormError('');
            refreshSelected(selectedBudget.Budget_ID);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to increase budget');
            setTimeout(() => setFormError(''), 5000);
        }
    };

    const handleReallocate = async (e) => {
        e.preventDefault();
        const reAmt = parseFloat(reallocateForm.amount);
        if (!reAmt || reAmt <= 0) { setFormError('Amount must be greater than 0'); setTimeout(() => setFormError(''), 5000); return; }
        const unalloc = parseFloat(selectedBudget.Unallocated_Amount || 0);
        if (reAmt > unalloc) {
            setFormError(`Insufficient balance! Amount ₹${reAmt.toLocaleString()} exceeds unallocated ₹${unalloc.toLocaleString()}`);
            setTimeout(() => setFormError(''), 5000);
            return;
        }
        try {
            await api.post('/budget-funds/reallocate', {
                budgetId: selectedBudget.Budget_ID,
                eventId: reallocateForm.eventId,
                reallocateAmount: reallocateForm.amount
            });
            setReallocateForm({ eventId: '', amount: '' });
            refreshSelected(selectedBudget.Budget_ID);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to reallocate');
            setTimeout(() => setFormError(''), 5000);
        }
    };

    const handleReturnFunds = async (eventId, amount) => {
        if (!amount || amount <= 0) return;
        if (!window.confirm(`Return ₹${parseFloat(amount).toLocaleString()} from this category back to the general fund?`)) return;
        
        try {
            await api.post('/budget-funds/return-funds', {
                budgetId: selectedBudget.Budget_ID,
                eventId: eventId,
                returnAmount: amount
            });
            refreshSelected(selectedBudget.Budget_ID);
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to return funds');
            setTimeout(() => setFormError(''), 5000);
        }
    };

    const handleDeleteBudget = async () => {
        if (!selectedBudget) return;
        const remaining = parseFloat(selectedBudget.Remaining_Budget_Amount);
        const confirmMsg = remaining > 0
            ? `Delete "${selectedBudget.Budget_Name}"?\n\n• Remaining ₹${remaining.toLocaleString()} will be REFUNDED to your account.\n• Spent amount will NOT be returned.\n• Transaction history will be preserved.\n\nContinue?`
            : `Delete "${selectedBudget.Budget_Name}"?\n\n• No refund (entire budget was spent).\n• History will be preserved.\n\nContinue?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await api.post('/budget-funds/delete', { budgetId: selectedBudget.Budget_ID });
            toast.success(`✅ ${res.data.message}\nRefunded: ₹${parseFloat(res.data.refundedAmount).toLocaleString()}\nTotal Spent: ₹${parseFloat(res.data.totalSpent).toLocaleString()}`);
            setSelectedBudget(null);
            setActiveTab('events');
            fetchBudgets();
            fetchAccounts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete budget');
        }
    };

    const openBudgetDetail = (budget) => {
        setSelectedBudget(budget);
        setActiveTab('events');
        setFormError('');
        setSpendForm({ eventId: '', amount: '', description: '' });
        setIncreaseForm({ amount: '' });
        setReallocateForm({ eventId: '', amount: '' });
        setAddEventForm({ name: '', amount: '' });
    };

    // ==================== HELPERS ====================
    const getProgressColor = (pct) => {
        if (pct >= 80) return 'from-rose-500 to-red-500';
        if (pct >= 50) return 'from-amber-500 to-orange-500';
        return 'from-emerald-500 to-teal-500';
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Active': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
            case 'Completed': return { bg: 'bg-blue-500/10', text: 'text-blue-400' };
            case 'Deleted': return { bg: 'bg-rose-500/10', text: 'text-rose-400' };
            default: return { bg: 'bg-slate-500/10', text: 'text-slate-400' };
        }
    };

    const getTypeStyle = (type) => {
        const styles = {
            CREATE: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <Plus className="w-3.5 h-3.5" /> },
            ALLOCATE: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: <PieChart className="w-3.5 h-3.5" /> },
            SPEND: { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: <TrendingDown className="w-3.5 h-3.5" /> },
            INCREASE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
            REALLOCATE: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: <Shuffle className="w-3.5 h-3.5" /> },
            DELETE_REFUND: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <RefreshCw className="w-3.5 h-3.5" /> },
        };
        return styles[type] || { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: null };
    };

    const isDeleted = selectedBudget?.Status === 'Deleted';

    // ==================== RENDER ====================
    return (
        <div className="space-y-8 min-h-screen">
            {/* ===== HEADER ===== */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Budgets</h2>
                    <p className="text-slate-400 mt-1">Create & manage budgets for Trips, Weddings, Shopping, Monthly expenses, or anything custom.</p>
                </div>
                <button
                    onClick={() => { setShowCreateModal(true); setFormError(''); setCreateForm({ name: '', amount: '', accountId: '', events: [{ name: '', amount: '' }] }); }}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" /> New Budget
                </button>
            </div>

            {/* ===== BUDGET CARDS GRID ===== */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Loading budgets...</div>
            ) : budgets.length === 0 ? (
                <div className="text-center py-20 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700">
                    <Wallet className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white">No budgets yet</h3>
                    <p className="text-slate-400 mt-2 max-w-md mx-auto">
                        Create your first budget — Household, Trip, Wedding, Shopping, Monthly, or any custom type!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {budgets.map(budget => {
                        const total = parseFloat(budget.Total_Budget_Amount);
                        const remaining = parseFloat(budget.Remaining_Budget_Amount);
                        const initial = parseFloat(budget.Initial_Budget_Amount);
                        const spent = total - remaining;
                        const spentPct = total > 0 ? (spent / total) * 100 : 0;
                        const unalloc = parseFloat(budget.Unallocated_Amount || 0);
                        const statusStyle = getStatusStyle(budget.Status);
                        const isDel = budget.Status === 'Deleted';

                        return (
                            <div
                                key={budget.Budget_ID}
                                onClick={() => openBudgetDetail(budget)}
                                className={`relative p-6 rounded-2xl border cursor-pointer transition-all group
                                    ${isDel
                                        ? 'bg-slate-900/60 border-rose-900/30 opacity-70 hover:opacity-90'
                                        : 'bg-slate-800/40 border-slate-700/50 hover:border-purple-500/50 hover:bg-slate-800/60 hover:shadow-lg hover:shadow-purple-500/5'
                                    }`}
                            >
                                {/* Status Badge */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${statusStyle.bg} ${statusStyle.text}`}>
                                        {isDel ? <Ban className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                                        {budget.Status}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-0.5">{budget.Budget_Name}</h3>
                                <p className="text-slate-500 text-xs mb-4">from {budget.Account_Name}</p>

                                {/* Progress */}
                                {!isDel && (
                                    <div className="mb-4">
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="text-slate-400">Spent ₹{spent.toLocaleString()}</span>
                                            <span className="text-white font-medium">{spentPct.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(spentPct)} transition-all duration-700`}
                                                style={{ width: `${Math.min(spentPct, 100)}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-2.5 text-sm">
                                    <StatBlock label="Initial" value={`₹${initial.toLocaleString()}`} color="text-slate-300" />
                                    <StatBlock label="Total" value={`₹${total.toLocaleString()}`} color="text-white" />
                                    <StatBlock label="Remaining" value={`₹${remaining.toLocaleString()}`} color="text-emerald-400" />
                                    <StatBlock label="Unallocated" value={`₹${unalloc.toLocaleString()}`} color={unalloc > 0 ? 'text-amber-400' : 'text-slate-500'} />
                                </div>

                                {/* Mini event list */}
                                {budget.events && budget.events.length > 0 && !isDel && (
                                    <div className="mt-4 pt-3 border-t border-slate-700/30 space-y-1.5">
                                        {budget.events.slice(0, 4).map(evt => {
                                            const evtAlloc = parseFloat(evt.Allocated_Amount);
                                            const evtRem = parseFloat(evt.Remaining_Event_Amount);
                                            const evtPct = evtAlloc > 0 ? ((evtAlloc - evtRem) / evtAlloc) * 100 : 0;
                                            return (
                                                <div key={evt.Event_ID} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400 truncate max-w-[120px]">{evt.Event_Name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(evtPct)}`} style={{ width: `${evtPct}%` }} />
                                                        </div>
                                                        <span className="text-slate-500 w-16 text-right">₹{evtRem.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {budget.events.length > 4 && <p className="text-[10px] text-slate-600 text-center">+{budget.events.length - 4} more</p>}
                                    </div>
                                )}

                                {isDel && (
                                    <div className="mt-4 pt-3 border-t border-rose-900/20 text-center">
                                        <p className="text-xs text-rose-400/70">Deleted — History preserved</p>
                                    </div>
                                )}

                                <ChevronRight className="absolute top-1/2 right-3 -translate-y-1/2 w-5 h-5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ============================== */}
            {/* ===== CREATE BUDGET MODAL ===== */}
            {/* ============================== */}
            {showCreateModal && (
                <ModalOverlay onClose={() => setShowCreateModal(false)}>
                    <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        <ModalHeader title="Create New Budget" onClose={() => setShowCreateModal(false)} />
                        <div className="p-6 overflow-y-auto flex-1">
                            <form onSubmit={handleCreate} className="space-y-5">

                                {/* Quick-select chips */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Select Budget Type</label>
                                    <div className="flex flex-wrap gap-2">
                                        {BUDGET_TYPES.map(type => (
                                            <button key={type.label} type="button"
                                                onClick={() => setCreateForm({ ...createForm, name: type.label })}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${createForm.name === type.label
                                                    ? 'bg-purple-600 border-purple-500 text-white scale-105 shadow-lg shadow-purple-600/30'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500/50 hover:text-white'
                                                    }`}
                                            >
                                                {type.emoji} {type.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <InputField label="Budget Name (or type your own)" placeholder="e.g. Goa Trip, Monthly Groceries..."
                                    value={createForm.name} onChange={v => setCreateForm({ ...createForm, name: v })} required />

                                {(() => {
                                    const selAcc = accounts.find(a => String(a.Account_ID) === String(createForm.accountId));
                                    const maxBudget = selAcc ? parseFloat(selAcc.Balance) : undefined;
                                    return <InputField
                                        label={`Total Budget Amount (₹)${maxBudget !== undefined ? ` — max ₹${maxBudget.toLocaleString()}` : ''}`}
                                        type="number" placeholder="10000"
                                        value={createForm.amount}
                                        onChange={v => {
                                            const n = parseFloat(v);
                                            if (maxBudget !== undefined && n > maxBudget) {
                                                setCreateForm({ ...createForm, amount: String(maxBudget) });
                                            } else {
                                                setCreateForm({ ...createForm, amount: v });
                                            }
                                        }}
                                        required min="1" max={maxBudget} />;
                                })()}

                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Source Account</label>
                                    <select
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors"
                                        value={createForm.accountId}
                                        onChange={e => setCreateForm({ ...createForm, accountId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Account</option>
                                        {accounts.filter(a => parseFloat(a.Balance) > 0).map(acc => (
                                            <option key={acc.Account_ID} value={acc.Account_ID}>
                                                {acc.Account_Name} — ₹{parseFloat(acc.Balance).toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* ---- DYNAMIC EVENT ROWS ---- */}
                                <div className="pt-2">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm text-slate-400 font-medium">
                                            Add Events <span className="text-slate-600">(allocate from budget)</span>
                                        </label>
                                        <button type="button" onClick={addEventRow}
                                            className="flex items-center gap-1 px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-600/30 transition-colors">
                                            <Plus className="w-3 h-3" /> Add Event
                                        </button>
                                    </div>

                                    <div className="space-y-2.5">
                                        {createForm.events.map((ev, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className="text-xs text-slate-600 w-5 shrink-0">{idx + 1}.</span>
                                                <select
                                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                                                    value={ev.isCustom ? '__custom__' : (EVENT_NAME_OPTIONS.includes(ev.name) ? ev.name : '')}
                                                    onChange={e => {
                                                        if (e.target.value === '__custom__') {
                                                            updateEventRow(idx, { name: '', isCustom: true });
                                                        } else {
                                                            updateEventRow(idx, { name: e.target.value, isCustom: false });
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Select Event --</option>
                                                    {EVENT_NAME_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                    <option value="__custom__">✏️ Custom Name...</option>
                                                </select>
                                                {ev.isCustom && (
                                                    <input
                                                        type="text" placeholder="Enter custom event name"
                                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                                                        value={ev.name} onChange={e => updateEventRow(idx, { name: e.target.value })}
                                                        autoFocus
                                                    />
                                                )}
                                                <input
                                                    type="number" placeholder="Amount" min="1"
                                                    max={(() => {
                                                        const budgetAmt = parseFloat(createForm.amount) || 0;
                                                        const othersTotal = createForm.events.reduce((s, e, i) => i !== idx ? s + (parseFloat(e.amount) || 0) : s, 0);
                                                        return Math.max(0, budgetAmt - othersTotal);
                                                    })()}
                                                    className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-purple-500 outline-none"
                                                    value={ev.amount} onChange={e => {
                                                        const budgetAmt = parseFloat(createForm.amount) || 0;
                                                        const othersTotal = createForm.events.reduce((s, evt, i) => i !== idx ? s + (parseFloat(evt.amount) || 0) : s, 0);
                                                        const maxAllowed = Math.max(0, budgetAmt - othersTotal);
                                                        const val = parseFloat(e.target.value);
                                                        if (val > maxAllowed) {
                                                            updateEventRow(idx, { amount: String(maxAllowed) });
                                                            setFormError(`Event amount capped at ₹${maxAllowed.toLocaleString()} (insufficient budget)`);
                                                            setTimeout(() => setFormError(''), 3000);
                                                        } else {
                                                            updateEventRow(idx, { amount: e.target.value });
                                                            setFormError('');
                                                        }
                                                    }}
                                                />
                                                <button type="button" onClick={() => removeEventRow(idx)}
                                                    className={`p-2 rounded-lg transition-colors ${createForm.events.length <= 1 ? 'text-slate-700 cursor-not-allowed' : 'text-rose-400 hover:bg-rose-500/10'}`}
                                                    disabled={createForm.events.length <= 1}>
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Allocation summary */}
                                    {createForm.amount && (
                                        <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Total Budget:</span>
                                                <span className="text-white font-bold">₹{parseFloat(createForm.amount || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm mt-1">
                                                <span className="text-slate-400">Allocated to Events:</span>
                                                <span className={`font-bold ${totalEventAllocation > parseFloat(createForm.amount || 0) ? 'text-rose-400' : 'text-purple-400'}`}>
                                                    ₹{totalEventAllocation.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm mt-1 pt-1 border-t border-slate-700/40">
                                                <span className="text-slate-400">Unallocated:</span>
                                                <span className="text-amber-400 font-bold">
                                                    ₹{(parseFloat(createForm.amount || 0) - totalEventAllocation).toLocaleString()}
                                                </span>
                                            </div>
                                            {totalEventAllocation > parseFloat(createForm.amount || 0) && (
                                                <p className="text-rose-400 text-xs mt-2 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Event allocation exceeds budget!
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {formError && (
                                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                                    </div>
                                )}

                                <GradientButton label={`Create Budget${createForm.events.filter(e => e.name && e.amount).length > 0 ? ` with ${createForm.events.filter(e => e.name && e.amount).length} Event(s)` : ''}`}
                                    gradient="from-purple-600 to-pink-600"
                                    disabled={totalEventAllocation > parseFloat(createForm.amount || 0)} />
                            </form>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {/* ============================== */}
            {/* ===== BUDGET DETAIL MODAL ===== */}
            {/* ============================== */}
            {selectedBudget && (
                <ModalOverlay onClose={() => { setSelectedBudget(null); setActiveTab('events'); }}>
                    <div className="bg-[#0f172a] w-full max-w-5xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className={`p-6 border-b flex justify-between items-center ${isDeleted ? 'bg-rose-950/30 border-rose-900/30' : 'bg-[#1e293b] border-slate-700'}`}>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="text-2xl font-bold text-white">{selectedBudget.Budget_Name}</h3>
                                    {isDeleted && <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-full">DELETED</span>}
                                    {!isDeleted && <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${getStatusStyle(selectedBudget.Status).bg} ${getStatusStyle(selectedBudget.Status).text}`}>{selectedBudget.Status}</span>}
                                </div>
                                <p className="text-slate-400 text-sm mt-0.5">
                                    ₹{parseFloat(selectedBudget.Remaining_Budget_Amount).toLocaleString()} remaining of ₹{parseFloat(selectedBudget.Total_Budget_Amount).toLocaleString()}
                                    {(selectedBudget.Unallocated_Amount || 0) > 0 && !isDeleted && (
                                        <span className="text-amber-400 ml-2">• ₹{parseFloat(selectedBudget.Unallocated_Amount).toLocaleString()} unallocated</span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {!isDeleted && (
                                    <button onClick={handleDeleteBudget}
                                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                                        <Trash2 className="w-4 h-4" /> Delete & Refund
                                    </button>
                                )}
                                <button onClick={() => { setSelectedBudget(null); setActiveTab('events'); }} className="text-slate-400 hover:text-white p-1">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-5 gap-px bg-slate-700 border-b border-slate-700">
                            {[
                                { label: 'Initial', val: selectedBudget.Initial_Budget_Amount, color: 'text-slate-300' },
                                { label: 'Total Budget', val: selectedBudget.Total_Budget_Amount, color: 'text-white' },
                                { label: 'Remaining', val: selectedBudget.Remaining_Budget_Amount, color: 'text-emerald-400' },
                                { label: 'Spent', val: parseFloat(selectedBudget.Total_Budget_Amount) - parseFloat(selectedBudget.Remaining_Budget_Amount), color: 'text-rose-400' },
                                { label: 'Unallocated', val: selectedBudget.Unallocated_Amount || 0, color: 'text-amber-400' },
                            ].map((s, i) => (
                                <div key={i} className="bg-[#0f172a] p-3.5 text-center">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{s.label}</p>
                                    <p className={`text-sm font-bold ${s.color}`}>₹{parseFloat(s.val).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-700 bg-[#1e293b] overflow-x-auto">
                            {[
                                { id: 'events', icon: <PieChart className="w-4 h-4" />, label: 'Events' },
                                ...(!isDeleted ? [
                                    { id: 'spend', icon: <TrendingDown className="w-4 h-4" />, label: 'Spend Money' },
                                    { id: 'increase', icon: <ArrowUpCircle className="w-4 h-4" />, label: 'Increase Budget' },
                                    { id: 'reallocate', icon: <Shuffle className="w-4 h-4" />, label: 'Reallocate' },
                                ] : []),
                                { id: 'history', icon: <History className="w-4 h-4" />, label: 'History' },
                            ].map(tab => (
                                <button key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setFormError(''); if (tab.id === 'history') fetchHistory(selectedBudget.Budget_ID); }}
                                    className={`px-5 py-3 flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2
                                        ${activeTab === tab.id
                                            ? 'text-purple-400 border-purple-500 bg-purple-500/5'
                                            : 'text-slate-400 hover:text-white border-transparent'
                                        }`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Panel */}
                        <div className="flex-1 overflow-y-auto p-6">

                            {/* Inline error banner */}
                            {formError && (
                                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-sm animate-pulse">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                                </div>
                            )}
                            {/* ======== EVENTS TAB ======== */}
                            {activeTab === 'events' && (
                                <div className="space-y-6">
                                    {selectedBudget.events && selectedBudget.events.length > 0 ? (
                                        <div className="space-y-3">
                                            {selectedBudget.events.map(evt => {
                                                const alloc = parseFloat(evt.Allocated_Amount);
                                                const rem = parseFloat(evt.Remaining_Event_Amount);
                                                const spent = alloc - rem;
                                                const pct = alloc > 0 ? (spent / alloc) * 100 : 0;
                                                return (
                                                    <div key={evt.Event_ID} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/40">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-semibold text-white text-base">{evt.Event_Name}</span>
                                                            <div className="flex items-center gap-4 text-sm">
                                                                <span className="text-rose-400">Spent: ₹{spent.toLocaleString()}</span>
                                                                <span className="text-emerald-400">Remaining: ₹{rem.toLocaleString()}</span>
                                                                <span className="text-slate-500">of ₹{alloc.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full bg-gradient-to-r ${getProgressColor(pct)} transition-all`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        {!isDeleted && rem > 0 && (
                                                            <div className="mt-3 flex justify-end">
                                                                <button 
                                                                    onClick={() => handleReturnFunds(evt.Event_ID, rem)}
                                                                    className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg border border-amber-500/20 transition-all flex items-center gap-1.5"
                                                                >
                                                                    <ArrowUpCircle className="w-3 h-3" /> Return Leftover to General Fund
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-slate-500">
                                            <PieChart className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                            <p>No events added yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ======== SPEND TAB ======== */}
                            {activeTab === 'spend' && !isDeleted && (
                                <div className="max-w-xl mx-auto">
                                    <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/40">
                                        <h4 className="text-white font-semibold mb-1 flex items-center gap-2">
                                            <TrendingDown className="w-5 h-5 text-rose-400" /> Spend Money
                                        </h4>
                                        <p className="text-xs text-slate-500 mb-5">Select an event and enter the amount. It will automatically debit from the event and total budget.</p>

                                        {(!selectedBudget.events || selectedBudget.events.length === 0) ? (
                                            <p className="text-slate-500 text-center py-6">Add events first before spending.</p>
                                        ) : (
                                            <form onSubmit={handleSpend} className="space-y-4">
                                                {/* Event Selector */}
                                                <div>
                                                    <label className="block text-sm text-slate-400 mb-1">Select Event</label>
                                                    <select
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none"
                                                        value={spendForm.eventId}
                                                        onChange={e => setSpendForm({ ...spendForm, eventId: e.target.value })}
                                                        required
                                                    >
                                                        <option value="">-- Choose Event --</option>
                                                        {selectedBudget.events.filter(e => parseFloat(e.Remaining_Event_Amount) > 0).map(evt => (
                                                            <option key={evt.Event_ID} value={evt.Event_ID}>
                                                                {evt.Event_Name} — ₹{parseFloat(evt.Remaining_Event_Amount).toLocaleString()} remaining
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Show selected event's remaining */}
                                                {spendForm.eventId && (
                                                    <div className="bg-indigo-500/10 rounded-xl p-4 text-sm space-y-1.5">
                                                        {(() => {
                                                            const evt = selectedBudget.events.find(e => String(e.Event_ID) === String(spendForm.eventId));
                                                            if (!evt) return null;
                                                            const unalloc = parseFloat(selectedBudget.Unallocated_Amount || 0);
                                                            const maxSpendable = parseFloat(evt.Remaining_Event_Amount) + unalloc;
                                                            return (
                                                                <>
                                                                    <div className="flex justify-between px-1 mb-2">
                                                                        <span className="text-slate-400 text-xs">Event:</span>
                                                                        <span className="text-white font-medium text-xs">{evt.Event_Name}</span>
                                                                    </div>
                                                                    <div className="flex justify-between border-b border-slate-700/30 pb-2 mb-2">
                                                                        <span className="text-slate-400">Event Balance:</span>
                                                                        <span className="text-white font-medium">₹{parseFloat(evt.Remaining_Event_Amount).toLocaleString()}</span>
                                                                    </div>
                                                                    {unalloc > 0 && (
                                                                        <div className="flex justify-between text-amber-400 text-sm mb-2">
                                                                            <span>+ General Fund (Unallocated):</span>
                                                                            <span>₹{unalloc.toLocaleString()}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 font-bold">
                                                                        <span className="text-slate-300">Total Spendable:</span>
                                                                        <span className="text-emerald-400 text-lg">₹{maxSpendable.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between mt-4">
                                                                        <span className="text-slate-400">Event Remaining:</span>
                                                                        <span className="text-emerald-400 font-medium">₹{parseFloat(evt.Remaining_Event_Amount).toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-400">Budget Remaining:</span>
                                                                        <span className="text-emerald-400 font-medium">₹{parseFloat(selectedBudget.Remaining_Budget_Amount).toLocaleString()}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                {/* Amount */}
                                                {(() => {
                                                    const selEvt = selectedBudget.events?.find(e => String(e.Event_ID) === String(spendForm.eventId));
                                                    const maxAmt = selEvt ? Math.min(parseFloat(selEvt.Remaining_Event_Amount), parseFloat(selectedBudget.Remaining_Budget_Amount)) : parseFloat(selectedBudget.Remaining_Budget_Amount);
                                                    return <InputField label={`Enter Amount (₹) — max ₹${maxAmt.toLocaleString()}`} type="number" placeholder="Enter spend amount" value={spendForm.amount}
                                                        onChange={v => { const n = parseFloat(v); setSpendForm({ ...spendForm, amount: n > maxAmt ? String(maxAmt) : v }); }} required min="1" max={maxAmt} />;
                                                })()}

                                                {/* Description */}
                                                <InputField label="Description (optional)" placeholder="What did you spend on?"
                                                    value={spendForm.description} onChange={v => setSpendForm({ ...spendForm, description: v })} />

                                                <GradientButton label="Submit Expense" gradient="from-rose-600 to-red-600" />
                                            </form>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ======== INCREASE TAB ======== */}
                            {activeTab === 'increase' && !isDeleted && (
                                <div className="max-w-xl mx-auto">
                                    <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/40">
                                        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                            <ArrowUpCircle className="w-5 h-5 text-emerald-400" /> Increase Budget
                                        </h4>
                                        <p className="text-xs text-slate-500 mb-4">
                                            Adds funds from your account. Increased amount stays <span className="text-amber-400 font-medium">unallocated</span> — assign to events via Reallocate tab.
                                        </p>
                                        <div className="bg-indigo-500/10 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Source Account:</span>
                                                <span className="text-white font-medium">{selectedBudget.Account_Name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Account Balance:</span>
                                                <span className="text-emerald-400 font-medium">₹{parseFloat(selectedBudget.Account_Balance).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <form onSubmit={handleIncrease} className="space-y-4">
                                            {(() => {
                                                const accBal = parseFloat(selectedBudget.Account_Balance);
                                                return <InputField label={`Additional Amount (₹) — max ₹${accBal.toLocaleString()}`} type="number" placeholder="5000"
                                                    value={increaseForm.amount} onChange={v => { const n = parseFloat(v); setIncreaseForm({ ...increaseForm, amount: n > accBal ? String(accBal) : v }); }} required min="1" max={accBal} />;
                                            })()}
                                            <GradientButton label="Increase Budget" gradient="from-emerald-600 to-teal-600" />
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* ======== REALLOCATE TAB ======== */}
                            {activeTab === 'reallocate' && !isDeleted && (
                                <div className="max-w-xl mx-auto">
                                    <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/40">
                                        <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                            <Shuffle className="w-5 h-5 text-amber-400" /> Reallocate Funds
                                        </h4>
                                        <p className="text-xs text-slate-500 mb-4">Assign unallocated budget to events. Does NOT deduct from your account.</p>

                                        {(selectedBudget.Unallocated_Amount || 0) > 0 ? (
                                            <>
                                                <div className="bg-amber-500/10 rounded-xl p-4 mb-5 flex justify-between text-sm">
                                                    <span className="text-slate-400">Available to reallocate:</span>
                                                    <span className="text-amber-400 font-bold">₹{parseFloat(selectedBudget.Unallocated_Amount).toLocaleString()}</span>
                                                </div>
                                                {(!selectedBudget.events || selectedBudget.events.length === 0) ? (
                                                    <p className="text-slate-500 text-center py-6">Add events first.</p>
                                                ) : (
                                                    <form onSubmit={handleReallocate} className="space-y-4">
                                                        <div>
                                                            <label className="block text-sm text-slate-400 mb-1">Assign to Event</label>
                                                            <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none"
                                                                value={reallocateForm.eventId} onChange={e => setReallocateForm({ ...reallocateForm, eventId: e.target.value })} required>
                                                                <option value="">-- Choose Event --</option>
                                                                {selectedBudget.events.map(evt => (
                                                                    <option key={evt.Event_ID} value={evt.Event_ID}>
                                                                        {evt.Event_Name} — ₹{parseFloat(evt.Allocated_Amount).toLocaleString()} allocated
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {(() => {
                                                            const unalloc = parseFloat(selectedBudget.Unallocated_Amount || 0);
                                                            return <InputField label={`Amount (₹) — max ₹${unalloc.toLocaleString()}`} type="number" placeholder="2000"
                                                                value={reallocateForm.amount} onChange={v => { const n = parseFloat(v); setReallocateForm({ ...reallocateForm, amount: n > unalloc ? String(unalloc) : v }); }} required min="1" max={unalloc} />;
                                                        })()}
                                                        <GradientButton label="Reallocate" gradient="from-amber-600 to-orange-600" />
                                                    </form>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center py-10 text-slate-500">
                                                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                                <p>No unallocated funds available.</p>
                                                <p className="text-xs mt-1">Use "Increase Budget" to add more funds.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ======== HISTORY TAB ======== */}
                            {activeTab === 'history' && (
                                <div>
                                    <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <History className="w-5 h-5 text-slate-400" /> Transaction History
                                    </h4>
                                    {historyLoading ? (
                                        <p className="text-slate-400 text-center py-8">Loading...</p>
                                    ) : history.length === 0 ? (
                                        <p className="text-slate-500 text-center py-12">No transactions yet.</p>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {history.map(tx => {
                                                const style = getTypeStyle(tx.Transaction_Type);
                                                return (
                                                    <div key={tx.Transaction_ID} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/30 flex items-start justify-between gap-4">
                                                        <div className="flex items-start gap-3 min-w-0">
                                                            <div className={`p-2 rounded-lg ${style.bg} ${style.text} mt-0.5`}>{style.icon}</div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.bg} ${style.text}`}>{tx.Transaction_Type}</span>
                                                                    {tx.Event_Name && <span className="text-xs text-slate-500">• {tx.Event_Name}</span>}
                                                                </div>
                                                                <p className="text-slate-400 text-xs mt-1 break-words">{tx.Description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className={`font-bold text-sm ${tx.Transaction_Type === 'SPEND' ? 'text-rose-400' :
                                                                tx.Transaction_Type === 'INCREASE' ? 'text-emerald-400' :
                                                                    tx.Transaction_Type === 'DELETE_REFUND' ? 'text-red-400' : 'text-white'
                                                                }`}>
                                                                {tx.Transaction_Type === 'SPEND' ? '−' : tx.Transaction_Type === 'INCREASE' ? '+' : tx.Transaction_Type === 'DELETE_REFUND' ? '↩' : ''}₹{parseFloat(tx.Amount).toLocaleString()}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                                Budget: ₹{parseFloat(tx.Previous_Budget_Balance).toLocaleString()} → ₹{parseFloat(tx.New_Budget_Balance).toLocaleString()}
                                                            </p>
                                                            {tx.Previous_Event_Balance != null && (
                                                                <p className="text-[10px] text-slate-500">
                                                                    Event: ₹{parseFloat(tx.Previous_Event_Balance).toLocaleString()} → ₹{parseFloat(tx.New_Event_Balance).toLocaleString()}
                                                                </p>
                                                            )}
                                                            <p className="text-[10px] text-slate-600 mt-0.5 flex items-center justify-end gap-1">
                                                                <Clock className="w-2.5 h-2.5" />
                                                                {new Date(tx.Created_At).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </ModalOverlay>
            )}
        </div>
    );
};

// ==================== SUB-COMPONENTS ====================
const ModalOverlay = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
);

const ModalHeader = ({ title, onClose }) => (
    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-[#1e293b]">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
    </div>
);

const InputField = ({ label, type = 'text', placeholder, value, onChange, required, min, max }) => (
    <div>
        <label className="block text-sm text-slate-400 mb-1">{label}</label>
        <input type={type} placeholder={placeholder} value={value}
            onChange={e => onChange(e.target.value)} required={required} min={min} max={max}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" />
    </div>
);

const GradientButton = ({ label, gradient = 'from-indigo-600 to-purple-600', disabled }) => (
    <button type="submit" disabled={disabled}
        className={`w-full py-3 bg-gradient-to-r ${gradient} text-white rounded-xl font-bold transition-all shadow-lg mt-1 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}>
        {label}
    </button>
);

const StatBlock = ({ label, value, color }) => (
    <div className="bg-slate-800/50 rounded-lg p-2.5">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`font-bold ${color}`}>{value}</p>
    </div>
);

export default BudgetManager;
