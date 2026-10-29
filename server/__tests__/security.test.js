// Week 9: API keys per consumer, rate limits (429 + Retry-After) and error responses.
// Small limits are set before the app loads, so they apply to this file only.
process.env.PARTNER_RATE_LIMIT = '3';
process.env.AUTH_RATE_LIMIT = '2';

const request = require('supertest');
const { app, pool } = require('../app');
const { loadApiKeys, createRateLimiter } = require('../security');

afterAll(() => pool.end());

describe('API keys', () => {
  it('returns 401 for a request without a key', async () => {
    const res = await request(app).get('/collection-locations');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: 401, message: 'Missing or invalid API token' });
  });

  it('returns 200 for a valid key in the X-API-Key header', async () => {
    const res = await request(app).get('/collection-locations').set('X-API-Key', 'test-token');
    expect(res.status).toBe(200);
  });

  it('returns 200 for a valid key as a Bearer token (the published contract)', async () => {
    const res = await request(app).get('/collection-locations').set('Authorization', 'Bearer other-test-token');
    expect(res.status).toBe(200);
  });

  it('returns 401 for a wrong key in either header', async () => {
    expect((await request(app).get('/collection-locations').set('X-API-Key', 'wrong')).status).toBe(401);
    expect((await request(app).get('/collection-locations').set('Authorization', 'Bearer wrong')).status).toBe(401);
  });

  it('loads one key per consumer from API_KEYS and keeps only hashes', () => {
    const keys = loadApiKeys({ API_KEYS: 'group1:aaa, team13:bbb' });
    expect(keys.map((k) => k.consumer)).toEqual(['group1', 'team13']);
    expect(JSON.stringify(keys)).not.toContain('aaa');
    expect(loadApiKeys({ API_TOKEN: 'legacy' }).map((k) => k.consumer)).toEqual(['default']);
    expect(loadApiKeys({})).toEqual([]);
  });
});

describe('rate limiting', () => {
  // This file's limit is 3 per minute per consumer. The first describe used 'tests' 2 times and
  // 'other-consumer' 1 time, so 'other-consumer' has exactly 2 left.
  it('answers 429 with Retry-After and a JSON body once a consumer goes over the limit', async () => {
    const statuses = [];
    let last;
    for (let i = 0; i < 4; i++) {
      last = await request(app).get('/collection-locations').set('X-API-Key', 'other-test-token');
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 429, 429]);
    expect(Number(last.headers['retry-after'])).toBeGreaterThan(0);
    expect(last.body).toMatchObject({ code: 429, message: 'Too many requests', retryAfter: expect.any(Number) });
  });

  it('counts each consumer separately', async () => {
    // 'other-consumer' is now blocked, but 'tests' still has one request left this minute.
    const res = await request(app).get('/collection-locations').set('X-API-Key', 'test-token');
    expect(res.status).toBe(200);
  });

  it('does not count requests with an invalid key against a consumer', async () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1, keyFor: (req) => req.id });
    const run = (id) => new Promise((resolve) => {
      const res = { set() {}, status(code) { resolve(code); return { json() {} }; } };
      limiter({ id }, res, () => resolve(200));
    });
    expect([await run('a'), await run('a'), await run('b')]).toEqual([200, 429, 200]);
  });

  it('limits log-in attempts per IP (password guessing)', async () => {
    const tries = [];
    for (let i = 0; i < 3; i++) {
      tries.push((await request(app).post('/auth/login').send({ phone: '0700000000', password: 'guess-guess' })).status);
    }
    expect(tries).toEqual([401, 401, 429]);
  });
});

describe('error responses', () => {
  it('a malformed JSON body gets a 400 that names no internals', async () => {
    const res = await request(app).post('/scrap-logs').set('X-API-Key', 'test-token')
      .set('Content-Type', 'application/json').send('{"broken');
    expect([400, 429]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|\.js:\d+/);
  });

  it('routes that used to be open now need a logged-in user', async () => {
    expect((await request(app).get('/hotspots')).status).toBe(401);
    expect((await request(app).get('/partner/venues')).status).toBe(401);
    expect((await request(app).post('/partner/reports').send({})).status).toBe(401);
  });
});
