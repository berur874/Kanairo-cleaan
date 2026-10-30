# Security Audit (Week 9)

**Team:** Kanairo-Klean (Team 13)
**Date:** 2026-10-29
**Scope:** the partner API that Group 1 calls, and the Kanairo webapp's own server routes (`server/app.js`, `server/auth.js`, `server/marketplace.js`).

## 1. Keys and who uses them (Part A)

| Consumer | Key name in `API_KEYS` | Notes |
| --- | --- | --- |
| Group 1, Find My Artisan (our downstream ring partner) | `group1` | They keep the key they already had, so their integration did not break. It was sent privately to one person on their team. |
| Our own team, for testing | `team13` | New key generated for this lab with `crypto.randomBytes(24)` |

- **Every partner endpoint needs a valid key**, with no exceptions for "harmless" GETs: `GET /materials`, `GET /collection-locations`, `POST /collection-locations/{id}/drop-offs` and `POST /scrap-logs`.
- **Keys live in `server/.env`**, which is in `.gitignore` and has never been committed (checked with `git log --all -- server/.env`). `server/.env.example` has placeholders only.
- **The key can be sent as `Authorization: Bearer <key>`** (our published contract, which Group 1 already uses) **or `X-API-Key: <key>`** (the header from the handout).
- **Revoking one consumer** means deleting their `name:key` pair and restarting. The other keys keep working.
- **Only hashes are kept in memory**, and keys are compared with a timing-safe comparison. At startup the server prints how many keys it loaded and the consumer names, never the keys.

### What stays open, and why

| Route | Why it has no key |
| --- | --- |
| `GET /materials/market`, `GET /collection-locations/showcase` | They feed the logged-out landing page, the public price board. They're read-only, return only public prices and hub names, and are covered by the per-IP rate limit. |
| `POST /auth/register`, `POST /auth/login` | People have to reach them to get a session. They have their own stricter rate limit. |

Every other webapp route needs a logged-in user session. That's a separate mechanism from partner keys, and a session token never works as a partner key or the other way round (both are tested).

## 2. Authentication (Part B)

`server/security.js` has `createApiKeyCheck()`. The check runs before the route handler, and a missing, wrong or revoked key gets this response, without the handler ever running:

```
HTTP/1.1 401 Unauthorized
{"code":401,"message":"Missing or invalid API token"}
```

Proof against the running server (key replaced with a placeholder):

```
$ curl -i http://localhost:5099/collection-locations
HTTP/1.1 401 Unauthorized
{"code":401,"message":"Missing or invalid API token"}

$ curl -i -H "X-API-Key: wrong" http://localhost:5099/collection-locations
HTTP/1.1 401 Unauthorized
{"code":401,"message":"Missing or invalid API token"}

$ curl -i -H "X-API-Key: <team13 key>" http://localhost:5099/collection-locations
HTTP/1.1 200 OK
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
```

We only use 401, because there is one level of partner access. The webapp does use 403, for "logged in, but your account type can't do this", for example a buyer opening a hub manager route, or a hub manager signup without the invite code.

## 3. Rate limiting (Part C)

| Limit | Counted per | Threshold | Why this number |
| --- | --- | --- | --- |
| Partner API | consumer, after their key is checked | **100 / minute** | Group 1's need is "high, called constantly" (`API_NEEDS.md`). A UI polling prices every 5 seconds uses 12 a minute, and even a page that fires several calls on every action stays well under 100. A buggy loop, on the other hand, hits 100 within a second or two and is stopped for the rest of the minute instead of hammering our database. |
| Every request | client IP | **300 / minute** | A webapp page makes about 4 to 6 calls, so 300 leaves room for a busy user and for several people behind one campus or office network address. It also caps anyone sending requests with no key or a made-up key. |
| Log in / sign up | client IP | **20 / 15 minutes** | A real person rarely mistypes a password 20 times. Guessing is slowed to at most 80 tries an hour per address. |

All three can be changed in `.env` (`PARTNER_RATE_LIMIT`, `IP_RATE_LIMIT`, `AUTH_RATE_LIMIT`).

**Demonstration.** A second copy of the server ran on port 5099 with the partner limit lowered to 3, and received 5 requests with the team13 key:

```
$ for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code} " -H "X-API-Key: <team13 key>" http://localhost:5099/materials; done
200 200 200 429 429

$ curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer <group1 key>" http://localhost:5099/materials   # a different consumer
200
```

