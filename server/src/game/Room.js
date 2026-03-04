import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { PlayerEntity } from 'shadow-arena-shared/entities/PlayerEntity.js';
import { ProjectileEntity } from 'shadow-arena-shared/entities/ProjectileEntity.js';
import { BotEntity, BotType, BotState } from 'shadow-arena-shared/entities/BotEntity.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance, randomInRange, velocityFromAngle } from 'shadow-arena-shared/utils/Vector2.js';
import { GameLoop } from './GameLoop.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { AbilitySystem } from './systems/AbilitySystem.js';
import { BotAI } from './ai/BotAI.js';

let roomIdCounter = 1;

export class Room {
  constructor(io, mode = 'solo') {
    this.id = `room_${roomIdCounter++}`;
    this.io = io;
    this.mode = mode;
    this.players = new Map();    // socketId -> PlayerEntity
    this.sockets = new Map();    // socketId -> socket
    this.projectiles = new Map(); // id -> ProjectileEntity
    this.bots = new Map();       // id -> BotEntity
    this.botAIs = new Map();     // id -> BotAI

    this.combatSystem = new CombatSystem(this);
    this.abilitySystem = new AbilitySystem(this);
    this.gameLoop = new GameLoop(this);

    this.active = true;
    this.startTime = Date.now();
    this.tickCount = 0;

    // Match settings per mode
    this.settings = this.getSettings(mode);

    // Wall data for collision
    this.wallGrid = this.generateWallGrid();
  }

  getSettings(mode) {
    switch (mode) {
      case 'solo':
        return { maxPlayers: 1, bots: 5, killLimit: 0, timeLimit: 0, teams: false };
      case 'duel':
        return { maxPlayers: 2, bots: 0, killLimit: 10, timeLimit: 300000, teams: false };
      case 'team2v2':
        return { maxPlayers: 4, bots: 0, killLimit: 25, timeLimit: 600000, teams: true };
      case 'team3v3':
        return { maxPlayers: 6, bots: 0, killLimit: 25, timeLimit: 600000, teams: true };
      default:
        return { maxPlayers: 2, bots: 0, killLimit: 10, timeLimit: 300000, teams: false };
    }
  }

