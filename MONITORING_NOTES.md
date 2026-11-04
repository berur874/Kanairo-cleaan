# Monitoring Notes (Week 12)

## Part A Making the Prediction

### 1. Slowest Endpoint Prediction

- **Predicted Endpoint:** `GET /partner/venues`
- **Reason:** This endpoint makes an outbound HTTP call (`callPartner`) to an upstream third-party server (`Group 12`). Its total response time includes external network latency, upstream processing time, and potential timeouts, making it inherently slower than local database queries.

### 2. Most Error-Prone Endpoint Prediction

- **Predicted Endpoint:** `POST /auth/login` (or `GET /partner/venues`)
- **Reason:** `/auth/login` will see frequent `401 Unauthorized` responses from invalid credentials during user login attempts. Alternatively, `/partner/venues` will produce `502 Bad Gateway` errors whenever the upstream partner server is offline or flaky.

## Part B - Request Logging

``` json
{"time":"2026-11-04T08:41:35.155Z","method":"GET","path":"/hotspots","status":200,"ms":5.6,"caller":"user-6"}
08:41:35 local GET /hotspots -> 200
{"time":"2026-11-04T08:41:35.178Z","method":"GET","path":"/hotspots","status":401,"ms":4,"caller":"none"}
08:41:35 local GET /hotspots -> 401
{"time":"2026-11-04T08:41:35.198Z","method":"GET","path":"/hotspots","status":401,"ms":1.7,"caller":"none"}
08:41:35 local GET /hotspots -> 401
```

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

## Part E — Reading my own data

### 1. Prediction vs. what the data shows

- **Slowest endpoint — predicted `GET /partner/venues`.**
  Actual: our partner endpoints never appeared in this run, because the traffic
  script doesn't call them. Across everything that *was* exercised, the slowest
  single request was `GET /materials/market` at 12.4 ms (its only call), and
  every other route stayed under 3 ms. So the prediction is **not yet tested**,
  not disproved — I need traffic that actually hits `/partner/venues`.

- **Most errors — predicted `/auth/login` or `/partner/venues`.**
  Actual: **zero 5xx and zero login traffic.** The 202 client errors were all
  deliberate (bad keys, bad filters, unknown ids, and 90 rate-limited calls).
  My prediction was about *server* failures; the data shows the failures were
  all caller-side, which is a different finding than I expected.

### 2. One real pattern, with figures

`GET /materials` handled 164 calls, averaged **1.1 ms**, worst case **3 ms**,
and **113 of its 164 calls (69%) were 4xx**. In the N=200 run alone, 31 of the
requests to it were 401 (no key) and part of the 90 were 429 (rate limit).
So the busiest route by far is dominated by *rejected* calls, not successful
ones — the endpoint is cheap, but it's absorbing almost all the noise.

Secondary pattern: `POST /collection-locations/:location_id/drop-offs` had 32
calls, **all 32 of them 4xx** (the mix only ever posts to a location that
doesn't exist). That's expected by design of the traffic script, not a bug.

### 3. Why, and what I'd check next

- **Hypothesis:** the `GET /materials` 4xx load is an artefact of my traffic
  mix, not real client behaviour — the mix deliberately includes a no-key call
  and an invalid filter, and the rate limiter turns sustained load into 429s.
  The 12.4 ms first call is almost certainly cold-start (first DB pool
  connection), not a real slow path.
- **What I'd check next:** (a) run the script *without* the no-key and
  invalid-filter entries to get a clean baseline for `GET /materials`; (b) send
  traffic that actually hits `/partner/venues` and `/auth/login` to test my
  Part A predictions; (c) confirm the cold-start theory by warming the pool and
  re-reading `maxMs` for `/materials/market`.

### 4. One production alert

- **Metric:** `errorRatePercent` (5xx only) from `/stats`.
- **Threshold:** > 2% for 5 consecutive minutes (i.e. a sustained 5xx rate, not
  one blip).
- **What should happen:** page on-call, and — because of Week 11 — the feature
  should **already** be serving saved AccessMap data via the fallback while a
  human fixes the cause. `partnerFallbacks` going up is the signal that users
  are still being served. If `partnerFallbacks` is climbing *and*
  `errorRatePercent` is above threshold, the on-call knows it's an upstream
  (Group 12) problem, not ours.
