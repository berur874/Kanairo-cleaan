import React, { useState, useEffect } from 'react';
import {
    PARTNER_CATEGORIES,
    ACCESSIBILITY_FEATURES,
    getPartnerVenues,
    getPartnerVenue,
    getPartnerVenueRating,
    addPartnerVenue,
    submitPartnerReport,
} from '../utils/payments.jsx';

// Upstream partner: Group 12, AccessMap Nairobi. Uses all 5 of their endpoints through our server:
// list venues, venue details, venue rating, add a venue and submit a report.

const noFeatures = () => Object.fromEntries(ACCESSIBILITY_FEATURES.map(([k]) => [k, false]));
const capitalise = (s) => s[0].toUpperCase() + s.slice(1);
const muted = { fontSize: '0.78rem', color: 'var(--outline)', padding: '12px 20px' };

function FeatureChecks({ idPrefix, value, onChange }) {
    return (
        <fieldset className="dash-form-checks">
            <legend>Accessibility features</legend>
            {ACCESSIBILITY_FEATURES.map(([key, label]) => (
                <label key={key} htmlFor={`${idPrefix}-${key}`}>
                    <input
                        id={`${idPrefix}-${key}`}
                        type="checkbox"
                        checked={value[key]}
                        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
                    />
                    {label}
                </label>
            ))}
        </fieldset>
    );
}

