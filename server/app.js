require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

async function ensureScrapLogsSchema() {
  const additions = [
    ['log_id', 'varchar(30) NULL'],
    ['job_id', 'varchar(50) NULL'],
    ['artisan_id', 'varchar(50) NULL'],
    ['material_type', 'varchar(50) NULL'],
    ['notes', 'text NULL'],
  ];
  for (const [column, definition] of additions) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scrap_logs' AND COLUMN_NAME = ?`,
      [column]
    );
    if (!rows[0].count) await pool.query(`ALTER TABLE scrap_logs ADD COLUMN ${column} ${definition}`);
  }
  await pool.query(`UPDATE scrap_logs SET log_id = CONCAT('log-', LPAD(id, 4, '0')) WHERE log_id IS NULL OR log_id = ''`);
}

function buildBadRequest(res, message) {
  return res.status(400).json({ code: 400, message });
}

// The fixed list of material types published in openapi.yaml (Material.type enum).
const MATERIAL_TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

// Contract routes require "Authorization: Bearer <API_TOKEN>". Fails closed if API_TOKEN is unset.
function requireApiToken(req, res, next) {
  const expected = process.env.API_TOKEN;
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (!expected || scheme !== 'Bearer' || !token || !crypto.timingSafeEqual(sha256(token), sha256(expected))) {
    return res.status(401).json({ code: 401, message: 'Missing or invalid API token' });
  }
  next();
}

