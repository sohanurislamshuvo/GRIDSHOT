import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance } from 'shadow-arena-shared/utils/Vector2.js';

export class CombatSystem {
  constructor(room) {
    this.room = room;
  }

  update(now) {
    const projectilesToRemove = [];

    for (const [projId, proj] of this.room.projectiles.entries()) {
      // Check against players
      for (const [playerId, player] of this.room.players.entries()) {
        if (!player.alive || proj.ownerId === playerId) continue;

        // Team check - don't hit teammates
        if (this.room.settings.teams) {
          const owner = this.room.players.get(proj.ownerId) || this.room.bots.get(proj.ownerId);
          if (owner && owner.team === player.team) continue;
        }

        const dist = distance(proj.x, proj.y, player.x, player.y);
        if (dist < proj.radius + player.radius) {
          const damage = player.takeDamage(proj.damage);
          projectilesToRemove.push(projId);

          // Notify hit
          this.room.io.to(this.room.id).emit(MessageTypes.HIT_CONFIRM, {
            targetId: playerId,
            damage,
            health: player.health,
            attackerId: proj.ownerId
          });

          if (!player.alive) {
            this.handleKill(proj.ownerId, playerId, now, proj.weaponType);
          }
          break;
        }
      }

      // Check against bots
      for (const [botId, bot] of this.room.bots.entries()) {
        if (!bot.alive || proj.ownerId === botId) continue;

        const dist = distance(proj.x, proj.y, bot.x, bot.y);
        if (dist < proj.radius + bot.radius) {
          bot.takeDamage(proj.damage);
          projectilesToRemove.push(projId);

          this.room.io.to(this.room.id).emit(MessageTypes.HIT_CONFIRM, {
            targetId: botId,
            damage: proj.damage,
            health: bot.health,
            attackerId: proj.ownerId
          });

          if (!bot.alive) {
            this.handleBotKill(proj.ownerId, botId, now, proj.weaponType);
          }
          break;
        }
      }

      // Check against destructibles
      if (projectilesToRemove.includes(projId)) continue;
      for (const [destId, dest] of this.room.destructibles.entries()) {
        if (!dest.alive) continue;
        const dist = distance(proj.x, proj.y, dest.x, dest.y);
        if (dist < proj.radius + dest.radius) {
          dest.takeDamage(proj.damage);
          projectilesToRemove.push(projId);

          if (!dest.alive) {
            dest._respawnAt = now + 30000; // 30s respawn
            this.room.io.to(this.room.id).emit(MessageTypes.DESTRUCTIBLE_DESTROYED, {
              id: destId,
              x: dest.x,
              y: dest.y,
              type: dest.type
            });
          }
          break;
        }
      }
    }

    // Remove hit projectiles
    for (const id of projectilesToRemove) {
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
