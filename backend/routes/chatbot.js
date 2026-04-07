/**
 * Professional Financial AI Chatbot – Backend
 * POST /api/chatbot/message  { user_id, message, context }
 * GET  /api/chatbot/history/:userId
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { Notification } = require('../mongodb');

// ── Intent definitions (ordered: specific before generic) ────
const INTENTS = [
    { name: 'greeting',        patterns: [/^(hi|hello|hey|good (morning|evening|afternoon|day)|howdy)/i] },
    { name: 'thanks',          patterns: [/^(thanks|thank you|thx|ty|great|awesome|perfect|nice)/i] },
    { name: 'help',            patterns: [/help|what can you|commands|options|features|capabilities/i] },
    { name: 'add_expense',     patterns: [/add expense|record expense|log expense|new expense/i] },
    { name: 'add_income',      patterns: [/add income|record income|log income|new income/i] },
    { name: 'monthly_summary', patterns: [/monthly summary|financial summary|month overview|show summary|give summary|my summary|this month summary/i] },
    { name: 'balance',         patterns: [/balance|net worth|how much.*have|total money|account balance|my funds/i] },
    { name: 'recent_transactions', patterns: [/recent|last.*transaction|latest.*transaction|show.*transaction|my.*transaction|transaction history/i] },
    { name: 'fraud_advice',    patterns: [/what should i do|how.*protect|secure.*account|prevent fraud|suspicious.*what/i] },
    { name: 'fraud_status',    patterns: [/fraud|suspicious|flagged|alert|risk|unsafe|scam|unusual/i] },
    { name: 'budget_tips',     patterns: [/spending tip|saving tip|give.*tip|any tip|suggest|advice|reduce.*spend|cut.*spend|save more|improve finance/i] },
    { name: 'budget',          patterns: [/budget/i] },
    { name: 'total_income',    patterns: [/total income|my income|show income|income this|earned|salary|deposit/i] },
    { name: 'total_expenses',  patterns: [/total expense|my expense|show expense|expenses|spent|spending|paid|payment/i] },
    { name: 'savings',         patterns: [/saving|goal|target|invest/i] },
    { name: 'emi',             patterns: [/emi|loan|installment|due/i] },
];

function detectIntent(message) {
    const lower = message.toLowerCase().trim();
    for (const intent of INTENTS) {
        if (intent.patterns.some(p => p.test(lower))) return intent.name;
    }
    return 'unknown';
}

// ── Context-aware last-month detection ──────────────────────
function getTargetMonth(message, context) {
    if (/last month|previous month/i.test(message)) {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 7);
    }
    if (context?.last_month) return context.last_month;
    return new Date().toISOString().slice(0, 7);
}

// ── Format currency ──────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Intent handlers ──────────────────────────────────────────
async function handleIntent(intent, userId, message, context = {}) {
    const month = getTargetMonth(message, context);
    const monthLabel = new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });

    switch (intent) {

        case 'greeting': {
            const [u] = await db.query('SELECT Name FROM USERS WHERE User_ID = ?', [userId]);
            const name = u[0]?.Name?.split(' ')[0] || 'there';
            const hour = new Date().getHours();
            const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
            return {
                text: `${greet}, ${name}! 👋 I'm your FinTrack AI assistant. How can I help you today?`,
                suggestions: ['Show my balance', 'Monthly summary', 'Any fraud alerts?', 'Budget status']
            };
        }

        case 'thanks':
            return { text: "You're welcome! 😊 Is there anything else I can help you with?", suggestions: ['Show balance', 'Monthly summary', 'Help'] };

        case 'help':
            return {
                text: "Here's what I can do for you:",
                cards: [
                    { icon: '💰', title: 'Account Insights', items: ['Current balance', 'Monthly income', 'Monthly expenses'] },
                    { icon: '📊', title: 'Transactions', items: ['Recent transactions', 'Monthly summary', 'Spending breakdown'] },
                    { icon: '🛡️', title: 'Fraud & Security', items: ['Fraud alerts', 'Suspicious activity', 'Security tips'] },
                    { icon: '🎯', title: 'Goals & Budget', items: ['Savings goals', 'Budget status', 'Spending tips'] },
                ],
                suggestions: ['Show my balance', 'Recent transactions', 'Fraud alerts', 'Budget status']
            };

        case 'balance': {
            const [accs] = await db.query(
                'SELECT Account_Name, Account_Type, Balance FROM ACCOUNT WHERE User_ID = ? ORDER BY Balance DESC',
                [userId]
            );
            if (!accs.length) return { text: "You don't have any accounts yet. Create one to get started!" };
            const total = accs.reduce((s, a) => s + parseFloat(a.Balance), 0);
            const lines = accs.map(a => `• ${a.Account_Name} (${a.Account_Type}): ${fmt(a.Balance)}`).join('\n');
            return {
                text: `💰 Your account balances:\n\n${lines}\n\n📊 Total: ${fmt(total)}`,
                suggestions: ['Monthly summary', 'Recent transactions', 'Budget status']
            };
        }

        case 'total_expenses': {
            const [rows] = await db.query(
                `SELECT COALESCE(SUM(Amount),0) as total FROM \`TRANSACTION\`
                 WHERE User_ID=? AND Transaction_Type='Expense'
                 AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`,
                [userId, month]
            );
            const [top] = await db.query(
                `SELECT COALESCE(c.Category_Name,'Uncategorized') as cat, SUM(t.Amount) as amt
                 FROM \`TRANSACTION\` t LEFT JOIN CATEGORY c ON t.Category_ID=c.Category_ID
                 WHERE t.User_ID=? AND t.Transaction_Type='Expense'
                 AND DATE_FORMAT(t.Transaction_DateTime,'%Y-%m')=?
                 GROUP BY cat ORDER BY amt DESC LIMIT 3`,
                [userId, month]
            );
            const total = parseFloat(rows[0]?.total || 0);
            let text = `💸 Your total expenses for ${monthLabel}: ${fmt(total)}`;
            if (top.length) {
                text += `\n\n🔝 Top spending categories:\n` + top.map((r, i) => `${i + 1}. ${r.cat}: ${fmt(r.amt)}`).join('\n');
            }
            return { text, suggestions: ['Show income', 'Budget status', 'Spending tips'] };
        }

        case 'total_income': {
            const [rows] = await db.query(
                `SELECT COALESCE(SUM(Amount),0) as total FROM \`TRANSACTION\`
                 WHERE User_ID=? AND Transaction_Type='Income'
                 AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`,
                [userId, month]
            );
            const total = parseFloat(rows[0]?.total || 0);
            return {
                text: `💵 Your total income for ${monthLabel}: ${fmt(total)}`,
                suggestions: ['Show expenses', 'Monthly summary', 'Savings goals']
            };
        }

        case 'monthly_summary': {
            const [inc] = await db.query(`SELECT COALESCE(SUM(Amount),0) as t FROM \`TRANSACTION\` WHERE User_ID=? AND Transaction_Type='Income' AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`, [userId, month]);
            const [exp] = await db.query(`SELECT COALESCE(SUM(Amount),0) as t FROM \`TRANSACTION\` WHERE User_ID=? AND Transaction_Type='Expense' AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`, [userId, month]);
            const [bal] = await db.query(`SELECT COALESCE(SUM(Balance),0) as t FROM ACCOUNT WHERE User_ID=?`, [userId]);
            const [txCount] = await db.query(`SELECT COUNT(*) as c FROM \`TRANSACTION\` WHERE User_ID=? AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`, [userId, month]);
            const income = parseFloat(inc[0]?.t || 0);
            const expense = parseFloat(exp[0]?.t || 0);
            const balance = parseFloat(bal[0]?.t || 0);
            const net = income - expense;
            const savingsRate = income > 0 ? ((net / income) * 100).toFixed(1) : 0;
            const emoji = net >= 0 ? '✅' : '⚠️';
            return {
                text: `📊 Financial Summary – ${monthLabel}\n\n` +
                      `💵 Income:    ${fmt(income)}\n` +
                      `💸 Expenses:  ${fmt(expense)}\n` +
                      `${emoji} Net:       ${fmt(net)}\n` +
                      `🏦 Balance:   ${fmt(balance)}\n` +
                      `📈 Savings Rate: ${savingsRate}%\n` +
                      `🔢 Transactions: ${txCount[0]?.c || 0}`,
                suggestions: ['Show expenses', 'Budget status', 'Fraud alerts']
            };
        }

        case 'recent_transactions': {
            const [rows] = await db.query(
                `SELECT t.Amount, t.Transaction_Type, t.Description, t.Transaction_DateTime,
                        t.fraud_status, COALESCE(c.Category_Name,'Uncategorized') as cat
                 FROM \`TRANSACTION\` t LEFT JOIN CATEGORY c ON t.Category_ID=c.Category_ID
                 WHERE t.User_ID=? ORDER BY t.Transaction_DateTime DESC LIMIT 7`,
                [userId]
            );
            if (!rows.length) return { text: 'No transactions found yet. Add your first transaction!', suggestions: ['Add expense', 'Add income'] };
            const lines = rows.map(r => {
                const sign = r.Transaction_Type === 'Income' ? '📈 +' : '📉 -';
                const flag = r.fraud_status !== 'Safe' ? ' ⚠️' : '';
                const date = new Date(r.Transaction_DateTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                return `${sign}${fmt(r.Amount)} · ${r.cat} · ${date}${flag}`;
            });
            return {
                text: `🧾 Your last ${rows.length} transactions:\n\n${lines.join('\n')}`,
                suggestions: ['Monthly summary', 'Show expenses', 'Fraud alerts']
            };
        }

        case 'fraud_status': {
            const [flagged] = await db.query(
                `SELECT Amount, Transaction_DateTime, fraud_status, risk_score, Description
                 FROM \`TRANSACTION\`
                 WHERE User_ID=? AND fraud_status != 'Safe'
                 ORDER BY Transaction_DateTime DESC LIMIT 5`,
                [userId]
            );
            const [stats] = await db.query(
                `SELECT fraud_status, COUNT(*) as cnt FROM \`TRANSACTION\`
                 WHERE User_ID=? GROUP BY fraud_status`,
                [userId]
            );

            // 3. New: Check MongoDB for Simulated Fraud Alerts (Notifications)
            let activeNotifications = [];
            if (require('mongoose').connection.readyState === 1) {
                activeNotifications = await Notification.find({
                    user_id: parseInt(userId, 10),
                    alert_status: 'ACTIVE',
                    alert_type: { $in: ['FRAUD', 'WARNING'] }
                });
            }

            const counts = { Safe: 0, Suspicious: 0, Fraud: 0 };
            stats.forEach(s => { 
                const status = s.fraud_status === 'Safe' ? 'Safe' : (s.fraud_status === 'Fraud' ? 'Fraud' : 'Suspicious');
                counts[status] += s.cnt; 
            });

            // If we have simulation alerts, add them to the count (or prioritize them)
            const simFraudCount = activeNotifications.filter(n => n.alert_type === 'FRAUD').length;
            const simWarnCount = activeNotifications.filter(n => n.alert_type === 'WARNING').length;
            
            counts.Fraud += simFraudCount;
            counts.Suspicious += simWarnCount;

            if (!flagged.length && activeNotifications.length === 0) {
                return {
                    text: `✅ Great news! All your transactions look safe.\n\n🟢 Safe: ${counts.Safe} transactions\n🟡 Suspicious: 0\n🔴 Fraud: 0\n\nYour account is secure.`,
                    suggestions: ['Monthly summary', 'Show balance', 'Budget status']
                };
            }

            const simLines = activeNotifications.map(n => {
                const icon = n.alert_type === 'FRAUD' ? '🚨' : '⚠️';
                return `${icon} SYSTEM ALERT: ${n.message}`;
            });

            const lines = flagged.map(r => {
                const icon = r.fraud_status === 'Fraud' ? '🔴' : '🟡';
                return `${icon} ${fmt(r.Amount)} on ${new Date(r.Transaction_DateTime).toLocaleDateString('en-IN')} – ${r.fraud_status}`;
            });
            
            const combinedLines = [...simLines, ...lines];
            return {
                text: `⚠️ Security Status Update:\n🟢 Safe: ${counts.Safe} | 🟡 Suspicious: ${counts.Suspicious} | 🔴 Fraud: ${counts.Fraud}\n\nCritical Alerts found:\n${combinedLines.join('\n')}\n\n💡 ${counts.Fraud > 0 ? 'Please use the **SECURE ACCOUNT** button on your dashboard immediately.' : 'Please review these alerts in your Transactions page.'}`,
                suggestions: ['What should I do?', 'Show balance', 'Recent transactions']
            };
        }

        case 'fraud_advice':
            return {
                text: `🛡️ Here's how to protect your account:\n\n1. 🔍 Review flagged transactions immediately\n2. 🔑 Change your password if you see unauthorized activity\n3. 📞 Contact your bank for suspicious large transactions\n4. 🚫 Never share OTPs or passwords\n5. 📱 Enable transaction notifications\n\nWould you like me to check your recent fraud alerts?`,
                suggestions: ['Check fraud alerts', 'Show recent transactions', 'Show balance']
            };

        case 'budget': {
            const [rows] = await db.query(
                `SELECT c.Category_Name, b.Budget_Amount, COALESCE(SUM(t.Amount),0) as Spent
                 FROM BUDGET b JOIN CATEGORY c ON b.Category_ID=c.Category_ID
                 LEFT JOIN \`TRANSACTION\` t ON b.User_ID=t.User_ID AND b.Category_ID=t.Category_ID
                     AND DATE_FORMAT(t.Transaction_DateTime,'%Y-%m')=b.Month_Year AND t.Transaction_Type='Expense'
                 WHERE b.User_ID=? AND b.Month_Year=? GROUP BY b.Budget_ID`,
                [userId, month]
            );
            if (!rows.length) return { text: `No budgets set for ${monthLabel}. Create one in the Budget Manager!`, suggestions: ['Show expenses', 'Spending tips'] };
            const lines = rows.map(r => {
                const pct = Math.min(100, ((parseFloat(r.Spent) / parseFloat(r.Budget_Amount)) * 100)).toFixed(0);
                const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
                const icon = pct >= 90 ? '🔴' : pct >= 70 ? '🟡' : '🟢';
                return `${icon} ${r.Category_Name}\n   ${bar} ${pct}%  (${fmt(r.Spent)} / ${fmt(r.Budget_Amount)})`;
            });
            return { text: `🎯 Budget Status – ${monthLabel}:\n\n${lines.join('\n\n')}`, suggestions: ['Spending tips', 'Show expenses', 'Monthly summary'] };
        }

        case 'budget_tips': {
            const [rows] = await db.query(
                `SELECT COALESCE(c.Category_Name,'Uncategorized') as cat, SUM(t.Amount) as amt
                 FROM \`TRANSACTION\` t LEFT JOIN CATEGORY c ON t.Category_ID=c.Category_ID
                 WHERE t.User_ID=? AND t.Transaction_Type='Expense'
                 AND DATE_FORMAT(t.Transaction_DateTime,'%Y-%m')=?
                 GROUP BY cat ORDER BY amt DESC LIMIT 3`,
                [userId, month]
            );
            const [inc] = await db.query(`SELECT COALESCE(SUM(Amount),0) as t FROM \`TRANSACTION\` WHERE User_ID=? AND Transaction_Type='Income' AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`, [userId, month]);
            const [exp] = await db.query(`SELECT COALESCE(SUM(Amount),0) as t FROM \`TRANSACTION\` WHERE User_ID=? AND Transaction_Type='Expense' AND DATE_FORMAT(Transaction_DateTime,'%Y-%m')=?`, [userId, month]);
            const income = parseFloat(inc[0]?.t || 0);
            const expense = parseFloat(exp[0]?.t || 0);
            const ratio = income > 0 ? (expense / income) * 100 : 0;

            let tips = `💡 Personalized Financial Tips:\n\n`;
            if (ratio > 90) tips += `⚠️ You're spending ${ratio.toFixed(0)}% of your income. Try to keep it under 70%.\n\n`;
            else if (ratio > 70) tips += `🟡 You're spending ${ratio.toFixed(0)}% of your income. Good, but room to improve.\n\n`;
            else tips += `✅ Great! You're spending only ${ratio.toFixed(0)}% of your income.\n\n`;

            if (rows.length) {
                tips += `🔝 Top spending areas:\n`;
                rows.forEach((r, i) => {
                    const pct = income > 0 ? ((parseFloat(r.amt) / income) * 100).toFixed(0) : 0;
                    tips += `${i + 1}. ${r.cat}: ${fmt(r.amt)} (${pct}% of income)\n`;
                });
                tips += `\n💰 Tip: Try reducing your top category by 10% to save ${fmt(parseFloat(rows[0]?.amt || 0) * 0.1)} this month.`;
            }
            return { text: tips, suggestions: ['Show budget', 'Monthly summary', 'Savings goals'] };
        }

        case 'savings': {
            const [rows] = await db.query(
                `SELECT Goal_Title, Target_Amount, Current_Amount, Target_Date, Status
                 FROM SAVINGS WHERE User_ID=? AND Status='Active' ORDER BY Target_Date LIMIT 5`,
                [userId]
            );
            if (!rows.length) return { text: "You have no active savings goals. Start saving today! 🎯", suggestions: ['Spending tips', 'Monthly summary'] };
            const lines = rows.map(r => {
                const pct = ((parseFloat(r.Current_Amount) / parseFloat(r.Target_Amount)) * 100).toFixed(1);
                const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
                const due = r.Target_Date ? ` · Due: ${new Date(r.Target_Date).toLocaleDateString('en-IN')}` : '';
                return `🎯 ${r.Goal_Title}\n   ${bar} ${pct}%\n   ${fmt(r.Current_Amount)} / ${fmt(r.Target_Amount)}${due}`;
            });
            return { text: `🏆 Your Savings Goals:\n\n${lines.join('\n\n')}`, suggestions: ['Spending tips', 'Monthly summary', 'Budget status'] };
        }

        case 'emi': {
            const [rows] = await db.query(
                `SELECT e.EMI_Title, e.EMI_Amount, e.EMI_Day, e.Status, a.Account_Name, a.Balance
                 FROM EMI e JOIN ACCOUNT a ON e.Account_ID=a.Account_ID
                 WHERE e.User_ID=? AND e.Status='Active'`,
                [userId]
            );
            if (!rows.length) return { text: "You have no active EMIs. 👍", suggestions: ['Monthly summary', 'Show balance'] };
            const today = new Date().getDate();
            const lines = rows.map(r => {
                const due = r.EMI_Day >= today ? `due on ${r.EMI_Day}th` : `due next month on ${r.EMI_Day}th`;
                const warn = parseFloat(r.Balance) < parseFloat(r.EMI_Amount) ? ' ⚠️ Low balance!' : '';
                return `• ${r.EMI_Title}: ${fmt(r.EMI_Amount)} – ${due} from ${r.Account_Name}${warn}`;
            });
            return { text: `📅 Active EMIs:\n\n${lines.join('\n')}`, suggestions: ['Show balance', 'Monthly summary'] };
        }

        case 'add_expense':
            return { text: "To add an expense, go to the **Transactions** page and click **New Transaction**, then select **Expense** as the type. 💸\n\nWould you like me to show your current balance first?", suggestions: ['Show balance', 'Recent transactions'] };

        case 'add_income':
            return { text: "To add income, go to the **Transactions** page and click **New Transaction**, then select **Income** as the type. 💵\n\nWould you like to see your current balance?", suggestions: ['Show balance', 'Monthly summary'] };

        default:
            return {
                text: "I'm sorry, I didn't quite understand that. 🤔 Could you rephrase?\n\nHere are some things I can help with:",
                suggestions: ['Show my balance', 'Monthly summary', 'Fraud alerts', 'Budget status', 'Help']
            };
    }
}

// POST /api/chatbot/message
router.post('/message', async (req, res) => {
    const { user_id, message, context } = req.body;
    if (!user_id || !message?.trim()) {
        return res.status(400).json({ error: 'user_id and message are required' });
    }
    try {
        const intent = detectIntent(message.trim());
        const response = await handleIntent(intent, user_id, message, context || {});
        // Pass back context for next message
        const newContext = {
            last_intent: intent,
            last_month: /last month/i.test(message) ? (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })() : null
        };
        res.json({ intent, context: newContext, ...response });
    } catch (err) {
        console.error('[Chatbot]', err.message);
        res.status(500).json({ error: 'Chatbot error: ' + err.message });
    }
});

module.exports = router;
