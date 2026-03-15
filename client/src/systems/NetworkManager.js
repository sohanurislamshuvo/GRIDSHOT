import { io } from 'socket.io-client';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';

export class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.roomId = null;
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.serverSnapshots = [];

    // Lobby callbacks
    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onRoomUpdate = null;
    this.onJoinFailed = null;

    // Match callbacks
    this.onSnapshot = null;
    this.onMatchStart = null;
    this.onMatchEnd = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPlayerDeath = null;
    this.onPlayerRespawn = null;
    this.onHitConfirm = null;
    this.onAbilityResult = null;
    this.onRadarReveal = null;
    this.onZoneUpdate = null;
    this.onBREliminated = null;
    this.onFlagUpdate = null;
    this.onHillUpdate = null;
    this.onAchievementUnlocked = null;
  }

  connect() {
    const isDev = window.location.port === '5173';
    const serverUrl = isDev
      ? `http://${window.location.hostname}:3000`
      : window.location.origin;

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId = this.socket.id;
      console.log('Connected to server:', this.playerId);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected from server');
    });

    // Lobby events
    this.socket.on(MessageTypes.ROOM_CREATED, (data) => {
      if (this.onRoomCreated) this.onRoomCreated(data);
    });

    this.socket.on(MessageTypes.ROOM_JOINED, (data) => {
      if (this.onRoomJoined) this.onRoomJoined(data);
    });

    this.socket.on(MessageTypes.ROOM_UPDATE, (data) => {
      if (this.onRoomUpdate) this.onRoomUpdate(data);
    });

    this.socket.on(MessageTypes.JOIN_FAILED, (data) => {
      if (this.onJoinFailed) this.onJoinFailed(data);
    });

    // Match events
    this.socket.on(MessageTypes.MATCH_START, (data) => {
      this.roomId = data.roomId;
      if (this.onMatchStart) this.onMatchStart(data);
    });

    this.socket.on(MessageTypes.MATCH_END, (data) => {
      if (this.onMatchEnd) this.onMatchEnd(data);
    });

    this.socket.on(MessageTypes.SNAPSHOT, (snapshot) => {
      this.serverSnapshots.push(snapshot);
      if (this.serverSnapshots.length > 10) this.serverSnapshots.shift();
      if (this.onSnapshot) this.onSnapshot(snapshot);
    });

    this.socket.on(MessageTypes.PLAYER_JOINED, (data) => {
      if (this.onPlayerJoined) this.onPlayerJoined(data);
    });

    this.socket.on(MessageTypes.PLAYER_LEFT, (data) => {
      if (this.onPlayerLeft) this.onPlayerLeft(data);
    });

    this.socket.on(MessageTypes.PLAYER_DEATH, (data) => {
      if (this.onPlayerDeath) this.onPlayerDeath(data);
    });

    this.socket.on(MessageTypes.PLAYER_RESPAWN, (data) => {
      if (this.onPlayerRespawn) this.onPlayerRespawn(data);
    });

    this.socket.on(MessageTypes.HIT_CONFIRM, (data) => {
      if (this.onHitConfirm) this.onHitConfirm(data);
    });

    this.socket.on(MessageTypes.ABILITY_RESULT, (data) => {
      if (this.onAbilityResult) this.onAbilityResult(data);
    });

    this.socket.on('radar_reveal', (data) => {
      if (this.onRadarReveal) this.onRadarReveal(data);
    });

    this.socket.on(MessageTypes.ZONE_UPDATE, (data) => {
      if (this.onZoneUpdate) this.onZoneUpdate(data);
    });

    this.socket.on(MessageTypes.BR_ELIMINATED, (data) => {
      if (this.onBREliminated) this.onBREliminated(data);
    });

    this.socket.on(MessageTypes.FLAG_UPDATE, (data) => {
      if (this.onFlagUpdate) this.onFlagUpdate(data);
    });

    this.socket.on(MessageTypes.HILL_UPDATE, (data) => {
      if (this.onHillUpdate) this.onHillUpdate(data);
    });

    this.socket.on(MessageTypes.ACHIEVEMENT_UNLOCKED, (data) => {
      if (this.onAchievementUnlocked) this.onAchievementUnlocked(data);
    });

    this.socket.on(MessageTypes.MATCH_RESULTS, (data) => {
      if (this.onMatchResults) this.onMatchResults(data);
    });
  }

  authenticate(playerId, username) {
    if (!this.connected) return;
    this.socket.emit('authenticate', { playerId, username });
  }

  // Lobby actions
  createRoom(mode, mapId = 'arena') {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.CREATE_ROOM, { mode, mapId });
  }

  joinRoom(code) {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.JOIN_ROOM, { code });
  }

  requestStartMatch() {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.START_MATCH);
  }

  startSolo(mapId = 'arena') {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.START_SOLO, { mapId });
  }

  sendInput(input) {
    if (!this.connected) return;
    const seq = this.inputSequence++;
    const inputPacket = { seq, ...input, timestamp: Date.now() };
    this.pendingInputs.push(inputPacket);
    this.socket.emit(MessageTypes.PLAYER_INPUT, inputPacket);
    return seq;
  }

  sendAbility(abilityName) {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.USE_ABILITY, { ability: abilityName });
  }

  sendWeaponSwitch(weaponType) {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.SWITCH_WEAPON, { weaponType });
  }

  reconcile(serverPlayerState) {
    const lastProcessed = serverPlayerState.lastProcessedInput;
    this.pendingInputs = this.pendingInputs.filter(input => input.seq > lastProcessed);
    return this.pendingInputs;
  }

  getLatestSnapshot() {
    return this.serverSnapshots[this.serverSnapshots.length - 1] || null;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}
