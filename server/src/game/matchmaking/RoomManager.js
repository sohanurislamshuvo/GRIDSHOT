import { Room } from '../Room.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();        // roomId -> Room
    this.roomsByCode = new Map();  // code -> Room
    this.playerRooms = new Map();  // socketId -> roomId

    // Clean up empty rooms periodically
    setInterval(() => this.cleanupRooms(), 10000);
  }

  createSoloRoom(socket, mapId = 'arena') {
    const room = new Room(this.io, 'solo', mapId);
    room.hostId = socket.id;
    room.addPlayer(socket);
    room.startMatch();

    this.rooms.set(room.id, room);
    this.playerRooms.set(socket.id, room.id);

    return room;
  }

  createLobbyRoom(socket, mode, mapId = 'arena') {
    // Remove player from any existing room first
    this.handleDisconnect(socket.id);

    const room = new Room(this.io, mode, mapId);
    room.hostId = socket.id;
    room.addPlayer(socket);

    this.rooms.set(room.id, room);
    this.roomsByCode.set(room.code, room);
    this.playerRooms.set(socket.id, room.id);

    socket.emit(MessageTypes.ROOM_CREATED, {
      code: room.code,
      mode,
      players: room.getLobbyPlayerList(),
      maxPlayers: room.settings.maxPlayers,
      minPlayers: room.settings.minPlayers,
      isHost: true
    });
  }

  joinByCode(socket, code) {
    const normalizedCode = (code || '').trim().toUpperCase();
    const room = this.roomsByCode.get(normalizedCode);

    if (!room) {
      socket.emit(MessageTypes.JOIN_FAILED, { reason: 'Room not found. Check the code and try again.' });
      return;
    }

    if (room.lobbyState !== 'waiting') {
      socket.emit(MessageTypes.JOIN_FAILED, { reason: 'Match already started.' });
      return;
    }

    if (room.players.size >= room.settings.maxPlayers) {
      socket.emit(MessageTypes.JOIN_FAILED, { reason: 'Room is full.' });
      return;
    }

    // Remove from any existing room first
    this.handleDisconnect(socket.id);

    room.addPlayer(socket);
    this.playerRooms.set(socket.id, room.id);

    // Notify the joiner
    socket.emit(MessageTypes.ROOM_JOINED, {
      code: room.code,
      mode: room.mode,
      players: room.getLobbyPlayerList(),
      maxPlayers: room.settings.maxPlayers,
      minPlayers: room.settings.minPlayers,
      isHost: false
    });

    // Notify all in room about updated player list
    this.io.to(room.id).emit(MessageTypes.ROOM_UPDATE, {
      players: room.getLobbyPlayerList(),
      maxPlayers: room.settings.maxPlayers,
      minPlayers: room.settings.minPlayers
    });
  }

  startMatch(socket) {
    const room = this.getPlayerRoom(socket.id);
    if (!room) return;

    if (room.hostId !== socket.id) {
      socket.emit(MessageTypes.JOIN_FAILED, { reason: 'Only the host can start the match.' });
      return;
    }

    if (room.lobbyState !== 'waiting') return;

    const required = room.settings.minPlayers || room.settings.maxPlayers;
    if (room.players.size < required) {
      socket.emit(MessageTypes.JOIN_FAILED, { reason: `Need at least ${required} players to start. Currently ${room.players.size}.` });
      return;
    }

    // Remove from code lookup (code no longer usable)
    this.roomsByCode.delete(room.code);

    room.startMatch();
  }

  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  handleDisconnect(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(socketId);

      // If room is in lobby and has players, handle host transfer
      if (room.lobbyState === 'waiting' && room.players.size > 0) {
        if (room.hostId === socketId) {
          // Transfer host to next player
          const nextHostId = room.players.keys().next().value;
          room.hostId = nextHostId;
        }
        // Notify remaining players
        this.io.to(room.id).emit(MessageTypes.ROOM_UPDATE, {
          players: room.getLobbyPlayerList(),
          maxPlayers: room.settings.maxPlayers,
          minPlayers: room.settings.minPlayers
        });
      }

      // If room is empty and still in lobby, clean up code
      if (room.players.size === 0 && room.lobbyState === 'waiting') {
        this.roomsByCode.delete(room.code);
      }
    }

    this.playerRooms.delete(socketId);
  }

  cleanupRooms() {
    for (const [id, room] of this.rooms.entries()) {
      if (!room.active) {
        this.roomsByCode.delete(room.code);
        this.rooms.delete(id);
        for (const [socketId, roomId] of this.playerRooms.entries()) {
          if (roomId === id) {
            this.playerRooms.delete(socketId);
          }
        }
      }
    }
  }
}
