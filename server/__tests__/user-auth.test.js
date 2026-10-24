const request = require('supertest');
const { app, pool } = require('../app');

const TEST_NAME_PREFIX = 'jest-user-';
const randomPhone = () => `079${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

const newUser = (overrides = {}) => ({
  name: `${TEST_NAME_PREFIX}${Date.now()}`,
  phone: randomPhone(),
  password: 'secret123',
  role: 'seller',
  ...overrides,
});

let activeHubId;

beforeAll(async () => {
  const [[hub]] = await pool.query('SELECT id FROM hotspots WHERE active = 1 ORDER BY id LIMIT 1');
  activeHubId = hub.id;
});

afterAll(async () => {
  // sessions are removed by ON DELETE CASCADE
  await pool.query('DELETE FROM users WHERE name LIKE ?', [`${TEST_NAME_PREFIX}%`]);
  await pool.end();
});

function expectError(res, status) {
  expect(res.status).toBe(status);
  expect(res.body).toHaveProperty('code', status);
  expect(typeof res.body.message).toBe('string');
}

describe('POST /auth/register', () => {
  it('creates a seller and returns a token and the user, without the password hash', async () => {
    const payload = newUser();
    const res = await request(app).post('/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      id: expect.any(Number),
      name: payload.name,
      phone: payload.phone,
      role: 'seller',
      hotspot_id: null,
      accessibility_needs: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('stores a hashed password, never the plain one', async () => {
    const payload = newUser();
    const res = await request(app).post('/auth/register').send(payload);
    const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [res.body.user.id]);
    expect(row.password_hash).not.toContain(payload.password);
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
  });

  it('normalises +254 phone numbers to 07…', async () => {
    const local = randomPhone();
    const res = await request(app).post('/auth/register').send(newUser({ phone: `+254${local.slice(1)}` }));
    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe(local);
  });

  it('requires an active hub for hub managers', async () => {
    expectError(await request(app).post('/auth/register').send(newUser({ role: 'hub_manager' })), 400);

    const res = await request(app).post('/auth/register').send(newUser({ role: 'hub_manager', hotspot_id: activeHubId }));
    expect(res.status).toBe(201);
    expect(res.body.user.hotspot_id).toBe(activeHubId);
  });

  it('returns 409 for a phone number that is already registered', async () => {
    const payload = newUser();
    await request(app).post('/auth/register').send(payload);
    expectError(await request(app).post('/auth/register').send({ ...payload, name: `${TEST_NAME_PREFIX}dup` }), 409);
  });

  it.each([
    ['an unknown role', { role: 'admin' }],
    ['a short password', { password: '123' }],
    ['a non-Kenyan phone', { phone: '12345' }],
    ['a missing name', { name: '' }],
  ])('returns 400 for %s', async (_, overrides) => {
    expectError(await request(app).post('/auth/register').send(newUser(overrides)), 400);
  });
});

describe('POST /auth/login and GET /auth/me', () => {
  it('logs in with the right password and the token works on /auth/me', async () => {
    const payload = newUser({ role: 'buyer' });
    await request(app).post('/auth/register').send(payload);

    const login = await request(app).post('/auth/login').send({ phone: payload.phone, password: payload.password });
    expect(login.status).toBe(200);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ name: payload.name, role: 'buyer' });
  });

  it('gives the same 401 for a wrong password and an unknown phone', async () => {
    const payload = newUser();
    await request(app).post('/auth/register').send(payload);

    const wrong = await request(app).post('/auth/login').send({ phone: payload.phone, password: 'nope-nope' });
    const unknown = await request(app).post('/auth/login').send({ phone: randomPhone(), password: 'nope-nope' });
    expectError(wrong, 401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('returns 401 on /auth/me without a token, with a bad token, or after logout', async () => {
    expectError(await request(app).get('/auth/me'), 401);
    expectError(await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-real-token'), 401);

    const { body } = await request(app).post('/auth/register').send(newUser());
    const auth = { Authorization: `Bearer ${body.token}` };
    expect((await request(app).post('/auth/logout').set(auth)).status).toBe(204);
    expectError(await request(app).get('/auth/me').set(auth), 401);
  });

  it('does not accept the Group 1 partner API token as a user session', async () => {
    expectError(await request(app).get('/auth/me').set('Authorization', `Bearer ${process.env.API_TOKEN}`), 401);
  });
});

describe('PUT /auth/me/accessibility', () => {
  it('saves the onboarding answer, removing duplicates', async () => {
    const { body } = await request(app).post('/auth/register').send(newUser());
    const res = await request(app)
      .put('/auth/me/accessibility')
      .set('Authorization', `Bearer ${body.token}`)
      .send({ needs: ['ramp', 'accessibleToilet', 'ramp'] });

    expect(res.status).toBe(200);
    expect(res.body.accessibility_needs).toEqual(['ramp', 'accessibleToilet']);
  });

  it('accepts an empty list (no accessibility needs)', async () => {
    const { body } = await request(app).post('/auth/register').send(newUser());
    const res = await request(app).put('/auth/me/accessibility').set('Authorization', `Bearer ${body.token}`).send({ needs: [] });
    expect(res.body.accessibility_needs).toEqual([]);
  });

  it('returns 400 for a feature AccessMap does not have', async () => {
    const { body } = await request(app).post('/auth/register').send(newUser());
    const res = await request(app).put('/auth/me/accessibility').set('Authorization', `Bearer ${body.token}`).send({ needs: ['jetpack'] });
    expectError(res, 400);
  });
});
