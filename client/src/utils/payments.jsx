// src/utils/payments.jsx

const API_URL = import.meta.env.VITE_API_URL;

/** Group 12's venue categories, from the Venue.category enum in their contract. */
export const PARTNER_CATEGORIES = ['market', 'hospital', 'school', 'transport', 'office', 'bank', 'other'];

/** Venues of one category from our upstream partner (Group 12), proxied through our own server. */
export async function getPartnerVenues(category = 'market') {
    const res = await fetch(`${API_URL}/partner/venues?category=${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error(`Partner data unavailable: ${res.status}`);
    return res.json();
}

/** Group 12's 8 accessibility features, from the Accessibility object in their contract, with display labels. */
export const ACCESSIBILITY_FEATURES = [
    ['ramp', 'Ramp'],
    ['lift', 'Lift'],
    ['accessibleToilet', 'Accessible toilet'],
    ['accessibleParking', 'Accessible parking'],
    ['tactilePaving', 'Tactile paving'],
    ['wideCorridors', 'Wide corridors'],
    ['audioAssistance', 'Audio assistance'],
    ['staffAssistance', 'Staff assistance'],
];

/** Throws with the server's message (e.g. Group 12's validation error) so forms can show it. */
async function partnerJson(res) {
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || `Partner data unavailable: ${res.status}`);
    return body;
}

/** Full details of one venue: address, coordinates and all 8 accessibility features. */
export async function getPartnerVenue(slug) {
    return partnerJson(await fetch(`${API_URL}/partner/venues/${encodeURIComponent(slug)}`));
}

/** Average community rating for one venue: { averageRating, totalReports }. */
export async function getPartnerVenueRating(slug) {
    return partnerJson(await fetch(`${API_URL}/partner/venues/${encodeURIComponent(slug)}/rating`));
}

/** Adds a venue to Group 12's live directory. */
export async function addPartnerVenue(venue) {
    return partnerJson(await fetch(`${API_URL}/partner/venues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venue),
    }));
}

/** Submits an accessibility report (rating 1-5) for a venue to Group 12. */
export async function submitPartnerReport(report) {
    return partnerJson(await fetch(`${API_URL}/partner/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
    }));
}

export function showSuccessNotification(message = 'Transaction complete') {
    let container = document.getElementById('mpesa-alert-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'mpesa-alert-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '84px',
            right: '20px',
            zIndex: '999999',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
        });
        document.body.appendChild(container);
    }

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#0b180b',
        border: '1px solid rgba(34,197,94,.3)',
        borderLeft: '3px solid #22c55e',
        color: '#e2f0e2',
        fontFamily: "'Inter', sans-serif",
        padding: '14px 22px',
        borderRadius: '2px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
        fontSize: '0.85rem',
        fontWeight: '600',
        opacity: '0',
        transform: 'translateY(-12px)',
        transition: 'all 0.3s ease',
        maxWidth: '320px',
    });
    box.textContent = message;
    container.appendChild(box);

    requestAnimationFrame(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(-10px)';
        setTimeout(() => box.remove(), 300);
    }, 4500);
}
