// User accounts for the webapp (sellers, buyers, hub managers).
//
// This file is the whole login implementation. Any replacement must keep the same contract:
//   POST /auth/register  {name, phone, password, role, hotspot_id?} -> 201 {token, user}
//   POST /auth/login     {phone, password}                         -> 200 {token, user}
//   POST /auth/logout                                              -> 204
//   GET  /auth/me                                                  -> 200 user
//   PUT  /auth/me/accessibility {needs: string[]}                  -> 200 user
//   requireUser(...roles) middleware: reads "Authorization: Bearer <token>", sets req.user,
//   answers 401 (no/expired session) or 403 (wrong role).
// user = {id, name, phone, role, hotspot_id, accessibility_needs}; accessibility_needs is null
// until the user has answered the onboarding question, then an array of feature names ([] = none).
//
// Separate from requireApiToken in app.js, which protects the Group 1 partner API.

const crypto = require('crypto');
const express = require('express');
const { promisify } = require('util');
const { ACCESSIBILITY_FEATURES } = require('./accessibility');

const scrypt = promisify(crypto.scrypt);

const ROLES = ['seller', 'buyer', 'hub_manager'];
const SESSION_DAYS = 7;
const MIN_PASSWORD_LENGTH = 6;

// Stored as "scrypt$<salt hex>$<hash hex>" so the format can change later without guessing.
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Only a hash of the session token is stored, so a leaked database cannot be used to log in.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Kenyan mobile numbers: 07XXXXXXXX, 01XXXXXXXX or +254 7/1XXXXXXXX, stored as 07/01XXXXXXXX.
function normalisePhone(phone) {
  if (typeof phone !== 'string') return null;
  const compact = phone.replace(/[\s-]/g, '');
  const match = compact.match(/^(?:\+?254|0)([17]\d{8})$/);
  return match ? `0${match[1]}` : null;
}

function parseNeeds(value) {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    hotspot_id: row.hotspot_id,
    accessibility_needs: parseNeeds(row.accessibility_needs),
  };
}

function sendError(res, status, message) {
  return res.status(status).json({ code: status, message });
}

function createAuth({ pool }) {
  const router = express.Router();

  async function startSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ? DAY)',
      [hashToken(token), userId, SESSION_DAYS]
    );
    return token;
  }

  async function findUser(id) {
    const [[row]] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return row;
  }

  function requireUser(...roles) {
    return async (req, res, next) => {
      const [scheme, token] = (req.get('Authorization') || '').split(' ');
      if (scheme !== 'Bearer' || !token) return sendError(res, 401, 'Please log in');

      try {
        const [[row]] = await pool.query(
          `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > NOW()`,
          [hashToken(token)]
        );
        if (!row) return sendError(res, 401, 'Your session has expired, please log in again');
        if (roles.length && !roles.includes(row.role)) {
          return sendError(res, 403, 'Your account type cannot do this');
        }
        req.user = publicUser(row);
        req.sessionTokenHash = hashToken(token);
        next();
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    };
  }

  router.post('/register', async (req, res) => {
    const { name, password, role, hotspot_id } = req.body || {};
    const phone = normalisePhone(req.body?.phone);

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return sendError(res, 400, 'name is required (at most 100 characters)');
    }
    if (!phone) return sendError(res, 400, 'phone must be a Kenyan mobile number, e.g. 0712345678');
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return sendError(res, 400, `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (!ROLES.includes(role)) return sendError(res, 400, `role must be one of: ${ROLES.join(', ')}`);

    let hotspotId = null;
    try {
      if (role === 'hub_manager') {
        const [[hub]] = Number.isInteger(Number(hotspot_id))
          ? await pool.query('SELECT id FROM hotspots WHERE id = ? AND active = 1', [Number(hotspot_id)])
          : [[]];
        if (!hub) return sendError(res, 400, 'hub managers must choose an active hub (hotspot_id)');
        hotspotId = hub.id;
      }

      const [[taken]] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
      if (taken) return sendError(res, 409, 'An account with this phone number already exists');

      const [result] = await pool.query(
        'INSERT INTO users (name, phone, password_hash, role, hotspot_id) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), phone, await hashPassword(password), role, hotspotId]
      );
      const token = await startSession(result.insertId);
      res.status(201).json({ token, user: publicUser(await findUser(result.insertId)) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/login', async (req, res) => {
    const phone = normalisePhone(req.body?.phone);
    const password = req.body?.password;
    if (!phone || typeof password !== 'string') {
      return sendError(res, 400, 'phone and password are required');
    }

    try {
      const [[row]] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
      // Same message for unknown phone and wrong password, so accounts cannot be discovered.
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return sendError(res, 401, 'Wrong phone number or password');
      }
      res.json({ token: await startSession(row.id), user: publicUser(row) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/logout', requireUser(), async (req, res) => {
    try {
      await pool.query('DELETE FROM sessions WHERE token_hash = ?', [req.sessionTokenHash]);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/me', requireUser(), (req, res) => res.json(req.user));

  router.put('/me/accessibility', requireUser(), async (req, res) => {
    const needs = req.body?.needs;
    if (!Array.isArray(needs) || !needs.every((n) => ACCESSIBILITY_FEATURES.includes(n))) {
      return sendError(res, 400, `needs must be a list drawn from: ${ACCESSIBILITY_FEATURES.join(', ')}`);
    }
    try {
      await pool.query('UPDATE users SET accessibility_needs = ? WHERE id = ?', [
        JSON.stringify([...new Set(needs)]),
        req.user.id,
      ]);
      res.json(publicUser(await findUser(req.user.id)));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return { router, requireUser };
}

module.exports = { createAuth, hashPassword, ROLES };
