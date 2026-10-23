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

const target = process.argv[2];
if (target === 'schema') {
  run('schema.sql', { withDatabase: false })
    .then(() => ensureScrapLogsColumns())
    .then(() => ensureHotspotCounty())
    .catch((err) => { console.error(err); process.exit(1); });
} else if (target === 'seed') {
  run('seed.sql').catch((err) => { console.error(err); process.exit(1); });
} else {
  console.error('Usage: node db/migrate.js schema|seed');
  process.exit(1);
}
