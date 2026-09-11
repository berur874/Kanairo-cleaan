// src/utils/payments.jsx

const API_URL = import.meta.env.VITE_API_URL;

/** Aggregate revenue/weight/transaction-count totals plus a 7-day breakdown. */
export async function getDashboardSummary() {
    const res = await fetch(`${API_URL}/dashboard/summary`);
    if (!res.ok) throw new Error(`Failed to load dashboard summary: ${res.status}`);
    return res.json();
}

export function showSuccessNotification(message = 'Transaction complete') {
    let container = document.getElementById('mpesa-alert-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'mpesa-alert-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '84px',
            right: '20px',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
        });
        document.body.appendChild(container);
    }

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#0b180b',
        border: '1px solid rgba(34,197,94,.3)',
        borderLeft: '3px solid #22c55e',
        color: '#e2f0e2',
        fontFamily: "'Inter', sans-serif",
        padding: '14px 22px',
        borderRadius: '2px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
        fontSize: '0.85rem',
        fontWeight: '600',
        opacity: '0',
        transform: 'translateY(-12px)',
        transition: 'all 0.3s ease',
        maxWidth: '320px',
    });
    box.textContent = message;
    container.appendChild(box);

    requestAnimationFrame(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(-10px)';
        setTimeout(() => box.remove(), 300);
    }, 4500);
}

/**
 * Records an M-Pesa purchase as a transaction row in the database (the
 * server also deducts the purchased quantity from inventory). Returns the
 * saved transaction.
 */
export async function recordTransaction({ material, quantity, amount }) {
    const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material, quantity, amount }),
    });
    if (!res.ok) throw new Error(`Failed to record transaction: ${res.status}`);
    const data = await res.json();

    return {
        id: data.id,
        material: data.material,
        quantity: Number(data.quantity),
        amount: Number(data.amount),
        date: new Date(data.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }),
    };
}

/**
 * Fires once with the current transactions snapshot (no polling/live push —
 * this is a one-shot read from the DB). Returns a no-op unsubscribe for
 * call-site compatibility.
 */
export function onTransactionsChange(callback, limit = 50) {
    getTransactions(limit).then(callback).catch((err) => console.error('Failed to refresh transactions:', err));
    return () => {};
}

/** Fetch recent transactions, most recent first. */
export async function getTransactions(limit = 50) {
    const res = await fetch(`${API_URL}/transactions?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to load transactions: ${res.status}`);
    const rows = await res.json();

    return rows.map((t) => ({
        id: t.id,
        material: t.material,
        quantity: Number(t.quantity),
        amount: Number(t.amount),
        date: new Date(t.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }),
    }));
}