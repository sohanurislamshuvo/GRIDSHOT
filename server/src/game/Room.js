import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { WeaponConfig } from 'shadow-arena-shared/config/WeaponConfig.js';
import { getMapConfig } from 'shadow-arena-shared/config/MapConfig.js';
import { PlayerEntity } from 'shadow-arena-shared/entities/PlayerEntity.js';
import { ProjectileEntity } from 'shadow-arena-shared/entities/ProjectileEntity.js';
import { BotEntity, BotType, BotState } from 'shadow-arena-shared/entities/BotEntity.js';
import { PickupEntity, PickupType, PickupConfig } from 'shadow-arena-shared/entities/PickupEntity.js';
import { DestructibleEntity, DestructibleType, DestructibleConfig } from 'shadow-arena-shared/entities/DestructibleEntity.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { distance, randomInRange, velocityFromAngle } from 'shadow-arena-shared/utils/Vector2.js';
import { GameLoop } from './GameLoop.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { AbilitySystem } from './systems/AbilitySystem.js';
import { BotAI } from './ai/BotAI.js';
import { BattleRoyaleMode } from './modes/BattleRoyaleMode.js';
import { CTFMode } from './modes/CTFMode.js';
import { KOTHMode } from './modes/KOTHMode.js';

let roomIdCounter = 1;

export class Room {
  constructor(io, mode = 'solo', mapId = 'arena') {
    this.id = `room_${roomIdCounter++}`;
    this.io = io;
    this.mode = mode;
    this.mapId = mapId;
    this.mapConfig = getMapConfig(mapId);
    this.code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.hostId = null;
    this.lobbyState = 'waiting'; // 'waiting' or 'playing'

    this.players = new Map();    // socketId -> PlayerEntity
    this.sockets = new Map();    // socketId -> socket
    this.projectiles = new Map(); // id -> ProjectileEntity
    this.bots = new Map();       // id -> BotEntity
    this.botAIs = new Map();     // id -> BotAI
    this.pickups = new Map();    // id -> PickupEntity
    this.destructibles = new Map(); // id -> DestructibleEntity
    this._lastSentSnapshots = new Map(); // socketId -> { entities, tick }
    this._broadcastCount = 0;

    this.combatSystem = new CombatSystem(this);
    this.abilitySystem = new AbilitySystem(this);
    this.gameLoop = new GameLoop(this);

    this.active = true;
    this.startTime = Date.now();
    this.tickCount = 0;

    // Match settings per mode
    this.settings = this.getSettings(mode);

    // Mode handler
    this.modeHandler = this._createModeHandler(mode);

    // Wall data for collision
    this.wallGrid = this.generateWallGrid();
  }

  getSettings(mode) {
    switch (mode) {
      case 'solo':
        return { maxPlayers: 1, bots: 5, killLimit: 0, timeLimit: 0, teams: false, respawn: true };
      case 'duel':
        return { maxPlayers: 2, bots: 0, killLimit: 10, timeLimit: 300000, teams: false, respawn: true };
      case 'team2v2':
        return { maxPlayers: 4, bots: 0, killLimit: 25, timeLimit: 600000, teams: true, respawn: true };
      case 'team3v3':
        return { maxPlayers: 6, bots: 0, killLimit: 25, timeLimit: 600000, teams: true, respawn: true };
      case 'battle_royale':
        return { maxPlayers: 12, bots: 0, killLimit: 0, timeLimit: 600000, teams: false, respawn: false };
      case 'ctf':
        return { maxPlayers: 8, bots: 0, killLimit: 0, timeLimit: 600000, teams: true, respawn: true };
      case 'koth':
        return { maxPlayers: 6, bots: 0, killLimit: 0, timeLimit: 600000, teams: true, respawn: true };
      default:
        return { maxPlayers: 2, bots: 0, killLimit: 10, timeLimit: 300000, teams: false, respawn: true };
    }
  }

  _createModeHandler(mode) {
    switch (mode) {
      case 'battle_royale': return new BattleRoyaleMode(this);
      case 'ctf': return new CTFMode(this);
      case 'koth': return new KOTHMode(this);
      default: return null;
    }
  }

