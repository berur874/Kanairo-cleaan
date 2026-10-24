// src/utils/storage.jsx
const API_URL = import.meta.env.VITE_API_URL;

/**
 * Fetch all hotspots with their logged materials from the database.
 * Returns: [{ id, name, materials: [{ name, quantity }] }]
 */
export async function getHotspots() {
    const res = await fetch(`${API_URL}/hotspots`);
    if (!res.ok) throw new Error(`Failed to load hotspots: ${res.status}`);
    return res.json();
}

/** Pure helper — unchanged. Aggregates quantities by material name. */
export function aggregateInventory(hotspots) {
    const map = new Map();
    hotspots.forEach((hs) => hs.materials.forEach((m) => {
        map.set(m.name, (map.get(m.name) || 0) + m.quantity);
    }));
    return Array.from(map, ([name, quantity]) => ({ name, quantity }));
}