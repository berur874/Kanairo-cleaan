// src/utils/storage.jsx
import { apiFetch } from '../auth/session.js';

/**
 * Fetch all hotspots with their logged materials from the database (needs a logged-in user).
 * Returns: [{ id, name, materials: [{ name, quantity }] }]
 */
export function getHotspots() {
    return apiFetch('/hotspots');
}

/** Pure helper — unchanged. Aggregates quantities by material name. */
export function aggregateInventory(hotspots) {
    const map = new Map();
    hotspots.forEach((hs) => hs.materials.forEach((m) => {
        map.set(m.name, (map.get(m.name) || 0) + m.quantity);
    }));
    return Array.from(map, ([name, quantity]) => ({ name, quantity }));
}