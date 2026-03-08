import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { AchievementConfig, checkAchievements } from 'shadow-arena-shared/config/AchievementConfig.js';
import { ProgressionSystem } from 'shadow-arena-shared/systems/ProgressionSystem.js';
import { RoomManager } from './matchmaking/RoomManager.js';

export class GameServer {
  constructor(io, playerRepo) {
    this.io = io;
    this.playerRepo = playerRepo;
    this.roomManager = new RoomManager(io);
    this.playerSockets = new Map(); // socketId -> socket
    this.authenticatedPlayers = new Map(); // socketId -> { playerId, username }
  }

  start() {
    this.io.on('connection', (socket) => {
      console.log(`Player connected: ${socket.id}`);
      this.playerSockets.set(socket.id, socket);

      this.setupSocketHandlers(socket);
    });

    console.log('Game server initialized');
  }

  setupSocketHandlers(socket) {
    // Authenticate socket with player account
    socket.on('authenticate', (data) => {
      if (data && data.playerId && data.username) {
        this.authenticatedPlayers.set(socket.id, {
          playerId: data.playerId,
          username: data.username
        });
      }
    });

    // Start solo mode
    socket.on(MessageTypes.START_SOLO, (data) => {
      const mapId = (data && data.mapId) || 'arena';
      const room = this.roomManager.createSoloRoom(socket, mapId);
      room._gameServer = this;
      socket.emit(MessageTypes.MATCH_START, {
        roomId: room.id,
        mode: 'solo',
        mapId,
        playerId: socket.id
      });
    });

    // Create a lobby room
    socket.on(MessageTypes.CREATE_ROOM, (data) => {
      const mode = data.mode; // 'duel', 'team2v2', 'team3v3', 'battle_royale', 'ctf', 'koth'
      const mapId = data.mapId || 'arena';
      const room = this.roomManager.createLobbyRoom(socket, mode, mapId);
      if (room) room._gameServer = this;
    });

    // Join a room by code
    socket.on(MessageTypes.JOIN_ROOM, (data) => {
      this.roomManager.joinByCode(socket, data.code);
    });

    // Host starts the match
    socket.on(MessageTypes.START_MATCH, () => {
      this.roomManager.startMatch(socket);
    });

    // Player input
    socket.on(MessageTypes.PLAYER_INPUT, (data) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (room) {
        room.handleInput(socket.id, data);
      }
    });

    // Ability use
    socket.on(MessageTypes.USE_ABILITY, (data) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (room) {
        room.handleAbility(socket.id, data.ability);
      }
    });

    // Weapon switch
    socket.on(MessageTypes.SWITCH_WEAPON, (data) => {
      const room = this.roomManager.getPlayerRoom(socket.id);
      if (room) {
        room.handleWeaponSwitch(socket.id, data.weaponType);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      this.roomManager.handleDisconnect(socket.id);
      this.playerSockets.delete(socket.id);
      this.authenticatedPlayers.delete(socket.id);
    });
  }

  // Called by Room when match ends to check achievements
  checkPlayerAchievements(socketId, matchStats) {
    if (!this.playerRepo) return;

    const auth = this.authenticatedPlayers.get(socketId);
    if (!auth) return;

    const player = this.playerRepo.findById(auth.playerId);
    if (!player) return;

    // Get current detailed stats and merge with match results
    const currentStats = JSON.parse(player.stats_json || '{}');
    const updatedStats = { ...currentStats };

    // Accumulate stats from this match
    updatedStats.totalKills = (updatedStats.totalKills || 0) + (matchStats.kills || 0);
    updatedStats.totalBotKills = (updatedStats.totalBotKills || 0) + (matchStats.botKills || 0);
    updatedStats.totalBossKills = (updatedStats.totalBossKills || 0) + (matchStats.bossKills || 0);
    updatedStats.totalWins = (updatedStats.totalWins || 0) + (matchStats.won ? 1 : 0);
    updatedStats.totalMatches = (updatedStats.totalMatches || 0) + 1;
    updatedStats.totalWavesSurvived = (updatedStats.totalWavesSurvived || 0) + (matchStats.wavesCleared || 0);
    updatedStats.brWins = (updatedStats.brWins || 0) + (matchStats.brWin ? 1 : 0);
    updatedStats.flagCaptures = (updatedStats.flagCaptures || 0) + (matchStats.flagCaptures || 0);
    updatedStats.kothWins = (updatedStats.kothWins || 0) + (matchStats.kothWin ? 1 : 0);
    updatedStats.sniperKills = (updatedStats.sniperKills || 0) + (matchStats.sniperKills || 0);
    updatedStats.shotgunKills = (updatedStats.shotgunKills || 0) + (matchStats.shotgunKills || 0);

    // Get already unlocked achievements
    const unlocked = this.playerRepo.getAchievements(auth.playerId);
    const unlockedIds = unlocked.map(a => a.achievement_id);

    // Check for new achievements
    const newlyUnlocked = checkAchievements(updatedStats, unlockedIds);

    // Calculate match XP
    const matchXP = ProgressionSystem.calculateMatchXP({
      botKills: matchStats.botKills || 0,
      playerKills: matchStats.kills || 0,
      bossKills: matchStats.bossKills || 0,
      won: matchStats.won,
      wavesCleared: matchStats.wavesCleared || 0
    });

    // Save new achievements and grant XP
    let achievementXP = 0;
    const socket = this.playerSockets.get(socketId);
    const newAchievementDetails = [];
    for (const achId of newlyUnlocked) {
      this.playerRepo.unlockAchievement(auth.playerId, achId);
      achievementXP += AchievementConfig[achId].xpReward;
      newAchievementDetails.push({
        id: achId,
        name: AchievementConfig[achId].name,
        icon: AchievementConfig[achId].icon,
        xpReward: AchievementConfig[achId].xpReward
      });

      // Notify client (toast)
      if (socket) {
        socket.emit(MessageTypes.ACHIEVEMENT_UNLOCKED, {
          id: achId,
          name: AchievementConfig[achId].name,
          description: AchievementConfig[achId].description,
          icon: AchievementConfig[achId].icon,
          xpReward: AchievementConfig[achId].xpReward
        });
      }
    }

    // Calculate new totals and level
    const oldLevel = ProgressionSystem.getLevelFromXP(player.xp);
    const totalXPEarned = matchXP + achievementXP;
    const newTotalXP = player.xp + totalXPEarned;
    const newLevelInfo = ProgressionSystem.getLevelFromXP(newTotalXP);
    const newAbilities = ProgressionSystem.getUnlockedAbilities(newLevelInfo.level);

    // Update player's detailed stats in DB
    this.playerRepo.updateStats(auth.playerId, {
      xp: newTotalXP,
      level: newLevelInfo.level,
      rating: player.rating,
      wins: player.wins + (matchStats.won ? 1 : 0),
      losses: player.losses + (matchStats.won ? 0 : 1),
      kills: player.kills + (matchStats.kills || 0),
      deaths: player.deaths + (matchStats.deaths || 0),
      unlockedAbilities: newAbilities,
      detailedStats: updatedStats
    });

    // Send match results to client
    if (socket) {
      socket.emit(MessageTypes.MATCH_RESULTS, {
        xpEarned: matchXP,
        achievementXP,
        oldLevel: oldLevel.level,
        newLevel: newLevelInfo.level,
        currentLevelXP: newLevelInfo.currentXP,
        xpForNextLevel: newLevelInfo.xpForNextLevel,
        newAchievements: newAchievementDetails
      });
    }
  }
}
