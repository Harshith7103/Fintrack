import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { getFraudHistory } from '../services/api';

const STATUS_CONFIG = {
    Fraud:      { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',    icon: ShieldAlert,   dot: 'bg-red-500' },
    Suspicious: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertTriangle, dot: 'bg-yellow-500' },
    Safe:       { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  icon: ShieldCheck,   dot: 'bg-green-500' },
};

export function FraudBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Safe;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
            {status}
        </span>
    );
}

export default function FraudAlerts({ userId }) {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(new Set());

    useEffect(() => {
        if (!userId) return;
        getFraudHistory(userId)
            .then(data => setAlerts(data || []))
            .catch(() => setAlerts([]))
            .finally(() => setLoading(false));
    }, [userId]);

    const visible = alerts.filter(a => !dismissed.has(a.Transaction_ID));

    if (loading) return null;
    if (visible.length === 0) return null;

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Fraud Alerts ({visible.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {visible.slice(0, 10).map(alert => {
                    const cfg = STATUS_CONFIG[alert.fraud_status] || STATUS_CONFIG.Safe;
                    const Icon = cfg.icon;
                    return (
                        <div key={alert.Transaction_ID}
                             className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${cfg.bg}`}>
                            <div className="flex items-start gap-2 min-w-0">
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                                <div className="min-w-0">
                                    <p className={`text-xs font-semibold ${cfg.color}`}>{alert.fraud_status}</p>
                                    <p className="text-xs text-slate-300 truncate">
                                        ₹{parseFloat(alert.Amount).toLocaleString('en-IN')} – {alert.Description || alert.Category_Name || 'Transaction'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(alert.Transaction_DateTime).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setDismissed(s => new Set([...s, alert.Transaction_ID]))}
                                    className="text-slate-500 hover:text-slate-300 flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
