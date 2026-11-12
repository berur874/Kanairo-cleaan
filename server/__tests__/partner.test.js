// Week 13 Part E: the parsers in partner.js, with no network. The shapes are Group 12's published
// v1 and v2 (their DEPRECATION_NOTICE.md): a bare array, and { data, count }.
const { versions, getPartnerVersion } = require('../partner');

const venue = { id: 'v_001', slug: 'kenyatta-national-hospital', name: 'Kenyatta National Hospital', category: 'hospital' };
const v1Body = [venue];
const v2Body = { data: [venue], count: 1 };

test('v1 and v2 give the rest of the app exactly the same list', () => {
  expect(versions.v1.parseVenueList(v1Body)).toEqual([venue]);
  expect(versions.v2.parseVenueList(v2Body)).toEqual([venue]);
});

test('an empty v2 list is an empty list, not an error', () => {
  expect(versions.v2.parseVenueList({ data: [], count: 0 })).toEqual([]);
});

test('the wrong parser fails loudly, not quietly', () => {
  expect(() => versions.v1.parseVenueList(v2Body)).toThrow('unexpected v1 shape');
  expect(() => versions.v2.parseVenueList(v1Body)).toThrow('unexpected v2 shape');
  expect(() => versions.v2.parseVenueList(null)).toThrow('unexpected v2 shape');
  expect(() => versions.v2.parseVenueList({ count: 0 })).toThrow('unexpected v2 shape');
});

test('v2 moves the venue paths to /v2 but leaves reports at /api/reports', () => {
  expect(versions.v1.paths.venues).toBe('/api/venues');
  expect(versions.v2.paths.venues).toBe('/v2/venues');
  expect(versions.v2.paths.venue('the-junction-mall')).toBe('/v2/venues/the-junction-mall');
  expect(versions.v2.paths.rating('the-junction-mall')).toBe('/v2/venues/the-junction-mall/rating');
  expect(versions.v1.paths.venue('the-junction-mall')).toBe('/api/venues/the-junction-mall');
  expect(versions.v1.paths.reports).toBe('/api/reports');
  expect(versions.v2.paths.reports).toBe('/api/reports');
});

describe('getPartnerVersion', () => {
  const saved = process.env.PARTNER_VERSION;
  afterEach(() => {
    if (saved === undefined) delete process.env.PARTNER_VERSION;
    else process.env.PARTNER_VERSION = saved;
  });

  test('reads PARTNER_VERSION, defaulting to v1 when it is not set', () => {
    process.env.PARTNER_VERSION = 'v2';
    expect(getPartnerVersion().name).toBe('v2');
    delete process.env.PARTNER_VERSION;
    expect(getPartnerVersion().name).toBe('v1');
  });

  test('a mistyped version is an error, never a silent fallback', () => {
    process.env.PARTNER_VERSION = 'v3';
    expect(() => getPartnerVersion()).toThrow('PARTNER_VERSION must be one of: v1, v2');
  });
});
