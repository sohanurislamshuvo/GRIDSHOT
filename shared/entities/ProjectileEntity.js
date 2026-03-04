import { Entity } from './Entity.js';
import { GameConfig } from '../config/GameConfig.js';

export class ProjectileEntity extends Entity {
  constructor(x, y, angle, ownerId) {
    super(x, y);
    this.radius = GameConfig.BULLET_RADIUS;
    this.rotation = angle;
    this.speed = GameConfig.BULLET_SPEED;
    this.damage = GameConfig.BULLET_DAMAGE;
    this.ownerId = ownerId;
    this.createdAt = Date.now();
    this.lifetime = GameConfig.BULLET_LIFETIME;

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
      ownerId: this.ownerId
    };
  }
}
