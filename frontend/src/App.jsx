import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Savings from './pages/Savings';
import Settings from './pages/Settings';
import Statement from './pages/Statement';
import EMI from './pages/EMI';
import Login from './pages/Login';
import Signup from './pages/Signup';
import BudgetManager from './pages/BudgetManager';
import AuditLog from './pages/AuditLog';
import SalaryManager from './pages/SalaryManager';
import Neo4jGraph from './pages/Neo4jGraph';
import AdminDashboard from './pages/admin/AdminDashboard';
import FraudSimulation from './pages/admin/FraudSimulation';
import ChatbotWidget from './components/ChatbotWidget';
import { Toaster } from 'react-hot-toast';

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  if (user.role === 'ADMIN' && requiredRole !== 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role !== 'ADMIN' && requiredRole === 'ADMIN') return <Navigate to="/" replace />;

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
      {/* Chatbot: USER only — widget self-guards via role check */}
      {user.role === 'USER' && <ChatbotWidget />}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155'
          }
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Signup />} />
        <Route path="/" element={<PrivateRoute requiredRole="USER"><Dashboard /></PrivateRoute>} />
        <Route path="/transactions" element={<PrivateRoute requiredRole="USER"><Transactions /></PrivateRoute>} />
        <Route path="/savings" element={<PrivateRoute requiredRole="USER"><Savings /></PrivateRoute>} />
        <Route path="/budget-manager" element={<PrivateRoute requiredRole="USER"><BudgetManager /></PrivateRoute>} />
        <Route path="/salary" element={<PrivateRoute requiredRole="USER"><SalaryManager /></PrivateRoute>} />
        <Route path="/audit" element={<PrivateRoute requiredRole="USER"><AuditLog /></PrivateRoute>} />
        <Route path="/emi" element={<PrivateRoute requiredRole="USER"><EMI /></PrivateRoute>} />
        <Route path="/neo4j" element={<PrivateRoute requiredRole="USER"><Neo4jGraph /></PrivateRoute>} />
        <Route path="/statement" element={<PrivateRoute requiredRole="USER"><Statement /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        
        {/* ADMIN — single shell; sections chosen via URL (sidebar), same as user dashboard layout */}
        <Route path="/admin/*" element={<PrivateRoute requiredRole="ADMIN"><AdminDashboard /></PrivateRoute>} />
        
        {/* Fraud Simulation Demo UI */}
        <Route path="/fraud-simulation" element={<PrivateRoute requiredRole="ADMIN"><FraudSimulation /></PrivateRoute>} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