  generateWallGrid() {
    const mc = this.mapConfig;
    const cols = Math.floor(mc.width / mc.tileSize);
    const rows = Math.floor(mc.height / mc.tileSize);
    const grid = [];

    for (let y = 0; y < rows; y++) {
      grid[y] = [];
      for (let x = 0; x < cols; x++) {
        if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
          grid[y][x] = 1;
        } else if (this.isWallTile(x, y, cols, rows)) {
          grid[y][x] = 1;
        } else {
          grid[y][x] = 0;
        }
      }
    }
    return grid;
  }

  isWallTile(x, y, mapWidth, mapHeight) {
    const pillarSpacing = this.mapConfig.pillarSpacing;
    const wallDensity = this.mapConfig.wallDensity;
    const px = x % pillarSpacing;
    const py = y % pillarSpacing;
    const pillarStart = Math.floor(pillarSpacing / 2) - 1;
    const pillarEnd = pillarStart + 2;

    if (px >= pillarStart && px <= pillarEnd && py >= pillarStart && py <= pillarEnd) {
      const cx = Math.floor(mapWidth / 2 / pillarSpacing);
      const cy = Math.floor(mapHeight / 2 / pillarSpacing);
      const ix = Math.floor(x / pillarSpacing);
      const iy = Math.floor(y / pillarSpacing);
      if (ix === cx && iy === cy) return false;
      return true;
    }

    const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (hash % wallDensity === 0) {
      const distFromCenter = Math.sqrt(
        Math.pow(x - mapWidth / 2, 2) + Math.pow(y - mapHeight / 2, 2)
      );
      if (distFromCenter > 10) return true;
    }

    return false;
  }

  isPositionWalkable(x, y) {
    const tx = Math.floor(x / this.mapConfig.tileSize);
    const ty = Math.floor(y / this.mapConfig.tileSize);
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
    this._lastSentSnapshots.delete(socketId);

    this.io.to(this.id).emit(MessageTypes.PLAYER_LEFT, { playerId: socketId });

    // If no players left, stop room
    if (this.players.size === 0) {
      this.stop();
    }
  }

  startMatch() {
    if (this.lobbyState === 'playing') return;
    this.lobbyState = 'playing';
    this.startTime = Date.now();

    // Spawn bots if needed
    if (this.settings.bots > 0) {
      this.spawnBots(this.settings.bots);
    }

    // Spawn map pickups and destructibles
    this.spawnPickups();
    this.spawnDestructibles();

    // Initialize mode handler
    if (this.modeHandler) {
      this.modeHandler.onMatchStart();
    }

    this.gameLoop.start();

    this.io.to(this.id).emit(MessageTypes.MATCH_START, {
      roomId: this.id,
      mode: this.mode,
      mapId: this.mapId,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        x: p.x,
        y: p.y,
        team: p.team
      }))
    });
  }

  getLobbyPlayerList() {
    return Array.from(this.players.entries()).map(([id, p]) => ({
      id,
      team: p.team || null,
      isHost: id === this.hostId
    }));
  }

  spawnBots(count) {
    const mc = this.mapConfig;
    for (let i = 0; i < count; i++) {
      const margin = 100;
      const x = randomInRange(margin, mc.width - margin);
      const y = randomInRange(margin, mc.height - margin);
      const bot = new BotEntity(x, y, BotType.GRUNT);

      this.bots.set(bot.id, bot);
      this.botAIs.set(bot.id, new BotAI(bot, this));
    }
  }

  spawnDestructibles() {
    const mc = this.mapConfig;
    const W = mc.width;
    const H = mc.height;
    const cfg = mc.destructibles || { crates: 0, barrels: 0 };
    let idCounter = 0;

    const spawnType = (type, count) => {
      for (let i = 0; i < count; i++) {
        const hash = ((i * 48271) ^ (type.charCodeAt(0) * 16807)) >>> 0;
        const x = 100 + (hash % (W - 200));
        const y = 100 + ((hash >> 12) % (H - 200));
        if (!this.isPositionWalkable(x, y)) continue;
        const id = `dest_${idCounter++}`;
        this.destructibles.set(id, new DestructibleEntity(id, type, x, y));
      }
    };

    spawnType(DestructibleType.CRATE, cfg.crates);
    spawnType(DestructibleType.BARREL, cfg.barrels);
  }

  spawnPickups() {
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;
    const ts = this.mapConfig.tileSize;

    // Deterministic pickup positions using hash
    const pickupDefs = [
      // Weapon pickups spread around map
      { type: PickupType.WEAPON_SMG,     x: W * 0.25, y: H * 0.25 },
      { type: PickupType.WEAPON_SHOTGUN, x: W * 0.75, y: H * 0.25 },
      { type: PickupType.WEAPON_SNIPER,  x: W * 0.5,  y: H * 0.15 },
      { type: PickupType.WEAPON_SMG,     x: W * 0.25, y: H * 0.75 },
      { type: PickupType.WEAPON_SHOTGUN, x: W * 0.75, y: H * 0.75 },
      { type: PickupType.WEAPON_SNIPER,  x: W * 0.5,  y: H * 0.85 },
      // Health pickups near center paths
      { type: PickupType.HEALTH, x: W * 0.35, y: H * 0.5 },
      { type: PickupType.HEALTH, x: W * 0.65, y: H * 0.5 },
      { type: PickupType.HEALTH, x: W * 0.5,  y: H * 0.35 },
      { type: PickupType.HEALTH, x: W * 0.5,  y: H * 0.65 },
      // Shield pickups at corners
      { type: PickupType.SHIELD, x: W * 0.15, y: H * 0.5 },
      { type: PickupType.SHIELD, x: W * 0.85, y: H * 0.5 },
    ];

    for (const def of pickupDefs) {
      // Verify position is walkable
      if (!this.isPositionWalkable(def.x, def.y)) continue;
      const pickup = new PickupEntity(def.x, def.y, def.type);
      this.pickups.set(pickup.id, pickup);
    }
  }

  checkPickupCollisions(now) {
    for (const [pickupId, pickup] of this.pickups.entries()) {
      if (!pickup.alive) {
        // Check respawn
        if (pickup.checkRespawn(now)) {
          this.io.to(this.id).emit(MessageTypes.ITEM_RESPAWNED, {
            pickupId: pickup.id,
            x: pickup.x,
            y: pickup.y,
            pickupType: pickup.pickupType
          });
        }
        continue;
      }

      // Check proximity to players
      for (const [socketId, player] of this.players.entries()) {
        if (!player.alive) continue;
        const d = distance(player.x, player.y, pickup.x, pickup.y);
        if (d < pickup.radius + player.radius) {
          // Apply pickup effect
          const config = PickupConfig[pickup.pickupType];
          if (config.weaponType) {
            player.setWeapon(config.weaponType);
          }
          if (config.healAmount > 0) {
            player.health = Math.min(player.maxHealth, player.health + config.healAmount);
          }
          if (config.shieldDuration > 0) {
            player.shieldActive = true;
            player._shieldEndTime = now + config.shieldDuration;
          }

          pickup.collect();

          this.io.to(this.id).emit(MessageTypes.ITEM_PICKED_UP, {
            pickupId: pickup.id,
            playerId: socketId,
            pickupType: pickup.pickupType
          });
          break;
        }
      }
    }
  }

  getSpawnPoint(playerIndex) {
    if (this.modeHandler) {
      return this.modeHandler.getSpawnPoint(playerIndex);
    }

    const spawns = this.mapConfig.spawnPoints;
    if (spawns && spawns.length > 0) {
      return spawns[playerIndex % spawns.length];
    }

    const cx = this.mapConfig.width / 2;
    const cy = this.mapConfig.height / 2;
    return { x: cx, y: cy };
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

  handleWeaponSwitch(socketId, weaponType) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (!WeaponConfig[weaponType]) return;
    player.setWeapon(weaponType);
  }

  spawnProjectile(owner) {
    const wep = WeaponConfig[owner.weaponType] || WeaponConfig['auto_rifle'];
    const gunDist = 20;

    for (let i = 0; i < wep.projectileCount; i++) {
      const spread = (Math.random() - 0.5) * wep.spread * 2;
      const angle = owner.rotation + spread;
      const offsetX = Math.cos(angle) * gunDist;
      const offsetY = Math.sin(angle) * gunDist;
      const proj = new ProjectileEntity(
        owner.x + offsetX,
        owner.y + offsetY,
        angle,
        owner.id,
        owner.weaponType
      );
      this.projectiles.set(proj.id, proj);
    }
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

      // Remove if expired or out of bounds (use map config dimensions)
      if (proj.isExpired(now) || proj.x < 0 || proj.x > this.mapConfig.width || proj.y < 0 || proj.y > this.mapConfig.height) {
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

    // Check pickup collisions and respawns
    this.checkPickupCollisions(now);

    // Check destructible respawns
    for (const [id, dest] of this.destructibles.entries()) {
      if (dest.checkRespawn(now)) {
        this.io.to(this.id).emit(MessageTypes.DESTRUCTIBLE_RESPAWNED, {
          id, x: dest.x, y: dest.y, type: dest.type
        });
      }
    }

    // Update mode handler (BR zone, etc.)
    if (this.modeHandler) {
      this.modeHandler.update(dt, now);
    }

    // Check win conditions
    this.checkWinCondition(now);

    // Handle respawns (skip for no-respawn modes)
    if (this.settings.respawn) {
      this.handleRespawns(now);
    }
  }

  checkWinCondition(now) {
    if (this.mode === 'solo') return; // Solo has no win condition (endless)

    // Delegate to mode handler if present
    if (this.modeHandler) {
      const winner = this.modeHandler.checkWinCondition();
      if (winner) {
        this.endMatch(winner);
        return;
      }
    }

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
        bot.x = randomInRange(margin, this.mapConfig.width - margin);
        bot.y = randomInRange(margin, this.mapConfig.height - margin);
        bot.health = bot.maxHealth;
        bot.alive = true;
        bot.active = true;
        bot.state = BotState.PATROL;
        bot._respawnAt = null;
      }
    }
  }

  broadcastState() {
    this._broadcastCount++;
    const isKeyframe = this._broadcastCount % 5 === 0;

    // Build full current state
    const currentState = {};
    const fullSnapshot = {
      tick: this.tickCount,
      timestamp: Date.now(),
      players: [],
      projectiles: [],
      bots: [],
      pickups: [],
      destructibles: []
    };

    for (const [id, player] of this.players.entries()) {
      const s = { ...player.serialize(), id };
      // Quantize rotation to reduce bandwidth (2 decimal places)
      s.rotation = Math.round(s.rotation * 100) / 100;
      fullSnapshot.players.push(s);
      currentState[`p_${id}`] = `${s.x},${s.y},${s.rotation},${s.health},${s.alive},${s.weaponType || ''},${s.shieldActive || 0}`;
    }

    for (const [id, proj] of this.projectiles.entries()) {
      const s = proj.serialize();
      s.rotation = Math.round(s.rotation * 100) / 100;
      fullSnapshot.projectiles.push(s);
      currentState[`j_${s.id}`] = `${s.x},${s.y}`;
    }

    for (const [id, bot] of this.bots.entries()) {
      const s = bot.serialize();
      s.rotation = Math.round(s.rotation * 100) / 100;
      fullSnapshot.bots.push(s);
      currentState[`b_${s.id}`] = `${s.x},${s.y},${s.rotation},${s.health},${s.alive}`;
    }

    for (const [id, pickup] of this.pickups.entries()) {
      const s = pickup.serialize();
      fullSnapshot.pickups.push(s);
      currentState[`k_${s.id}`] = `${s.alive}`;
    }

    for (const [id, dest] of this.destructibles.entries()) {
      const s = dest.serialize();
      fullSnapshot.destructibles.push(s);
      currentState[`d_${s.id}`] = `${s.alive},${s.health}`;
    }

    // Send per-client (keyframe or delta)
    for (const [socketId, socket] of this.sockets.entries()) {
      if (isKeyframe || !this._lastSentSnapshots.has(socketId)) {
        // Full keyframe
        socket.emit(MessageTypes.SNAPSHOT, fullSnapshot);
        this._lastSentSnapshots.set(socketId, currentState);
      } else {
        // Delta: only include changed entities
        const lastState = this._lastSentSnapshots.get(socketId);
        const delta = {
          tick: this.tickCount,
          timestamp: fullSnapshot.timestamp,
          delta: true,
          players: [],
          projectiles: [],
          bots: [],
          pickups: [],
          destructibles: []
        };

        for (const p of fullSnapshot.players) {
          const key = `p_${p.id}`;
          if (currentState[key] !== lastState[key]) {
            delta.players.push(p);
          }
        }

        // Always include all projectiles (they move every tick)
        delta.projectiles = fullSnapshot.projectiles;

        for (const b of fullSnapshot.bots) {
          const key = `b_${b.id}`;
          if (currentState[key] !== lastState[key]) {
            delta.bots.push(b);
          }
        }

        for (const k of fullSnapshot.pickups) {
          const key = `k_${k.id}`;
          if (currentState[key] !== lastState[key]) {
            delta.pickups.push(k);
          }
        }

        for (const d of fullSnapshot.destructibles) {
          const key = `d_${d.id}`;
          if (currentState[key] !== lastState[key]) {
            delta.destructibles.push(d);
          }
        }

        // Include removed entity IDs
        const removedIds = [];
        for (const key of Object.keys(lastState)) {
          if (!(key in currentState)) {
            removedIds.push(key);
          }
        }
        if (removedIds.length > 0) delta.removed = removedIds;

        socket.emit(MessageTypes.SNAPSHOT, delta);
        this._lastSentSnapshots.set(socketId, currentState);
      }
    }
  }

  endMatch(winnerId) {
    const duration = Date.now() - this.startTime;

    this.io.to(this.id).emit(MessageTypes.MATCH_END, {
      winner: winnerId,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        kills: p.kills,
        deaths: p.deaths,
        team: p.team
      })),
      duration
    });

    // Check achievements for each player
    if (this._gameServer) {
      for (const [socketId, player] of this.players.entries()) {
        const won = winnerId === socketId || winnerId === player.team;
        this._gameServer.checkPlayerAchievements(socketId, {
          kills: player.kills,
          deaths: player.deaths,
          botKills: player._botKills || 0,
          bossKills: player._bossKills || 0,
          won,
          wavesCleared: player._wavesCleared || 0,
          brWin: this.mode === 'battle_royale' && won,
          flagCaptures: player._flagCaptures || 0,
          kothWin: this.mode === 'koth' && won,
          sniperKills: player._sniperKills || 0,
          shotgunKills: player._shotgunKills || 0,
          mode: this.mode,
          duration
        });
      }
    }

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
