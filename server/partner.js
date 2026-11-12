// Week 13: the ONE place that knows the paths and response shapes of Group 12's (AccessMap) API.
// Everything else in the server asks for a path or parses a list through here, so switching version is
// the one-word .env change PARTNER_VERSION=v1 | v2 (and so is the rollback).
//
// What Group 12's DEPRECATION_NOTICE.md says changes in v2:
//   - GET list venues:  /api/venues  ->  /v2/venues, and the bare array becomes { data: [...], count: N }
//   - GET one venue, GET rating, POST venue: only the prefix changes (/api/ -> /v2/); bodies are identical
//   - POST report: does NOT move. It stays at /api/reports in both versions.
// v1 keeps running at least through Demo Day (Friday 13 November 2026).

const versions = {
  v1: {
    paths: {
      venues: '/api/venues',
      venue: (slug) => `/api/venues/${slug}`,
      rating: (slug) => `/api/venues/${slug}/rating`,
      reports: '/api/reports',
    },
    parseVenueList(body) {
      if (!Array.isArray(body)) throw new Error('unexpected v1 shape (expected an array of venues)');
      return body;
    },
  },
  v2: {
    paths: {
      venues: '/v2/venues',
      venue: (slug) => `/v2/venues/${slug}`,
      rating: (slug) => `/v2/venues/${slug}/rating`,
      reports: '/api/reports', // unchanged in v2
    },
    // Checks the shape and says so if it is wrong, instead of failing vaguely somewhere else.
    parseVenueList(body) {
      if (!body || !Array.isArray(body.data)) throw new Error('unexpected v2 shape (expected { data: [...], count })');
      return body.data;
    },
  },
};

const DEFAULT_VERSION = 'v1';

/** Group 12's version from PARTNER_VERSION, read on every call. An unknown value is an error, never a silent fallback. */
function getPartnerVersion() {
  const name = process.env.PARTNER_VERSION || DEFAULT_VERSION;
  const version = versions[name];
  if (!version) throw new Error(`PARTNER_VERSION must be one of: ${Object.keys(versions).join(', ')} (got "${name}")`);
  return { name, ...version };
}

module.exports = { versions, getPartnerVersion };
