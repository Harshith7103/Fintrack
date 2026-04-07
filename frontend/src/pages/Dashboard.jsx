import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, IndianRupee, Loader, AlertTriangle, Download, X, FileDown, Database, ShieldAlert, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { getDashboard, api } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, getGreeting } from '../utils/helpers';
import FraudAlerts from '../components/FraudAlerts';

const DashboardAlert = ({ alert, onResolve }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
        }, 30000); // 30 seconds
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    const isResolved = alert.alert_type === 'RESOLVED' || alert.message.includes('Resolved') || alert.message.includes('✅') || alert.message.includes('Mitigated');
    return (
        <div className={`${isResolved ? 'bg-emerald-500/10 border-emerald-500' : 'bg-rose-500/10 border-rose-500'} border-l-4 p-4 rounded-r-xl flex items-center justify-between shadow-lg group`}>
            <div className={`flex items-center gap-3 ${isResolved ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isResolved ? <TrendingUp className="w-6 h-6 shrink-0" /> : <ShieldAlert className="w-6 h-6 shrink-0" />}
                <div>
                    <p className="font-bold text-white">{isResolved ? 'Resolved Alert' : (alert.alert_type === 'FRAUD' || alert.message.toLowerCase().includes('fraud')) ? 'CRITICAL FRAUD ALERT' : 'System Alert'}</p>
                    <p className="text-sm">{alert.message}</p>
                </div>
            </div>
            <div className="flex flex-col items-end gap-2">
                <span className={`text-xs ${isResolved ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>{new Date(alert.timestamp).toLocaleDateString()}</span>
                <button 
                    onClick={() => onResolve(alert._id)}
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border opacity-0 group-hover:opacity-100 transition-opacity ${isResolved ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/40' : 'text-rose-400 bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/40'}`}
                >
                    Dismiss Forever
                </button>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [mongoStats, setMongoStats] = useState([]);
    const [riskData, setRiskData] = useState({ risk_level: 'LOW', total_spent: 0 });
    const [userAlerts, setUserAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    // ── Download Report State ──────────────────────────────
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadForm, setDownloadForm] = useState({
        month: String(new Date().getMonth() + 1).padStart(2, '0'),
        year:  String(new Date().getFullYear())
    });

    // ── Security Modal State ──────────────────────────────
    const [showSecureModal, setShowSecureModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securing, setSecuring] = useState(false);

    const months = [
        { value: '01', label: 'January'   }, { value: '02', label: 'February'  },
        { value: '03', label: 'March'      }, { value: '04', label: 'April'     },
        { value: '05', label: 'May'        }, { value: '06', label: 'June'      },
        { value: '07', label: 'July'       }, { value: '08', label: 'August'    },
        { value: '09', label: 'September'  }, { value: '10', label: 'October'   },
        { value: '11', label: 'November'   }, { value: '12', label: 'December'  },
    ];

    const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const userId = user.User_ID || user.id;
            const monthYear = `${downloadForm.year}-${downloadForm.month}`;

            // 1. Trigger sync + report generation
            const genRes = await api.post('/mongo/reports/generate', { user_id: userId, month_year: monthYear });

            // The generate endpoint returns { success, data: reportDoc }
            const report = genRes.data?.data || genRes.data;

            if (!report || !report.summary) {
                toast.error('No report data found for the selected month. Please add some transactions first.');
                setDownloading(false);
                return;
            }

            // 3. Build downloadable HTML report
            const monthLabel = months.find(m => m.value === downloadForm.month)?.label;
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>FinTrack Report – ${monthLabel} ${downloadForm.year}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 32px; }
  h1   { color: #7c3aed; font-size: 28px; border-bottom: 3px solid #7c3aed; padding-bottom: 12px; margin-bottom: 8px; }
  h2   { color: #374151; font-size: 18px; margin-top: 28px; border-left: 4px solid #7c3aed; padding-left: 10px; }
  .meta   { color: #64748b; font-size: 14px; margin-bottom: 28px; }
  .cards  { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .card   { background: white; border-radius: 12px; padding: 20px 28px; box-shadow: 0 2px 10px rgba(0,0,0,.08); min-width: 160px; flex: 1; }
  .card .label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
  .card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
  .inc  { color: #059669; } .exp { color: #e11d48; } .bal { color: #7c3aed; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.07); margin-top: 12px; }
  th    { background: #7c3aed; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
  td    { padding: 9px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #f8f9fc; }
  footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<h1>📊 FinTrack Monthly Report</h1>
<p class="meta">User: <strong>${user?.Name || user?.name}</strong> &nbsp;|&nbsp; Period: <strong>${monthLabel} ${downloadForm.year}</strong> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>

<div class="cards">
  <div class="card"><div class="label">Total Income</div><div class="value inc">₹${(report.summary?.total_income || 0).toLocaleString('en-IN')}</div></div>
  <div class="card"><div class="label">Total Expense</div><div class="value exp">₹${(report.summary?.total_expense || 0).toLocaleString('en-IN')}</div></div>
  <div class="card"><div class="label">Net Savings</div><div class="value bal">₹${(report.summary?.net_savings || 0).toLocaleString('en-IN')}</div></div>
  <div class="card"><div class="label">Closing Balance</div><div class="value bal">₹${(report.summary?.closing_balance || 0).toLocaleString('en-IN')}</div></div>
</div>

<h2>💸 Expense Transactions (${report.transactions?.expenses?.length || 0})</h2>
<table>
  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount (₹)</th></tr></thead>
  <tbody>
    ${(report.transactions?.expenses || []).map(t => `<tr><td>${new Date(t.date).toLocaleDateString('en-IN')}</td><td>${t.category||'—'}</td><td>${t.description||'—'}</td><td style="text-align:right;color:#e11d48;font-weight:600">-${parseFloat(t.amount||0).toLocaleString('en-IN')}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No expense transactions</td></tr>'}
  </tbody>
</table>

<h2>💰 Income Transactions (${report.transactions?.income?.length || 0})</h2>
<table>
  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount (₹)</th></tr></thead>
  <tbody>
    ${(report.transactions?.income || []).map(t => `<tr><td>${new Date(t.date).toLocaleDateString('en-IN')}</td><td>${t.category||'—'}</td><td>${t.description||'—'}</td><td style="text-align:right;color:#059669;font-weight:600">+${parseFloat(t.amount||0).toLocaleString('en-IN')}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No income transactions</td></tr>'}
  </tbody>
</table>

<h2>🎯 Budget Status</h2>
<table>
  <thead><tr><th>Category</th><th style="text-align:right">Allocated (₹)</th><th style="text-align:right">Spent (₹)</th><th>Status</th></tr></thead>
  <tbody>
    ${(report.budgets || []).map(b => `<tr><td>${b.category_name}</td><td style="text-align:right">${parseFloat(b.allocated_amount||0).toLocaleString('en-IN')}</td><td style="text-align:right">${parseFloat(b.spent_amount||0).toLocaleString('en-IN')}</td><td>${b.status}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No budgets</td></tr>'}
  </tbody>
</table>

<h2>🏆 Savings Goals</h2>
<table>
  <thead><tr><th>Goal</th><th style="text-align:right">Target (₹)</th><th style="text-align:right">Saved (₹)</th><th>Progress</th><th>Status</th></tr></thead>
  <tbody>
    ${(report.goals || []).map(g => `<tr><td>${g.goal_title}</td><td style="text-align:right">${parseFloat(g.target_amount||0).toLocaleString('en-IN')}</td><td style="text-align:right">${parseFloat(g.current_amount||0).toLocaleString('en-IN')}</td><td>${g.progress_percentage}%</td><td>${g.status}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No savings goals</td></tr>'}
  </tbody>
</table>

<footer>FinTrack – Personal Finance Manager &nbsp;|&nbsp; Report generated on ${new Date().toLocaleDateString('en-IN')}</footer>
<script>window.print();</script>
</body></html>`;

            // 4. Open in new tab (user can Ctrl+P to save as PDF)
            const blob = new Blob([html], { type: 'text/html' });
            const url  = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setShowDownloadModal(false);
        } catch (err) {
            console.error('Download error:', err);
            const msg = err.response?.data?.error || err.message || 'Unknown error';
            toast.error(`Failed to generate report: ${msg}`);
        } finally {
            setDownloading(false);
        }
    };
    // ──────────────────────────────────────────────────────

    useEffect(() => {
        if (user) {
            loadDashboard();
        }
    }, [user]);

    const loadDashboard = async () => {
        try {
            const userId = user.User_ID || user.id;
            const [data, mongoRes, riskRes, alertsRes] = await Promise.all([
                getDashboard(userId),
                api.get(`/mongo/stats/summary/${userId}`),
                api.get(`/admin/risk/${userId}`),
                api.get(`/admin/notifications/${userId}`)
            ]).catch(e => {
                console.error("Dashboard fetch error", e);
                return [null, null, null, null];
            });

            if (data) {
                // Transform monthly_trend to have 'name' property for Recharts
                if (data.monthly_trend) {
                    data.monthly_trend = data.monthly_trend.map(item => ({
                        ...item,
                        name: new Date(item.month + '-01').toLocaleString('default', { month: 'short' })
                    }));
                }
                setDashboardData(data);
            }

            if (mongoRes && mongoRes.data && mongoRes.data.success) {
                setMongoStats(mongoRes.data.data);
            }
            if (riskRes && riskRes.data) {
                setRiskData({ 
                    risk_level: riskRes.data.risk_level, 
                    total_spent: riskRes.data.total_spent,
                    total_income: riskRes.data.total_income,
                    risk_score: riskRes.data.risk_score
                });
            }
            if (alertsRes && alertsRes.data) {
                setUserAlerts(alertsRes.data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResolveAlert = async (alertId) => {
        try {
            await api.delete(`/admin/notifications/${alertId}`);
            toast.success('Alert resolved!');
            loadDashboard(); // Refresh
            setShowSecureModal(false);
        } catch (err) {
            toast.error('Failed to resolve alert');
        }
    };

    const handleSecureAccount = async () => {
        const trimmedPwd = newPassword.trim();
        const trimmedConfirm = confirmPassword.trim();

        if (!trimmedPwd || trimmedPwd !== trimmedConfirm) {
            toast.error("Passwords do not match");
            return;
        }

        setSecuring(true);
        try {
            // 1. Update Password in SQL via the new API route
            const { data: pwdData } = await api.post('/users/update-password', {
                user_id: user.User_ID || user.id,
                newPassword: trimmedPwd
            });

            if (pwdData.success) {
                // 2. Resolve the Alert in MongoDB
                if (activeFraudAlerts.length > 0) {
                    await handleResolveAlert(activeFraudAlerts[0]._id);
                } else {
                    toast.success("Password updated successfully!");
                    setShowSecureModal(false);
                }
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (error) {
            console.error("Secure account error:", error);
            const msg = error.response?.data?.error || "Failed to secure account. Please try again.";
            toast.error(msg);
        } finally {
            setSecuring(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    const monthlyTrend      = dashboardData?.monthly_trend   || [];
    const recentActivities  = dashboardData?.recent_activities || [];
    const activeFraudAlerts = userAlerts.filter(a => (a.alert_type === 'FRAUD' || a.message.toLowerCase().includes('fraud')) && a.alert_status !== 'RESOLVED');

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Critical Fraud Banner */}
            {activeFraudAlerts.length > 0 && (
                <div className="bg-rose-600 border-2 border-rose-400 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-6 shadow-[0_0_40px_rgba(225,29,72,0.4)] animate-pulse relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <div className="p-4 bg-white/20 rounded-2xl shrink-0">
                        <ShieldAlert className="w-10 h-10 text-white animate-bounce" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Security Breach Detected!</h2>
                        <p className="text-rose-100 font-medium">Your account is currently under inspection for suspicious activity. The AI/ML engine has detected a potential fraud attempt.</p>
                    </div>
                    <button 
                        onClick={() => setShowSecureModal(true)}
                        className="px-6 py-3 bg-white text-rose-600 rounded-xl font-black hover:bg-rose-50 transition-colors shadow-lg shrink-0"
                    >
                        SECURE ACCOUNT
                    </button>
                </div>
            )}

            {/* Secure Account Modal */}
            {showSecureModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-fade-in shadow-rose-500/10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-500/20 rounded-2xl">
                                <Lock className="w-6 h-6 text-rose-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Reset Password</h3>
                                <p className="text-slate-500 text-sm">Create a new secure password to restore account access.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                                <input 
                                    type="password" 
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white outline-none transition-all font-mono ${newPassword && confirmPassword ? (newPassword === confirmPassword ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.1)]') : 'border-slate-700'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-white outline-none transition-all font-mono ${newPassword && confirmPassword ? (newPassword === confirmPassword ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.1)]') : 'border-slate-700'}`}
                                />
                                {newPassword && confirmPassword && (
                                    <p className={`text-[10px] mt-2 font-bold uppercase tracking-tighter ${newPassword === confirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {newPassword === confirmPassword ? '✓ Passwords Match' : '✗ Passwords do not match'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setShowSecureModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSecureAccount}
                                disabled={securing || !newPassword || newPassword !== confirmPassword}
                                className="flex-2 px-8 py-3 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-500 transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                            >
                                {securing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                UPDATE & SECURE
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white">
                        {getGreeting()}, <span className="gradient-text">{user?.Name || user?.name || 'User'}</span> 👋
                    </h2>
                    <p className="text-slate-400 mt-1">Here's your financial overview for today</p>
                </div>
                <button
                    onClick={() => setShowDownloadModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
                >
                    <FileDown className="w-4 h-4" />
                    Download Report
                </button>
            </div>

            {/* Download Report Modal */}
            {showDownloadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Download className="w-5 h-5 text-purple-400" /> Download Monthly Report</h3>
                            <button onClick={() => setShowDownloadModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Select Month</label>
                                <select
                                    value={downloadForm.month}
                                    onChange={e => setDownloadForm(p => ({ ...p, month: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Select Year</label>
                                <select
                                    value={downloadForm.year}
                                    onChange={e => setDownloadForm(p => ({ ...p, year: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="mt-6 w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
                        >
                            {downloading ? <><Loader className="w-4 h-4 animate-spin" /> Generating...</> : <><FileDown className="w-4 h-4" /> Generate & Download</>}
                        </button>
                        <p className="text-xs text-slate-500 text-center mt-3">The report will open in a new tab. Use Ctrl+P to save as PDF.</p>
                    </div>
                </div>
            )}

            {/* Warnings Section */}
            {dashboardData?.warnings?.length > 0 && (
                <div className="space-y-3">
                    {dashboardData.warnings.map((warning, index) => (
                        <div key={index} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-4 animate-fade-in">
                            <div className="bg-red-500/20 p-2 rounded-lg text-red-500">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Insufficient Funds Alert</h4>
                                <p className="text-red-400 text-sm">{warning.message}</p>
                            </div>
                            <div className="ml-auto text-right text-xs text-red-300">
                                <p>Required: ₹{warning.amount}</p>
                                <p>Available: ₹{warning.balance}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Fraud Alerts Panel */}
            <div className="glass-panel p-4">
                <FraudAlerts userId={user?.User_ID || user?.id} />
            </div>

            {userAlerts && userAlerts.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                    {userAlerts.slice(0, 3).map((alert, i) => (
                        <DashboardAlert key={alert._id || i} alert={alert} onResolve={handleResolveAlert} />
                    ))}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <StatCard
                    title="Total Balance"
                    amount={formatCurrency(dashboardData?.total_balance || 0)}
                    trend={dashboardData?.trends?.balance ? `${Number(dashboardData.trends.balance) > 0 ? '+' : ''}${dashboardData.trends.balance}%` : '0%'}
                    isPositive={Number(dashboardData?.trends?.balance || 0) >= 0}
                    icon={IndianRupee}
                    color="indigo"
                />

                {/* Account Risk Level Card */}
                <div className={`glass-panel p-6 relative overflow-hidden group border-b-4 ${riskData.risk_level === 'HIGH' ? 'border-rose-500' : 'border-emerald-500'}`}>
                    <div className="relative z-10 flex flex-col h-full justify-center">
                        <p className="text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" /> Account Risk Level
                        </p>
                        <h3 className={`text-3xl font-black mt-1 ${riskData.risk_level === 'HIGH' ? 'text-rose-500' : riskData.risk_level === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-400'}`}>
                            {riskData.risk_level}
                        </h3>
                        <p className="text-xs text-slate-500 mt-2 font-mono">Score: {riskData.risk_score}% of Income</p>
                    </div>
                </div>

                <StatCard
                    title="Monthly Income"
                    amount={formatCurrency(dashboardData?.monthly_income > 0 ? dashboardData.monthly_income : (dashboardData?.stated_income || 0))}
                    subtitle={dashboardData?.monthly_income > 0 ? `Avg. Stated: ₹${dashboardData.stated_income?.toLocaleString()}` : 'Based on profile'}
                    trend={dashboardData?.trends?.income ? `${Number(dashboardData.trends.income) > 0 ? '+' : ''}${dashboardData.trends.income}%` : '0%'}
                    isPositive={Number(dashboardData?.trends?.income || 0) >= 0}
                    icon={ArrowUpRight}
                    color="emerald"
                />
                <StatCard
                    title="Monthly Expenses"
                    amount={formatCurrency(dashboardData?.monthly_expense || 0)}
                    trend={dashboardData?.trends?.expense ? `${Number(dashboardData.trends.expense) > 0 ? '+' : ''}${dashboardData.trends.expense}%` : '0%'}
                    isPositive={Number(dashboardData?.trends?.expense || 0) <= 0} // Expense increasing is usually negative for user, but let's stick to Green = Down for expenses? No, expenses usually Red if up.
                    // Wait, isPositive controls color.
                    // If Expense Trend is +10%, isPositive should be False (Red).
                    // If Expense Trend is -10%, isPositive should be True (Green).
                    // So isPositive = trend <= 0
                    icon={ArrowDownRight}
                    color="rose"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income vs Expense Graph */}
                <div className="glass-panel p-6 h-[400px]">
                    <h3 className="text-lg font-semibold text-white mb-6">Income vs Expense</h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                                cursor={{ fill: '#334155', opacity: 0.2 }}
                            />
                            <Legend />
                            <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={50} />
                            <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Recent Activity */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent System Activities</h3>
                    <div className="space-y-4">
                        {recentActivities.slice(0, 5).map((activity, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs 
                                        ${activity.Action_Type === 'DELETE' ? 'bg-rose-500/20 text-rose-500' :
                                            activity.Action_Type === 'UPDATE' ? 'bg-yellow-500/20 text-yellow-500' :
                                                activity.Action_Type === 'LOGIN' ? 'bg-blue-500/20 text-blue-500' :
                                                    'bg-emerald-500/20 text-emerald-500'}`}>
                                        {activity.Action_Type.substring(0, 3)}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium truncate max-w-[150px]" title={activity.Description}>
                                            {activity.Description || `${activity.Action_Type} on ${activity.Table_Name}`}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {new Date(activity.Activity_Time).toLocaleString('en-IN', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded font-semibold 
                                    ${activity.Action_Type === 'DELETE' ? 'bg-rose-500/10 text-rose-400' :
                                        activity.Action_Type === 'UPDATE' ? 'bg-yellow-500/10 text-yellow-400' :
                                            activity.Action_Type === 'LOGIN' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-emerald-500/10 text-emerald-400'}`}>
                                    {activity.Table_Name}
                                </span>
                            </div>
                        ))}
                        {recentActivities.length === 0 && (
                            <p className="text-slate-500 text-center py-4">No recent activities.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* MongoDB Aggregation Showcase */}
            {mongoStats && mongoStats.length > 0 && (
                <div className="glass-panel p-6 bg-gradient-to-br from-[#111827] to-[#0f172a] border border-green-500/20">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Database className="w-6 h-6 text-green-500" />
                            MongoDB Advanced Analytics
                        </h3>
                        <span className="text-xs font-mono bg-green-500/10 text-green-400 px-3 py-1 rounded-full border border-green-500/20 hidden md:block">
                            Pipeline: $match → $group → $project → $sort
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {mongoStats.map((stat, idx) => (
                            <div key={idx} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl hover:bg-slate-800/60 transition-all">
                                <p className="text-slate-400 text-sm font-medium mb-1">Event Type</p>
                                <h4 className="text-lg font-bold text-green-400 mb-3">{stat.event_type}</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Occurrences:</span>
                                        <span className="text-white font-bold">{stat.count}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Total Volume:</span>
                                        <span className="text-white font-bold">₹{stat.total_amount || 0}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ title, amount, trend, isPositive, icon: Icon, color, subtitle }) => {
    return (
        <div className="glass-panel p-6 relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-500`}>
                <Icon className="w-24 h-24 transform translate-x-4 -translate-y-4" />
            </div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 rounded-lg bg-${color}-500/20 text-${color}-400`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-sm font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {trend}
                    </span>
                </div>
                <p className="text-slate-400 text-sm flex items-center gap-2">
                    {title}
                </p>
                <h3 className="text-3xl font-bold text-white mt-1">{amount}</h3>
                {subtitle && <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
};

export default Dashboard;
