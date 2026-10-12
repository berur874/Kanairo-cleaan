# Kanairo-Klean API

Kanairo-Klean connects informal waste collectors, local aggregation yards, and recyclers; this API lets the Artisans App find active material collection locations, check material prices and stock, and report reusable scrap left after a job.

## Access and authentication

The API currently requires no authentication. Do not send an `Authorization` header. Authentication is not implemented yet; until it is added, the local base URL is `http://localhost:5050`.

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

On macOS/Linux, use `cp .env.example .env` instead. Edit `.env` in the `server` directory and set `DB_PASSWORD` to the password for your local MySQL account. The template uses `root`; change `DB_USER` too if your MySQL account has another name. Never commit your `.env` file.

Create and seed the local database, then start the API:

```sh
npm run db:schema
npm run db:seed
npm start
```

Keep that terminal open. In a second terminal, run the quickstart request (Windows PowerShell users can use `curl.exe`):

```sh
curl -i http://localhost:5050/materials
```

The seeded database returns `200 OK` and a JSON array of materials. `npm run db:seed` clears and replaces the local tables, so only run it against a development database whose data can be reset.

## Endpoints

All responses use JSON. The examples below were captured from the API using its seeded local database. IDs and timestamps from `POST /scrap-logs` are generated and will differ on each successful request.

### List active collection locations

`GET /collection-locations` returns active locations only.

```sh
curl http://localhost:5050/collection-locations
```

```json
[
   {"location_id":"1","name":"Dandora","area":"Dandora","is_active":true},
   {"location_id":"2","name":"Gikomba","area":"Gikomba","is_active":true},
   {"location_id":"3","name":"Industrial Area","area":"Industrial Area","is_active":true},
   {"location_id":"6","name":"Eastleigh","area":"Eastleigh","is_active":true},
   {"location_id":"8","name":"Ruiru","area":"Ruiru","is_active":true}
]
```

### List materials and prices

`GET /materials` returns the full catalog.

```sh
curl http://localhost:5050/materials
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

Pass `type` and/or `min_quantity_kg` as query parameters. The minimum is inclusive. This example returns aluminum with at least 400 kg in stock:

```sh
curl "http://localhost:5050/materials?type=metal&min_quantity_kg=400"
```

```json
[
   {"material_id":"ALU","name":"Aluminium","type":"metal","quantity_kg":430,"unit_price_kes":85}
]
```

If no materials match, the response is `200 OK` with `[]`.

### Create a leftover-scrap log

`POST /scrap-logs` requires `job_id`, `artisan_id`, `material_type`, and a positive numeric `quantity_kg`. `notes` is optional.

```powershell
$body = @{
   job_id = 'docs-example-20261012'
   artisan_id = 'art-docs'
   material_type = 'plastic'
   quantity_kg = 1.25
   notes = 'README quickstart example'
} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:5050/scrap-logs' -Method Post -ContentType 'application/json' -Body $body
```

On macOS/Linux, send the same request with curl:

```sh
curl -i -X POST http://localhost:5050/scrap-logs -H 'Content-Type: application/json' -d '{"job_id":"docs-example-20261012","artisan_id":"art-docs","material_type":"plastic","quantity_kg":1.25,"notes":"README quickstart example"}'
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

Invalid scrap-log input returns `400 Bad Request` with a `code` and `message`:

```http
POST /scrap-logs
Content-Type: application/json
```

```json
{"code":400,"message":"job_id, artisan_id, material_type and quantity_kg are required"}
```

An unknown route returns `404 Not Found` in the same format:

```json
{"code":404,"message":"Route GET /unknown not found"}
```

Malformed JSON also returns `code` and `message`. Database failures return `500` with an `error` field. A valid catalog filter with no matches is not an error; it returns `200` and `[]`.

## API contract

See [`openapi.yaml`](openapi.yaml) for the OpenAPI 3.0 contract, including request and response schemas.

## Optional: run the web client

The API and Vite client run separately. To start the client in another terminal:

```sh
cd client
npm ci
npm run dev
```
