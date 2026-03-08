import { GameMode } from './GameMode.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class TeamMode extends GameMode {
  constructor(room, teamSize = 2) {
    super(room);
    this.teamSize = teamSize;
    this.killLimit = 25;
    this.timeLimit = 600000; // 10 minutes
  }

  onPlayerJoin(player) {
    // Auto-assign teams
    const redCount = Array.from(this.room.players.values()).filter(p => p.team === 'red').length;
    const blueCount = Array.from(this.room.players.values()).filter(p => p.team === 'blue').length;
    player.team = redCount <= blueCount ? 'red' : 'blue';
  }

  getTeamKills() {
    const kills = { red: 0, blue: 0 };
    for (const player of this.room.players.values()) {
      if (player.team) {
        kills[player.team] += player.kills;
      }
    }
    return kills;
  }

  checkWinCondition() {
    const teamKills = this.getTeamKills();

    if (teamKills.red >= this.killLimit) {
      return { winner: 'red', reason: 'kill_limit', teamKills };
    }
    if (teamKills.blue >= this.killLimit) {
      return { winner: 'blue', reason: 'kill_limit', teamKills };
    }

    if (Date.now() - this.room.startTime >= this.timeLimit) {
      const winner = teamKills.red > teamKills.blue ? 'red' :
                     teamKills.blue > teamKills.red ? 'blue' : 'draw';
      return { winner, reason: 'time_limit', teamKills };
    }

    return null;
  }

  getSpawnPoint(playerIndex) {
    const mc = this.room.mapConfig;
    const isRed = playerIndex % 2 === 0;
    const teamIndex = Math.floor(playerIndex / 2);

    if (isRed) {
      const redSpawns = [
        { x: 200, y: 200 },
        { x: 200, y: mc.height / 2 },
        { x: 200, y: mc.height - 200 }
      ];
      return redSpawns[teamIndex % redSpawns.length];
    } else {
      const blueSpawns = [
        { x: mc.width - 200, y: 200 },
        { x: mc.width - 200, y: mc.height / 2 },
        { x: mc.width - 200, y: mc.height - 200 }
      ];
      return blueSpawns[teamIndex % blueSpawns.length];
    }
  }
}
