# CONTRACT_DEVIATIONS.md

## Week 5 — GET Endpoints vs. `openapi.yaml`

Scope: the two GET endpoints defined in `openapi.yaml` for the Group 1 (Artisans) consumer contract — `GET /materials` and `GET /collection-locations`. (`POST /scrap-logs` is a write endpoint and is out of scope for this week per the lab handout.)

## Verdict: no changes were made to `openapi.yaml`

The contract itself was correct. The drift found during verification was entirely on the implementation side — the backend was not shaping its database rows into the exact response schema the contract promised. The fix was applied to the server code, not the contract.

## Drift found and fixed

### `GET /materials`

- **Before:** `SELECT * FROM materials` returned raw DB columns: `id, name, type, price, unit, change_pct, trend, stock_kg`.
- **Contract (`Material` schema) requires:** `material_id, name, type, quantity_kg, unit_price_kes`.
- **Issues:**
  - `id` → should be `material_id`
  - `price` → should be `unit_price_kes`
  - `stock_kg` → should be `quantity_kg`
  - `unit`, `change_pct`, `trend` are DB-only fields not in the contract at all.
- **Fix:** `server/index.js` now selects only the needed columns and maps them to the exact contract field names/types before responding.

### `GET /collection-locations`

- **Before:** joined `hotspots` + `materials` and returned `id, name, area, material, activity, stock, active`.
- **Contract (`CollectionLocation` schema) requires:** `location_id, name, area, is_active`.
- **Issues:**
  - `id` (int) → should be `location_id` (string)
  - `active` (0/1 tinyint) → should be `is_active` (boolean)
  - `material`, `activity`, `stock` are DB-only/joined fields not in the contract.
- **Fix:** `server/index.js` now selects only `id, name, area, active` from `hotspots` and maps them to the exact contract field names/types.

## Frontend impact

The same two paths (`/materials`, `/collection-locations`) were also being used internally by the React frontend's price ticker and hotspot showcase UI, which relied on the extra DB-only fields above. Rather than compromise the contract to keep those fields, two new **internal, non-contract** endpoints were added:

- `GET /materials/market` — full material rows for the frontend price ticker.
- `GET /collection-locations/showcase` — hotspot + material join for the frontend showcase cards.

`client/src/utils/marketData.jsx` was updated to call these internal endpoints instead, so the contract-facing endpoints stay strictly conformant while the UI keeps working.

## Verification

Both `GET /materials` and `GET /collection-locations` were tested live against the local MySQL-backed server via Swagger-equivalent `Invoke-RestMethod` calls and checked field-by-field against `openapi.yaml`:
- All contract fields present, correctly named, correctly typed.
- No extra fields in the response.
- No missing required fields.
- Status code 200 on success (no error paths defined in the contract for these list endpoints).

---

## Week 6 — Write Endpoint (`POST /scrap-logs`) vs. `openapi.yaml`

Scope: the write endpoint defined in `openapi.yaml`.

## Verdict: no changes were made to `openapi.yaml`

The contract itself was kept unchanged. The implementation was updated to match the contract and Week 6 validation rules.

## Drift found and fixed

- **Before:** `POST /scrap-logs` accepted `hotspot_id, material_id, quantity_kg` and returned `{ id, hotspot_id, material_id, quantity_kg }`.
- **Contract requires request (`ScrapLogInput`):** `job_id, artisan_id, material_type, quantity_kg` (required), with optional `notes`.
- **Contract requires response (`ScrapLog`):** `log_id, job_id, artisan_id, material_type, quantity_kg, logged_at` (plus optional `notes`).

### Implementation fixes applied

- Added validation-first checks before DB writes:
  - required fields present
  - correct types (`quantity_kg` must be a number)
  - usable values (non-empty strings, positive quantity)
- Invalid payloads now return **400 Bad Request** with `{ code, message }`.
- Successful creates now return **201 Created** with the exact `ScrapLog` response shape.
- Database schema support was aligned so writes persist all required contract fields.

## Verification focus for Week 6

- Valid payload -> **201 Created** and persisted row.
- Missing/invalid required fields -> **400 Bad Request**.
- Response payload fields match `ScrapLog` naming and types.