//To be used by group one — response shaped to match openapi.yaml Material schema exactly
app.get('/materials', requireApiToken, async (req, res) => {
  const { type, min_quantity_kg } = req.query;

  if (type !== undefined && !MATERIAL_TYPES.includes(type)) {
    return buildBadRequest(res, `type must be one of: ${MATERIAL_TYPES.join(', ')}`);
  }

  const minQuantity = Number(min_quantity_kg);
  if (min_quantity_kg !== undefined && (typeof min_quantity_kg !== 'string' || min_quantity_kg.trim() === '' || !Number.isFinite(minQuantity) || minQuantity < 0)) {
    return buildBadRequest(res, 'min_quantity_kg must be a number greater than or equal to 0');
  }

  let sql = 'SELECT id, name, type, price, stock_kg FROM materials WHERE 1=1';
  const params = [];
  if (type !== undefined) { sql += ' AND type = ?'; params.push(type); }
  if (min_quantity_kg !== undefined) { sql += ' AND stock_kg >= ?'; params.push(minQuantity); }

  try {
    const [rows] = await pool.query(sql, params);
    const materials = rows.map((row) => ({
      material_id: row.id,
      name: row.name,
      type: row.type,
      quantity_kg: Number(row.stock_kg),
      unit_price_kes: Number(row.price),
    }));
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//To be used by group one — response shaped to match openapi.yaml CollectionLocation schema exactly
app.get('/collection-locations', requireApiToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, area, county, active FROM hotspots WHERE active = 1');
    const locations = rows.map((row) => ({
      location_id: String(row.id),
      name: row.name,
      area: row.area,
      county: row.county,
      is_active: Boolean(row.active),
    }));
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Internal — not part of the Group 1 contract, feeds the frontend price ticker/marketplace UI
app.get('/materials/market', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM materials');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Internal — not part of the Group 1 contract, feeds the frontend hotspot showcase UI
app.get('/collection-locations/showcase', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.name, h.area, m.name AS material, h.activity, h.stock_kg AS stock, h.active
       FROM hotspots h
       LEFT JOIN materials m ON h.primary_material_id = m.id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Replaces POST /scrap-logs for consumers: the drop-off is tied to a location we own, and the caller
// identifies itself with free-text `source` instead of its own job/artisan ids.
app.post('/collection-locations/:location_id/drop-offs', requireApiToken, async (req, res) => {
  const { location_id } = req.params;
  const { material_type, quantity_kg, source, notes } = req.body;

  try {
    const [[location]] = /^\d+$/.test(location_id)
      ? await pool.query('SELECT id FROM hotspots WHERE id = ? AND active = 1', [location_id])
      : [[]];
    if (!location) {
      return res.status(404).json({ code: 404, message: `Collection location ${location_id} not found` });
    }

    if (material_type === undefined || quantity_kg === undefined || source === undefined) {
      return buildBadRequest(res, 'material_type, quantity_kg and source are required');
    }
    if (!MATERIAL_TYPES.includes(material_type)) {
      return buildBadRequest(res, `material_type must be one of: ${MATERIAL_TYPES.join(', ')}`);
    }
    if (typeof quantity_kg !== 'number' || !Number.isFinite(quantity_kg) || quantity_kg <= 0) {
      return buildBadRequest(res, 'quantity_kg must be a positive number');
    }
    if (!isNonEmptyString(source) || source.trim().length > 120) {
      return buildBadRequest(res, 'source must be a non-empty string of at most 120 characters');
    }
    if (notes !== undefined && !isNonEmptyString(notes)) {
      return buildBadRequest(res, 'notes must be a non-empty string when provided');
    }

    const [result] = await pool.query(
      'INSERT INTO drop_offs (hotspot_id, material_type, quantity_kg, source, notes) VALUES (?, ?, ?, ?, ?)',
      [location.id, material_type, quantity_kg, source.trim(), notes ? notes.trim() : null]
    );
    await pool.query(
      `UPDATE drop_offs SET drop_off_id = CONCAT('drop-', LPAD(id, 4, '0')) WHERE id = ?`,
      [result.insertId]
    );

    const [[saved]] = await pool.query('SELECT * FROM drop_offs WHERE id = ?', [result.insertId]);

    res.status(201).json({
      drop_off_id: saved.drop_off_id,
      location_id: String(saved.hotspot_id),
      material_type: saved.material_type,
      quantity_kg: Number(saved.quantity_kg),
      source: saved.source,
      notes: saved.notes || undefined,
      status: saved.status,
      created_at: new Date(saved.created_at).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/scrap-logs', requireApiToken, async (req, res) => {
  const { job_id, artisan_id, material_type, quantity_kg, notes } = req.body;

  if (job_id === undefined || artisan_id === undefined || material_type === undefined || quantity_kg === undefined) {
    return buildBadRequest(res, 'job_id, artisan_id, material_type and quantity_kg are required');
  }

  if (!isNonEmptyString(job_id) || !isNonEmptyString(artisan_id) || !isNonEmptyString(material_type)) {
    return buildBadRequest(res, 'job_id, artisan_id and material_type must be non-empty strings');
  }

  if (typeof quantity_kg !== 'number' || !Number.isFinite(quantity_kg) || quantity_kg <= 0) {
    return buildBadRequest(res, 'quantity_kg must be a positive number');
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.trim().length === 0)) {
    return buildBadRequest(res, 'notes must be a non-empty string when provided');
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO scrap_logs (job_id, artisan_id, material_type, quantity_kg, notes) VALUES (?, ?, ?, ?, ?)',
      [job_id.trim(), artisan_id.trim(), material_type.trim(), quantity_kg, notes ? notes.trim() : null]
    );
    await pool.query(
      `UPDATE scrap_logs SET log_id = CONCAT('log-', LPAD(id, 4, '0')) WHERE id = ?`,
      [result.insertId]
    );

    const [[saved]] = await pool.query(
      `SELECT id, log_id, job_id, artisan_id, material_type, quantity_kg, notes, logged_at
       FROM scrap_logs
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      log_id: saved.log_id,
      job_id: saved.job_id,
      artisan_id: saved.artisan_id,
      material_type: saved.material_type,
      quantity_kg: Number(saved.quantity_kg),
      notes: saved.notes || undefined,
      logged_at: new Date(saved.logged_at).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//To be used by the frontend(client)
app.get('/hotspots', async (req, res) => {
  try {
    const [hotspots] = await pool.query('SELECT id, name FROM hotspots ORDER BY name');
    const [materials] = await pool.query('SELECT hotspot_id, material_name, quantity FROM hotspot_materials');
    const grouped = hotspots.map((h) => ({
      id: h.id,
      name: h.name,
      materials: materials
        .filter((m) => m.hotspot_id === h.id)
        .map((m) => ({ name: m.material_name, quantity: Number(m.quantity) })),
    }));
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/hotspots/inventory', async (req, res) => {
  const { hotspotName, materialName, quantity } = req.body;
  if (!hotspotName || !materialName || !quantity) {
    return res.status(400).json({ error: 'hotspotName, materialName and quantity are required' });
  }
  try {
    const [existing] = await pool.query('SELECT id FROM hotspots WHERE name = ?', [hotspotName]);
    let hotspotId = existing.length ? existing[0].id : null;
    if (!hotspotId) {
      const [result] = await pool.query('INSERT INTO hotspots (name) VALUES (?)', [hotspotName]);
      hotspotId = result.insertId;
    }

    await pool.query(
      `INSERT INTO hotspot_materials (hotspot_id, material_name, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [hotspotId, materialName, quantity]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/inventory/deduct', async (req, res) => {
  const { materialName, quantity } = req.body;
  if (!materialName || !quantity) {
    return res.status(400).json({ error: 'materialName and quantity are required' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, quantity FROM hotspot_materials WHERE material_name = ? AND quantity > 0',
      [materialName]
    );
    let remaining = quantity;
    for (const row of rows) {
      if (remaining <= 0) break;
      const take = Math.min(Number(row.quantity), remaining);
      await pool.query('UPDATE hotspot_materials SET quantity = quantity - ? WHERE id = ?', [take, row.id]);
      remaining -= take;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateReceipt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'KAN';
  for (let i = 0; i < 7; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

app.get('/transactions', async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  try {
    const [rows] = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?', [limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/transactions', async (req, res) => {
  const { material, quantity, amount } = req.body;
  if (!material || !quantity || !amount) {
    return res.status(400).json({ error: 'material, quantity and amount are required' });
  }
  const id = generateReceipt();
  try {
    await pool.query(
      'INSERT INTO transactions (id, material, quantity, amount) VALUES (?, ?, ?, ?)',
      [id, material, quantity, amount]
    );

    const [rows] = await pool.query(
      'SELECT id, quantity FROM hotspot_materials WHERE material_name = ? AND quantity > 0',
      [material]
    );
    let remaining = quantity;
    for (const row of rows) {
      if (remaining <= 0) break;
      const take = Math.min(Number(row.quantity), remaining);
      await pool.query('UPDATE hotspot_materials SET quantity = quantity - ? WHERE id = ?', [take, row.id]);
      remaining -= take;
    }

    const [[saved]] = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/dashboard/summary', async (req, res) => {
  try {
    const [[totals]] = await pool.query(
      'SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS revenue, COALESCE(SUM(quantity),0) AS weight FROM transactions'
    );
    const [dailyRows] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, SUM(amount) AS revenue, SUM(quantity) AS weight
       FROM transactions
       WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`
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

    res.json({
      transactionCount: totals.count,
      revenueTotal: Number(totals.revenue),
      weightTotal: Number(totals.weight),
      weekly,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Week 10: upstream partner (Group 12, AccessMap Nairobi). Called from the server so their key never reaches the browser.
// Field names follow Group 12's openapi.yaml Venue schema exactly.
app.get('/partner/market-venues', async (req, res) => {
  const PARTNER_URL = process.env.PARTNER_URL;
  const PARTNER_KEY = process.env.PARTNER_API_KEY; // never log this
  if (!PARTNER_URL) {
    console.error('partner call skipped: PARTNER_URL is not set');
    return res.status(502).json({ code: 502, message: 'Partner data unavailable' });
  }

  try {
    // Group 12 has not issued keys yet; send the header only once we have one.
    const headers = PARTNER_KEY ? { 'X-API-Key': PARTNER_KEY } : {};
    const r = await fetch(`${PARTNER_URL}/api/venues?category=market`, { headers });
    if (!r.ok) {
      console.error('partner returned', r.status);
      return res.status(502).json({ code: 502, message: 'Partner data unavailable' });
    }

    const venues = await r.json();
    if (!Array.isArray(venues)) {
      console.error('partner returned an unexpected shape (expected an array of venues)');
      return res.status(502).json({ code: 502, message: 'Partner data unavailable' });
    }

    res.json(venues.map((v) => {
      const a = v.accessibility || {};
      return {
        name: v.name,
        area: v.area,
        address: v.address,
        ramp: a.ramp === true,
        accessibleToilet: a.accessibleToilet === true,
        accessibleParking: a.accessibleParking === true,
        featureCount: Object.values(a).filter((x) => x === true).length,
      };
    }));
  } catch (err) {
    console.error('partner call failed:', err.cause?.code || err.message);
    res.status(502).json({ code: 502, message: 'Partner data unavailable' });
  }
});

app.use((req, res) => {
  res.status(404).json({ code: 404, message: `Route ${req.method} ${req.path} not found` });
});

// Express 4-arg signature marks this as the error handler (e.g. malformed JSON bodies).
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.type === 'entity.parse.failed' ? 'Request body must be valid JSON' : err.message;
  res.status(status).json({ code: status, message });
});

module.exports = { app, pool, ensureScrapLogsSchema };