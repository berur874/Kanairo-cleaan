// Week 11 Part C: fetch with a timeout, capped retries and growing waits, for calls to Group 12.
//
// Retries:  a timeout, a failed connection, or 429 / 500 / 502 / 503 / 504.
// Never:    400, 401, 403, 404 and other 4xx (asking again changes nothing), or any request that
//           changes data (POST, PUT, PATCH, DELETE), because a retry could do it twice.
// At most `retries` retries, waiting delayMs, then 2 x delayMs (200 ms, then 400 ms). For a 429 we
// wait what the partner's Retry-After asks, up to 5 s.
// Worst case for a GET: (retries + 1) x timeoutMs + delays = 3 x 1500 + 200 + 400 = 5100 ms.

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Why an attempt failed, in words for the log. Never includes headers, so never the key. */
function failureReason(err) {
  if (err.name === 'TimeoutError') return 'timeout';
  return err.cause?.code || err.message;
}

async function fetchWithRetry(url, options = {}, config = {}) {
  const { timeoutMs = 1500, retries = 2, delayMs = 200, label = url } = config;
  const method = (options.method || 'GET').toUpperCase();
  const maxRetries = method === 'GET' ? retries : 0; // never retry writes

  for (let attempt = 0; ; attempt++) {
    let wait = delayMs * 2 ** attempt; // 200 ms, then 400 ms
    let reason;
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (!RETRY_STATUSES.has(res.status) || attempt >= maxRetries) return res;

      reason = `status ${res.status}`;
      const retryAfter = Number(res.headers.get('Retry-After'));
      if (res.status === 429 && retryAfter > 0) {
        wait = Math.min(retryAfter * 1000, 5000); // wait as asked, up to 5 s
      }
    } catch (err) {
      if (attempt >= maxRetries) throw err; // out of retries
      reason = failureReason(err);
    }
    console.warn(`${method} ${label}: attempt ${attempt + 1} failed (${reason}), retrying in ${wait} ms`);
    await sleep(wait);
  }
}

module.exports = { fetchWithRetry, failureReason, RETRY_STATUSES };
