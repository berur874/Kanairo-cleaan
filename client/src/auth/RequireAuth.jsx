import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { ROLE_HOME } from './session.js';

/**
 * Guards an in-app page:
 * - logged out → /login (and back here afterwards)
 * - accessibility question not answered yet → /onboarding
 * - another role's page → that user's own home
 */
export default function RequireAuth({ roles, children }) {
    const { user, checking, loggedOut } = useAuth();
    const location = useLocation();

    if (checking) return <p className="app-loading">Loading…</p>;
    if (!user) return <Navigate to="/login" replace state={loggedOut ? undefined : { from: `${location.pathname}${location.search}` }} />;
    if (user.accessibility_needs === null) return <Navigate to="/onboarding" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;

    return children;
}
