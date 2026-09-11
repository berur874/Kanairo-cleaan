import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { Dot, Ticker } from '../components/Shared.jsx';
import { getMaterials, simulatePrices } from '../utils/marketData.jsx';
import { getHotspots, onHotspotsChange, aggregateInventory } from '../utils/storage.jsx';
import { recordTransaction, showSuccessNotification } from '../utils/payments.jsx';

// Algorithmic helpers
function buildPriceHistory(basePrice) {
    return Array.from({ length: 24 }, (_, i) => ({
        h: `${String(i).padStart(2, '0')}:00`,
        v: Math.max(0.5, basePrice + Math.sin(i * 0.4) * basePrice * 0.06 + Math.random() * basePrice * 0.02),
    }));
}

function buildOrderBook(price) {
    const askOffsets = [0.3, 0.6, 0.9, 1.3, 1.7];
    const bidOffsets = [0.3, 0.6, 0.9, 1.3, 1.7];
    const askSizes = [940, 730, 1120, 460, 1890];
    const bidSizes = [1240, 880, 1560, 620, 2100];

    const asks = askOffsets.map((d, i) => {
        const p = +(price + d).toFixed(1);
        return { price: p, size: askSizes[i], total: Math.round(p * askSizes[i]) };
    });
    const bids = bidOffsets.map((d, i) => {
        const p = Math.max(0.1, +(price - d).toFixed(1));
        return { price: p, size: bidSizes[i], total: Math.round(p * bidSizes[i]) };
    });
    const maxTotal = Math.max(...asks.map((a) => a.total), ...bids.map((b) => b.total));
    return { asks, bids, spread: askOffsets[0] + bidOffsets[0], maxTotal };
}

const pad = (n) => String(n).padStart(2, '0');

