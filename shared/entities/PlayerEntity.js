import { Entity } from './Entity.js';
import { GameConfig } from '../config/GameConfig.js';
import { normalize } from '../utils/Vector2.js';

export class PlayerEntity extends Entity {
  constructor(x, y, id) {
    super(x, y);
    if (id) this.id = id;
    this.radius = GameConfig.PLAYER_RADIUS;
    this.speed = GameConfig.PLAYER_SPEED;
    this.health = GameConfig.PLAYER_MAX_HEALTH;
    this.maxHealth = GameConfig.PLAYER_MAX_HEALTH;
    this.alive = true;
    this.team = null; // 'red' or 'blue' or null
    this.kills = 0;
    this.deaths = 0;

    // Shooting
    this.lastShotTime = 0;
    this.fireRate = GameConfig.FIRE_RATE;

    // Abilities
    this.abilities = {
      dash:   { ready: true, cooldownEnd: 0 },
      shield: { ready: true, cooldownEnd: 0 },
      radar:  { ready: true, cooldownEnd: 0 },
      heal:   { ready: true, cooldownEnd: 0 }
    };
    this.shieldActive = false;
    this.healActive = false;
    this.radarActive = false;
    this.isDashing = false;
    this.invulnerable = false;

    // Network
    this.lastProcessedInput = 0;
  }

  applyInput(input, dt) {
    let mx = 0;
    let my = 0;

    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;

    // Normalize diagonal movement
    const dir = normalize(mx, my);
    this.vx = dir.x * this.speed;
    this.vy = dir.y * this.speed;

    if (input.angle !== undefined) {
      this.rotation = input.angle;
    }
  }

  canShoot(now) {
    const interval = 1000 / this.fireRate;
    return this.alive && (now - this.lastShotTime) >= interval;
  }

  takeDamage(amount) {
    if (!this.alive || this.invulnerable) return 0;

    let actual = amount;
    if (this.shieldActive) {
      actual = Math.floor(amount * 0.2); // 80% reduction
    }

    this.health -= actual;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
    return actual;
  }

  die() {
    this.alive = false;
    this.deaths++;
    this.vx = 0;
    this.vy = 0;
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.shieldActive = false;
    this.healActive = false;
    this.invulnerable = false;
    this.isDashing = false;
  }

  serialize() {
    return {
      ...super.serialize(),
      health: this.health,
      maxHealth: this.maxHealth,
      alive: this.alive,
      team: this.team,
      kills: this.kills,
      deaths: this.deaths,
      shieldActive: this.shieldActive,
      healActive: this.healActive,
      radarActive: this.radarActive,
      isDashing: this.isDashing,
      lastProcessedInput: this.lastProcessedInput
    };
  }
}
