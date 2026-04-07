import React, { useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, Cpu, Activity, Info, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

const FraudSimulation = () => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await api.get('/admin/users');
                if (data.success) {
                    setUsers(data.users);
                    if (data.users.length > 0) setSelectedUser(data.users[0].User_ID);
                }
            } catch (err) {
                toast.error("Failed to load users");
            }
        };
        fetchUsers();
    }, []);

    const addLog = (msg) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
    };

    const runSimulation = async (type) => {
        if (!selectedUser || !amount) {
            toast.error("Please select a user and enter an amount");
            return;
        }

        setLoading(true);
        addLog(`Started ${type} simulation for User #${selectedUser} with amount ₹${amount}...`);

        try {
            const { data } = await api.post('/fraud/simulate', {
                user_id: selectedUser,
                simulation_type: type,
                amount: parseFloat(amount)
            });

            if (data.success) {
                addLog(`Result: ${data.result.fraud_status} (Score: ${data.result.risk_score})`);
                if (data.result.reasons.length > 0) {
                    addLog(`Reasons: ${data.result.reasons.join(', ')}`);
                }
                
                if (['FRAUD', 'SUSPICIOUS'].includes(data.result.fraud_status.toUpperCase())) {
                    toast.error(`⚠️ ${data.result.fraud_status}: Simulated alert generated!`);
                } else {
                    toast.success("✅ SAFE: Simulated normal transaction");
                }
            }
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message;
            addLog(`❌ Error: ${errMsg}`);
            toast.error(`Simulation failed: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-red-500/20 rounded-xl">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white">Fraud Simulation Engine</h1>
                    <p className="text-slate-400 mt-1">Safely stress-test detection rules and ML models without touching financial data.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Control Panel */}
                <div className="glass-panel p-6 space-y-6">
                    <h2 className="text-xl font-bold text-white mb-4">Simulation Parameters</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Target Account Profile</label>
                            <select 
                                value={selectedUser} 
                                onChange={e => setSelectedUser(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3 outline-none focus:border-purple-500 transition-colors"
                            >
                                <option value="">Select an account...</option>
                                {users.map(u => (
                                    <option key={u.User_ID} value={u.User_ID}>#{u.User_ID} - {u.Name || u.Full_Name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Transaction Amount (₹)</label>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)}
                                placeholder="Enter mock amount..."
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3 outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-700/50">
                        <button 
                            onClick={() => runSimulation('NORMAL')}
                            disabled={loading}
                            className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Activity className="w-5 h-5" /> Simulate Normal Transaction
                        </button>
                        
                        <button 
                            onClick={() => runSimulation('FRAUD')}
                            disabled={loading}
                            className="w-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <ShieldAlert className="w-5 h-5" /> Simulate Rules-Based Fraud Attack
                        </button>

                        <button 
                            onClick={() => runSimulation('HIGH_FREQUENCY')}
                            disabled={loading}
                            className="w-full bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <TrendingUp className="w-5 h-5" /> Simulate High-Frequency Attack
                        </button>

                        <button 
                            onClick={() => runSimulation('ML_PREDICTION')}
                            disabled={loading}
                            className="w-full bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 p-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Cpu className="w-5 h-5" /> Simulate AI/ML Model Detection
                        </button>
                    </div>
                </div>

                {/* Console Log Panel */}
                <div className="glass-panel flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            <Info className="w-4 h-4"/> Live Output Trace
                        </h2>
                        {loading && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
                    </div>
                    <div className="flex-1 p-4 bg-[#0A0A0A] overflow-y-auto min-h-[300px]">
                        {logs.length === 0 ? (
                            <p className="text-slate-600 font-mono text-sm">System ready. Waiting for simulation trigger...</p>
                        ) : (
                            <div className="space-y-1">
                                {logs.map((log, i) => (
                                    <p key={i} className={`font-mono text-xs ${log.includes('Result: FRAUD') || log.includes('Error:') ? 'text-red-400' : log.includes('Result: SAFE') ? 'text-emerald-400' : 'text-slate-300'}`}>
                                        {log}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FraudSimulation;
