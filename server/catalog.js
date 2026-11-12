// Week 13: the data behind GET /materials and GET /collection-locations, shared by v1 and v2.
// Both versions read the same rows. Only the response SHAPE differs (see v1.js and v2.js), so a
// fix to a filter or a field lands in both versions at once.
//
// Each function returns { rows } or, for a bad filter, { error: 'message for the 400' }.
// A database failure is thrown, for the route to turn into a 500.
function createCatalog({ pool, materialTypes }) {
  async function listMaterials(query) {
    const { type, min_quantity_kg } = query;

    if (type !== undefined && !materialTypes.includes(type)) {
      return { error: `type must be one of: ${materialTypes.join(', ')}` };
    }

    const minQuantity = Number(min_quantity_kg);
    if (min_quantity_kg !== undefined && (typeof min_quantity_kg !== 'string' || min_quantity_kg.trim() === '' || !Number.isFinite(minQuantity) || minQuantity < 0)) {
      return { error: 'min_quantity_kg must be a number greater than or equal to 0' };
    }

    let sql = 'SELECT id, name, type, price, stock_kg FROM materials WHERE 1=1';
    const params = [];
    if (type !== undefined) { sql += ' AND type = ?'; params.push(type); }
    if (min_quantity_kg !== undefined) { sql += ' AND stock_kg >= ?'; params.push(minQuantity); }

    const [rows] = await pool.query(sql, params);
    return {
      rows: rows.map((row) => ({
        material_id: row.id,
        name: row.name,
        type: row.type,
        quantity_kg: Number(row.stock_kg),
        unit_price_kes: Number(row.price),
      })),
    };
  }

  async function listLocations() {
    const [rows] = await pool.query('SELECT id, name, area, county, active FROM hotspots WHERE active = 1');
    return {
      rows: rows.map((row) => ({
        location_id: String(row.id),
        name: row.name,
        area: row.area,
        county: row.county,
        is_active: Boolean(row.active),
      })),
    };
  }

  return { listMaterials, listLocations };
}

module.exports = { createCatalog };
