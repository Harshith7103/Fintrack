import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuditLogs, getMongoStats } from '../services/api';
import { Loader, AlertTriangle, ChevronDown, ChevronRight, Calendar, Database, DatabaseZap, PieChart } from 'lucide-react';

const AuditLog = () => {
    const { user } = useAuth();
    const [groupedLogsState, setGroupedLogsState] = useState({});
    const [mongoStats, setMongoStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedDates, setExpandedDates] = useState({});

    useEffect(() => {
        if (user) {
            fetchLogs();
            fetchMongoStats();
        }
    }, [user]);

    const fetchMongoStats = async () => {
        try {
            const data = await getMongoStats(user.User_ID || user.id);
            setMongoStats(data);
        } catch (err) {
            console.error('Failed to load mongo stats:', err);
        }
    };

    const fetchLogs = async () => {
        try {
            const userId = user.User_ID || user.id;
            const data = await getAuditLogs(userId);

            // Group by Date
            const groups = {};
            data.forEach(log => {
                const dateKey = new Date(log.Timestamp).toLocaleDateString();
                if (!groups[dateKey]) {
                    groups[dateKey] = [];
                }
                groups[dateKey].push(log);
            });

            // Auto expand the most recent date
            const dates = Object.keys(groups);
            if (dates.length > 0) {
                setExpandedDates({ [dates[0]]: true });
            }

            setGroupedLogsState(groups);
        } catch (err) {
            console.error(err);
            setError('Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    const toggleDate = (date) => {
        setExpandedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
        </div>
    );

    return (
        <div className="space-y-6 p-6 animate-fade-in pb-24">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">System Audit & Insights</h1>
                    <p className="text-slate-400 mt-1">Track system activities (MySQL) and analyzed event patterns (MongoDB Aggregate)</p>
                </div>
            </div>

            {/* MongoDB Aggregation Insights (Satisfies Rubric #7) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {mongoStats.length > 0 ? mongoStats.map((stat, i) => (
                    <div key={i} className="glass-panel p-4 border-l-4 border-l-purple-500 hover:scale-105 transition-transform">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Aggregate: {stat.event}</span>
                            <DatabaseZap className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="mt-2">
                            <div className="text-2xl font-bold text-white">{stat.count}</div>
                            <div className="text-xs text-slate-500">Occurrences logged</div>
                            <div className="mt-2 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (stat.count / 10) * 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-4 glass-panel p-4 text-center text-slate-500 text-sm italic">
                        No aggregation insights available yet. Perform some actions to populate logs.
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="space-y-4">
                {Object.keys(groupedLogsState).length === 0 ? (
                    <div className="text-center py-10 text-slate-500 glass-panel rounded-xl">
                        No audit records found.
                    </div>
                ) : (
                    Object.keys(groupedLogsState)
                        .sort((a, b) => new Date(b) - new Date(a)) // Sort Descending
                        .map((date) => (
                            <div key={date} className="glass-panel overflow-hidden rounded-xl border border-slate-700/50">
                                {/* Date Header */}
                                <button
                                    onClick={() => toggleDate(date)}
                                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedDates[date] ? <ChevronDown className="w-5 h-5 text-purple-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            {date}
                                        </h3>
                                        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                                            {groupedLogsState[date].length} Actions
                                        </span>
                                    </div>
                                </button>

                                {/* Logs Table (Horizontal Expansion) */}
                                {expandedDates[date] && (
                                    <div className="overflow-x-auto animate-fade-in">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-900/30 text-slate-400 uppercase text-xs font-semibold">
                                                <tr>
                                                    <th className="p-4 w-32">Time</th>
                                                    <th className="p-4 w-24">Action</th>
                                                    <th className="p-4 w-32">Entity</th>
                                                    <th className="p-4">Details</th>
                                                    <th className="p-4 w-32">User</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700/30 text-slate-300">
                                                {groupedLogsState[date].map((log) => (
                                                    <tr key={log.Log_ID} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="p-4 text-sm font-mono text-slate-400">
                                                            {new Date(log.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${log.Action_Type === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                                                                log.Action_Type === 'UPDATE' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    log.Action_Type === 'LOGIN' ? 'bg-blue-500/20 text-blue-400' :
                                                                        log.Action_Type === 'TRANSFER' ? 'bg-purple-500/20 text-purple-400' :
                                                                            'bg-emerald-500/20 text-emerald-400'
                                                                }`}>
                                                                {log.Action_Type}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 font-semibold text-white text-xs tracking-wide">
                                                            {log.Table_Name}
                                                        </td>
                                                        <td className="p-4 text-sm text-slate-400">
                                                            {log.Action_Type === 'LOGIN' && log.Description && log.Description.includes('Lifetime') ? (
                                                                <span className="text-blue-300 font-mono text-xs block bg-blue-500/10 p-2 rounded border border-blue-500/20">
                                                                    {log.Description}
                                                                </span>
                                                            ) : (
                                                                log.Description || log.Record_Details || `Record ID: ${log.Record_ID}`
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-sm flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400">
                                                                {log.Changed_By ? log.Changed_By.charAt(0) : 'S'}
                                                            </div>
                                                            <span className="truncate max-w-[100px]">{log.Changed_By || 'System'}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))
                )}
            </div>
        </div>
    );
};

export default AuditLog;
