import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, Activity, IndianRupee, AlertTriangle, ShieldAlert, CheckCircle, Search, Database, Trash2, ArrowRight, Loader2, Play, Filter, Layers, BarChart3 as BarChartIcon, ArrowDownUp, Zap, RefreshCw, Ban, Unlock, X, Eye, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie, Legend, ComposedChart, Area } from 'recharts';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

// ─── Color Constants ───
const RISK_COLORS = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981' };
const BAR_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#ec4899'];

const ACTIVITY_TX_BUCKET_ORDER = ['income', 'expense', 'emi', 'budget_related', 'savings_related', 'transfer', 'other'];

// ─── Stat Card Component ───
const StatCard = ({ title, amount, icon: Icon, color, subtitle }) => {
    const colorMap = {
        blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', shadow: 'shadow-blue-500/5', border: 'bg-blue-500/40', icon: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', shadow: 'shadow-emerald-500/5', border: 'bg-emerald-500/40', icon: 'text-emerald-500' },
        indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', shadow: 'shadow-indigo-500/5', border: 'bg-indigo-500/40', icon: 'text-indigo-500' },
        rose: { bg: 'bg-rose-500/20', text: 'text-rose-400', shadow: 'shadow-rose-500/5', border: 'bg-rose-500/40', icon: 'text-rose-500' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className="glass-panel p-6 relative overflow-hidden group hover:bg-slate-800/40 transition-all duration-300">
            <div className={`absolute -right-4 -top-4 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity ${c.icon} transform group-hover:scale-110 duration-500`}>
                <Icon className="w-32 h-32" />
            </div>
            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-2xl flex justify-center items-center ${c.bg} ${c.text} mb-4 shadow-lg ${c.shadow}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase opacity-70">{title}</p>
                <h3 className="text-3xl font-black text-white mt-1 tracking-tight">
                    {typeof amount === 'number' ? amount.toLocaleString() : amount}
                </h3>
                {subtitle && <p className="text-slate-500 text-[10px] mt-2 font-medium italic">{subtitle}</p>}
            </div>
            <div className={`absolute bottom-0 left-0 h-1 ${c.border} w-0 group-hover:w-full transition-all duration-500`} />
        </div>
    );
};

const ACTIVITY_SIDEBAR_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'all', label: 'All transactions' },
    { id: 'income', label: 'Income' },
    { id: 'expense', label: 'Expense' },
    { id: 'emi', label: 'EMI (txns)' },
    { id: 'budget_related', label: 'Budget-related' },
    { id: 'savings_related', label: 'Savings-related' },
    { id: 'transfer', label: 'Transfers' },
    { id: 'other', label: 'Other' },
];

/** Rows for a sidebar tab (flatten + sort for "all"). */
function getActivityTxnListForTab(data, tabId) {
    if (!data?.transactions || tabId === 'overview') return [];
    const tx = data.transactions;
    if (tabId === 'all') {
        return ACTIVITY_TX_BUCKET_ORDER.flatMap((k) => (Array.isArray(tx[k]) ? tx[k] : [])).sort(
            (a, b) => new Date(b.Transaction_DateTime || 0) - new Date(a.Transaction_DateTime || 0)
        );
    }
    return Array.isArray(tx[tabId]) ? tx[tabId] : [];
}

function activityTabCountBadge(data, tabId) {
    if (tabId === 'overview' || !data) return null;
    if (tabId === 'all') return data.transaction_counts?.total ?? getActivityTxnListForTab(data, 'all').length;
    return data.transaction_counts?.[tabId] ?? getActivityTxnListForTab(data, tabId).length;
}

const ADMIN_PATHS = ['/admin', '/admin/users', '/admin/transactions', '/admin/pipeline', '/admin/alerts'];

function pathToAdminTab(pathname) {
    const p = (pathname || '').replace(/\/$/, '') || '/admin';
    if (p === '/admin') return 'overview';
    if (p === '/admin/users') return 'users';
    if (p === '/admin/transactions') return 'transactions';
    if (p === '/admin/pipeline') return 'pipeline';
    if (p === '/admin/alerts') return 'alerts';
    return 'overview';
}

const ADMIN_SECTION_META = {
    overview: { heading: 'System overview', sub: 'Live counts from MySQL and MongoDB risk signals.' },
    users: { heading: 'User directory', sub: 'Every account — view full activity by category or block access.' },
    transactions: { heading: 'Global transactions', sub: 'All users’ rows from MySQL in one table.' },
    pipeline: { heading: 'Financial Risk Intelligence', sub: 'Multi-stage aggregation for spend-to-income analysis.' },
    alerts: { heading: 'System alerts', sub: 'High-risk notifications stored in MongoDB.' },
};

