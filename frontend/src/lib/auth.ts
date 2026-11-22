import { createContext, useContext } from 'react';

export interface User {
    id: number;
    name: string;
    email: string;
    permissions?: string[];
    roles?: { name: string }[];
    /** Must set a new password before using the app (new account, admin reset). */
    must_change_password?: boolean;
    unread_notifications?: number;
}

export interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    /** True if the signed-in user has the given Spatie permission (e.g. "edit tasks"). */
    can: (permission: string) => boolean;
    isAdmin: boolean;
    /** Replace the stored user (e.g. after a password change returns the fresh payload). */
    setCurrentUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

/** True if the signed-in user holds the permission. */
export function useCan(permission: string): boolean {
    return useAuth().can(permission);
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
