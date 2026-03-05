import { GameMode } from './GameMode.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance } from 'shadow-arena-shared/utils/Vector2.js';

const CTF_CONFIG = {
  captureRadius: 30,
  returnRadius: 30,
  scoresToWin: 3,
  timeLimit: 600000,    // 10 minutes
  flagBroadcastRate: 500 // 2Hz
};

export class CTFMode extends GameMode {
  constructor(room) {
    super(room);
    const W = room.mapConfig.width;
    const H = room.mapConfig.height;

    this.flags = {
      red: {
        baseX: W * 0.15, baseY: H / 2,
        x: W * 0.15, y: H / 2,
        carrier: null, // socketId of carrying player
        atBase: true
      },
      blue: {
        baseX: W * 0.85, baseY: H / 2,
        x: W * 0.85, y: H / 2,
        carrier: null,
        atBase: true
      }
    };

    this.scores = { red: 0, blue: 0 };
    this.lastFlagBroadcast = 0;
  }

  onMatchStart() {
    this.scores = { red: 0, blue: 0 };
    this.resetFlags();
  }

  resetFlags() {
    for (const team of ['red', 'blue']) {
      const f = this.flags[team];
      f.x = f.baseX;
      f.y = f.baseY;
      f.carrier = null;
      f.atBase = true;
    }
  }

  onPlayerDeath(playerId) {
    // Drop flag if carrying
    const player = this.room.players.get(playerId);
    if (!player) return;

    for (const team of ['red', 'blue']) {
      if (this.flags[team].carrier === playerId) {
        this.flags[team].carrier = null;
        this.flags[team].x = player.x;
        this.flags[team].y = player.y;
        this.flags[team].atBase = false;
      }
    }
  }

  update(dt, now) {
    // Update flag positions for carriers
    for (const team of ['red', 'blue']) {
      const flag = this.flags[team];
      if (flag.carrier) {
        const carrier = this.room.players.get(flag.carrier);
        if (carrier && carrier.alive) {
          flag.x = carrier.x;
          flag.y = carrier.y;
        } else {
          // Carrier disconnected or died
          flag.carrier = null;
          flag.atBase = false;
        }
      }
    }

    // Check pickups and captures
    for (const [socketId, player] of this.room.players) {
      if (!player.alive) continue;

      const enemyTeam = player.team === 'red' ? 'blue' : 'red';
      const ownTeam = player.team;
      const enemyFlag = this.flags[enemyTeam];
      const ownFlag = this.flags[ownTeam];

      // Pick up enemy flag
      if (!enemyFlag.carrier && !enemyFlag.atBase) {
        const d = distance(player.x, player.y, enemyFlag.x, enemyFlag.y);
        if (d < CTF_CONFIG.captureRadius) {
          enemyFlag.carrier = socketId;
        }
      } else if (!enemyFlag.carrier && enemyFlag.atBase) {
        const d = distance(player.x, player.y, enemyFlag.x, enemyFlag.y);
        if (d < CTF_CONFIG.captureRadius) {
          enemyFlag.carrier = socketId;
          enemyFlag.atBase = false;
        }
      }

      // Return own flag (touch dropped flag)
      if (!ownFlag.carrier && !ownFlag.atBase) {
        const d = distance(player.x, player.y, ownFlag.x, ownFlag.y);
        if (d < CTF_CONFIG.returnRadius) {
          ownFlag.x = ownFlag.baseX;
          ownFlag.y = ownFlag.baseY;
          ownFlag.atBase = true;
        }
      }

      // Capture: carrying enemy flag to own base (own flag must be at base)
      if (enemyFlag.carrier === socketId && ownFlag.atBase) {
        const d = distance(player.x, player.y, ownFlag.baseX, ownFlag.baseY);
        if (d < CTF_CONFIG.captureRadius) {
          this.scores[ownTeam]++;
          // Reset enemy flag
          enemyFlag.x = enemyFlag.baseX;
          enemyFlag.y = enemyFlag.baseY;
          enemyFlag.carrier = null;
          enemyFlag.atBase = true;
        }
      }
    }

    // Broadcast flag state
    if (now - this.lastFlagBroadcast >= CTF_CONFIG.flagBroadcastRate) {
      this.lastFlagBroadcast = now;
      this.room.io.to(this.room.id).emit(MessageTypes.FLAG_UPDATE, {
        flags: {
          red: { x: Math.round(this.flags.red.x), y: Math.round(this.flags.red.y), carrier: this.flags.red.carrier, atBase: this.flags.red.atBase },
          blue: { x: Math.round(this.flags.blue.x), y: Math.round(this.flags.blue.y), carrier: this.flags.blue.carrier, atBase: this.flags.blue.atBase }
        },
        scores: this.scores
      });
    }
  }

  checkWinCondition() {
    if (this.scores.red >= CTF_CONFIG.scoresToWin) return 'red';
    if (this.scores.blue >= CTF_CONFIG.scoresToWin) return 'blue';
    return null;
  }

  getSpawnPoint(playerIndex) {
    const W = this.room.mapConfig.width;
    const H = this.room.mapConfig.height;
    // Red spawns left, blue spawns right
    if (playerIndex % 2 === 0) {
      return { x: W * 0.15 + Math.random() * 80 - 40, y: H / 2 + Math.random() * 160 - 80 };
    }
    return { x: W * 0.85 + Math.random() * 80 - 40, y: H / 2 + Math.random() * 160 - 80 };
  }
}