function ReportForm({ venue, onSubmitted }) {
    const today = new Date().toISOString().slice(0, 10);
    const [rating, setRating] = useState('5');
    const [visitedAt, setVisitedAt] = useState(today);
    const [description, setDescription] = useState('');
    const [features, setFeatures] = useState(() => ({ ...noFeatures(), ...venue.accessibility }));
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setStatus('');
        try {
            await submitPartnerReport({
                venueId: venue.id,
                rating: Number(rating),
                visitedAt,
                description: description.trim() || undefined,
                accessibility: features,
            });
            setStatus(`Report sent to AccessMap for ${venue.name}. Thank you!`);
            setDescription('');
            onSubmitted();
        } catch (err) {
            setStatus(`Could not send the report: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <h4 className="venue-subhead">Report your visit</h4>
            <form className="dash-form" onSubmit={handleSubmit}>
                <div className="dash-form-field">
                    <label htmlFor="report-rating">Rating</label>
                    <select id="report-rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                        {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>
                        ))}
                    </select>
                </div>
                <div className="dash-form-field">
                    <label htmlFor="report-visited">Visited on</label>
                    <input
                        id="report-visited"
                        type="date"
                        required
                        max={today}
                        value={visitedAt}
                        onChange={(e) => setVisitedAt(e.target.value)}
                    />
                </div>
                <div className="dash-form-field dash-form-field-wide">
                    <label htmlFor="report-description">What was access like? (optional)</label>
                    <input
                        id="report-description"
                        type="text"
                        maxLength={500}
                        placeholder="e.g. Ramp at the main gate, toilet locked"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <FeatureChecks idPrefix="report" value={features} onChange={setFeatures} />
                <button type="submit" className="btn" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send Report'}
                </button>
            </form>
            {status && <p className="dash-form-status">{status}</p>}
        </div>
    );
}

function VenueDetail({ slug }) {
    const [venue, setVenue] = useState(null);
    const [rating, setRating] = useState(null);
    const [error, setError] = useState('');

    function loadRating() {
        getPartnerVenueRating(slug).then(setRating).catch(() => setRating({ unavailable: true }));
    }

    // Mounted with key={slug}, so each venue starts from empty state.
    useEffect(() => {
        let alive = true;

        getPartnerVenue(slug)
            .then((v) => { if (alive) setVenue(v); })
            .catch((err) => { if (alive) setError(err.message); });
        getPartnerVenueRating(slug)
            .then((r) => { if (alive) setRating(r); })
            .catch(() => { if (alive) setRating({ unavailable: true }); });

        return () => { alive = false; };
    }, [slug]);

    if (error) return <p style={muted}>Could not load this venue: {error}</p>;
    if (!venue) return <p style={muted}>Loading venue details…</p>;

    const { lat, lng } = venue.coordinates || {};

    return (
        <div className="venue-detail">
            <div className="venue-detail-head">
                <div>
                    <h4>{venue.name}</h4>
                    <p>{venue.address} · {venue.area}</p>
                    {lat !== undefined && lng !== undefined && (
                        <p className="venue-coords">{lat}, {lng}</p>
                    )}
                </div>
                <div className="venue-rating">
                    {rating === null ? '…'
                        : rating.unavailable ? 'Rating unavailable'
                        : rating.totalReports === 0 ? 'No reports yet'
                        : <>★ {rating.averageRating.toFixed(1)} <span>from {rating.totalReports} report{rating.totalReports === 1 ? '' : 's'}</span></>}
                </div>
            </div>
            <ul className="venue-features">
                {ACCESSIBILITY_FEATURES.map(([key, label]) => (
                    <li key={key} className={venue.accessibility?.[key] ? 'yes' : 'no'}>
                        {venue.accessibility?.[key] ? '✓' : '✕'} {label}
                    </li>
                ))}
            </ul>
            <ReportForm key={venue.slug} venue={venue} onSubmitted={loadRating} />
        </div>
    );
}

function AddVenueForm({ defaultCategory, onAdded }) {
    const blank = { name: '', area: '', address: '', category: defaultCategory, lat: '', lng: '' };
    const [fields, setFields] = useState(blank);
    const [features, setFeatures] = useState(noFeatures);
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const set = (key) => (e) => setFields({ ...fields, [key]: e.target.value });

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setStatus('');
        try {
            const saved = await addPartnerVenue({
                name: fields.name.trim(),
                area: fields.area.trim(),
                address: fields.address.trim(),
                category: fields.category,
                accessibility: features,
                coordinates: { lat: Number(fields.lat), lng: Number(fields.lng) },
            });
            setStatus(`${saved.name} was added to AccessMap.`);
            setFields({ ...blank, category: fields.category });
            setFeatures(noFeatures());
            onAdded(saved);
        } catch (err) {
            setStatus(`Could not add the venue: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <form className="dash-form" onSubmit={handleSubmit}>
                <div className="dash-form-field">
                    <label htmlFor="venue-name">Name</label>
                    <input id="venue-name" type="text" required value={fields.name} onChange={set('name')} placeholder="e.g. Gikomba Market" />
                </div>
                <div className="dash-form-field">
                    <label htmlFor="venue-area">Area</label>
                    <input id="venue-area" type="text" required value={fields.area} onChange={set('area')} placeholder="e.g. Kamukunji" />
                </div>
                <div className="dash-form-field dash-form-field-wide">
                    <label htmlFor="venue-address">Address</label>
                    <input id="venue-address" type="text" required value={fields.address} onChange={set('address')} placeholder="e.g. Landhies Rd, Nairobi" />
                </div>
                <div className="dash-form-field">
                    <label htmlFor="venue-new-category">Category</label>
                    <select id="venue-new-category" value={fields.category} onChange={set('category')}>
                        {PARTNER_CATEGORIES.map((c) => <option key={c} value={c}>{capitalise(c)}</option>)}
                    </select>
                </div>
                <div className="dash-form-field">
                    <label htmlFor="venue-lat">Latitude</label>
                    <input id="venue-lat" type="number" step="any" min="-90" max="90" required value={fields.lat} onChange={set('lat')} placeholder="-1.2833" />
                </div>
                <div className="dash-form-field">
                    <label htmlFor="venue-lng">Longitude</label>
                    <input id="venue-lng" type="number" step="any" min="-180" max="180" required value={fields.lng} onChange={set('lng')} placeholder="36.8333" />
                </div>
                <FeatureChecks idPrefix="venue" value={features} onChange={setFeatures} />
                <button type="submit" className="btn" disabled={submitting}>
                    {submitting ? 'Adding…' : 'Add Venue'}
                </button>
            </form>
            {status && <p className="dash-form-status">{status}</p>}
        </div>
    );
}

export default function PartnerVenues() {
    const [category, setCategory] = useState('market');
    const [venues, setVenues] = useState(null);
    const [error, setError] = useState(false);
    const [selected, setSelected] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    // Venues reload whenever the category changes or a venue is added.
    useEffect(() => {
        let alive = true;

        getPartnerVenues(category)
            .then((v) => { if (alive) setVenues(v); })
            .catch(() => { if (alive) setError(true); });

        return () => { alive = false; };
    }, [category, reloadKey]);

    return (
        <div className="dash-card">
            <div className="dash-card-head">
                <h3>Accessible Venues — Nairobi</h3>
                <span className="dash-card-tag">AccessMap · Group 12</span>
            </div>
            <p className="dash-card-note">
                Venues and their accessibility features, so collectors with limited mobility know where they can go.
                Select a venue for full details and its community rating, or report your own visit.
            </p>
            <div className="dash-form dash-form-filter">
                <div className="dash-form-field">
                    <label htmlFor="venue-category-select">Category</label>
                    <select
                        id="venue-category-select"
                        value={category}
                        onChange={(e) => {
                            setSelected(null);
                            setVenues(null);
                            setError(false);
                            setCategory(e.target.value);
                        }}
                    >
                        {PARTNER_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{capitalise(c)}</option>
                        ))}
                    </select>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => setShowAdd(!showAdd)}>
                    {showAdd ? 'Close' : '+ Add a Venue'}
                </button>
            </div>

            {showAdd && (
                <AddVenueForm
                    defaultCategory={category}
                    onAdded={(v) => {
                        if (v.category !== category) return;
                        setVenues(null);
                        setError(false);
                        setReloadKey((k) => k + 1);
                    }}
                />
            )}

            {error ? (
                <p style={muted}>Partner data is unavailable right now. The rest of the dashboard still works.</p>
            ) : venues === null ? (
                <p style={muted}>Loading partner venues…</p>
            ) : venues.length === 0 ? (
                <p style={muted}>No {category} venues listed by AccessMap yet.</p>
            ) : (
                <div>
                    <div className="txn-head-row">
                        {['Venue', 'Area', 'Ramp', 'Toilet', 'Features'].map((t) => (
                            <span key={t}>{t}</span>
                        ))}
                    </div>
                    {venues.map((v) => (
                        <React.Fragment key={v.slug}>
                            <button
                                type="button"
                                className={`txn-row venue-row${selected === v.slug ? ' selected' : ''}`}
                                aria-expanded={selected === v.slug}
                                onClick={() => setSelected(selected === v.slug ? null : v.slug)}
                            >
                                <span className="txn-id">{v.name}</span>
                                <span className="txn-mat">{v.area}</span>
                                <span className="txn-wt">{v.ramp ? 'Yes' : 'No'}</span>
                                <span className="txn-amt">{v.accessibleToilet ? 'Yes' : 'No'}</span>
                                <span className="txn-hub">{v.featureCount} / 8</span>
                            </button>
                            {selected === v.slug && <VenueDetail key={v.slug} slug={v.slug} />}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
}
