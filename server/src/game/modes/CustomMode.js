import { GameMode } from './GameMode.js';

export class CustomMode extends GameMode {
  constructor(room) {
    super(room);
    this.killLimit = 50;
    this.timeLimit = 900000; // 15 minutes
  }

  onPlayerJoin(player) {
    player.team = null;
  }

  onPlayerKill(killerId, victimId) {
    // Kill tracked on player entity
  }

  checkWinCondition() {
    for (const [id, player] of this.room.players.entries()) {
      if (player.kills >= this.killLimit) {
        return { winner: id, reason: 'kill_limit' };
      }
    }

    if (Date.now() - this.room.startTime >= this.timeLimit) {
      let bestId = null;
      let bestKills = -1;
      for (const [id, player] of this.room.players.entries()) {
        if (player.kills > bestKills) {
          bestKills = player.kills;
          bestId = id;
        }
      }
      return { winner: bestId, reason: 'time_limit' };
    }

    return null;
  }

  getSpawnPoint(playerIndex) {
    const mc = this.room.mapConfig;
    const cx = mc.width / 2;
    const cy = mc.height / 2;
    const totalPlayers = Math.max(this.room.players.size, 2);
    const spawnRadius = Math.min(mc.width, mc.height) * 0.35;
    const angle = (playerIndex / totalPlayers) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * spawnRadius,
      y: cy + Math.sin(angle) * spawnRadius
    };
  }
}
