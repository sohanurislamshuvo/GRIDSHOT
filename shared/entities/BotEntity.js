import { Entity } from './Entity.js';
import { GameConfig } from '../config/GameConfig.js';

export const BotState = {
  IDLE: 'idle',
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  FLEE: 'flee'
};

export const BotType = {
  GRUNT: 'grunt',
  FAST: 'fast',
  TANK: 'tank',
  SNIPER: 'sniper',
  BOSS: 'boss'
};

const BOT_TYPE_STATS = {
  [BotType.GRUNT]:  { health: 80,  speed: 120, damage: 10, shootInterval: 800,  radius: 16 },
  [BotType.FAST]:   { health: 50,  speed: 200, damage: 8,  shootInterval: 600,  radius: 12 },
  [BotType.TANK]:   { health: 200, speed: 80,  damage: 15, shootInterval: 1200, radius: 22 },
  [BotType.SNIPER]: { health: 60,  speed: 100, damage: 25, shootInterval: 1500, radius: 14 },
  [BotType.BOSS]:   { health: 500, speed: 100, damage: 20, shootInterval: 600,  radius: 32 }
};

export class BotEntity extends Entity {
  constructor(x, y, type = BotType.GRUNT) {
    super(x, y);
    this.type = type;

    const stats = BOT_TYPE_STATS[type] || BOT_TYPE_STATS[BotType.GRUNT];
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.shootInterval = stats.shootInterval;
    this.radius = stats.radius;

    this.alive = true;
    this.state = BotState.IDLE;
    this.targetId = null;
    this.lastShotTime = 0;
    this.stateTimer = 0;

    // Patrol
    this.waypointX = x;
    this.waypointY = y;

    // Boss phases
    this.phase = 0;
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.active = false;
    }
    return amount;
  }

  canShoot(now) {
    return this.alive && (now - this.lastShotTime) >= this.shootInterval;
  }

  applyDifficultyMultiplier(healthMult, speedMult, damageMult) {
    this.health = Math.floor(this.health * healthMult);
    this.maxHealth = this.health;
    this.speed *= speedMult;
    this.damage = Math.floor(this.damage * damageMult);
  }

  serialize() {
    return {
      ...super.serialize(),
      type: this.type,
      health: this.health,
      maxHealth: this.maxHealth,
      alive: this.alive,
      state: this.state
    };
  }
}
