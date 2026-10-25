import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../auth/session.js';
import { AppPage } from '../components/AppPage.jsx';
import AccessibilityForm from '../components/AccessibilityForm.jsx';
import { showSuccessNotification } from '../utils/payments.jsx';

function DetailsForm() {
    const { user, updateProfile } = useAuth();
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.phone);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const updated = await updateProfile({ name, phone });
            setPhone(updated.phone);
            showSuccessNotification('Profile saved');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="auth-form profile-form" onSubmit={handleSubmit}>
            <label htmlFor="profile-name">Full name</label>
            <input id="profile-name" type="text" autoComplete="name" required maxLength={100}
                value={name} onChange={(e) => setName(e.target.value)} />

            <label htmlFor="profile-phone">Phone number</label>
            <input id="profile-phone" type="tel" autoComplete="tel" required
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="field-hint">You log in with this number, and M-Pesa payments use it too.</p>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn" disabled={saving || (name === user.name && phone === user.phone)}>
                {saving ? 'Saving…' : 'Save details'}
            </button>
        </form>
    );
}

function PasswordForm() {
    const { changePassword } = useAuth();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (next !== confirm) {
            setError('The new passwords do not match.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await changePassword(current, next);
            setCurrent('');
            setNext('');
            setConfirm('');
            showSuccessNotification('Password changed. You were logged out everywhere else.');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="auth-form profile-form" onSubmit={handleSubmit}>
            <label htmlFor="pw-current">Current password</label>
            <input id="pw-current" type="password" autoComplete="current-password" required
                value={current} onChange={(e) => setCurrent(e.target.value)} />

            <label htmlFor="pw-new">New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" required minLength={6}
                value={next} onChange={(e) => setNext(e.target.value)} />

            <label htmlFor="pw-confirm">Confirm new password</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Change password'}</button>
        </form>
    );
}

export default function Profile() {
    const { user } = useAuth();

    return (
        <AppPage title="My profile" eyebrow={ROLE_LABELS[user.role]}>
            <div className="profile-grid">
                <div className="dash-card profile-card">
                    <div className="dash-card-head"><h3>Your details</h3><span className="dash-card-tag">{ROLE_LABELS[user.role]}</span></div>
                    <DetailsForm />
                </div>
                <div className="dash-card profile-card">
                    <div className="dash-card-head"><h3>Password</h3></div>
                    <PasswordForm />
                </div>
            </div>
            <div className="dash-card profile-card">
                <div className="dash-card-head"><h3>Accessibility</h3><span className="dash-card-tag">AccessMap Nairobi</span></div>
                <p className="dash-card-note">
                    Do you have a disability or any accessibility needs? If you do, hubs are ranked by the places near them
                    that have the features you need.
                </p>
                <AccessibilityForm submitLabel="Save accessibility needs" onSaved={() => showSuccessNotification('Accessibility needs saved')} />
            </div>
        </AppPage>
    );
}
