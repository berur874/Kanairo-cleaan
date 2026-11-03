// Week 12: GET /stats (Part C) and what the request log line contains.
const request = require('supertest');
const { app, pool } = require('../app');

const KEY = { 'X-API-Key': 'test-token' };

afterAll(() => pool.end());

describe('GET /stats', () => {
  it('needs a key like every partner endpoint', async () => {
    expect((await request(app).get('/stats')).status).toBe(401);
  });

  it('reports totals, 4xx and 5xx counts, error rate, average time and a per-route breakdown', async () => {
    await request(app).get('/materials').set(KEY);
    const res = await request(app).get('/stats').set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      startedAt: expect.any(String),
      uptimeSeconds: expect.any(Number),
      total: expect.any(Number),
      clientErrors: expect.any(Number),
      serverErrors: expect.any(Number),
      errorRatePercent: expect.any(Number),
      avgMs: expect.any(Number),
      partnerFallbacks: expect.any(Number),
    });
    expect(res.body.routes['GET /materials']).toMatchObject({ count: expect.any(Number), avgMs: expect.any(Number), maxMs: expect.any(Number) });
  });

  it('groups by route pattern, so different ids share one row, and counts 4xx as client errors', async () => {
    const before = (await request(app).get('/stats').set(KEY)).body.routes['POST /collection-locations/:location_id/drop-offs'];
    await request(app).post('/collection-locations/98765/drop-offs').set(KEY).send({});
    await request(app).post('/collection-locations/98766/drop-offs').set(KEY).send({});

    const row = (await request(app).get('/stats').set(KEY)).body.routes['POST /collection-locations/:location_id/drop-offs'];
    expect(row.count - (before?.count || 0)).toBe(2);
    expect(row.clientErrors - (before?.clientErrors || 0)).toBe(2);
  });

  it('counts a 401 on the route it tried (our key check runs per route), and an unknown path under "(no route)"', async () => {
    const before = (await request(app).get('/stats').set(KEY)).body;
    await request(app).get('/materials'); // 401, no key
    await request(app).get('/not-a-route').set(KEY); // 404

    const after = (await request(app).get('/stats').set(KEY)).body;
    const noRoute = (b) => (b.routes['GET (no route)']?.count || 0);
    const materials401 = (b) => (b.routes['GET /materials']?.clientErrors || 0);
    expect(noRoute(after) - noRoute(before)).toBe(1);
    expect(materials401(after) - materials401(before)).toBe(1);
    // the 401 and 404, plus the /stats call made for `before` (it counts in the next reply)
    expect(after.total - before.total).toBe(3);
    expect(after.clientErrors - before.clientErrors).toBe(2);
  });
});

describe('request log line', () => {
  it('has the agreed fields, a key fingerprint instead of the key, and no query string', async () => {
    const lines = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((line) => lines.push(String(line)));
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development'; // the logger stays quiet under Jest otherwise
    try {
      await request(app).get('/materials?type=metal&min_quantity_kg=1').set(KEY);
      await request(app).get('/materials').set('X-API-Key', 'wrong');
    } finally {
      process.env.NODE_ENV = env;
      spy.mockRestore();
    }

    const entries = lines.filter((l) => l.startsWith('{"time"')).map((l) => JSON.parse(l));
    expect(entries).toHaveLength(2);
    expect(Object.keys(entries[0])).toEqual(['time', 'method', 'path', 'status', 'ms', 'caller']);
    expect(entries[0]).toMatchObject({ method: 'GET', path: '/materials', status: 200, caller: expect.stringMatching(/^key-[0-9a-f]{6}$/) });
    expect(entries[1]).toMatchObject({ status: 401, caller: 'none' });
    expect(entries[0].ms).toBeGreaterThan(0);

    const all = lines.join('\n');
    expect(all).not.toContain('test-token');
    expect(all).not.toContain('min_quantity_kg');
  });
});
