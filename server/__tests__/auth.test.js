const request = require('supertest');
const { app, pool } = require('../app');

afterAll(() => pool.end());

const PROTECTED = [
  ['get', '/collection-locations'],
  ['get', '/materials'],
  ['post', '/scrap-logs'],
];

function expectUnauthorized(res) {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ code: 401, message: 'Missing or invalid API token' });
}

describe.each(PROTECTED)('%s %s — API token', (method, path) => {
  it('returns 401 with an Error body when no Authorization header is sent', async () => {
    expectUnauthorized(await request(app)[method](path));
  });

  it('returns 401 for a wrong token', async () => {
    expectUnauthorized(await request(app)[method](path).set('Authorization', 'Bearer wrong-token'));
  });

  it('returns 401 when the token is not sent with the Bearer scheme', async () => {
    expectUnauthorized(await request(app)[method](path).set('Authorization', process.env.API_TOKEN));
  });

  it('does not touch the database when the token is rejected', async () => {
    if (method !== 'post') return;
    const jobId = `jest-job-unauth-${Date.now()}`;
    await request(app).post(path).send({ job_id: jobId, artisan_id: 'a', material_type: 'plastic', quantity_kg: 1 });

    const [rows] = await pool.query('SELECT id FROM scrap_logs WHERE job_id = ?', [jobId]);
    expect(rows).toHaveLength(0);
  });
});
