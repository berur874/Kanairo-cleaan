// Logged-in user state for the whole app.
// Talks to the server's auth contract (server/auth.js): /auth/register, /auth/login, /auth/logout,
// /auth/me and /auth/me/accessibility. If login is reimplemented, keep that contract and this file
// plus session.js are the only client code that needs to change.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, readStoredToken, setSessionToken, setSessionExpiredHandler } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    // True after a deliberate logout, so the next login starts at that user's own home page
    // instead of "returning" to the page the previous user was on.
    const [loggedOut, setLoggedOut] = useState(false);
    // While a stored token is being checked we do not know yet whether anyone is logged in.
    const [checking, setChecking] = useState(() => Boolean(readStoredToken()));

    const startSession = useCallback(({ token, user: u }) => {
        setSessionToken(token);
        setLoggedOut(false);
        setUser(u);
        return u;
    }, []);

    const endSession = useCallback(() => {
        setSessionToken(null);
        setUser(null);
    }, []);

    useEffect(() => {
        setSessionExpiredHandler(endSession);
        const stored = readStoredToken();
        if (!stored) return;

        setSessionToken(stored);
        apiFetch('/auth/me')
            .then(setUser)
            .catch(endSession)
            .finally(() => setChecking(false));
    }, [endSession]);

    const value = {
        user,
        checking,
        loggedOut,
        register: async (details) => startSession(await apiFetch('/auth/register', { method: 'POST', body: details })),
        login: async (phone, password) => startSession(await apiFetch('/auth/login', { method: 'POST', body: { phone, password } })),
        logout: async () => {
            try {
                await apiFetch('/auth/logout', { method: 'POST' });
            } finally {
                setLoggedOut(true);
                endSession();
            }
        },
        saveAccessibility: async (needs) => {
            const updated = await apiFetch('/auth/me/accessibility', { method: 'PUT', body: { needs } });
            setUser(updated);
            return updated;
        },
        updateProfile: async (changes) => {
            const updated = await apiFetch('/auth/me', { method: 'PATCH', body: changes });
            setUser(updated);
            return updated;
        },
        changePassword: (currentPassword, newPassword) =>
            apiFetch('/auth/me/password', {
                method: 'PUT',
                body: { current_password: currentPassword, new_password: newPassword },
            }),
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}
