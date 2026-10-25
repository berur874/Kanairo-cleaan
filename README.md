# Kanairo-Klean API

Kanairo-Klean connects informal waste collectors, local aggregation yards, and recyclers; this API lets the Artisans App find active material collection locations, check material prices and stock, and report reusable scrap left after a job.

## Access and authentication

Every endpoint requires an API token sent as a Bearer token:

```http
Authorization: Bearer <your-api-token>
```

- **Calling our hosted API:** ask the Kanairo-Klean team for a token. Tokens are shared privately and are never committed to this repo.
- **Running the API yourself:** you choose the token. It is the `API_TOKEN` value in `server/.env` (see Quickstart).

Requests without a valid token get `401 Unauthorized` (see [Error responses](#error-responses)). The local base URL is `http://localhost:5050`.

The examples below use `$TOKEN` as a placeholder. Set it once per terminal before copying them:

```sh
TOKEN=your-api-token            # macOS/Linux
```

```powershell
$TOKEN = 'your-api-token'       # Windows PowerShell
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
- Set `API_TOKEN` to any long random string. This is the token callers must send. The API will not start without it.

Never commit your `.env` file.

Create and seed the local database, then start the API:

```sh
npm run db:schema
npm run db:seed
npm start
```

Keep that terminal open. In a second terminal, set `TOKEN` to the same value as `API_TOKEN` (see [Access and authentication](#access-and-authentication)), then run the quickstart request (Windows PowerShell users can use `curl.exe`):

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

A missing, wrong, or non-Bearer token returns `401 Unauthorized`:

```sh
curl -i http://localhost:5050/materials
```

```json
{"code":401,"message":"Missing or invalid API token"}
```
curl -i -X POST http://localhost:5050/scrap-logs -H 'Content-Type: application/json' -d '{"job_id":"docs-example-20261012","artisan_id":"art-docs","material_type":"plastic","quantity_kg":1.25,"notes":"README quickstart example"}'

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

Malformed JSON also returns `code` and `message`. Database failures return `500` with an `error` field. Valid catalog filters with no matches are not an error; they return `200` and `[]`.

## API contract

See [`openapi.yaml`](openapi.yaml) for the OpenAPI 3.0 contract (version 1.1.0), including request and response schemas.

If you set up a database before version 1.1.0, run `npm run db:schema` in `server` again. It adds the new `county` column and `drop_offs` table without deleting data.

## Optional: run the web client

The API and Vite client run separately. To start the client in another terminal:

```sh
cd client
npm ci
npm run dev
```
# Kanairo-Klean: Database Deployment Guide (Railway MySQL)

This guide explains how to deploy the Kanairo-Klean MySQL database on Railway, load the schema and starter data, and connect the API to it.

The database runs on Railway. You connect to it from your own computer through a temporary tunnel only to set it up. After that, the API reaches it over Railway's private network.

## Contents

1. [Prerequisites](#prerequisites)
2. [Create the project and database](#step-1-create-the-project-and-database)
3. [Patch the code for custom ports](#step-2-patch-the-code-for-custom-ports)
4. [Connect from your computer](#step-3-connect-from-your-computer)
5. [Create `server/.env`](#step-4-create-serverenv)
6. [Create the tables and load starter data](#step-5-create-the-tables-and-load-starter-data)
7. [Verify the database](#step-6-verify-the-database)
8. [Connect the API to the database](#step-7-connect-the-api-to-the-database)
9. [Clean up](#step-8-clean-up)
10. [Maintenance](#maintenance)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js installed, the repository cloned, and dependencies installed:
  ```sh
  cd Kanairo-cleaan/server
  npm ci
  ```
- A Railway account that is allowed to deploy (an active trial or the Hobby plan).
- The Railway CLI:
  ```sh
  npm i -g @railway/cli
  railway login
  ```

## Step 1: Create the project and database

1. In Railway, click **New Project → Empty Project**.
2. On the project canvas, click **Create → Database → Add MySQL**.
3. Keep the service name `MySQL`. The variable references in Step 7 depend on this name.
4. Wait until the service shows as active.

> **Important:** the database and the API must live in the **same Railway project and environment**. Private hostnames such as `mysql.railway.internal` only resolve between services in the same project. If the API is in a different project, it crashes with `getaddrinfo ENOTFOUND mysql.railway.internal`.

## Step 2: Patch the code for custom ports

The original code ignores `DB_PORT` and has no SSL option. Railway's tunnel uses a non-standard port, so add both. From the `server` folder:

```sh
sed -i "s|^\( *\)password: process.env.DB_PASSWORD,|&\n\1port: Number(process.env.DB_PORT) \|\| 3306,\n\1ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,|" app.js db/migrate.js
```

Check that it applied:

```sh
grep -n "DB_PORT" app.js db/migrate.js
```

You should see four matches (one in `app.js`, three in `db/migrate.js`). Local MySQL keeps working, because the new settings only take effect when `DB_PORT` and `DB_SSL` are set.

Commit and push the change:

```sh
git add server/app.js server/db/migrate.js
git commit -m "Support DB port and SSL"
git push
```

## Step 3: Connect from your computer

The database's private address only works inside Railway, so your computer needs a tunnel. The tunnel requires an SSH key.

```sh
ssh-keygen -t ed25519        # press Enter at each prompt; do this once
railway login
railway link                 # choose your project
railway connect MySQL --tunnel-only
```

It prints connection details, for example:

```
Host: 127.0.0.1
Port: 34573
User: root
```

**Keep this terminal open.** Closing it closes the tunnel. The port can change each time you restart it.

### Alternative without SSH

1. On the MySQL service, open **Settings → Networking** and click **Add Public Access**.
2. In the service's **Variables** tab, read `RAILWAY_TCP_PROXY_DOMAIN` and `RAILWAY_TCP_PROXY_PORT` (use the eye icon to reveal values).
3. Use those as `DB_HOST` and `DB_PORT` in the next step.
4. Remove public access when you are done. Anyone with the connection string can connect to a publicly exposed database.

## Step 4: Create `server/.env`

Open a **second terminal**. Get the password from the MySQL service's **Variables** tab (`MYSQLPASSWORD`), then create `server/.env`:

```
DB_HOST=127.0.0.1
DB_PORT=34573
DB_USER=root
DB_PASSWORD=<MYSQLPASSWORD>
DB_NAME=kanairo
API_TOKEN=anything-for-now
```

Use the host and port your tunnel printed. **Never commit this file.** The repository's `.gitignore` already excludes it.

## Step 5: Create the tables and load starter data

From the `server` folder, with the tunnel still open:

```sh
npm run db:schema
npm run db:seed
```

They should finish with `Ran schema.sql` and `Ran seed.sql`.

> **Warning:** `npm run db:seed` deletes and replaces all table data. Run it only once, on a new empty database. Never run it again after real data exists.

## Step 6: Verify the database

Still in the `server` folder, with the tunnel open:

```sh
node -e "require('dotenv').config(); const m=require('mysql2/promise'); (async()=>{const c=await m.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'kanairo'}); const [t]=await c.query('SHOW TABLES'); console.log(t); const [r]=await c.query('SELECT COUNT(*) AS n FROM materials'); console.log(r); await c.end();})()"
```

Expected result: six tables and a non-zero count for `materials`.

| Table |
|---|
| `drop_offs` |
| `hotspot_materials` |
| `hotspots` |
| `materials` |
| `scrap_logs` |
| `transactions` |

> **Note:** Railway's **Data** tab shows only the default database named `railway`. Your tables are in a separate database named `kanairo`, so you will not see them there. This is expected.

## Step 7: Connect the API to the database

1. In the **same project** as the database, click **Create → GitHub Repo** and select the repository.
2. In the new service's **Settings**, set **Root Directory** to `server`.
3. Open **Variables → Raw Editor** and add:
   ```
   API_TOKEN=<a long random string>
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=kanairo
   ```
   Generate the token with `openssl rand -hex 32` and keep a copy.
4. Do **not** set `PORT` (Railway provides it) or `DB_SSL`. Leave out `PARTNER_URL` and `PARTNER_API_KEY` unless you use the partner venues route.
5. If Railway shows an **Apply changes** or **Deploy** banner, click it.
6. Open **Settings → Networking → Generate Domain**.
7. Check the deployment logs for `Server is running on port ...`.
8. Test the API:
   ```sh
   curl -i https://YOUR-DOMAIN/materials/market
   curl -i -H "Authorization: Bearer YOUR_API_TOKEN" https://YOUR-DOMAIN/materials
   ```
   The first needs no token and returns JSON. The second returns `200` with the right token and `401` with a wrong one.

The API reaches the database over Railway's private network, so the tunnel is no longer needed.

## Step 8: Clean up

- Stop the tunnel with `Ctrl+C`.
- Remove **Public Access** from the MySQL service if you enabled it.
- Delete `DB_PASSWORD` from your local `server/.env`, or make sure the file is never committed.
- Delete any leftover empty or crashed Railway projects so they do not use your trial credit.

## Maintenance

- **Backups:** reopen the tunnel, then run:
  ```sh
  mysqldump -h 127.0.0.1 -P <tunnel-port> -u root -p kanairo > backup.sql
  ```
  Also check Railway's backup options for your plan.
- **Schema changes:** per the project README, `npm run db:schema` adds new columns and tables without deleting data. Take a backup first.
- **Never re-run `db:seed`** once real data exists.
- **Changing the tunnel:** if you restart it, update `DB_PORT` in `server/.env` to the new port.

## Troubleshooting

| Error | Cause and fix |
|---|---|
| `ENOTFOUND mysql.railway.internal` on your computer | You used the private host locally. Use the tunnel (`127.0.0.1`) or the public proxy instead. |
| `ENOTFOUND mysql.railway.internal` in the API logs | The API is in a different Railway project from the database. Add it to the database's project. |
| `No SSH keys found` | Run `ssh-keygen -t ed25519`, then retry the tunnel. |
| `Cannot find module 'dotenv'` | Run the command from the `server` folder, where dependencies are installed. |
| `ECONNREFUSED` on your computer | The tunnel is not running, or `DB_PORT` is out of date. |
| Blank `Failed to initialize scrap_logs schema:` in the logs | In `server/index.js`, change `err.message` to `err` in the `console.error` call to see the real error. |
| Variables show `${{...}}` literally or the host is `localhost` | The variables were added to the wrong service, or the database service is not named `MySQL`. |
| Tables not visible in Railway's Data tab | Expected. The Data tab shows the `railway` database, and your tables are in `kanairo`. |

## Security notes

- Keep `.env` out of version control.
- Use a strong, random `API_TOKEN` and share it privately.
- Do not leave Public Access enabled on the database.
- Several API routes (`/inventory/deduct`, `/hotspots/inventory`, `/transactions`) do not require a token, so anyone who has the API URL can call them. This is acceptable for a demo but should be fixed before real use.
