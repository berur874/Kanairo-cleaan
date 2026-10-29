# Kanairo-Klean API

Kanairo-Klean connects informal waste collectors, local aggregation yards, and recyclers; this API lets the Artisans App find active material collection locations, check material prices and stock, and report reusable scrap left after a job.

## Access and authentication

Every endpoint requires an API key. Each consumer gets its own key, so we can tell callers apart and revoke one without affecting the others. Send it in either of these headers:

```http
Authorization: Bearer <your-api-key>
```

```http
X-API-Key: <your-api-key>
```

- **Calling our hosted API:** ask the Kanairo-Klean team for a key. Keys are sent privately to one person and are never committed to this repo.
- **Running the API yourself:** you choose the keys. They are the `API_KEYS` value in `server/.env`, one `name:key` pair per consumer (see Quickstart).

A request with no key, a wrong key or a revoked key gets `401 Unauthorized` and is never processed. The local base URL is `http://localhost:5050`.

### Rate limits

| Limit | Applies to |
| --- | --- |
| 100 requests per minute | each API key |
| 300 requests per minute | each IP address, for every request (with or without a key) |

Over a limit you get `429 Too Many Requests`, with a `Retry-After` header giving the seconds to wait, and this body:

```json
{"code":429,"message":"Too many requests","retryAfter":42}
```

Every response from the partner API also has `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers, so you can slow down before hitting the limit.

The examples below use `$TOKEN` as a placeholder for your key. Set it once per terminal before copying them:

```sh
TOKEN=your-api-key              # macOS/Linux
```

```powershell
$TOKEN = 'your-api-key'         # Windows PowerShell
```

## Quickstart

Requirements: Node.js, MySQL 8.0, and a MySQL account that can create the `kanairo` database. From a clean clone, run:

```sh
git clone https://github.com/berur874/Kanairo-cleaan.git
cd Kanairo-cleaan/server
npm ci
```

Create the local database configuration. In PowerShell, copy the template with:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead. Edit `.env` in the `server` directory:

- Set `DB_PASSWORD` to the password for your local MySQL account. The template uses `root`; change `DB_USER` too if your MySQL account has another name.
- Set `API_KEYS` to one `name:key` pair per consumer, separated by commas, for example `API_KEYS=group1:<key>,team13:<key>`. Generate each key with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`. The API will not start without at least one key.
- Set `HUB_INVITE_CODE` if you want hub managers to be able to sign up in the webapp (see below).

Never commit your `.env` file.

Create and seed the local database, then start the API:

```sh
npm run db:schema
npm run db:seed
npm start
```

