
import React, { useState, useEffect } from 'react';
import { loadSiteData } from '../utils/data-loader.jsx';


const FALLBACK_ABOUT_DATA = {
    missionStats: [
        { value: '60,000+', label: 'Informal Collectors in Nairobi' },
        { value: '4.2M kg', label: 'Recovered Material Logged' },
        { value: 'KES 180M+', label: 'Paid Directly via M-Pesa' }
    ],
    team: [
        {
            initials: 'WN',
            name: 'Wanjiku Njoroge',
            role: 'Co-Founder & Head of Logistics',
            bio: 'Former supply chain lead with 8+ years optimizing routes and sorting hubs across East Africa.'
        },
        {
            initials: 'KO',
            name: 'Kamau Otieno',
            role: 'Co-Founder & Lead Engineer',
            bio: 'Systems architect passionate about open transaction protocols and localized fintech platforms.'
        }
    ]
};

export default function About() {
    const [aboutData, setAboutData] = useState(FALLBACK_ABOUT_DATA);
    
    
    const [contactForm, setContactForm] = useState({
        name: 'John Doe',
        email: 'john.doe@example.com',
        message: 'Write your message here...'
    });
    const [formSubmitted, setFormSubmitted] = useState(false);

    useEffect(() => {
        let alive = true;
        loadSiteData()
            .then((data) => {
                if (alive && data?.about) {
                    setAboutData(data.about);
                }
            })
            .catch((err) => {
                console.warn("Using local fallback mission & team records:", err);
            });

        return () => {
            alive = false;
        };
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setContactForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        // Here you would hook into your contact API endpoint
        console.log("Contact Message Submitted: ", contactForm);
        setFormSubmitted(true);
        setTimeout(() => setFormSubmitted(false), 5000);
    };

    const { missionStats, team } = aboutData;

    return (
        <main>
            {/* About Hero Section */}
            <section id="about-hero" className="content-hero">
                <span className="eyebrow reveal">— Our Mission</span>
                <h1 className="section-header content-hero-title reveal d1">
                    Formalising<br />
                    <span className="accent">Nairobi's</span><br />
                    Waste Economy
                </h1>
                <p className="content-hero-sub reveal d2">
                    Kanairo was built on a simple belief: the people doing the
                    hardest work in Nairobi's recycling chain deserved the best price, instantly. We're replacing
                    asymmetric information with radical transparency.
                </p>
            </section>

            {/* Dynamic Mission Statistics */}
            <section id="mission-stats">
                <div className="impact-grid" id="mission-stats-root">
                    {missionStats.map((stat, idx) => (
                        <article 
                            key={idx} 
                            className={`impact-blk reveal d${idx + 1}`}
                        >
                            <span className="impact-val">{stat.value}</span>
                            <p>{stat.label}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* Problem & Solution Grid */}
            <section id="problem-solution">
                <div className="ps-grid">
                    {/* The Problem */}
                    <div className="reveal">
                        <span className="eyebrow problem-eyebrow">— The Problem</span>
                        <h2 className="section-header">Asymmetric Information. Liquidity Delays.</h2>
                        <p className="ps-copy">
                            Nairobi's 60,000+ informal waste collectors face an unfair market.
                            Brokers control price information, taking margins of 30–60% by exploiting information
                            asymmetry between collectors and recyclers.
                        </p>
                        <p className="ps-copy">
                            Collectors wait days — sometimes weeks — for payment. Recyclers face
                            unpredictable supply. The system punishes everyone except the middleman.
                        </p>
                    </div>

                    {/* The Solution */}
                    <div className="reveal reveal-r">
                        <span className="eyebrow">— The Solution</span>
                        <h2 className="section-header">Radical Transparency. Instant Settlement.</h2>
                        <div className="solution-list">
                            <div className="solution-item">
                                <span className="solution-icon">♻️</span>
                                <div>
                                    <h4>Price Discovery</h4>
                                    <p>Live exchange rates for all material types, visible to every participant in the chain.</p>
                                </div>
                            </div>
                            <div className="solution-item">
                                <span className="solution-icon">♻️</span>
                                <div>
                                    <h4>Verified Weight</h4>
                                    <p>Digital weight logs at certified Micro-Hubs eliminate disputes at point of transaction.</p>
                                </div>
                            </div>
                            <div className="solution-item">
                                <span className="solution-icon">♻️</span>
                                <div>
                                    <h4>Instant M-Pesa</h4>
                                    <p>Automated settlement the moment weight is confirmed — no waiting, no chasing payments.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Team Section */}
            <section id="team">
                <div className="reveal" style={{ marginBottom: '2.5rem' }}>
                    <span className="eyebrow">— The Team</span>
                    <h2 className="section-header">Built In Nairobi</h2>
                </div>
                
                <div className="team-grid" id="team-root">
                    {team.map((member, idx) => (
                        <article 
                            key={idx} 
                            className={`team-card k-card reveal d${idx + 1}`}
                        >
                            <div className="team-avatar">{member.initials}</div>
                            <h3>{member.name}</h3>
                            <p className="team-role">{member.role}</p>
                            <p className="team-bio">{member.bio}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* Contact Form Section */}
            <section id="contact">
                <h2>Contact Us</h2>
                <p>Have questions or want to learn more about Kanairo? Get in touch with us!</p>

                {formSubmitted ? (
                    <div className="success-banner" style={{
                        background: '#0b180b', border: '1px solid rgba(34,197,94,.3)',
                        color: '#22c55e', padding: '20px', borderRadius: '4px',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem'
                    }}>
                        ✓ Thank you! Your message has been sent. We'll be in touch shortly.
                    </div>
                ) : (
                    <form id="contact-form" onSubmit={handleFormSubmit}>
                        <label htmlFor="name">Name:</label>
                        <input 
                            type="text" 
                            id="name" 
                            name="name" 
                            value={contactForm.name} 
                            onChange={handleFormChange}
                            required 
                        />

                        <label htmlFor="email">Email:</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            value={contactForm.email} 
                            onChange={handleFormChange}
                            required 
                        />

                        <label htmlFor="message">Message:</label>
                        <textarea 
                            id="message" 
                            name="message" 
                            rows="5" 
                            value={contactForm.message} 
                            onChange={handleFormChange}
                            required
                        />
                        <button type="submit">Send Message</button>
                    </form>
                )}
            </section>
        </main>
    );
}