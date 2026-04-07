import React, { useState, useEffect } from 'react';
import { UserPlus, Mail, Lock, User, Phone, Briefcase, IndianRupee, MapPin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Signup = ({ onSwitchToLogin }) => {
    const { register, user } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        address: '',
        employment_status: 'Employee', // Default
        occupation: '',
        monthly_income: '',
        password: '',
        confirmPassword: ''
    });

    // Manage phones separately as an array
    const [phones, setPhones] = useState(['']);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Filter empty phones
        const validPhones = phones.filter(p => p.trim() !== '');
        if (validPhones.length === 0) {
            setError('At least one phone number is required');
            return;
        }

        setLoading(true);

        const { confirmPassword, ...otherData } = formData;

        const registerData = {
            ...otherData,
            phone: validPhones // Send as array
        };

        const result = await register(registerData);

        if (!result.success) {
            setError(result.error);
            setLoading(false);
        } else {
            if (onSwitchToLogin) {
                onSwitchToLogin();
            } else {
                navigate('/login');
            }
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePhoneChange = (index, value) => {
        const newPhones = [...phones];
        newPhones[index] = value;
        setPhones(newPhones);
    };

    const addPhone = () => {
        if (phones.length < 5) { // Limit to 5
            setPhones([...phones, '']);
        }
    };

    const removePhone = (index) => {
        if (phones.length > 1) {
            const newPhones = phones.filter((_, i) => i !== index);
            setPhones(newPhones);
        }
    };

    const handleNext = () => {
        if (step === 1) {
            const validPhones = phones.filter(p => p.trim() !== '');
            if (!formData.name || !formData.email || validPhones.length === 0) {
                setError('Please fill all required fields, including at least one phone number');
                return;
            }
            if (formData.monthly_income && parseFloat(formData.monthly_income) < 0) {
                setError('Income cannot be negative');
                return;
            }

            setError('');
            setStep(2);
        }
    };

    const handleBack = () => {
        setStep(1);
        setError('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-10 left-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="w-full max-w-2xl relative z-10">
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-block p-4 bg-gradient-to-br from-emerald-500 to-purple-500 rounded-3xl mb-4 shadow-glow">
                        <IndianRupee className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black gradient-text mb-2">Join FinTrack</h1>
                    <p className="text-slate-300 text-lg">Start managing your finances like a pro</p>
                </div>

                <div className="glass-panel p-8 md:p-10 animate-slide-in">
                    {/* Progress Indicator */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <div className={`h-2 w-20 rounded-full transition-all ${step >= 1 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-700'}`}></div>
                        <div className={`h-2 w-20 rounded-full transition-all ${step >= 2 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-700'}`}></div>
                    </div>

                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            {step === 1 ? 'Personal Information' : 'Account Security'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            {step === 1 ? 'Step 1 of 2 - Tell us about yourself' : 'Step 2 of 2 - Secure your account'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500 rounded-xl text-red-400 text-sm animate-fade-in">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Personal Info */}
                        {step === 1 && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Full Name <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="rahul Sharma"
                                                className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Email Address <span className="text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="rahul@example.com"
                                                className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Phone Numbers */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Phone Numbers <span className="text-red-400">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        {phones.map((phone, index) => (
                                            <div key={index} className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                    <input
                                                        type="tel"
                                                        value={phone}
                                                        onChange={(e) => handlePhoneChange(index, e.target.value)}
                                                        placeholder="9876543210"
                                                        className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                        required={index === 0} // Only first is strictly required by HTML validation, but we validate strictly in JS
                                                    />
                                                </div>
                                                {phones.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhone(index)}
                                                        className="p-3 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl transition-colors"
                                                        title="Remove Phone"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {phones.length < 5 && (
                                            <button
                                                type="button"
                                                onClick={addPhone}
                                                className="text-sm text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" /> Add another phone number
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Address
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleChange}
                                                placeholder="Mumbai, Maharashtra"
                                                className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Employment Status Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Employment Status <span className="text-red-400">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, employment_status: 'Employee' })}
                                            className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.employment_status === 'Employee'
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            <Briefcase className="w-5 h-5" />
                                            Employee
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, employment_status: 'Unemployed', occupation: '' })}
                                            className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.employment_status === 'Unemployed'
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            <User className="w-5 h-5" />
                                            Unemployed
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {formData.employment_status === 'Employee' && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Occupation
                                            </label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    name="occupation"
                                                    value={formData.occupation}
                                                    onChange={handleChange}
                                                    placeholder="Software Engineer"
                                                    className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className={formData.employment_status === 'Unemployed' ? 'md:col-span-2' : ''}>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            {formData.employment_status === 'Employee' ? 'Monthly Income (₹)' : 'Monthly Pocket Money (₹)'}
                                        </label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="number"
                                                name="monthly_income"
                                                value={formData.monthly_income}
                                                onChange={handleChange}
                                                placeholder={formData.employment_status === 'Employee' ? '50000' : '2000'}
                                                className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="btn-gradient w-full flex items-center justify-center gap-2 py-4 text-lg font-semibold"
                                >
                                    Continue to Security
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* Step 2: Password */}
                        {step === 2 && (
                            <div className="space-y-5 animate-fade-in">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Create Password <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="Minimum 6 characters"
                                            className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Confirm Password <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            placeholder="Re-enter your password"
                                            className="pl-12 w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="flex-1 py-4 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn-gradient flex-1 flex items-center justify-center gap-2 py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="w-5 h-5" />
                                                Create Account
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-slate-400">
                            Already have an account?{' '}
                            <button
                                onClick={() => navigate('/login')}
                                className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                            >
                                Login Here
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
