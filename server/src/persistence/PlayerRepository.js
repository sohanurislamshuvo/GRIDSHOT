import { randomUUID } from 'crypto';

export class PlayerRepository {
  constructor(db) {
    this.db = db.db; // The better-sqlite3 instance
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      findByUsername: this.db.prepare('SELECT * FROM players WHERE username = ?'),
      findById: this.db.prepare('SELECT * FROM players WHERE id = ?'),
      create: this.db.prepare(`
        INSERT INTO players (id, username, password_hash) VALUES (?, ?, ?)
      `),
      updateStats: this.db.prepare(`
        UPDATE players SET
          xp = ?, level = ?, rating = ?,
          wins = ?, losses = ?, kills = ?, deaths = ?,
          unlocked_abilities = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `),
      getLeaderboard: this.db.prepare(`
        SELECT id, username, level, rating, wins, losses, kills, deaths
        FROM players ORDER BY rating DESC LIMIT ?
      `),
      insertMatch: this.db.prepare(`
        INSERT INTO match_history
          (player_id, mode, won, kills, deaths, xp_earned, rating_change, waves_cleared, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getMatchHistory: this.db.prepare(`
        SELECT * FROM match_history WHERE player_id = ?
        ORDER BY played_at DESC LIMIT ?
      `)
    };
  }

  findByUsername(username) {
    return this.stmts.findByUsername.get(username) || null;
  }

  findById(id) {
    return this.stmts.findById.get(id) || null;
  }

  create(username, passwordHash) {
    const id = randomUUID();
    this.stmts.create.run(id, username, passwordHash);
    return this.findById(id);
  }

  updateStats(id, stats) {
    this.stmts.updateStats.run(
      stats.xp,
      stats.level,
      stats.rating,
      stats.wins,
      stats.losses,
      stats.kills,
      stats.deaths,
      JSON.stringify(stats.unlockedAbilities || ['dash']),
      id
    );
  }

  getLeaderboard(limit = 100) {
    return this.stmts.getLeaderboard.all(limit);
  }

  saveMatchResult(playerId, matchData) {
    this.stmts.insertMatch.run(
      playerId,
      matchData.mode,
      matchData.won ? 1 : 0,
      matchData.kills || 0,
      matchData.deaths || 0,
      matchData.xpEarned || 0,
      matchData.ratingChange || 0,
      matchData.wavesCleared || 0,
      matchData.duration || 0
    );
  }

  getMatchHistory(playerId, limit = 20) {
    return this.stmts.getMatchHistory.all(playerId, limit);
  }
}
