import { GameMode } from './GameMode.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class SoloMode extends GameMode {
  constructor(room) {
    super(room);
    this.waveSystem = new WaveSystem(room);
  }

  onPlayerJoin(player) {
    player.team = null;
  }

  onBotKill(killerId, botId) {
    this.waveSystem.onBotKilled(botId);
  }

  update(dt, now) {
    this.waveSystem.update(dt, now);
  }

  checkWinCondition() {
    // Solo mode has no win condition - endless survival
    // Check if player is dead (game over)
    for (const player of this.room.players.values()) {
      if (!player.alive) {
        return null; // Player will respawn
      }
    }
    return null;
  }

  getSpawnPoint(playerIndex) {
    const mc = this.room.mapConfig;
    return {
      x: mc.width / 2,
      y: mc.height / 2
    };
  }
}
