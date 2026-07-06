import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://embodied:embodied@localhost:5432/embodied',
      max: 10,
    });
  }
  return pool;
}

export async function query(text, params) {
  const res = await getPool().query(text, params);
  return res.rows;
}

export async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}
