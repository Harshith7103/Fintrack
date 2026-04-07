import React, { useState, useEffect } from 'react';
import { LogIn, Mail, Lock, Sparkles, IndianRupee, TrendingUp, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const { login, demoAdminLogin, user } = useAuth();
    const navigate = useNavigate();

    // useEffect(() => {
    //     if (user) {
    //         navigate('/');
    //     }
    // }, [user, navigate]);

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginMode, setLoginMode] = useState('USER');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(formData.email, formData.password);

        if (!result.success) {
            if (result.error === 'ADMIN_NOT_ALLOWED') {
                setError('⚠️ Admin access detected. Please switch to the "Admin Login" tab for secure console access.');
            } else {
                setError(result.error);
            }
            setLoading(false);
        } else {
            console.log("Logged in user:", result.user);
            navigate('/');
        }
    };

    const handleAdminLogin = async () => {
        setError('');
        setLoading(true);
        const result = await demoAdminLogin(); // Use specialized admin portal entry
        if (!result.success) {
            setError(result.error);
            setLoading(false);
        } else {
            console.log("Logged in admin:", result.user);
            navigate('/admin');
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            </div>

            <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
                {/* Left Side - Branding */}
                <div className="hidden lg:block animate-fade-in">
                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-glow">
                                <IndianRupee className="w-10 h-10 text-white" />
                            </div>
                            <div>
                                <h1 className="text-5xl font-black gradient-text">FinTrack</h1>
                                <p className="text-slate-300 text-sm">Your Personal Finance Manager</p>
                            </div>
                        </div>

                        <div className="glass-panel p-8 space-y-6">
                            <h2 className="text-3xl font-bold text-white">
                                Track Your <span className="text-gradient">Money</span> Smartly
                            </h2>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                Manage your income, expenses, savings, and investments all in one beautiful place.
                                Perfect for Indian users with support for UPI, bank accounts, and more.
                            </p>

                            <div className="space-y-4 pt-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                                        <TrendingUp className="w-6 h-6 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">Real-time Analytics</h3>
                                        <p className="text-slate-400 text-sm">Visualize your spending patterns and savings goals</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="p-2 bg-purple-500/20 rounded-lg">
                                        <Sparkles className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold">Smart Categorization</h3>
                                        <p className="text-slate-400 text-sm">Automatic categorization of your transactions</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="animate-slide-in">
                    <div className="glass-panel p-8 md:p-10">
                        <div className="text-center mb-8">
                            <div className="inline-block p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4 lg:hidden">
                                <IndianRupee className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back!</h2>
                            <p className="text-slate-400">Login to access your financial dashboard</p>
                        </div>

                        {/* Login Mode Toggle */}
                        <div className="flex bg-slate-800/50 p-1 rounded-xl mb-6 border border-slate-700/50">
                            <button
                                onClick={() => { setLoginMode('USER'); setError(''); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${loginMode === 'USER' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                User Login
                            </button>
                            <button
                                onClick={() => { setLoginMode('ADMIN'); setError(''); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${loginMode === 'ADMIN' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Admin Login
                            </button>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500 rounded-xl text-red-400 text-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        {loginMode === 'USER' ? (
                            <>
                                <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your.email@example.com" className="pl-12 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter your password" className="pl-12 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={loading} className="btn-gradient w-full flex items-center justify-center gap-2 py-4 text-lg font-semibold disabled:opacity-50 transition-all">
                                        {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Logging in...</> : <><LogIn className="w-5 h-5" />Login to Dashboard</>}
                                    </button>
                                </form>

                                <div className="mt-8 text-center">
                                    <p className="text-slate-400">
                                        Don't have an account?{' '}
                                        <button onClick={() => navigate('/register')} className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">Sign Up Now</button>
                                    </p>
                                </div>
                                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <p className="text-xs text-blue-300 text-center">💡 Demo User: john@example.com / password123</p>
                                </div>
                            </>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); handleAdminLogin(); }} className="space-y-6 text-center animate-fade-in py-2">
                                <div className="mx-auto w-20 h-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mb-6 border-4 border-rose-500/30">
                                    <Lock className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Secure Admin Access</h3>
                                <p className="text-slate-400 mb-8 max-w-xs mx-auto text-sm">Use the specialized admin portal to monitor analytics, detect risk, and manage the system.</p>
                                
                                <div className="text-left mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
                                        <input type="text" readOnly value="admin123@gmail.com" className="pl-12 w-full bg-slate-800/50 border border-rose-500/30 rounded-lg px-4 py-3 text-slate-300 cursor-not-allowed outline-none" />
                                    </div>
                                </div>

                                <div className="text-left mb-6">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
                                        <input type="password" readOnly value="123456" className="pl-12 w-full bg-slate-800/50 border border-rose-500/30 rounded-lg px-4 py-3 text-slate-300 cursor-not-allowed outline-none" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-900 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Authenticating...</> : <><ShieldAlert className="w-5 h-5"/> Launch Admin Console</>}
                                </button>
                                
                                <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-left">
                                    <p className="text-xs text-rose-300 flex items-center gap-2">
                                        💡 Using explicitly requested credentials.
                                    </p>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
