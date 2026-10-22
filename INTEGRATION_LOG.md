# Integration Log: Week 10

**Consumer:** Kanairo-Klean (Team 13)
**Upstream partner:** Group 12, AccessMap Nairobi API
**Base URL:** `https://accessmap-nairobi-api-1.onrender.com`
**Contract used:** Group 12 `openapi.yaml`, version 1.0.0 (received over WhatsApp)
**Downstream partner:** Group 1 (Find My Artisan), calling our API

## Preflight (Part A)

| Item | Status |
|---|---|
| Partner base URL | `https://accessmap-nairobi-api-1.onrender.com` (hosted on Render, so it does not depend on a laptop being on) |
| Partner server running | Yes, answered on 2026-10-19 at 13:27 EAT |
| Key from partner | **None.** Group 12 has not issued keys yet, and their contract has no security scheme. |
| Partner contract | Group 12 `openapi.yaml` v1.0.0 |

## First call (Part B)

Made from a terminal on 2026-10-19 at 13:27 EAT, with no key and outside our app.

```sh
curl -i https://accessmap-nairobi-api-1.onrender.com/api/venues
```

**Result:** `200 OK`, `application/json`, 48 venues, 0.94 s. Later calls took about 0.38 s each.

We then checked every venue against the `Venue` schema in their contract: required fields, types, the `category` enum, the 8 `accessibility` booleans, `coordinates` and the `addedAt` date-time. Every venue matched except one (see row 3).

Calls made, all read-only:

| Request | Status | Matches contract? |
|---|---|---|
| `GET /api/venues` | 200, 48 venues | Yes, except row 3 |
| `GET /api/venues?category=market` | 200, 11 venues, all `market` | Yes |
| `GET /api/venues?category=hospital&area=Upper%20Hill` | 200, 2 venues, both match | Yes |
| `GET /api/venues?accessible=true` | 200, 27 of 48 venues | Yes |
| `GET /api/venues?accessible=not-a-boolean` | 200, all 48 venues | **No.** The contract says 400 (row 2) |
| `GET /api/venues?category=spaceship` | 200, `[]` | Unclear (row 4) |
| `GET /api/venues/kenyatta-national-hospital` | 200, full venue | Yes |
| `GET /api/venues/no-such-venue-xyz` | 404, `{"error":"No venue found with the given slug"}` | Yes |
| `GET /api/venues/kenyatta-national-hospital/rating` | 200, `{"slug":"kenyatta-national-hospital","averageRating":4.4,"totalReports":5}` | Yes |
| `GET /api/venues/no-such-venue-xyz/rating` | 404, `{"error":"No venue found with the given slug"}` | Yes |

We did not call `POST /api/venues` or `POST /api/reports` by hand, because they write to Group 12's live data.

## Feature (Part C)

**What:** an "Accessible Venues — Nairobi" panel on our Dashboard. It lists Group 12's venues with their area, whether they have a ramp and an accessible toilet, and how many of the 8 accessibility features they have. A dropdown switches between the 7 categories in their contract and defaults to `market`, so collectors with limited mobility can choose where to sell.

**How:** the browser never calls Group 12. Our server calls them and the page calls our server:

- `GET /partner/venues?category=<category>` in `server/app.js` calls `${PARTNER_URL}/api/venues?category=<category>` and returns only `name`, `area`, `address`, `ramp`, `accessibleToilet`, `accessibleParking` and `featureCount`.
- `PARTNER_URL` and `PARTNER_API_KEY` come from `server/.env`. Both are listed in `server/.env.example` and `.env` is gitignored. The `X-API-Key` header is sent only once `PARTNER_API_KEY` is set, because Group 12 has not issued keys yet (row 1).
- `category` defaults to `market` and must be one of the 7 values in their `Venue.category` enum. Anything else gets a 400 from us and never reaches Group 12. `hotel` is left out because it is not in their contract (row 3).
- Field names are taken from the `Venue` schema in Group 12's contract. The route also checks the response is an array before mapping it.

