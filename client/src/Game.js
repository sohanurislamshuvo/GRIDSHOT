import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { GameLoop } from './core/GameLoop.js';
import { AssetManager } from './core/AssetManager.js';
import { WorldBuilder } from './world/WorldBuilder.js';
import { InputManager } from './systems/InputManager.js';
import { NetworkManager } from './systems/NetworkManager.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ClientPlayer } from './entities/ClientPlayer.js';
import { ClientBot } from './entities/ClientBot.js';
import { ClientProjectile } from './entities/ClientProjectile.js';
import { RemotePlayer } from './entities/RemotePlayer.js';
import { ParticleSystem } from './effects/ParticleSystem.js';
import { UIManager } from './ui/UIManager.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { BotType } from 'shadow-arena-shared/entities/BotEntity.js';

const State = { MENU: 'MENU', CONNECTING: 'CONNECTING', PLAYING: 'PLAYING', GAME_OVER: 'GAME_OVER' };

export class Game {
  constructor(container, uiRoot) {
    this.container = container;
    this.uiRoot = uiRoot;
    this.state = State.MENU;
    this.gameMode = 'solo';
    this.isOnline = false;

    // Core systems
    this.renderer = new Renderer(container);
    this.assets = new AssetManager();
    this.particles = new ParticleSystem(this.renderer.scene);
    this.collision = new CollisionSystem();
    this.input = null;
    this.network = null;
    this.world = null;
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (dt) => this.renderer.render(dt)
    );

    // Entity collections
    this.player = null;
    this.playerBullets = [];
    this.botBullets = [];
    this.bots = [];
    this.remotePlayers = new Map();
    this.serverProjectiles = new Map();

    // Ability state
    this._abilities = {
      dash:   { ready: true, cooldownEnd: 0 },
      shield: { ready: true, cooldownEnd: 0 },
      radar:  { ready: true, cooldownEnd: 0 },
      heal:   { ready: true, cooldownEnd: 0 }
    };
    this._healInterval = null;

    // Stats
    this.kills = 0;
    this.deaths = 0;

    // FPS tracking
    this._fpsFrames = 0;
    this._fpsLastTime = performance.now();
    this._fpsDisplay = 0;

    // UI
    this.ui = new UIManager(uiRoot, this);

