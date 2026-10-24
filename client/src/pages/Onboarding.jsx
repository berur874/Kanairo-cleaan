import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_HOME } from '../auth/session.js';
import AccessibilityForm from '../components/AccessibilityForm.jsx';

// Asked once, straight after signing up. Later changes happen on the profile page.
export default function Onboarding() {
    const { user, checking } = useAuth();
    const navigate = useNavigate();
    // Decided when the page opens, so saving the answer here doesn't bounce the user to /profile.
    const [answeredBefore] = useState(() => Boolean(user && user.accessibility_needs !== null));

    if (checking) return <p className="app-loading">Loading…</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (answeredBefore) return <Navigate to="/profile" replace />;

    const otherSide = user.role === 'buyer' ? 'sellers' : 'buyers';

    return (
        <main className="auth-page">
            <div className="auth-card auth-card-wide">
                <span className="eyebrow">Step 2 of 2 · Accessibility</span>
                <h1>Do you have a disability or any accessibility needs?</h1>
                <p className="auth-sub">
                    If you do, we recommend hubs near places that have the features you need, using the
                    AccessMap Nairobi directory, so meeting {otherSide} is easier for you. You can change this
                    at any time on your profile.
                </p>
                <AccessibilityForm submitLabel="Continue" onSaved={() => navigate(ROLE_HOME[user.role], { replace: true })} />
            </div>
        </main>
    );
}
