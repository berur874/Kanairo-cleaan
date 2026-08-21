
import { loadSiteData } from './data-loader.jsx';

export async function getMaterials() {
    const data = await loadSiteData();
    return data.materials;
}

export async function getHotspotShowcase() {
    const data = await loadSiteData();
    return data.hotspots;
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