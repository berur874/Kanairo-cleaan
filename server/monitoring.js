// Week 12: request logging (Part B) and running totals for GET /stats (Part C).
//
// One JSON line per request with: time, method, path (no query string), status, ms and caller.
// Never logged: keys or tokens (only a 6-character fingerprint), passwords, bodies, query strings.
// The totals live in memory: they reset when the server restarts, and would be wrong across
// several server copies.

const round = (n) => Math.round(n * 10) / 10;

const stats = {
  startedAt: new Date().toISOString(),
  total: 0,
  clientErrors: 0, // 4xx: usually the caller's mistake
  serverErrors: 0, // 5xx: our fault
  totalMs: 0,
  routes: {},
  // Week 11 fallback: how often GET /partner/venues answered with saved data because Group 12
  // couldn't be reached. Tells us how often our partner is really failing.
  partnerFallbacks: 0,
};

function newRoute() {
  return { count: 0, clientErrors: 0, serverErrors: 0, totalMs: 0, maxMs: 0 };
}

// Who called, without ever writing a key: a partner key's fingerprint, a webapp user's id, or none.
function who(req) {
  if (req.apiKeyFingerprint) return req.apiKeyFingerprint;
  if (req.user) return `user-${req.user.id}`;
  return 'none';
}

function monitor(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => { // after the response is sent, so status and timing are final
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify({
        time: new Date().toISOString(),
        method: req.method,
        path: req.baseUrl + req.path, // path only: no query string
        status: res.statusCode,
        ms: round(ms),
        caller: who(req),
      }));
    }

    // Group by route pattern, so /hub/orders/A1 and /hub/orders/B2 share "POST /hub/orders/:id/collect".
    const route = req.route ? req.baseUrl + req.route.path : '(no route)';
    const label = `${req.method} ${route}`;
    const r = stats.routes[label] || newRoute();
    stats.routes[label] = r;

    stats.total += 1;
    stats.totalMs += ms;
    r.count += 1;
    r.totalMs += ms;
    r.maxMs = Math.max(r.maxMs, ms);
    if (res.statusCode >= 500) {
      stats.serverErrors += 1;
      r.serverErrors += 1;
    } else if (res.statusCode >= 400) {
      stats.clientErrors += 1;
      r.clientErrors += 1;
    }
  });

  next();
}

/** Called by the Week 11 fallback each time it serves saved partner data. */
function countPartnerFallback() {
  stats.partnerFallbacks += 1;
}

function statsHandler(req, res) {
  const routes = {};
  for (const [label, r] of Object.entries(stats.routes)) {
    routes[label] = {
      count: r.count,
      clientErrors: r.clientErrors,
      serverErrors: r.serverErrors,
      avgMs: round(r.totalMs / r.count),
      maxMs: round(r.maxMs),
    };
  }
  const rate = stats.total ? (stats.serverErrors / stats.total) * 100 : 0;
  const avg = stats.total ? stats.totalMs / stats.total : 0;
  res.json({
    startedAt: stats.startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    total: stats.total,
    clientErrors: stats.clientErrors,
    serverErrors: stats.serverErrors,
    errorRatePercent: round(rate),
    avgMs: round(avg),
    partnerFallbacks: stats.partnerFallbacks,
    routes,
  });
}

module.exports = { monitor, statsHandler, countPartnerFallback };
