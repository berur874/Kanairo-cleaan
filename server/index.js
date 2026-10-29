const { app, ensureScrapLogsSchema } = require('./app');
const { loadApiKeys } = require('./security');

const port = process.env.PORT || 5000;

// Partner API keys come from API_KEYS in server/.env (see .env.example). Only the count and the
// consumer names are printed, never the keys themselves.
const keys = loadApiKeys();
if (!keys.length) {
  console.error('No API keys found. Set API_KEYS in server/.env before starting the API.');
  process.exit(1);
}
console.log(`Loaded ${keys.length} API key(s) for: ${keys.map((k) => k.consumer).join(', ')}`);
if (!process.env.HUB_INVITE_CODE) console.log('HUB_INVITE_CODE is not set: hub manager sign-up is switched off.');

ensureScrapLogsSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize scrap_logs schema:', err.message);
    process.exit(1);
  });