**Result on 2026-10-22:** `200`, 8 market venues, e.g. `{"name":"The Junction Mall","area":"Ngong Road","ramp":true,"accessibleToilet":true,"featureCount":5}`.

## Failure handling (Part D)

Tested on 2026-10-22 by pointing `PARTNER_URL` at addresses that fail:

| Test | Our route returned | Our server log | Page shows |
|---|---|---|---|
| Partner live | 200, 8 venues | none | The venue table |
| Nothing listening (`http://127.0.0.1:5999`) | 502 `{"code":502,"message":"Partner data unavailable"}` | `partner call failed: ECONNREFUSED` | "Partner data is unavailable right now. The rest of the dashboard still works." |
| Misspelt hostname | 502, same body | `partner call failed: ENOTFOUND` | Same message |
| `PARTNER_URL` unset | 502, same body | `partner call skipped: PARTNER_URL is not set` | Same message |

In every case our server kept answering its other routes. Restoring the real `PARTNER_URL` brought the data back with no code change.

## Bugs and surprises

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Every call worked with no key at all | Group 12 has not added Week 9 authentication yet, and their contract has no `securitySchemes` | None yet. We will add the key header once they issue one. | Group 12. Open, waiting on them |
| 2 | `GET /api/venues?accessible=not-a-boolean` returned 200 with all 48 venues | The API ignores an invalid `accessible` value, but their contract says invalid query values return 400 | Retested 2026-10-22 09:08 EAT: now returns `400 {"error":"accessible must be a boolean (true or false)"}`, as the contract says | Group 12. Fixed by Group 12 |
| 3 | Venue `v_034` ("Glee hotel") has `category: "hotel"` | `hotel` is not in the contract's `category` enum, so `POST /api/venues` must be accepting categories outside it | To report to Group 12. Our code should not assume `category` is always one of the 7 listed values. | Group 12. Open |
| 4 | `GET /api/venues?category=spaceship` returned 200 `[]` instead of an error | The contract lists allowed categories for venues but does not say what an unknown category filter should return | To agree with Group 12 and clarify in their contract | Contract ambiguity, both teams. Open |
| 5 | Error bodies are `{"error": "..."}`, which the contract never describes | The contract lists 400 and 404 responses but gives them no schema | To ask Group 12 to add an error schema. We read `error` for now. | Group 12 contract. Open |
| 6 | Group 12's live directory contains test venues: `v_042` to `v_047` ("Test Area") and `v_048` ("Test Venue 1792397745993", Westlands, created 2026-10-19 08:15 UTC) | `v_048` matches the venue our `server/__tests__/patner.test.js` creates. That test POSTs real venues and reports to Group 12's live API on every run. `v_042` to `v_047` came from other testers. | Our side: the POST tests in `patner.test.js` now skip unless `PARTNER_WRITE_TESTS=1`, so a normal `npm test` only reads (7 passed, 6 skipped). Their side: on 2026-10-22 the live list had 36 venues and no test rows, so they have been removed. | **Ours (Team 13)** for `v_048`. Fixed by us; Group 12 cleaned up the data |
| 7 | `GET /api/venues?category=market` returned 11 venues on 2026-10-19 but 8 on 2026-10-22 | Group 12's live data changed between calls: the full list went from 48 to 36 venues and the test rows from row 6 are gone. Cause not yet confirmed with them. | Our panel renders whatever list comes back, so the count does not matter to us. To confirm with Group 12. | Not a bug. Noted |
| 8 | While testing Part D, pointing `PARTNER_URL` at `http://localhost:9` logged `fetch failed` instead of `ECONNREFUSED` | Node's `fetch` refuses to connect to ports on the browser "bad ports" list (9 is one) and throws `bad port` before any network call | Tested with a normal unused port (`5999`) instead, which logged `ECONNREFUSED` as expected | Ours (test setup). Fixed by us |

## Downstream (Part E)

Our API is live for Group 1 at `https://supervoluminous-vikki-unsurlily.ngrok-free.dev`, using `Authorization: Bearer <key>`. Requests can be watched live at `http://localhost:4040`. No issues have been reported yet.
