import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance } from 'shadow-arena-shared/utils/Vector2.js';

// Maximum collision check radius (largest entity radius + projectile radius)
const MAX_COLLISION_RADIUS = 50;

export class CombatSystem {
  constructor(room) {
    this.room = room;
  }

  update(now) {
    const projectilesToRemove = [];
    const spatialHash = this.room.entitySpatialHash;

    for (const [projId, proj] of this.room.projectiles.entries()) {
      if (projectilesToRemove.includes(projId)) continue;

      // Use spatial hash to get only nearby entities - O(1) average vs O(n) full scan
      const nearby = spatialHash.getNearby(proj.x, proj.y, MAX_COLLISION_RADIUS);

      for (const entity of nearby) {
        if (!entity.alive || entity.id === proj.ownerId) continue;

        // Check collision distance
        const dist = distance(proj.x, proj.y, entity.x, entity.y);
        if (dist >= proj.radius + entity.radius) continue;

        // Determine entity type and handle collision
        const isPlayer = this.room.players.has(entity.id);
        const isBot = this.room.bots.has(entity.id);
        const isDestructible = this.room.destructibles.has(entity.id);

        if (isPlayer) {
          // Team check - don't hit teammates
          if (this.room.settings.teams) {
            const owner = this.room.players.get(proj.ownerId) || this.room.bots.get(proj.ownerId);
            if (owner && owner.team === entity.team) continue;
          }

          const damage = entity.takeDamage(proj.damage);
          projectilesToRemove.push(projId);

          this.room.io.to(this.room.id).emit(MessageTypes.HIT_CONFIRM, {
            targetId: entity.id,
            damage,
            health: entity.health,
            attackerId: proj.ownerId
          });

          if (!entity.alive) {
            this.handleKill(proj.ownerId, entity.id, now, proj.weaponType);
          }
          break;
        } else if (isBot) {
          entity.takeDamage(proj.damage);
          projectilesToRemove.push(projId);

          this.room.io.to(this.room.id).emit(MessageTypes.HIT_CONFIRM, {
            targetId: entity.id,
            damage: proj.damage,
            health: entity.health,
            attackerId: proj.ownerId
          });

          if (!entity.alive) {
            this.handleBotKill(proj.ownerId, entity.id, now, proj.weaponType);
          }
          break;
        } else if (isDestructible) {
          entity.takeDamage(proj.damage);
          projectilesToRemove.push(projId);

          if (!entity.alive) {
            entity._respawnAt = now + 30000; // 30s respawn
            this.room.io.to(this.room.id).emit(MessageTypes.DESTRUCTIBLE_DESTROYED, {
              id: entity.id,
              x: entity.x,
              y: entity.y,
              type: entity.type
            });
          }
          break;
        }
      }
    }

    // Remove hit projectiles and return to pool
    for (const id of projectilesToRemove) {
      this.room.projectilePool.release(id);
      this.room.projectiles.delete(id);
    }
  }

  handleKill(killerId, victimId, now, weaponType) {
    // Award kill to killer
    const killer = this.room.players.get(killerId) || this.room.bots.get(killerId);
    if (killer) {
      killer.kills++;
      this._trackWeaponKill(killer, weaponType);
    }

    // Schedule respawn (only if mode allows it)
    if (this.room.settings.respawn) {
      const victim = this.room.players.get(victimId);
      if (victim) {
        victim._respawnAt = now + GameConfig.PLAYER_RESPAWN_TIME;
      }
    }

    // Notify mode handler
    if (this.room.modeHandler) {
      this.room.modeHandler.onPlayerDeath(victimId);
    }

    this.room.io.to(this.room.id).emit(MessageTypes.PLAYER_DEATH, {
      playerId: victimId,
      killerId,
      respawnIn: this.room.settings.respawn ? GameConfig.PLAYER_RESPAWN_TIME : 0
    });
  }

  handleBotKill(killerId, botId, now, weaponType) {
    const killer = this.room.players.get(killerId);
    if (killer) {
      killer.kills++;
      killer._botKills = (killer._botKills || 0) + 1;
      this._trackWeaponKill(killer, weaponType);
    }

    const bot = this.room.bots.get(botId);
    if (bot) {
      if (bot.type === 'BOSS') {
        if (killer) killer._bossKills = (killer._bossKills || 0) + 1;
      }
      bot._respawnAt = now + GameConfig.PLAYER_RESPAWN_TIME;
    }
  }

  _trackWeaponKill(killer, weaponType) {
    if (!weaponType) return;
    if (weaponType === 'sniper') killer._sniperKills = (killer._sniperKills || 0) + 1;
    if (weaponType === 'shotgun') killer._shotgunKills = (killer._shotgunKills || 0) + 1;
  }
}
