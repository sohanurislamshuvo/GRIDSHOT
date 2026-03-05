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
