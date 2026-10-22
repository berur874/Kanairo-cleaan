// Summarises logs/requests.jsonl as Markdown for INTEGRATION_LOG.md (Week 10 Part E).
// Usage: npm run log:report            -> only requests that came in through ngrok (i.e. Group 1)
//        npm run log:report -- --all   -> include our own local requests too
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', 'logs', 'requests.jsonl');
const includeLocal = process.argv.includes('--all');

if (!fs.existsSync(LOG)) {
  console.log('No requests logged yet. Start the server and make some calls first.');
  process.exit(0);
}

const entries = fs.readFileSync(LOG, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((e) => includeLocal || e.via === 'ngrok');

if (!entries.length) {
  console.log(includeLocal ? 'No requests logged yet.' : 'No requests through ngrok yet. Use --all to include local ones.');
  process.exit(0);
}

const eat = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', dateStyle: 'short', timeStyle: 'medium' });

console.log(`## Requests received (${entries.length}), ${eat(entries[0].time)} to ${eat(entries.at(-1).time)} EAT\n`);

// Calls per endpoint and status, with the query string dropped so /materials?type=x groups with /materials.
const counts = {};
for (const e of entries) {
  const key = `${e.method} ${e.path.split('?')[0]}|${e.status}`;
  counts[key] = (counts[key] || 0) + 1;
}
console.log('| Endpoint | Status | Calls |\n|---|---|---|');
for (const [key, n] of Object.entries(counts).sort()) {
  const [endpoint, status] = key.split('|');
  console.log(`| \`${endpoint}\` | ${status} | ${n} |`);
}

const failures = entries.filter((e) => e.status >= 400);
console.log(`\n## Failed requests (${failures.length})\n`);
if (!failures.length) {
  console.log('None.');
} else {
  console.log('| Time (EAT) | Request | Status | Auth sent | Our response | What they sent |\n|---|---|---|---|---|---|');
  for (const e of failures) {
    const message = e.error?.message || e.error?.error || JSON.stringify(e.error ?? '');
    const sent = e.requestBody ? `\`${JSON.stringify(e.requestBody).slice(0, 120)}\`` : '';
    console.log(`| ${eat(e.time)} | \`${e.method} ${e.path}\` | ${e.status} | ${e.auth} | ${message} | ${sent} |`);
  }
}
