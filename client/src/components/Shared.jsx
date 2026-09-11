
import React, { useState, useEffect } from 'react';
import { getMaterials, simulatePrices } from '../utils/marketData.jsx';


export function Dot({ off = false } = {}) {
    return <span className={`ldot${off ? ' off' : ''}`} />;
}


export function Pill({ status }) {
    const cls = status === 'settled' ? 'pill-settled'
        : status === 'failed' ? 'pill-failed'
        : 'pill-pending';
        
    return <span className={`pill ${cls}`}>{status}</span>;
}


export function Ticker() {
    const [prices, setPrices] = useState([]);

    useEffect(() => {
        let alive = true;
        getMaterials().then((m) => { 
            if (alive) setPrices(m); 
        });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        const iv = setInterval(() => {
            setPrices((p) => (p.length ? simulatePrices(p) : p));
        }, 2800);
        return () => clearInterval(iv);
    }, []);

    if (prices.length === 0) return null;

    const items = [...prices, ...prices, ...prices];

    return (
        <div className="ticker-wrap">
            <div className="ticker-track">
                {items.map((m, i) => (
                    <span className="tick-item" key={i}>
                        <span className="tick-id">{m.id}</span>
                        <span className="tick-price">{m.price.toFixed(1)}</span>
                        <span className="tick-unit">{m.unit}</span>
                        <span className={`tick-change ${m.trend}`}>
                            {m.trend === 'up' ? '▲' : '▼'} {Math.abs(m.change).toFixed(1)}
                        </span>
                        <span className="tick-divider" />
                    </span>
                ))}
            </div>
        </div>
    );
}