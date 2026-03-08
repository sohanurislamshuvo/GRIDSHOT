import { clamp } from '../utils/Vector2.js';
import { GameConfig } from '../config/GameConfig.js';

let nextId = 1;

export class Entity {
  constructor(x = 0, y = 0) {
    this.id = `ent_${nextId++}`;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.radius = 16;
    this.active = true;
    // Map bounds - defaults from GameConfig, override per-entity for non-standard maps
    this.mapWidth = GameConfig.WORLD_WIDTH;
    this.mapHeight = GameConfig.WORLD_HEIGHT;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Clamp to world bounds (uses per-entity map dimensions)
    this.x = clamp(this.x, this.radius, this.mapWidth - this.radius);
    this.y = clamp(this.y, this.radius, this.mapHeight - this.radius);
  }

  distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  angleTo(other) {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }

  collidesWith(other) {
    return this.distanceTo(other) < (this.radius + other.radius);
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      rotation: this.rotation,
      active: this.active
    };
  }
}

export function resetEntityIds() {
  nextId = 1;
}
