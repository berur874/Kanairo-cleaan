const request = require('supertest');
const { app, pool } = require('../app');

const AUTH = { Authorization: `Bearer ${process.env.API_TOKEN}` };

const LOCATION_FIELDS = ['location_id', 'name', 'area', 'is_active'].sort();

afterAll(() => pool.end());

describe('GET /collection-locations', () => {
  it('returns locations in the exact CollectionLocation schema', async () => {
    const res = await request(app).get('/collection-locations').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((loc) => {
      expect(Object.keys(loc).sort()).toEqual(LOCATION_FIELDS);
      expect(typeof loc.location_id).toBe('string');
      expect(typeof loc.name).toBe('string');
      expect(typeof loc.area).toBe('string');
      expect(typeof loc.is_active).toBe('boolean');
    });
  });

  it('only returns active locations, as the contract describes', async () => {
    const res = await request(app).get('/collection-locations').set(AUTH);

    res.body.forEach((loc) => expect(loc.is_active).toBe(true));
  });

  it('excludes locations that are inactive in the database', async () => {
    const [inactive] = await pool.query('SELECT id FROM hotspots WHERE active = 0');
    const res = await request(app).get('/collection-locations').set(AUTH);
    const ids = res.body.map((loc) => loc.location_id);

    inactive.forEach((row) => expect(ids).not.toContain(String(row.id)));
  });

  it('returns unique location_ids', async () => {
    const res = await request(app).get('/collection-locations').set(AUTH);
    const ids = res.body.map((loc) => loc.location_id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not leak DB-only fields (id, active, activity, stock_kg)', async () => {
    const res = await request(app).get('/collection-locations').set(AUTH);

    ['id', 'active', 'activity', 'stock_kg', 'primary_material_id'].forEach((field) => {
      expect(res.body[0]).not.toHaveProperty(field);
    });
  });

  // Not-found: the contract has no /collection-locations/{id}.
  it('returns a JSON 404 with an Error body for an unknown location sub-route', async () => {
    const res = await request(app).get('/collection-locations/9999/details');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 404);
    expect(typeof res.body.message).toBe('string');
  });

  it('returns a JSON 404 for an unsupported method on the path', async () => {
    const res = await request(app).delete('/collection-locations');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });
});
