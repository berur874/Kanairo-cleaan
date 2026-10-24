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

  // ---------------------------------------------------------------------------------------------
  // Seller: log collected scrap as a drop-off at a hub. It stays "pending" until the hub weighs it.

  router.post('/sell/drop-offs', requireUser('seller'), async (req, res) => {
    const { hotspot_id, material_id, notes } = req.body || {};
    const quantity = req.body?.quantity_kg;
    if (!isPositiveKg(quantity)) return sendError(res, 400, `quantity_kg must be a number between 0 and ${MAX_KG}`);
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
      return sendError(res, 400, 'notes must be text of at most 500 characters');
    }

    try {
      const hub = await findActiveHub(hotspot_id);
      if (!hub) return sendError(res, 400, 'hotspot_id must be an active hub');
      const material = await findMaterial(material_id);
      if (!material) return sendError(res, 400, 'material_id must be one of the materials in the catalogue');

      const [result] = await pool.query(
        `INSERT INTO drop_offs (hotspot_id, material_type, quantity_kg, source, notes, seller_id, material_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [hub.id, material.type, quantity, `Seller: ${req.user.name}`.slice(0, 120), notes?.trim() || null, req.user.id, material.id]
      );
      // Same readable id as Group 1's drop-offs, so both appear in one hub queue.
      await pool.query(`UPDATE drop_offs SET drop_off_id = CONCAT('drop-', LPAD(id, 4, '0')) WHERE id = ?`, [result.insertId]);

      res.status(201).json(await getDropOff(result.insertId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/sell/drop-offs', requireUser('seller'), async (req, res) => {
    try {
      const [rows] = await pool.query(`${DROP_OFF_SELECT} WHERE d.seller_id = ? ORDER BY d.created_at DESC, d.id DESC`, [req.user.id]);
      res.json(rows.map(shapeDropOff));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Hub manager: everything is limited to the manager's own hub (req.user.hotspot_id).

  router.get('/hub/drop-offs', requireUser('hub_manager'), async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !['pending', 'received'].includes(status)) {
      return sendError(res, 400, 'status must be pending or received');
    }
    try {
      const [rows] = await pool.query(
        `${DROP_OFF_SELECT} WHERE d.hotspot_id = ? ${status ? 'AND d.status = ?' : ''} ORDER BY d.created_at DESC, d.id DESC`,
        status ? [req.user.hotspot_id, status] : [req.user.hotspot_id]
      );
      res.json(rows.map(shapeDropOff));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Weigh a drop-off: records the real weight, works out the seller's payout and adds the stock.
  // Group 1 drop-offs only carry a material type, so the manager names the material (material_id).
  router.post('/hub/drop-offs/:drop_off_id/receive', requireUser('hub_manager'), async (req, res) => {
    const receivedKg = req.body?.received_kg;
    if (!isPositiveKg(receivedKg)) return sendError(res, 400, `received_kg must be a number between 0 and ${MAX_KG}`);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[drop]] = await conn.query(
        'SELECT * FROM drop_offs WHERE drop_off_id = ? AND hotspot_id = ? FOR UPDATE',
        [req.params.drop_off_id, req.user.hotspot_id]
      );
      if (!drop) {
        await conn.rollback();
        return sendError(res, 404, `Drop-off ${req.params.drop_off_id} not found at your hub`);
      }
      if (drop.status === 'received') {
        await conn.rollback();
        return sendError(res, 409, 'This drop-off has already been received');
      }

      const material = await findMaterial(drop.material_id || req.body?.material_id, conn);
      if (!material) {
        await conn.rollback();
        return sendError(res, 400, 'Choose which material this is (material_id)');
      }
      if (material.type !== drop.material_type) {
        await conn.rollback();
        return sendError(res, 400, `This drop-off is ${drop.material_type}; ${material.name} is ${material.type}`);
      }

      const payout = Math.round(receivedKg * Number(material.price) * 100) / 100;
      await conn.query(
        `UPDATE drop_offs SET status = 'received', material_id = ?, received_kg = ?, payout_kes = ?, received_at = NOW()
         WHERE id = ?`,
        [material.id, receivedKg, payout, drop.id]
      );
      await addStock(conn, drop.hotspot_id, material, receivedKg);
      await conn.commit();

      res.json(await getDropOff(drop.id));
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      conn.release();
    }
  });

  router.get('/hub/orders', requireUser('hub_manager'), async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !['paid', 'collected'].includes(status)) {
      return sendError(res, 400, 'status must be paid or collected');
    }
    try {
      const [rows] = await pool.query(
        `${ORDER_SELECT} WHERE t.hotspot_id = ? ${status ? 'AND t.status = ?' : ''} ORDER BY t.created_at DESC`,
        status ? [req.user.hotspot_id, status] : [req.user.hotspot_id]
      );
      res.json(rows.map(shapeOrder));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/hub/orders/:id/collect', requireUser('hub_manager'), async (req, res) => {
    try {
      const [[order]] = await pool.query('SELECT id, status FROM transactions WHERE id = ? AND hotspot_id = ?', [
        req.params.id,
        req.user.hotspot_id,
      ]);
      if (!order) return sendError(res, 404, `Order ${req.params.id} not found at your hub`);
      if (order.status === 'collected') return sendError(res, 409, 'This order has already been collected');

      await pool.query(`UPDATE transactions SET status = 'collected', collected_at = NOW() WHERE id = ?`, [order.id]);
      res.json(await getOrder(order.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/hub/summary', requireUser('hub_manager'), async (req, res) => {
    try {
      const summary = await buildSummary(pool, req.user.hotspot_id);
      const [[queue]] = await pool.query(
        `SELECT
           SUM(status = 'pending') AS pending,
           COALESCE(SUM(CASE WHEN status = 'received' THEN payout_kes END), 0) AS paid_out
         FROM drop_offs WHERE hotspot_id = ?`,
        [req.user.hotspot_id]
      );
      const [[orders]] = await pool.query(
        `SELECT SUM(status = 'paid') AS to_hand_over FROM transactions WHERE hotspot_id = ?`,
        [req.user.hotspot_id]
      );
      const [[hub]] = await pool.query('SELECT id, name, area FROM hotspots WHERE id = ?', [req.user.hotspot_id]);
      res.json({
        ...summary,
        hub,
        pendingDropOffs: Number(queue.pending) || 0,
        sellerPayoutsTotal: Number(queue.paid_out),
        ordersToHandOver: Number(orders.to_hand_over) || 0,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Buyer: order material from one hub. Payment is the M-Pesa simulator in the client.

  router.post('/buy/orders', requireUser('buyer'), async (req, res) => {
    const { hotspot_id, material_id } = req.body || {};
    const quantity = req.body?.quantity_kg;
    if (!isPositiveKg(quantity)) return sendError(res, 400, `quantity_kg must be a number between 0 and ${MAX_KG}`);

    const conn = await pool.getConnection();
    try {
      const hub = await findActiveHub(hotspot_id, conn);
      if (!hub) return sendError(res, 400, 'hotspot_id must be an active hub');
      const material = await findMaterial(material_id, conn);
      if (!material) return sendError(res, 400, 'material_id must be one of the materials in the catalogue');

      await conn.beginTransaction();
      const [[stock]] = await conn.query(
        'SELECT id, quantity FROM hotspot_materials WHERE hotspot_id = ? AND material_name = ? FOR UPDATE',
        [hub.id, material.name]
      );
      const available = stock ? Number(stock.quantity) : 0;
      if (available < quantity) {
        await conn.rollback();
        return sendError(res, 409, `${hub.name} only has ${available} kg of ${material.name}`);
      }

      await addStock(conn, hub.id, material, -quantity);
      const id = generateReceipt();
      await conn.query(
        `INSERT INTO transactions (id, material, quantity, amount, buyer_id, hotspot_id, material_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')`,
        [id, material.name, quantity, Math.round(quantity * Number(material.price)), req.user.id, hub.id, material.id]
      );
      await conn.commit();

      res.status(201).json(await getOrder(id));
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      conn.release();
    }
  });

  router.get('/buy/orders', requireUser('buyer'), async (req, res) => {
    try {
      const [rows] = await pool.query(`${ORDER_SELECT} WHERE t.buyer_id = ? ORDER BY t.created_at DESC`, [req.user.id]);
      res.json(rows.map(shapeOrder));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Helpers shared by the routes above.

  async function findActiveHub(id, db = pool) {
    if (!Number.isInteger(Number(id))) return null;
    const [[hub]] = await db.query('SELECT id, name FROM hotspots WHERE id = ? AND active = 1', [Number(id)]);
    return hub || null;
  }

  async function findMaterial(id, db = pool) {
    if (typeof id !== 'string' || !id) return null;
    const [[material]] = await db.query('SELECT id, name, type, price FROM materials WHERE id = ?', [id]);
    return material || null;
  }

  // Keeps the three stock figures in step: the hub's line, the hub total and the catalogue total
  // (the catalogue total is what Group 1 sees as quantity_kg on GET /materials).
  async function addStock(conn, hotspotId, material, kg) {
    await conn.query(
      `INSERT INTO hotspot_materials (hotspot_id, material_name, quantity) VALUES (?, ?, GREATEST(?, 0))
       ON DUPLICATE KEY UPDATE quantity = GREATEST(quantity + ?, 0)`,
      [hotspotId, material.name, kg, kg]
    );
    // The totals are whole kg. Round away from zero on both sides, so receiving then selling the
    // same 9.5 kg nets to 0 (Math.round alone gives +10 then -9).
    const wholeKg = Math.sign(kg) * Math.round(Math.abs(kg));
    await conn.query('UPDATE hotspots SET stock_kg = GREATEST(stock_kg + ?, 0) WHERE id = ?', [wholeKg, hotspotId]);
    await conn.query('UPDATE materials SET stock_kg = GREATEST(stock_kg + ?, 0) WHERE id = ?', [wholeKg, material.id]);
  }

  async function getDropOff(id) {
    const [[row]] = await pool.query(`${DROP_OFF_SELECT} WHERE d.id = ?`, [id]);
    return shapeDropOff(row);
  }

  async function getOrder(id) {
    const [[row]] = await pool.query(`${ORDER_SELECT} WHERE t.id = ?`, [id]);
    return shapeOrder(row);
  }

  return { router, venueCache };
}

const MAX_KG = 10000;

function isPositiveKg(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_KG;
}

const DROP_OFF_SELECT = `
  SELECT d.*, h.name AS hub_name, m.name AS material_name, m.price AS material_price,
         u.name AS seller_name, u.phone AS seller_phone
  FROM drop_offs d
  JOIN hotspots h ON h.id = d.hotspot_id
  LEFT JOIN materials m ON m.id = d.material_id
  LEFT JOIN users u ON u.id = d.seller_id`;

function shapeDropOff(row) {
  const quantity = Number(row.quantity_kg);
  return {
    drop_off_id: row.drop_off_id,
    hub: { id: row.hotspot_id, name: row.hub_name },
    material: row.material_id ? { id: row.material_id, name: row.material_name } : null,
    material_type: row.material_type,
    quantity_kg: quantity,
    // Before weighing, the seller sees what they can expect at today's price.
    est_payout_kes: row.material_price === null ? null : Math.round(quantity * Number(row.material_price)),
    received_kg: row.received_kg === null ? null : Number(row.received_kg),
    payout_kes: row.payout_kes === null ? null : Number(row.payout_kes),
    status: row.status,
    // Group 1 drop-offs have no seller account; their free-text source says who they are.
    seller: row.seller_id ? { id: row.seller_id, name: row.seller_name, phone: row.seller_phone } : null,
    source: row.source,
    notes: row.notes || null,
    created_at: new Date(row.created_at).toISOString(),
    received_at: row.received_at ? new Date(row.received_at).toISOString() : null,
  };
}

const ORDER_SELECT = `
  SELECT t.*, h.name AS hub_name, u.name AS buyer_name, u.phone AS buyer_phone
  FROM transactions t
  LEFT JOIN hotspots h ON h.id = t.hotspot_id
  LEFT JOIN users u ON u.id = t.buyer_id`;

function shapeOrder(row) {
  return {
    id: row.id,
    hub: row.hotspot_id ? { id: row.hotspot_id, name: row.hub_name } : null,
    material: { id: row.material_id, name: row.material },
    quantity_kg: Number(row.quantity),
    amount_kes: Number(row.amount),
    status: row.status,
    buyer: row.buyer_id ? { id: row.buyer_id, name: row.buyer_name, phone: row.buyer_phone } : null,
    created_at: new Date(row.created_at).toISOString(),
    collected_at: row.collected_at ? new Date(row.collected_at).toISOString() : null,
  };
}

function generateReceipt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'KAN';
  for (let i = 0; i < 7; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// Totals and a 7-day breakdown of sales, for every hub (hotspotId null) or one hub.
async function buildSummary(pool, hotspotId = null) {
  const where = hotspotId === null ? '' : 'WHERE hotspot_id = ?';
  const params = hotspotId === null ? [] : [hotspotId];
  const [[totals]] = await pool.query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue, COALESCE(SUM(quantity),0) AS weight FROM transactions ${where}`,
    params
  );
  const [dailyRows] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, SUM(amount) AS revenue, SUM(quantity) AS weight
     FROM transactions
     WHERE created_at >= (CURDATE() - INTERVAL 6 DAY) ${hotspotId === null ? '' : 'AND hotspot_id = ?'}
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
    params
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekly = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const match = dailyRows.find((r) => r.day === iso);
    weekly.push({
      day: dayNames[d.getDay()],
      revenue: match ? Number(match.revenue) : 0,
      weight: match ? Number(match.weight) : 0,
    });
  }

  return {
    transactionCount: totals.count,
    revenueTotal: Number(totals.revenue),
    weightTotal: Number(totals.weight),
    weekly,
  };
}

module.exports = { createMarketplace, buildSummary, generateReceipt, distanceKm, ACCESS_RADIUS_KM };
