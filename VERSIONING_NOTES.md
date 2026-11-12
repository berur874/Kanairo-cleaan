# Versioning notes (Week 13)

## Part A: the breaking change

**1. The change, in one sentence.** In v2, `GET /materials` and `GET /collection-locations` return `{ "data": [ ... ], "count": N }` instead of a bare list.

**2. Why it is worth a break.** A bare list has nowhere to put paging (next page, total) or any other list-level information, so adding it later would be a second breaking change. Wrapping now means the next addition is non-breaking.

**3. Prediction: which line in Group 1's code fails?**
Group 1 confirmed (reply of 12 November 2026) the two places in their code that loop directly over our response:

- `GET /materials`: `server/kanairo.js`, line 126 (`materials.map`)
- `GET /collection-locations`: `server/routes/partner.js`, line 115 (`locations.map`)

Both loop over a plain list. In v1 that list was the whole response body. In v2 it is inside `data`, so without a change the body is an object, `.map` is not a function, and they would have shown saved prices or an error. They had already added support for both shapes in `server/kanairoVersions.js` (lines 14 and 21) after reading our notice, and switched to v2. The item fields are the same, so nothing else changed for them.

**Their POST is not versioned.** Group 1 writes with `POST /collection-locations/{id}/drop-offs`, not the deprecated `POST /scrap-logs`. They said it is "still on v1" because there is no v2 of it. That is correct: the drop-off POST is unchanged and not deprecated in this release, so it needed no migration. Group 1 uses no deprecated endpoint other than the two GET lists, and both of those are now on v2.

**How the notice went.** I sent Group 1 the full text of `DEPRECATION_NOTICE.md` on 11 November 2026 and asked them to reply when read. They did, on 12 November, with the two file-and-line answers above. Their reply also shows they read it closely: they had already added support for both response shapes after the notice, before we asked.

## Part B and C: how v1 and v2 run side by side

- `server/catalog.js`: the one place that reads the database for both endpoints. Both versions use it, so a fix lands in both.
- `server/v1.js`: frozen. A bare list. Mounted at `/v1` **and** at `/`, so Group 1's existing URLs (`/materials`, `/collection-locations`) keep working.
- `server/v2.js`: the new shape, in one function (`toV2`). Mounted at `/v2`.
- `server/deprecate.js`: adds `Deprecation: true`, `Sunset` and `Link: <...>; rel="successor-version"` to every v1 response. Sunset date: Thursday 12 November 2026.
- Each route has the API key check inside it, so `/v2/...` needs a key like everything else (tested).
- The Week 12 log already prints `req.baseUrl + req.path`, so `/v2/materials` and `/v1/materials` show their version. `/stats` has separate rows `GET /v1/materials`, `GET /materials` and `GET /v2/materials`.
- `openapi.yaml` is now 1.3.0: the two v1 GETs are marked deprecated and `/v2/...` is documented.

**Evidence that v1 did not change**

- Before touching anything, I saved four v1 responses (status and body): `GET /materials`, `GET /collection-locations`, `GET /materials?type=metal&min_quantity_kg=100` and `GET /materials?type=bad` (a 400). After the change, a `diff` of all four printed nothing.
- `server/__tests__/versions.test.js` (21 tests) keeps proving it: exact v1 field names, a bare list, the unversioned URLs equal to `/v1`, the unchanged 400 body, the v2 shape, v2 needing a key, the three deprecation headers on v1 and the unversioned URLs, and no such headers on v2 or unknown paths.

## Part E: migrating to Group 12's v2

**Their notice** (`DEPRECATION_NOTICE.md` from Group 12, dated 4 November 2026) covers all five endpoints we use, the v2 URLs, a before-and-after example, answers to our questions (`?category=` still works, the `am-api-key` header and our key are unchanged, public reads need no key) and how they will confirm our migration from their `/api/stats`. Their v1 stays live through Friday 13 November 2026 (Demo Day).

**How it felt, and what it left out.** My first instinct was to check what would actually break, and because their v1 stays live through 13 November, nothing did. The notice was thorough, but it left the sunset soft: a planned date of 13 November, then "we may retire v1, but we will confirm", so I did not know when to treat v1 as gone. It also assumed one place in our code to change, and we had two, because the venue cache behind hub recommendations also called `/api/venues`.

**What changed for us**

| Endpoint we use | v1 | v2 | Our code |
|---|---|---|---|
| List venues | `GET /api/venues`, a bare array | `GET /v2/venues`, `{ data, count }` | **The one breaking change.** `parseVenueList` unwraps `data` |
| One venue | `/api/venues/:slug` | `/v2/venues/:slug` | Path only; body identical |
| Rating | `/api/venues/:slug/rating` | `/v2/venues/:slug/rating` | Path only; body identical |
| Add a venue | `POST /api/venues` | `POST /v2/venues` | Path only; body identical |
| Submit a report | `POST /api/reports` | `POST /api/reports` | Does not move |

**What I changed**

