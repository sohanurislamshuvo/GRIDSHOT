import { Entity } from './Entity.js';

export const PickupType = {
  WEAPON_SMG: 'weapon_smg',
  WEAPON_SHOTGUN: 'weapon_shotgun',
  WEAPON_SNIPER: 'weapon_sniper',
  HEALTH: 'health',
  SHIELD: 'shield'
};

export const PickupConfig = {
  [PickupType.WEAPON_SMG]: { color: 0xffff88, healAmount: 0, shieldDuration: 0, weaponType: 'smg' },
  [PickupType.WEAPON_SHOTGUN]: { color: 0xff8844, healAmount: 0, shieldDuration: 0, weaponType: 'shotgun' },
  [PickupType.WEAPON_SNIPER]: { color: 0x44ffff, healAmount: 0, shieldDuration: 0, weaponType: 'sniper' },
  [PickupType.HEALTH]: { color: 0x44ff88, healAmount: 50, shieldDuration: 0, weaponType: null },
  [PickupType.SHIELD]: { color: 0x4488ff, healAmount: 0, shieldDuration: 8000, weaponType: null },
};

const PICKUP_RADIUS = 20;
const RESPAWN_TIME = 30000; // 30 seconds

export class PickupEntity extends Entity {
  constructor(x, y, pickupType) {
    super(x, y);
    this.pickupType = pickupType;
    this.radius = PICKUP_RADIUS;
    this.alive = true;
    this.respawnAt = 0;
  }

  collect() {
    this.alive = false;
    this.respawnAt = Date.now() + RESPAWN_TIME;
  }

  checkRespawn(now) {
    if (!this.alive && this.respawnAt > 0 && now >= this.respawnAt) {
      this.alive = true;
      this.respawnAt = 0;
      return true;
    }
    return false;
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      pickupType: this.pickupType,
      alive: this.alive
    };
  }
}
