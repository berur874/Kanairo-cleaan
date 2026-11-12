// v1: FROZEN. Do not change the shape of anything in this file.
//
// GET /materials and GET /collection-locations answer a bare JSON list, as they have since Week 5.
// Mounted twice in app.js: at /v1 and at / (so Group 1's existing, unversioned URLs keep working).
// Every response carries Deprecation, Sunset and Link headers pointing at v2.
const express = require('express');
const { deprecated } = require('./deprecate');

// The day v1 stops working. Chosen in DEPRECATION_NOTICE.md; the tests pin it.
const V1_SUNSET = '2026-11-12';

function createV1({ catalog, requireApiToken, buildBadRequest, sendServerError }) {
  const router = express.Router();

  router.get('/materials', requireApiToken, deprecated({ sunset: V1_SUNSET, successor: '/v2/materials' }), async (req, res) => {
    try {
      const result = await catalog.listMaterials(req.query);
      if (result.error) return buildBadRequest(res, result.error);
      res.json(result.rows);
    } catch (err) {
      sendServerError(res, err);
    }
  });

  router.get('/collection-locations', requireApiToken, deprecated({ sunset: V1_SUNSET, successor: '/v2/collection-locations' }), async (req, res) => {
    try {
      const result = await catalog.listLocations();
      res.json(result.rows);
    } catch (err) {
      sendServerError(res, err);
    }
  });

  return router;
}

module.exports = { createV1, V1_SUNSET };
