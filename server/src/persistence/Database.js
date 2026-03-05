import BetterSqlite3 from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Database {
  constructor(dbPath) {
    const path = dbPath || join(__dirname, '../../../data/game.db');
    this.db = new BetterSqlite3(path);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        rating INTEGER DEFAULT 1000,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        unlocked_abilities TEXT DEFAULT '["dash"]',
        stats_json TEXT DEFAULT '{}',
        equipped_skin TEXT DEFAULT 'default',
        equipped_trail TEXT DEFAULT 'none',
        unlocked_cosmetics TEXT DEFAULT '["default"]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS match_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        won INTEGER NOT NULL DEFAULT 0,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        xp_earned INTEGER DEFAULT 0,
        rating_change INTEGER DEFAULT 0,
        waves_cleared INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        played_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (player_id) REFERENCES players(id)
      );

      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (friend_id) REFERENCES players(id),
        UNIQUE(player_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS player_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (player_id) REFERENCES players(id),
        UNIQUE(player_id, achievement_id)
      );

      CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC);
      CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
      CREATE INDEX IF NOT EXISTS idx_match_history_player ON match_history(player_id);
      CREATE INDEX IF NOT EXISTS idx_friends_player ON friends(player_id);
      CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
      CREATE INDEX IF NOT EXISTS idx_achievements_player ON player_achievements(player_id);
    `);

    // Migrate existing tables - add new columns if missing
    this._addColumnIfMissing('players', 'stats_json', "TEXT DEFAULT '{}'");
    this._addColumnIfMissing('players', 'equipped_skin', "TEXT DEFAULT 'default'");
    this._addColumnIfMissing('players', 'equipped_trail', "TEXT DEFAULT 'none'");
    this._addColumnIfMissing('players', 'unlocked_cosmetics', "TEXT DEFAULT '[\"default\"]'");
  }

  _addColumnIfMissing(table, column, definition) {
    try {
      const cols = this.db.pragma(`table_info(${table})`);
      if (!cols.find(c => c.name === column)) {
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    } catch (e) {
      // Column likely already exists
    }
  }

  close() {
    this.db.close();
  }
}
