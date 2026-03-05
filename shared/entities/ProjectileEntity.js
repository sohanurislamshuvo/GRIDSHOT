import { Entity } from './Entity.js';
import { GameConfig } from '../config/GameConfig.js';
import { WeaponConfig } from '../config/WeaponConfig.js';

export class ProjectileEntity extends Entity {
  constructor(x, y, angle, ownerId, weaponType = 'auto_rifle') {
    super(x, y);
    this.weaponType = weaponType;

    const wep = WeaponConfig[weaponType] || WeaponConfig['auto_rifle'];
    this.radius = wep.bulletRadius;
    this.rotation = angle;
    this.speed = wep.bulletSpeed;
    this.damage = wep.damage;
    this.ownerId = ownerId;
    this.createdAt = Date.now();
    this.lifetime = wep.bulletLifetime;

    // Set velocity from angle
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  isExpired(now) {
    return (now - this.createdAt) > this.lifetime;
  }

  /**
   * Reset projectile for object pooling - avoids creating new objects.
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} angle - Direction in radians
   * @param {string} ownerId - ID of entity that fired this projectile
   * @param {string} weaponType - Weapon type for damage/speed config
   */
  reset(x, y, angle, ownerId, weaponType = 'auto_rifle') {
    this.x = x;
    this.y = y;
    this.rotation = angle;
    this.ownerId = ownerId;
    this.weaponType = weaponType;
    this.alive = true;

    const wep = WeaponConfig[weaponType] || WeaponConfig['auto_rifle'];
    this.radius = wep.bulletRadius;
    this.speed = wep.bulletSpeed;
    this.damage = wep.damage;
    this.lifetime = wep.bulletLifetime;
    this.createdAt = Date.now();

    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;

    // Clear spatial hash key if exists
    this._spatialKey = null;
  }

  isOutOfBounds() {
    return this.x < 0 || this.x > GameConfig.WORLD_WIDTH ||
           this.y < 0 || this.y > GameConfig.WORLD_HEIGHT;
  }

  serialize() {
    return {
      ...super.serialize(),
      ownerId: this.ownerId,
      weaponType: this.weaponType
    };
  }
}
