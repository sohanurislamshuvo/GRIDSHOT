export const DestructibleType = {
  CRATE: 'crate',
  BARREL: 'barrel',
};

export const DestructibleConfig = {
  [DestructibleType.CRATE]: {
    health: 30,
    radius: 12,
    color: 0x8B6914,
    dropChance: 0.3,
  },
  [DestructibleType.BARREL]: {
    health: 50,
    radius: 10,
    color: 0x555555,
    dropChance: 0.4,
  },
};

export class DestructibleEntity {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    const cfg = DestructibleConfig[type] || DestructibleConfig[DestructibleType.CRATE];
    this.health = cfg.health;
    this.maxHealth = cfg.health;
    this.radius = cfg.radius;
    this.alive = true;
    this._respawnAt = 0;
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    const actual = Math.min(this.health, amount);
    this.health -= actual;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return actual;
  }

  checkRespawn(now) {
    if (!this.alive && this._respawnAt > 0 && now >= this._respawnAt) {
      this.alive = true;
      this.health = this.maxHealth;
      this._respawnAt = 0;
      return true;
    }
    return false;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      health: this.health,
      alive: this.alive,
    };
  }
}
