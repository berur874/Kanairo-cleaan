// src/components/DashboardInventory.jsx
import { aggregateInventory } from '../utils/storage.jsx';

const MATERIAL_COLORS = {
    'PET Plastic': '#22c55e',
    'HDPE Plastic': '#16a34a',
    'E-Waste': '#5a7a5a',
    'Cardboard': '#4ade80',
    'Aluminium': '#86efac',
    'Clear Glass': '#3f6b46',
};

export function MaterialMix({ hotspots = [], loading = false }) {
    const inv = aggregateInventory(hotspots);
    const total = inv.reduce((s, i) => s + i.quantity, 0) || 1;
    let cursor = 0;

    const stops = inv.map((i) => {
        const pct = (i.quantity / total) * 100;
        const color = MATERIAL_COLORS[i.name] || '#5a7a5a';
        const seg = `${color} ${cursor}% ${cursor + pct}%`;
        cursor += pct;
        return seg;
    });

    const donutStyle = {
        background: inv.length ? `conic-gradient(${stops.join(',')})` : 'rgba(34,197,94,.08)'
    };

    return (
        <div className="mix-wrap">
            <div className="mix-donut" style={donutStyle} />
            <div className="mix-legend">
                {loading ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--outline)' }}>
                        Loading inventory…
                    </p>
                ) : inv.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--outline)' }}>
                        No inventory logged yet.
                    </p>
                ) : (
                    inv.map((i) => (
                        <div className="mix-legend-row" key={i.name}>
                            <span
                                className="mix-legend-dot"
                                style={{ background: MATERIAL_COLORS[i.name] || '#5a7a5a' }}
                            />
                            <span>{i.name}</span>
                            <span>{Math.round((i.quantity / total) * 100)}%</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export function InventoryBars({ hotspots = [], loading = false }) {
    const inv = aggregateInventory(hotspots);
    const max = Math.max(1, ...inv.map((i) => i.quantity));

    return (
        <div className="inv-bars">
            {loading ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--outline)' }}>
                    Loading inventory…
                </p>
            ) : inv.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--outline)' }}>
                    Log a material below to see it here.
                </p>
            ) : (
                inv.map((i) => (
                    <div className="inv-bar-row" key={i.name}>
                        <span className="inv-bar-mat">{i.name}</span>
                        <div className="inv-bar-track">
                            <span style={{ width: `${Math.round((i.quantity / max) * 100)}%` }} />
                        </div>
                        <span className="inv-bar-qty">{i.quantity.toLocaleString()} kg</span>
                    </div>
                ))
            )}
        </div>
    );
}
