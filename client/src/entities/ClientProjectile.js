import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { WeaponConfig } from 'shadow-arena-shared/config/WeaponConfig.js';

export class ClientProjectile {
  constructor(game, x, y, angle, isPlayerBullet = true, weaponType = 'auto_rifle') {
    this.game = game;
    this.pool = game.projectilePool;
    this.weaponType = weaponType;

    const wep = WeaponConfig[weaponType] || WeaponConfig['auto_rifle'];

    // Game state
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.radius = wep.bulletRadius;
    this.damage = wep.damage;
    this.alive = true;
    this.isPlayerBullet = isPlayerBullet;
    this.serverId = null;

    // Velocity
    this.vx = Math.cos(angle) * wep.bulletSpeed;
    this.vy = Math.sin(angle) * wep.bulletSpeed;

    // Lifetime
    this._createdAt = performance.now();
    this._lifetime = wep.bulletLifetime;

    // Allocate an instance slot from the pool
    this._poolIndex = this.pool.allocate(isPlayerBullet);
    if (this._poolIndex >= 0) {
      this.pool.updateInstance(this._poolIndex, isPlayerBullet, x, y, angle);
    }
  }

  update(dt) {
    if (!this.alive) return;

    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Update pool instance position
    if (this._poolIndex >= 0) {
      this.pool.updateInstance(this._poolIndex, this.isPlayerBullet, this.x, this.y, this.angle);
    }

    // Trail particles (use weapon tracer color for player bullets)
    if (Math.random() < 0.6) {
      const wep = WeaponConfig[this.weaponType];
      const color = this.isPlayerBullet ? (wep ? wep.tracerColor : 0xffff88) : 0xff8888;
      this.game.particles.emit(this.x, 10, this.y, {
        count: 1, speed: 8, color, lifetime: 0.12, size: 1.5
      });
    }

    // Check lifetime
    if (performance.now() - this._createdAt > this._lifetime) {
      this.destroy();
      return;
    }

    // Check world bounds
    if (this.x < 0 || this.x > GameConfig.WORLD_WIDTH || this.y < 0 || this.y > GameConfig.WORLD_HEIGHT) {
      this.destroy();
    }
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    if (this._poolIndex >= 0) {
      this.pool.updateInstance(this._poolIndex, this.isPlayerBullet, x, y, this.angle);
    }
  }

  destroy() {
    this.alive = false;
    if (this._poolIndex >= 0) {
      this.pool.release(this._poolIndex, this.isPlayerBullet);
      this._poolIndex = -1;
    }
  }
}
