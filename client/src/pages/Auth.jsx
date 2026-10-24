import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_HOME } from '../auth/session.js';
import { getHotspotShowcase } from '../utils/marketData.jsx';

const ROLE_CHOICES = [
    { role: 'seller', title: 'I collect scrap', body: 'Log what you have collected, get matched to the best hub and get paid on M-Pesa.' },
    { role: 'buyer', title: 'I buy materials', body: 'Find hubs that have the material you need in stock and order it.' },
    { role: 'hub_manager', title: 'I run a hub', body: 'Weigh incoming scrap, pay sellers and hand orders over to buyers.' },
];

function AuthCard({ title, subtitle, children, footer }) {
    return (
        <main className="auth-page">
            <div className="auth-card">
                <h1>{title}</h1>
                {subtitle && <p className="auth-sub">{subtitle}</p>}
                {children}
                {footer && <p className="auth-footer">{footer}</p>}
            </div>
        </main>
    );
}

// Already logged in? Go straight to the app instead of showing the form again.
function useRedirectIfLoggedIn() {
    const { user } = useAuth();
    const location = useLocation();
    if (!user) return null;
    if (user.accessibility_needs === null) return '/onboarding';
    return location.state?.from || ROLE_HOME[user.role];
}

export function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const redirect = useRedirectIfLoggedIn();

    if (redirect) return <Navigate to={redirect} replace />;

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const user = await login(phone, password);
            const next = user.accessibility_needs === null ? '/onboarding' : location.state?.from || ROLE_HOME[user.role];
            navigate(next, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthCard
            title="Log in"
            subtitle="Welcome back to the Nairobi waste exchange."
            footer={<>New here? <Link to="/signup">Create an account</Link></>}
        >
            <form className="auth-form" onSubmit={handleSubmit}>
                <label htmlFor="login-phone">Phone number</label>
                <input id="login-phone" type="tel" autoComplete="tel" required placeholder="0712 345 678"
                    value={phone} onChange={(e) => setPhone(e.target.value)} />

                <label htmlFor="login-password">Password</label>
                <input id="login-password" type="password" autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)} />

                {error && <p className="form-error" role="alert">{error}</p>}
                <button type="submit" className="btn" disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</button>
            </form>
        </AuthCard>
    );
}

export function Signup() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [role, setRole] = useState('seller');
    const [fields, setFields] = useState({ name: '', phone: '', password: '', hotspot_id: '' });
    const [hubs, setHubs] = useState([]);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const redirect = useRedirectIfLoggedIn();

    useEffect(() => {
        let alive = true;
        getHotspotShowcase()
            .then((hs) => { if (alive) setHubs(hs.filter((h) => h.active)); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    if (redirect) return <Navigate to={redirect} replace />;

    const set = (key) => (e) => setFields({ ...fields, [key]: e.target.value });

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await register({
                name: fields.name,
                phone: fields.phone,
                password: fields.password,
                role,
                hotspot_id: role === 'hub_manager' ? Number(fields.hotspot_id) : undefined,
            });
            navigate('/onboarding', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthCard
            title="Create your account"
            subtitle="Choose how you use Kanairo. You can only have one role per phone number."
            footer={<>Already have an account? <Link to="/login">Log in</Link></>}
        >
            <form className="auth-form" onSubmit={handleSubmit}>
                <fieldset className="role-choice">
                    <legend>I am…</legend>
                    {ROLE_CHOICES.map((c) => (
                        <label key={c.role} className={`role-option${role === c.role ? ' selected' : ''}`}>
                            <input type="radio" name="role" value={c.role} checked={role === c.role}
                                onChange={() => setRole(c.role)} />
                            <span className="role-title">{c.title}</span>
                            <span className="role-body">{c.body}</span>
                        </label>
                    ))}
                </fieldset>

                {role === 'hub_manager' && (
                    <>
                        <label htmlFor="signup-hub">Which hub do you run?</label>
                        <select id="signup-hub" required value={fields.hotspot_id} onChange={set('hotspot_id')}>
                            <option value="" disabled>Choose a hub…</option>
                            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                    </>
                )}

                <label htmlFor="signup-name">Full name</label>
                <input id="signup-name" type="text" autoComplete="name" required maxLength={100}
                    value={fields.name} onChange={set('name')} />

                <label htmlFor="signup-phone">Phone number (M-Pesa)</label>
                <input id="signup-phone" type="tel" autoComplete="tel" required placeholder="0712 345 678"
                    value={fields.phone} onChange={set('phone')} />

                <label htmlFor="signup-password">Password</label>
                <input id="signup-password" type="password" autoComplete="new-password" required minLength={6}
                    value={fields.password} onChange={set('password')} />

                {error && <p className="form-error" role="alert">{error}</p>}
                <button type="submit" className="btn" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
            </form>
        </AuthCard>
    );
}
