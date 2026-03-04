export const WaveConfig = {
  TIME_BETWEEN_WAVES: 5000,     // 5 seconds
  BASE_BOTS_PER_WAVE: 3,
  BOTS_INCREASE_PER_WAVE: 2,
  BOSS_WAVE_INTERVAL: 5,        // Boss every 5 waves

  // Difficulty scaling multipliers per wave
  HEALTH_SCALE: 0.15,           // +15% per wave
  SPEED_SCALE: 0.05,            // +5% per wave
  SPEED_CAP: 1.5,               // Max 1.5x speed
  DAMAGE_SCALE: 0.1,            // +10% per wave

  // Boss stats
  BOSS_HEALTH_MULTIPLIER: 5,
  BOSS_DAMAGE_MULTIPLIER: 1.5,
  BOSS_SPEED_MULTIPLIER: 0.7,

  // Bot type unlock waves
  TYPE_UNLOCKS: {
    grunt: 1,
    fast: 3,
    tank: 5,
    sniper: 7
  },

  // XP rewards
  XP_PER_BOT_KILL: 10,
  XP_PER_BOSS_KILL: 100,
  XP_PER_WAVE_SURVIVE: 50
};
