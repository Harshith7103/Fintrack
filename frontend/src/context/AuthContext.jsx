import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in (from localStorage)
        const savedUser = sessionStorage.getItem('fintrack_user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error("Failed to parse user data:", e);
                sessionStorage.removeItem('fintrack_user');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const userData = response.data.user;
            setUser(userData);
            sessionStorage.setItem('fintrack_user', JSON.stringify(userData));
            return { success: true, user: userData };
        } catch (error) {
            const d = error.response?.data;
            return {
                success: false,
                error: d?.message || d?.error || 'Login failed'
            };
        }
    };

    const demoAdminLogin = async () => {
        try {
            const response = await api.post('/auth/demo-admin');
            const userData = response.data.user;
            setUser(userData);
            sessionStorage.setItem('fintrack_user', JSON.stringify(userData));
            return { success: true, user: userData };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Admin Login failed'
            };
        }
    };

    const register = async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            const newUser = response.data;
            // After registration, automatically log them in
            setUser(newUser);
            sessionStorage.setItem('fintrack_user', JSON.stringify(newUser));
            return { success: true, user: newUser };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Registration failed'
            };
        }
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('fintrack_user');
    };

    const updateUser = (userData) => {
        setUser(userData);
        sessionStorage.setItem('fintrack_user', JSON.stringify(userData));
    };

    const value = {
        user,
        loading,
        login,
        demoAdminLogin,
        register,
        logout,
        updateUser,
        isAuthenticated: !!user
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
