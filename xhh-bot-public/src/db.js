const path = require('path');
const cfg = require('../xhh-config.json');

const dbType = (cfg.database && cfg.database.type) || 'sqlite';

let db = null;

// ===== SQLite 实现 =====
async function initSQLite() {
  const initSqlJs = require('sql.js');
  const fs = require('fs');
  const dbPath = path.join(__dirname, '..', cfg.database.path || 'xhh_data.db');
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT DEFAULT '',
    user_level INTEGER DEFAULT 0,
    post_id TEXT DEFAULT '',
    comment_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_at)`);
  saveSQLite();
  console.log('[DB] SQLite 就绪');
}

function saveSQLite() {
  const fs = require('fs');
  fs.writeFileSync(
    path.join(__dirname, '..', cfg.database.path || 'xhh_data.db'),
    Buffer.from(db.export())
  );
}

// ===== PostgreSQL 实现 =====
let pgPool = null;

async function initPG() {
  const { Pool } = require('pg');
  pgPool = new Pool({
    host: cfg.database.host || 'localhost',
    port: cfg.database.port || 5432,
    database: cfg.database.db || 'postgres',
    user: cfg.database.user || '',
    password: cfg.database.password || '',
  });
  await pgPool.query(`CREATE TABLE IF NOT EXISTS mentions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT DEFAULT '',
    user_level INTEGER DEFAULT 0,
    post_id TEXT DEFAULT '',
    comment_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_mentions_comment ON mentions(comment_id)`);
  await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_mentions_created ON mentions(created_at)`);
  console.log('[DB] PostgreSQL 就绪');
}

// ===== 通用接口 =====
async function init() {
  if (db || pgPool) return;
  if (dbType === 'postgresql' || dbType === 'pg') {
    await initPG();
  } else {
    await initSQLite();
  }
}

async function isReplied(commentId) {
  if (pgPool) {
    const { rows } = await pgPool.query(
      'SELECT id FROM mentions WHERE comment_id = $1 LIMIT 1',
      [String(commentId)]
    );
    return rows.length > 0;
  }
  const stmt = db.prepare('SELECT id FROM mentions WHERE comment_id = ?');
  stmt.bind([String(commentId)]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

async function logMention({ user_id, username, user_level, post_id, comment_id }) {
  if (pgPool) {
    await pgPool.query(
      `INSERT INTO mentions (user_id, username, user_level, post_id, comment_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [String(user_id), username || '', user_level || 0, String(post_id || ''), String(comment_id)]
    );
    return;
  }
  db.run(
    'INSERT INTO mentions (user_id, username, user_level, post_id, comment_id) VALUES (?, ?, ?, ?, ?)',
    [String(user_id), username || '', user_level || 0, String(post_id || ''), String(comment_id)]
  );
  saveSQLite();
}

async function getDailyStats(days = 7) {
  if (pgPool) {
    const { rows } = await pgPool.query(`
      SELECT DATE(created_at) as date,
             COUNT(*)::int as total,
             COUNT(DISTINCT user_id)::int as unique_users
      FROM mentions
      WHERE created_at >= CURRENT_DATE - $1::interval
      GROUP BY DATE(created_at) ORDER BY date DESC
    `, [`${days} days`]);
    return rows;
  }
  const stmt = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
    FROM mentions
    WHERE created_at >= datetime('now', '-' || ? || ' days', 'localtime')
    GROUP BY date(created_at) ORDER BY date DESC
  `);
  stmt.bind([days]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function getHourlyStats(today = true) {
  if (pgPool) {
    const { rows } = await pgPool.query(`
      SELECT TO_CHAR(created_at, 'HH24') as hour,
             COUNT(*)::int as total, COUNT(DISTINCT user_id)::int as unique_users
      FROM mentions
      WHERE ${today ? "created_at::date = CURRENT_DATE" : "created_at >= CURRENT_DATE - INTERVAL '1 day'"}
      GROUP BY hour ORDER BY hour
    `);
    return rows;
  }
  const dateFilter = today
    ? "date(created_at) = date('now', 'localtime')"
    : "created_at >= datetime('now', '-1 day', 'localtime')";
  const stmt = db.prepare(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
    FROM mentions WHERE ${dateFilter} GROUP BY hour ORDER BY hour
  `);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function getAllUsers() {
  if (pgPool) {
    const { rows } = await pgPool.query(`
      SELECT user_id, username, MAX(user_level)::int as level,
             COUNT(*)::int as mentions, MAX(created_at) as last_seen
      FROM mentions GROUP BY user_id, username ORDER BY last_seen DESC
    `);
    return rows;
  }
  const stmt = db.prepare(`
    SELECT user_id, username, MAX(user_level) as level, COUNT(*) as mentions, MAX(created_at) as last_seen
    FROM mentions GROUP BY user_id ORDER BY last_seen DESC
  `);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

module.exports = { init, isReplied, logMention, getDailyStats, getHourlyStats, getAllUsers };
