const request = require('supertest');
const { app, pool, ensureScrapLogsSchema } = require('../app');

const TEST_JOB_PREFIX = 'jest-job-';
const validPayload = () => ({
  job_id: `${TEST_JOB_PREFIX}${Date.now()}`,
  artisan_id: 'art-302',
  material_type: 'scrap_metal',
  quantity_kg: 12.5,
  notes: 'Offcut copper wiring and brass fittings.',
});

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

beforeAll(() => ensureScrapLogsSchema());

afterAll(async () => {
  await pool.query('DELETE FROM scrap_logs WHERE job_id LIKE ?', [`${TEST_JOB_PREFIX}%`]);
  await pool.end();
});

function expectError(res) {
  expect(res.status).toBe(400);
  expect(res.body).toHaveProperty('code', 400);
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
}

describe('POST /scrap-logs — happy path', () => {
  it('creates a log and returns 201 with the exact ScrapLog schema', async () => {
    const payload = validPayload();
    const res = await request(app).post('/scrap-logs').send(payload);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ['log_id', 'job_id', 'artisan_id', 'material_type', 'quantity_kg', 'notes', 'logged_at'].sort()
    );
    expect(res.body.log_id).toMatch(/^log-\d{4,}$/);
    expect(res.body.job_id).toBe(payload.job_id);
    expect(res.body.artisan_id).toBe(payload.artisan_id);
    expect(res.body.material_type).toBe(payload.material_type);
    expect(res.body.quantity_kg).toBe(payload.quantity_kg);
    expect(typeof res.body.quantity_kg).toBe('number');
    expect(res.body.notes).toBe(payload.notes);
    expect(res.body.logged_at).toMatch(ISO_DATE_TIME);
    expect(Number.isNaN(Date.parse(res.body.logged_at))).toBe(false);
  });

  it('actually persists the row, including the returned log_id', async () => {
    const payload = validPayload();
    const res = await request(app).post('/scrap-logs').send(payload);

    const [rows] = await pool.query('SELECT * FROM scrap_logs WHERE log_id = ?', [res.body.log_id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].job_id).toBe(payload.job_id);
    expect(Number(rows[0].quantity_kg)).toBe(payload.quantity_kg);
  });

  it('gives each created log a unique log_id', async () => {
    const a = await request(app).post('/scrap-logs').send(validPayload());
    const b = await request(app).post('/scrap-logs').send(validPayload());

    expect(a.body.log_id).not.toBe(b.body.log_id);
  });

  it('accepts a payload without the optional notes and omits notes in the response', async () => {
    const { notes, ...payload } = validPayload();
    const res = await request(app).post('/scrap-logs').send(payload);

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('notes');
  });

  it('trims surrounding whitespace from string fields', async () => {
    const payload = validPayload();
    const res = await request(app)
      .post('/scrap-logs')
      .send({ ...payload, artisan_id: '  art-302  ' });

    expect(res.status).toBe(201);
    expect(res.body.artisan_id).toBe('art-302');
  });
});

describe('POST /scrap-logs — validation rejection', () => {
  ['job_id', 'artisan_id', 'material_type', 'quantity_kg'].forEach((field) => {
    it(`returns 400 when required field ${field} is missing`, async () => {
      const payload = validPayload();
      delete payload[field];
      const res = await request(app).post('/scrap-logs').send(payload);

      expectError(res);
    });
  });

  it('returns 400 for an empty body', async () => {
    const res = await request(app).post('/scrap-logs').send({});
    expectError(res);
  });

  it('returns 400 when quantity_kg is a string instead of a number', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), quantity_kg: '12.5' });
    expectError(res);
  });

  it('returns 400 when job_id is a number instead of a string', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), job_id: 8812 });
    expectError(res);
  });

  it('returns 400 when a required string is whitespace only', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), material_type: '   ' });
    expectError(res);
  });

  it('returns 400 when notes is provided but not a string', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), notes: 42 });
    expectError(res);
  });

  it('returns 400 with an Error body for malformed JSON', async () => {
    const res = await request(app)
      .post('/scrap-logs')
      .set('Content-Type', 'application/json')
      .send('{"job_id": "job-1",');

    expectError(res);
  });

  it('does not write anything to the database when validation fails', async () => {
    const jobId = `${TEST_JOB_PREFIX}invalid-${Date.now()}`;
    await request(app).post('/scrap-logs').send({ ...validPayload(), job_id: jobId, quantity_kg: -1 });

    const [rows] = await pool.query('SELECT id FROM scrap_logs WHERE job_id = ?', [jobId]);
    expect(rows).toHaveLength(0);
  });
});

describe('POST /scrap-logs — edge cases (quantity_kg boundaries)', () => {
  it('rejects quantity_kg = 0', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), quantity_kg: 0 });
    expectError(res);
  });

  it('rejects a negative quantity_kg', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), quantity_kg: -5 });
    expectError(res);
  });

  it('accepts the smallest storable positive quantity_kg (0.01)', async () => {
    const res = await request(app).post('/scrap-logs').send({ ...validPayload(), quantity_kg: 0.01 });

    expect(res.status).toBe(201);
    expect(res.body.quantity_kg).toBe(0.01);
  });
});

describe('POST /scrap-logs — not found', () => {
  // The contract defines no GET /scrap-logs or /scrap-logs/{id}; both must 404 with an Error body.
  it('returns a JSON 404 for GET /scrap-logs/:id', async () => {
    const res = await request(app).get('/scrap-logs/log-9999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 404);
    expect(typeof res.body.message).toBe('string');
  });

  it('returns a JSON 404 for GET /scrap-logs (only POST is in the contract)', async () => {
    const res = await request(app).get('/scrap-logs');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });
});
