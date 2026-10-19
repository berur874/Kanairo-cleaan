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

## Bugs and surprises

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Every call worked with no key at all | Group 12 has not added Week 9 authentication yet, and their contract has no `securitySchemes` | None yet. We will add the key header once they issue one. | Group 12. Open, waiting on them |
| 2 | `GET /api/venues?accessible=not-a-boolean` returned 200 with all 48 venues | The API ignores an invalid `accessible` value, but their contract says invalid query values return 400 | To report to Group 12 | Group 12. Open |
| 3 | Venue `v_034` ("Glee hotel") has `category: "hotel"` | `hotel` is not in the contract's `category` enum, so `POST /api/venues` must be accepting categories outside it | To report to Group 12. Our code should not assume `category` is always one of the 7 listed values. | Group 12. Open |
| 4 | `GET /api/venues?category=spaceship` returned 200 `[]` instead of an error | The contract lists allowed categories for venues but does not say what an unknown category filter should return | To agree with Group 12 and clarify in their contract | Contract ambiguity, both teams. Open |
| 5 | Error bodies are `{"error": "..."}`, which the contract never describes | The contract lists 400 and 404 responses but gives them no schema | To ask Group 12 to add an error schema. We read `error` for now. | Group 12 contract. Open |
| 6 | Group 12's live directory contains test venues: `v_042` to `v_047` ("Test Area") and `v_048` ("Test Venue 1792397745993", Westlands, created 2026-10-19 08:15 UTC) | `v_048` matches the venue our `server/__tests__/patner.test.js` creates. That test POSTs real venues and reports to Group 12's live API on every run. `v_042` to `v_047` came from other testers. | Stop running the POST tests against their live API, or point them at a local copy. Tell Group 12 so they can remove the test rows. | **Ours (Team 13)** for `v_048`. Open |

## Downstream (Part E)

Our API is live for Group 1 at `https://supervoluminous-vikki-unsurlily.ngrok-free.dev`, using `Authorization: Bearer <key>`. Requests can be watched live at `http://localhost:4040`. No issues have been reported yet.
