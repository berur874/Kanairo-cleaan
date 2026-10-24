// Session token handling and apiFetch(), for calls that need a logged-in user.
// AuthContext.jsx owns the login state and keeps the token here up to date.

const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'kanairo.session';

let currentToken = null;
let onSessionExpired = () => {};

export function readStoredToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

/** Sets the token used by apiFetch and remembers it for the next visit (null logs out). */
export function setSessionToken(token) {
    currentToken = token;
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        // Private windows can block storage; the session then lasts until the tab is closed.
    }
}

export function setSessionExpiredHandler(handler) {
    onSessionExpired = handler;
}

/**
 * fetch() against our server with the session token. Returns the parsed JSON body (or null for 204).
 * Throws an Error carrying the server's message and `status`, so forms can show what went wrong.
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
        if (res.status === 401 && currentToken) onSessionExpired();
        const err = new Error(data?.message || data?.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return data;
}

/** Where each kind of user lands after logging in. */
export const ROLE_HOME = { seller: '/sell', buyer: '/buy', hub_manager: '/hub' };

export const ROLE_LABELS = { seller: 'Seller', buyer: 'Buyer', hub_manager: 'Hub manager' };
