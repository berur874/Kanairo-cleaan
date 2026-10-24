import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { AppPage } from '../components/AppPage.jsx';
import { getMarket, formatKg, formatRate } from '../utils/trade.jsx';

const INTRO = {
    seller: 'Today’s prices for scrap. Pick a material to see which hubs to take it to.',
    buyer: 'What our hubs have in stock right now. Pick a material to find the best hub to buy from.',
    hub_manager: 'Today’s prices and stock across every hub.',
};

/** Shared market for all roles: sellers start a sale from here, buyers start a purchase. */
export default function Market() {
    const { user } = useAuth();
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');

    useEffect(() => {
        let alive = true;
        getMarket()
            .then((m) => { if (alive) setItems(m); })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, []);

    const q = query.trim().toLowerCase();
    const shown = items?.filter((m) => !q || `${m.name} ${m.type}`.toLowerCase().includes(q));

    return (
        <AppPage title="Marketplace" eyebrow="Live prices">
            <div className="dash-card">
                <p className="dash-card-note">{INTRO[user.role]}</p>
                <div className="dash-form dash-form-filter">
                    <div className="dash-form-field">
                        <label htmlFor="market-search">Search materials</label>
                        <input id="market-search" type="text" placeholder="e.g. plastic" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>
            </div>

            {error ? <p className="form-error">{error}</p>
                : !items ? <p className="muted-note">Loading the market…</p>
                : shown.length === 0 ? <p className="muted-note">No material matches “{query}”.</p>
                : (
                    <div className="market-grid">
                        {shown.map((m) => (
                            <article key={m.id} className="market-card">
                                <div className="market-card-head">
                                    <div>
                                        <span className="mono">{m.id}</span>
                                        <h3>{m.name}</h3>
                                        <span className="cell-sub">{m.type}</span>
                                    </div>
                                    <div className="market-price">
                                        <span className="market-price-value">{formatRate(m.price_per_kg)}</span>
                                        <span className={`market-change ${m.trend}`}>
                                            {m.trend === 'up' ? '▲' : '▼'} {Math.abs(m.change_pct).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="market-stock">
                                    <span className="hub-venues-label">In stock</span>
                                    <strong>{formatKg(m.stock_kg)}</strong>
                                    {m.hubs.length > 0
                                        ? <span className="cell-sub"> at {m.hubs.slice(0, 3).map((h) => h.name).join(', ')}{m.hubs.length > 3 && ` +${m.hubs.length - 3} more`}</span>
                                        : <span className="cell-sub"> at no hub right now</span>}
                                </div>

                                {user.role === 'seller' && (
                                    <Link to={`/sell?material=${m.id}`} className="btn">Sell {m.name}</Link>
                                )}
                                {user.role === 'buyer' && (
                                    m.stock_kg > 0
                                        ? <Link to={`/buy?material=${m.id}`} className="btn">Buy {m.name}</Link>
                                        : <span className="cell-sub">Out of stock at every hub</span>
                                )}
                            </article>
                        ))}
                    </div>
                )}
        </AppPage>
    );
}
