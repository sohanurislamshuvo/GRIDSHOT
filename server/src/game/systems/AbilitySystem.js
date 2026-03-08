import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';

const ABILITY_DEFS = {
  dash:   { cooldown: 5000,  duration: 200,  distance: 200 },
  shield: { cooldown: 15000, duration: 3000 },
  radar:  { cooldown: 20000, duration: 5000, range: 1000 },
  heal:   { cooldown: 30000, duration: 5000, totalHeal: 50 }
};

export class AbilitySystem {
  constructor(room) {
    this.room = room;
    this.activeEffects = []; // { playerId, type, expiresAt }
  }

  useAbility(socketId, abilityName) {
    const player = this.room.players.get(socketId);
    if (!player || !player.alive) return;

    const def = ABILITY_DEFS[abilityName];
    if (!def) return;

    const ability = player.abilities[abilityName];
    if (!ability) return;

    const now = Date.now();
    if (now < ability.cooldownEnd) {
      // Still on cooldown
      const socket = this.room.sockets.get(socketId);
      if (socket) {
        socket.emit(MessageTypes.ABILITY_RESULT, {
          ability: abilityName,
          success: false,
          reason: 'cooldown',
          remaining: ability.cooldownEnd - now
        });
      }
      return;
    }

    // Activate ability
    ability.cooldownEnd = now + def.cooldown;
    ability.ready = false;

    switch (abilityName) {
      case 'dash':   this.executeDash(player, socketId); break;
      case 'shield': this.executeShield(player, socketId, now); break;
      case 'radar':  this.executeRadar(player, socketId, now); break;
      case 'heal':   this.executeHeal(player, socketId, now); break;
    }

    // Notify client
    const socket = this.room.sockets.get(socketId);
    if (socket) {
      socket.emit(MessageTypes.ABILITY_RESULT, {
        ability: abilityName,
        success: true,
        cooldownEnd: ability.cooldownEnd
      });
    }
  }

  executeDash(player, socketId) {
    const angle = player.rotation;
    const dashDist = ABILITY_DEFS.dash.distance;
    const mc = this.room.mapConfig;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Step-check along dash path to stop at first wall
    const stepSize = 16; // Check every half-tile
    const steps = Math.ceil(dashDist / stepSize);
    let finalX = player.x;
    let finalY = player.y;

    for (let i = 1; i <= steps; i++) {
      const dist = Math.min(i * stepSize, dashDist);
      const testX = Math.max(20, Math.min(mc.width - 20, player.x + dx * dist));
      const testY = Math.max(20, Math.min(mc.height - 20, player.y + dy * dist));

      if (!this.room.isPositionWalkable(testX, testY)) {
        break; // Stop at last valid position
      }
      finalX = testX;
      finalY = testY;
    }

    player.x = finalX;
    player.y = finalY;

    // Brief invulnerability
    player.invulnerable = true;
    player.isDashing = true;

    this.activeEffects.push({
      playerId: socketId,
      type: 'dash',
      expiresAt: Date.now() + ABILITY_DEFS.dash.duration,
      onExpire: () => {
        player.invulnerable = false;
        player.isDashing = false;
      }
    });
  }

  executeShield(player, socketId, now) {
    player.shieldActive = true;

    this.activeEffects.push({
      playerId: socketId,
      type: 'shield',
      expiresAt: now + ABILITY_DEFS.shield.duration,
      onExpire: () => {
        player.shieldActive = false;
      }
    });
  }

  executeRadar(player, socketId, now) {
    player.radarActive = true;

    // Send enemy positions to this player
    const enemies = [];
    for (const [id, bot] of this.room.bots.entries()) {
      if (bot.alive) {
        enemies.push({ id, x: bot.x, y: bot.y, type: bot.type });
      }
    }
    for (const [id, p] of this.room.players.entries()) {
      if (id !== socketId && p.alive) {
        if (!this.room.settings.teams || p.team !== player.team) {
          enemies.push({ id, x: p.x, y: p.y, type: 'player' });
        }
      }
    }

    const socket = this.room.sockets.get(socketId);
    if (socket) {
      socket.emit('radar_reveal', { enemies, duration: ABILITY_DEFS.radar.duration });
    }

    this.activeEffects.push({
      playerId: socketId,
      type: 'radar',
      expiresAt: now + ABILITY_DEFS.radar.duration,
      onExpire: () => {
        player.radarActive = false;
      }
    });
  }

  executeHeal(player, socketId, now) {
    player.healActive = true;
    const tickInterval = 1000;
    const ticks = ABILITY_DEFS.heal.duration / tickInterval;
    const healPerTick = ABILITY_DEFS.heal.totalHeal / ticks;
    let tickCount = 0;

    const healTimer = setInterval(() => {
      tickCount++;
      if (!player.alive || tickCount > ticks) {
        clearInterval(healTimer);
        player.healActive = false;
        return;
      }
      player.health = Math.min(player.maxHealth, player.health + healPerTick);
    }, tickInterval);

    this.activeEffects.push({
      playerId: socketId,
      type: 'heal',
      expiresAt: now + ABILITY_DEFS.heal.duration,
      onExpire: () => {
        player.healActive = false;
        clearInterval(healTimer);
      }
    });
  }

  update(now) {
    // Process expired effects
    this.activeEffects = this.activeEffects.filter(effect => {
      if (now >= effect.expiresAt) {
        if (effect.onExpire) effect.onExpire();
        return false;
      }
      return true;
    });

    // Reset ability readiness
    for (const player of this.room.players.values()) {
      for (const [name, ability] of Object.entries(player.abilities)) {
        ability.ready = now >= ability.cooldownEnd;
      }
    }
  }
}
