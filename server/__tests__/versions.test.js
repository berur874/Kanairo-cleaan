// Week 13: v1 is frozen, v2 has the new shape, and v1 announces its sunset.
const request = require('supertest');
const { app, pool } = require('../app');

const AUTH = { Authorization: `Bearer ${process.env.API_TOKEN}` };
const SUNSET = 'Thu, 12 Nov 2026 00:00:00 GMT';

const MATERIAL_FIELDS = ['material_id', 'name', 'quantity_kg', 'type', 'unit_price_kes'];
const LOCATION_FIELDS = ['area', 'county', 'is_active', 'location_id', 'name'];

afterAll(() => pool.end());

describe('v1 is frozen', () => {
  test.each([
    ['/v1/materials', MATERIAL_FIELDS],
    ['/v1/collection-locations', LOCATION_FIELDS],
  ])('GET %s keeps its original shape: a bare list', async (path, fields) => {
    const res = await request(app).get(path).set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(fields);
  });

  test.each([
    ['/materials', '/v1/materials'],
    ['/collection-locations', '/v1/collection-locations'],
    ['/materials?type=metal', '/v1/materials?type=metal'],
  ])('old unversioned %s answers exactly like %s', async (oldPath, v1Path) => {
    const a = await request(app).get(oldPath).set(AUTH);
    const b = await request(app).get(v1Path).set(AUTH);
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  test('v1 error shape is unchanged', async () => {
    const res = await request(app).get('/v1/materials?type=nonsense').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 400, message: 'type must be one of: metal, plastic, paper, glass, e-waste' });
  });
});

describe('v2 has the new shape', () => {
  test.each([
    ['/v2/materials', MATERIAL_FIELDS],
    ['/v2/collection-locations', LOCATION_FIELDS],
  ])('GET %s wraps the list in { data, count } with the same item fields', async (path, fields) => {
    const res = await request(app).get(path).set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(Object.keys(res.body).sort()).toEqual(['count', 'data']);
    expect(res.body.count).toBe(res.body.data.length);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(fields);
  });

  test('v1 and v2 serve the same rows', async () => {
    const v1 = await request(app).get('/v1/materials').set(AUTH);
    const v2 = await request(app).get('/v2/materials').set(AUTH);
    expect(v2.body.data).toEqual(v1.body);
  });

  test('the type filter still works', async () => {
    const res = await request(app).get('/v2/materials?type=metal').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((m) => expect(m.type).toBe('metal'));
    expect(res.body.count).toBe(res.body.data.length);
  });

  test('an empty result is { data: [], count: 0 }, not an error', async () => {
    const res = await request(app).get('/v2/materials?min_quantity_kg=99999999').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], count: 0 });
  });

  test('v2 errors keep the v1 error shape', async () => {
    const res = await request(app).get('/v2/materials?type=nonsense').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: 400, message: 'type must be one of: metal, plastic, paper, glass, e-waste' });
  });
});

describe('v2 needs a key like everything else', () => {
  test.each(['/v2/materials', '/v2/collection-locations'])('GET %s with no key is 401', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  test('a wrong key is 401', async () => {
    const res = await request(app).get('/v2/materials').set({ Authorization: 'Bearer not-a-real-key' });
    expect(res.status).toBe(401);
  });
});

describe('deprecation headers', () => {
  test.each([
    ['/v1/materials', '/v2/materials'],
    ['/materials', '/v2/materials'],
    ['/v1/collection-locations', '/v2/collection-locations'],
    ['/collection-locations', '/v2/collection-locations'],
  ])('%s announces the sunset and points at %s', async (path, successor) => {
    const res = await request(app).get(path).set(AUTH);
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBe(SUNSET);
    expect(res.headers.link).toBe(`<${successor}>; rel="successor-version"`);
  });

  test('v2 and unknown paths do not carry them', async () => {
    for (const path of ['/v2/materials', '/v2/collection-locations', '/nope']) {
      const res = await request(app).get(path).set(AUTH);
      expect(res.headers.deprecation).toBeUndefined();
      expect(res.headers.sunset).toBeUndefined();
    }
  });
});

describe('/stats shows the version in the route label', () => {
  test('v1, unversioned and v2 are separate rows', async () => {
    await request(app).get('/v1/materials').set(AUTH);
    await request(app).get('/materials').set(AUTH);
    await request(app).get('/v2/materials').set(AUTH);
    const res = await request(app).get('/stats').set(AUTH);
    expect(res.body.routes).toHaveProperty(['GET /v1/materials']);
    expect(res.body.routes).toHaveProperty(['GET /materials']);
    expect(res.body.routes).toHaveProperty(['GET /v2/materials']);
  });
});
