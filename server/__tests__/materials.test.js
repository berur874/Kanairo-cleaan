const request = require('supertest');
const { app, pool } = require('../app');

const AUTH = { Authorization: `Bearer ${process.env.API_TOKEN}` };

const MATERIAL_FIELDS = ['material_id', 'name', 'type', 'quantity_kg', 'unit_price_kes'].sort();

function expectMaterialShape(material) {
  expect(Object.keys(material).sort()).toEqual(MATERIAL_FIELDS);
  expect(typeof material.material_id).toBe('string');
  expect(typeof material.name).toBe('string');
  expect(typeof material.type).toBe('string');
  expect(typeof material.quantity_kg).toBe('number');
  expect(typeof material.unit_price_kes).toBe('number');
}

afterAll(() => pool.end());

describe('GET /materials', () => {
  it('returns every material in the exact Material schema', async () => {
    const res = await request(app).get('/materials').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(expectMaterialShape);
  });

  it('does not leak DB-only columns (id, price, stock_kg, unit, trend, change_pct)', async () => {
    const res = await request(app).get('/materials').set(AUTH);

    ['id', 'price', 'stock_kg', 'unit', 'trend', 'change_pct'].forEach((field) => {
      expect(res.body[0]).not.toHaveProperty(field);
    });
  });

  it('filters by type so every result has the requested type', async () => {
    const all = await request(app).get('/materials').set(AUTH);
    const type = all.body[0].type;

    const res = await request(app).get('/materials').set(AUTH).query({ type });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((m) => {
      expectMaterialShape(m);
      expect(m.type).toBe(type);
    });
  });

  it('filters by min_quantity_kg so every result meets the minimum', async () => {
    const res = await request(app).get('/materials').set(AUTH).query({ min_quantity_kg: 1000 });

    expect(res.status).toBe(200);
    res.body.forEach((m) => expect(m.quantity_kg).toBeGreaterThanOrEqual(1000));
  });

  it('includes a material whose quantity equals min_quantity_kg exactly (>= boundary)', async () => {
    const all = await request(app).get('/materials').set(AUTH);
    const target = all.body[0];

    const res = await request(app).get('/materials').set(AUTH).query({ min_quantity_kg: target.quantity_kg });

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.material_id)).toContain(target.material_id);
  });

  it('combines type and min_quantity_kg filters', async () => {
    const all = await request(app).get('/materials').set(AUTH);
    const target = all.body[0];

    const res = await request(app)
      .get('/materials').set(AUTH)
      .query({ type: target.type, min_quantity_kg: target.quantity_kg });

    expect(res.status).toBe(200);
    res.body.forEach((m) => {
      expect(m.type).toBe(target.type);
      expect(m.quantity_kg).toBeGreaterThanOrEqual(target.quantity_kg);
    });
  });

  // Not-found: the contract has no /materials/{id}, so "not found" means a filter that matches nothing.
  it('returns 200 with an empty array for a type that does not exist', async () => {
    const res = await request(app).get('/materials').set(AUTH).query({ type: 'no_such_type_xyz' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 200 with an empty array when min_quantity_kg exceeds all stock', async () => {
    const res = await request(app).get('/materials').set(AUTH).query({ min_quantity_kg: 99999999 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns a JSON 404 with an Error body for an unknown material sub-route', async () => {
    const res = await request(app).get('/materials/does-not-exist/at-all');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 404);
    expect(typeof res.body.message).toBe('string');
  });
});
