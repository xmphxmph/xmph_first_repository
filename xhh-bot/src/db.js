const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'myrobot_user',
  password: 'robot',
});

let initialized = false;

async function init() {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mentions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT DEFAULT '',
      user_level INTEGER DEFAULT 0,
      post_id TEXT DEFAULT '',
      comment_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_at)
  `);
  initialized = true;
  console.log('[DB] PostgreSQL 就绪');
}

async function isReplied(commentId) {
  const { rows } = await pool.query(
    'SELECT id FROM mentions WHERE comment_id = $1 LIMIT 1',
    [String(commentId)]
  );
  return rows.length > 0;
}

async function logMention({ user_id, username, user_level, post_id, comment_id }) {
  await pool.query(
    `INSERT INTO mentions (user_id, username, user_level, post_id, comment_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [String(user_id), username || '', user_level || 0, String(post_id || ''), String(comment_id)]
  );
}

async function getDailyStats(days = 7) {
  const { rows } = await pool.query(`
    SELECT DATE(created_at) as date,
           COUNT(*)::int as total,
           COUNT(DISTINCT user_id)::int as unique_users
    FROM mentions
    WHERE created_at >= CURRENT_DATE - $1::interval
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `, [days === 7 ? '7 days' : `${days} days`]);
  return rows;
}

async function getHourlyStats(today = true) {
  const { rows } = await pool.query(`
    SELECT TO_CHAR(created_at, 'HH24') as hour,
           COUNT(*)::int as total,
           COUNT(DISTINCT user_id)::int as unique_users
    FROM mentions
    WHERE ${today ? "created_at::date = CURRENT_DATE" : "created_at >= CURRENT_DATE - INTERVAL '1 day'"}
    GROUP BY TO_CHAR(created_at, 'HH24')
    ORDER BY hour
  `);
  return rows;
}

async function getAllUsers() {
  const { rows } = await pool.query(`
    SELECT user_id, username, MAX(user_level)::int as level,
           COUNT(*)::int as mentions, MAX(created_at) as last_seen
    FROM mentions
    GROUP BY user_id, username
    ORDER BY last_seen DESC
  `);
  return rows;
}

module.exports = { init, isReplied, logMention, getDailyStats, getHourlyStats, getAllUsers };
