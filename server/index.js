require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
const port = process.env.PORT || 5000;

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

//To be used by group one
app.get('/materials', async (req, res) => {
  const { type, min_quantity_kg } = req.query;
  let sql = 'SELECT * FROM materials WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (min_quantity_kg) { sql += ' AND stock_kg >= ?'; params.push(min_quantity_kg); }

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/collection-locations', async (req, res) => {
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

app.post('/scrap-logs', async (req, res) => {
  const { hotspot_id, material_id, quantity_kg } = req.body;
  if (!hotspot_id || !material_id || !quantity_kg) {
    return res.status(400).json({ error: 'hotspot_id, material_id and quantity_kg are required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO scrap_logs (hotspot_id, material_id, quantity_kg) VALUES (?, ?, ?)',
      [hotspot_id, material_id, quantity_kg]
    );
    res.status(201).json({ id: result.insertId, hotspot_id, material_id, quantity_kg });
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});