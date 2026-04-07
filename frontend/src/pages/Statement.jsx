
import React, { useState, useEffect } from 'react';
import { Download, Printer, Filter } from 'lucide-react';
import { getAccounts, getTransactions } from '../services/api';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Statement = () => {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (user?.User_ID) {
                try {
                    const accData = await getAccounts(user.User_ID);
                    setAccounts(accData);
                    if (accData.length > 0) {
                        setSelectedAccount(accData[0]);
                    }
                } catch (error) {
                    console.error("Failed to fetch accounts", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchData();
    }, [user]);

    useEffect(() => {
        const fetchTransactions = async () => {
            if (user?.User_ID && selectedAccount) {
                try {
                    const txnData = await getTransactions(user.User_ID, { account_id: selectedAccount.Account_ID });
                    setTransactions(txnData);
                } catch (error) {
                    console.error("Failed to fetch transactions", error);
                }
            }
        };
        fetchTransactions();
    }, [user, selectedAccount]);

    // Calculate Running Balance
    const getStatementData = () => {
        if (!selectedAccount || transactions.length === 0) return [];

        let currentBalance = selectedAccount.Balance;
        // Transactions are usually Newest First. 
        // Row 1 Balance = Current Balance.
        // Row 2 Balance = Row 1 Balance - (Income) + (Expense)

        return transactions.map(txn => {
            const rowBalance = currentBalance;
            const amount = parseFloat(txn.Amount);

            // Prepare balance for the NEXT (older) row
            if (txn.Transaction_Type === 'Income') {
                currentBalance -= amount;
            } else {
                currentBalance += amount;
            }

            return {
                ...txn,
                calculatedBalance: rowBalance
            };
        });
    };

    const statementRows = getStatementData();

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text("Bank Statement", 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Account: ${selectedAccount?.Account_Name || 'All'}`, 14, 30);
        doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 36);

        // Table
        const tableColumn = ["Date", "Description", "Type", "Credit", "Debit", "Balance"];
        const tableRows = [];

        statementRows.forEach(row => {
            const date = new Date(row.Transaction_DateTime).toLocaleDateString();
            const credit = row.Transaction_Type === 'Income' ? formatCurrency(row.Amount) : '-';
            const debit = row.Transaction_Type === 'Expense' ? formatCurrency(row.Amount) : '-';
            const balance = formatCurrency(row.calculatedBalance);

            const rowData = [
                date,
                row.Description,
                row.Transaction_Type,
                credit,
                debit,
                balance
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [88, 28, 135] }, // Purple header
            styles: { fontSize: 9 },
        });

        doc.save(`Statement_${selectedAccount?.Account_Name || 'All'}.pdf`);
    };

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white">Bank Statement</h2>
                    <p className="text-slate-400 mt-1">Official statement of your accounts.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <select
                            className="bg-slate-800 text-white pl-4 pr-10 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer min-w-[200px]"
                            onChange={(e) => {
                                const acc = accounts.find(a => a.Account_ID === parseInt(e.target.value));
                                setSelectedAccount(acc);
                            }}
                            value={selectedAccount?.Account_ID || ''}
                        >
                            {accounts.map(acc => (
                                <option key={acc.Account_ID} value={acc.Account_ID}>
                                    {acc.Account_Name}
                                </option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="glass-panel overflow-hidden border border-slate-700/50 rounded-2xl shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-400 uppercase text-xs tracking-wider">
                                <th className="p-4 whitespace-nowrap">Date</th>
                                <th className="p-4 whitespace-nowrap">Description</th>
                                <th className="p-4 whitespace-nowrap">Type</th>
                                <th className="p-4 whitespace-nowrap text-right">Credit</th>
                                <th className="p-4 whitespace-nowrap text-right">Debit</th>
                                <th className="p-4 whitespace-nowrap text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {statementRows.length > 0 ? (
                                statementRows.map((row) => (
                                    <tr key={row.Transaction_ID} className="hover:bg-slate-700/30 transition-colors text-sm text-slate-300">
                                        <td className="p-4 whitespace-nowrap">
                                            {new Date(row.Transaction_DateTime).toLocaleDateString('en-IN', {
                                                year: 'numeric', month: 'short', day: 'numeric'
                                            })}
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                TXN{row.Transaction_ID}
                                            </div>
                                        </td>
                                        <td className="p-4 font-medium text-white max-w-xs truncate">
                                            {row.Description}
                                            <div className="text-xs text-slate-500">{row.Category_Name}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${row.Transaction_Type === 'Income'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}>
                                                {row.Transaction_Type === 'Income' ? 'Credit' : 'Debit'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono text-emerald-400">
                                            {row.Transaction_Type === 'Income' ? formatCurrency(row.Amount) : '-'}
                                        </td>
                                        <td className="p-4 text-right font-mono text-rose-400">
                                            {row.Transaction_Type === 'Expense' ? formatCurrency(row.Amount) : '-'}
                                        </td>
                                        <td className="p-4 text-right font-mono text-slate-200 font-semibold bg-slate-800/30">
                                            {formatCurrency(row.calculatedBalance)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">
                                        No transactions found for this account.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-2 transition-colors border border-slate-700" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" /> Print
                </button>
                <button
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-medium shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2"
                >
                    <Download className="w-4 h-4" /> Export PDF
                </button>
            </div>
        </div>
    );
};

export default Statement;
