import React, { useState, useEffect } from 'react';
import { Plus, Wallet, Building, CreditCard, Coins, ArrowRightLeft, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAccounts, createAccount, updateAccount, deleteAccount, transferBetweenAccounts } from '../services/api';
import { formatCurrency, getAccountTypeIcon } from '../utils/helpers';
import toast from 'react-hot-toast';

const Accounts = () => {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        account_name: '',
        account_type: 'Bank',
        balance: ''
    });
    const [transferData, setTransferData] = useState({
        from_account_id: '',
        to_account_id: '',
        amount: ''
    });

    useEffect(() => {
        if (user) loadAccounts();
    }, [user]);

    const loadAccounts = async () => {
        try {
            const data = await getAccounts(user.User_ID || user.id);
            setAccounts(data);
        } catch (error) {
            console.error('Failed to load accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAccount = async (e) => {
        e.preventDefault();
        try {
            await createAccount({
                user_id: user.User_ID || user.id,
                ...formData,
                balance: parseFloat(formData.balance) || 0
            });
            setShowAddModal(false);
            setFormData({ account_name: '', account_type: 'Bank', balance: '' });
            loadAccounts();
            toast.success('Account created successfully');
        } catch (error) {
            toast.error('Failed to create account');
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        try {
            await transferBetweenAccounts({
                user_id: user.User_ID || user.id,
                ...transferData,
                amount: parseFloat(transferData.amount)
            });
            setShowTransferModal(false);
            setTransferData({ from_account_id: '', to_account_id: '', amount: '' });
            loadAccounts();
            toast.success('Transfer successful');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Transfer failed');
        }
    };

    const handleDelete = async (accountId) => {
        if (window.confirm('Are you sure you want to delete this account?')) {
            try {
                await deleteAccount(accountId);
                loadAccounts();
                toast.success('Account deleted');
            } catch (error) {
                toast.error('Failed to delete account');
            }
        }
    };

    const AccountTypeIcon = ({ type }) => {
        const icons = {
            'Cash': Coins,
            'Bank': Building,
            'Wallet': Wallet,
            'Credit Card': CreditCard
        };
        const Icon = icons[type] || Wallet;
        return <Icon className="w-6 h-6" />;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white">Accounts</h2>
                    <p className="text-slate-400 mt-1">Manage your bank accounts, wallets, and cash</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowTransferModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all flex items-center gap-2"
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        Transfer
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-gradient px-4 py-2 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Account
                    </button>
                </div>
            </div>

            {/* Accounts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((account) => (
                    <div key={account.Account_ID} className="glass-panel p-6 relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl bg-purple-500/20 text-purple-400`}>
                                <AccountTypeIcon type={account.Account_Type} />
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDelete(account.Account_ID)}
                                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-1">{account.Account_Name}</h3>
                        <p className="text-slate-400 text-sm mb-4">{account.Account_Type}</p>
                        <p className="text-3xl font-bold text-white">{formatCurrency(account.Balance)}</p>
                    </div>
                ))}
            </div>

            {/* Add Account Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="glass-panel p-8 max-w-md w-full mx-4">
                        <h3 className="text-2xl font-bold text-white mb-6">Add New Account</h3>
                        <form onSubmit={handleAddAccount} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Account Name</label>
                                <input
                                    type="text"
                                    value={formData.account_name}
                                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                                    placeholder="SBI Savings"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Account Type</label>
                                <select
                                    value={formData.account_type}
                                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                                >
                                    <option value="Bank">Bank</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Wallet">Wallet</option>
                                    <option value="Credit Card">Credit Card</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Initial Balance (₹)</label>
                                <input
                                    type="number"
                                    value={formData.balance}
                                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 btn-gradient py-3">
                                    Add Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="glass-panel p-8 max-w-md w-full mx-4">
                        <h3 className="text-2xl font-bold text-white mb-6">Transfer Between Accounts</h3>
                        <form onSubmit={handleTransfer} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">From Account</label>
                                <select
                                    value={transferData.from_account_id}
                                    onChange={(e) => setTransferData({ ...transferData, from_account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.Account_ID} value={acc.Account_ID}>
                                            {acc.Account_Name} ({formatCurrency(acc.Balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">To Account</label>
                                <select
                                    value={transferData.to_account_id}
                                    onChange={(e) => setTransferData({ ...transferData, to_account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.Account_ID} value={acc.Account_ID}>
                                            {acc.Account_Name} ({formatCurrency(acc.Balance)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Amount (₹)</label>
                                <input
                                    type="number"
                                    value={transferData.amount}
                                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowTransferModal(false)}
                                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 btn-gradient py-3">
                                    Transfer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Accounts;
