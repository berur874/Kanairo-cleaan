
import React, { useState, useEffect, useRef } from 'react';
import { loadSiteData } from '../utils/data-loader.jsx';
import { getHotspotShowcase, getMaterials, simulatePrices } from '../utils/marketData.jsx';
import { Dot, Ticker } from '../components/Shared.jsx';

export default function Home() {
    const [siteData, setSiteData] = useState(null);
    const [hotspots, setHotspots] = useState([]);
    const [prices, setPrices] = useState([]);
    const [activeTab, setActiveTab] = useState('collector');
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const waitlistSectionRef = useRef(null);


    useEffect(() => {
        let alive = true;
        
        loadSiteData().then((data) => {
            if (alive) setSiteData(data);
        });
        
        getHotspotShowcase().then((hs) => {
            if (alive) setHotspots(hs);
        });
        
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

    
    useEffect(() => {
        const handleScroll = () => {
            const header = document.querySelector('header');
            if (header) {
                if (window.scrollY > 50) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                    }
                });
            },
            { threshold: 0.1 }
        );

        const targets = document.querySelectorAll('.reveal');
        targets.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [siteData, hotspots, prices, activeTab]);

 
    const handleScrollToWaitlist = () => {
        waitlistSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleWaitlistSubmit = (e) => {
        e.preventDefault();
        alert(`You're on the list! We'll reach out at ${waitlistEmail} before the Q1 2026 launch.`);
        setWaitlistEmail('');
    };

    // Render loading states
    if (!siteData) return null;

    const { howItWorks, impact, stakeholderTabs } = siteData.home;
    const currentTab = stakeholderTabs[activeTab];

    return (
        <main>
           
            <section id="hero" className="hero-v2">
                <div className="hero-bg-grid" aria-hidden="true" />
                <div className="hero-glow" aria-hidden="true" />

                <div className="hero-inner">
                    <div className="live-badge reveal">
                        <Dot />
                        <span>Live Market — Nairobi Waste Exchange</span>
                    </div>

                    <h1 className="hero-title reveal d1">
                        Turn Waste<br /><span className="accent">Into Worth</span>
                    </h1>

                    <p className="hero-sub reveal d2">
                        Kanairo is Nairobi's digital circular ledger — connecting street
                        collectors, Micro-Hub aggregators, and industrial recyclers through real-time price
                        discovery and instant M-Pesa settlement.
                    </p>

                    <div className="hero-ctas reveal d3">
                        <button 
                            type="button" 
                            className="btn" 
                            onClick={handleScrollToWaitlist}
                        >
                            Join the Exchange
                        </button>
                        <a href="marketplace" className="btn btn-outline">View Live Rates →</a>
                    </div>
                </div>

                <div id="ticker-root" className="ticker-mount">
                    <Ticker />
                </div>
            </section>

           
            <section id="live-market">
                <div className="section-head">
                    <div className="reveal">
                        <span className="eyebrow">— Live Prices</span>
                        <h2 className="section-header">Market Rates</h2>
                    </div>
                    <div className="section-head-meta reveal reveal-r">
                        <Dot />
                        <span>Updating every 3s</span>
                        <a href="marketplace" className="text-link">Full Market →</a>
                    </div>
                </div>

                <div className="rates-grid">
                    {prices.map((m) => (
                        <div className="rate-card" key={m.id}>
                            <div className="rate-card-head">
                                <div>
                                    <span className="rate-card-id">{m.id}</span>
                                    <span className="rate-card-name">{m.name}</span>
                                </div>
                                <span className={`rate-card-change ${m.trend}`}>
                                    {m.trend === 'up' ? '+' : ''}{m.change.toFixed(1)}
                                </span>
                            </div>
                            <div className="rate-card-price">
                                <span className="value">{m.price.toFixed(1)}</span>
                                <span className="unit">{m.unit}</span>
                            </div>
                            <div className={`rate-card-track ${m.trend}`}>
                                <span style={{ width: `${Math.min(100, (m.price / 150) * 100).toFixed(0)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            
            <section id="works">
                <div className="reveal">
                    <span className="eyebrow">— Process</span>
                    <h2 className="section-header">How It Works</h2>
                </div>
                <div className="worksflow">
                    {howItWorks.map((step, i) => (
                        <article className={`step reveal d${i + 1}`} key={step.num}>
                            <div className="step-num">{step.num}</div>
                            <div className="step-icon">{step.icon}</div>
                            <h3>{step.title}</h3>
                            <p>{step.body}</p>
                        </article>
                    ))}
                </div>
            </section>

         
            <section id="hotspots-preview">
                <div className="section-head">
                    <div className="reveal">
                        <span className="eyebrow">— Supply Intelligence</span>
                        <h2 className="section-header">Material Hotspots</h2>
                        <p className="section-sub">
                            Verified collection nodes mapped across Nairobi. Inventory logged in real-time.
                        </p>
                    </div>
                    <a href="marketplace" className="text-link reveal reveal-r">View All →</a>
                </div>
                <div className="hotspots-grid">
                    {hotspots.map((hs, i) => (
                        <article className={`hotspot-tile k-card reveal d${(i % 4) + 1}`} key={hs.name}>
                            <div className="hotspot-tile-head">
                                <span>{hs.name}</span>
                                <Dot off={!hs.active} />
                            </div>
                            <p className="hotspot-tile-mat">{hs.material}</p>
                            <div className="hotspot-tile-row">
                                <span>Activity</span>
                                <span className="hotspot-tile-pct">{hs.activity}%</span>
                            </div>
                            <div className="hotspot-bar">
                                <span style={{ width: `${hs.activity}%` }} />
                            </div>
                            <div className="hotspot-tile-row">
                                <span>In Stock</span>
                                <span>{hs.stock.toLocaleString()} kg</span>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

          
            <section id="stakeholders">
                <div className="reveal" style={{ marginBottom: '2.5rem' }}>
                    <span className="eyebrow">— Who It's For</span>
                    <h2 className="section-header">Built For Everyone<br />In The Chain</h2>
                </div>

                <div>
                    <div className="stake-tabs">
                        {Object.keys(stakeholderTabs).map((key) => (
                            <button
                                key={key}
                                type="button"
                                className={`stake-tab${activeTab === key ? ' on' : ''}`}
                                onClick={() => setActiveTab(key)}
                            >
                                {stakeholderTabs[key].label}
                            </button>
                        ))}
                    </div>
                    <div className="stake-body">
                        <div>
                            <h3 className="stake-headline">{currentTab.headline}</h3>
                            <p className="stake-copy">{currentTab.body}</p>
                            <div className="stake-stats">
                                {currentTab.stats.map((s, i) => (
                                    <div className="stake-stat" key={i}>
                                        <span className="v">{s.v}</span>
                                        <span className="l">{s.l}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="stake-panel">
                            <div className="stake-panel-head">
                                <span>Recent Activity</span>
                                <Dot />
                            </div>
                            {currentTab.rows.map((row, i) => (
                                <div className="stake-row" key={i}>
                                    <span>{row[0]}</span>
                                    <span>{row[1]}</span>
                                    <span>{row[2]}</span>
                                    <span>{row[3]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

         
            <section id="impact">
                <div className="reveal">
                    <span className="eyebrow">— Market Impact</span>
                    <h2 className="section-header">The Numbers</h2>
                </div>
                <div className="impact-grid">
                    {impact.map((stat, i) => (
                        <article className={`impact-blk reveal d${i + 1}`} key={stat.label}>
                            <span className="impact-val">{stat.value}</span>
                            <p>{stat.label}</p>
                        </article>
                    ))}
                </div>
            </section>

       
            <section id="epr-cta">
                <div className="epr-box reveal">
                    <span className="eyebrow">— 2026 EPR Compliance</span>
                    <h2 className="section-header">
                        Every transaction is a<br />
                        <span className="accent">verified chain-of-custody</span> record.
                    </h2>
                    <p>
                        Kenya's Extended Producer Responsibility regulations take effect in 2026. Kanairo turns
                        your waste recovery operation into a fully auditable compliance asset — automatically.
                    </p>
                    <div className="epr-ctas">
                        <a href="compliance" className="btn">Get EPR Ready →</a>
                        <a href="about" className="btn btn-outline">Learn More</a>
                    </div>
                </div>
            </section>

            <section id="waitlist" ref={waitlistSectionRef}>
                <div className="waitlist-inner reveal">
                    <span className="eyebrow">— Early Access</span>
                    <h2 className="section-header">Join the Exchange</h2>
                    <p>
                        Kanairo is onboarding its first Micro-Hubs across Nairobi in Q1 2026. Join the waitlist to
                        secure your position.
                    </p>
                    <form id="waitlist-form" onSubmit={handleWaitlistSubmit}>
                        <input 
                            type="email" 
                            id="waitlist-email" 
                            placeholder="your@email.com" 
                            required 
                            value={waitlistEmail}
                            onChange={(e) => setWaitlistEmail(e.target.value)}
                        />
                        <button type="submit">Join</button>
                    </form>
                    <p className="waitlist-note">No spam. Nairobi-only beta in Q1 2026.</p>
                </div>
            </section>
        </main>
    );
}