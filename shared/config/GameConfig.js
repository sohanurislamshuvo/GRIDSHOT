export const GameConfig = {
  // World
  WORLD_WIDTH: 2000,
  WORLD_HEIGHT: 2000,
  TILE_SIZE: 32,

  // Viewport
  VIEW_WIDTH: 960,
  VIEW_HEIGHT: 640,

  // Server
  TICK_RATE: 60,
  NETWORK_SEND_RATE: 20,

  // Player
  PLAYER_SPEED: 200,
  PLAYER_RADIUS: 16,
  PLAYER_MAX_HEALTH: 100,
  PLAYER_RESPAWN_TIME: 3000,

  // Projectile
  BULLET_SPEED: 500,
  BULLET_DAMAGE: 15,
  BULLET_RADIUS: 4,
  BULLET_LIFETIME: 2000,
  FIRE_RATE: 5, // shots per second

  // Bot defaults
  BOT_SPEED: 120,
  BOT_HEALTH: 80,
  BOT_DAMAGE: 10,
  BOT_DETECTION_RANGE: 300,
  BOT_ATTACK_RANGE: 200,
  BOT_FLEE_HEALTH_PERCENT: 0.2,
  BOT_SHOOT_INTERVAL: 800,

  // Colors
  COLORS: {
    // Player palette
    PLAYER: 0x4488ff,
    PLAYER_DARK: 0x2255aa,
    PLAYER_HIGHLIGHT: 0x66bbff,
    PLAYER_VISOR: 0x00ffcc,
    PLAYER_SKIN: 0xddbb99,
    PLAYER_ARMOR: 0x3366aa,
    PLAYER_ARMOR_DARK: 0x224477,
    PLAYER_GUN: 0x888888,
    PLAYER_GUN_DARK: 0x555555,
    PLAYER_BOOTS: 0x333333,

    // Bot type palettes
    BOT: 0xff4444,
    BOT_GRUNT: 0xff4444,
    BOT_GRUNT_DARK: 0xaa2222,
    BOT_FAST: 0xffaa00,
    BOT_FAST_DARK: 0xbb7700,
    BOT_TANK: 0x8844cc,
    BOT_TANK_DARK: 0x552288,
    BOT_SNIPER: 0x44ddaa,
    BOT_SNIPER_DARK: 0x228866,

    // Boss
    BOSS: 0xff8800,
    BOSS_DARK: 0xaa5500,
    BOSS_CROWN: 0xffcc00,

    // Projectiles
    BULLET_PLAYER: 0xffff00,
    BULLET_BOT: 0xff6666,
    BULLET_GLOW: 0xffff88,
    BULLET_BOT_GLOW: 0xff8888,

    // Environment
    WALL: 0x666666,
    FLOOR: 0x2a2a2a,

    // UI
    HEALTH_GREEN: 0x44ff44,
    HEALTH_YELLOW: 0xffaa00,
    HEALTH_RED: 0xff4444,
    HEALTH_BG: 0x333333,

    // Abilities
    SHIELD: 0x44aaff,
    SHIELD_INNER: 0x88ccff,
    HEAL: 0x44ff88,
    RADAR: 0xffaa00,
    DASH: 0xffffff,

    // Effects
    MUZZLE_FLASH: 0xffffaa,
    SHADOW: 0x000000
  }
};
