// src/utils/storage.jsx
import { useState, useEffect } from 'react';

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

/**
 * Log (add) material quantity at a hotspot, creating the hotspot if it
 * doesn't exist yet. Adds to any existing quantity.
 */
export async function addInventory(hotspotName, materialName, quantity) {
    const res = await fetch(`${API_URL}/hotspots/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotspotName, materialName, quantity }),
    });
    if (!res.ok) throw new Error(`Failed to log inventory: ${res.status}`);
}

/**
 * Deduct quantity of a material across hotspots (used when a marketplace
 * purchase is confirmed). Pulls from whichever hotspots have stock.
 */
export async function deductInventory(materialName, quantity) {
    const res = await fetch(`${API_URL}/inventory/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialName, quantity }),
    });
    if (!res.ok) throw new Error(`Failed to deduct inventory: ${res.status}`);
}

/**
 * Fires once with the current hotspots snapshot (no polling/live push —
 * this is a one-shot read from the DB). Returns a no-op unsubscribe for
 * call-site compatibility.
 */
export function onHotspotsChange(callback) {
    getHotspots().then(callback).catch((err) => console.error('Failed to refresh hotspots:', err));
    return () => {};
}

/**
 * Shared hook: fetches hotspots once, for use by a single owning component
 * (e.g. a page) that then passes `hotspots` down as a prop.
 */
export function useHotspots() {
    const [hotspots, setHotspots] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;

        getHotspots()
            .then((hs) => {
                if (alive) {
                    setHotspots(hs);
                    setLoading(false);
                }
            })
            .catch((err) => {
                console.error('Failed to load hotspots:', err);
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, []);

    return { hotspots, loading };
}

/** Pure helper — unchanged. Aggregates quantities by material name. */
export function aggregateInventory(hotspots) {
    const map = new Map();
    hotspots.forEach((hs) => hs.materials.forEach((m) => {
        map.set(m.name, (map.get(m.name) || 0) + m.quantity);
    }));
    return Array.from(map, ([name, quantity]) => ({ name, quantity }));
}