  generateWallGrid() {
    const cols = Math.floor(GameConfig.WORLD_WIDTH / GameConfig.TILE_SIZE);
    const rows = Math.floor(GameConfig.WORLD_HEIGHT / GameConfig.TILE_SIZE);
    const grid = [];

    for (let y = 0; y < rows; y++) {
      grid[y] = [];
      for (let x = 0; x < cols; x++) {
        // Same wall generation as client
        if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
          grid[y][x] = 1; // Wall
        } else if (this.isWallTile(x, y, cols, rows)) {
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0; // Floor
        }
      }
    }
    return grid;
  }

  isWallTile(x, y, mapWidth, mapHeight) {
    const pillarSpacing = 15;
    const px = x % pillarSpacing;
    const py = y % pillarSpacing;

    if (px >= 7 && px <= 9 && py >= 7 && py <= 9) {
      const cx = Math.floor(mapWidth / 2 / pillarSpacing);
      const cy = Math.floor(mapHeight / 2 / pillarSpacing);
      const ix = Math.floor(x / pillarSpacing);
      const iy = Math.floor(y / pillarSpacing);
      if (ix === cx && iy === cy) return false;
      return true;
    }

    const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (hash % 200 === 0) {
      const distFromCenter = Math.sqrt(
        Math.pow(x - mapWidth / 2, 2) + Math.pow(y - mapHeight / 2, 2)
      );
      if (distFromCenter > 10) return true;
    }

    return false;
  }

  isPositionWalkable(x, y) {
    const tx = Math.floor(x / GameConfig.TILE_SIZE);
    const ty = Math.floor(y / GameConfig.TILE_SIZE);
    if (ty < 0 || ty >= this.wallGrid.length || tx < 0 || tx >= this.wallGrid[0].length) {
      return false;
    }
    return this.wallGrid[ty][tx] === 0;
  }

  addPlayer(socket) {
    const spawn = this.getSpawnPoint(this.players.size);
    const player = new PlayerEntity(spawn.x, spawn.y, socket.id);

    // Assign team if team mode
    if (this.settings.teams) {
      const redCount = Array.from(this.players.values()).filter(p => p.team === 'red').length;
      const blueCount = Array.from(this.players.values()).filter(p => p.team === 'blue').length;
      player.team = redCount <= blueCount ? 'red' : 'blue';
    }

    this.players.set(socket.id, player);
    this.sockets.set(socket.id, socket);
    socket.join(this.id);

    // Notify all in room
    this.io.to(this.id).emit(MessageTypes.PLAYER_JOINED, {
      playerId: socket.id,
      x: player.x,
      y: player.y,
      team: player.team
    });

    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.sockets.delete(socketId);

    this.io.to(this.id).emit(MessageTypes.PLAYER_LEFT, { playerId: socketId });

    // If no players left, stop room
    if (this.players.size === 0) {
      this.stop();
    }
  }

  startMatch() {
    // Spawn bots if needed
    if (this.settings.bots > 0) {
      this.spawnBots(this.settings.bots);
    }

    this.gameLoop.start();

    this.io.to(this.id).emit(MessageTypes.MATCH_START, {
      roomId: this.id,
      mode: this.mode,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        x: p.x,
        y: p.y,
        team: p.team
      }))
    });
  }

  spawnBots(count) {
    for (let i = 0; i < count; i++) {
      const margin = 100;
      const x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
      const y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
      const bot = new BotEntity(x, y, BotType.GRUNT);

      this.bots.set(bot.id, bot);
      this.botAIs.set(bot.id, new BotAI(bot, this));
    }
  }

  getSpawnPoint(playerIndex) {
    const cx = GameConfig.WORLD_WIDTH / 2;
    const cy = GameConfig.WORLD_HEIGHT / 2;
    const offset = 200;

    const spawnPoints = [
      { x: cx, y: cy },
      { x: cx + offset, y: cy + offset },
      { x: cx - offset, y: cy - offset },
      { x: cx + offset, y: cy - offset },
      { x: cx - offset, y: cy + offset },
      { x: cx, y: cy - offset }
    ];

    return spawnPoints[playerIndex % spawnPoints.length];
  }

  handleInput(socketId, input) {
    const player = this.players.get(socketId);
    if (!player || !player.alive) return;

    // Validate input
    if (typeof input.angle !== 'number' || isNaN(input.angle)) return;

    // Apply movement
    player.applyInput(input, 1 / GameConfig.TICK_RATE);

    // Store last processed input sequence
    if (input.seq !== undefined) {
      player.lastProcessedInput = input.seq;
    }

    // Handle shooting
    if (input.shoot) {
      const now = Date.now();
      if (player.canShoot(now)) {
        player.lastShotTime = now;
        this.spawnProjectile(player);
      }
    }
  }

  handleAbility(socketId, abilityName) {
    this.abilitySystem.useAbility(socketId, abilityName);
  }

  spawnProjectile(owner) {
    const offsetX = Math.cos(owner.rotation) * 20;
    const offsetY = Math.sin(owner.rotation) * 20;
    const proj = new ProjectileEntity(
      owner.x + offsetX,
      owner.y + offsetY,
      owner.rotation,
      owner.id
    );
    this.projectiles.set(proj.id, proj);
  }

  update(dt, now) {
    this.tickCount++;

    // Update player positions
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      player.update(dt);

      // Wall collision (simple snap-back)
      if (!this.isPositionWalkable(player.x, player.y)) {
        player.x -= player.vx * dt;
        player.y -= player.vy * dt;
      }
    }

    // Update bots
    for (const [id, ai] of this.botAIs.entries()) {
      const bot = this.bots.get(id);
      if (!bot || !bot.alive) continue;

      ai.update(dt, now);
      bot.update(dt);

      // Wall collision for bots
      if (!this.isPositionWalkable(bot.x, bot.y)) {
        bot.x -= bot.vx * dt;
        bot.y -= bot.vy * dt;
      }
    }

    // Update projectiles
    for (const [id, proj] of this.projectiles.entries()) {
      proj.update(dt);

      // Remove if expired or out of bounds
      if (proj.isExpired(now) || proj.isOutOfBounds()) {
        this.projectiles.delete(id);
        continue;
      }

      // Wall collision
      if (!this.isPositionWalkable(proj.x, proj.y)) {
        this.projectiles.delete(id);
        continue;
      }
    }

    // Combat: check hits
    this.combatSystem.update(now);

    // Check win conditions
    this.checkWinCondition(now);

    // Handle respawns
    this.handleRespawns(now);
  }

  checkWinCondition(now) {
    if (this.mode === 'solo') return; // Solo has no win condition (endless)

    const timeLimit = this.settings.timeLimit;
    if (timeLimit > 0 && (now - this.startTime) >= timeLimit) {
      this.endMatch('time');
      return;
    }

    if (this.settings.killLimit > 0) {
      if (this.settings.teams) {
        // Check team kills
        const teamKills = { red: 0, blue: 0 };
        for (const p of this.players.values()) {
          if (p.team) teamKills[p.team] += p.kills;
        }
        if (teamKills.red >= this.settings.killLimit) {
          this.endMatch('red');
        } else if (teamKills.blue >= this.settings.killLimit) {
          this.endMatch('blue');
        }
      } else {
        // Check individual kills (duel mode)
        for (const [id, p] of this.players.entries()) {
          if (p.kills >= this.settings.killLimit) {
            this.endMatch(id);
            return;
          }
        }
      }
    }
  }

  handleRespawns(now) {
    // Players
    for (const [id, player] of this.players.entries()) {
      if (!player.alive && player._respawnAt && now >= player._respawnAt) {
        const spawn = this.getSpawnPoint(Math.floor(Math.random() * 6));
        player.respawn(spawn.x, spawn.y);
        player._respawnAt = null;

        this.io.to(this.id).emit(MessageTypes.PLAYER_RESPAWN, {
          playerId: id,
          x: player.x,
          y: player.y
        });
      }
    }

    // Bots
    for (const [id, bot] of this.bots.entries()) {
      if (!bot.alive && bot._respawnAt && now >= bot._respawnAt) {
        const margin = 100;
        bot.x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
        bot.y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
        bot.health = bot.maxHealth;
        bot.alive = true;
        bot.active = true;
        bot.state = BotState.PATROL;
        bot._respawnAt = null;
      }
    }
  }

  broadcastState() {
    const snapshot = {
      tick: this.tickCount,
      timestamp: Date.now(),
      players: [],
      projectiles: [],
      bots: []
    };

    for (const [id, player] of this.players.entries()) {
      snapshot.players.push({
        ...player.serialize(),
        id
      });
    }

    for (const [id, proj] of this.projectiles.entries()) {
      snapshot.projectiles.push(proj.serialize());
    }

    for (const [id, bot] of this.bots.entries()) {
      snapshot.bots.push(bot.serialize());
    }

    this.io.to(this.id).emit(MessageTypes.SNAPSHOT, snapshot);
  }

  endMatch(winnerId) {
    this.io.to(this.id).emit(MessageTypes.MATCH_END, {
      winner: winnerId,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        kills: p.kills,
        deaths: p.deaths,
        team: p.team
      })),
      duration: Date.now() - this.startTime
    });

    this.stop();
  }

  stop() {
    this.active = false;
    this.gameLoop.stop();
  }

  getAliveEntities() {
    const entities = [];
    for (const p of this.players.values()) {
      if (p.alive) entities.push(p);
    }
    for (const b of this.bots.values()) {
      if (b.alive) entities.push(b);
    }
    return entities;
  }

  getNearestPlayer(x, y, excludeId) {
    let nearest = null;
    let minDist = Infinity;

    for (const [id, player] of this.players.entries()) {
      if (id === excludeId || !player.alive) continue;
      const d = distance(x, y, player.x, player.y);
      if (d < minDist) {
        minDist = d;
        nearest = player;
      }
    }

    return nearest;
  }
}
