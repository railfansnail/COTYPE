const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config.json');

const dbDir = path.dirname(path.resolve(config.db.path));
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.resolve(config.db.path));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS rankings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname   TEXT    NOT NULL,
    wpm        INTEGER NOT NULL,
    accuracy   INTEGER NOT NULL,
    lang       TEXT    NOT NULL,
    mode       TEXT    NOT NULL CHECK(mode IN ('code','kw')),
    snippet    TEXT,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_rank ON rankings(lang, mode, wpm DESC);
`);

const stmts = {
  insert: db.prepare(
    `INSERT INTO rankings (nickname, wpm, accuracy, lang, mode, snippet)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  getById: db.prepare(`SELECT * FROM rankings WHERE id = ?`),
  countAbove: db.prepare(
    `SELECT COUNT(*)+1 AS rank FROM rankings
     WHERE lang = ? AND mode = ? AND wpm > ?`
  ),
  listAll: db.prepare(
    `SELECT id, nickname, wpm, accuracy, lang, mode, snippet, created_at
     FROM rankings
     ORDER BY wpm DESC
     LIMIT ?`
  ),
  listFiltered: db.prepare(
    `SELECT id, nickname, wpm, accuracy, lang, mode, snippet, created_at
     FROM rankings
     WHERE lang = ? AND mode = ?
     ORDER BY wpm DESC
     LIMIT ?`
  ),
  listByLang: db.prepare(
    `SELECT id, nickname, wpm, accuracy, lang, mode, snippet, created_at
     FROM rankings
     WHERE lang = ?
     ORDER BY wpm DESC
     LIMIT ?`
  ),
};

function getRankings({ lang, mode, limit = 50 }) {
  const n = Math.min(parseInt(limit) || 50, config.ranking.topN);
  if (lang && mode) return stmts.listFiltered.all(lang, mode, n);
  if (lang)         return stmts.listByLang.all(lang, n);
  return stmts.listAll.all(n);
}

function insertRanking({ nickname, wpm, accuracy, lang, mode, snippet }) {
  const result = stmts.insert.run(nickname, wpm, accuracy, lang, mode, snippet || null);
  return result.lastInsertRowid;
}

function getRankPosition(id) {
  const entry = stmts.getById.get(id);
  if (!entry) return null;
  const row = stmts.countAbove.get(entry.lang, entry.mode, entry.wpm);
  return row ? row.rank : null;
}

module.exports = { getRankings, insertRanking, getRankPosition };
