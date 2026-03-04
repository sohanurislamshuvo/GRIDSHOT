import { io } from 'socket.io-client';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';

export class NetworkManager {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.roomId = null;
    this.inputSequence = 0;
    this.pendingInputs = [];
    this.serverSnapshots = [];
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
  }

  connect() {
    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
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

    // Game events
    this.socket.on(MessageTypes.MATCH_START, (data) => {
      this.roomId = data.roomId;
      if (this.onMatchStart) this.onMatchStart(data);
    });

    this.socket.on(MessageTypes.MATCH_FOUND, (data) => {
      this.roomId = data.roomId;
      if (this.onMatchStart) this.onMatchStart(data);
    });

    this.socket.on(MessageTypes.MATCH_END, (data) => {
      if (this.onMatchEnd) this.onMatchEnd(data);
    });

    this.socket.on(MessageTypes.SNAPSHOT, (snapshot) => {
      this.serverSnapshots.push(snapshot);
      // Keep only last 10 snapshots
      if (this.serverSnapshots.length > 10) {
        this.serverSnapshots.shift();
      }
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

    this.socket.on('queue_joined', (data) => {
      console.log(`Joined ${data.mode} queue, position: ${data.position}`);
    });
  }

  startSolo() {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.START_SOLO);
  }

  joinQueue(mode) {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.JOIN_QUEUE, { mode });
  }

  leaveQueue() {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.LEAVE_QUEUE);
  }

  sendInput(input) {
    if (!this.connected) return;

    const seq = this.inputSequence++;
    const inputPacket = {
      seq,
      ...input,
      timestamp: Date.now()
    };

    // Store for reconciliation
    this.pendingInputs.push(inputPacket);

    this.socket.emit(MessageTypes.PLAYER_INPUT, inputPacket);

    return seq;
  }

  sendAbility(abilityName) {
    if (!this.connected) return;
    this.socket.emit(MessageTypes.USE_ABILITY, { ability: abilityName });
  }

  reconcile(serverPlayerState) {
    // Remove inputs that the server has already processed
    const lastProcessed = serverPlayerState.lastProcessedInput;
    this.pendingInputs = this.pendingInputs.filter(
      input => input.seq > lastProcessed
    );

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