export default function Marketplace() {
    const [prices, setPrices] = useState([]);
    const [selected, setSelected] = useState(null);
    const [hotspots, setHotspots] = useState([]);
    const [query, setQuery] = useState('');
    const [trades, setTrades] = useState([]);
    const [mpesaModal, setMpesaModal] = useState(null); 

    const chartInstanceRef = useRef(null);
    const chartCanvasRef = useRef(null);

    
    useEffect(() => {
        let alive = true;
        getMaterials().then((m) => {
            if (!alive) return;
            setPrices(m);
            setSelected(m[0].id);
        });

        getHotspots().then((hs) => {
            if (alive) setHotspots(hs);
        });

        const unsubscribe = onHotspotsChange(setHotspots);

        return () => {
            alive = false;
            unsubscribe();
        };
    }, []);

    
    useEffect(() => {
        const iv = setInterval(() => {
            setPrices((p) => (p.length ? simulatePrices(p) : p));
        }, 2800);
        return () => clearInterval(iv);
    }, []);

    
    useEffect(() => {
        if (prices.length === 0) return;
        const iv = setInterval(() => {
            const m = prices[Math.floor(Math.random() * prices.length)];
            const wt = (Math.random() * 200 + 20).toFixed(0);
            const now = new Date();
            const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            setTrades((prev) => [
                { time, mat: m.id, wt: `${wt} kg`, side: Math.random() > 0.5 ? 'buy' : 'sell' },
                ...prev.slice(0, 17)
            ]);
        }, 2500);
        return () => clearInterval(iv);
    }, [prices]);

    
    useEffect(() => {
        if (!selected || prices.length === 0 || !chartCanvasRef.current) return;

        const selMat = prices.find((m) => m.id === selected) || prices[0];
        const history = buildPriceHistory(selMat.price);

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        chartInstanceRef.current = new Chart(chartCanvasRef.current, {
            type: 'line',
            data: {
                labels: history.map((pt) => pt.h),
                datasets: [{
                    data: history.map((pt) => +pt.v.toFixed(1)),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,.15)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 0,
                    borderWidth: 1.5,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#5a7a5a', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { color: 'rgba(34,197,94,.06)' },
                        ticks: { color: '#5a7a5a', font: { family: 'JetBrains Mono', size: 9 } }
                    },
                },
            },
        });

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
            }
        };
    }, [selected, prices]);

    if (prices.length === 0 || !selected) return null;

    const selMat = prices.find((m) => m.id === selected) || prices[0];
    const inv = aggregateInventory(hotspots);
    const stockFor = (name) => inv.find((i) => i.name === name)?.quantity || 0;
    const filtered = prices.filter((m) => (m.id + m.name).toLowerCase().includes(query.toLowerCase()));
    const book = buildOrderBook(selMat.price);

    
    const handleBuyNow = (m) => {
        const stock = stockFor(m.name);
        if (stock <= 0) return;
        setMpesaModal({
            materialName: m.name,
            maxAvailable: stock,
            pricePerKg: m.price
        });
    };

    const handleConfirmMpesa = async (qty) => {
        try {
            const txn = await recordTransaction({
                material: mpesaModal.materialName,
                quantity: qty,
                amount: Math.round(qty * mpesaModal.pricePerKg)
            });
            showSuccessNotification(`Bought ${qty}kg ${mpesaModal.materialName} — receipt ${txn.id}`);
        } catch (err) {
            console.error('Failed to complete purchase:', err);
            showSuccessNotification('Payment failed — please try again.');
        } finally {
            setMpesaModal(null);
        }
    };

    return (
        <main>
    
            <div className="ticker-mount mkt-ticker-sticky">
                <Ticker />
            </div>

            <section id="marketplace-hero">
                <span className="eyebrow">— Kanairo Exchange</span>
                <h1 className="section-header">Live Material Market</h1>
            </section>

            <section id="marketplace-app">
                <div>
                    {/* Filter Tabs */}
                    <div className="mkt-tabs-row">
                        {prices.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                className={`k-tab${selected === m.id ? ' on' : ''}`}
                                onClick={() => setSelected(m.id)}
                            >
                                {m.id}
                            </button>
                        ))}
                    </div>

                    <div className="mkt-grid">
    
                        <div>
    
                            <div className="dash-card mkt-hero-card" style={{ marginBottom: '24px' }}>
                                <div className="mkt-hero-top">
                                    <div>
                                        <div className="mkt-hero-id">{selMat.id} — {selMat.name}</div>
                                        <div className="mkt-hero-price">
                                            <span className="value">{selMat.price.toFixed(1)}</span>
                                            <span className="unit">{selMat.unit}</span>
                                        </div>
                                    </div>
                                    <span className={`mkt-hero-change ${selMat.trend}`}>
                                        {selMat.trend === 'up' ? '+' : ''}{selMat.change.toFixed(1)} KES
                                    </span>
                                </div>
                                <div className="chart-wrap">
                                    <canvas ref={chartCanvasRef} />
                                </div>
                            </div>

    
                            <div className="mkt-search">
                                <input
                                    type="text"
                                    placeholder="Search materials…"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                            </div>

    
                            <div className="price-cards-grid">
                                {filtered.map((m) => {
                                    const stock = stockFor(m.name);
                                    const isSelected = selected === m.id;
                                    return (
                                        <div
                                            key={m.id}
                                            className={`price-card${isSelected ? ' selected' : ''}`}
                                            onClick={() => setSelected(m.id)}
                                        >
                                            <div className="price-card-top">
                                                <span className="price-card-id">{m.id}</span>
                                                <span className={`price-card-change ${m.trend}`}>
                                                    {m.trend === 'up' ? '▲' : '▼'} {Math.abs(m.change).toFixed(1)}
                                                </span>
                                            </div>
                                            <div className="price-card-value">{m.price.toFixed(1)}</div>
                                            <div className="price-card-name">{m.name}</div>
                                            <div className="price-card-stock">
                                                <span>Stock</span>
                                                <span>{stock.toLocaleString()} kg</span>
                                            </div>
                                            <button
                                                className="price-card-buy"
                                                type="button"
                                                disabled={stock <= 0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleBuyNow(m);
                                                }}
                                            >
                                                {stock <= 0 ? 'Out of Stock' : 'Buy Now'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

    
                        <div>
    
                            <div className="dash-card" style={{ marginBottom: '2px' }}>
                                <div className="dash-card-head">
                                    <h3>Order Book — {selMat.id}</h3>
                                </div>
                                <div className="ob-head-row">
                                    <span>Price</span>
                                    <span>Size (kg)</span>
                                    <span>Total</span>
                                </div>

    
                                {book.asks.slice().reverse().map((r, i) => (
                                    <div className="ob-row ask" key={`a${i}`}>
                                        <span className="depth" style={{ width: `${(r.total / book.maxTotal) * 100}%` }} />
                                        <span className="ob-price down">{r.price.toFixed(1)}</span>
                                        <span className="ob-size">{r.size.toLocaleString()}</span>
                                        <span className="ob-total">{r.total.toLocaleString()}</span>
                                    </div>
                                ))}

                                <div className="ob-spread">
                                    <span>SPREAD</span>
                                    <span>{book.spread.toFixed(1)} KES</span>
                                </div>

    
                                {book.bids.map((r, i) => (
                                    <div className="ob-row bid" key={`b${i}`}>
                                        <span className="depth" style={{ width: `${(r.total / book.maxTotal) * 100}%` }} />
                                        <span className="ob-price up">{r.price.toFixed(1)}</span>
                                        <span className="ob-size">{r.size.toLocaleString()}</span>
                                        <span className="ob-total">{r.total.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>

    
                            <div className="dash-card">
                                <div className="dash-card-head">
                                    <h3>Live Trades</h3>
                                    <Dot />
                                </div>
                                <div className="trade-feed-wrap">
                                    {trades.length === 0 ? (
                                        <div className="trade-empty">Waiting for trades…</div>
                                    ) : (
                                        trades.map((t, i) => (
                                            <div className="trade-row" key={i}>
                                                <span className="trade-time">{t.time}</span>
                                                <span className={`trade-side ${t.side}`}>
                                                    {t.side.toUpperCase()} {t.mat}
                                                </span>
                                                <span className="trade-wt">{t.wt}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

    
            {mpesaModal && (
                <MpesaModal
                    {...mpesaModal}
                    onClose={() => setMpesaModal(null)}
                    onConfirm={handleConfirmMpesa}
                />
            )}
        </main>
    );
}


function MpesaModal({ materialName, maxAvailable, pricePerKg, onClose, onConfirm }) {
    const [qty, setQty] = useState(Math.min(10, maxAvailable) || 1);
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');

    const handleQtyChange = (e) => {
        let val = parseInt(e.target.value, 10) || 0;
        if (val > maxAvailable) val = maxAvailable;
        setQty(val);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(qty);
    };

    return (
        <div style={{
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '999998'
        }}>
            <div style={{
                background: '#0b180b', border: '1px solid rgba(34,197,94,.35)', borderRadius: '4px',
                padding: '36px 30px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                color: '#e2f0e2', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", margin: '20px'
            }}>
                <h2 style={{
                    margin: '0 0 8px', color: '#22c55e', textAlign: 'center',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: '800',
                    fontSize: '1.5rem', letterSpacing: '1px', textTransform: 'uppercase'
                }}>
                    M-Pesa Simulator
                </h2>
                <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#a0c0a0', margin: '0 0 26px', lineHeight: '1.5' }}>
                    Paying <strong style={{ color: '#e2f0e2' }}>KES {(qty * pricePerKg).toLocaleString()}</strong> for <strong style={{ color: '#e2f0e2' }}>{qty}kg</strong> of {materialName}.
                </p>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{
                            display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: '#5a7a5a', marginBottom: '8px',
                            fontFamily: "'JetBrains Mono', monospace"
                        }}>
                            Amount to Buy (kg)
                        </label>
                        <input
                            type="number"
                            value={qty}
                            onChange={handleQtyChange}
                            min="1"
                            max={maxAvailable}
                            required
                            style={{
                                width: '100%', padding: '11px', background: 'rgba(11,24,11,.6)',
                                border: '1px solid rgba(34,197,94,.2)', borderRadius: '2px',
                                color: '#e2f0e2', fontSize: '0.9rem', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{
                            display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: '#5a7a5a', marginBottom: '8px',
                            fontFamily: "'JetBrains Mono', monospace"
                        }}>
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            placeholder="e.g. 0712345678"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            pattern="[0-9]{10}"
                            style={{
                                width: '100%', padding: '11px', background: 'rgba(11,24,11,.6)',
                                border: '1px solid rgba(34,197,94,.2)', borderRadius: '2px',
                                color: '#e2f0e2', fontSize: '0.9rem', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: '26px' }}>
                        <label style={{
                            display: 'block', fontSize: '0.65rem', letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: '#5a7a5a', marginBottom: '8px',
                            fontFamily: "'JetBrains Mono', monospace"
                        }}>
                            M-Pesa PIN
                        </label>
                        <input
                            type="password"
                            placeholder="4-digit PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            required
                            maxLength="4"
                            pattern="[0-9]{4}"
                            style={{
                                width: '100%', padding: '11px', background: 'rgba(11,24,11,.6)',
                                border: '1px solid rgba(34,197,94,.2)', borderRadius: '2px',
                                color: '#e2f0e2', fontSize: '0.9rem', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1, padding: '12px', background: 'transparent', color: '#e2f0e2',
                                border: '1px solid rgba(34,197,94,.2)', borderRadius: '2px', cursor: 'pointer',
                                fontWeight: '700', fontSize: '0.68rem', textTransform: 'uppercase',
                                letterSpacing: '0.1em', fontFamily: "'Barlow Condensed', sans-serif"
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1, padding: '12px', background: '#22c55e', color: '#06120a',
                                border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: '800',
                                fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                                fontFamily: "'Barlow Condensed', sans-serif"
                            }}
                        >
                            Confirm PIN
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}