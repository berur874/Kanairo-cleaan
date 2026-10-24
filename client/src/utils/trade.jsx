// src/utils/trade.jsx — calls for the seller → hub → buyer flow (server/marketplace.js).
// All of them need a logged-in user, so they go through apiFetch.
import { apiFetch } from '../auth/session.js';

/** Hubs ranked for selling or buying `quantityKg` of a material; `origin` is {lat, lng} or null. */
export function getRecommendations({ mode, materialId, quantityKg, origin }) {
    const params = new URLSearchParams({ mode, material_id: materialId, quantity_kg: String(quantityKg) });
    if (origin) {
        params.set('lat', String(origin.lat));
        params.set('lng', String(origin.lng));
    }
    return apiFetch(`/recommendations/hubs?${params}`);
}

/** Every material with today's price and the stock at each active hub. */
export const getMarket = () => apiFetch('/market');

/** AccessMap venues near a hub, for reporting on the place after a visit. */
export const getNearbyVenues = (hotspotId) => apiFetch(`/hubs/${encodeURIComponent(hotspotId)}/nearby-venues`);

// Seller
export const createDropOff = ({ hotspotId, materialId, quantityKg, notes }) =>
    apiFetch('/sell/drop-offs', {
        method: 'POST',
        body: { hotspot_id: hotspotId, material_id: materialId, quantity_kg: quantityKg, notes: notes || undefined },
    });
export const getMyDropOffs = () => apiFetch('/sell/drop-offs');

// Buyer
export const placeOrder = ({ hotspotId, materialId, quantityKg }) =>
    apiFetch('/buy/orders', { method: 'POST', body: { hotspot_id: hotspotId, material_id: materialId, quantity_kg: quantityKg } });
export const getMyOrders = () => apiFetch('/buy/orders');

// Hub manager (always the manager's own hub)
export const getHubSummary = () => apiFetch('/hub/summary');
export const getHubDropOffs = (status) => apiFetch(`/hub/drop-offs${status ? `?status=${status}` : ''}`);
export const receiveDropOff = (dropOffId, { receivedKg, materialId }) =>
    apiFetch(`/hub/drop-offs/${encodeURIComponent(dropOffId)}/receive`, {
        method: 'POST',
        body: { received_kg: receivedKg, material_id: materialId },
    });
export const getHubOrders = (status) => apiFetch(`/hub/orders${status ? `?status=${status}` : ''}`);
export const collectOrder = (orderId) => apiFetch(`/hub/orders/${encodeURIComponent(orderId)}/collect`, { method: 'POST' });

export const formatKes = (n) => `KES ${Math.round(n).toLocaleString()}`;
// Per-kg prices keep their cents (PET is 28.50/kg, not 29).
export const formatRate = (n) => `KES ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg`;
export const formatKg = (n) => `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
export const formatDate = (iso) =>
    new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
