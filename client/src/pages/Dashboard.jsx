import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto'; 
import { Dot } from '../components/Shared.jsx';
import { MaterialMix, InventoryBars, LogMaterialForm } from '../components/DashboardInventory.jsx';
import { useHotspots } from '../utils/storage.jsx';
import { getMaterials, simulatePrices } from '../utils/marketData.jsx';
import { loadSiteData } from '../utils/data-loader.jsx';
import { getTransactions, onTransactionsChange, getDashboardSummary } from '../utils/payments.jsx';


const MAP_PINS = [
    { name: 'Dandora', x: 72, y: 48, active: true },
    { name: 'Gikomba', x: 55, y: 52, active: true },
    { name: 'Industrial', x: 60, y: 55, active: true },
    { name: 'Kibera', x: 45, y: 60, active: false },
    { name: 'Eastleigh', x: 65, y: 44, active: true },
    { name: 'Ruiru', x: 78, y: 25, active: true },
    { name: 'Westlands', x: 35, y: 38, active: false },
    { name: 'Karen', x: 30, y: 70, active: false },
];

export default function Dashboard() {
    const [siteData, setSiteData] = useState(null);
    const {hotspots, loading: hotspotsLoading } = useHotspots();
    const [prices, setPrices] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(null);

    const revenueCanvasRef = useRef(null);
    const weightCanvasRef = useRef(null);

  
    useEffect(() => {
        let alive = true;

        loadSiteData().then((data) => {
            if (alive) setSiteData(data);
        });

        getMaterials().then((m) => {
            if (alive) setPrices(m.slice(0, 4));
        });

        getTransactions(10).then((txns) => {
            if (alive) setTransactions(txns);
        });

        getDashboardSummary().then((s) => {
            if (alive) setSummary(s);
        });

        const unsubscribe = onTransactionsChange((txns) => {
            if (alive) setTransactions(txns);
        }, 10);

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
                        maxBarThickness: 36 
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { callbacks: { label: (c) => `KES ${c.parsed.y.toLocaleString()}` } } 
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: tickStyle },
                        y: { grid: { color: 'rgba(34,197,94,.06)' }, ticks: { ...tickStyle, callback: (v) => `${v / 1000}K` } },
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
                        tooltip: { callbacks: { label: (c) => `${c.parsed.y.toLocaleString()} kg` } } 
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: tickStyle },
                        y: { grid: { color: 'rgba(34,197,94,.06)' }, ticks: tickStyle },
                    },
                },
            });
        }

    
        return () => {
            if (revenueChartInstance) revenueChartInstance.destroy();
            if (weightChartInstance) weightChartInstance.destroy();
        };
    }, [summary]);

    if (!siteData || !summary) return null;

    const { kpis: kpiTemplate } = siteData.dashboard;

    
    const activeHubsCount = hotspots.length;

    const activity = transactions.map((t) => ({
        icon: '♻️',
        title: `Sold ${t.quantity.toLocaleString()} kg ${t.material} — receipt ${t.id}`,
        meta: t.date,
        amt: `KES ${t.amount.toLocaleString()}`,
    }));

    const resolvedKPIs = kpiTemplate.map((k) => {
        if (k.valueKey === 'activeHubs') {
            return {
                ...k,
                value: `${activeHubsCount} / 8`,
                change: activeHubsCount < 8 ? `${8 - activeHubsCount} offline` : 'all online',
                pos: activeHubsCount >= 6,
            };
        }
        if (k.valueKey === 'totalKg') {
            return {
                ...k,
                value: `${summary.weightTotal.toLocaleString()} kg`,
                spark: summary.weekly.map((w) => w.weight),
            };
        }
        if (k.label === "Today's Revenue") {
            return {
                ...k,
                value: `KES ${summary.revenueTotal.toLocaleString()}`,
                spark: summary.weekly.map((w) => w.revenue),
            };
        }
        if (k.label === 'Transactions') {
            return { ...k, value: String(summary.transactionCount) };
        }
        return k;
    });

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
                    <div className="dash-avatar">D</div>
                    <div>
                        <div className="dash-user-name">Dandora Hub</div>
                        <div className="dash-user-role">Hub Manager</div>
                    </div>
                </div>
            </aside>

    
            <div className="dash-main">
                <div className="dash-topbar">
                    <h1 id="dash-section-title">Overview</h1>
                    <div className="dash-topbar-right">
                        <Dot />
                        <span>Live</span>
                        <a href="marketplace" className="btn btn-sm">Open Market →</a>
                    </div>
                </div>

                <div className="dash-content">
                    {/* KPI Widget Row */}
                    <div className="kpi-row">
                        {resolvedKPIs.map((k, i) => (
                            <div className="kpi-card" key={i}>
                                <div className="kpi-label">
                                    <Dot />
                                    {k.label}
                                </div>
                                <div className="kpi-value">{k.value}</div>
                                <div className={`kpi-change ${k.pos ? 'pos' : 'neg'}`}>
                                    {k.pos ? '▲' : '–'} {k.change}
                                </div>
                                <div className="kpi-spark">
                                    {k.spark.map((v, j) => (
                                        <span
                                            key={j}
                                            className={j === k.spark.length - 1 ? 'end' : ''}
                                            style={{ height: `${(v / Math.max(...k.spark)) * 100}%` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

    
                    <div className="dash-row-2">
                        <div className="dash-card">
                            <div className="dash-card-head">
                                <h3>Weekly Revenue</h3>
                                <span className="dash-card-tag">KES</span>
                            </div>
                            <div className="chart-wrap">
                                <canvas ref={revenueCanvasRef} />
                            </div>
                        </div>
                        <div className="dash-card">
                            <div className="dash-card-head">
                                <h3>Weight Collected</h3>
                                <span className="dash-card-tag">KG</span>
                            </div>
                            <div className="chart-wrap">
                                <canvas ref={weightCanvasRef} />
                            </div>
                        </div>
                    </div>

    
                    <div className="dash-row-1-2">
                        <div className="dash-card">
                            <div className="dash-card-head"><h3>Material Mix</h3></div>
                            <div id="material-mix-root">
                                <MaterialMix hotspots={hotspots} loading={hotspotsLoading} />
                            </div>
                        </div>
                        <div className="dash-card">
                            <div className="dash-card-head"><h3>Current Inventory</h3></div>
                            <div id="inventory-bars-root">
                                <InventoryBars hotspots={hotspots} loading={hotspotsLoading} />
                            </div>
                        </div>
                    </div>

    
                    <div className="dash-row-2">
                        <div className="dash-card">
                            <div className="dash-card-head"><h3>Hub Map — Nairobi</h3></div>
                            <div className="hub-map" id="hub-map">
                                {MAP_PINS.map((pin) => (
                                    <div
                                        key={pin.name}
                                        className={`hub-pin${pin.active ? '' : ' off'}`}
                                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                        title={pin.name}
                                    >
                                        <span className="hub-pin-dot" />
                                        <span className="hub-pin-label">{pin.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="dash-card">
                            <div className="dash-card-head">
                                <h3>Activity Feed</h3>
                                <Dot />
                            </div>
                            <div>
                                {activity.map((a, i) => (
                                    <div className="activity-row" key={i}>
                                        <div className="activity-icon">{a.icon}</div>
                                        <div className="activity-body">
                                            <div className="activity-title">{a.title}</div>
                                            <div className="activity-meta">{a.meta}</div>
                                        </div>
                                        <div className="activity-amt">{a.amt}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Historical Transactions */}
                    <div className="dash-card">
                        <div className="dash-card-head">
                            <h3>Recent Transactions</h3>
                            <a href="marketplace" className="text-link">View All →</a>
                        </div>
                        <div>
                            <div className="txn-head-row">
                                {['TXN ID', 'Material', 'Weight', 'Amount', 'Date'].map((t) => (
                                    <span key={t}>{t}</span>
                                ))}
                            </div>
                            {transactions.length === 0 ? (
                                <p style={{ fontSize: '0.78rem', color: 'var(--outline)', padding: '12px 0' }}>
                                    No transactions yet — purchases from the Marketplace will show up here.
                                </p>
                            ) : (
                                transactions.map((t) => (
                                    <div className="txn-row" key={t.id}>
                                        <span className="txn-id">{t.id}</span>
                                        <span className="txn-mat">{t.material}</span>
                                        <span className="txn-wt">{t.quantity.toLocaleString()} kg</span>
                                        <span className="txn-amt">KES {t.amount.toLocaleString()}</span>
                                        <span className="txn-hub">{t.date}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

    
                    <div className="dash-card">
                        <div className="dash-card-head">
                            <h3>Log New Material</h3>
                            <span className="dash-card-tag">Yard Entry</span>
                        </div>
                        <p className="dash-card-note">
                            Yard owners can manually record new incoming materials here to instantiate digital trace verification metrics.
                        </p>
                        <div id="inventory-form-root">
                            <LogMaterialForm />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}