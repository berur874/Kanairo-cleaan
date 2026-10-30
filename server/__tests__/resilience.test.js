// Week 11 Parts C and D: retries and the saved-data fallback, against a stand-in partner started by
// this test (like flaky-partner.js, but on a free port). Short timeout and delays keep the run fast.
process.env.PARTNER_TIMEOUT_MS = '300';
process.env.PARTNER_RETRY_DELAY_MS = '20';

const http = require('http');
const express = require('express');
const request = require('supertest');
const { fetchWithRetry } = require('../resilientFetch');

let mode = 'ok';
let hits = 0;
const VENUES = [{
  id: 'v_1', slug: 'test-market', name: 'Test Market', area: 'Test', address: 'Test Rd', category: 'market',
  accessibility: { ramp: true, accessibleToilet: true },
}];

const standIn = express();
standIn.use(async (req, res) => {
  hits += 1;
  if (mode === 'slow') await new Promise((r) => setTimeout(r, 1000));
  if (mode === 'flaky' && hits % 3 !== 0) return res.status(503).json({ message: 'Try again' });
  if (mode === 'error') return res.status(500).json({ message: 'Internal error' });
  if (mode === 'missing') return res.status(404).json({ error: 'Not found' });
  if (mode === 'busy' && hits === 1) return res.set('Retry-After', '1').status(429).json({ message: 'Slow down' });
  res.json(VENUES);
});

let server;
let base;
let app;
let pool;
let auth;
const setMode = (m) => { mode = m; hits = 0; };

beforeAll(async () => {
  server = http.createServer(standIn).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.PARTNER_URL = base; // read on every call, so the app talks to the stand-in
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  ({ app, pool } = require('../app'));
  const { body } = await request(app).post('/auth/register').send({
    name: `jest-resilience-${Date.now()}`,
    phone: `076${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
    password: 'secret123',
    role: 'buyer',
  });
  auth = { Authorization: `Bearer ${body.token}` };
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE name LIKE 'jest-resilience-%'");
  await pool.end();
  server.close();
  jest.restoreAllMocks();
});

const CONFIG = { timeoutMs: 300, retries: 2, delayMs: 20 };

describe('fetchWithRetry (Part C)', () => {
  it('flaky partner: fails twice, the third attempt works, and the caller never sees a failure', async () => {
    setMode('flaky');
    const res = await fetchWithRetry(`${base}/api/venues`, {}, CONFIG);
    expect(res.status).toBe(200);
    expect(hits).toBe(3);
  });

  it('partner always failing: exactly 2 retries (3 calls), then gives up — no infinite loop', async () => {
    setMode('error');
    const res = await fetchWithRetry(`${base}/api/venues`, {}, CONFIG);
    expect(res.status).toBe(500);
    expect(hits).toBe(3);
  });

  it('never retries a 4xx: the request is wrong, so asking again changes nothing', async () => {
    setMode('missing');
    const res = await fetchWithRetry(`${base}/api/venues/nope`, {}, CONFIG);
    expect(res.status).toBe(404);
    expect(hits).toBe(1);
  });

  it('never retries a write (POST), even on a 503', async () => {
    setMode('flaky');
    const res = await fetchWithRetry(`${base}/api/reports`, { method: 'POST' }, CONFIG);
    expect(res.status).toBe(503);
    expect(hits).toBe(1);
  });

  it('a slow partner is cut off at the timeout on every attempt, then the error is thrown', async () => {
    setMode('slow');
    const started = Date.now();
    await expect(fetchWithRetry(`${base}/api/venues`, {}, CONFIG)).rejects.toMatchObject({ name: 'TimeoutError' });
    // 3 x 300 ms + 20 + 40 ms, far below the 3 x 1000 ms the partner would have taken
    expect(Date.now() - started).toBeLessThan(2000);
    expect(hits).toBe(3);
  });

  it('honours Retry-After on a 429 before trying again', async () => {
    setMode('busy');
    const started = Date.now();
    const res = await fetchWithRetry(`${base}/api/venues`, {}, CONFIG);
    expect(res.status).toBe(200);
    expect(hits).toBe(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(950);
  });
});

describe('GET /partner/venues fallback (Part D)', () => {
  it('ok: live data, not stale', async () => {
    setMode('ok');
    const res = await request(app).get('/partner/venues?category=market').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ stale: false, data: [{ slug: 'test-market', name: 'Test Market' }] });
  });

  it('partner slow or failing: the saved copy, flagged stale, with the time it was saved', async () => {
    const live = await request(app).get('/partner/venues?category=market').set(auth);

    for (const m of ['slow', 'error']) {
      setMode(m);
      const res = await request(app).get('/partner/venues?category=market').set(auth);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: live.body.data, stale: true, asOf: live.body.asOf });
    }
  });

  it('partner stopped and nothing saved yet: a friendly 502, no crash', async () => {
    setMode('error');
    const res = await request(app).get('/partner/venues?category=hospital').set(auth);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ code: 502, message: 'Partner data unavailable' });
  });

  it('partner back: live data again with no code change', async () => {
    setMode('ok');
    const res = await request(app).get('/partner/venues?category=market').set(auth);
    expect(res.body.stale).toBe(false);
  });
});
