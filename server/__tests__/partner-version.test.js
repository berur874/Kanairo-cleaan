// Week 13 Part E: the app talking to a stand-in Group 12 that serves BOTH versions, in their published
// shapes. Proves the switch is one word, that the quiet failure (a wrong shape hidden by the saved copy)
// is visible, and that hub recommendations use the same version.
process.env.PARTNER_TIMEOUT_MS = '300';
process.env.PARTNER_RETRY_DELAY_MS = '20';

const http = require('http');
const express = require('express');
const request = require('supertest');

const VENUES = [{
  id: 'v_1', slug: 'test-market', name: 'Test Market', area: 'Test', address: 'Test Rd', category: 'market',
  accessibility: { ramp: true, accessibleToilet: true },
  coordinates: { lat: -1.2921, lng: 36.8219 },
}];

const seen = []; // "METHOD /path" for every call the app made to the stand-in
let v2Broken = false; // v2 answers with the v1 shape, as if we had misread their notice

const standIn = express();
standIn.use(express.json());
standIn.use((req, res) => {
  seen.push(`${req.method} ${req.path}`);
  if (req.path === '/api/venues') return res.json(VENUES); // v1: a bare list
  if (req.path === '/v2/venues') return res.json(v2Broken ? VENUES : { data: VENUES, count: VENUES.length });
  if (req.path === '/v2/venues/test-market') return res.json(VENUES[0]);
  if (req.path === '/v2/venues/test-market/rating') return res.json({ slug: 'test-market', averageRating: 4.5, totalReports: 2 });
  if (req.path === '/api/reports' && req.method === 'POST') return res.status(201).json({ id: 'r_1' });
  res.status(404).json({ error: 'Not found' });
});

let server;
let app;
let pool;
let venueCache;
let auth;

beforeAll(async () => {
  server = http.createServer(standIn).listen(0);
  await new Promise((r) => server.once('listening', r));
  process.env.PARTNER_URL = `http://127.0.0.1:${server.address().port}`;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  ({ app, pool, venueCache } = require('../app'));
  const { body } = await request(app).post('/auth/register').send({
    name: `jest-partner-version-${Date.now()}`,
    phone: `077${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
    password: 'secret123',
    role: 'buyer',
  });
  auth = { Authorization: `Bearer ${body.token}` };
}, 30000); // the first MySQL connection can be slow on a cold start

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE name LIKE 'jest-partner-version-%'");
  await pool.end();
  server.close();
  jest.restoreAllMocks();
});

beforeEach(() => {
  seen.length = 0;
  v2Broken = false;
  venueCache.set(null);
});

describe('PARTNER_VERSION=v2', () => {
  beforeEach(() => { process.env.PARTNER_VERSION = 'v2'; });

  test('lists venues from /v2/venues and is live, not stale', async () => {
    const res = await request(app).get('/partner/venues?category=market').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(false);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ slug: 'test-market', name: 'Test Market', ramp: true });
    expect(seen).toEqual(['GET /v2/venues']);
  });

  test('venue details and rating use the /v2 paths', async () => {
    const details = await request(app).get('/partner/venues/test-market').set(auth);
    const rating = await request(app).get('/partner/venues/test-market/rating').set(auth);
    expect(details.status).toBe(200);
    expect(details.body.slug).toBe('test-market');
    expect(rating.body).toEqual({ slug: 'test-market', averageRating: 4.5, totalReports: 2 });
    expect(seen).toEqual(['GET /v2/venues/test-market', 'GET /v2/venues/test-market/rating']);
  });

  test('a report still goes to /api/reports, which does not move', async () => {
    const res = await request(app).post('/partner/reports').set(auth)
      .send({ venueId: 'v_1', rating: 5, visitedAt: '2026-11-10', accessibility: { ramp: true } });
    expect(res.status).toBe(201);
    expect(seen).toEqual(['POST /api/reports']);
  });

  test('the quiet failure: a wrong shape is covered by the saved copy, flagged stale, and logged', async () => {
    const live = await request(app).get('/partner/venues?category=market').set(auth);
    expect(live.body.stale).toBe(false);

    v2Broken = true; // their v2 now answers with a bare list, which our v2 parser must refuse
    const res = await request(app).get('/partner/venues?category=market').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(true);
    expect(res.body.data).toEqual(live.body.data);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unexpected v2 shape'));
  });

  test('hub recommendations read the venue list the same way (venue cache)', async () => {
    const list = await venueCache.get();
    expect(list).toEqual(VENUES);
    expect(seen).toEqual(['GET /v2/venues']);
  });
});

describe('PARTNER_VERSION=v1 (the rollback)', () => {
  beforeEach(() => { process.env.PARTNER_VERSION = 'v1'; });

  test('lists venues from /api/venues with no code change', async () => {
    const res = await request(app).get('/partner/venues?category=market').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(false);
    expect(res.body.data[0]).toMatchObject({ slug: 'test-market' });
    expect(seen).toEqual(['GET /api/venues']);
  });

  test('the venue cache also follows the version', async () => {
    expect(await venueCache.get()).toEqual(VENUES);
    expect(seen).toEqual(['GET /api/venues']);
  });
});
