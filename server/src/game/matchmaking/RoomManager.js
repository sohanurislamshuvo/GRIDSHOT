import { Room } from '../Room.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();        // roomId -> Room
    this.playerRooms = new Map();  // socketId -> roomId
    this.queues = {
      duel: [],      // Array of sockets
      team2v2: [],
      team3v3: []
    };

    // Check queues periodically
    setInterval(() => this.processQueues(), 1000);

    // Clean up empty rooms periodically
    setInterval(() => this.cleanupRooms(), 10000);
  }

  createSoloRoom(socket) {
    const room = new Room(this.io, 'solo');
    room.addPlayer(socket);
    room.startMatch();

    this.rooms.set(room.id, room);
    this.playerRooms.set(socket.id, room.id);

    return room;
  }

  addToQueue(socket, mode) {
    if (!this.queues[mode]) {
      socket.emit(MessageTypes.ERROR, { message: 'Invalid game mode' });
      return;
    }

    // Remove from any existing queue
    this.removeFromQueue(socket.id);

    this.queues[mode].push(socket);
    socket.emit('queue_joined', { mode, position: this.queues[mode].length });
  }

  removeFromQueue(socketId) {
    for (const [mode, queue] of Object.entries(this.queues)) {
      const idx = queue.findIndex(s => s.id === socketId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        return;
      }
    }
  }

  processQueues() {
    // Duel: need 2 players
    while (this.queues.duel.length >= 2) {
      const players = this.queues.duel.splice(0, 2);
      this.createMatchRoom('duel', players);
    }

    // 2v2: need 4 players
    while (this.queues.team2v2.length >= 4) {
      const players = this.queues.team2v2.splice(0, 4);
      this.createMatchRoom('team2v2', players);
    }

    // 3v3: need 6 players
    while (this.queues.team3v3.length >= 6) {
      const players = this.queues.team3v3.splice(0, 6);
      this.createMatchRoom('team3v3', players);
    }
  }

  createMatchRoom(mode, sockets) {
    const room = new Room(this.io, mode);

    for (const socket of sockets) {
      room.addPlayer(socket);
      this.playerRooms.set(socket.id, room.id);
    }

    room.startMatch();
    this.rooms.set(room.id, room);

    // Notify players
    for (const socket of sockets) {
      socket.emit(MessageTypes.MATCH_FOUND, {
        roomId: room.id,
        mode
      });
    }

    return room;
  }

  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  handleDisconnect(socketId) {
    // Remove from queue
    this.removeFromQueue(socketId);

    // Remove from room
    const roomId = this.playerRooms.get(socketId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.removePlayer(socketId);
      }
      this.playerRooms.delete(socketId);
    }
  }

  cleanupRooms() {
    for (const [id, room] of this.rooms.entries()) {
      if (!room.active) {
        this.rooms.delete(id);
        // Clean up player mappings
        for (const [socketId, roomId] of this.playerRooms.entries()) {
          if (roomId === id) {
            this.playerRooms.delete(socketId);
          }
        }
      }
    }
  }
}
