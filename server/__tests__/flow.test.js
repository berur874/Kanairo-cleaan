// End-to-end webapp flow: a seller drops scrap at a hub, the hub manager weighs it and pays out,
// a buyer orders it and the hub hands it over. Also checks every step is limited to the right user.
const request = require('supertest');
const { app, pool } = require('../app');

const TEST_NAME_PREFIX = 'jest-flow-';
const API = { Authorization: `Bearer ${process.env.API_TOKEN}` };
const randomPhone = () => `077${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

let hubA;
let hubB;
let material;
let seller;
let buyer;
let managerA;
let managerB;
let startStock;
let stockLine;

async function signUp(role, hotspotId) {
  const { body } = await request(app).post('/auth/register').send({
    name: `${TEST_NAME_PREFIX}${role}-${Date.now()}`,
    phone: randomPhone(),
    password: 'secret123',
    role,
    hotspot_id: hotspotId,
    invite_code: role === 'hub_manager' ? process.env.HUB_INVITE_CODE : undefined,
  });
  return { Authorization: `Bearer ${body.token}`, user: body.user };
}

const as = (who) => ({ Authorization: who.Authorization });

async function hubStock(hotspotId, materialName) {
  const [[row]] = await pool.query(
    'SELECT quantity FROM hotspot_materials WHERE hotspot_id = ? AND material_name = ?',
    [hotspotId, materialName]
  );
  return row ? Number(row.quantity) : 0;
}

beforeAll(async () => {
  [hubA, hubB] = (await pool.query('SELECT id, name FROM hotspots WHERE active = 1 ORDER BY id LIMIT 2'))[0];
  [[material]] = await pool.query("SELECT id, name, type, price FROM materials WHERE type = 'plastic' ORDER BY id LIMIT 1");
  seller = await signUp('seller');
  buyer = await signUp('buyer');
  managerA = await signUp('hub_manager', hubA.id);
  managerB = await signUp('hub_manager', hubB.id);
  startStock = await hubStock(hubA.id, material.name);
  [[stockLine]] = await pool.query(
    'SELECT id FROM hotspot_materials WHERE hotspot_id = ? AND material_name = ?',
    [hubA.id, material.name]
  );
});

afterAll(async () => {
  const [users] = await pool.query('SELECT id FROM users WHERE name LIKE ?', [`${TEST_NAME_PREFIX}%`]);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await pool.query('DELETE FROM transactions WHERE buyer_id IN (?)', [ids]);
    await pool.query('DELETE FROM drop_offs WHERE seller_id IN (?)', [ids]);
  }
  await pool.query('DELETE FROM drop_offs WHERE source LIKE ?', [`${TEST_NAME_PREFIX}%`]);
  await pool.query('DELETE FROM users WHERE name LIKE ?', [`${TEST_NAME_PREFIX}%`]);
  // The flow may have created an (now empty) stock line for this material at hub A.
  if (!stockLine) {
    await pool.query('DELETE FROM hotspot_materials WHERE hotspot_id = ? AND material_name = ? AND quantity = 0', [hubA.id, material.name]);
  }
  await pool.end();
});

describe('seller → hub → buyer', () => {
  let dropOffId;
  let orderId;
  const RECEIVED_KG = 9.5;

  it('a seller logs scrap at a hub and sees it as pending, with an estimated payout', async () => {
    const res = await request(app).post('/sell/drop-offs').set(as(seller))
      .send({ hotspot_id: hubA.id, material_id: material.id, quantity_kg: 10, notes: 'Two sacks' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      hub: { id: hubA.id },
      material: { id: material.id },
      quantity_kg: 10,
      est_payout_kes: Math.round(10 * Number(material.price)),
      status: 'pending',
      payout_kes: null,
      seller: { id: seller.user.id },
    });
    dropOffId = res.body.drop_off_id;

    const mine = await request(app).get('/sell/drop-offs').set(as(seller));
    expect(mine.body.map((d) => d.drop_off_id)).toContain(dropOffId);
  });

  it('only sellers can log scrap', async () => {
    const res = await request(app).post('/sell/drop-offs').set(as(buyer))
      .send({ hotspot_id: hubA.id, material_id: material.id, quantity_kg: 1 });
    expect(res.status).toBe(403);
  });

  it('the drop-off appears in the queue of its own hub only', async () => {
    const own = await request(app).get('/hub/drop-offs?status=pending').set(as(managerA));
    const other = await request(app).get('/hub/drop-offs?status=pending').set(as(managerB));
    expect(own.body.map((d) => d.drop_off_id)).toContain(dropOffId);
    expect(other.body.map((d) => d.drop_off_id)).not.toContain(dropOffId);

    const steal = await request(app).post(`/hub/drop-offs/${dropOffId}/receive`).set(as(managerB)).send({ received_kg: 1 });
    expect(steal.status).toBe(404);
  });

  it('the hub manager weighs it: payout from the real weight, and the hub stock goes up', async () => {
    const res = await request(app).post(`/hub/drop-offs/${dropOffId}/receive`).set(as(managerA)).send({ received_kg: RECEIVED_KG });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'received', received_kg: RECEIVED_KG });
    expect(res.body.payout_kes).toBeCloseTo(RECEIVED_KG * Number(material.price), 2);
    expect(await hubStock(hubA.id, material.name)).toBeCloseTo(startStock + RECEIVED_KG, 2);

    const again = await request(app).post(`/hub/drop-offs/${dropOffId}/receive`).set(as(managerA)).send({ received_kg: 1 });
    expect(again.status).toBe(409);

    const mine = await request(app).get('/sell/drop-offs').set(as(seller));
    expect(mine.body.find((d) => d.drop_off_id === dropOffId).payout_kes).toBe(res.body.payout_kes);
  });

  it('a buyer cannot order more than the hub has', async () => {
    const res = await request(app).post('/buy/orders').set(as(buyer))
      .send({ hotspot_id: hubA.id, material_id: material.id, quantity_kg: startStock + RECEIVED_KG + 1 });
    expect(res.status).toBe(409);
  });

  it('a buyer orders from the hub and the stock goes back down', async () => {
    const res = await request(app).post('/buy/orders').set(as(buyer))
      .send({ hotspot_id: hubA.id, material_id: material.id, quantity_kg: RECEIVED_KG });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      hub: { id: hubA.id },
      material: { id: material.id, name: material.name },
      quantity_kg: RECEIVED_KG,
      amount_kes: Math.round(RECEIVED_KG * Number(material.price)),
      status: 'paid',
      buyer: { id: buyer.user.id },
    });
    orderId = res.body.id;
    expect(await hubStock(hubA.id, material.name)).toBeCloseTo(startStock, 2);
  });

  it('the hub hands the order over; other hubs cannot', async () => {
    const queue = await request(app).get('/hub/orders?status=paid').set(as(managerA));
    expect(queue.body.map((o) => o.id)).toContain(orderId);

    expect((await request(app).post(`/hub/orders/${orderId}/collect`).set(as(managerB))).status).toBe(404);

    const res = await request(app).post(`/hub/orders/${orderId}/collect`).set(as(managerA));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('collected');
    expect((await request(app).post(`/hub/orders/${orderId}/collect`).set(as(managerA))).status).toBe(409);

    const mine = await request(app).get('/buy/orders').set(as(buyer));
    expect(mine.body.find((o) => o.id === orderId).status).toBe('collected');
  });

  it('the hub summary counts this hub only', async () => {
    const res = await request(app).get('/hub/summary').set(as(managerA));
    expect(res.status).toBe(200);
    expect(res.body.hub.id).toBe(hubA.id);
    expect(res.body.weekly).toHaveLength(7);
    expect(typeof res.body.pendingDropOffs).toBe('number');
  });
});

describe('Group 1 drop-offs reach the same hub queue', () => {
  it('a hub manager receives a Group 1 drop-off once they name the exact material', async () => {
    const created = await request(app).post(`/collection-locations/${hubA.id}/drop-offs`).set(API)
      .send({ material_type: 'plastic', quantity_kg: 3, source: `${TEST_NAME_PREFIX}group1 artisan` });
    expect(created.status).toBe(201);
    const id = created.body.drop_off_id;

    const queue = await request(app).get('/hub/drop-offs?status=pending').set(as(managerA));
    const row = queue.body.find((d) => d.drop_off_id === id);
    expect(row).toMatchObject({ seller: null, material: null, material_type: 'plastic' });

    const noMaterial = await request(app).post(`/hub/drop-offs/${id}/receive`).set(as(managerA)).send({ received_kg: 3 });
    expect(noMaterial.status).toBe(400);

    const [[metal]] = await pool.query("SELECT id FROM materials WHERE type = 'metal' LIMIT 1");
    const wrongType = await request(app).post(`/hub/drop-offs/${id}/receive`).set(as(managerA))
      .send({ received_kg: 3, material_id: metal.id });
    expect(wrongType.status).toBe(400);

    const ok = await request(app).post(`/hub/drop-offs/${id}/receive`).set(as(managerA))
      .send({ received_kg: 3, material_id: material.id });
    expect(ok.status).toBe(200);

    // Put the stock back the way the test found it.
    await request(app).post('/buy/orders').set(as(buyer)).send({ hotspot_id: hubA.id, material_id: material.id, quantity_kg: 3 });
  });
});
