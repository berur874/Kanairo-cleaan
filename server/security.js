// Week 9: API keys per consumer, rate limiting, and error responses that don't leak internals.

const crypto = require('crypto');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();

/**
 * Partner API keys come from the environment, never from source code:
 *   API_KEYS=group1:<long random key>,team13:<another key>
 * Each consumer has its own key, so one can be revoked (delete it and restart) without breaking the
 * others, and every request is attributed to a consumer. A bare API_TOKEN is still accepted as a
 * single key named "default", for setups from before Week 9.
 * Returns [{ consumer, hash }] — only hashes are kept in memory after loading.
 */
function loadApiKeys(env = process.env) {
  const entries = (env.API_KEYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(':');
      return i > 0 ? [pair.slice(0, i).trim(), pair.slice(i + 1).trim()] : ['unnamed', pair];
    })
    .filter(([, key]) => key);
  if (!entries.length && env.API_TOKEN) entries.push(['default', env.API_TOKEN]);
  return entries.map(([consumer, key]) => ({ consumer, hash: sha256(key) }));
}

/**
 * Middleware for the partner API. The key may be sent as "Authorization: Bearer <key>" (our published
 * contract) or "X-API-Key: <key>". No valid key → 401 and the route never runs. Fails closed: with
 * no keys configured, every request is refused.
 */
function createApiKeyCheck(keys) {
  return function requireApiKey(req, res, next) {
    const [scheme, bearer] = (req.get('Authorization') || '').split(' ');
    const presented = req.get('X-API-Key') || (scheme === 'Bearer' ? bearer : '');
    const hash = presented ? sha256(presented) : null;
    // Compare against every key without stopping early, so timing doesn't reveal which one matched.
    let match = null;
    for (const k of keys) {
      if (hash && crypto.timingSafeEqual(hash, k.hash) && !match) match = k;
    }
    if (!match) return res.status(401).json({ code: 401, message: 'Missing or invalid API token' });
    req.apiConsumer = match.consumer;
    next();
  };
}

/**
 * Fixed-window rate limiter kept in memory: at most `max` requests per `windowMs` for each id that
 * keyFor(req) returns. Over the limit → 429 with a Retry-After header and a JSON body.
 * Limits: it resets when the server restarts and each server copy counts separately; a shared store
 * such as Redis would be needed with several servers.
 */
function createRateLimiter({ windowMs, max, keyFor }) {
  const hits = new Map(); // id -> { count, resetAt }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    if (hits.size > 10000) {
      for (const [id, e] of hits) if (now >= e.resetAt) hits.delete(id);
    }

    const id = keyFor(req);
    let entry = hits.get(id);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ code: 429, message: 'Too many requests', retryAfter });
    }
    next();
  };
}

/** 500 without the database error text (which can name tables, columns and SQL); the detail goes to the server log. */
function sendServerError(res, err) {
  const ref = crypto.randomBytes(4).toString('hex');
  console.error(`[error ${ref}]`, err);
  return res.status(500).json({ code: 500, message: 'Something went wrong on our side', ref });
}

/** Numeric setting from the environment, with a default. */
function envNumber(name, fallback, env = process.env) {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

module.exports = { loadApiKeys, createApiKeyCheck, createRateLimiter, sendServerError, envNumber };