Keep that terminal open. In a second terminal, set `TOKEN` to one of the keys in `API_KEYS` (see [Access and authentication](#access-and-authentication)), then run the quickstart request (Windows PowerShell users can use `curl.exe`):

```sh
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:5050/materials
```

The seeded database returns `200 OK` and a JSON array of materials. `npm run db:seed` clears and replaces the local tables, so only run it against a development database whose data can be reset.

## Endpoints

All responses use JSON. The examples below were captured from the API using its seeded local database. IDs and timestamps from `POST` requests are generated and will differ on each successful request.

### List active collection locations

`GET /collection-locations` returns active locations only, so `is_active` is always `true`. Each location has a `county`; most are in Nairobi.

```sh
curl -H "Authorization: Bearer $TOKEN" http://localhost:5050/collection-locations
```

```json
[
   {"location_id":"1","name":"Dandora","area":"Dandora","county":"Nairobi","is_active":true},
   {"location_id":"2","name":"Gikomba","area":"Gikomba","county":"Nairobi","is_active":true},
   {"location_id":"3","name":"Industrial Area","area":"Industrial Area","county":"Nairobi","is_active":true},
   {"location_id":"6","name":"Eastleigh","area":"Eastleigh","county":"Nairobi","is_active":true},
   {"location_id":"8","name":"Ruiru","area":"Ruiru","county":"Kiambu","is_active":true}
]
```

### List materials and prices

`GET /materials` returns the full catalog. `unit_price_kes` is the price in KES per kg. `type` is always one of `metal`, `plastic`, `paper`, `glass` or `e-waste`.

```sh
curl -H "Authorization: Bearer $TOKEN" http://localhost:5050/materials
```

```json
[
   {"material_id":"ALU","name":"Aluminium","type":"metal","quantity_kg":430,"unit_price_kes":85},
   {"material_id":"EWASTE","name":"E-Waste","type":"e-waste","quantity_kg":640,"unit_price_kes":120},
   {"material_id":"GLASS","name":"Clear Glass","type":"glass","quantity_kg":290,"unit_price_kes":8.5},
   {"material_id":"HDPE","name":"HDPE Plastic","type":"plastic","quantity_kg":1100,"unit_price_kes":35},
   {"material_id":"PAPER","name":"Cardboard","type":"paper","quantity_kg":3200,"unit_price_kes":12},
   {"material_id":"PET","name":"PET Plastic","type":"plastic","quantity_kg":2840,"unit_price_kes":28.5}
]
```

### Filter materials

Pass `type` and/or `min_quantity_kg` as query parameters. `type` must be one of the five types above. `min_quantity_kg` must be a number of 0 or more and is inclusive. Anything else returns `400` (see [Error responses](#error-responses)). This example returns aluminum with at least 400 kg in stock:

```sh
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5050/materials?type=metal&min_quantity_kg=400"
```

```json
[
   {"material_id":"ALU","name":"Aluminium","type":"metal","quantity_kg":430,"unit_price_kes":85}
]
```

If valid filters match no materials, the response is `200 OK` with `[]`.

### Report a scrap drop-off

`POST /collection-locations/{location_id}/drop-offs` records leftover scrap brought to one of the locations above. Use a `location_id` from `GET /collection-locations`. The body needs:

- `material_type`: one of `metal`, `plastic`, `paper`, `glass` or `e-waste`
- `quantity_kg`: a number above 0
- `source`: text saying who is dropping it off, up to 120 characters
- `notes`: optional text

```powershell
$body = @{
   material_type = 'metal'
   quantity_kg = 12.5
   source = 'README example: electrical job in Embakasi'
   notes = 'Offcut copper wiring and brass fittings.'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5050/collection-locations/1/drop-offs' -Method Post -Headers @{ Authorization = "Bearer $TOKEN" } -ContentType 'application/json' -Body $body
```

On macOS/Linux, send the same request with curl:

```sh
curl -i -X POST http://localhost:5050/collection-locations/1/drop-offs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"material_type":"metal","quantity_kg":12.5,"source":"README example: electrical job in Embakasi","notes":"Offcut copper wiring and brass fittings."}'
```

Successful response: `201 Created`. New drop-offs are `pending` until our staff receive them.

```json
{
   "drop_off_id":"drop-0005",
   "location_id":"1",
   "material_type":"metal",
   "quantity_kg":12.5,
   "source":"README example: electrical job in Embakasi",
   "notes":"Offcut copper wiring and brass fittings.",
   "status":"pending",
   "created_at":"2026-10-16T09:00:51.000Z"
}
```

Your `drop_off_id` and `created_at` will differ. An unknown or inactive location returns `404`.

### Create a leftover-scrap log (deprecated)

`POST /scrap-logs` is deprecated as of contract 1.1.0. Use drop-offs above instead. It still works for now and requires `job_id`, `artisan_id`, `material_type`, and a positive numeric `quantity_kg`. `notes` is optional.

```powershell
$body = @{
   job_id = 'docs-example-20261012'
   artisan_id = 'art-docs'
   material_type = 'plastic'
   quantity_kg = 1.25
   notes = 'README quickstart example'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5050/scrap-logs' -Method Post -Headers @{ Authorization = "Bearer $TOKEN" } -ContentType 'application/json' -Body $body
```

On macOS/Linux, send the same request with curl:

```sh
curl -i -X POST http://localhost:5050/scrap-logs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"job_id":"docs-example-20261012","artisan_id":"art-docs","material_type":"plastic","quantity_kg":1.25,"notes":"README quickstart example"}'
```

Successful response: `201 Created`.

```json
{
   "log_id":"log-0020",
   "job_id":"docs-example-20261012",
   "artisan_id":"art-docs",
   "material_type":"plastic",
   "quantity_kg":1.25,
   "notes":"README quickstart example",
   "logged_at":"2026-10-12T11:29:29.000Z"
}
```

The response above is an actual successful response; its generated `log_id` and `logged_at` will differ from your request. The example request creates a new row in the local database each time.

## Error responses

A missing or wrong key returns `401 Unauthorized`:

```sh
curl -i http://localhost:5050/materials
curl -i -H "X-API-Key: wrong" http://localhost:5050/materials
```

```json
{"code":401,"message":"Missing or invalid API token"}
```

Going over a rate limit returns `429 Too Many Requests` with a `Retry-After` header (see [Rate limits](#rate-limits)):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0

{"code":429,"message":"Too many requests","retryAfter":42}
```

Invalid input returns `400 Bad Request` with a `code` and `message`. A drop-off with only `material_type` in the body:

```sh
curl -i -X POST http://localhost:5050/collection-locations/1/drop-offs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"material_type":"metal"}'
```

```json
{"code":400,"message":"material_type, quantity_kg and source are required"}
```

Invalid catalog filters return `400` too:

```sh
curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:5050/materials?type=scrap_metal"
```

```json
{"code":400,"message":"type must be one of: metal, plastic, paper, glass, e-waste"}
```

```sh
curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:5050/materials?min_quantity_kg=abc"
```

```json
{"code":400,"message":"min_quantity_kg must be a number greater than or equal to 0"}
```

A drop-off to an unknown or inactive location returns `404 Not Found`:

```json
{"code":404,"message":"Collection location 99 not found"}
```

An unknown route also returns `404` in the same format:

```json
{"code":404,"message":"Route GET /unknown not found"}
```

Malformed JSON also returns `code` and `message`. A failure on our side returns `500` with `code`, `message` and a `ref` to quote when you report it; it never includes database or stack details. Valid catalog filters with no matches are not an error; they return `200` and `[]`.

## API contract

See [`openapi.yaml`](openapi.yaml) for the OpenAPI 3.0 contract (version 1.2.0), including request and response schemas.

If you set up a database before version 1.1.0, or before the webapp accounts were added, run `npm run db:schema` in `server` again. It adds the missing tables and columns (`county`, `drop_offs`, `users`, `sessions`, and the seller and buyer columns) without deleting data.

## Optional: run the Kanairo webapp

The webapp is Kanairo's own app for its users. It uses separate user logins, not the partner API token above, and adding it did not change any of the endpoints in this README.

| Role | What they do |
| --- | --- |
| Seller | Logs scrap they collected and gets matched to a hub. The hub weighs it and pays them on M-Pesa |
| Hub manager | Weighs incoming scrap (including drop-offs reported through this API), pays sellers, and hands paid orders over to buyers |
| Buyer | Says what material they need, picks a recommended hub that has it in stock, and pays |

At signup every user is asked about accessibility needs. If they have any, hubs are ranked by the accessible AccessMap Nairobi venues (from Group 12's API) near each hub.

With the API running, create `client/.env` containing `VITE_API_URL=http://localhost:5050`, then start the client in another terminal:

```sh
cd client
npm ci
npm run dev
```

Open http://localhost:5173. `npm run db:seed` creates one demo account per role, all with the password `kanairo123`:

| Phone | Role |
| --- | --- |
| `0711000001` | Seller (needs a ramp and an accessible toilet) |
| `0711000002` | Buyer |
| `0711000003` | Hub manager for Dandora |

New hub manager accounts need the invite code from `HUB_INVITE_CODE` in `server/.env`; sellers and buyers can sign up freely. See [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md) for how the API and the webapp are protected.

The webapp's routes are documented at the top of [`server/auth.js`](server/auth.js) (accounts) and in [`server/marketplace.js`](server/marketplace.js) (selling, hubs and buying).
