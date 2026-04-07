import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Briefcase, CreditCard, Plus, Trash2 } from 'lucide-react';
import { updateUserProfile } from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
    const { user, login, logout, updateUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        Name: '',
        Phone_No: [''],
        Address: '',
        Occupation: '',
        Employment_Status: 'Employee',
        Monthly_Income: ''
    });

    // Initialize form data when user loads or edit mode starts
    useEffect(() => {
        if (user) {
            setFormData({
                Name: user.Name || '',
                Phone_No: Array.isArray(user.Phone_No) ? user.Phone_No : [user.Phone_No || ''],
                Address: user.Address || '',
                Occupation: user.Occupation || '',
                Employment_Status: user.Employment_Status || 'Employee',
                Monthly_Income: user.Monthly_Income || ''
            });
        }
    }, [user, isEditing]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePhoneChange = (index, value) => {
        const phones = [...formData.Phone_No];
        phones[index] = value;
        setFormData({ ...formData, Phone_No: phones });
    };

    const addPhone = () => {
        if (formData.Phone_No.length < 5) {
            setFormData({ ...formData, Phone_No: [...formData.Phone_No, ''] });
        }
    };

    const removePhone = (index) => {
        if (formData.Phone_No.length > 1) {
            const phones = formData.Phone_No.filter((_, i) => i !== index);
            setFormData({ ...formData, Phone_No: phones });
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Filter empty phones
            const validPhones = formData.Phone_No.filter(p => p && p.trim() !== '');
            const dataToSave = {
                ...formData,
                Phone_No: validPhones
            };

            const updatedUser = await updateUserProfile(user.User_ID, dataToSave);

            // Update context and session storage immediately
            updateUser(updatedUser);

            toast.success('Profile updated successfully!');
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update profile", error);
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-white p-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Settings & Profile</h2>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors"
                    >
                        Edit Profile
                    </button>
                )}
            </div>

            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-3xl">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold">
                        {user?.Name?.charAt(0)}
                    </div>
                    <div>
                        {isEditing ? (
                            <input
                                name="Name"
                                value={formData.Name}
                                onChange={handleChange}
                                className="bg-slate-700 text-white px-3 py-2 rounded-lg text-xl font-bold w-full"
                            />
                        ) : (
                            <h3 className="text-2xl font-bold">{user?.Name}</h3>
                        )}
                        <p className="text-slate-400">{user?.Email}</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Phone */}
                    <div className="p-4 bg-slate-900/50 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <Phone className="text-indigo-400 w-5 h-5" />
                            <p className="text-xs text-slate-500 uppercase font-semibold">Phone Numbers</p>
                        </div>
                        {isEditing ? (
                            <div className="space-y-2">
                                {formData.Phone_No.map((phone, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            value={phone}
                                            onChange={(e) => handlePhoneChange(index, e.target.value)}
                                            className="bg-slate-700 text-white px-3 py-2 rounded-lg w-full"
                                            placeholder={index === 0 ? "Primary Mobile No." : "WhatsApp No."}
                                        />
                                        {formData.Phone_No.length > 1 && (
                                            <button
                                                onClick={() => removePhone(index)}
                                                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {formData.Phone_No.length < 5 && (
                                    <button
                                        onClick={addPhone}
                                        className="text-sm text-indigo-400 flex items-center gap-1 hover:text-indigo-300 transition-colors"
                                    >
                                        <Plus size={14} /> Add Phone
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {Array.isArray(user?.Phone_No) && user.Phone_No.length > 0 ? (
                                    user.Phone_No.map((p, i) => (
                                        <div key={i} className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                                {i === 0 ? 'Primary' : 'WhatsApp'}
                                            </span>
                                            <p className="font-medium text-slate-300">{p}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="font-medium">{user?.Phone_No || 'Not provided'}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Address */}
                    <div className="p-4 bg-slate-900/50 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <MapPin className="text-indigo-400 w-5 h-5" />
                            <p className="text-xs text-slate-500 uppercase font-semibold">Address</p>
                        </div>
                        {isEditing ? (
                            <input
                                name="Address"
                                value={formData.Address}
                                onChange={handleChange}
                                className="bg-slate-700 text-white px-3 py-2 rounded-lg w-full"
                            />
                        ) : (
                            <p className="font-medium">{user?.Address || 'Not provided'}</p>
                        )}
                    </div>

                    {/* Employment */}
                    <div className="p-4 bg-slate-900/50 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <Briefcase className="text-indigo-400 w-5 h-5" />
                            <p className="text-xs text-slate-500 uppercase font-semibold">Employment & Occupation</p>
                        </div>
                        {isEditing ? (
                            <div className="flex gap-2">
                                <select
                                    name="Employment_Status"
                                    value={formData.Employment_Status}
                                    onChange={handleChange}
                                    className="bg-slate-700 text-white px-3 py-2 rounded-lg flex-1"
                                >
                                    <option value="Employee">Employee</option>
                                    <option value="Unemployed">Unemployed</option>
                                    <option value="Self-Employed">Self-Employed</option>
                                </select>
                                <input
                                    name="Occupation"
                                    value={formData.Occupation}
                                    onChange={handleChange}
                                    placeholder="Occupation"
                                    className="bg-slate-700 text-white px-3 py-2 rounded-lg flex-1"
                                />
                            </div>
                        ) : (
                            <p className="font-medium">{user?.Employment_Status} - {user?.Occupation}</p>
                        )}
                    </div>

                    {/* Monthly Income */}
                    <div className="p-4 bg-slate-900/50 rounded-xl border border-indigo-500/30">
                        <div className="flex items-center gap-3 mb-2">
                            <CreditCard className="text-indigo-400 w-5 h-5" />
                            <p className="text-xs text-slate-500 uppercase font-semibold">Monthly Income</p>
                        </div>
                        {isEditing ? (
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                                <input
                                    name="Monthly_Income"
                                    type="number"
                                    value={formData.Monthly_Income}
                                    onChange={handleChange}
                                    className="bg-slate-700 text-white pl-8 pr-3 py-2 rounded-lg w-full font-bold text-lg"
                                />
                            </div>
                        ) : (
                            <p className="font-bold text-xl text-emerald-400">₹{user?.Monthly_Income?.toLocaleString()}</p>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div className="mt-8 flex gap-4">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            disabled={loading}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={logout}
                        className="mt-8 w-full py-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/50 rounded-xl font-bold transition-all"
                    >
                        Log Out
                    </button>
                )}
            </div>
        </div>
    );
};

export default Settings;
