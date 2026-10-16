const request = require('supertest');
const { app, pool } = require('../app');

const AUTH = { Authorization: `Bearer ${process.env.API_TOKEN}` };
const TEST_SOURCE_PREFIX = 'jest-source-';
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

let activeId;
let inactiveId;

const validPayload = () => ({
  material_type: 'metal',
  quantity_kg: 12.5,
  source: `${TEST_SOURCE_PREFIX}${Date.now()} Find My Artisan, electrical job in Embakasi`,
  notes: 'Offcut copper wiring and brass fittings.',
});

const dropOffPath = (id) => `/collection-locations/${id}/drop-offs`;

beforeAll(async () => {
  const [[active]] = await pool.query('SELECT id FROM hotspots WHERE active = 1 ORDER BY id LIMIT 1');
  const [[inactive]] = await pool.query('SELECT id FROM hotspots WHERE active = 0 ORDER BY id LIMIT 1');
  activeId = String(active.id);
  inactiveId = inactive && String(inactive.id);
});

afterAll(async () => {
  await pool.query('DELETE FROM drop_offs WHERE source LIKE ?', [`${TEST_SOURCE_PREFIX}%`]);
  await pool.end();
});

function expectError(res, status) {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('code', status);
  expect(typeof res.body.message).toBe('string');
}

describe('POST /collection-locations/{location_id}/drop-offs — happy path', () => {
  it('creates a pending drop-off and returns 201 with the DropOff schema', async () => {
    const payload = validPayload();
    const res = await request(app).post(dropOffPath(activeId)).set(AUTH).send(payload);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ['drop_off_id', 'location_id', 'material_type', 'quantity_kg', 'source', 'notes', 'status', 'created_at'].sort()
    );
    expect(res.body.drop_off_id).toMatch(/^drop-\d{4,}$/);
    expect(res.body.location_id).toBe(activeId);
    expect(res.body.material_type).toBe(payload.material_type);
    expect(res.body.quantity_kg).toBe(payload.quantity_kg);
    expect(res.body.source).toBe(payload.source);
    expect(res.body.notes).toBe(payload.notes);
    expect(res.body.status).toBe('pending');
    expect(res.body.created_at).toMatch(ISO_DATE_TIME);
  });

  it('persists the drop-off against the location', async () => {
    const res = await request(app).post(dropOffPath(activeId)).set(AUTH).send(validPayload());

    const [rows] = await pool.query('SELECT hotspot_id, status FROM drop_offs WHERE drop_off_id = ?', [res.body.drop_off_id]);
    expect(rows).toHaveLength(1);
    expect(String(rows[0].hotspot_id)).toBe(activeId);
    expect(rows[0].status).toBe('pending');
  });

  it('omits notes when they are not sent', async () => {
    const { notes, ...payload } = validPayload();
    const res = await request(app).post(dropOffPath(activeId)).set(AUTH).send(payload);

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('notes');
  });

  it('accepts a source of exactly 120 characters', async () => {
    const source = TEST_SOURCE_PREFIX.padEnd(120, 'x');
    const res = await request(app).post(dropOffPath(activeId)).set(AUTH).send({ ...validPayload(), source });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe(source);
  });
});

describe('POST /collection-locations/{location_id}/drop-offs — not found', () => {
  it('returns 404 for a location that does not exist', async () => {
    expectError(await request(app).post(dropOffPath('99999')).set(AUTH).send(validPayload()), 404);
  });

  it('returns 404 for an inactive location', async () => {
    if (!inactiveId) return;
    expectError(await request(app).post(dropOffPath(inactiveId)).set(AUTH).send(validPayload()), 404);
  });

  it('returns 404 for a non-numeric location id', async () => {
    expectError(await request(app).post(dropOffPath('loc-001')).set(AUTH).send(validPayload()), 404);
  });
});

describe('POST /collection-locations/{location_id}/drop-offs — validation', () => {
  it.each(['material_type', 'quantity_kg', 'source'])('returns 400 when %s is missing', async (field) => {
    const payload = validPayload();
    delete payload[field];
    expectError(await request(app).post(dropOffPath(activeId)).set(AUTH).send(payload), 400);
  });

  it('returns 400 for a material_type outside the published list', async () => {
    const res = await request(app).post(dropOffPath(activeId)).set(AUTH).send({ ...validPayload(), material_type: 'scrap_metal' });
    expectError(res, 400);
  });

  it.each([0, -1, '12.5'])('returns 400 for quantity_kg=%p', async (quantity_kg) => {
    expectError(await request(app).post(dropOffPath(activeId)).set(AUTH).send({ ...validPayload(), quantity_kg }), 400);
  });

  it('returns 400 for a source longer than 120 characters', async () => {
    const source = TEST_SOURCE_PREFIX.padEnd(121, 'x');
    expectError(await request(app).post(dropOffPath(activeId)).set(AUTH).send({ ...validPayload(), source }), 400);
  });

  it('returns 400 for an empty notes string', async () => {
    expectError(await request(app).post(dropOffPath(activeId)).set(AUTH).send({ ...validPayload(), notes: '  ' }), 400);
  });

  it('does not write anything when validation fails', async () => {
    const source = `${TEST_SOURCE_PREFIX}invalid-${Date.now()}`;
    await request(app).post(dropOffPath(activeId)).set(AUTH).send({ ...validPayload(), source, quantity_kg: -1 });

    const [rows] = await pool.query('SELECT id FROM drop_offs WHERE source = ?', [source]);
    expect(rows).toHaveLength(0);
  });
});

describe('POST /collection-locations/{location_id}/drop-offs — API token', () => {
  it('returns 401 without a token', async () => {
    expectError(await request(app).post(dropOffPath(activeId)).send(validPayload()), 401);
  });
});
