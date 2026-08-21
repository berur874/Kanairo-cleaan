// src/utils/storage.jsx
import { supabase } from './supabaseClient.jsx';

/**
 * Fetch all hotspots with their logged materials from the database.
 * Returns: [{ id, name, materials: [{ name, quantity }] }]
 */
export async function getHotspots() {
    const { data, error } = await supabase
        .from('hotspots')
        .select('id, name, hotspot_materials(material_name, quantity)')
        .order('name');

    if (error) {
        console.error('Failed to load hotspots:', error);
        throw error;
    }

    return (data || []).map((hs) => ({
        id: hs.id,
        name: hs.name,
        materials: (hs.hotspot_materials || []).map((m) => ({
            name: m.material_name,
            quantity: Number(m.quantity),
        })),
    }));
}

/**
 * Log (add) material quantity at a hotspot, creating the hotspot and/or
 * material row if they don't exist yet. Adds to any existing quantity.
 */
export async function addInventory(hotspotName, materialName, quantity) {
    let { data: hotspot, error: findErr } = await supabase
        .from('hotspots')
        .select('id')
        .eq('name', hotspotName)
        .maybeSingle();

    if (findErr) throw findErr;

    if (!hotspot) {
        const { data: created, error: createErr } = await supabase
            .from('hotspots')
            .insert({ name: hotspotName })
            .select('id')
            .single();
        if (createErr) throw createErr;
        hotspot = created;
    }

    const { data: existingMat, error: matErr } = await supabase
        .from('hotspot_materials')
        .select('id, quantity')
        .eq('hotspot_id', hotspot.id)
        .eq('material_name', materialName)
        .maybeSingle();

    if (matErr) throw matErr;

    if (existingMat) {
        const { error: updErr } = await supabase
            .from('hotspot_materials')
            .update({ quantity: Number(existingMat.quantity) + quantity, updated_at: new Date().toISOString() })
            .eq('id', existingMat.id);
        if (updErr) throw updErr;
    } else {
        const { error: insErr } = await supabase
            .from('hotspot_materials')
            .insert({ hotspot_id: hotspot.id, material_name: materialName, quantity });
        if (insErr) throw insErr;
    }
}

/**
 * Deduct quantity of a material across hotspots (used when a marketplace
 * purchase is confirmed). Pulls from whichever hotspots have stock.
 */
export async function deductInventory(materialName, quantity) {
    const { data: rows, error } = await supabase
        .from('hotspot_materials')
        .select('id, quantity')
        .eq('material_name', materialName)
        .gt('quantity', 0);

    if (error) throw error;

    let remaining = quantity;
    for (const row of rows || []) {
        if (remaining <= 0) break;
        const take = Math.min(Number(row.quantity), remaining);

        const { error: updErr } = await supabase
            .from('hotspot_materials')
            .update({ quantity: Number(row.quantity) - take, updated_at: new Date().toISOString() })
            .eq('id', row.id);
        if (updErr) throw updErr;

        remaining -= take;
    }
}

/**
 * Subscribe to live inventory changes. Calls `callback` with the fresh
 * hotspots array whenever hotspots or hotspot_materials change (from any
 * client, since this uses Supabase Realtime rather than the browser's
 * `storage` event). Returns an unsubscribe function.
 */
export function onHotspotsChange(callback) {
    const refresh = () => {
        getHotspots()
            .then(callback)
            .catch((err) => console.error('Failed to refresh hotspots:', err));
    };

    // Each caller gets its own channel — multiple components (MaterialMix,
    // InventoryBars, Dashboard, etc.) may call this at the same time, and
    // Supabase channel names must be unique or `.on()` after `.subscribe()`
    // on a shared name throws.
    const channelName = `hotspots-live-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hotspots' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hotspot_materials' }, refresh)
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/** Pure helper — unchanged. Aggregates quantities by material name. */
export function aggregateInventory(hotspots) {
    const map = new Map();
    hotspots.forEach((hs) => hs.materials.forEach((m) => {
        map.set(m.name, (map.get(m.name) || 0) + m.quantity);
    }));
    return Array.from(map, ([name, quantity]) => ({ name, quantity }));
}