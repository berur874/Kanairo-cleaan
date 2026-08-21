// src/utils/payments.jsx
import { supabase } from './supabaseClient.jsx';
import { deductInventory } from './storage.jsx';

function generateMpesaReceipt() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'KAN';
    for (let i = 0; i < 7; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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
 * Records an M-Pesa purchase as a transaction row in the database and
 * deducts the purchased quantity from inventory. Returns the saved
 * transaction (now async — callers need to await it).
 */
export async function recordTransaction({ material, quantity, amount }) {
    const receipt = generateMpesaReceipt();

    const { data, error } = await supabase
        .from('transactions')
        .insert({ id: receipt, material, quantity, amount })
        .select()
        .single();

    if (error) {
        console.error('Failed to record transaction:', error);
        throw error;
    }

    await deductInventory(material, quantity);

    return {
        id: data.id,
        material: data.material,
        quantity: Number(data.quantity),
        amount: Number(data.amount),
        date: new Date(data.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }),
    };
}

/** Fetch recent transactions, most recent first. */
export async function getTransactions(limit = 50) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to load transactions:', error);
        throw error;
    }

    return (data || []).map((t) => ({
        id: t.id,
        material: t.material,
        quantity: Number(t.quantity),
        amount: Number(t.amount),
        date: new Date(t.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }),
    }));
}