// Webapp buying and selling: hub recommendations for sellers and buyers.
// Every route needs a logged-in user (see auth.js).

const express = require('express');
const { ACCESSIBILITY_FEATURES } = require('./accessibility');

// AccessMap venues within this distance of a hub count towards its accessibility.
const ACCESS_RADIUS_KM = 3;
// Group 12's data only needs to be a day fresh (API_NEEDS.md, Need 1), so one fetch serves everyone.
const VENUE_CACHE_MS = 24 * 60 * 60 * 1000;

function sendError(res, status, message) {
  return res.status(status).json({ code: status, message });
}

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const round1 = (n) => Math.round(n * 10) / 10;

function featureLabel(key) {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

// Venues from Group 12, cached in memory. Tests replace the contents with set().
function createVenueCache({ callPartner }) {
  let venues = null;
  let fetchedAt = 0;

  return {
    async get() {
      if (venues && Date.now() - fetchedAt < VENUE_CACHE_MS) return venues;
      const r = await callPartner('/api/venues');
      if (r.status !== 200 || !Array.isArray(r.body)) throw new Error(`AccessMap returned status ${r.status}`);
      venues = r.body;
      fetchedAt = Date.now();
      return venues;
    },
    set(list) {
      venues = list;
      fetchedAt = list ? Date.now() : 0;
    },
  };
}

// Accessible AccessMap venues near one hub, for a user who needs `needs` (all of them).
function accessibilityNearHub(hub, venues, needs) {
  const nearby = venues
    .filter((v) => Number.isFinite(v.coordinates?.lat) && Number.isFinite(v.coordinates?.lng))
    .map((v) => ({ venue: v, km: distanceKm(hub, v.coordinates) }))
    .filter(({ km }) => km <= ACCESS_RADIUS_KM)
    .filter(({ venue }) => needs.every((n) => venue.accessibility?.[n] === true))
    .sort((a, b) => a.km - b.km);

  return {
    qualifying: nearby.length,
    venues: nearby.slice(0, 3).map(({ venue, km }) => ({
      name: venue.name,
      slug: venue.slug,
      area: venue.area,
      distance_km: round1(km),
      features: ACCESSIBILITY_FEATURES.filter((k) => venue.accessibility?.[k] === true),
    })),
  };
}

function createMarketplace({ pool, requireUser, callPartner }) {
  const router = express.Router();
  const venueCache = createVenueCache({ callPartner });

  // GET /recommendations/hubs?material_id=PET&quantity_kg=20&mode=sell|buy[&lat=&lng=]
  // sell: hubs to take the seller's scrap to. buy: hubs that have at least quantity_kg in stock.
  router.get('/recommendations/hubs', requireUser(), async (req, res) => {
    const { material_id, mode = 'sell' } = req.query;
    const quantity = Number(req.query.quantity_kg);
    if (!['sell', 'buy'].includes(mode)) return sendError(res, 400, 'mode must be sell or buy');
    if (!Number.isFinite(quantity) || quantity <= 0) return sendError(res, 400, 'quantity_kg must be a positive number');

    let origin = null;
    if (req.query.lat !== undefined || req.query.lng !== undefined) {
      origin = { lat: Number(req.query.lat), lng: Number(req.query.lng) };
      if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng) || Math.abs(origin.lat) > 90 || Math.abs(origin.lng) > 180) {
        return sendError(res, 400, 'lat and lng must be valid coordinates');
      }
    }

    try {
      const [[material]] = await pool.query('SELECT id, name, price FROM materials WHERE id = ?', [material_id ?? '']);
      if (!material) return sendError(res, 400, 'material_id must be one of the materials in the catalogue');

      const [hubs] = await pool.query(
        `SELECT h.id, h.name, h.area, h.lat, h.lng, h.activity, h.primary_material_id,
                COALESCE(hm.quantity, 0) AS stock
         FROM hotspots h
         LEFT JOIN hotspot_materials hm ON hm.hotspot_id = h.id AND hm.material_name = ?
         WHERE h.active = 1`,
        [material.name]
      );

      const needs = req.user.accessibility_needs || [];
      let venues = null;
      let accessibilityNote = null;
      if (needs.length) {
        try {
          venues = await venueCache.get();
        } catch (err) {
          console.error('recommendations: AccessMap unavailable:', err.message);
          accessibilityNote = 'AccessMap is unavailable right now, so hubs are not ranked by accessibility.';
        }
      }

      const price = Number(material.price);
      const candidates = hubs.filter((h) => mode === 'sell' || Number(h.stock) >= quantity);

      const ranked = candidates.map((h) => {
        const hub = { lat: Number(h.lat), lng: Number(h.lng) };
        const hasCoords = h.lat !== null && h.lng !== null;
        const stock = Number(h.stock);
        const reasons = [];
        let score = 0;

        if (mode === 'sell') {
          const handles = stock > 0 || h.primary_material_id === material.id;
          if (handles) {
            score += 40;
            reasons.push(`Already buys ${material.name}`);
          }
          score += (Number(h.activity) || 0) / 10;
        } else {
          score += 40 + Math.min(10, stock / Math.max(quantity, 1));
          reasons.push(`${Math.round(stock).toLocaleString()} kg of ${material.name} in stock`);
        }

        let distance = null;
        if (origin && hasCoords) {
          distance = distanceKm(origin, hub);
          score += Math.max(0, 30 - distance * 3);
          reasons.push(`${round1(distance)} km from you`);
        }

        let accessibility = null;
        if (venues && hasCoords) {
          accessibility = accessibilityNearHub(hub, venues, needs);
          if (accessibility.qualifying) {
            score += Math.min(30, 15 + accessibility.qualifying * 5);
            const plural = accessibility.qualifying === 1 ? 'venue' : 'venues';
            reasons.push(`${accessibility.qualifying} AccessMap ${plural} within ${ACCESS_RADIUS_KM} km with ${needs.map(featureLabel).join(' + ')}`);
          } else {
            reasons.push(`No AccessMap venue within ${ACCESS_RADIUS_KM} km has ${needs.map(featureLabel).join(' + ')} yet`);
          }
        }

        return {
          hotspot_id: h.id,
          name: h.name,
          area: h.area,
          lat: hasCoords ? hub.lat : null,
          lng: hasCoords ? hub.lng : null,
          distance_km: distance === null ? null : round1(distance),
          price_per_kg: price,
          stock_kg: stock,
          est_amount_kes: Math.round(quantity * price),
          score: Math.round(score),
          reasons,
          accessibility,
        };
      });

      ranked.sort((a, b) => b.score - a.score);
      res.json({
        mode,
        material: { id: material.id, name: material.name, price_per_kg: price },
        quantity_kg: quantity,
        accessibility_needs: needs,
        accessibility_note: accessibilityNote,
        hubs: ranked,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return { router, venueCache };
}

module.exports = { createMarketplace, distanceKm, ACCESS_RADIUS_KM };
