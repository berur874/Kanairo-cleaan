// v2: the new shape. Same data as v1 (see catalog.js), different response.
//
// The one change: a list is wrapped, [ ... ] becomes { "data": [ ... ], "count": N }.
// That leaves room to add paging later (next page, total) without another breaking change.
// Item fields, filters, error bodies and the API key are exactly as in v1.
const express = require('express');

// The ONE place that turns a list into the v2 response shape.
const toV2 = (rows) => ({ data: rows, count: rows.length });

function createV2({ catalog, requireApiToken, buildBadRequest, sendServerError }) {
  const router = express.Router();

  router.get('/materials', requireApiToken, async (req, res) => {
    try {
      const result = await catalog.listMaterials(req.query);
      if (result.error) return buildBadRequest(res, result.error);
      res.json(toV2(result.rows));
    } catch (err) {
      sendServerError(res, err);
    }
  });

  router.get('/collection-locations', requireApiToken, async (req, res) => {
    try {
      const result = await catalog.listLocations();
      res.json(toV2(result.rows));
    } catch (err) {
      sendServerError(res, err);
    }
  });

  return router;
}

module.exports = { createV2, toV2 };
