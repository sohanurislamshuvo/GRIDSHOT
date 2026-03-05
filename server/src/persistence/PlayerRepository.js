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
          unlocked_abilities = ?, stats_json = ?,
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
      `),

      // Friends
      sendFriendRequest: this.db.prepare(`
        INSERT OR IGNORE INTO friends (player_id, friend_id, status) VALUES (?, ?, 'pending')
      `),
      acceptFriend: this.db.prepare(`
        UPDATE friends SET status = 'accepted' WHERE player_id = ? AND friend_id = ? AND status = 'pending'
      `),
      removeFriend: this.db.prepare(`
        DELETE FROM friends WHERE
          (player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?)
      `),
      getFriends: this.db.prepare(`
        SELECT f.*, p.username, p.level, p.rating
        FROM friends f
        JOIN players p ON (
          CASE WHEN f.player_id = ? THEN f.friend_id ELSE f.player_id END
        ) = p.id
        WHERE (f.player_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
      `),
      getPendingRequests: this.db.prepare(`
        SELECT f.*, p.username, p.level
        FROM friends f
        JOIN players p ON f.player_id = p.id
        WHERE f.friend_id = ? AND f.status = 'pending'
      `),

      // Achievements
      getAchievements: this.db.prepare(`
        SELECT achievement_id, unlocked_at FROM player_achievements WHERE player_id = ?
      `),
      unlockAchievement: this.db.prepare(`
        INSERT OR IGNORE INTO player_achievements (player_id, achievement_id) VALUES (?, ?)
      `),

      // Cosmetics
      updateCosmetics: this.db.prepare(`
        UPDATE players SET equipped_skin = ?, equipped_trail = ?, unlocked_cosmetics = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `),
      getCosmetics: this.db.prepare(`
        SELECT equipped_skin, equipped_trail, unlocked_cosmetics FROM players WHERE id = ?
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
      JSON.stringify(stats.detailedStats || {}),
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

  // Friends
  sendFriendRequest(playerId, friendId) {
    return this.stmts.sendFriendRequest.run(playerId, friendId);
  }

  acceptFriend(requesterId, accepterId) {
    return this.stmts.acceptFriend.run(requesterId, accepterId);
  }

  removeFriend(playerId, friendId) {
    return this.stmts.removeFriend.run(playerId, friendId, friendId, playerId);
  }

  getFriends(playerId) {
    return this.stmts.getFriends.all(playerId, playerId, playerId);
  }

  getPendingRequests(playerId) {
    return this.stmts.getPendingRequests.all(playerId);
  }

  // Achievements
  getAchievements(playerId) {
    return this.stmts.getAchievements.all(playerId);
  }

  unlockAchievement(playerId, achievementId) {
    return this.stmts.unlockAchievement.run(playerId, achievementId);
  }

  // Cosmetics
  getCosmetics(playerId) {
    const row = this.stmts.getCosmetics.get(playerId);
    if (!row) return null;
    return {
      equippedSkin: row.equipped_skin || 'default',
      equippedTrail: row.equipped_trail || 'none',
      unlockedCosmetics: JSON.parse(row.unlocked_cosmetics || '["default"]')
    };
  }

  updateCosmetics(playerId, skin, trail, unlocked) {
    this.stmts.updateCosmetics.run(skin, trail, JSON.stringify(unlocked), playerId);
  }
}
