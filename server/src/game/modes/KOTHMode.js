import { GameMode } from './GameMode.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance } from 'shadow-arena-shared/utils/Vector2.js';

const KOTH_CONFIG = {
  hillRadius: 60,
  rotateInterval: 60000,  // 60s between hill position changes
  pointsToWin: 200,
  scoreRate: 1,            // points per second while holding
  hillBroadcastRate: 500,  // 2Hz
};

export class KOTHMode extends GameMode {
  constructor(room) {
    super(room);
    const mc = room.mapConfig;
    this._hillPositions = [
      { x: mc.width / 2, y: mc.height / 2 },
      { x: mc.width * 0.3, y: mc.height * 0.3 },
      { x: mc.width * 0.7, y: mc.height * 0.7 },
    ];
    this.hillIndex = 0;
    const pos = this._hillPositions[0];
    this.hillX = pos.x;
    this.hillY = pos.y;
    this.hillRadius = KOTH_CONFIG.hillRadius;
    this.scores = { red: 0, blue: 0 };
    this.controllingTeam = null; // 'red', 'blue', or null (contested)
    this.lastRotation = 0;
    this.lastBroadcast = 0;
  }

  onMatchStart() {
    this.scores = { red: 0, blue: 0 };
    this.lastRotation = Date.now();
    this.hillIndex = 0;
    const pos = this._hillPositions[0];
    this.hillX = pos.x;
    this.hillY = pos.y;
    this.controllingTeam = null;
  }

  update(dt, now) {
    // Rotate hill position
    if (now - this.lastRotation >= KOTH_CONFIG.rotateInterval) {
      this.lastRotation = now;
      this.hillIndex = (this.hillIndex + 1) % this._hillPositions.length;
      const pos = this._hillPositions[this.hillIndex];
      this.hillX = pos.x;
      this.hillY = pos.y;
    }

    // Count teams on hill
    let redOnHill = 0;
    let blueOnHill = 0;

    for (const [, player] of this.room.players) {
      if (!player.alive) continue;
      const d = distance(player.x, player.y, this.hillX, this.hillY);
      if (d <= this.hillRadius) {
        if (player.team === 'red') redOnHill++;
        else if (player.team === 'blue') blueOnHill++;
      }
    }

    // Determine control
    if (redOnHill > 0 && blueOnHill === 0) {
      this.controllingTeam = 'red';
      this.scores.red += KOTH_CONFIG.scoreRate * dt;
    } else if (blueOnHill > 0 && redOnHill === 0) {
      this.controllingTeam = 'blue';
      this.scores.blue += KOTH_CONFIG.scoreRate * dt;
    } else {
      this.controllingTeam = null; // Contested or empty
    }

    // Broadcast hill state
    if (now - this.lastBroadcast >= KOTH_CONFIG.hillBroadcastRate) {
      this.lastBroadcast = now;
      this.room.io.to(this.room.id).emit(MessageTypes.HILL_UPDATE, {
        x: Math.round(this.hillX),
        y: Math.round(this.hillY),
        radius: this.hillRadius,
        controlling: this.controllingTeam,
        scores: {
          red: Math.round(this.scores.red),
          blue: Math.round(this.scores.blue)
        }
      });
    }
  }

  checkWinCondition() {
    if (this.scores.red >= KOTH_CONFIG.pointsToWin) return 'red';
    if (this.scores.blue >= KOTH_CONFIG.pointsToWin) return 'blue';
    return null;
  }

  getSpawnPoint(playerIndex) {
    const W = this.room.mapConfig.width;
    const H = this.room.mapConfig.height;
    if (playerIndex % 2 === 0) {
      return { x: W * 0.2 + Math.random() * 80 - 40, y: H / 2 + Math.random() * 160 - 80 };
    }
    return { x: W * 0.8 + Math.random() * 80 - 40, y: H / 2 + Math.random() * 160 - 80 };
  }
}
