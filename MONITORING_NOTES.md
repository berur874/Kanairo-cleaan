# Monitoring Notes (Week 12)

## Part C — The `/stats` endpoint

`GET /stats` (`server/monitoring.js`, registered in `server/app.js`) needs a partner API key like every other partner endpoint. Without one it answers 401.

- **What it counts:** every finished request since the server started. That includes the webapp's own traffic and requests that were rejected with 401, 404 or 429, because `monitor` is the first middleware.
- **Per-route rows** use the route pattern. All drop-offs, for any location id, share the row `POST /collection-locations/:location_id/drop-offs`, so the list doesn't grow forever.
- **401s are counted on the route they tried** (for example `GET /materials`), not under `(no route)`. Our key check runs on each partner route, not before all routes as in the handout, so we can see *which* endpoint people call without a key. `(no route)` therefore holds unknown paths (404) and requests stopped by the per-IP limit before any route.
- **`errorRatePercent`** is built from 5xx responses only. A 4xx is usually the caller's mistake.
- **`partnerFallbacks`** (the stretch goal) counts how often the Week 11 fallback served saved AccessMap data because Group 12 couldn't be reached.
- **Caller labels in the log:** a partner key appears as a 6-character fingerprint, `key-5117b8` for Group 1 and `key-be0736` for our own testing key. A logged-in webapp user appears as `user-<id>`, and everyone else as `none`.
- **Honest limits:** the totals are in memory, so they reset on restart and wouldn't add up across several server copies. `/stats` doesn't count itself in its own reply, only in the next one, and it counts towards the caller's rate limit.

## Part D — Traffic and what `/stats` showed

`server/traffic.js` sends a random mix of requests to our partner API. Nothing in the mix writes data; the only POST goes to a location that doesn't exist:

- `GET /materials` (twice in the mix)
- `GET /collection-locations`
- a valid filter, `GET /materials?type=metal&min_quantity_kg=100`
- an invalid filter (400)
- a drop-off to a location that doesn't exist (404)
- `GET /materials` with no key (401)
- an unknown path (404)

```sh
API=http://localhost:5050 KEY=<your-api-key> node traffic.js          # N=60 by default
API=http://localhost:5050 KEY=<your-api-key> N=200 node traffic.js
```

**Runs on 2026-11-03, with our `team13` key, against a freshly started server:**

| Run | Status codes received |
| --- | --- |
| N=60 | `200: 29, 400: 12, 401: 9, 404: 10` |
| N=200, straight after | `200: 39, 400: 8, 401: 31, 404: 32, 429: 90` |

In the second run, our Week 9 limit of 100 requests per minute per key kicked in. Once our key passed 100 requests inside the minute, the rest got 429. Even `/stats` answered `429` (`retryAfter: 44`) until the window reset, because it counts against the same key.

**`/stats` afterwards** (uptime 69 s):

```json
{
  "total": 272,
  "clientErrors": 202,
  "serverErrors": 0,
  "errorRatePercent": 0,
  "avgMs": 1.2,
  "partnerFallbacks": 0,
  "routes": {
    "GET /materials/market": { "count": 1, "clientErrors": 0, "serverErrors": 0, "avgMs": 12.4, "maxMs": 12.4 },
    "GET /materials": { "count": 164, "clientErrors": 113, "serverErrors": 0, "avgMs": 1.1, "maxMs": 3 },
    "GET (no route)": { "count": 30, "clientErrors": 30, "serverErrors": 0, "avgMs": 0.8, "maxMs": 1.9 },
    "POST /collection-locations/:location_id/drop-offs": { "count": 32, "clientErrors": 32, "serverErrors": 0, "avgMs": 1.6, "maxMs": 7 },
    "GET /collection-locations": { "count": 34, "clientErrors": 17, "serverErrors": 0, "avgMs": 1.3, "maxMs": 2.9 },
    "GET /stats": { "count": 11, "clientErrors": 10, "serverErrors": 0, "avgMs": 0.9, "maxMs": 1.4 }
  }
}
```

**Sample log lines** (from `server/requests.log`, which is gitignored):

```
{"time":"2026-11-03T17:38:30.940Z","method":"GET","path":"/materials/market","status":200,"ms":12.4,"caller":"none"}
{"time":"2026-11-03T17:38:31.400Z","method":"GET","path":"/materials","status":400,"ms":2.2,"caller":"key-be0736"}
{"time":"2026-11-03T17:38:31.476Z","method":"GET","path":"/not-a-route","status":404,"ms":1.9,"caller":"none"}
{"time":"2026-11-03T17:38:31.728Z","method":"GET","path":"/materials","status":401,"ms":0.8,"caller":"none"}
{"time":"2026-11-03T17:38:39.763Z","method":"GET","path":"/materials","status":429,"ms":0.8,"caller":"key-be0736"}
```

- The path in each line has no query string, even for the filtered request (its line shows only `/materials`).
- A 401 shows `caller: none`, because no valid key was sent. A 429 shows the key's fingerprint, because the key was checked before the limit.
- A 404 for an unknown path also shows `none`, because it never reached a route with a key check.

**Checks that nothing sensitive is in the log:**

- `grep -c "<team13 key>" requests.log` → `0`
- `grep -c "<group1 key>" requests.log` → `0`
- Request-log lines containing a `?`: `0`

**What stands out**, for the Part E analysis:
- Every one of the 272 requests finished in at most 12.4 ms, and there were **no 5xx at all**.
- 202 of the 272 were 4xx, but those were deliberate: the traffic mix is built to include bad keys, bad filters and unknown ids, plus the 90 requests the rate limit blocked.
- The only request over 3 ms was the first one after startup (`GET /materials/market`, 12.4 ms), when the database connection pool opens its first connection.

**Still to do:** ask Group 1 to run `traffic.js` against our ngrok URL with the key we issued them. Their requests will show up as `caller: "key-5117b8"`, separate from our `key-be0736`.
