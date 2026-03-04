import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { ClientPlayer } from '../entities/ClientPlayer.js';
import { ClientProjectile } from '../entities/ClientProjectile.js';
import { ClientBot } from '../entities/ClientBot.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { InputManager } from '../systems/InputManager.js';
import { NetworkManager } from '../systems/NetworkManager.js';
import { BotType } from 'shadow-arena-shared/entities/BotEntity.js';
import { randomInRange } from 'shadow-arena-shared/utils/Vector2.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.gameMode = data.mode || 'solo';
    this.isOnline = data.mode !== 'solo'; // solo = offline, others = online
    this.networkManager = data.networkManager || null;
  }

  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, GameConfig.WORLD_WIDTH, GameConfig.WORLD_HEIGHT);

    // Create tilemap
    this.createArenaMap();

    // Create player
    const spawnX = GameConfig.WORLD_WIDTH / 2;
    const spawnY = GameConfig.WORLD_HEIGHT / 2;
    this.player = new ClientPlayer(this, spawnX, spawnY);

    // Collections
    this.playerBullets = [];
    this.botBullets = [];
    this.bots = [];
    this.remotePlayers = new Map(); // id -> RemotePlayer
    this.serverProjectiles = new Map(); // id -> ClientProjectile

    // Input
    this.inputManager = new InputManager(this);

    // Camera
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, GameConfig.WORLD_WIDTH, GameConfig.WORLD_HEIGHT);
    this.cameras.main.setDeadzone(100, 100);

    // Wall collision for player
    if (this.wallLayer) {
      this.physics.add.collider(this.player.sprite, this.wallLayer);
    }

    // Ability state
    this._abilities = {
      dash:   { ready: true, cooldownEnd: 0 },
      shield: { ready: true, cooldownEnd: 0 },
      radar:  { ready: true, cooldownEnd: 0 },
      heal:   { ready: true, cooldownEnd: 0 }
    };

    // Stats
    this.kills = 0;
    this.deaths = 0;

    // Mode setup
    if (this.isOnline) {
      this.setupOnlineMode();
    } else {
      this.spawnBots(5);
    }

    // Launch UI
    this.scene.launch('UIScene', { gameScene: this, mode: this.gameMode });

    // ESC to return to menu
    this.input.keyboard.on('keydown-ESC', () => this.returnToMenu());
  }

  // ─── ONLINE MODE SETUP ────────────────────────────────────────────

  setupOnlineMode() {
    if (!this.networkManager) return;
    const net = this.networkManager;

    net.onSnapshot = (snapshot) => this.handleSnapshot(snapshot);
    net.onPlayerJoined = (data) => this.handlePlayerJoined(data);
    net.onPlayerLeft = (data) => this.handlePlayerLeft(data);
    net.onPlayerDeath = (data) => this.handleOnlineDeath(data);
    net.onPlayerRespawn = (data) => this.handleOnlineRespawn(data);
    net.onHitConfirm = (data) => this.handleHitConfirm(data);
    net.onAbilityResult = (data) => this.handleAbilityResult(data);
    net.onRadarReveal = (data) => this.handleRadarReveal(data);
    net.onMatchEnd = (data) => this.handleMatchEnd(data);
  }

  handleSnapshot(snapshot) {
    // Update local player from server (reconciliation)
    const myState = snapshot.players.find(p => p.id === this.networkManager.playerId);
    if (myState) {
      this.reconcileLocalPlayer(myState);
      this.player.health = myState.health;
      this.player.maxHealth = myState.maxHealth;
      this.player.alive = myState.alive;
      this.player.shieldActive = myState.shieldActive;
      this.player.setShield(myState.shieldActive);
      this.kills = myState.kills;
      this.deaths = myState.deaths;

      if (!myState.alive) {
        this.player.die();
      }
    }

    // Update remote players
    for (const pState of snapshot.players) {
      if (pState.id === this.networkManager.playerId) continue;

      let remote = this.remotePlayers.get(pState.id);
      if (!remote) {
        remote = new RemotePlayer(this, pState.id, pState.x, pState.y, pState.team);
        this.remotePlayers.set(pState.id, remote);
      }
      remote.addSnapshot(pState);
    }

    // Remove disconnected remote players
    for (const [id, remote] of this.remotePlayers.entries()) {
      if (!snapshot.players.find(p => p.id === id)) {
        remote.destroy();
        this.remotePlayers.delete(id);
      }
    }

    // Update server bots (render only)
    for (const bState of snapshot.bots) {
      let bot = this.bots.find(b => b.serverId === bState.id);
      if (!bot) {
        bot = new ClientBot(this, bState.x, bState.y, bState.type);
        bot.serverId = bState.id;
        if (this.wallLayer) {
          this.physics.add.collider(bot.sprite, this.wallLayer);
        }
        this.bots.push(bot);
      }
      // Update bot from server state
      bot.sprite.setPosition(bState.x, bState.y);
      bot.sprite.setRotation(bState.rotation);
      bot.health = bState.health;
      bot.maxHealth = bState.maxHealth;
      bot.alive = bState.alive;
      bot.sprite.setVisible(bState.alive);
      if (bState.alive) bot.drawHealthBar();
      else bot.healthBar.clear();
    }

    // Update server projectiles
    this.syncServerProjectiles(snapshot.projectiles);
  }

  reconcileLocalPlayer(serverState) {
    if (!this.networkManager) return;

    // Get unprocessed inputs
    const pending = this.networkManager.reconcile(serverState);

    // Set to server position
    const dx = Math.abs(this.player.sprite.x - serverState.x);
    const dy = Math.abs(this.player.sprite.y - serverState.y);

    if (dx > 50 || dy > 50) {
      // Snap if too far off
      this.player.sprite.setPosition(serverState.x, serverState.y);
    } else if (dx > 3 || dy > 3) {
      // Lerp for small corrections
      this.player.sprite.x = Phaser.Math.Linear(this.player.sprite.x, serverState.x, 0.3);
      this.player.sprite.y = Phaser.Math.Linear(this.player.sprite.y, serverState.y, 0.3);
    }
  }

  syncServerProjectiles(projStates) {
    const activeIds = new Set();

    for (const pState of projStates) {
      activeIds.add(pState.id);

      let proj = this.serverProjectiles.get(pState.id);
      if (!proj) {
        const isPlayer = pState.ownerId === this.networkManager?.playerId;
        proj = new ClientProjectile(this, pState.x, pState.y, pState.rotation, isPlayer);
        proj.serverId = pState.id;
        this.serverProjectiles.set(pState.id, proj);
      }
      // Update position from server
      proj.sprite.setPosition(pState.x, pState.y);
    }

    // Remove projectiles no longer on server
    for (const [id, proj] of this.serverProjectiles.entries()) {
      if (!activeIds.has(id)) {
        proj.destroy();
        this.serverProjectiles.delete(id);
      }
    }
  }

  handlePlayerJoined(data) {
    console.log('Player joined:', data.playerId);
  }

  handlePlayerLeft(data) {
    const remote = this.remotePlayers.get(data.playerId);
    if (remote) {
      remote.destroy();
      this.remotePlayers.delete(data.playerId);
    }
  }

  handleOnlineDeath(data) {
    if (data.playerId === this.networkManager?.playerId) {
      this.player.die();
    }
  }

  handleOnlineRespawn(data) {
    if (data.playerId === this.networkManager?.playerId) {
      this.player.respawn(data.x, data.y);
    }
  }

  handleHitConfirm(data) {
    // Screen shake when local player hit
    if (data.targetId === this.networkManager?.playerId) {
      this.cameras.main.shake(100, 0.005);
    }
  }

  handleAbilityResult(data) {
    if (data.success) {
      this._abilities[data.ability].cooldownEnd = data.cooldownEnd;
      // Apply visual effect locally
      switch (data.ability) {
        case 'dash': this.visualDash(); break;
        case 'shield': this.visualShield(); break;
        case 'heal': this.visualHeal(); break;
      }
    }
  }

  handleRadarReveal(data) {
    this.events.emit('radarActivated', {
      duration: data.duration,
      bots: data.enemies
    });
  }

  handleMatchEnd(data) {
    const isWinner = data.winner === this.networkManager?.playerId ||
                     data.winner === this.player?.team;
    // Show result
    const text = isWinner ? 'VICTORY!' : 'DEFEAT';
    const color = isWinner ? '#44ff44' : '#ff4444';
    const resultText = this.add.text(
      GameConfig.VIEW_WIDTH / 2,
      GameConfig.VIEW_HEIGHT / 2,
      text,
      { fontSize: '64px', fill: color, fontFamily: 'monospace', stroke: '#000', strokeThickness: 6 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(300);

    this.time.delayedCall(3000, () => {
      resultText.destroy();
      this.returnToMenu();
    });
  }

  // ─── TILEMAP ──────────────────────────────────────────────────────

  createArenaMap() {
    const mapWidth = Math.floor(GameConfig.WORLD_WIDTH / GameConfig.TILE_SIZE);
    const mapHeight = Math.floor(GameConfig.WORLD_HEIGHT / GameConfig.TILE_SIZE);

    const floorData = [];
    const wallData = [];

    for (let y = 0; y < mapHeight; y++) {
      const floorRow = [];
      const wallRow = [];
      for (let x = 0; x < mapWidth; x++) {
        floorRow.push(0);
        if (x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1) {
          wallRow.push(0);
        } else if (this.isWallTile(x, y, mapWidth, mapHeight)) {
          wallRow.push(0);
        } else {
          wallRow.push(-1);
        }
      }
      floorData.push(floorRow);
      wallData.push(wallRow);
    }

    const map = this.make.tilemap({ data: floorData, tileWidth: GameConfig.TILE_SIZE, tileHeight: GameConfig.TILE_SIZE });
    const floorTileset = map.addTilesetImage('floor');
    map.createLayer(0, floorTileset, 0, 0).setDepth(0);

    const wallMap = this.make.tilemap({ data: wallData, tileWidth: GameConfig.TILE_SIZE, tileHeight: GameConfig.TILE_SIZE });
    const wallTileset = wallMap.addTilesetImage('wall');
    this.wallLayer = wallMap.createLayer(0, wallTileset, 0, 0);
    this.wallLayer.setDepth(1);
    this.wallLayer.setCollisionByExclusion([-1]);
    this.wallData = wallData;
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
      const distFromCenter = Math.sqrt(Math.pow(x - mapWidth / 2, 2) + Math.pow(y - mapHeight / 2, 2));
      if (distFromCenter > 10) return true;
    }

    return false;
  }

  // ─── OFFLINE BOT SPAWNING ────────────────────────────────────────

  spawnBots(count) {
    const margin = 100;
    for (let i = 0; i < count; i++) {
      const x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
      const y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
      const bot = new ClientBot(this, x, y, BotType.GRUNT);
      if (this.wallLayer) this.physics.add.collider(bot.sprite, this.wallLayer);
      this.bots.push(bot);
    }
  }

  spawnBotBullet(x, y, angle, damage) {
    const bullet = new ClientProjectile(this, x, y, angle, false);
    bullet.damage = damage;
    this.botBullets.push(bullet);
  }

  // ─── UPDATE LOOP ─────────────────────────────────────────────────

  update(time, delta) {
    const dt = delta / 1000;
    const input = this.inputManager.getInput();

    if (this.isOnline) {
      this.updateOnline(input, dt);
    } else {
      this.updateOffline(input, dt);
    }

    // Emit stats to UI
    this.events.emit('statsUpdate', {
      kills: this.kills,
      deaths: this.deaths,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      alive: this.player.alive
    });
  }

  // ─── ONLINE UPDATE ───────────────────────────────────────────────

  updateOnline(input, dt) {
    if (!this.networkManager?.connected) return;

    // Apply input locally (prediction)
    if (this.player.alive) {
      this.player.update(input, dt);

      // Send input to server
      this.networkManager.sendInput(input);

      // Handle abilities
      if (input.ability) {
        this.networkManager.sendAbility(input.ability);
      }
    }

    // Interpolate remote players
    for (const remote of this.remotePlayers.values()) {
      remote.interpolate();
    }
  }

  // ─── OFFLINE UPDATE ──────────────────────────────────────────────

  updateOffline(input, dt) {
    // Update player
    if (this.player.alive) {
      this.player.update(input, dt);

      // Shooting
      if (input.shoot) {
        const bulletData = this.player.shoot();
        if (bulletData) {
          const bullet = new ClientProjectile(this, bulletData.x, bulletData.y, bulletData.angle, true);
          this.playerBullets.push(bullet);
          if (this.wallLayer) {
            this.physics.add.collider(bullet.sprite, this.wallLayer, () => {
              this.spawnWallSparks(bullet.sprite.x, bullet.sprite.y);
              bullet.destroy();
            });
          }
        }
      }

      // Handle abilities
      if (input.ability) {
        this.handleAbility(input.ability);
      }
    }

    // Update bots (client-side AI)
    for (const bot of this.bots) {
      bot.update(dt, this.player);
    }

    // Collision detection
    this.updateOfflineProjectiles();

    // Clean up
    this.playerBullets = this.playerBullets.filter(b => b.alive);
    this.botBullets = this.botBullets.filter(b => b.alive);
  }

  updateOfflineProjectiles() {
    // Player bullets vs bots
    for (const bullet of this.playerBullets) {
      if (!bullet.alive) continue;
      bullet.update();
      for (const bot of this.bots) {
        if (!bot.alive || !bullet.alive) continue;
        const dist = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, bot.sprite.x, bot.sprite.y);
        if (dist < 20) {
          bot.takeDamage(bullet.damage);
          bullet.destroy();
          if (!bot.alive) this.kills++;
          break;
        }
      }
    }

    // Bot bullets vs player
    for (const bullet of this.botBullets) {
      if (!bullet.alive) continue;
      bullet.update();
      if (!this.player.alive) continue;
      const dist = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, this.player.sprite.x, this.player.sprite.y);
      if (dist < 20) {
        this.player.takeDamage(bullet.damage);
        bullet.destroy();
        if (!this.player.alive) {
          this.deaths++;
          this.handlePlayerDeath();
        }
      }
    }

    // Wall collision for bot bullets
    for (const bullet of this.botBullets) {
      if (!bullet.alive || !this.wallLayer) continue;
      const tx = Math.floor(bullet.sprite.x / GameConfig.TILE_SIZE);
      const ty = Math.floor(bullet.sprite.y / GameConfig.TILE_SIZE);
      if (this.wallData && this.wallData[ty] && this.wallData[ty][tx] !== -1) {
        this.spawnWallSparks(bullet.sprite.x, bullet.sprite.y);
        bullet.destroy();
      }
    }
  }

  // ─── ABILITIES ───────────────────────────────────────────────────

  handleAbility(abilityName) {
    const ability = this._abilities[abilityName];
    if (!ability) return;

    const now = Date.now();
    if (now < ability.cooldownEnd) return;

    switch (abilityName) {
      case 'dash':
        this.activateDash();
        ability.cooldownEnd = now + 5000;
        break;
      case 'shield':
        this.activateShield();
        ability.cooldownEnd = now + 15000;
        break;
      case 'radar':
        this.activateRadar();
        ability.cooldownEnd = now + 20000;
        break;
      case 'heal':
        this.activateHeal();
        ability.cooldownEnd = now + 30000;
        break;
    }

    this.events.emit('abilityUsed', { name: abilityName, cooldownEnd: ability.cooldownEnd });
  }

  activateDash() {
    if (!this.player.alive) return;
    this.visualDash();
  }

  visualDash() {
    const angle = this.player.sprite.rotation;
    const targetX = Phaser.Math.Clamp(
      this.player.sprite.x + Math.cos(angle) * 200,
      20, GameConfig.WORLD_WIDTH - 20
    );
    const targetY = Phaser.Math.Clamp(
      this.player.sprite.y + Math.sin(angle) * 200,
      20, GameConfig.WORLD_HEIGHT - 20
    );

    this.player.sprite.setAlpha(0.5);
    this.tweens.add({
      targets: this.player.sprite,
      x: targetX, y: targetY,
      duration: 150,
      ease: 'Power2',
      onComplete: () => this.player.sprite.setAlpha(1)
    });
  }

  activateShield() {
    if (!this.player.alive) return;
    this.visualShield();
  }

  visualShield() {
    this.player.setShield(true);
    this.time.delayedCall(3000, () => this.player.setShield(false));
  }

  activateRadar() {
    if (!this.player.alive) return;
    this.events.emit('radarActivated', {
      duration: 5000,
      bots: this.bots.filter(b => b.alive).map(b => ({
        x: b.sprite.x, y: b.sprite.y, type: b.type
      }))
    });
  }

  activateHeal() {
    if (!this.player.alive) return;
    this.visualHeal();
  }

  visualHeal() {
    const totalHeal = 50;
    const ticks = 5;
    const healPerTick = totalHeal / ticks;
    let tickCount = 0;

    this.player.sprite.setTint(0x88ff88);
    this.time.addEvent({
      delay: 1000,
      repeat: ticks - 1,
      callback: () => {
        tickCount++;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + healPerTick);
        if (tickCount >= ticks) this.player.sprite.clearTint();
      }
    });
  }

  handlePlayerDeath() {
    this.time.delayedCall(GameConfig.PLAYER_RESPAWN_TIME, () => {
      this.player.respawn(GameConfig.WORLD_WIDTH / 2, GameConfig.WORLD_HEIGHT / 2);
    });
  }

  // ─── VISUAL EFFECTS ─────────────────────────────────────────────

  spawnMuzzleFlash(x, y) {
    const flash = this.add.sprite(x, y, 'muzzle_flash');
    flash.setDepth(15);
    flash.setAlpha(0.9);
    flash.setScale(1.5);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 0.5,
      duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  spawnDeathExplosion(x, y, tintColor) {
    const particles = this.add.particles(x, y, 'particle_white', {
      speed: { min: 60, max: 160 },
      scale: { start: 1.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 200, max: 500 },
      tint: tintColor,
      quantity: 12,
      emitting: false,
    });
    particles.setDepth(15);
    particles.explode(12);
    this.time.delayedCall(600, () => particles.destroy());

    const flash = this.add.rectangle(x, y, 40, 40, 0xffffff, 0.5).setDepth(16);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  spawnWallSparks(x, y) {
    const particles = this.add.particles(x, y, 'particle_white', {
      speed: { min: 20, max: 80 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 200,
      tint: 0xffaa44,
      quantity: 4,
      emitting: false,
    });
    particles.setDepth(15);
    particles.explode(4);
    this.time.delayedCall(300, () => particles.destroy());
  }

  // ─── CLEANUP ─────────────────────────────────────────────────────

  returnToMenu() {
    this.bots.forEach(b => b.destroy());
    this.playerBullets.forEach(b => b.destroy());
    this.botBullets.forEach(b => b.destroy());
    this.remotePlayers.forEach(r => r.destroy());
    this.serverProjectiles.forEach(p => p.destroy());
    this.player.destroy();
    this.inputManager.destroy();

    if (this.networkManager) {
      this.networkManager.disconnect();
    }

    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }

  getAbilityCooldowns() {
    if (!this._abilities) return {};
    const now = Date.now();
    const cooldowns = {};
    for (const [name, ability] of Object.entries(this._abilities)) {
      cooldowns[name] = {
        remaining: Math.max(0, ability.cooldownEnd - now),
        total: this.getAbilityCooldownTotal(name),
        ready: now >= ability.cooldownEnd
      };
    }
    return cooldowns;
  }

  getAbilityCooldownTotal(name) {
    return { dash: 5000, shield: 15000, radar: 20000, heal: 30000 }[name] || 10000;
  }
}
