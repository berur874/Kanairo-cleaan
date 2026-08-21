
import React, { useState, useEffect } from 'react';
import { loadSiteData } from '../utils/data-loader.jsx';


const FALLBACK_COMPLIANCE_DATA = {
    timeline: [
        { date: '2022', title: 'Sustainable Waste Management Act', body: 'Kenya signs SWMA into law, introducing mandatory Extended Producer Responsibility.', done: true },
        { date: 'Jan 2026', title: 'EPR Compliance Mandate Active', body: 'All packaging producers must demonstrate proportional material collection records.', done: true },
        { date: 'Jul 2026', title: 'First NEMA Audit Cycle', body: 'Auditors begin inspecting transactional ledgers and recovery chains across sectors.', done: false }
    ],
    features: [
        { title: 'Immutable Digital Receipts', body: 'M-Pesa transaction records act as clean legal verification of financial support inside the recycling ecosystem.' },
        { title: 'Chain of Custody Tracking', body: 'Map recovery points from municipal informal waste pickers straight to high-volume processors.' },
        { title: 'Automated EPR Reporting', body: 'Generate clean, NEMA-compliant PDF/CSV audit trails with a single click, ready for corporate boardrooms.' }
    ]
};

export default function Compliance() {
    const [complianceData, setComplianceData] = useState(FALLBACK_COMPLIANCE_DATA);

    useEffect(() => {
        let alive = true;
        loadSiteData()
            .then((data) => {
                if (alive && data?.compliance) {
                    setComplianceData(data.compliance);
                }
            })
            .catch((err) => {
                console.warn("Using local fallback compliance records:", err);
            });

        return () => {
            alive = false;
        };
    }, []);

    const { timeline, features } = complianceData;

    return (
        <main>
           
            <section id="compliance-hero" className="content-hero">
                <span className="eyebrow reveal">— 2026 EPR Compliance</span>
                <h1 className="section-header content-hero-title reveal d1">
                    Every Transaction Is A <span className="accent">Compliance</span> Record.
                </h1>
                <p className="content-hero-sub reveal d2">
                    Kenya's Extended Producer Responsibility regulations require
                    documented material recovery chains starting January 2026. Kanairo builds compliance directly
                    into every transaction — automatically.
                </p>
                <a href="/dashboard" className="btn reveal d3">Get EPR Ready →</a>
            </section>

           
            <section id="what-is-epr">
                <div className="ps-grid">
                    
                    <div className="reveal">
                        <span className="eyebrow">— What Is EPR?</span>
                        <h2 className="section-header">Extended Producer Responsibility</h2>
                        <p className="ps-copy">
                            Under the Sustainable Waste Management Act 2022, companies that
                            manufacture or import packaged goods in Kenya are legally required to demonstrate that a
                            proportional amount of that packaging is recovered and recycled.
                        </p>
                        <p className="ps-copy">
                            The compliance burden falls on producers — but the evidence must come
                            from the recovery chain. Without verified collection data, there is no compliance.
                        </p>
                        <div className="key-deadline-box">
                            <p className="key-deadline-title">Key Deadline</p>
                            <p>
                                Compliance obligations are active from <strong>January 2026</strong>. First NEMA
                                audit cycle begins July 2026. Non-compliance penalties: up to <strong>KES 5M per
                                quarter</strong>.
                            </p>
                        </div>
                    </div>

                   
                    <div className="reveal reveal-r">
                        <span className="eyebrow">— Regulatory Timeline</span>
                        <div className="timeline" id="timeline-root">
                            {timeline.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    className={`timeline-item${item.done ? ' done' : ''}`}
                                >
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-date">
                                        {item.date}{item.done ? '' : ' →'}
                                    </div>
                                    <h4>{item.title}</h4>
                                    <p>{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

           
            <section id="epr-features">
                <div className="reveal" style={{ marginBottom: '2.5rem' }}>
                    <span className="eyebrow">— What Kanairo Provides</span>
                    <h2 className="section-header">
                        Built-In Compliance,<br />Not Bolted On.
                    </h2>
                </div>
                
                <div className="feature-grid" id="features-root">
                    {features.map((f, i) => (
                        <article 
                            key={i} 
                            className={`feature-card k-card reveal d${(i % 3) + 1}`}
                        >
                            <span className="feature-check">✓</span>
                            <h3>{f.title}</h3>
                            <p>{f.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section id="compliance-cta">
                <div className="epr-box reveal">
                    <h2 className="section-header">
                        Don't wait for the audit.<br />
                        <span className="accent">Start building your compliance record today.</span>
                    </h2>
                    <p>
                        Every transaction on Kanairo automatically generates the audit trail NEMA requires. Join the
                        platform before the January 2026 deadline.
                    </p>
                    <div className="epr-ctas">
                        <a href="/dashboard" className="btn">Open Dashboard →</a>
                        <a href="/about" className="btn btn-outline">About Kanairo</a>
                    </div>
                </div>
            </section>
        </main>
    );
}