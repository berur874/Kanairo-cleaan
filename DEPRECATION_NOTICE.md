# Deprecation notice: Kanairo-Klean API v1 (GET lists)

To: Group 1 (Artisans) From: Kanairo-Klean (Team 13),  Date: 2026-11-11

## Summary

v1 of `GET /collection-locations` and `GET /materials` is deprecated. **v2 is live now.** The sunset date on every v1 response is **Thursday 12 November 2026**, but we will **keep v1 running through Demo Day**, so nobody's demo breaks. After Demo Day we will tell you before we turn it off. Please move to v2 as soon as you can.

## What is changing

- The list is wrapped: `[ ... ]` becomes `{ "data": [ ... ], "count": N }`
- That is the only change. It applies to both endpoints.

**Not changing:** the item fields (`material_id`, `name`, `type`, `quantity_kg`, `unit_price_kes`, `location_id`, `area`, `county`, `is_active`), the `?type=` and `?min_quantity_kg=` filters, the error bodies (`{ "code": 400, "message": "..." }`), your API key, the rate limits, and `POST /collection-locations/{id}/drop-offs`.

## Why

Wrapping the list lets us add paging (next page, totals) later without breaking you a second time.

## Before and after

v1 `GET /collection-locations`

```json
[ { "location_id": "1", "name": "Dandora", "area": "Dandora", "county": "Nairobi", "is_active": true } ]
```

v2 `GET /v2/collection-locations`

```json
{ "data": [ { "location_id": "1", "name": "Dandora", "area": "Dandora", "county": "Nairobi", "is_active": true } ],
  "count": 1 }
```

v1 `GET /materials`

```json
[ { "material_id": "ALU", "name": "Aluminium", "type": "metal", "quantity_kg": 390, "unit_price_kes": 85 } ]
```

v2 `GET /v2/materials`

```json
{ "data": [ { "material_id": "ALU", "name": "Aluminium", "type": "metal", "quantity_kg": 390, "unit_price_kes": 85 } ],
  "count": 1 }
```

An empty result in v2 is `{ "data": [], "count": 0 }`, not an error.

## How to migrate

1. Call `/v2/collection-locations` and `/v2/materials` instead of `/collection-locations` and `/materials`. Same key, same `?type=` and `?min_quantity_kg=` filters.
2. Read the list from `body.data` instead of from the body itself. Search your code for where you loop over the response of these two calls.
3. Test it, then tell us, so we can see your calls on `GET /v2/...` in our log and in `/stats`.

You can check before you change any code:

```sh
curl -H "Authorization: Bearer <your-api-key>" https://supervoluminous-vikki-unsurlily.ngrok-free.dev/v2/collection-locations
```

## Timeline

- **2026-11-11 (today):** v2 is live. v1 still works, at `/v1/...` and at the old URLs with no version, and now sends `Deprecation`, `Sunset` and `Link` headers on every response.
- **2026-11-12:** the date in the `Sunset` header. v1 keeps answering after it.
- **Demo Day:** v1 stays running, so both our demos work whichever version you are on.
- **After Demo Day:** we will check our `/stats`, tell you, and only then turn v1 off.

## Questions

Message us any time. We will reply within 2 hours. Please reply when you have read this, so we know it arrived.

Full contract: `openapi.yaml` in the repo (version 1.3.0). Notes on how we built it: `VERSIONING_NOTES.md`.