- `server/partner.js` is now the only file that knows Group 12's paths and shapes. Each version has its own `paths` and its own `parseVenueList`, so the rest of the app always receives the same plain list. The v2 parser checks the shape and says `unexpected v2 shape` if it is wrong.
- `PARTNER_VERSION=v1|v2` in `server/.env` picks the version, read on every call. The migration is one word and so is the rollback. A mistyped value is an error at startup, not a silent fallback. The server prints `Group 12 integration: PARTNER_VERSION=v2 (/v2/venues)` when it starts.
- `server/app.js`: all five partner calls take their path from `partner.js`, and the list goes through the parser.
- `server/marketplace.js`: the venue cache behind hub recommendations also called `/api/venues` and required a bare array. Without this change it would have kept working on v1 only, and lost the accessibility ranking after a switch to v2.
- `server/__tests__/partner.test.js` tests the parsers. `server/__tests__/partner-version.test.js` runs the app against a stand-in Group 12 that serves both versions.

**The quiet failure, checked on purpose.** The Week 11 fallback hides a broken migration: if the parser throws, the route serves the saved copy and the page looks fine. So I checked for it, and a test now pins it down: when v2 answers with the wrong shape, the response is `"stale": true` and the log says `partner call failed (unexpected v2 shape ...)`.

**Checked against Group 12's live API on 2026-11-11** (our real server, our real key): with `PARTNER_VERSION=v2`, `GET /partner/venues?category=market` returned HTTP 200 with `"stale": false`, 11 venues, and no `partner call failed` line. I then switched to v1 and back to v2, and all three worked. Venue details and rating also returned 200 on v2.

**Evidence the migration landed, from our side.** We checked three things:

- Our app reads Group 12's v2 live: `GET /partner/venues?category=market` returns `"stale": false` with live venues, and the log has no `partner call failed` line.
- Group 12's two versions answer differently, as their notice says. Their v1, `GET /api/venues?category=hospital`, returns a bare array and carries `Deprecation: true`, `Sunset: Fri, 13 Nov 2026` and a `Link` to `/v2/venues`. Their v2, `GET /v2/venues?category=hospital`, returns `{ "data": [...], "count": N }`.
- `server/__tests__/partner-version.test.js` runs our app against a stand-in Group 12 and records every path we call: `GET /v2/venues` on v2, `GET /api/venues` on v1, and `POST /api/reports` on both.

A second confirmation from Group 12's own `/api/stats`, showing a `GET /v2/venues` row with our caller label, can be added once they have read it out for us.

## Part F: who still uses v1?

**Group 1: no longer on v1.** On 12 November 2026 at 15:11 EAT (12:11 UTC), Group 1 retried with their own key and both calls returned 200:

```
2026-11-12T12:11:49.286Z  GET /v2/materials             ->  200
2026-11-12T12:11:49.989Z  GET /v2/collection-locations  ->  200
```

Both arrived through ngrok with a bearer key (`server/logs/requests.jsonl`; their key fingerprint `key-5117b8` appears in the server's console log). Their first attempt, at 19:33 EAT on 11 November, failed with a 502 from ngrok because our API was not running behind the tunnel. That was our fault, not theirs, and it did not touch v1 or v2 itself.

**Everything else in the log.** Since the new code went live, the only ngrok calls to a v1 path (`GET /collection-locations`) were 4 requests on 11 November between 10:13 and 10:15 UTC, from `curl/8.21.0`. That matches my own tests of the tunnel that morning, not a consumer. There have been no v1 calls through ngrok since. One v2 request came from a WhatsApp link preview, which is someone pasting our address into a chat, not a consumer.

**Could v1 be switched off today without breaking anyone?** For Group 1, yes: their two GET calls are on v2 and their POST (`drop-offs`) was never deprecated. I am not switching it off before Demo Day, because I told them v1 would stay up through it. After Demo Day I will check `/stats` for `GET /v1/...` and `GET /materials`, tell Group 1, and only then turn it off.


## Reflection (150 to 250 words, in your own words)

When I first saw Group 12's notice, my instinct was to check what would actually break. Their `GET /api/venues` had moved to `GET /v2/venues`, and the response changed from a bare array to an object with `data` and `count`. Their v1 stayed live through 13 November, so nothing broke immediately. When we tested the migration, we got `"stale": false` with 11 venues. Then Claude Code, which I was using, found a second caller I had not thought about: the venue cache behind hub recommendations also called `/api/venues`. One change in their contract meant two places to fix in our code.

Their notice was thorough: all five endpoints, a table of v2 URLs, before-and-after examples, confirmation that `POST /api/reports` was not moving, and answers to our questions about query parameters and the API key header. What it lacked was commitment. It gave a planned sunset of 13 November, but said they "may retire v1" afterwards, so I did not know when to treat v1 as gone.

Reading my own notice as Group 1, the weak point was that it told two stories. Every v1 response carries `Sunset: Thu, 12 Nov 2026`, but the text says v1 stays up through Demo Day. It also did not say which lines in their code would break. They had to tell me afterwards: `kanairo.js` line 126 and `server/routes/partner.js` line 115.

Next time, I would ask the other team about their code before choosing the change and the date, and give them more than one day of notice.
