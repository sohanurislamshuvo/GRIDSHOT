import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { RoomManager } from './matchmaking/RoomManager.js';

export class GameServer {
  constructor(io) {
    this.io = io;
    this.roomManager = new RoomManager(io);
    this.playerSockets = new Map(); // socketId -> socket
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
    // Start solo mode
    socket.on(MessageTypes.START_SOLO, () => {
      const room = this.roomManager.createSoloRoom(socket);
      socket.emit(MessageTypes.MATCH_START, {
        roomId: room.id,
        mode: 'solo',
        playerId: socket.id
      });
    });

    // Join matchmaking queue
    socket.on(MessageTypes.JOIN_QUEUE, (data) => {
      const mode = data.mode; // 'duel', 'team2v2', 'team3v3'
      this.roomManager.addToQueue(socket, mode);
    });

    // Leave queue
    socket.on(MessageTypes.LEAVE_QUEUE, () => {
      this.roomManager.removeFromQueue(socket.id);
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

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      this.roomManager.handleDisconnect(socket.id);
      this.playerSockets.delete(socket.id);
    });
  }
}
