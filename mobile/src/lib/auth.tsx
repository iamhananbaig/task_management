import * as React from 'react';
import * as Device from 'expo-device';

import { api, configureApi, DEFAULT_SERVER } from '@/lib/api';
import { registerForPush } from '@/lib/push';
import { Keys, storage } from '@/lib/storage';

export interface User {
  id: number;
  name: string;
  email: string;
  roles: { name: string }[];
  permissions: string[];
  must_change_password: boolean;
  unread_notifications?: number;
}

type AuthState = {
  ready: boolean;
  server: string;
  user: User | null;
  signedIn: boolean;
  signIn: (server: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  can: (permission: string) => boolean;
};

const AuthContext = React.createContext<AuthState | null>(null);

/**
 * Sign-in state, kept in the phone's secure storage. On start the stored token is used at once
 * (works offline) and the user is refreshed from /user in the background.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [server, setServer] = React.useState(DEFAULT_SERVER);
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUserState] = React.useState<User | null>(null);

  const clear = React.useCallback(async () => {
    await Promise.all([storage.remove(Keys.token), storage.remove(Keys.user), storage.remove(Keys.pushToken)]);
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = React.useCallback((next: User) => {
    setUserState(next);
    void storage.set(Keys.user, JSON.stringify(next));
  }, []);

  // Load the saved session
  React.useEffect(() => {
    (async () => {
      const [savedServer, savedToken, savedUser] = await Promise.all([storage.get(Keys.server), storage.get(Keys.token), storage.get(Keys.user)]);
      const base = savedServer || DEFAULT_SERVER;
      setServer(base);
      configureApi(base, savedToken, () => void clear());
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUserState(JSON.parse(savedUser) as User);
        api.get<User>('/user').then((res) => setUser(res.data)).catch(() => undefined);
        void registerForPush();
      }
      setReady(true);
    })();
  }, [clear, setUser]);

  const signIn = React.useCallback(
    async (nextServer: string, email: string, password: string) => {
      const base = nextServer.trim().replace(/\/+$/, '') || DEFAULT_SERVER;
      configureApi(base, null, () => void clear());
      const res = await api.post<{ token: string; user: User }>('/login', {
        email: email.trim(),
        password,
        device_name: Device.deviceName ?? Device.modelName ?? 'Phone',
      });
      await Promise.all([storage.set(Keys.server, base), storage.set(Keys.token, res.data.token), storage.set(Keys.user, JSON.stringify(res.data.user))]);
      configureApi(base, res.data.token, () => void clear());
      setServer(base);
      setToken(res.data.token);
      setUserState(res.data.user);
      void registerForPush();
    },
    [clear]
  );

  const signOut = React.useCallback(async () => {
    const pushToken = await storage.get(Keys.pushToken);
    try {
      await api.post('/logout', { push_token: pushToken });
    } catch {
      // signed out locally either way
    }
    await clear();
    configureApi(server, null, () => void clear());
  }, [clear, server]);

  const refreshUser = React.useCallback(async () => {
    const res = await api.get<User>('/user');
    setUser(res.data);
  }, [setUser]);

  const value = React.useMemo<AuthState>(
    () => ({
      ready,
      server,
      user,
      signedIn: !!token && !!user,
      signIn,
      signOut,
      setUser,
      refreshUser,
      can: (permission: string) => !!user?.permissions.includes(permission),
    }),
    [ready, server, user, token, signIn, signOut, setUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
