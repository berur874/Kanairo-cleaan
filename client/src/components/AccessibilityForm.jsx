// The accessibility question: asked once at onboarding and editable on the profile page.
// The answer decides whether hub recommendations are ranked by accessible AccessMap venues.
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ACCESSIBILITY_FEATURES } from '../utils/payments.jsx';

export default function AccessibilityForm({ submitLabel = 'Save', onSaved }) {
    const { user, saveAccessibility } = useAuth();
    const existing = user.accessibility_needs;
    const [hasNeeds, setHasNeeds] = useState(existing ? existing.length > 0 : null);
    const [needs, setNeeds] = useState(() => new Set(existing || []));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function toggle(key) {
        const next = new Set(needs);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setNeeds(next);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (hasNeeds && needs.size === 0) {
            setError('Choose at least one feature you need, or answer No.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const updated = await saveAccessibility(hasNeeds ? [...needs] : []);
            onSaved?.(updated);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="yes-no" role="radiogroup" aria-label="Accessibility needs">
                <button type="button" role="radio" aria-checked={hasNeeds === true}
                    className={`choice${hasNeeds === true ? ' selected' : ''}`} onClick={() => setHasNeeds(true)}>
                    Yes
                </button>
                <button type="button" role="radio" aria-checked={hasNeeds === false}
                    className={`choice${hasNeeds === false ? ' selected' : ''}`} onClick={() => setHasNeeds(false)}>
                    No
                </button>
            </div>

            {hasNeeds && (
                <fieldset className="feature-picker">
                    <legend>Which of these do you need at a meeting place?</legend>
                    {ACCESSIBILITY_FEATURES.map(([key, label]) => (
                        <label key={key} className={needs.has(key) ? 'selected' : ''}>
                            <input type="checkbox" checked={needs.has(key)} onChange={() => toggle(key)} />
                            {label}
                        </label>
                    ))}
                </fieldset>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn" disabled={hasNeeds === null || saving}>
                {saving ? 'Saving…' : submitLabel}
            </button>
        </form>
    );
}