The 429 response has a `Retry-After` header and a JSON body:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
Retry-After: 60
{"code":429,"message":"Too many requests","retryAfter":60}
```

After the demonstration the limit went back to 100 (the default; that test copy of the server was stopped).

**Honest limits.** The counts are kept in memory, so they reset when the server restarts, and two copies of the server would count separately. Production would need a shared store such as Redis.

## 4. Self-audit (Part D)

For each item: what we looked at, what we found, and what we did.

### 4.1 Sensitive fields in responses

| Looked at | Found | Action |
| --- | --- | --- |
| Partner API responses (`/materials`, `/collection-locations`, drop-offs, scrap-logs) | Built field by field to match `openapi.yaml`. No internal columns. | Nothing wrong |
| User objects from `/auth/*` | Built by `publicUser()`. `password_hash` is never returned, and a test checks that no response contains "password". | Nothing wrong |
| `GET /materials/market` (public) | **Returned raw `SELECT *` rows.** Any column added to `materials` later would have been published automatically. | **Fixed:** explicit column list |
| Hub manager queues | They show the seller's or buyer's name and phone. The hub needs these to pay sellers on M-Pesa and to hand orders over. | Kept, but only for verified hub managers (see 4.4) |

### 4.2 Other people's data (changing an ID in the URL)

| Looked at | Found | Action |
| --- | --- | --- |
| `/sell/drop-offs`, `/buy/orders` | Filtered by the user id from the session, never from the URL | Nothing wrong |
| `/hub/drop-offs/{id}/receive`, `/hub/orders/{id}/collect` | Scoped to the manager's own hub. Another hub's id returns 404, which tests check. | Nothing wrong |
| `GET /hotspots` | **No authentication at all:** anyone could read the stock at every hub | **Fixed:** needs a logged-in user |
| `/partner/*` (our proxy to Group 12) | **No authentication at all.** Anyone on the internet could make our server post venues and reports into Group 12's live data, so we were an open relay into a partner's system. | **Fixed:** needs a logged-in user, and the client now sends the session |

### 4.3 Error messages

| Looked at | Found | Action |
| --- | --- | --- |
| Every `catch` block | **26 handlers sent `{"error": err.message}` with a 500.** MySQL messages name tables and columns and quote SQL, for example `Unknown column 'x' in 'field list'`. The global error handler also echoed `err.message`. | **Fixed:** `sendServerError()` returns `{"code":500,"message":"Something went wrong on our side","ref":"…"}` and writes the full error to the server log under the same `ref` |
| 400 and 404 messages | They describe the caller's own input, such as "type must be one of…" or "Route GET /x not found" | Nothing wrong |
| Malformed JSON | Returns `400 Request body must be valid JSON`, with no stack trace (tested) | Nothing wrong |
| Errors from Group 12 | Their 400, 404 and 409 messages are passed on. Anything else becomes our own 502 "Partner data unavailable". | Nothing wrong |

### 4.4 Write endpoints and extra fields

| Looked at | Found | Action |
| --- | --- | --- |
| `POST /auth/register` | **The caller chooses `role`, so anyone could sign up as a hub manager of any hub.** They would then see sellers' names and phones and be able to record payouts. | **Fixed:** hub manager signup needs `invite_code` to match `HUB_INVITE_CODE` in `.env` (403 otherwise, tested). With no code set, hub manager signup is switched off. |
| `PATCH /auth/me` | Only `name` and `phone` are used; `role`, `hotspot_id` and `id` in the body are ignored. | Nothing wrong; added a test that sends `role: hub_manager` and checks it's ignored |
| Drop-offs, scrap logs, orders | Each destructures only the documented fields. `status`, `id` and similar fields in the body are ignored. | Nothing wrong |
| All SQL | Parameterised (`?`), never built from request text | Nothing wrong |

### 4.5 Keys in the wrong place

| Looked at | Found | Action |
| --- | --- | --- |
| Git history | Searched every commit for our real key: **0 matches**. `server/.env` has never been committed. Commit `48fda28` added the placeholder `API_TOKEN=anything-for-now` to the README. It isn't a key we use, and it has since been removed. | Nothing to rotate |
| README and `openapi.yaml` | Placeholders only (`<your-api-key>`, `$TOKEN`) | Nothing wrong |
| Request log (`server/logs/requests.jsonl`, gitignored) | Records only whether an Authorization header was sent, never its value. It saves the body of failed requests, with passwords redacted, **but a failed hub manager signup would have saved the invite code**. | **Fixed:** any field named like password, invite, token or key is redacted |
| Startup output | Prints the number of keys and the consumer names only | Nothing wrong |

### 4.6 Other things we found

| Found | Action |
| --- | --- |
| **The first version of the rate limiter (commit `1f27056`) could be dodged.** It counted requests per raw `Authorization` header before checking the key, so a different made-up token on every request got a fresh limit each time. It also broke 7 of our own tests, because the test suite legitimately sends more than 100 requests a minute. | Rewritten: unknown callers are counted per IP, and valid keys per consumer, after the key check. The tests set high limits, and `security.test.js` checks the real behaviour with small ones. |
| **Behind ngrok, every request comes from `127.0.0.1`**, so a per-IP limit would have counted all of Group 1's and everyone else's traffic as one client. | `trust proxy` is set to `loopback`, so ngrok's `X-Forwarded-For` is used, but only when the connection comes from this machine. A remote client can't fake its address. |
| **Unlimited login attempts** | 20 per 15 minutes per IP |
| CORS allows any origin | Accepted. We authenticate with headers, not cookies, so another website can't use a visitor's session. |
| The webapp keeps its session token in `localStorage`, which a cross-site scripting bug could read | Accepted for now. React escapes all output, and the client never uses `dangerouslySetInnerHTML` or `innerHTML` (checked). Changing a password logs out every other session, and sessions expire after 7 days. |
| **Group 12 started requiring an API key** (their own Week 9). Our calls to them got `401 API Key not found`; while that lasted, our server answered "Partner data unavailable" (502) without leaking anything, and hub recommendations still worked without the AccessMap ranking. | **Resolved 2026-10-30:** Group 12 sent our key privately. It is in `PARTNER_API_KEY` in `server/.env` (never in code) and is sent in their `am-api-key` header. Their contract tests pass again. |

## 5. Tests

Added in `server/__tests__/security.test.js`, `user-auth.test.js` and `flow.test.js`:

- No key → 401; wrong key in either header → 401; valid key with `X-API-Key` → 200; valid key with `Authorization: Bearer` → 200
- `API_KEYS` loads one key per consumer, keeps only hashes, and still accepts the older single `API_TOKEN`
- Going over the limit gives `200 200 429 429`, with `Retry-After` and a JSON body; another consumer is unaffected
- A burst of login attempts is limited (`401 401 429`)
- `/hotspots` and `/partner/*` now return 401 without a session
- Hub manager signup without or with a wrong invite code → 403
- `PATCH /auth/me` ignores `role` and `hotspot_id`

Result: the whole suite passes, including the 7 contract tests in `patner.test.js` that call Group 12's live API with the key they issued us.
