// The hub manager's two work queues: scrap coming in from sellers (weigh it, pay the seller)
// and paid orders going out to buyers (hand them over).
import { useEffect, useState } from 'react';
import MpesaModal from './MpesaModal.jsx';
import { StatusChip } from './AppPage.jsx';
import { getMaterials } from '../utils/marketData.jsx';
import { showSuccessNotification } from '../utils/payments.jsx';
import {
    getHubDropOffs, receiveDropOff, getHubOrders, collectOrder, formatKes, formatKg, formatDate,
} from '../utils/trade.jsx';

function QueueTabs({ tabs, value, onChange }) {
    return (
        <div className="queue-tabs" role="tablist">
            {tabs.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={value === key}
                    className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
                    {label}
                </button>
            ))}
        </div>
    );
}

// Loads one tab of a queue, and reloads when `reloadKey` changes.
function useQueue(load, status, reloadKey) {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        load(status)
            .then((r) => { if (alive) setRows(r); })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, [load, status, reloadKey]);
    return { rows, error };
}

function WeighForm({ drop, materials, onPay, onCancel }) {
    // Group 1 drop-offs only say "plastic"; the manager picks which plastic it actually is.
    const options = materials.filter((m) => m.type === drop.material_type);
    const [kg, setKg] = useState(String(drop.quantity_kg));
    const [materialId, setMaterialId] = useState(drop.material?.id || '');
    const material = materials.find((m) => m.id === materialId);

    return (
        <form className="weigh-form" onSubmit={(e) => { e.preventDefault(); onPay({ receivedKg: Number(kg), material }); }}>
            {!drop.material && (
                <div className="dash-form-field">
                    <label htmlFor={`weigh-mat-${drop.drop_off_id}`}>Which {drop.material_type}?</label>
                    <select id={`weigh-mat-${drop.drop_off_id}`} required value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                        <option value="" disabled>Choose…</option>
                        {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
            )}
            <div className="dash-form-field">
                <label htmlFor={`weigh-kg-${drop.drop_off_id}`}>Weight on your scale (kg)</label>
                <input id={`weigh-kg-${drop.drop_off_id}`} type="number" min="0.01" max="10000" step="0.01" required
                    value={kg} onChange={(e) => setKg(e.target.value)} />
            </div>
            <div className="weigh-total">
                {material && Number(kg) > 0 ? <>Pay <strong>{formatKes(Number(kg) * material.price)}</strong></> : '—'}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-sm" disabled={!material}>Pay seller</button>
        </form>
    );
}

export function IncomingDropOffs({ onChange }) {
    const [status, setStatus] = useState('pending');
    const [reloadKey, setReloadKey] = useState(0);
    const { rows, error } = useQueue(getHubDropOffs, status, reloadKey);
    const [materials, setMaterials] = useState([]);
    const [weighing, setWeighing] = useState(null);
    const [paying, setPaying] = useState(null);

    useEffect(() => {
        getMaterials().then(setMaterials).catch(() => {});
    }, []);

    async function pay() {
        const saved = await receiveDropOff(paying.drop.drop_off_id, {
            receivedKg: paying.receivedKg,
            materialId: paying.material.id,
        });
        const who = saved.seller?.name || saved.source;
        showSuccessNotification(`Paid ${formatKes(saved.payout_kes)} to ${who} for ${formatKg(saved.received_kg)}`);
        setPaying(null);
        setWeighing(null);
        setReloadKey((k) => k + 1);
        onChange?.();
    }

    return (
        <div className="dash-card">
            <div className="dash-card-head">
                <h3>Incoming scrap</h3>
                <span className="dash-card-tag">Sellers → your hub</span>
            </div>
            <p className="dash-card-note">Weigh each drop-off when the seller arrives, then pay them on M-Pesa. Drop-offs from our partner Group 1 appear here too.</p>
            <QueueTabs tabs={[['pending', 'Waiting'], ['received', 'Paid']]} value={status} onChange={(s) => { setStatus(s); setWeighing(null); }} />

            {error ? <p className="form-error">{error}</p>
                : rows === null ? <p className="muted-note">Loading…</p>
                : rows.length === 0 ? <p className="muted-note">{status === 'pending' ? 'No scrap waiting to be weighed.' : 'Nothing paid out yet.'}</p>
                : (
                    <ul className="queue-list">
                        {rows.map((d) => (
                            <li key={d.drop_off_id} className="queue-item">
                                <div className="queue-main">
                                    <div>
                                        <span className="mono">{d.drop_off_id}</span> · <span className="cell-sub">{formatDate(d.created_at)}</span>
                                        <p className="queue-title">
                                            {formatKg(d.received_kg ?? d.quantity_kg)} of {d.material?.name || d.material_type}
                                        </p>
                                        <p className="cell-sub">
                                            {d.seller ? `${d.seller.name} · ${d.seller.phone}` : `Group 1 · ${d.source}`}
                                            {d.notes && ` · “${d.notes}”`}
                                        </p>
                                    </div>
                                    <div className="queue-side">
                                        {d.status === 'received'
                                            ? <><StatusChip status="received" /><span className="queue-amount">{formatKes(d.payout_kes)}</span></>
                                            : weighing !== d.drop_off_id && (
                                                <button type="button" className="btn btn-sm" onClick={() => setWeighing(d.drop_off_id)}>Weigh &amp; pay</button>
                                            )}
                                    </div>
                                </div>
                                {weighing === d.drop_off_id && (
                                    <WeighForm drop={d} materials={materials}
                                        onCancel={() => setWeighing(null)}
                                        onPay={({ receivedKg, material }) => setPaying({ drop: d, receivedKg, material })} />
                                )}
                            </li>
                        ))}
                    </ul>
                )}

            {paying && (
                <MpesaModal
                    title="Pay the seller"
                    summary={`${formatKg(paying.receivedKg)} of ${paying.material.name} from ${paying.drop.seller?.name || paying.drop.source}`}
                    amountKes={paying.receivedKg * paying.material.price}
                    defaultPhone={paying.drop.seller?.phone || ''}
                    confirmLabel="Send payment"
                    onConfirm={pay}
                    onClose={() => setPaying(null)}
                />
            )}
        </div>
    );
}

export function HandOverOrders({ onChange }) {
    const [status, setStatus] = useState('paid');
    const [reloadKey, setReloadKey] = useState(0);
    const { rows, error } = useQueue(getHubOrders, status, reloadKey);
    const [busy, setBusy] = useState(null);
    const [actionError, setActionError] = useState('');

    async function handOver(order) {
        setBusy(order.id);
        setActionError('');
        try {
            await collectOrder(order.id);
            showSuccessNotification(`Order ${order.id} handed over to ${order.buyer?.name || 'the buyer'}`);
            setReloadKey((k) => k + 1);
            onChange?.();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="dash-card">
            <div className="dash-card-head">
                <h3>Orders to hand over</h3>
                <span className="dash-card-tag">Your hub → buyers</span>
            </div>
            <p className="dash-card-note">Buyers have already paid. Check the receipt number they show you, then hand the material over.</p>
            <QueueTabs tabs={[['paid', 'To hand over'], ['collected', 'Collected']]} value={status} onChange={setStatus} />
            {actionError && <p className="form-error" role="alert">{actionError}</p>}

            {error ? <p className="form-error">{error}</p>
                : rows === null ? <p className="muted-note">Loading…</p>
                : rows.length === 0 ? <p className="muted-note">{status === 'paid' ? 'No orders waiting.' : 'No orders collected yet.'}</p>
                : (
                    <ul className="queue-list">
                        {rows.map((o) => (
                            <li key={o.id} className="queue-item">
                                <div className="queue-main">
                                    <div>
                                        <span className="mono">{o.id}</span> · <span className="cell-sub">{formatDate(o.created_at)}</span>
                                        <p className="queue-title">{formatKg(o.quantity_kg)} of {o.material.name}</p>
                                        <p className="cell-sub">{o.buyer ? `${o.buyer.name} · ${o.buyer.phone}` : 'Walk-in buyer'} · paid {formatKes(o.amount_kes)}</p>
                                    </div>
                                    <div className="queue-side">
                                        {o.status === 'collected'
                                            ? <StatusChip status="collected" />
                                            : (
                                                <button type="button" className="btn btn-sm" disabled={busy === o.id} onClick={() => handOver(o)}>
                                                    {busy === o.id ? 'Saving…' : 'Hand over'}
                                                </button>
                                            )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
        </div>
    );
}
