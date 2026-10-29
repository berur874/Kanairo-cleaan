// Fixed keys for tests; dotenv does not override variables that are already set, so the real keys in
// .env are never used by the test suite.
process.env.API_TOKEN = 'test-token';
process.env.API_KEYS = 'tests:test-token,other-consumer:other-test-token';
process.env.HUB_INVITE_CODE = 'test-invite';

// The suite sends far more than 100 requests a minute; the limits themselves are tested in
// security.test.js, which sets its own small values before loading the app.
process.env.IP_RATE_LIMIT ??= '100000';
process.env.PARTNER_RATE_LIMIT ??= '100000';
process.env.AUTH_RATE_LIMIT ??= '100000';
