export class GameMode {
  constructor(room) {
    this.room = room;
  }

  onPlayerJoin(player) {}
  onPlayerKill(killerId, victimId) {}
  onBotKill(killerId, botId) {}
  onPlayerDeath(playerId) {}
  onMatchStart() {}
  update(dt, now) {}
  checkWinCondition() { return null; }
  getSpawnPoint(playerIndex) {
    return { x: 1000, y: 1000 };
  }
}
