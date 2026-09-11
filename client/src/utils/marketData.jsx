
const API_URL = import.meta.env.VITE_API_URL;

export async function getMaterials() {
    const res = await fetch(`${API_URL}/materials`);
    if (!res.ok) throw new Error(`Failed to load materials: ${res.status}`);
    const rows = await res.json();
    return rows.map((m) => ({
        id: m.id,
        name: m.name,
        price: Number(m.price),
        unit: m.unit,
        change: Number(m.change_pct),
        trend: m.trend,
    }));
}

export async function getHotspotShowcase() {
    const res = await fetch(`${API_URL}/collection-locations`);
    if (!res.ok) throw new Error(`Failed to load hotspots: ${res.status}`);
    const rows = await res.json();
    return rows.map((h) => ({
        name: h.name,
        material: h.material,
        activity: h.activity,
        stock: h.stock,
        active: Boolean(h.active),
    }));
}

export function simulatePrices(materials) {
    return materials.map((m) => {
        const delta = (Math.random() - 0.46) * (m.price * 0.025);
        const newPrice = Math.max(1, m.price + delta);
        return {
            ...m,
            price: parseFloat(newPrice.toFixed(1)),
            change: parseFloat((m.change + delta * 0.2).toFixed(1)),
            trend: delta >= 0 ? 'up' : 'down',
        };
    });
}