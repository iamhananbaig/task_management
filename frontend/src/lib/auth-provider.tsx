import { useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { AuthContext, type User } from '@/lib/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

    // Refresh the user on load so permissions are always current
    // (also upgrades sessions stored before permissions were included).
    useEffect(() => {
        if (token) {
            api.get('/user')
                .then((res) => {
                    setUser(res.data);
                    localStorage.setItem('user', JSON.stringify(res.data));
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                });
        }
    }, [token]);

    const login = async (email: string, password: string) => {
        const res = await api.post('/login', { email, password, device_name: 'web' });
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = async () => {
        try {
            await api.post('/logout');
        } catch {
            // ignore
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    const can = (permission: string) => !!user?.permissions?.includes(permission);
    const isAdmin = !!user?.roles?.some((r) => r.name === 'admin');
    const setCurrentUser = (next: User) => {
        setUser(next);
        localStorage.setItem('user', JSON.stringify(next));
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, can, isAdmin, setCurrentUser }}>
            {children}
        </AuthContext.Provider>
    );
}
