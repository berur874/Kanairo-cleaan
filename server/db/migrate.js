require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run(sqlFile, { withDatabase } = { withDatabase: true }) {
  const sql = fs.readFileSync(path.join(__dirname, sqlFile), 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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

const target = process.argv[2];
if (target === 'schema') {
  run('schema.sql', { withDatabase: false }).catch((err) => { console.error(err); process.exit(1); });
} else if (target === 'seed') {
  run('seed.sql').catch((err) => { console.error(err); process.exit(1); });
} else {
  console.error('Usage: node db/migrate.js schema|seed');
  process.exit(1);
}