    // Start menu
    this.showMenu();
  }

  // ─── STATE MANAGEMENT ─────────────────────────────────────────────

  showMenu() {
    this.state = State.MENU;
    this.loop.stop();
    this.cleanupGame();
    this.ui.showMenu();
  }

  startGame(mode) {
    this.gameMode = mode;
    this.isOnline = mode !== 'solo';

    if (this.isOnline) {
      this.state = State.CONNECTING;
      this.ui.showConnecting();
      this.connectOnline(mode);
    } else {
      this.enterPlaying();
    }
  }

  enterPlaying() {
    this.state = State.PLAYING;

    // Build world
    this.world = new WorldBuilder(this.renderer.scene, this.assets);
    this.collision.setWallGrid(this.world.wallGrid, GameConfig.TILE_SIZE);
    this.ui.hud.setWallGrid(this.world.wallGrid);

    // Create player at center
    const spawnX = GameConfig.WORLD_WIDTH / 2;
    const spawnY = GameConfig.WORLD_HEIGHT / 2;
    this.player = new ClientPlayer(this, spawnX, spawnY);

    // Input
    this.input = new InputManager(this.renderer.getCanvas(), this.renderer.camera, this.player);

    // Camera
    this.renderer.setCameraPosition(spawnX, spawnY);

    // Reset stats
    this.kills = 0;
    this.deaths = 0;
    this._abilities = {
      dash:   { ready: true, cooldownEnd: 0 },
      shield: { ready: true, cooldownEnd: 0 },
      radar:  { ready: true, cooldownEnd: 0 },
      heal:   { ready: true, cooldownEnd: 0 }
    };

    // Mode setup
    if (this.isOnline) {
      this.setupOnlineMode();
    } else {
      this.spawnBots(5);
    }

    // Show HUD
    this.ui.showHUD(this.gameMode);

    // Start loop
    this.loop.start();
  }

  // ─── GAME LOOP ────────────────────────────────────────────────────

  update(dt) {
    if (this.state !== State.PLAYING) return;
    if (!this.player || !this.input) return;

    const input = this.input.getInput();

    // Handle view toggle (V key)
    if (input.viewToggle) {
      const newMode = this.renderer.cycleViewMode();
      this.player.setCameraMode(newMode);
      this.input.setCameraMode(newMode);
      this.ui.hud.setCameraMode(newMode);
    }

    if (this.isOnline) {
      this.updateOnline(input, dt);
    } else {
      this.updateOffline(input, dt);
    }

    // Camera follow (pass rotation + pitch for shoulder/FPP)
    if (this.player.alive) {
      this.renderer.followTarget(
        this.player.x, this.player.y,
        this.player.rotation, input.pitch
      );
    }

    // Update particles
    this.particles.update(dt);

    // Update world animations + light position
    if (this.world) {
      this.world.updateSky(dt);
      this.world.updateWater(dt);
      this.world.updateLightTarget(this.player.x, this.player.y);
    }

    // FPS counter
    this._fpsFrames++;
    const now = performance.now();
    if (now - this._fpsLastTime >= 1000) {
      this._fpsDisplay = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsLastTime = now;
      this.ui.hud.updateFPS(this._fpsDisplay);
    }

    // Alive count
    const aliveCount = 1 + this.bots.filter(b => b.alive).length +
      (this.isOnline ? this.remotePlayers.size : 0);
    this.ui.hud.updateAliveCount(aliveCount);

    // Update UI
    this.ui.updateHUD({
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      kills: this.kills,
      deaths: this.deaths,
      alive: this.player.alive,
      abilities: this.getAbilityCooldowns(),
      playerX: this.player.x,
      playerY: this.player.y,
      playerAngle: this.player.rotation
    });

    // Handle ESC
    if (input.escape) {
      this.returnToMenu();
    }
  }

  // ─── OFFLINE UPDATE ──────────────────────────────────────────────

  updateOffline(input, dt) {
    // Update player
    if (this.player.alive) {
      this.player.update(input, dt);
      this.collision.resolveEntity(this.player);

      // Shooting
      if (input.shoot) {
        const bulletData = this.player.shoot();
        if (bulletData) {
          const bullet = new ClientProjectile(this, bulletData.x, bulletData.y, bulletData.angle, true);
          this.playerBullets.push(bullet);
        }
      }

      // Abilities
      if (input.ability) {
        this.handleAbility(input.ability);
      }
    }

    // Update bots
    for (const bot of this.bots) {
      if (bot.alive) {
        bot.update(dt, this.player);
        this.collision.resolveEntity(bot);
      }
    }

    // Update projectiles and check collisions
    this.updateOfflineProjectiles(dt);

    // Clean up destroyed bullets
    this.playerBullets = this.playerBullets.filter(b => b.alive);
    this.botBullets = this.botBullets.filter(b => b.alive);
  }

  updateOfflineProjectiles(dt) {
    // Player bullets vs bots
    for (const bullet of this.playerBullets) {
      if (!bullet.alive) continue;
      bullet.update(dt);

      // Check wall collision
      if (this.collision.isInWall(bullet.x, bullet.y)) {
        // Spark burst on wall impact
        this.particles.emit(bullet.x, 10, bullet.y, {
          count: 6, speed: 100, color: 0xffcc44, lifetime: 0.15, size: 2
        });
        this.particles.emit(bullet.x, 8, bullet.y, {
          count: 3, speed: 40, color: 0x888888, lifetime: 0.3, size: 3
        });
        bullet.destroy();
        continue;
      }

      for (const bot of this.bots) {
        if (!bot.alive || !bullet.alive) continue;
        const dx = bullet.x - bot.x;
        const dz = bullet.y - bot.y;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 20) {
          const dmg = bullet.damage;
          bot.takeDamage(dmg);
          bullet.destroy();
          this.ui.hud.showHitMarker();
          // Damage number
          this._showDamageAt(bot.x, bot.y, dmg);
          if (!bot.alive) {
            this.kills++;
            this.ui.hud.addKillFeedEntry('You', bot.type || 'Bot', true);
          }
          break;
        }
      }
    }

    // Bot bullets vs player
    for (const bullet of this.botBullets) {
      if (!bullet.alive) continue;
      bullet.update(dt);

      // Check wall collision
      if (this.collision.isInWall(bullet.x, bullet.y)) {
        this.particles.emit(bullet.x, 10, bullet.y, {
          count: 6, speed: 100, color: 0xff8844, lifetime: 0.15, size: 2
        });
        this.particles.emit(bullet.x, 8, bullet.y, {
          count: 3, speed: 40, color: 0x888888, lifetime: 0.3, size: 3
        });
        bullet.destroy();
        continue;
      }

      if (!this.player.alive) continue;
      const dx = bullet.x - this.player.x;
      const dz = bullet.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 20) {
        this.player.takeDamage(bullet.damage);
        bullet.destroy();
        if (!this.player.alive) {
          this.deaths++;
          this.ui.hud.addKillFeedEntry('Bot', 'You', false);
          this.handlePlayerDeath();
        }
      }
    }
  }

  // ─── ONLINE UPDATE ───────────────────────────────────────────────

  updateOnline(input, dt) {
    if (!this.network?.connected) return;

    if (this.player.alive) {
      this.player.update(input, dt);
      this.collision.resolveEntity(this.player);
      this.network.sendInput(input);

      if (input.ability) {
        this.network.sendAbility(input.ability);
      }
    }

    // Interpolate remote players
    for (const remote of this.remotePlayers.values()) {
      remote.interpolate();
    }
  }

  connectOnline(mode) {
    this.network = new NetworkManager();
    this.network.connect();

    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      if (this.network.connected) {
        clearInterval(checkInterval);
        this.ui.showStatus(`Connected! Searching for ${mode} match...`);
        this.network.joinQueue(mode);
        this.network.onMatchStart = () => {
          this.enterPlaying();
        };
      }
      if (checkCount > 50) {
        clearInterval(checkInterval);
        this.ui.showStatus('Could not connect. Is the server running?');
        this.network.disconnect();
        this.network = null;
        setTimeout(() => this.showMenu(), 2000);
      }
    }, 100);
  }

  setupOnlineMode() {
    if (!this.network) return;
    this.network.onSnapshot = (snapshot) => this.handleSnapshot(snapshot);
    this.network.onPlayerJoined = (data) => console.log('Player joined:', data.playerId);
    this.network.onPlayerLeft = (data) => this.handlePlayerLeft(data);
    this.network.onPlayerDeath = (data) => this.handleOnlineDeath(data);
    this.network.onPlayerRespawn = (data) => this.handleOnlineRespawn(data);
    this.network.onHitConfirm = () => this.shakeCamera();
    this.network.onAbilityResult = (data) => this.handleAbilityResult(data);
    this.network.onRadarReveal = (data) => this.handleRadarReveal(data);
    this.network.onMatchEnd = (data) => this.handleMatchEnd(data);
  }

  handleSnapshot(snapshot) {
    const myState = snapshot.players.find(p => p.id === this.network.playerId);
    if (myState) {
      this.reconcileLocalPlayer(myState);
      this.player.health = myState.health;
      this.player.maxHealth = myState.maxHealth;
      this.player.alive = myState.alive;
      this.player.setShield(myState.shieldActive);
      this.kills = myState.kills;
      this.deaths = myState.deaths;
      if (!myState.alive) this.player.die();
    }

    // Remote players
    for (const pState of snapshot.players) {
      if (pState.id === this.network.playerId) continue;
      let remote = this.remotePlayers.get(pState.id);
      if (!remote) {
        remote = new RemotePlayer(this, pState.id, pState.x, pState.y, pState.team);
        this.remotePlayers.set(pState.id, remote);
      }
      remote.addSnapshot(pState);
    }

    // Remove disconnected
    for (const [id] of this.remotePlayers) {
      if (!snapshot.players.find(p => p.id === id)) {
        this.remotePlayers.get(id).destroy();
        this.remotePlayers.delete(id);
      }
    }

    // Server bots
    for (const bState of snapshot.bots) {
      let bot = this.bots.find(b => b.serverId === bState.id);
      if (!bot) {
        bot = new ClientBot(this, bState.x, bState.y, bState.type);
        bot.serverId = bState.id;
        this.bots.push(bot);
      }
      bot.setServerState(bState);
    }

    // Server projectiles
    this.syncServerProjectiles(snapshot.projectiles);
  }

  reconcileLocalPlayer(serverState) {
    if (!this.network) return;
    this.network.reconcile(serverState);
    const dx = Math.abs(this.player.x - serverState.x);
    const dy = Math.abs(this.player.y - serverState.y);
    if (dx > 50 || dy > 50) {
      this.player.x = serverState.x;
      this.player.y = serverState.y;
    } else if (dx > 3 || dy > 3) {
      this.player.x += (serverState.x - this.player.x) * 0.3;
      this.player.y += (serverState.y - this.player.y) * 0.3;
    }
  }

  syncServerProjectiles(projStates) {
    const activeIds = new Set();
    for (const pState of projStates) {
      activeIds.add(pState.id);
      let proj = this.serverProjectiles.get(pState.id);
      if (!proj) {
        const isPlayer = pState.ownerId === this.network?.playerId;
        proj = new ClientProjectile(this, pState.x, pState.y, pState.rotation, isPlayer);
        proj.serverId = pState.id;
        this.serverProjectiles.set(pState.id, proj);
      }
      proj.setPosition(pState.x, pState.y);
    }
    for (const [id, proj] of this.serverProjectiles) {
      if (!activeIds.has(id)) {
        proj.destroy();
        this.serverProjectiles.delete(id);
      }
    }
  }

  handlePlayerLeft(data) {
    const remote = this.remotePlayers.get(data.playerId);
    if (remote) {
      remote.destroy();
      this.remotePlayers.delete(data.playerId);
    }
  }

  handleOnlineDeath(data) {
    if (data.playerId === this.network?.playerId) this.player.die();
  }

  handleOnlineRespawn(data) {
    if (data.playerId === this.network?.playerId) this.player.respawn(data.x, data.y);
  }

  handleAbilityResult(data) {
    if (data.success) {
      this._abilities[data.ability].cooldownEnd = data.cooldownEnd;
      switch (data.ability) {
        case 'dash': this.activateDash(); break;
        case 'shield': this.activateShield(); break;
        case 'heal': this.activateHeal(); break;
      }
    }
  }

  handleRadarReveal(data) {
    this.ui.activateRadar(data.enemies, data.duration);
  }

  handleMatchEnd(data) {
    const isWinner = data.winner === this.network?.playerId || data.winner === this.player?.team;
    this.ui.showMatchResult(isWinner ? 'VICTORY!' : 'DEFEAT', isWinner);
    setTimeout(() => this.returnToMenu(), 3000);
  }

  shakeCamera() {
    const cam = this.renderer.camera;
    const origX = cam.position.x;
    const origZ = cam.position.z;
    const shake = () => {
      cam.position.x += (Math.random() - 0.5) * 6;
      cam.position.z += (Math.random() - 0.5) * 6;
    };
    shake();
    setTimeout(() => { shake(); }, 20);
    setTimeout(() => {
      cam.position.x = origX;
      cam.position.z = origZ;
    }, 60);
  }

  // ─── ABILITIES ───────────────────────────────────────────────────

  handleAbility(name) {
    const ability = this._abilities[name];
    if (!ability) return;
    const now = Date.now();
    if (now < ability.cooldownEnd) return;

    switch (name) {
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
  }

  activateDash() {
    if (!this.player.alive) return;
    const angle = this.player.rotation;
    const targetX = Math.max(20, Math.min(GameConfig.WORLD_WIDTH - 20,
      this.player.x + Math.cos(angle) * 200));
    const targetY = Math.max(20, Math.min(GameConfig.WORLD_HEIGHT - 20,
      this.player.y + Math.sin(angle) * 200));

    // Animate dash
    const startX = this.player.x;
    const startY = this.player.y;
    const startTime = performance.now();
    const duration = 150;

    let ghostCount = 0;
    const animateDash = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t * (2 - t);
      this.player.x = startX + (targetX - startX) * ease;
      this.player.y = startY + (targetY - startY) * ease;
      this.player.syncModel();
      // Spawn ghost trail copies
      if (ghostCount++ % 2 === 0) this.player.spawnDashGhost();
      if (t < 1) requestAnimationFrame(animateDash);
    };
    animateDash();
  }

  activateShield() {
    if (!this.player.alive) return;
    this.player.setShield(true);
    setTimeout(() => this.player.setShield(false), 3000);
  }

  activateRadar() {
    if (!this.player.alive) return;
    const enemies = this.bots.filter(b => b.alive).map(b => ({ x: b.x, y: b.y, type: b.type }));
    this.ui.activateRadar(enemies, 5000);
  }

  activateHeal() {
    if (!this.player.alive) return;
    const totalHeal = 50;
    const ticks = 5;
    const healPerTick = totalHeal / ticks;
    let tickCount = 0;

    this.player.setHealTint(true);
    if (this._healInterval) clearInterval(this._healInterval);
    this._healInterval = setInterval(() => {
      tickCount++;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + healPerTick);
      if (tickCount >= ticks) {
        clearInterval(this._healInterval);
        this._healInterval = null;
        this.player.setHealTint(false);
      }
    }, 1000);
  }

  handlePlayerDeath() {
    setTimeout(() => {
      this.player.respawn(GameConfig.WORLD_WIDTH / 2, GameConfig.WORLD_HEIGHT / 2);
    }, GameConfig.PLAYER_RESPAWN_TIME);
  }

  getAbilityCooldowns() {
    const now = Date.now();
    const cooldowns = {};
    const totals = { dash: 5000, shield: 15000, radar: 20000, heal: 30000 };
    for (const [name, ability] of Object.entries(this._abilities)) {
      cooldowns[name] = {
        remaining: Math.max(0, ability.cooldownEnd - now),
        total: totals[name],
        ready: now >= ability.cooldownEnd
      };
    }
    return cooldowns;
  }

  // ─── DAMAGE NUMBERS ─────────────────────────────────────────────

  _showDamageAt(worldX, worldY, damage) {
    const vec = new THREE.Vector3(worldX, 15, worldY);
    vec.project(this.renderer.camera);
    if (vec.z > 1) return; // Behind camera
    const screenX = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-vec.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.hud.showDamageNumber(damage, screenX, screenY);
  }

  // ─── BOT SPAWNING ───────────────────────────────────────────────

  spawnBots(count) {
    const margin = 100;
    for (let i = 0; i < count; i++) {
      const x = margin + Math.random() * (GameConfig.WORLD_WIDTH - margin * 2);
      const y = margin + Math.random() * (GameConfig.WORLD_HEIGHT - margin * 2);
      const bot = new ClientBot(this, x, y, BotType.GRUNT);
      this.bots.push(bot);
    }
  }

  spawnBotBullet(x, y, angle, damage) {
    const bullet = new ClientProjectile(this, x, y, angle, false);
    bullet.damage = damage;
    this.botBullets.push(bullet);
  }

  // ─── CLEANUP ─────────────────────────────────────────────────────

  returnToMenu() {
    this.cleanupGame();
    this.showMenu();
  }

  cleanupGame() {
    this.loop.stop();
    if (this._healInterval) { clearInterval(this._healInterval); this._healInterval = null; }
    if (this.player) { this.player.destroy(); this.player = null; }
    for (const b of this.playerBullets) b.destroy();
    for (const b of this.botBullets) b.destroy();
    for (const b of this.bots) b.destroy();
    for (const r of this.remotePlayers.values()) r.destroy();
    for (const p of this.serverProjectiles.values()) p.destroy();
    this.playerBullets = [];
    this.botBullets = [];
    this.bots = [];
    this.remotePlayers.clear();
    this.serverProjectiles.clear();
    if (this.world) { this.world.destroy(); this.world = null; }
    if (this.input) { this.input.destroy(); this.input = null; }
    if (this.network) { this.network.disconnect(); this.network = null; }
    this.particles.clear();
  }
}
