import { useState, useEffect, useRef, useCallback } from 'react';
import Chart from 'chart.js/auto';
import { Dot } from '../components/Shared.jsx';
import { MaterialMix, InventoryBars } from '../components/DashboardInventory.jsx';
import { IncomingDropOffs, HandOverOrders } from '../components/HubQueues.jsx';
import PartnerVenues from '../components/PartnerVenues.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { getHotspots } from '../utils/storage.jsx';
import { getMaterials, simulatePrices } from '../utils/marketData.jsx';
import { getHubSummary, formatKes } from '../utils/trade.jsx';

// The hub manager's home: today's work queues first, then this hub's numbers.
export default function Dashboard() {
    const { user } = useAuth();
    const [prices, setPrices] = useState([]);
    const [summary, setSummary] = useState(null);
    const [hub, setHub] = useState(null);
    const [hubLoading, setHubLoading] = useState(true);

    const revenueCanvasRef = useRef(null);
    const weightCanvasRef = useRef(null);

    // Summary and stock change whenever a drop-off is paid or an order handed over.
    const refresh = useCallback(() => {
        getHubSummary().then(setSummary).catch((err) => console.error('Failed to load hub summary:', err));
        getHotspots()
            .then((hs) => setHub(hs.find((h) => h.id === user.hotspot_id) || null))
            .catch((err) => console.error('Failed to load hub stock:', err))
            .finally(() => setHubLoading(false));
    }, [user.hotspot_id]);

    useEffect(() => {
        refresh();
        getMaterials().then((m) => setPrices(m.slice(0, 4))).catch(() => {});
    }, [refresh]);

    useEffect(() => {
        const iv = setInterval(() => {
            setPrices((p) => (p.length ? simulatePrices(p) : p));
        }, 2800);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        if (!summary) return;

        const { weekly } = summary;
        const tickStyle = { color: '#5a7a5a', font: { family: 'JetBrains Mono', size: 9 } };

        let revenueChartInstance = null;
        let weightChartInstance = null;

        if (revenueCanvasRef.current) {
            revenueChartInstance = new Chart(revenueCanvasRef.current, {
                type: 'bar',
                data: {
                    labels: weekly.map((w) => w.day),
                    datasets: [{
                        data: weekly.map((w) => w.revenue),
                        backgroundColor: '#22c55e',
                        borderRadius: 2,
                        maxBarThickness: 36,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => `KES ${c.parsed.y.toLocaleString()}` } },
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: tickStyle },
                        // A new hub has no sales yet: keep the axis at 0–1K instead of 0–0.001K.
                        y: { min: 0, suggestedMax: 1000, grid: { color: 'rgba(34,197,94,.06)' }, ticks: { ...tickStyle, callback: (v) => `${v / 1000}K` } },
                    },
                },
            });
        }

        if (weightCanvasRef.current) {
            weightChartInstance = new Chart(weightCanvasRef.current, {
                type: 'line',
                data: {
                    labels: weekly.map((w) => w.day),
                    datasets: [{
                        data: weekly.map((w) => w.weight),
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
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => `${c.parsed.y.toLocaleString()} kg` } },
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: tickStyle },
                        y: { min: 0, suggestedMax: 10, grid: { color: 'rgba(34,197,94,.06)' }, ticks: tickStyle },
                    },
                },
            });
        }

        return () => {
            if (revenueChartInstance) revenueChartInstance.destroy();
            if (weightChartInstance) weightChartInstance.destroy();
        };
    }, [summary]);

    const kpis = summary ? [
        { label: 'Scrap waiting', value: String(summary.pendingDropOffs), note: 'drop-offs to weigh' },
        { label: 'Orders to hand over', value: String(summary.ordersToHandOver), note: 'already paid by buyers' },
        { label: 'Sales', value: formatKes(summary.revenueTotal), note: `${summary.transactionCount} ${summary.transactionCount === 1 ? 'order' : 'orders'}`, spark: summary.weekly.map((w) => w.revenue) },
        { label: 'Paid to sellers', value: formatKes(summary.sellerPayoutsTotal), note: 'for weighed scrap' },
    ] : [];

    const hubName = summary?.hub?.name || 'your hub';
    const myHubs = hub ? [hub] : [];

    return (
        <main className="dash-shell">
            <aside className="dash-sidebar">
                <div className="dash-sidebar-section dash-sidebar-section-first">
                    <p className="dash-sidebar-label">Live Rates</p>
                    <div>
                        {prices.map((m) => (
                            <div className="sidebar-rate-row" key={m.id}>
                                <span className="sidebar-rate-id">{m.id}</span>
                                <div className="sidebar-rate-price">
                                    <span>{m.price.toFixed(1)}</span>
                                    <span className={`arrow ${m.trend}`}>{m.trend === 'up' ? '▲' : '▼'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="dash-sidebar-user">
                    <div className="dash-avatar">{user.name.trim()[0]?.toUpperCase()}</div>
                    <div>
                        <div className="dash-user-name">{user.name}</div>
                        <div className="dash-user-role">Hub manager · {hubName}</div>
                    </div>
                </div>
            </aside>

            <div className="dash-main">
                <div className="dash-topbar">
                    <div>
                        <span className="eyebrow">Hub manager</span>
                        <h1 id="dash-section-title">{hubName} hub</h1>
                    </div>
                    <div className="dash-topbar-right">
                        <Dot />
                        <span>Live</span>
                    </div>
                </div>

                <div className="dash-content">
                    <div className="kpi-row">
                        {kpis.map((k) => (
                            <div className="kpi-card" key={k.label}>
                                <div className="kpi-label"><Dot />{k.label}</div>
                                <div className="kpi-value">{k.value}</div>
                                <div className="kpi-change pos">{k.note}</div>
                                {k.spark && (
                                    <div className="kpi-spark">
                                        {k.spark.map((v, j) => (
                                            <span key={j} className={j === k.spark.length - 1 ? 'end' : ''}
                                                style={{ height: `${(v / Math.max(...k.spark, 1)) * 100}%` }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="dash-row-2">
                        <IncomingDropOffs onChange={refresh} />
                        <HandOverOrders onChange={refresh} />
                    </div>

                    <div className="dash-row-1-2">
                        <div className="dash-card">
                            <div className="dash-card-head"><h3>Material Mix</h3></div>
                            <MaterialMix hotspots={myHubs} loading={hubLoading} />
                        </div>
                        <div className="dash-card">
                            <div className="dash-card-head"><h3>Stock at {hubName}</h3></div>
                            <InventoryBars hotspots={myHubs} loading={hubLoading} />
                        </div>
                    </div>

                    <div className="dash-row-2">
                        <div className="dash-card">
                            <div className="dash-card-head">
                                <h3>Weekly Sales</h3>
                                <span className="dash-card-tag">KES</span>
                            </div>
                            <div className="chart-wrap"><canvas ref={revenueCanvasRef} /></div>
                        </div>
                        <div className="dash-card">
                            <div className="dash-card-head">
                                <h3>Weight Sold</h3>
                                <span className="dash-card-tag">KG</span>
                            </div>
                            <div className="chart-wrap"><canvas ref={weightCanvasRef} /></div>
                        </div>
                    </div>

                    {/* Upstream partner data: Group 12, AccessMap Nairobi — for planning new hubs */}
                    <PartnerVenues />
                </div>
            </div>
        </main>
    );
}
