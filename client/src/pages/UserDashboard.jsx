// Home page for sellers and buyers: their numbers, recent activity, today's market and shortcuts.
// Hub managers have their own dashboard (Dashboard.jsx at /hub).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { AppPage, StatusChip } from '../components/AppPage.jsx';
import { ACCESSIBILITY_FEATURES } from '../utils/payments.jsx';
import { getMarket, getMyDropOffs, getMyOrders, formatKes, formatKg, formatRate, formatDate } from '../utils/trade.jsx';

const FEATURE_LABEL = Object.fromEntries(ACCESSIBILITY_FEATURES);

function useLoad(load) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        load()
            .then((d) => { if (alive) setData(d); })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, [load]);
    return { data, error };
}

function Kpis({ items }) {
    return (
        <div className="kpi-row">
            {items.map((k) => (
                <div className="kpi-card" key={k.label}>
                    <div className="kpi-label">{k.label}</div>
                    <div className="kpi-value">{k.value}</div>
                    {k.note && <div className="kpi-change pos">{k.note}</div>}
                </div>
            ))}
        </div>
    );
}

function AccessibilityCard() {
    const { user } = useAuth();
    const needs = user.accessibility_needs || [];
    return (
        <div className="dash-card">
            <div className="dash-card-head"><h3>Accessibility</h3><Link to="/profile" className="text-link">Change →</Link></div>
            <p className="dash-card-note dash-card-note-bottom">
                {needs.length
                    ? <>Hubs are ranked for you by nearby AccessMap places with: <strong>{needs.map((n) => FEATURE_LABEL[n]).join(', ')}</strong>.</>
                    : 'You have not told us about any accessibility needs, so hubs are ranked by price, stock and distance.'}
            </p>
        </div>
    );
}