function resolveAdminUserId(u) {
    const v = u?.User_ID ?? u?.user_id ?? u?.User_Id;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Axios errors: distinguish stale API (HTML 404) from JSON "user not found". */
function messageForActivityLoadFailure(err) {
    const status = err.response?.status;
    const raw = err.response?.data;
    const html = typeof raw === 'string' ? raw : '';
    const jsonErr = raw && typeof raw === 'object' ? raw.error || raw.message : null;

    if (status === 404 && (html.includes('Cannot GET') || !jsonErr)) {
        return 'This API process does not expose user-activity routes yet. Stop every Node server on port 5000, then from the backend folder run: node server.js (or restart your IDE’s run config). After restart you should see a log line mentioning GET /api/admin/activity/:userId.';
    }
    if (jsonErr) return jsonErr;
    if (status === 404) return 'User not found in the database. Refresh the user directory and try again.';
    return err.message || 'Could not load user activity';
}

const AdminDashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState(() => pathToAdminTab(location.pathname));

    // Data states
    const [users, setUsers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [resolvedAlerts, setResolvedAlerts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Pipeline states
    const [pipelineResult, setPipelineResult] = useState(null);
    const [activeStage, setActiveStage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mongoSyncing, setMongoSyncing] = useState(false);
    const [mongoSyncMeta, setMongoSyncMeta] = useState({
        transaction_count: null,
        user_count: null,
        mysql_rows_read: null,
        skipped_rows: null
    });
    const [txnSummary, setTxnSummary] = useState({ total: 0, returned: 0 });

    const [activityTargetUser, setActivityTargetUser] = useState(null);
    const [activityData, setActivityData] = useState(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activityError, setActivityError] = useState(null);
    const [activityTab, setActivityTab] = useState('overview');
    const [alertCategory, setAlertCategory] = useState('reported'); // 'reported', 'sent', 'resolved', 'solved'

    const fetchStats = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/stats');
            if (data.success) setStats(data);
        } catch (error) { toast.error("Error fetching admin stats"); }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/users');
            if (data.success) setUsers(data.users);
        } catch (error) { toast.error("Error fetching users"); }
    }, []);

    const fetchTransactions = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/transactions', { params: { limit: 20000 } });
            if (data.success) {
                setTransactions(data.transactions || []);
                setTxnSummary({
                    total: data.total_in_database ?? data.transactions?.length ?? 0,
                    returned: data.returned ?? data.transactions?.length ?? 0
                });
            }
        } catch (error) { toast.error("Error fetching transactions"); }
    }, []);

    const fetchAlerts = useCallback(async () => {
        try {
            // First, trigger the full risk analysis pipeline to ensure alerts are up-to-date
            // with the latest MySQL data and the Income-to-Expense ratio logic.
            await api.get('/admin/pipeline/full');
            
            // Then fetch the resulting notifications
            const [{ data: notifsRes }, { data: resolvedRes }] = await Promise.all([
                api.get('/admin/notifications'),
                api.get('/admin/resolved-alerts')
            ]);
            if (notifsRes.success) setAlerts(notifsRes.notifications);
            if (resolvedRes.success) setResolvedAlerts(resolvedRes.alerts);
        } catch (error) { toast.error("Error updating system alerts"); }
    }, []);

    // Real-time polling for overview and alerts
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'overview') fetchStats();
            if (activeTab === 'alerts') fetchAlerts();
        }, 15000); // 15 seconds for a snappy feel

        return () => clearInterval(interval);
    }, [activeTab, fetchStats, fetchAlerts]);

    /** Sync URL (sidebar) ↔ active section; reject unknown /admin/... paths */
    useEffect(() => {
        const p = (location.pathname || '').replace(/\/$/, '') || '/admin';
        if (p.startsWith('/admin') && !ADMIN_PATHS.includes(p)) {
            navigate('/admin', { replace: true });
            return;
        }
        const tab = pathToAdminTab(location.pathname);
        setActiveTab(tab);
        if (tab === 'overview') fetchStats();
        if (tab === 'users') fetchUsers();
        if (tab === 'transactions') fetchTransactions();
        if (tab === 'alerts') fetchAlerts();
    }, [location.pathname, navigate, fetchStats, fetchUsers, fetchTransactions, fetchAlerts]);

    /** Full MySQL → Mongo copy so pipelines see every user and all historical transactions (not just last synced user/month). */
    const syncAllTransactionsToMongo = useCallback(async (showToast = true) => {
        setMongoSyncing(true);
        try {
            const { data } = await api.post('/admin/mongo/sync-transactions');
            if (data.success) {
                setMongoSyncMeta({
                    transaction_count: data.transaction_count,
                    user_count: data.user_count,
                    mysql_rows_read: data.mysql_rows_read ?? null,
                    skipped_rows: data.skipped_rows ?? null
                });
                if (showToast) {
                    let msg = `MySQL → Mongo: ${data.transaction_count} transactions, ${data.user_count} users`;
                    if (data.skipped_rows > 0) msg += ` — ${data.skipped_rows} row(s) skipped (invalid keys; see server log)`;
                    toast.success(msg);
                }
                return data;
            }
        } catch (error) {
            toast.error(error.response?.data?.error || error.message || 'Failed to sync transactions to MongoDB');
        } finally {
            setMongoSyncing(false);
        }
        return null;
    }, []);

    useEffect(() => {
        if (activeTab !== 'pipeline') return;
        syncAllTransactionsToMongo(true);
    }, [activeTab, syncAllTransactionsToMongo]);

    const handleDeleteUser = async (userId, name) => {
        if (!window.confirm(`Permanently delete "${name}" from MySQL and MongoDB?`)) return;
        try {
            const { data } = await api.delete(`/admin/users/${userId}`);
            if (data.success) {
                toast.success(`User "${name}" deleted.`);
                fetchUsers();
                fetchStats();
                if (activityTargetUser?.User_ID === userId) {
                    setActivityTargetUser(null);
                    setActivityData(null);
                }
            }
        } catch (e) { toast.error("Error deleting user."); }
    };

    const openUserActivity = async (u) => {
        const uid = resolveAdminUserId(u);
        if (uid == null) {
            toast.error('Invalid user id — refresh the directory and try again.');
            return;
        }
        setActivityTargetUser({ ...u, User_ID: uid });
        setActivityData(null);
        setActivityError(null);
        setActivityTab('overview');
        setActivityLoading(true);
        try {
            let data;
            try {
                ({ data } = await api.get(`admin/activity/${uid}`));
            } catch (firstErr) {
                if (firstErr.response?.status !== 404) throw firstErr;
                ({ data } = await api.get(`admin/users/${uid}/activity`));
            }
            if (data.success) {
                setActivityData(data);
            } else {
                const msg = data.error || 'Could not load activity';
                setActivityError(msg);
                toast.error(msg);
            }
        } catch (e) {
            const msg = messageForActivityLoadFailure(e);
            setActivityError(msg);
            toast.error(msg);
        } finally {
            setActivityLoading(false);
        }
    };

    const closeUserActivity = () => {
        setActivityTargetUser(null);
        setActivityData(null);
        setActivityError(null);
        setActivityTab('overview');
    };

    const handleBlockUser = async (userId, block) => {
        const id = Number(userId);
        if (!Number.isFinite(id) || id < 1) {
            toast.error('Invalid user id');
            return;
        }
        try {
            const path = block ? 'block' : 'unblock';
            const { data } = await api.post(`/admin/users/${id}/${path}`);
            if (data.success) {
                toast.success(data.message);
                await fetchUsers();
                if (activityTargetUser?.User_ID === id) {
                    setActivityTargetUser((prev) =>
                        prev ? { ...prev, Account_Status: block ? 'blocked' : 'active' } : prev
                    );
                    try {
                        let d2;
                        try {
                            ({ data: d2 } = await api.get(`admin/activity/${id}`));
                        } catch (e) {
                            if (e.response?.status !== 404) throw e;
                            ({ data: d2 } = await api.get(`admin/users/${id}/activity`));
                        }
                        if (d2?.success) setActivityData(d2);
                    } catch (_) {
                        /* activity routes may still be unavailable */
                    }
                }
            }
        } catch (e) {
            toast.error(e.response?.data?.error || e.response?.data?.message || 'Action failed');
        }
    };

    const handleSendAlert = async (userId) => {
        try {
            const { data } = await api.post('/admin/notifications/send', { 
                user_id: userId, 
                message: 'Admin Warning: We have detected suspicious high-risk transactions in your account. Please review your activity immediately.' 
            });
            if (data.success) {
                toast.success(`Warning message sent to User #${userId}.`);
                fetchAlerts();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || error.message || 'Failed to send alert');
        }
    };

    const handleSendResolvedMessage = async (userId) => {
        try {
            const { data } = await api.post('/admin/send-resolved-message', { user_id: userId });
            if (data.success) {
                toast.success(`Resolved message sent to User #${userId}.`);
                fetchAlerts();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || error.message || 'Failed to send resolved message');
        }
    };

    const handleResolveAlert = async (alertId) => {
        try {
            const { data } = await api.delete(`/admin/notifications/${alertId}`);
            if (data.success) {
                toast.success('Alert marked as resolved.');
                fetchAlerts(); // Refresh alerts
                fetchStats();  // Refresh global risk counts
            }
        } catch (error) {
            toast.error('Failed to resolve alert');
        }
    };

    const renderActivityTxnTable = (list) => {
        const rows = Array.isArray(list) ? list : [];
        return (
            <div className="rounded-lg border border-slate-600/60 bg-slate-950/40 flex flex-col min-h-[220px] max-h-[min(55vh,520px)] overflow-hidden">
                <div className="overflow-auto flex-1 min-h-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-800 text-slate-300 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 font-medium">ID</th>
                                <th className="p-3 font-medium">Date</th>
                                <th className="p-3 font-medium">Type</th>
                                <th className="p-3 font-medium">Ref</th>
                                <th className="p-3 font-medium">Account</th>
                                <th className="p-3 font-medium">Category</th>
                                <th className="p-3 font-medium">Description</th>
                                <th className="p-3 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-200">
                            {rows.map((t, i) => (
                                <tr
                                    key={t.Transaction_ID ?? t.transaction_id ?? i}
                                    className={`border-b border-slate-800/90 ${i % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900/25'}`}
                                >
                                    <td className="p-3 text-slate-400 font-mono text-xs align-top">#{t.Transaction_ID ?? t.transaction_id}</td>
                                    <td className="p-3 text-slate-400 whitespace-nowrap text-xs align-top">
                                        {(t.Transaction_DateTime || t.transaction_datetime)
                                            ? new Date(t.Transaction_DateTime || t.transaction_datetime).toLocaleString()
                                            : '—'}
                                    </td>
                                    <td className="p-3 align-top">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${(t.Transaction_Type || t.transaction_type) === 'Expense' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                            {t.Transaction_Type || t.transaction_type || '—'}
                                        </span>
                                    </td>
                                    <td className="p-3 text-slate-500 text-xs align-top">{t.Reference_Type || t.reference_type || '—'}</td>
                                    <td className="p-3 text-slate-300 max-w-[120px] truncate text-xs align-top" title={t.Account_Name || t.account_name}>{t.Account_Name || t.account_name || '—'}</td>
                                    <td className="p-3 text-slate-300 max-w-[100px] truncate text-xs align-top">{t.Category_Name || t.category_name || '—'}</td>
                                    <td className="p-3 text-slate-400 max-w-[200px] truncate text-xs align-top" title={t.Description || t.description}>{t.Description || t.description || '—'}</td>
                                    <td className="p-3 text-right font-semibold text-white whitespace-nowrap align-top">₹{Number(t.Amount ?? t.amount ?? 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rows.length === 0 && (
                    <p className="text-slate-500 text-center py-8 text-sm shrink-0 border-t border-slate-800/80">No transactions in this view.</p>
                )}
            </div>
        );
    };

    // ─── Pipeline Stage Runner → /api/admin/pipeline/* (MongoDB; avoids stale servers missing /api/match) ───
    const runStage = async (stage) => {
        setLoading(true);
        setActiveStage(stage === 'fullPipeline' ? 'full' : stage);
        setPipelineResult(null);
        try {
            const segment = stage === 'full' ? 'full' : stage;
            const { data } = await api.get(`/admin/pipeline/${segment}`);
            if (data.success) {
                setPipelineResult(data);
                if (stage === 'full' && data.alerts_generated > 0) {
                    toast.success(`${data.alerts_generated} HIGH risk notification(s) inserted for users.`);
                } else if (stage === 'full') {
                    toast.success(`Full pipeline completed — ${data.count} users in results`);
                } else {
                    toast.success(`$${segment} executed — ${data.count} results`);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.error || error.message || 'Pipeline request failed');
        }
        setLoading(false);
    };

    // ─── Pipeline Stage Config ───
    const stages = [
        { id: 'match', label: '$match', buttonLabel: 'Run $match (all documents)', icon: Filter, color: '#3b82f6', desc: '$match: {} — every user, every row', bgClass: 'from-blue-900/40 to-blue-800/30 border-blue-500/30' },
        { id: 'group', label: '$group', buttonLabel: 'Run $group (Agg Income/Exp)', icon: Layers, color: '#8b5cf6', desc: 'Separate sum(Income) vs sum(Expense)', bgClass: 'from-violet-900/40 to-violet-800/30 border-violet-500/30' },
        { id: 'project', label: '$project', buttonLabel: 'Run $project (Risk Score)', icon: BarChartIcon, color: '#f59e0b', desc: 'Calc Risk = (Exp/Inc * 100)', bgClass: 'from-amber-900/40 to-amber-800/30 border-amber-500/30' },
        { id: 'sort', label: '$sort', buttonLabel: 'Run $sort (Rank by Score)', icon: ArrowDownUp, color: '#10b981', desc: 'Sort by highest risk ratio', bgClass: 'from-emerald-900/40 to-emerald-800/30 border-emerald-500/30' },
    ];

    const section = ADMIN_SECTION_META[activeTab] || ADMIN_SECTION_META.overview;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-rose-500" />
                        Admin Control Center
                    </h2>
                    <p className="text-lg font-semibold text-indigo-200 mt-3">{section.heading}</p>
                    <p className="text-slate-400 mt-1 max-w-3xl">{section.sub}</p>
                    <p className="text-slate-500 text-sm mt-2">Use the <span className="text-slate-300">left sidebar</span> to switch sections — same layout as the user dashboard.</p>
                </div>
            </div>

            {/* ═══════════ GLOBAL LOADING ═══════════ */}
            {activeTab === 'overview' && !stats && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <p className="font-bold">Awakening Administration Nexus...</p>
                    <p className="text-xs opacity-50 mt-1">Fetching live system metrics from MySQL & MongoDB</p>
                </div>
            )}

            {/* ═══════════ OVERVIEW TAB ═══════════ */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6 animate-fade-in" key={stats.totalTransactions}>
                    {/* Top Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        <StatCard 
                            title="Total Users" 
                            amount={stats.totalUsers} 
                            icon={Users} 
                            color="blue" 
                            subtitle="Registered platform accounts"
                        />
                        <StatCard 
                            title="Transaction Volume" 
                            amount={stats.totalTransactions} 
                            icon={Activity} 
                            color="emerald" 
                            subtitle="Total system-wide count"
                        />
                        <StatCard 
                            title="Capital Volume" 
                            amount={`₹${Number(stats.totalRevenue).toLocaleString()}`} 
                            icon={IndianRupee} 
                            color="indigo" 
                            subtitle="Cumulative processed value"
                        />
                        <StatCard 
                            title="High Risk Users" 
                            amount={stats.highRiskCount} 
                            icon={AlertTriangle} 
                            color="rose" 
                            subtitle="Flagged by Risk Engine"
                        />
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Transaction Trend Composed Dual-Axis Chart */}
                        <div className="glass-panel p-6 border border-slate-700/50 shadow-xl min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                                    Volume vs Velocity (90 Days)
                                </h3>
                                <div className="flex gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[8px] font-bold border border-emerald-500/20">BARS: AMOUNT</span>
                                    <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-md text-[8px] font-bold border border-rose-500/20">LINES: COUNT</span>
                                </div>
                            </div>
                            <div className="h-72 w-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%" key={`trend-${stats.totalTransactions}`}>
                                    <ComposedChart data={stats.trends || []} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            stroke="#64748b" 
                                            fontSize={10} 
                                            tickMargin={10} 
                                            axisLine={false} 
                                            tickLine={false}
                                        />
                                        <YAxis 
                                            yAxisId="left"
                                            stroke="#64748b" 
                                            fontSize={10} 
                                            axisLine={false} 
                                            tickLine={false}
                                            tickFormatter={(val) => `₹${Number(val) >= 1000 ? (Number(val)/1000).toFixed(0) + 'k' : val}`} 
                                        />
                                        <YAxis 
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#64748b" 
                                            fontSize={10} 
                                            axisLine={false} 
                                            tickLine={false}
                                        />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                            itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '0px' }}
                                        />
                                        <Legend verticalAlign="top" iconType="circle" />
                                        
                                        {/* Volume (Bars) */}
                                        <Bar yAxisId="left" name="Income (₹)" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} opacity={0.3} />
                                        <Bar yAxisId="left" name="Expense (₹)" dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} opacity={0.3} />
                                        
                                        {/* Velocity (Lines) */}
                                        <Line yAxisId="right" name="Inc Count (#)" type="monotone" dataKey="incomeCount" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} />
                                        <Line yAxisId="right" name="Exp Count (#)" type="monotone" dataKey="expenseCount" stroke="#fb7185" strokeWidth={2} dot={{ r: 2 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Category Distribution Bar Chart */}
                        <div className="glass-panel p-6 border border-slate-700/50 shadow-xl min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <PieChartIcon className="w-5 h-5 text-emerald-400" />
                                    Operational Distribution
                                </h3>
                                <span className="text-[10px] text-slate-500 font-mono">By Transaction Count</span>
                            </div>
                            <div className="h-72 w-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%" key={`cat-${stats.totalTransactions}`}>
                                    <BarChart 
                                        data={stats.categories && stats.categories.length > 0 ? stats.categories : [{name: 'Syncing Categories...', value: 1}]} 
                                        layout="vertical"
                                        margin={{ top: 5, right: 40, left: 40, bottom: 5 }}
                                    >
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={130} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                            {(stats.categories || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Risk Distribution Pie Chart */}
                        <div className="glass-panel p-6 lg:col-span-1 border border-slate-700/50 shadow-xl">
                            <h3 className="text-xl font-bold text-white mb-6">Security Posture</h3>
                            <div className="h-64 flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.riskDistribution || [{name: 'Secure', value: 1, color: '#10b981'}]}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={8}
                                            dataKey="value"
                                            nameKey="name"
                                            stroke="none"
                                        >
                                            {(stats.riskDistribution || []).map((entry, index) => (
                                                <Cell key={`cell-risk-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        />
                                        <Legend verticalAlign="bottom" iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent System Alerts Feed */}
                        <div className="glass-panel p-6 lg:col-span-2 border border-slate-700/50 shadow-xl flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">System Signal Stream</h3>
                                <button onClick={() => navigate('/admin/alerts')} className="text-blue-400 text-xs font-bold hover:text-blue-300 transition-colors">Audit History</button>
                            </div>
                            <div className="space-y-4 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                                {(alerts || []).slice(0, 5).map((a, i) => (
                                    <div key={a._id} className="flex items-center gap-4 p-4 bg-slate-800/20 rounded-2xl border border-slate-700/30 hover:bg-slate-800/40 transition-colors">
                                        <div className={`p-2.5 rounded-xl ${a.type === 'AUTOMATED' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {a.type === 'AUTOMATED' ? <ShieldAlert className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-xs font-bold text-white truncate">Audit Signal #{a.user_id}</p>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/50 text-slate-400 font-mono">
                                                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 line-clamp-1 italic">{a.message}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-600" />
                                    </div>
                                ))}
                                {(!alerts || alerts.length === 0) && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl">
                                        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                            <CheckCircle className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm font-bold">System Status: Nominal</p>
                                        <p className="text-xs opacity-50">No critical anomalies detected</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════ PIPELINE ANALYZER TAB ═══════════ */}
            {activeTab === 'pipeline' && (
                <div className="space-y-6">
                    {/* Pipeline Flow Header */}
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 p-6 rounded-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Database className="w-6 h-6 text-emerald-400" />
                                <h3 className="text-2xl font-bold text-white">Financial Risk Intelligence Pipeline</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => syncAllTransactionsToMongo(true)}
                                disabled={mongoSyncing}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:bg-emerald-600/30 disabled:opacity-50"
                            >
                                {mongoSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Sync all users from MySQL
                            </button>
                        </div>
                        <p className="text-cyan-400/90 text-sm font-mono mb-2 tracking-wide">{`$match: {} → $group (Inc vs Exp) → $project (Risk Score) → $sort`}</p>
                        {mongoSyncMeta.transaction_count != null && (
                            <p className="text-slate-500 text-xs mb-3">
                                MongoDB mirror: <span className="text-slate-300">{mongoSyncMeta.transaction_count}</span> documents written ·{' '}
                                <span className="text-slate-300">{mongoSyncMeta.user_count}</span> distinct users in SQL ·{' '}
                                {mongoSyncMeta.mysql_rows_read != null && (
                                    <>MySQL rows read: <span className="text-slate-300">{mongoSyncMeta.mysql_rows_read}</span></>
                                )}
                            </p>
                        )}
                        <p className="text-slate-400 text-sm mb-5">Pipelines run on the <code className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">transactions</code> collection. Opening this tab refreshes it from MySQL so all users and history are included.</p>

                        {/* Visual Pipeline Flow */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {stages.map((s, i) => (
                                <React.Fragment key={s.id}>
                                    <div className={`px-4 py-2 rounded-lg border font-mono text-sm font-bold transition-all cursor-pointer ${activeStage === s.id ? 'scale-110 shadow-lg shadow-' + s.id : ''}`}
                                        style={{
                                            backgroundColor: activeStage === s.id ? s.color + '30' : '#0f172a',
                                            borderColor: activeStage === s.id ? s.color : '#334155',
                                            color: activeStage === s.id ? s.color : '#94a3b8'
                                        }}
                                        onClick={() => { if (!mongoSyncing && !loading) runStage(s.id); }}
                                    >
                                        {s.label}
                                    </div>
                                    {i < stages.length - 1 && <ArrowRight className="w-5 h-5 text-slate-600" />}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Stage Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                        {stages.map(s => (
                            <button
                                key={s.id}
                                onClick={() => runStage(s.id)}
                                disabled={loading || mongoSyncing}
                                className={`bg-gradient-to-br ${s.bgClass} border p-5 rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-lg group`}
                            >
                                <s.icon className="w-8 h-8 mb-3" style={{ color: s.color }} />
                                <h4 className="font-bold text-white text-sm leading-snug">{s.buttonLabel}</h4>
                                <p className="text-slate-400 text-xs mt-2">{s.desc}</p>
                                <div className="mt-3 flex items-center gap-2 text-xs font-mono" style={{ color: s.color }}>
                                    <Play className="w-3 h-3" /> Run stage
                                </div>
                            </button>
                        ))}
                        {/* Full Pipeline Button */}
                        <button
                            onClick={() => runStage('full')}
                            disabled={loading || mongoSyncing}
                            className="bg-gradient-to-br from-rose-900/40 to-pink-900/30 border border-rose-500/30 p-5 rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-rose-900/30"
                        >
                            <Zap className="w-8 h-8 mb-3 text-rose-400" />
                            <h4 className="font-bold text-white text-sm leading-snug">Run Full Pipeline</h4>
                            <p className="text-slate-400 text-xs mt-2">Inc vs Exp Analysis + Risk Scoring + Auto-Notify</p>
                            <div className="mt-3 flex items-center gap-2 text-xs font-mono text-rose-400">
                                <Play className="w-3 h-3" /> Execute all
                            </div>
                        </button>
                    </div>

                    {/* Loading Indicator */}
                    {(loading || mongoSyncing) && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                            <span className="text-slate-400 ml-3">
                                {mongoSyncing ? 'Syncing all transactions from MySQL to MongoDB…' : 'Executing pipeline stage...'}
                            </span>
                        </div>
                    )}

                    {/* Pipeline Result Display */}
                    {pipelineResult && !loading && !mongoSyncing && (
                        <div className="space-y-6">
                            {/* Stage Info Card */}
                            <div className="glass-panel p-6 border-l-4" style={{ borderLeftColor: stages.find(s => s.id === activeStage)?.color || '#ef4444' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xl font-bold text-white">
                                        Stage: <span style={{ color: stages.find(s => s.id === activeStage)?.color || '#ef4444' }}>{pipelineResult.stage}</span>
                                    </h3>
                                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-mono">
                                        {pipelineResult.count} results
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm mb-3">{pipelineResult.description}</p>
                                {pipelineResult.pipeline_chain && pipelineResult.pipeline_chain.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {pipelineResult.pipeline_chain.map((step, idx) => (
                                            <span key={idx} className="text-xs font-mono px-2 py-1 rounded-md bg-slate-800 text-cyan-300 border border-slate-600">
                                                {step}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {pipelineResult.projection_output_shape && (
                                    <div className="mb-3 p-3 rounded-lg bg-slate-900/80 border border-amber-500/20">
                                        <p className="text-amber-200/90 text-xs font-semibold mb-1">Final $project output (each user)</p>
                                        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                                            {JSON.stringify(pipelineResult.projection_output_shape, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs text-emerald-300 overflow-x-auto">
                                    <span className="text-slate-500">db.transactions.aggregate([ </span>
                                    {pipelineResult.query}
                                    <span className="text-slate-500"> ])</span>
                                </div>
                            </div>

                            {/* Chart for group/project/sort/full stages */}
                            {activeStage !== 'match' && pipelineResult.data.length > 0 && (
                                <div className="glass-panel p-6">
                                    <h3 className="text-lg font-bold text-white mb-4">
                                        {activeStage === 'sort' ? '📊 Spending Ranking Chart' :
                                         activeStage === 'project' ? '📊 Risk Classification Chart' :
                                         activeStage === 'full' ? '📊 Complete Risk Analysis Chart' :
                                         '📊 Aggregated Spending Chart'}
                                    </h3>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={pipelineResult.data.map((d) => {
                                                const id = d.user_id ?? d._id;
                                                const label = d.user_name ? `${d.user_name} (#${id})` : `User #${id}`;
                                                return { 
                                                    user: label, 
                                                    expense: d.total_spent, 
                                                    income: d.total_income,
                                                    score: d.risk_score,
                                                    risk: d.risk_level || 'N/A' 
                                                };
                                            })}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="user" stroke="#94a3b8" fontSize={12} />
                                                <YAxis stroke="#94a3b8" fontSize={12} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                                    formatter={(value, name) => [
                                                        name === 'score' ? `${value}%` : `₹${Number(value).toLocaleString()}`, 
                                                        name === 'expense' ? 'Total Expenses' : name === 'income' ? 'Total Income' : 'Risk Score'
                                                    ]}
                                                />
                                                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.6} />
                                                <Bar dataKey="expense" radius={[4, 4, 0, 0]}>
                                                    {pipelineResult.data.map((entry, index) => (
                                                        <Cell key={index} fill={entry.risk_level ? RISK_COLORS[entry.risk_level] : BAR_COLORS[index % BAR_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Results Table */}
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-bold text-white mb-4">
                                    {activeStage === 'match' ? '📋 Raw documents after $match: {} (all users)' :
                                     activeStage === 'group' ? '📋 After $match + $group (one row per user)' :
                                     activeStage === 'project' ? '📋 Final $project — reshaped fields + risk (all users)' :
                                     activeStage === 'sort' ? '📋 Full chain + $sort (projected shape, ranked)' :
                                     '📋 Full pipeline output (projected + sorted)'}
                                </h3>
                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                                            <tr>
                                                {activeStage === 'match' ? (
                                                    <>
                                                        <th className="p-3">Txn ID</th>
                                                        <th className="p-3">User ID</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3 text-right">Amount</th>
                                                        <th className="p-3">Type</th>
                                                        <th className="p-3">Date</th>
                                                    </>
                                                ) : activeStage === 'sort' ? (
                                                    <>
                                                        <th className="p-3">Rank</th>
                                                        <th className="p-3">User ID</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3 text-right text-emerald-400">Income</th>
                                                        <th className="p-3 text-right text-rose-400">Expense</th>
                                                        <th className="p-3 text-right">Score</th>
                                                        <th className="p-3">Level</th>
                                                    </>
                                                ) : activeStage === 'group' ? (
                                                    <>
                                                        <th className="p-3">User ID</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3 text-right text-emerald-400">Total Income</th>
                                                        <th className="p-3 text-right text-rose-400">Total Expense</th>
                                                        <th className="p-3 text-right"># Txns</th>
                                                    </>
                                                ) : activeStage === 'project' ? (
                                                    <>
                                                        <th className="p-3">User ID</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3 text-right">Income</th>
                                                        <th className="p-3 text-right">Expense</th>
                                                        <th className="p-3 text-right">Risk Score</th>
                                                        <th className="p-3">Level</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="p-3">#</th>
                                                        <th className="p-3">User ID</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3 text-right">Income</th>
                                                        <th className="p-3 text-right">Expense</th>
                                                        <th className="p-3 text-right">Risk %</th>
                                                        <th className="p-3">Risk</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pipelineResult.data.map((row, i) => (
                                                <tr key={activeStage === 'match' ? row.transaction_id ?? i : i} className={`border-b border-slate-700/50 transition-colors ${row.risk_level === 'HIGH' ? 'bg-rose-950/25 text-rose-50 hover:bg-rose-950/35' : 'hover:bg-slate-800/30'}`}>
                                                    {activeStage === 'match' ? (
                                                        <>
                                                            <td className="p-3 font-mono text-slate-400">#{row.transaction_id}</td>
                                                            <td className="p-3 text-white font-medium">#{row.user_id}</td>
                                                            <td className="p-3 text-slate-200 text-sm">{row.user_name || '—'}</td>
                                                            <td className="p-3 text-right text-white font-bold">₹{Number(row.amount).toLocaleString()}</td>
                                                            <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${row.type === 'Expense' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{row.type}</span></td>
                                                            <td className="p-3 text-slate-400 text-xs whitespace-nowrap">{row.date ? new Date(row.date).toLocaleString() : '—'}</td>
                                                        </>
                                                    ) : activeStage === 'sort' ? (
                                                        <>
                                                            <td className="p-3"><span className={`font-bold text-lg ${i === 0 ? 'text-yellow-400' : 'text-slate-500'}`}>#{i + 1}</span></td>
                                                            <td className="p-3 text-white font-medium">#{row.user_id ?? row._id}</td>
                                                            <td className="p-3 text-slate-200 text-sm">{row.user_name || '—'}</td>
                                                            <td className="p-3 text-right text-emerald-400 font-bold">₹{Number(row.total_income || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right text-rose-400 font-bold">₹{Number(row.total_spent || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right font-mono text-white">{row.risk_score}%</td>
                                                            <td className="p-3">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${row.risk_level === 'HIGH' ? 'bg-rose-600/30 text-rose-300' : row.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                                    {row.risk_level}
                                                                </span>
                                                            </td>
                                                        </>
                                                    ) : activeStage === 'group' ? (
                                                        <>
                                                            <td className="p-3 text-white font-medium">#{row._id}</td>
                                                            <td className="p-3 text-slate-200 text-sm">{row.user_name || '—'}</td>
                                                            <td className="p-3 text-right text-emerald-400 font-bold">₹{Number(row.total_income || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right text-rose-400 font-bold">₹{Number(row.total_spent || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right text-slate-300">{row.transaction_count ?? '—'}</td>
                                                        </>
                                                    ) : activeStage === 'project' ? (
                                                        <>
                                                            <td className="p-3 text-white font-medium">#{row.user_id}</td>
                                                            <td className="p-3 text-slate-200 text-sm">{row.user_name || '—'}</td>
                                                            <td className="p-3 text-right text-emerald-500">₹{Number(row.total_income || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right text-rose-500">₹{Number(row.total_spent || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right font-bold text-white">{row.risk_score}%</td>
                                                            <td className="p-3">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${row.risk_level === 'HIGH' ? 'bg-rose-600/30 text-rose-300' : row.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                                    {row.risk_level}
                                                                </span>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="p-3 text-slate-400 font-mono">{i + 1}</td>
                                                            <td className="p-3 text-white font-medium">#{row.user_id}</td>
                                                            <td className="p-3 text-slate-200 text-sm">{row.user_name || '—'}</td>
                                                            <td className="p-3 text-right text-emerald-400">₹{Number(row.total_income || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right text-rose-400">₹{Number(row.total_spent || 0).toLocaleString()}</td>
                                                            <td className="p-3 text-right font-bold text-white">{row.risk_score}%</td>
                                                            <td className="p-3">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${row.risk_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400 animate-pulse' : row.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                                    {row.risk_level}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Alert generation notice for full pipeline */}
                            {activeStage === 'full' && pipelineResult.alerts_generated > 0 && (
                                <div className="bg-rose-950/30 border border-rose-500/30 p-5 rounded-xl flex items-start gap-4">
                                    <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-rose-400 text-lg">🚨 {pipelineResult.alerts_generated} High Risk Alert(s) Generated</h4>
                                        <p className="text-rose-200/70 text-sm mt-1">Automatic notifications have been sent to flagged users. Open <span className="text-slate-200">System alerts</span> in the left sidebar for details.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ USERS TAB ═══════════ */}
            {activeTab === 'users' && (
                <div className="glass-panel p-6">
                    <div className="flex justify-between mb-4">
                        <h3 className="text-xl font-bold text-white">Registered Users</h3>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text" placeholder="Search users..."
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/50 text-slate-400">
                                <tr>
                                    <th className="p-4">ID</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">Role</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.filter(u => (u.Name || '').toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                                    <tr key={u.User_ID} className="border-b border-slate-700/50">
                                        <td className="p-4 text-slate-300">#{u.User_ID}</td>
                                        <td className="p-4 font-bold text-white">{u.Name}</td>
                                        <td className="p-4 text-slate-400">{u.Email}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs ${u.role === 'ADMIN' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role}</span></td>
                                        <td className="p-4">
                                            {u.Account_Status === 'blocked' ? (
                                                <span className="text-rose-400 flex items-center gap-1"><Ban className="w-4 h-4" /> Blocked</span>
                                            ) : (
                                                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Active</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right flex flex-wrap justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openUserActivity(u)}
                                                className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-colors"
                                                title="View categorized activity"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {u.role !== 'ADMIN' && (
                                                <>
                                                    {u.Account_Status === 'blocked' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleBlockUser(resolveAdminUserId(u), false)}
                                                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
                                                            title="Unblock user"
                                                        >
                                                            <Unlock className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm(`Block "${u.Name}"? They will not be able to sign in.`)) handleBlockUser(resolveAdminUserId(u), true);
                                                            }}
                                                            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors"
                                                            title="Block user"
                                                        >
                                                            <Ban className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════ TRANSACTIONS TAB ═══════════ */}
            {activeTab === 'transactions' && (
                <div className="glass-panel p-6">
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-white">Global transactions (MySQL)</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Showing <span className="text-white font-medium">{txnSummary.returned}</span> of{' '}
                                <span className="text-white font-medium">{txnSummary.total}</span> rows in the database — every user.
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800/50 text-slate-400 sticky top-0">
                                <tr>
                                    <th className="p-3">Txn ID</th>
                                    <th className="p-3">User ID</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Account</th>
                                    <th className="p-3">Category</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Ref</th>
                                    <th className="p-3 min-w-[120px]">Description</th>
                                    <th className="p-3 whitespace-nowrap">Date</th>
                                    <th className="p-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(t => (
                                    <tr key={t.Transaction_ID} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                        <td className="p-3 text-slate-400 font-mono">#{t.Transaction_ID}</td>
                                        <td className="p-3 text-white font-medium">#{t.User_ID}</td>
                                        <td className="p-3 text-white">{t.User_Name || '—'}</td>
                                        <td className="p-3 text-slate-400 text-xs max-w-[140px] truncate" title={t.User_Email}>{t.User_Email || '—'}</td>
                                        <td className="p-3 text-slate-300 text-xs max-w-[120px] truncate" title={t.Account_Name}>{t.Account_Name || `#${t.Account_ID ?? '—'}`}</td>
                                        <td className="p-3 text-slate-300 text-xs max-w-[100px] truncate">{t.Category_Name || '—'}</td>
                                        <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${t.Transaction_Type === "Expense" ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{t.Transaction_Type}</span></td>
                                        <td className="p-3 text-slate-500 text-xs">{t.Reference_Type || '—'}</td>
                                        <td className="p-3 text-slate-300 max-w-[180px] truncate" title={t.Description}>{t.Description || '—'}</td>
                                        <td className="p-3 text-slate-400 text-xs whitespace-nowrap">{t.Transaction_DateTime ? new Date(t.Transaction_DateTime).toLocaleString() : '—'}</td>
                                        <td className="p-3 text-right font-bold text-white">₹{Number(t.Amount).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {transactions.length === 0 && (
                        <p className="text-slate-500 text-center py-8">No transactions in MySQL yet.</p>
                    )}
                </div>
            )}

            {/* ═══════════ ALERTS TAB ═══════════ */}
            {activeTab === 'alerts' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Alert Category Navigation */}
                    <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50 w-full md:w-fit overflow-x-auto custom-scrollbar">
                        {[
                            { id: 'reported', label: 'Reported Alerts', icon: ShieldAlert, color: 'text-rose-500' },
                            { id: 'sent', label: 'Sent Warnings', icon: Activity, color: 'text-cyan-500' },
                            { id: 'resolved', label: 'Resolved Alerts', icon: CheckCircle, color: 'text-emerald-500' },
                            { id: 'solved', label: 'Solved Problems', icon: Database, color: 'text-indigo-400' }
                        ].map(cat => {
                            let count = 0;
                            if (cat.id === 'reported') count = alerts.filter(a => a.type === 'AUTOMATED' && a.alert_status !== 'RESOLVED' && a.alert_type !== 'RESOLVED' && !a.message.includes('✅') && !a.message.includes('Resolved')).length;
                            if (cat.id === 'sent') count = alerts.filter(a => a.type === 'MANUAL' && (a.alert_type !== 'RESOLVED' && !a.message.includes('✅') && !a.message.includes('Resolved'))).length;
                            if (cat.id === 'resolved') count = alerts.filter(a => ((a.alert_status === 'RESOLVED' || a.alert_type === 'RESOLVED' || a.message.includes('✅') || a.message.includes('Resolved')) && !a.message.includes('Admin:'))).length;
                            if (cat.id === 'solved') count = resolvedAlerts.length;

                            return (
                            <button
                                key={cat.id}
                                onClick={() => setAlertCategory(cat.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                                    alertCategory === cat.id 
                                    ? `bg-slate-700 text-white shadow-lg border border-slate-600` 
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <cat.icon className={`w-4 h-4 ${alertCategory === cat.id ? cat.color : 'text-slate-500'}`} />
                                {cat.label}
                                {count > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 text-[10px] text-white rounded-full ${
                                        cat.id === 'reported' ? 'bg-rose-500' : 
                                        cat.id === 'sent' ? 'bg-cyan-500' : 
                                        cat.id === 'resolved' ? 'bg-emerald-500' : 'bg-indigo-500'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                            );
                        })}
                    </div>

                    {/* Section 1: Reported Alerts (Active System Threats) */}
                    {alertCategory === 'reported' && (
                        <div className="glass-panel p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6">
                                <ShieldAlert className="w-6 h-6 text-rose-500" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">Active System Alerts</h3>
                                    <p className="text-slate-500 text-sm mt-1">Critical anomalies currently flagged by the Risk Intelligence Engine.</p>
                                </div>
                            </div>
                            {alerts.filter(a => a.type === 'AUTOMATED' && a.alert_status !== 'RESOLVED' && a.alert_type !== 'RESOLVED' && !a.message.includes('✅') && !a.message.includes('Resolved')).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800/50 rounded-3xl">
                                    <div className="p-4 bg-slate-800/40 rounded-full mb-4">
                                        <CheckCircle className="w-10 h-10 text-emerald-500/30" />
                                    </div>
                                    <p className="font-bold text-slate-400">No active system threats</p>
                                    <p className="text-xs opacity-50 mt-1 italic">Everything is nominal. Run a pipeline scan to verify.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {alerts.filter(a => a.type === 'AUTOMATED' && a.alert_status !== 'RESOLVED' && a.alert_type !== 'RESOLVED' && !a.message.includes('✅') && !a.message.includes('Resolved')).map(a => (
                                        <div key={a._id} className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl flex items-start gap-5 hover:bg-opacity-15 transition-all duration-300 group">
                                            <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-500 shrink-0">
                                                <ShieldAlert className="w-8 h-8" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-black text-white text-xl tracking-tight">{a.user_name || 'System User'} <span className="text-slate-500 font-normal ml-3">#{a.user_id}</span></h4>
                                                    <span className="text-slate-500 text-xs font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800">{new Date(a.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-3 mb-4">
                                                    <div className="text-xs px-3 py-1.5 rounded-xl border flex items-center gap-2 text-amber-300 bg-amber-900/30 border-amber-500/20">
                                                        <span className="font-bold uppercase tracking-widest opacity-60 text-[9px]">Type</span>
                                                        {a.alert_type || "ANOMALY"}
                                                    </div>
                                                    <div className="text-xs px-3 py-1.5 rounded-xl border flex items-center gap-2 text-rose-300 bg-rose-900/30 border-rose-500/20">
                                                        <span className="font-bold uppercase tracking-widest opacity-60 text-[9px]">Reason</span>
                                                        {a.details?.reason || "High risk variance detected in spending."}
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-xl border-l-4 font-medium italic text-sm bg-rose-500/5 text-rose-100 border-rose-500">
                                                    &quot;{a.message}&quot;
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-6">
                                                    <button onClick={() => handleResolveAlert(a._id)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-2 transition-all">
                                                        <CheckCircle className="w-4 h-4"/> Resolve Manually
                                                    </button>
                                                    <button onClick={() => openUserActivity({ User_ID: a.user_id, Name: 'User #' + a.user_id })} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-500/30 border border-blue-500/30 flex items-center gap-2 transition-all">
                                                        <Eye className="w-4 h-4"/> Audit Activity
                                                    </button>
                                                    <button onClick={() => handleSendAlert(a.user_id)} className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-xs font-bold hover:bg-amber-500/30 border border-amber-500/30 flex items-center gap-2 transition-all">
                                                        <AlertTriangle className="w-4 h-4"/> Dispatch Warning
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 2: Sent Alerts (Manual Warnings Only) */}
                    {alertCategory === 'sent' && (
                        <div className="glass-panel p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6">
                                <Activity className="w-6 h-6 text-cyan-500" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">Manual Warning Logs</h3>
                                    <p className="text-slate-500 text-sm mt-1">Warnings and messages sent by administrators to specific users.</p>
                                </div>
                            </div>
                            {alerts.filter(a => a.type === 'MANUAL' && (a.alert_type !== 'RESOLVED' && !a.message.includes('✅') && !a.message.includes('Resolved'))).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800/50 rounded-3xl">
                                    <div className="p-4 bg-slate-800/40 rounded-full mb-4">
                                        <Zap className="w-10 h-10 text-cyan-500/30" />
                                    </div>
                                    <p className="font-bold text-slate-400">No active warnings in logs</p>
                                    <p className="text-xs opacity-50 mt-1 italic">Use the User Directory to send a new alert to any account.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {alerts.filter(a => a.type === 'MANUAL' && (a.alert_type !== 'RESOLVED' && !a.message.includes('✅') && !a.message.includes('Resolved'))).map(a => (
                                        <div key={a._id} className="bg-cyan-500/10 border border-cyan-500/20 p-6 rounded-2xl flex items-start gap-5 hover:bg-opacity-15 transition-all duration-300 group">
                                            <div className="p-4 rounded-2xl bg-cyan-500/10 text-cyan-500 shrink-0">
                                                <Activity className="w-8 h-8" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="font-black text-white text-xl tracking-tight">{a.user_name || 'Individual'} <span className="text-slate-500 font-normal ml-3">#{a.user_id}</span></h4>
                                                    <span className="text-slate-500 text-xs font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800">{new Date(a.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="p-5 rounded-2xl border-l-4 font-semibold text-base italic leading-relaxed bg-cyan-500/5 text-cyan-200/90 border-cyan-500">
                                                    &quot;{a.message}&quot;
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-6">
                                                    <button onClick={() => handleResolveAlert(a._id)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/30 hover:bg-emerald-500/40 transition-all">
                                                        <CheckCircle className="w-4 h-4"/> Mark Resolved
                                                    </button>
                                                    <button onClick={() => openUserActivity({ User_ID: a.user_id, Name: 'User #' + a.user_id })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 border border-slate-600 flex items-center gap-2 transition-all">
                                                        <Eye className="w-4 h-4"/> Audit Profile
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 3: Resolved Alerts (System/User Mitigated) */}
                    {alertCategory === 'resolved' && (
                        <div className="glass-panel p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6">
                                <CheckCircle className="w-6 h-6 text-emerald-500" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">Pending Final Validation</h3>
                                    <p className="text-slate-500 text-sm mt-1">Risks mitigated by the system or user actions. Review and send a final resolution message.</p>
                                </div>
                            </div>
                            {alerts.filter(a => ((a.alert_status === 'RESOLVED' || a.alert_type === 'RESOLVED' || a.message.includes('✅') || a.message.includes('Resolved')) && !a.message.includes('Admin:'))).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800/50 rounded-3xl">
                                    <div className="p-4 bg-slate-800/40 rounded-full mb-4">
                                        <TrendingUp className="w-10 h-10 text-emerald-500/30" />
                                    </div>
                                    <p className="font-bold text-slate-400">No pending resolutions</p>
                                    <p className="text-xs opacity-50 mt-1 italic">When a risk is mitigated, it will appear here for your final confirmation.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {alerts.filter(a => ((a.alert_status === 'RESOLVED' || a.alert_type === 'RESOLVED' || a.message.includes('✅') || a.message.includes('Resolved')) && !a.message.includes('Admin:'))).map(a => (
                                        <div key={a._id} className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl flex items-start gap-5 hover:bg-opacity-15 transition-all duration-300">
                                            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 shrink-0">
                                                <TrendingUp className="w-8 h-8" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="font-black text-white text-xl tracking-tight">{a.user_name} <span className="text-slate-500 font-normal ml-3">#{a.user_id}</span></h4>
                                                    <span className="text-slate-500 text-xs font-mono bg-slate-900 px-3 py-1 rounded-full border border-slate-800">{new Date(a.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="p-5 rounded-2xl border-l-4 font-medium text-base leading-relaxed bg-emerald-500/5 text-emerald-200/90 border-emerald-500 italic">
                                                    &quot;{a.message}&quot;
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-6">
                                                    <button onClick={() => handleSendResolvedMessage(a.user_id)} className="px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/40">
                                                        <CheckCircle className="w-4 h-4"/> Dispatch Final Resolution Message
                                                    </button>
                                                    <button onClick={() => openUserActivity({ User_ID: a.user_id, Name: 'User #' + a.user_id })} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 border border-slate-600 flex items-center gap-2 transition-all">
                                                        <Eye className="w-4 h-4"/> Audit Mitigation
                                                    </button>
                                                    <button onClick={() => handleResolveAlert(a._id)} className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-500/25 border border-rose-500/20 flex items-center gap-2 transition-all">
                                                        <Trash2 className="w-4 h-4"/> Archive Notice
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 4: Solved Problems (Archive History) */}
                    {alertCategory === 'solved' && (
                        <div className="glass-panel p-6 animate-fade-in">
                            <div className="flex items-center gap-2 mb-6">
                                <Database className="w-6 h-6 text-indigo-400" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">Solved History (Archive)</h3>
                                    <p className="text-slate-500 text-sm mt-1">Audit trail of all resolved security issues and administration messages.</p>
                                </div>
                            </div>
                            {resolvedAlerts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500 border-2 border-dashed border-slate-800/50 rounded-3xl">
                                    <div className="p-4 bg-slate-800/40 rounded-full mb-4">
                                        <Database className="w-10 h-10 text-indigo-400/30" />
                                    </div>
                                    <p className="font-bold text-slate-400">Archive is currently empty</p>
                                    <p className="text-xs opacity-50 mt-1 italic">Historical resolution data will appear here.</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-2xl border border-slate-700/50">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-800/80 text-slate-400">
                                            <tr>
                                                <th className="p-4">User</th>
                                                <th className="p-4">Resolution Message</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4 text-right">Date Resolved</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-slate-900/30">
                                            {resolvedAlerts.map(a => (
                                                <tr key={a._id} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                                                    <td className="p-4 font-bold text-white whitespace-nowrap">{a.user_name || 'System'} <span className="text-slate-500 font-normal ml-1">#{a.user_id}</span></td>
                                                    <td className="p-4 text-slate-300 max-w-md truncate" title={a.message}>{a.message}</td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase">SUCCESS</span>
                                                    </td>
                                                    <td className="p-4 text-right text-slate-500 font-mono text-xs">{new Date(a.resolved_at || a.timestamp).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activityTargetUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-activity-title"
                    onClick={closeUserActivity}
                >
                    <div
                        className="bg-slate-900 border border-slate-600 rounded-2xl max-w-6xl w-full max-h-[92vh] min-h-[360px] overflow-hidden flex flex-col shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-700 bg-slate-900/95 shrink-0">
                            <div>
                                <h3 id="admin-activity-title" className="text-xl font-bold text-white">
                                    {activityTargetUser.Name}
                                    <span className="text-slate-500 font-normal text-base ml-2">#{activityTargetUser.User_ID}</span>
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">{activityTargetUser.Email}</p>
                                {activityData?.user?.phones?.length > 0 && (
                                    <p className="text-slate-500 text-xs mt-1">Phones: {activityData.user.phones.join(', ')}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {activityTargetUser.role !== 'ADMIN' && (
                                    (activityData?.user?.Account_Status ?? activityTargetUser.Account_Status) === 'blocked' ? (
                                        <button
                                            type="button"
                                            onClick={() => handleBlockUser(activityTargetUser.User_ID, false)}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm hover:bg-emerald-500/25"
                                        >
                                            <Unlock className="w-4 h-4" /> Unblock
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm(`Block this user? They cannot sign in until unblocked.`)) handleBlockUser(activityTargetUser.User_ID, true);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-sm hover:bg-amber-500/25"
                                        >
                                            <Ban className="w-4 h-4" /> Block
                                        </button>
                                    )
                                )}
                                <button
                                    type="button"
                                    onClick={closeUserActivity}
                                    className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
                            <aside className="w-full sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-800 bg-slate-950/80 overflow-y-auto max-h-[40vh] sm:max-h-none py-2 px-2 flex sm:flex-col flex-row flex-wrap sm:flex-nowrap gap-1">
                                {ACTIVITY_SIDEBAR_TABS.map((tab) => {
                                    const count = activityTabCountBadge(activityData, tab.id);
                                    const active = activityTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActivityTab(tab.id)}
                                            className={`sm:w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors flex sm:flex-row items-center justify-between gap-2 ${
                                                active
                                                    ? 'bg-slate-800 text-white border-l-2 border-cyan-500 shadow-sm'
                                                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 border-l-2 border-transparent'
                                            }`}
                                        >
                                            <span className="leading-snug">{tab.label}</span>
                                            {count !== null && count !== undefined && tab.id !== 'overview' && (
                                                <span className={`text-xs tabular-nums shrink-0 ${active ? 'text-cyan-400/90' : 'text-slate-500'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </aside>

                            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 md:p-5">
                            {activityLoading && (
                                <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin" /> Loading activity…
                                </div>
                            )}
                            {activityError && !activityLoading && (
                                <div className="rounded-xl border border-rose-500/40 bg-rose-950/35 p-4 text-rose-100 text-sm">
                                    <p className="font-semibold text-rose-300 mb-1">Could not load this user&apos;s activity</p>
                                    <p className="text-rose-200/90 whitespace-pre-wrap">{activityError}</p>
                                    <button
                                        type="button"
                                        onClick={() => openUserActivity(activityTargetUser)}
                                        className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-700 border border-slate-600"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                            {!activityLoading && !activityError && activityData && activityTab === 'overview' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            ['Total txns', activityData.transaction_counts?.total],
                                            ['Income', activityData.transaction_counts?.income],
                                            ['Expense', activityData.transaction_counts?.expense],
                                            ['EMI txns', activityData.transaction_counts?.emi],
                                        ].map(([label, n]) => (
                                            <div key={label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                                                <p className="text-slate-500 text-xs">{label}</p>
                                                <p className="text-2xl font-bold text-white">{n ?? 0}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {activityData.user?.Account_Status === 'blocked' && (
                                        <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 text-rose-200 text-sm">
                                            This account is <strong>blocked</strong>. Sign-in is denied with a message about suspicious payments and transactions.
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-white font-semibold mb-2">Accounts</h4>
                                        <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-800/80 text-slate-400">
                                                    <tr>
                                                        <th className="p-2">ID</th>
                                                        <th className="p-2">Name</th>
                                                        <th className="p-2">Type</th>
                                                        <th className="p-2 text-right">Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(activityData.accounts || []).map((a) => (
                                                        <tr key={a.Account_ID} className="border-b border-slate-800/80">
                                                            <td className="p-2 font-mono text-slate-500">#{a.Account_ID}</td>
                                                            <td className="p-2 text-white">{a.Account_Name}</td>
                                                            <td className="p-2 text-slate-400">{a.Account_Type}</td>
                                                            <td className="p-2 text-right text-white">₹{Number(a.Balance).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {(!activityData.accounts || activityData.accounts.length === 0) && (
                                                <p className="text-slate-500 text-center py-4 text-sm">No accounts.</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-white font-semibold mb-2">Budget (legacy)</h4>
                                            <ul className="text-sm text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                                                {(activityData.budgets || []).map((b) => (
                                                    <li key={b.Budget_ID} className="border-b border-slate-800 pb-1">
                                                        {b.Category_Name || 'Category'} — ₹{Number(b.Budget_Amount).toLocaleString()} ({b.Month_Year || '—'})
                                                    </li>
                                                ))}
                                            </ul>
                                            {(!activityData.budgets || activityData.budgets.length === 0) && (
                                                <p className="text-slate-500 text-sm">None</p>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-semibold mb-2">Budget funds (v2)</h4>
                                            <ul className="text-sm text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                                                {(activityData.budget_v2 || []).map((b) => (
                                                    <li key={b.Budget_ID} className="border-b border-slate-800 pb-1">
                                                        {b.Budget_Name} — remaining ₹{Number(b.Remaining_Budget_Amount).toLocaleString()} / ₹{Number(b.Total_Budget_Amount).toLocaleString()}{' '}
                                                        <span className="text-slate-500">({b.Status})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {(!activityData.budget_v2 || activityData.budget_v2.length === 0) && (
                                                <p className="text-slate-500 text-sm">None</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-white font-semibold mb-2">Savings goals</h4>
                                            <ul className="text-sm text-slate-300 space-y-1 max-h-36 overflow-y-auto">
                                                {(activityData.savings_goals || []).map((s) => (
                                                    <li key={s.Goal_ID} className="border-b border-slate-800 pb-1">
                                                        {s.Goal_Title} — ₹{Number(s.Current_Amount).toLocaleString()} / ₹{Number(s.Target_Amount).toLocaleString()}
                                                    </li>
                                                ))}
                                            </ul>
                                            {(!activityData.savings_goals || activityData.savings_goals.length === 0) && (
                                                <p className="text-slate-500 text-sm">None</p>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-semibold mb-2">EMI plans</h4>
                                            <ul className="text-sm text-slate-300 space-y-1 max-h-36 overflow-y-auto">
                                                {(activityData.emi_plans || []).map((e) => (
                                                    <li key={e.EMI_ID} className="border-b border-slate-800 pb-1">
                                                        {e.EMI_Title} — ₹{Number(e.EMI_Amount).toLocaleString()}/mo <span className="text-slate-500">({e.Status})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {(!activityData.emi_plans || activityData.emi_plans.length === 0) && (
                                                <p className="text-slate-500 text-sm">None</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!activityLoading && !activityError && activityData && activityTab !== 'overview' && (
                                <div className="min-h-0 flex flex-col">
                                    <p className="text-slate-400 text-sm mb-3">
                                        {activityTab === 'all' ? (
                                            <>All recorded transactions for this user, <span className="text-cyan-400">newest first</span>.</>
                                        ) : (
                                            <>
                                                Rows grouped as <span className="text-cyan-400">{activityTab.replace(/_/g, ' ')}</span> (by type / reference / description hints).
                                            </>
                                        )}
                                    </p>
                                    {renderActivityTxnTable(getActivityTxnListForTab(activityData, activityTab))}
                                </div>
                            )}
                            {!activityLoading && !activityError && !activityData && (
                                <p className="text-slate-500 text-sm py-8">No activity payload. Use Retry or close and open again.</p>
                            )}
                            {activityTargetUser && activityTargetUser.role !== 'ADMIN' && (
                                <div className="mt-10 pt-6 border-t border-rose-900/40">
                                    <p className="text-xs text-rose-300/80 font-semibold uppercase tracking-wide mb-2">Danger zone</p>
                                    <p className="text-slate-500 text-sm mb-3">
                                        Prefer <span className="text-slate-300">Block</span> to stop sign-in. Deletion removes the user and related data from MySQL/Mongo and cannot be undone.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const id = resolveAdminUserId(activityTargetUser);
                                            if (!id) return;
                                            if (window.confirm(`Permanently delete "${activityTargetUser.Name}"? This cannot be undone.`)) {
                                                handleDeleteUser(id, activityTargetUser.Name);
                                                closeUserActivity();
                                            }
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm border border-rose-500/30"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete user permanently
                                    </button>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



export default AdminDashboard;