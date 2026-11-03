// traffic.js: sends a random mix of requests to the Kanairo partner API, to give /stats some data.
// Run: API=http://localhost:5050 KEY=<your-api-key> node traffic.js        (N=200 to send more)
// Nothing here writes data: the only POST goes to a location that doesn't exist, so it gets a 404.
const API = process.env.API || 'http://localhost:5050';
const KEY = process.env.KEY;
const N = Number(process.env.N || 60);

if (!KEY) {
  console.error('Set KEY to your API key, e.g. KEY=<your-api-key> node traffic.js');
  process.exit(1);
}

const mix = [
  { method: 'GET', path: '/materials', key: true },
  { method: 'GET', path: '/materials', key: true },
  { method: 'GET', path: '/collection-locations', key: true },
  { method: 'GET', path: '/materials?type=metal&min_quantity_kg=100', key: true },
  { method: 'GET', path: '/materials?type=scrap_metal', key: true }, // invalid filter: 400
  { method: 'POST', path: '/collection-locations/99/drop-offs', key: true, body: { material_type: 'metal', quantity_kg: 1, source: 'traffic.js' } }, // no such location: 404
  { method: 'GET', path: '/materials', key: false }, // no key at all: 401
  { method: 'GET', path: '/not-a-route', key: true }, // no such path: 404
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const counts = {};
  for (let i = 0; i < N; i++) {
    const r = mix[Math.floor(Math.random() * mix.length)];
    const headers = r.key ? { 'X-API-Key': KEY } : {};
    if (r.body) headers['Content-Type'] = 'application/json';
    try {
      const res = await fetch(API + r.path, {
        method: r.method,
        headers,
        body: r.body ? JSON.stringify(r.body) : undefined,
      });
      counts[res.status] = (counts[res.status] || 0) + 1;
    } catch {
      counts.failed = (counts.failed || 0) + 1;
    }
    await pause(50);
  }
  console.log('Status codes received:', counts);
})();
