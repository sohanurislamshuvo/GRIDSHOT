export class ProgressionSystem {
  static getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  static getLevelFromXP(totalXP) {
    let level = 1;
    let remaining = totalXP;

    while (level < 50) {
      const needed = ProgressionSystem.getXPForLevel(level + 1);
      if (remaining >= needed) {
        remaining -= needed;
        level++;
      } else {
        break;
      }
    }

    return {
      level,
      currentXP: remaining,
      xpForNextLevel: ProgressionSystem.getXPForLevel(level + 1)
    };
  }

  static calculateMatchXP(stats) {
    let xp = 0;

    // Kill rewards
    xp += (stats.botKills || 0) * 10;
    xp += (stats.playerKills || 0) * 25;
    xp += (stats.bossKills || 0) * 100;

    // Match outcome
    if (stats.won) xp += 100;
    else xp += 20;

    // Wave bonus (solo mode)
    if (stats.wavesCleared) {
      xp += stats.wavesCleared * 50;
    }

    return Math.floor(xp);
  }

  // Elo rating
  static calculateRatingChange(playerRating, opponentRating, won) {
    const K = 32;
    const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actual = won ? 1 : 0;
    return Math.round(K * (actual - expected));
  }

  static getRankTier(rating) {
    if (rating >= 2000) return { name: 'Platinum', color: '#E5E4E2' };
    if (rating >= 1500) return { name: 'Gold', color: '#FFD700' };
    if (rating >= 1000) return { name: 'Silver', color: '#C0C0C0' };
    return { name: 'Bronze', color: '#CD7F32' };
  }

  static getUnlockedAbilities(level) {
    const abilities = [];
    if (level >= 1) abilities.push('dash');
    if (level >= 3) abilities.push('heal');
    if (level >= 5) abilities.push('shield');
    if (level >= 7) abilities.push('radar');
    return abilities;
  }
}
