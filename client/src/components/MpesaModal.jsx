import { useState } from 'react';

/**
 * Simulated M-Pesa STK prompt. Used when a buyer pays a hub and when a hub pays a seller.
 * onConfirm() may be async; while it runs the button is disabled, and a thrown error is shown.
 */
export default function MpesaModal({ title = 'M-Pesa', summary, amountKes, defaultPhone = '', confirmLabel = 'Confirm PIN', onConfirm, onClose }) {
    const [phone, setPhone] = useState(defaultPhone);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await onConfirm({ phone });
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <div className="mpesa-backdrop" role="dialog" aria-modal="true" aria-labelledby="mpesa-title">
            <div className="mpesa-modal">
                <h2 id="mpesa-title">{title}</h2>
                <p className="mpesa-summary">{summary}</p>
                <p className="mpesa-amount">KES {Math.round(amountKes).toLocaleString()}</p>

                <form onSubmit={handleSubmit}>
                    <label htmlFor="mpesa-phone">Phone number</label>
                    <input id="mpesa-phone" type="tel" required pattern="0[17][0-9]{8}" placeholder="0712345678"
                        value={phone} onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))} />

                    <label htmlFor="mpesa-pin">M-Pesa PIN</label>
                    <input id="mpesa-pin" type="password" inputMode="numeric" required maxLength={4} pattern="[0-9]{4}"
                        placeholder="4-digit PIN" value={pin} onChange={(e) => setPin(e.target.value)} />

                    {error && <p className="form-error" role="alert">{error}</p>}
                    <div className="mpesa-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                        <button type="submit" className="btn" disabled={busy}>{busy ? 'Processing…' : confirmLabel}</button>
                    </div>
                    <p className="mpesa-note">Simulator: no real money moves and the PIN is not stored.</p>
                </form>
            </div>
        </div>
    );
}
