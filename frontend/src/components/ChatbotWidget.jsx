import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    MessageCircle, X, Send, Bot, User, Minimize2,
    Sparkles, RefreshCw, ChevronDown
} from 'lucide-react';
import { sendChatMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Welcome message ──────────────────────────────────────────
const WELCOME = {
    id: 'welcome',
    role: 'bot',
    text: "Hello! I'm **FinTrack AI**, your personal financial assistant. 👋\n\nI can help you with account insights, spending analysis, fraud alerts, budget tips, and more.",
    suggestions: ['Show my balance', 'Monthly summary', 'Fraud alerts', 'Budget status'],
    timestamp: new Date(),
};

// ── Render text with basic markdown (bold, newlines) ─────────
function RenderText({ text }) {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <span>
            {parts.map((p, i) =>
                p.startsWith('**') && p.endsWith('**')
                    ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
                    : p.split('\n').map((line, j, arr) => (
                        <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
                    ))
            )}
        </span>
    );
}

// ── Timestamp formatter ──────────────────────────────────────
function TimeStamp({ date }) {
    const d = date instanceof Date ? date : new Date(date);
    return (
        <span className="text-[10px] text-slate-500 mt-1 select-none">
            {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
    );
}

// ── Typing indicator ─────────────────────────────────────────
function TypingIndicator() {
    return (
        <div className="flex items-end gap-2 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map(delay => (
                        <span key={delay} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Info cards (for help intent) ─────────────────────────────
function InfoCards({ cards }) {
    if (!cards?.length) return null;
    return (
        <div className="grid grid-cols-2 gap-2 mt-2">
            {cards.map((c, i) => (
                <div key={i} className="bg-violet-50 border border-violet-100 rounded-xl p-2.5">
                    <div className="text-lg mb-1">{c.icon}</div>
                    <div className="text-xs font-semibold text-violet-700 mb-1">{c.title}</div>
                    <ul className="space-y-0.5">
                        {c.items.map((item, j) => (
                            <li key={j} className="text-[10px] text-slate-500">• {item}</li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

// ── Single message bubble ────────────────────────────────────
function MessageBubble({ msg, onSuggestion }) {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                isUser
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                    : 'bg-gradient-to-br from-violet-600 to-indigo-600'
            }`}>
                {isUser
                    ? <User className="w-4 h-4 text-white" />
                    : <Bot className="w-4 h-4 text-white" />
                }
            </div>

            {/* Bubble + meta */}
            <div className={`flex flex-col max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    isUser
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                }`}>
                    <RenderText text={msg.text} />
                    {msg.cards && <InfoCards cards={msg.cards} />}
                </div>

                {/* Suggestions */}
                {!isUser && msg.suggestions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.suggestions.map((s, i) => (
                            <button key={i} onClick={() => onSuggestion(s)}
                                className="text-xs px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-full transition-all hover:shadow-sm font-medium">
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <TimeStamp date={msg.timestamp} />
            </div>
        </div>
    );
}

// ── Main widget ──────────────────────────────────────────────
export default function ChatbotWidget() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [messages, setMessages] = useState([WELCOME]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState({});
    const [unread, setUnread] = useState(0);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Only show for USER role
    if (!user || user.role === 'ADMIN') return null;

    const scrollToBottom = useCallback(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (open && !minimized) {
            scrollToBottom();
            setUnread(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open, minimized, messages]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    };

    const sendMessage = async (text) => {
        if (!text.trim() || !user || loading) return;
        const userId = user.User_ID || user.id;

        const userMsg = { id: Date.now(), role: 'user', text: text.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const data = await sendChatMessage(userId, text.trim(), context);
            const botMsg = {
                id: Date.now() + 1,
                role: 'bot',
                text: data.text,
                suggestions: data.suggestions || [],
                cards: data.cards || null,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
            if (data.context) setContext(data.context);
            if (!open || minimized) setUnread(u => u + 1);
        } catch {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'bot',
                text: "I'm sorry, I encountered an error. Please try again. 🙏",
                suggestions: ['Show balance', 'Help'],
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const resetChat = () => {
        setMessages([{ ...WELCOME, timestamp: new Date() }]);
        setContext({});
        setUnread(0);
    };

    const toggleOpen = () => {
        setOpen(o => !o);
        setMinimized(false);
        setUnread(0);
    };

    return (
        <>
            {/* ── Inline styles for animations ── */}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes pulse-ring {
                    0%   { transform: scale(1);    opacity: 0.6; }
                    100% { transform: scale(1.5);  opacity: 0; }
                }
                .animate-slide-up  { animation: slideUp 0.25s ease-out both; }
                .animate-fade-in   { animation: fadeIn 0.2s ease-out both; }
                .chat-panel        { animation: slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
                .pulse-ring::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 9999px;
                    background: rgba(139,92,246,0.4);
                    animation: pulse-ring 1.5s ease-out infinite;
                }
                .chat-scroll::-webkit-scrollbar { width: 4px; }
                .chat-scroll::-webkit-scrollbar-track { background: transparent; }
                .chat-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
            `}</style>

            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

                {/* ── Chat Panel ── */}
                {open && (
                    <div className={`chat-panel flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 ${minimized ? 'h-14' : ''}`}
                        style={{ width: '380px', height: minimized ? '56px' : '580px' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="relative w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-indigo-600"></span>
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm leading-none">FinTrack AI</p>
                                    <p className="text-white/70 text-[10px] mt-0.5">
                                        {loading ? '● Typing...' : '● Online'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={resetChat} title="New chat"
                                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button onClick={() => setMinimized(m => !m)} title="Minimize"
                                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                    <Minimize2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setOpen(false)} title="Close"
                                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {!minimized && (
                            <>
                                {/* Messages area */}
                                <div ref={scrollRef} onScroll={handleScroll}
                                    className="chat-scroll flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
                                    {messages.map(msg => (
                                        <MessageBubble key={msg.id} msg={msg} onSuggestion={sendMessage} />
                                    ))}
                                    {loading && <TypingIndicator />}
                                    <div ref={bottomRef} />
                                </div>

                                {/* Scroll to bottom button */}
                                {showScrollBtn && (
                                    <button onClick={scrollToBottom}
                                        className="absolute bottom-20 right-8 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:text-violet-600 transition-colors animate-fade-in">
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Divider */}
                                <div className="h-px bg-slate-200 flex-shrink-0" />

                                {/* Input area */}
                                <div className="px-3 py-3 bg-white flex-shrink-0">
                                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ask about your finances..."
                                            disabled={loading}
                                            className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all disabled:opacity-60"
                                        />
                                        <button type="submit"
                                            disabled={loading || !input.trim()}
                                            className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all hover:shadow-md hover:shadow-violet-200 flex-shrink-0">
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                    <p className="text-[10px] text-slate-400 text-center mt-2">
                                        FinTrack AI · Your data is private & secure 🔒
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── FAB Toggle Button ── */}
                <div className="relative">
                    {/* Pulse ring when closed */}
                    {!open && <div className="pulse-ring absolute inset-0 rounded-full" />}

                    <button onClick={toggleOpen}
                        className="relative w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-full shadow-lg shadow-violet-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95">
                        {open
                            ? <X className="w-6 h-6" />
                            : <MessageCircle className="w-6 h-6" />
                        }
                        {/* Unread badge */}
                        {!open && unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                                {unread}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
