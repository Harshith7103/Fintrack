import React from 'react';
import { LayoutDashboard, PiggyBank, Receipt, Settings, LogOut, TrendingUp, FileText, PieChart, IndianRupee, ClipboardList, Users, Database, AlertTriangle, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = user?.role === 'ADMIN' ? [
        { icon: LayoutDashboard, label: 'System overview', path: '/admin' },
        { icon: Users, label: 'User directory', path: '/admin/users' },
        { icon: Receipt, label: 'Global transactions', path: '/admin/transactions' },
        { icon: Database, label: 'Risk analytics engine', path: '/admin/pipeline' },
        { icon: AlertTriangle, label: 'System alerts', path: '/admin/alerts' },
        { icon: Cpu, label: 'Fraud Simulator', path: '/fraud-simulation' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ] : [
        { icon: LayoutDashboard, label: 'User Dashboard', path: '/' },
        { icon: Receipt, label: 'Transactions', path: '/transactions' },
        { icon: PiggyBank, label: 'Savings & Goals', path: '/savings' },
        { icon: PieChart, label: 'Budgets', path: '/budget-manager' },
        { icon: TrendingUp, label: 'EMI Management', path: '/emi' },
        { icon: FileText, label: 'Bank Statement', path: '/statement' },
        { icon: ClipboardList, label: 'Audit Log', path: '/audit' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    const getInitials = (name) => {
        return name
            ?.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2) || 'U';
    };

    return (
        <div className="h-screen w-64 backdrop-blur-xl bg-slate-900/95 border-r border-slate-700/50 flex flex-col flex-shrink-0 shadow-2xl">
            {/* Logo */}
            <div className="p-6 flex items-center gap-3 border-b border-slate-700/50">
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse-glow">
                    <IndianRupee className="text-white w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-black gradient-text">
                        FinTrack
                    </h1>
                    <p className="text-xs text-slate-400">{user?.role === 'ADMIN' ? 'Admin console' : 'Money Manager'}</p>
                </div>
            </div>

            {/* User Profile Section */}
            <div className="p-4 border-b border-slate-700/50">
                <div className="glass-panel p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 via-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {getInitials(user?.Name || user?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{user?.Name || user?.name || 'User'}</p>
                        <p className="text-xs text-slate-400 truncate">{user?.Email || user?.email}</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const p = location.pathname.replace(/\/$/, '') || '/';
                    const itemPath = item.path.replace(/\/$/, '');
                    const isActive =
                        itemPath === '/admin'
                            ? p === '/admin'
                            : p === itemPath || p.startsWith(`${itemPath}/`);
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden
                                ${isActive
                                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-purple-500/30 shadow-lg shadow-purple-900/30'
                                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                                } `}
                        >
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 animate-pulse"></div>
                            )}
                            <Icon className={`w-5 h-5 transition-all relative z-10 ${isActive ? 'text-purple-400' : 'group-hover:text-white'} `} />
                            <span className="font-semibold relative z-10">{item.label}</span>
                            {isActive && (
                                <div className="ml-auto w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)] relative z-10" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-slate-700/50">
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 transition-all duration-300 group"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-semibold">Logout</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;

