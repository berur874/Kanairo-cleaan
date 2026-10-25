const request = require('supertest');
const { app, pool, venueCache } = require('../app');

const TEST_NAME_PREFIX = 'jest-reco-';
const randomPhone = () => `078${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

const ALL_FALSE = {
  ramp: false, lift: false, accessibleToilet: false, accessibleParking: false,
  tactilePaving: false, wideCorridors: false, audioAssistance: false, staffAssistance: false,
};

let targetHub;   // an active hub that gets a fake accessible venue next to it
let material;    // a catalogue material

async function userWithNeeds(needs) {
  const { body } = await request(app).post('/auth/register').send({
    name: `${TEST_NAME_PREFIX}${Date.now()}`,
    phone: randomPhone(),
    password: 'secret123',
    role: 'seller',
  });
  const auth = { Authorization: `Bearer ${body.token}` };
  if (needs) await request(app).put('/auth/me/accessibility').set(auth).send({ needs });
  return auth;
}

// A fake AccessMap venue about 0.5 km north of a hub.
function venueNear(hub, accessibility, slug) {
  return {
    id: `v_${slug}`,
    slug,
    name: `Test venue ${slug}`,
    area: 'Test',
    category: 'market',
    accessibility: { ...ALL_FALSE, ...accessibility },
    coordinates: { lat: Number(hub.lat) + 0.0045, lng: Number(hub.lng) },
  };
}

const recommend = (auth, query) => request(app).get('/recommendations/hubs').set(auth).query(query);

beforeAll(async () => {
  // The last active hub by id, so it is not simply the one with the most stock.
  [[targetHub]] = await pool.query(
    'SELECT id, name, lat, lng FROM hotspots WHERE active = 1 AND lat IS NOT NULL ORDER BY id DESC LIMIT 1'
  );
  [[material]] = await pool.query('SELECT id, name FROM materials ORDER BY id LIMIT 1');
});

afterEach(() => venueCache.set(null));

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE name LIKE ?', [`${TEST_NAME_PREFIX}%`]);
  await pool.end();
});

describe('GET /recommendations/hubs — input and auth', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/recommendations/hubs').query({ material_id: material.id, quantity_kg: 5 });
    expect(res.status).toBe(401);
  });

  it.each([
    ['an unknown material', { material_id: 'NOPE', quantity_kg: 5 }],
    ['a zero quantity', { quantity_kg: 0 }],
    ['a text quantity', { quantity_kg: 'lots' }],
    ['an unknown mode', { quantity_kg: 5, mode: 'swap' }],
    ['a latitude without a valid longitude', { quantity_kg: 5, lat: -1.28, lng: 'x' }],
  ])('returns 400 for %s', async (_, query) => {
    const auth = await userWithNeeds([]);
    const res = await recommend(auth, { material_id: material.id, ...query });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 400);
  });
});

describe('GET /recommendations/hubs — ranking', () => {
  it('lists every active hub for sellers, highest score first, with an estimated payout', async () => {
    const auth = await userWithNeeds([]);
    const res = await recommend(auth, { material_id: material.id, quantity_kg: 10, mode: 'sell' });

    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM hotspots WHERE active = 1');
    expect(res.status).toBe(200);
    expect(res.body.hubs).toHaveLength(count);
    const scores = res.body.hubs.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(res.body.hubs[0].est_amount_kes).toBe(Math.round(10 * res.body.material.price_per_kg));
  });

  it('only lists hubs with enough stock for buyers', async () => {
    const auth = await userWithNeeds([]);
    const [[top]] = await pool.query(
      'SELECT MAX(quantity) AS q FROM hotspot_materials WHERE material_name = ?',
      [material.name]
    );
    const wanted = Math.max(1, Math.floor(Number(top.q || 1)));
    const res = await recommend(auth, { material_id: material.id, quantity_kg: wanted, mode: 'buy' });

    expect(res.status).toBe(200);
    res.body.hubs.forEach((h) => expect(h.stock_kg).toBeGreaterThanOrEqual(wanted));
  });

  it('adds the distance from the user when lat/lng are given', async () => {
    const auth = await userWithNeeds([]);
    const res = await recommend(auth, {
      material_id: material.id, quantity_kg: 10, lat: targetHub.lat, lng: targetHub.lng,
    });
    const hub = res.body.hubs.find((h) => h.hotspot_id === targetHub.id);
    expect(hub.distance_km).toBe(0);
  });
});

describe('GET /market', () => {
  it('lists every material with its price and the active hubs that have it', async () => {
    const res = await request(app).get('/market').set(await userWithNeeds([]));
    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM materials');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(count);
    const item = res.body.find((m) => m.id === material.id);
    expect(item).toMatchObject({ name: material.name, price_per_kg: expect.any(Number) });
    expect(item.stock_kg).toBeCloseTo(item.hubs.reduce((s, h) => s + h.stock_kg, 0), 2);
  });

  it('needs a logged-in user', async () => {
    expect((await request(app).get('/market')).status).toBe(401);
  });
});

describe('GET /recommendations/hubs — accessibility (AccessMap)', () => {
  it('ignores AccessMap for users without accessibility needs', async () => {
    venueCache.set([venueNear(targetHub, { ramp: true }, 'unused')]);
    const auth = await userWithNeeds([]);
    const res = await recommend(auth, { material_id: material.id, quantity_kg: 10 });
    res.body.hubs.forEach((h) => expect(h.accessibility).toBeNull());
  });

  it('raises a hub that has an accessible venue nearby and explains why', async () => {
    venueCache.set([venueNear(targetHub, { ramp: true, accessibleToilet: true }, 'both')]);

    const plain = await recommend(await userWithNeeds([]), { material_id: material.id, quantity_kg: 10 });
    const needy = await recommend(await userWithNeeds(['ramp', 'accessibleToilet']), { material_id: material.id, quantity_kg: 10 });

    const before = plain.body.hubs.find((h) => h.hotspot_id === targetHub.id);
    const after = needy.body.hubs.find((h) => h.hotspot_id === targetHub.id);
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.accessibility.qualifying).toBe(1);
    expect(after.accessibility.venues[0]).toMatchObject({ slug: 'both', distance_km: 0.5 });
    expect(after.reasons.join(' ')).toMatch(/AccessMap venue within 3 km with ramp \+ accessible toilet/);
  });

  it('does not count a venue that is missing one of the needed features', async () => {
    venueCache.set([venueNear(targetHub, { ramp: true }, 'ramp-only')]);
    const res = await recommend(await userWithNeeds(['ramp', 'accessibleToilet']), { material_id: material.id, quantity_kg: 10 });
    const hub = res.body.hubs.find((h) => h.hotspot_id === targetHub.id);
    expect(hub.accessibility.qualifying).toBe(0);
    expect(hub.reasons.join(' ')).toMatch(/No AccessMap venue within 3 km/);
  });

  it('lists the AccessMap venues near a hub (with their id, for reports), nearest first', async () => {
    const far = venueNear(targetHub, { ramp: true }, 'far');
    far.coordinates.lat += 0.1; // about 11 km away: outside the radius
    venueCache.set([venueNear(targetHub, { lift: true }, 'near'), far]);

    const res = await request(app).get(`/hubs/${targetHub.id}/nearby-venues`).set(await userWithNeeds([]));
    expect(res.status).toBe(200);
    expect(res.body.venues).toHaveLength(1);
    expect(res.body.venues[0]).toMatchObject({ id: 'v_near', slug: 'near', distance_km: 0.5 });
    expect(res.body.venues[0].accessibility).toMatchObject({ lift: true, ramp: false });
    expect(res.body.note).toBeNull();
  });

  it('explains when a hub has no AccessMap venues nearby, and 404s for an unknown hub', async () => {
    venueCache.set([]);
    const auth = await userWithNeeds([]);
    const empty = await request(app).get(`/hubs/${targetHub.id}/nearby-venues`).set(auth);
    expect(empty.body.venues).toEqual([]);
    expect(empty.body.note).toMatch(/no venues within 3 km/);

    expect((await request(app).get('/hubs/999999/nearby-venues').set(auth)).status).toBe(404);
    expect((await request(app).get(`/hubs/${targetHub.id}/nearby-venues`)).status).toBe(401);
  });

  it('still answers, with a note, when AccessMap cannot be reached', async () => {
    const saved = process.env.PARTNER_URL;
    delete process.env.PARTNER_URL;
    try {
      const res = await recommend(await userWithNeeds(['ramp']), { material_id: material.id, quantity_kg: 10 });
      expect(res.status).toBe(200);
      expect(res.body.accessibility_note).toMatch(/AccessMap is unavailable/);
      res.body.hubs.forEach((h) => expect(h.accessibility).toBeNull());
    } finally {
      process.env.PARTNER_URL = saved;
    }
  });
});
