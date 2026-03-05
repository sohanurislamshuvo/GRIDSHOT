import { GameMode } from './GameMode.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance, randomInRange } from 'shadow-arena-shared/utils/Vector2.js';

const BR_CONFIG = {
  initialRadius: 900,
  minRadius: 100,
  shrinkDelay: 30000,      // 30s before shrinking starts
  shrinkRate: 30,           // units per second
  zoneDamage: 5,            // HP per second outside zone
  zoneBroadcastRate: 500,   // 500ms between zone updates (2Hz)
};

export class BattleRoyaleMode extends GameMode {
  constructor(room) {
    super(room);
    const mc = room.mapConfig;
    this.zoneCenter = {
      x: mc.width / 2,
      y: mc.height / 2
    };
    this.zoneRadius = BR_CONFIG.initialRadius;
    this.targetRadius = BR_CONFIG.minRadius;
    this.shrinking = false;
    this.startTime = 0;
    this.lastZoneBroadcast = 0;
    this.eliminationOrder = [];
    this.alive = new Set();
  }

  onMatchStart() {
    this.startTime = Date.now();
    this.shrinking = false;
    this.zoneRadius = BR_CONFIG.initialRadius;
    this.alive.clear();
    for (const [id] of this.room.players) {
      this.alive.add(id);
    }
  }

  onPlayerDeath(playerId) {
    this.alive.delete(playerId);
    const remaining = this.alive.size;

    this.room.io.to(this.room.id).emit(MessageTypes.BR_ELIMINATED, {
      playerId,
      remaining
    });
  }

  update(dt, now) {
    // Start shrinking after delay
    if (!this.shrinking && (now - this.startTime) >= BR_CONFIG.shrinkDelay) {
      this.shrinking = true;
    }

    // Shrink zone
    if (this.shrinking && this.zoneRadius > this.targetRadius) {
      this.zoneRadius -= BR_CONFIG.shrinkRate * dt;
      if (this.zoneRadius < this.targetRadius) {
        this.zoneRadius = this.targetRadius;
      }
    }

    // Apply zone damage to players outside
    for (const [id, player] of this.room.players) {
      if (!player.alive) continue;
      const d = distance(player.x, player.y, this.zoneCenter.x, this.zoneCenter.y);
      if (d > this.zoneRadius) {
        const dmg = BR_CONFIG.zoneDamage * dt;
        player.health -= dmg;
        if (player.health <= 0) {
          player.health = 0;
          player.die();
          this.onPlayerDeath(id);
        }
      }
    }

    // Broadcast zone update at 2Hz
    if (now - this.lastZoneBroadcast >= BR_CONFIG.zoneBroadcastRate) {
      this.lastZoneBroadcast = now;
      this.room.io.to(this.room.id).emit(MessageTypes.ZONE_UPDATE, {
        x: this.zoneCenter.x,
        y: this.zoneCenter.y,
        radius: Math.round(this.zoneRadius),
        shrinking: this.shrinking
      });
    }
  }

  checkWinCondition() {
    if (this.alive.size <= 1) {
      const winnerId = this.alive.size === 1 ? [...this.alive][0] : null;
      return winnerId || 'none';
    }
    return null;
  }

  getSpawnPoint(playerIndex) {
    const mc = this.room.mapConfig;
    const cx = mc.width / 2;
    const cy = mc.height / 2;
    const spawnRadius = Math.min(mc.width, mc.height) * 0.35;
    const angle = (playerIndex / 12) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * spawnRadius,
      y: cy + Math.sin(angle) * spawnRadius
    };
  }
}
