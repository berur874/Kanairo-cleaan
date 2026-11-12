# Retrospective

**Vincent Favor Mwende** · 182037

## 1. The Hardest Part of the Lifecycle

The hardest stage was **Integrate**. Integrating with Group 12’s live API meant trusting that their endpoints would behave the way their contract said — and sometimes they did not.

The clearest example: when we sent a nonsense value for the `accessible` filter on their venues endpoint, their API returned all 48 venues with a success status instead of rejecting the request. I logged it, Group 12 confirmed it the same day, and they fixed it within three days.

The deeper difficulty came from our own design. When I built the saved-data fallback, I included safeguards — a staleness flag, a timestamp, a yellow warning banner, and a counter on our stats page. But the page still loads and looks functional. A user might never notice the banner. That is what made integration hardest: not the bugs, but deciding how much to cushion a partner’s downtime versus how much to let the failure be loud enough that someone acts.

## 2. One Real Cross-Team Issue

One evening, Group 1 tried to call two of our endpoints and got **502** errors — our server was unreachable. The tunnel was still running, but the API behind it had stopped. I had no idea until Group 1 told me.

My logs showed the API had been responding earlier that day, so it went down sometime in a six-hour window. Group 1 got successful responses the next afternoon — at least 19 hours between their failed call and their successful one. I brought the API back up, restarted the tunnel which had also gone offline by then, and confirmed everything worked by testing against their endpoints myself.

There was no code bug. The server simply stopped and nobody on our team noticed. Our logging and monitoring only work while the server is running, so the only alert system we had was a partner messaging us.

## 3. What I Would Design Differently

**Change:** one person owns each file, and everyone runs the test suite before pushing. Partway through the project, our tests broke because one file ended up with duplicate copies of the same functions. My commit had one copy. A teammate’s commit the next day added a second, slightly different copy on top. Neither of us ran the tests after the second change, and the breakage sat unnoticed for five days. A simple rule — run `npm test` before you push, one person per file — would have caught it in minutes.

**Keep:** the integration log. `INTEGRATION_LOG.md`, with dated entries, status codes, and resolution timestamps, made every cross-team conversation faster. I would start it on day one next time.

## 4. My Contribution

I would rate myself **7 out of 10**.

**What I owned:** Integration with Group 12, the security audit and authentication layer, the resilience system with retries and fallback, request logging and the stats dashboard, and the bulk of the web app — accounts, roles, the marketplace, and the seller, buyer and hub screens. I also wrote the entire integration log and security audit document, and the version 2 migration, deprecation handling, and demo script.

**What I shared:** The README was a joint effort — half my commits, half Markroy’s. The monitoring file started with my work but a teammate added to it the same week.

**Where others carried me:** Elvis laid the project’s foundation — the needs statements, endpoint list, API contract, and early documentation. Markroy handled deployment, containerisation, and wrote the first partner test file.

**Where I fell short:** The 502 incident was mine to prevent — at least 19 hours between Group 1’s failed call and their successful one, and the only reason it ended was them reaching out. I also left the partner test file unguarded, so our tests wrote real data into Group 12’s live system on every run until I added a safety flag.