/** Today's prices with a Sell or Buy shortcut for each material. */
function MarketList({ market, mode }) {
    const rows = mode === 'buy'
        ? market.filter((m) => m.stock_kg > 0).sort((a, b) => b.stock_kg - a.stock_kg)
        : [...market].sort((a, b) => b.price_per_kg - a.price_per_kg);

    return (
        <div className="dash-card">
            <div className="dash-card-head">
                <h3>{mode === 'buy' ? 'In stock now' : 'Today’s prices'}</h3>
                <Link to="/market" className="text-link">Marketplace →</Link>
            </div>
            <ul className="mini-list">
                {rows.slice(0, 6).map((m) => (
                    <li key={m.id}>
                        <div>
                            <strong>{m.name}</strong>
                            <span className="cell-sub">
                                {mode === 'buy' ? `${formatKg(m.stock_kg)} across ${m.hubs.length} hub${m.hubs.length === 1 ? '' : 's'}` : m.type}
                            </span>
                        </div>
                        <div className="mini-list-side">
                            <span className="mono">{formatRate(m.price_per_kg)}</span>
                            <span className={`market-change ${m.trend}`}>{m.trend === 'up' ? '▲' : '▼'} {Math.abs(m.change_pct).toFixed(1)}%</span>
                        </div>
                        <Link to={`/${mode}?material=${m.id}`} className="text-link">{mode === 'buy' ? 'Buy' : 'Sell'}</Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SellerDashboard() {
    const { user } = useAuth();
    const drops = useLoad(getMyDropOffs);
    const market = useLoad(getMarket);

    const list = drops.data || [];
    const paid = list.reduce((s, d) => s + (d.payout_kes || 0), 0);
    const waiting = list.filter((d) => d.status === 'pending');
    const soldKg = list.reduce((s, d) => s + (d.received_kg || 0), 0);
    const waitingValue = waiting.reduce((s, d) => s + (d.est_payout_kes || 0), 0);

    return (
        <AppPage title={`Welcome, ${user.name.split(' ')[0]}`} eyebrow="Seller dashboard"
            actions={<Link to="/sell" className="btn btn-sm">+ Sell scrap</Link>}>
            <Kpis items={[
                { label: 'Paid to you', value: formatKes(paid), note: 'on M-Pesa' },
                { label: 'Waiting to be weighed', value: String(waiting.length), note: waiting.length ? `≈ ${formatKes(waitingValue)} to come` : 'nothing pending' },
                { label: 'Scrap sold', value: formatKg(soldKg), note: `${list.length} drop-off${list.length === 1 ? '' : 's'}` },
            ]} />

            <div className="dash-row-2">
                <div className="dash-card">
                    <div className="dash-card-head"><h3>Recent drop-offs</h3><Link to="/sell/history" className="text-link">All →</Link></div>
                    {drops.error ? <p className="form-error">{drops.error}</p>
                        : !drops.data ? <p className="muted-note">Loading…</p>
                        : list.length === 0 ? <p className="muted-note">Nothing yet. <Link to="/sell">Sell the scrap you collected</Link>.</p>
                        : (
                            <ul className="mini-list">
                                {list.slice(0, 5).map((d) => (
                                    <li key={d.drop_off_id}>
                                        <div>
                                            <strong>{formatKg(d.received_kg ?? d.quantity_kg)} of {d.material?.name || d.material_type}</strong>
                                            <span className="cell-sub">{d.hub.name} · {formatDate(d.created_at)}</span>
                                        </div>
                                        <div className="mini-list-side">
                                            <span className="mono">{d.payout_kes !== null ? formatKes(d.payout_kes) : `≈ ${formatKes(d.est_payout_kes || 0)}`}</span>
                                        </div>
                                        <StatusChip status={d.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                </div>
                {market.data ? <MarketList market={market.data} mode="sell" /> : <div className="dash-card"><p className="muted-note">{market.error || 'Loading prices…'}</p></div>}
            </div>

            <AccessibilityCard />
        </AppPage>
    );
}

function BuyerDashboard() {
    const { user } = useAuth();
    const orders = useLoad(getMyOrders);
    const market = useLoad(getMarket);

    const list = orders.data || [];
    const spent = list.reduce((s, o) => s + o.amount_kes, 0);
    const ready = list.filter((o) => o.status === 'paid');
    const boughtKg = list.reduce((s, o) => s + o.quantity_kg, 0);

    return (
        <AppPage title={`Welcome, ${user.name.split(' ')[0]}`} eyebrow="Buyer dashboard"
            actions={<Link to="/buy" className="btn btn-sm">+ Buy materials</Link>}>
            <Kpis items={[
                { label: 'Spent', value: formatKes(spent), note: `${list.length} order${list.length === 1 ? '' : 's'}` },
                { label: 'Ready to collect', value: String(ready.length), note: ready.length ? `at ${[...new Set(ready.map((o) => o.hub?.name))].join(', ')}` : 'nothing waiting' },
                { label: 'Material bought', value: formatKg(boughtKg) },
            ]} />

            <div className="dash-row-2">
                <div className="dash-card">
                    <div className="dash-card-head"><h3>Recent orders</h3><Link to="/buy/orders" className="text-link">All →</Link></div>
                    {orders.error ? <p className="form-error">{orders.error}</p>
                        : !orders.data ? <p className="muted-note">Loading…</p>
                        : list.length === 0 ? <p className="muted-note">No orders yet. <Link to="/buy">Find what you need</Link>.</p>
                        : (
                            <ul className="mini-list">
                                {list.slice(0, 5).map((o) => (
                                    <li key={o.id}>
                                        <div>
                                            <strong>{formatKg(o.quantity_kg)} of {o.material.name}</strong>
                                            <span className="cell-sub">{o.hub?.name || '—'} · receipt {o.id}</span>
                                        </div>
                                        <div className="mini-list-side"><span className="mono">{formatKes(o.amount_kes)}</span></div>
                                        <StatusChip status={o.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                </div>
                {market.data ? <MarketList market={market.data} mode="buy" /> : <div className="dash-card"><p className="muted-note">{market.error || 'Loading stock…'}</p></div>}
            </div>

            <AccessibilityCard />
        </AppPage>
    );
}

export default function UserDashboard() {
    const { user } = useAuth();
    return user.role === 'buyer' ? <BuyerDashboard /> : <SellerDashboard />;
}
