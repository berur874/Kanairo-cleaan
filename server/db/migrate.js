require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

//async function run(sqlFile, { withDatabase } = { withDatabase: true }) {
  //const sql = fs.readFileSync(path.join(__dirname, sqlFile), 'utf8');
async function run(sqlFile, { withDatabase } = { withDatabase: true }) {
  let sql = fs.readFileSync(path.join(__dirname, sqlFile), 'utf8');
  // Hosted DB: it already exists under DB_NAME, so drop the hardcoded CREATE DATABASE / USE lines.
  if (process.env.DB_EXISTS === 'true') {
    sql = sql
      .replace(/^\s*CREATE DATABASE[^;]*;\s*$/gim, '')
      .replace(/^\s*USE\s+[^;]*;\s*$/gim, '');
    withDatabase = true;
  }  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    database: withDatabase ? process.env.DB_NAME : undefined,
    multipleStatements: true,
  });
  try {
    await connection.query(sql);
    console.log(`Ran ${sqlFile}`);
  } finally {
    await connection.end();
  }
}

async function ensureScrapLogsColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const columnSpecs = {
      log_id: 'varchar(30) DEFAULT NULL',
      job_id: 'varchar(50) DEFAULT NULL',
      artisan_id: 'varchar(50) DEFAULT NULL',
      material_type: 'varchar(50) DEFAULT NULL',
      notes: 'text',
    };

    for (const [columnName, sqlType] of Object.entries(columnSpecs)) {
      const [rows] = await connection.query(
        `SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scrap_logs' AND COLUMN_NAME = ?`,
        [process.env.DB_NAME, columnName]
      );

      if (rows.length === 0) {
        await connection.query(`ALTER TABLE scrap_logs ADD COLUMN ${columnName} ${sqlType}`);
        console.log(`Added scrap_logs.${columnName}`);
      }
    }

    const [idxRows] = await connection.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scrap_logs' AND INDEX_NAME = 'uniq_scrap_log_id'`,
      [process.env.DB_NAME]
    );

    if (idxRows.length === 0) {
      await connection.query('CREATE UNIQUE INDEX uniq_scrap_log_id ON scrap_logs (log_id)');
      console.log('Added index uniq_scrap_log_id');
    }
  } finally {
    await connection.end();
  }
}

// Databases created before hotspots.county existed get the column, and the seeded Ruiru row is moved to Kiambu.
async function ensureHotspotCounty() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await connection.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'hotspots' AND COLUMN_NAME = 'county'`,
      [process.env.DB_NAME]
    );

    if (rows.length === 0) {
      await connection.query(`ALTER TABLE hotspots ADD COLUMN county varchar(50) NOT NULL DEFAULT 'Nairobi' AFTER area`);
      await connection.query(`UPDATE hotspots SET county = 'Kiambu' WHERE area = 'Ruiru'`);
      console.log('Added hotspots.county');
    }
  } finally {
    await connection.end();
  }
}

// Webapp columns on tables that already existed before the webapp (CREATE TABLE IF NOT EXISTS
// skips them), plus coordinates for the original hubs so recommendations can measure distance.
const WEBAPP_COLUMNS = {
  hotspots: { lat: 'decimal(9,6) DEFAULT NULL', lng: 'decimal(9,6) DEFAULT NULL' },
  drop_offs: {
    seller_id: 'int DEFAULT NULL',
    material_id: 'varchar(20) DEFAULT NULL',
    received_kg: 'decimal(10,2) DEFAULT NULL',
    payout_kes: 'decimal(10,2) DEFAULT NULL',
    received_at: 'datetime DEFAULT NULL',
  },
  transactions: {
    buyer_id: 'int DEFAULT NULL',
    hotspot_id: 'int DEFAULT NULL',
    material_id: 'varchar(20) DEFAULT NULL',
    status: "enum('paid','collected') NOT NULL DEFAULT 'paid'",
    collected_at: 'datetime DEFAULT NULL',
  },
};

const HUB_COORDINATES = {
  Dandora: [-1.2496, 36.899],
  Gikomba: [-1.286, 36.837],
  'Industrial Area': [-1.307, 36.851],
  Kibera: [-1.3133, 36.7869],
  Westlands: [-1.2676, 36.8108],
  Eastleigh: [-1.2741, 36.85],
  Karen: [-1.3197, 36.7073],
  Ruiru: [-1.1466, 36.9609],
};

async function ensureWebappColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    database: process.env.DB_NAME,
  });

  try {
    for (const [table, columns] of Object.entries(WEBAPP_COLUMNS)) {
      for (const [columnName, sqlType] of Object.entries(columns)) {
        const [rows] = await connection.query(
          `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [process.env.DB_NAME, table, columnName]
        );
        if (rows.length === 0) {
          await connection.query(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${sqlType}`);
          console.log(`Added ${table}.${columnName}`);
        }
      }
    }

    for (const [name, [lat, lng]] of Object.entries(HUB_COORDINATES)) {
      await connection.query('UPDATE hotspots SET lat = ?, lng = ? WHERE name = ? AND lat IS NULL', [lat, lng, name]);
    }
  } finally {
    await connection.end();
  }
}

const target = process.argv[2];
if (target === 'schema') {
  run('schema.sql', { withDatabase: false })
    .then(() => ensureScrapLogsColumns())
    .then(() => ensureHotspotCounty())
    .then(() => ensureWebappColumns())
    .catch((err) => { console.error(err); process.exit(1); });
} else if (target === 'seed') {
  run('seed.sql').catch((err) => { console.error(err); process.exit(1); });
} else {
  console.error('Usage: node db/migrate.js schema|seed');
  process.exit(1);
}
