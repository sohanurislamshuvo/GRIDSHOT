export const AchievementConfig = {
  first_blood: {
    name: 'First Blood',
    description: 'Get your first kill',
    icon: '\u2694',
    condition: { stat: 'totalKills', threshold: 1 },
    xpReward: 50
  },
  sharpshooter: {
    name: 'Sharpshooter',
    description: 'Get 100 kills',
    icon: '\uD83C\uDFAF',
    condition: { stat: 'totalKills', threshold: 100 },
    xpReward: 500
  },
  veteran: {
    name: 'Veteran',
    description: 'Get 500 kills',
    icon: '\uD83C\uDF1F',
    condition: { stat: 'totalKills', threshold: 500 },
    xpReward: 2000
  },
  survivor: {
    name: 'Survivor',
    description: 'Survive 10 solo waves',
    icon: '\uD83D\uDEE1',
    condition: { stat: 'totalWavesSurvived', threshold: 10 },
    xpReward: 200
  },
  wave_master: {
    name: 'Wave Master',
    description: 'Survive 50 solo waves',
    icon: '\uD83C\uDF0A',
    condition: { stat: 'totalWavesSurvived', threshold: 50 },
    xpReward: 1000
  },
  winner: {
    name: 'Winner',
    description: 'Win your first match',
    icon: '\uD83C\uDFC6',
    condition: { stat: 'totalWins', threshold: 1 },
    xpReward: 100
  },
  champion: {
    name: 'Champion',
    description: 'Win 25 matches',
    icon: '\uD83D\uDC51',
    condition: { stat: 'totalWins', threshold: 25 },
    xpReward: 1000
  },
  bot_slayer: {
    name: 'Bot Slayer',
    description: 'Kill 50 bots',
    icon: '\uD83E\uDD16',
    condition: { stat: 'totalBotKills', threshold: 50 },
    xpReward: 300
  },
  boss_hunter: {
    name: 'Boss Hunter',
    description: 'Kill 10 bosses',
    icon: '\uD83D\uDC79',
    condition: { stat: 'totalBossKills', threshold: 10 },
    xpReward: 500
  },
  br_victor: {
    name: 'Battle Royale Victor',
    description: 'Win a Battle Royale match',
    icon: '\uD83E\uDD47',
    condition: { stat: 'brWins', threshold: 1 },
    xpReward: 300
  },
  flag_runner: {
    name: 'Flag Runner',
    description: 'Capture 5 flags in CTF',
    icon: '\uD83D\uDEA9',
    condition: { stat: 'flagCaptures', threshold: 5 },
    xpReward: 300
  },
  hill_king: {
    name: 'Hill King',
    description: 'Win 5 King of the Hill matches',
    icon: '\u26F0',
    condition: { stat: 'kothWins', threshold: 5 },
    xpReward: 300
  },
  sniper_elite: {
    name: 'Sniper Elite',
    description: 'Get 25 kills with the sniper',
    icon: '\uD83D\uDD2D',
    condition: { stat: 'sniperKills', threshold: 25 },
    xpReward: 400
  },
  shotgun_mayhem: {
    name: 'Shotgun Mayhem',
    description: 'Get 25 kills with the shotgun',
    icon: '\uD83D\uDCA5',
    condition: { stat: 'shotgunKills', threshold: 25 },
    xpReward: 400
  },
  dedicated: {
    name: 'Dedicated',
    description: 'Play 50 matches',
    icon: '\u2B50',
    condition: { stat: 'totalMatches', threshold: 50 },
    xpReward: 500
  }
};

export function checkAchievements(stats, unlockedIds) {
  const newlyUnlocked = [];
  for (const [id, ach] of Object.entries(AchievementConfig)) {
    if (unlockedIds.includes(id)) continue;
    const val = stats[ach.condition.stat] || 0;
    if (val >= ach.condition.threshold) {
      newlyUnlocked.push(id);
    }
  }
  return newlyUnlocked;
}
