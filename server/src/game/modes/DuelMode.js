import { GameMode } from './GameMode.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class DuelMode extends GameMode {
  constructor(room) {
    super(room);
    this.killLimit = 10;
    this.timeLimit = 300000; // 5 minutes
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
      // Highest kills wins
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
    const points = [
      { x: 200, y: 200 },
      { x: mc.width - 200, y: mc.height - 200 }
    ];
    return points[playerIndex % 2];
  }
}
