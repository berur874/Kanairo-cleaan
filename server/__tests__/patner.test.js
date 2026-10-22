const request = require('supertest');

// Set this to your partner's running server URL (local or Render live URL)
const BASE_URL = process.env.PARTNER_URL || 'https://accessmap-nairobi-api-1.onrender.com';

// The POST tests create real venues and reports in Group 12's live data (see INTEGRATION_LOG.md row 6).
// They only run when PARTNER_WRITE_TESTS=1, e.g. against a local copy of their server.
const describeWrites = process.env.PARTNER_WRITE_TESTS === '1' ? describe : describe.skip;

describe('Partner API Contract Tests - AccessMap Nairobi', () => {

  // ---------------------------------------------------------------------------
  // 1. GET /api/venues
  // ---------------------------------------------------------------------------
  describe('GET /api/venues', () => {
    it('returns 200 and an array of venues matching the Venue schema (Happy Path)', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues')
        .query({ category: 'hospital', area: 'Upper Hill' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      if (res.body.length > 0) {
        const venue = res.body[0];
        // Strong assertions checking contract schema shapes & types
        expect(venue).toHaveProperty('id');
        expect(typeof venue.id).toBe('string');
        expect(venue).toHaveProperty('slug');
        expect(venue).toHaveProperty('name');
        expect(venue).toHaveProperty('area');
        expect(venue).toHaveProperty('category');
        expect(venue).toHaveProperty('accessibility');

        // Check Accessibility object contract
        expect(typeof venue.accessibility.ramp).toBe('boolean');
        expect(typeof venue.accessibility.lift).toBe('boolean');
        expect(typeof venue.accessibility.accessibleToilet).toBe('boolean');
        expect(typeof venue.accessibility.accessibleParking).toBe('boolean');
        expect(typeof venue.accessibility.tactilePaving).toBe('boolean');
        expect(typeof venue.accessibility.wideCorridors).toBe('boolean');
        expect(typeof venue.accessibility.audioAssistance).toBe('boolean');
        expect(typeof venue.accessibility.staffAssistance).toBe('boolean');
      }
    });

    it('handles boolean query filter parameter correctly', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues')
        .query({ accessible: true });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 400 when an invalid query parameter value is supplied', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues')
        .query({ accessible: 'not-a-boolean' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. POST /api/venues
  // ---------------------------------------------------------------------------
  describeWrites('POST /api/venues', () => {
    const validVenue = {
      name: `Test Venue ${Date.now()}`,
      area: 'Westlands',
      address: 'Ring Road Westlands, Nairobi',
      category: 'market',
      accessibility: {
        ramp: true,
        lift: false,
        accessibleToilet: true,
        accessibleParking: true,
        tactilePaving: false,
        wideCorridors: true,
        audioAssistance: false,
        staffAssistance: true
      },
      coordinates: {
        lat: -1.2676,
        lng: 36.8062
      }
    };

    it('returns 201 and creates a venue given valid data (Happy Path)', async () => {
      const res = await request(BASE_URL)
        .post('/api/venues')
        .send(validVenue);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('slug');
      expect(res.body.name).toBe(validVenue.name);
      expect(res.body.area).toBe(validVenue.area);
      expect(res.body).toHaveProperty('addedAt');
    });

    it('returns 400 when missing required fields (e.g., name missing)', async () => {
      const invalidPayload = { ...validVenue };
      delete invalidPayload.name;

      const res = await request(BASE_URL)
        .post('/api/venues')
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 409 Conflict when creating a venue with a duplicate name in the same area', async () => {
      const duplicatePayload = {
        name: 'Kenyatta National Hospital',
        area: 'Upper Hill',
        address: 'Hospital Rd, Nairobi',
        category: 'hospital',
        accessibility: {
          ramp: true,
          lift: true,
          accessibleToilet: true,
          accessibleParking: true,
          tactilePaving: false,
          wideCorridors: true,
          audioAssistance: false,
          staffAssistance: true
        },
        coordinates: { lat: -1.3004, lng: 36.8073 }
      };

      const res = await request(BASE_URL)
        .post('/api/venues')
        .send(duplicatePayload);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('existing');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/venues/:slug
  // ---------------------------------------------------------------------------
  describe('GET /api/venues/:slug', () => {
    it('returns 200 and full venue details for an existing slug (Happy Path)', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues/kenyatta-national-hospital');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('slug', 'kenyatta-national-hospital');
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('address');
      expect(res.body).toHaveProperty('coordinates');
    });

    it('returns 404 for a non-existent venue slug', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues/non-existent-venue-slug-99999');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. GET /api/venues/:slug/rating
  // ---------------------------------------------------------------------------
  describe('GET /api/venues/:slug/rating', () => {
    it('returns 200 and rating properties for an existing venue', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues/kenyatta-national-hospital/rating');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('slug', 'kenyatta-national-hospital');
      expect(res.body).toHaveProperty('averageRating');
      expect(typeof res.body.averageRating).toBe('number');
      expect(res.body).toHaveProperty('totalReports');
      expect(typeof res.body.totalReports).toBe('number');
    });

    it('returns 404 when querying rating for a non-existent slug', async () => {
      const res = await request(BASE_URL)
        .get('/api/venues/non-existent-venue-slug-99999/rating');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. POST /api/reports
  // ---------------------------------------------------------------------------
  describeWrites('POST /api/reports', () => {
    it('returns 201 and creates a new report given valid data (Happy Path)', async () => {
      const validReport = {
        venueId: 'v_001',
        rating: 5,
        description: 'Excellent wheelchair access throughout.',
        visitedAt: '2026-06-15',
        accessibility: {
          ramp: true,
          lift: true,
          accessibleToilet: true,
          accessibleParking: true,
          tactilePaving: false,
          wideCorridors: true,
          audioAssistance: false,
          staffAssistance: true
        }
      };

      const res = await request(BASE_URL)
        .post('/api/reports')
        .send(validReport);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('submittedAt');
      expect(res.body.venueId).toBe(validReport.venueId);
      expect(res.body.rating).toBe(validReport.rating);
    });

    it('returns 400 when rating is out of bounds (e.g. > 5 or < 1)', async () => {
      const invalidReport = {
        venueId: 'v_001',
        rating: 10, // Invalid: rating must be between 1 and 5
        visitedAt: '2026-06-15',
        accessibility: {
          ramp: true, lift: true, accessibleToilet: true, accessibleParking: true,
          tactilePaving: false, wideCorridors: true, audioAssistance: false, staffAssistance: true
        }
      };

      const res = await request(BASE_URL)
        .post('/api/reports')
        .send(invalidReport);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 404 when reporting for a non-existent venueId', async () => {
      const reportForMissingVenue = {
        venueId: 'v_999999999',
        rating: 4,
        visitedAt: '2026-06-15',
        accessibility: {
          ramp: true, lift: true, accessibleToilet: true, accessibleParking: true,
          tactilePaving: false, wideCorridors: true, audioAssistance: false, staffAssistance: true
        }
      };

      const res = await request(BASE_URL)
        .post('/api/reports')
        .send(reportForMissingVenue);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});