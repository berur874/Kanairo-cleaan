// Pieces shared by the seller (/sell) and buyer (/buy) flows.
import { useEffect, useState } from 'react';
import { getMaterials, getHotspotShowcase } from '../utils/marketData.jsx';
import { getRecommendations, formatKes, formatKg, formatRate } from '../utils/trade.jsx';
import { ACCESSIBILITY_FEATURES } from '../utils/payments.jsx';

const FEATURE_LABEL = Object.fromEntries(ACCESSIBILITY_FEATURES);

export function Steps({ steps, current }) {
    return (
        <ol className="steps" aria-label="Progress">
            {steps.map((label, i) => (
                <li key={label} className={i === current ? 'current' : i < current ? 'done' : ''}
                    aria-current={i === current ? 'step' : undefined}>
                    <span className="step-num">{i < current ? '✓' : i + 1}</span>
                    {label}
                </li>
            ))}
        </ol>
    );
}

/**
 * Step 1 of both flows: which material, how many kg, and roughly where the user is
 * (a neighbourhood from our hub list, or the device's location).
 */
export function TradeRequestForm({ mode, initial, onSubmit }) {
    const [materials, setMaterials] = useState([]);
    const [places, setPlaces] = useState([]);
    const [materialId, setMaterialId] = useState(initial?.materialId || '');
    const [quantity, setQuantity] = useState(initial?.quantityKg ? String(initial.quantityKg) : '');
    const [place, setPlace] = useState(initial?.place || '');
    const [gps, setGps] = useState(initial?.place === 'gps' ? initial.origin : null);
    const [gpsStatus, setGpsStatus] = useState('');

    useEffect(() => {
        let alive = true;
        getMaterials().then((m) => { if (alive) setMaterials(m); }).catch(() => {});
        getHotspotShowcase()
            .then((hs) => { if (alive) setPlaces(hs.filter((h) => h.lat !== null)); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    function useMyLocation() {
        if (!navigator.geolocation) {
            setGpsStatus('Your browser cannot share its location. Pick a neighbourhood instead.');
            return;
        }
        setGpsStatus('Finding you…');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setPlace('gps');
                setGpsStatus('');
            },
            () => setGpsStatus('Could not get your location. Pick a neighbourhood instead.'),
            { timeout: 10000 }
        );
    }

    function handleSubmit(e) {
        e.preventDefault();
        const chosen = places.find((p) => String(p.id) === place);
        const origin = place === 'gps' ? gps : chosen ? { lat: chosen.lat, lng: chosen.lng } : null;
        onSubmit({
            materialId,
            material: materials.find((m) => m.id === materialId),
            quantityKg: Number(quantity),
            place,
            origin,
        });
    }

    const verb = mode === 'sell' ? 'collect' : 'need';

    return (
        <form className="dash-form trade-form" onSubmit={handleSubmit}>
            <div className="dash-form-field">
                <label htmlFor="trade-material">What did you {verb}?</label>
                <select id="trade-material" required value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                    <option value="" disabled>Choose a material…</option>
                    {materials.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} · {formatRate(m.price)}</option>
                    ))}
                </select>
            </div>
            <div className="dash-form-field">
                <label htmlFor="trade-qty">How much? (kg)</label>
                <input id="trade-qty" type="number" min="0.1" max="10000" step="0.1" required placeholder="e.g. 25"
                    value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="dash-form-field">
                <label htmlFor="trade-place">Where are you? (optional)</label>
                <select id="trade-place" value={place} onChange={(e) => setPlace(e.target.value)}>
                    <option value="">Anywhere in Nairobi</option>
                    {gps && <option value="gps">My current location</option>}
                    {places.map((p) => <option key={p.id} value={String(p.id)}>Near {p.name}</option>)}
                </select>
                <button type="button" className="text-button" onClick={useMyLocation}>Use my location</button>
                {gpsStatus && <p className="field-hint">{gpsStatus}</p>}
            </div>
            <button type="submit" className="btn">
                {mode === 'sell' ? 'Find the best hub →' : 'Find hubs with stock →'}
            </button>
        </form>
    );
}

/** Step 2: hubs ranked by the server, with the reasons, payout or price, and nearby accessible venues. */
export function HubRecommendations({ mode, request, onChoose }) {
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        getRecommendations({ mode, materialId: request.materialId, quantityKg: request.quantityKg, origin: request.origin })
            .then((r) => { if (alive) setResult(r); })
            .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
    }, [mode, request]);

    if (error) return <p className="form-error">{error}</p>;
    if (!result) return <p className="muted-note">Finding the best hubs…</p>;

    const needs = result.accessibility_needs;

    return (
        <div>
            {needs.length > 0 && !result.accessibility_note && (
                <p className="access-banner">
                    ♿ Ranked for your needs ({needs.map((n) => FEATURE_LABEL[n]).join(', ')}) using AccessMap Nairobi venues near each hub.
                </p>
            )}
            {result.accessibility_note && <p className="access-banner warn">{result.accessibility_note}</p>}

            {result.hubs.length === 0 ? (
                <p className="muted-note">
                    No hub has {formatKg(result.quantity_kg)} of {result.material.name} right now. Try a smaller amount.
                </p>
            ) : (
                <ol className="hub-cards">
                    {result.hubs.map((h, i) => (
                        <li key={h.hotspot_id} className={`hub-card${i === 0 ? ' best' : ''}`}>
                            <div className="hub-card-head">
                                <div>
                                    {i === 0 && <span className="hub-badge">Best match</span>}
                                    <h4>{h.name}</h4>
                                    <p className="hub-area">{h.area}</p>
                                </div>
                                <div className="hub-money">
                                    <span className="hub-money-label">{mode === 'sell' ? 'You get about' : 'You pay'}</span>
                                    <span className="hub-money-value">{formatKes(h.est_amount_kes)}</span>
                                    <span className="hub-money-label">{formatRate(h.price_per_kg)}</span>
                                </div>
                            </div>

                            <ul className="hub-reasons">
                                {h.reasons.map((r) => <li key={r}>{r}</li>)}
                            </ul>

                            {h.accessibility?.venues.length > 0 && (
                                <div className="hub-venues">
                                    <span className="hub-venues-label">Accessible places nearby (AccessMap)</span>
                                    {h.accessibility.venues.map((v) => (
                                        <div key={v.slug} className="hub-venue">
                                            <strong>{v.name}</strong> · {v.distance_km} km
                                            <ul className="venue-features">
                                                {v.features.map((f) => (
                                                    <li key={f} className={needs.includes(f) ? 'yes' : 'no'}>✓ {FEATURE_LABEL[f]}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button type="button" className="btn" onClick={() => onChoose(h, result.material)}>
                                {mode === 'sell' ? 'Drop off here' : 'Buy from this hub'}
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
