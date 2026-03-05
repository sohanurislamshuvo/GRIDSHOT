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
import { ProjectilePool } from './effects/ProjectilePool.js';
import { UIManager } from './ui/UIManager.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { getMapConfig } from 'shadow-arena-shared/config/MapConfig.js';
import { WeaponType } from 'shadow-arena-shared/config/WeaponConfig.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { BotType } from 'shadow-arena-shared/entities/BotEntity.js';
import { PickupType, PickupConfig } from 'shadow-arena-shared/entities/PickupEntity.js';
import { DestructibleType, DestructibleConfig } from 'shadow-arena-shared/entities/DestructibleEntity.js';
import { TrailConfig } from 'shadow-arena-shared/config/CosmeticConfig.js';
import { ClientPickup } from './entities/ClientPickup.js';

const State = { MENU: 'MENU', LOBBY: 'LOBBY', CONNECTING: 'CONNECTING', PLAYING: 'PLAYING', SKYDIVING: 'SKYDIVING', GAME_OVER: 'GAME_OVER' };

export class Game {
  constructor(container, uiRoot) {
    this.container = container;
    this.uiRoot = uiRoot;
    this.state = State.MENU;
    this.gameMode = 'solo';
    this.mapId = 'arena';
    this.mapConfig = getMapConfig('arena');
    this.isOnline = false;

    // Core systems
    this.renderer = new Renderer(container);
    this.assets = new AssetManager();
    this.particles = new ParticleSystem(
      this.renderer.scene,
      this.renderer.isMobile() ? 200 : 600
    );
    this.collision = new CollisionSystem();
    this.projectilePool = null;
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
    this.clientPickups = new Map();  // id -> ClientPickup
    this.clientDestructibles = new Map(); // id -> { mesh, type, alive }

    // BR zone state
    this._brZone = null;
    this._brZoneMesh = null;
    this._brAliveCount = 0;

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

    // Player profile / cosmetics
    this.playerLevel = 1;
    this.equippedSkin = 'default';
    this.equippedTrail = 'none';
    this.unlockedAchievements = [];

    // Load saved cosmetics from localStorage
    this._loadSavedProfile();

    // UI
    this.ui = new UIManager(uiRoot, this);

    // Start menu
    this.showMenu();
  }

  _loadSavedProfile() {
    const token = localStorage.getItem('sa_token');
    const playerId = localStorage.getItem('sa_playerId');
    if (token && playerId) {
      // Fetch cosmetics and achievements from server
      fetch(`/api/player/${playerId}/cosmetics`)
        .then(r => r.json())
        .then(data => {
          if (data.equippedSkin) this.equippedSkin = data.equippedSkin;
          if (data.equippedTrail) this.equippedTrail = data.equippedTrail;
        }).catch(() => {});
      fetch(`/api/player/${playerId}/achievements`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            this.unlockedAchievements = data.filter(a => a.unlocked).map(a => a.id);
          }
        }).catch(() => {});
      fetch(`/api/player/${playerId}/stats`)
        .then(r => r.json())
        .then(data => {
          if (data.level) this.playerLevel = data.level;
        }).catch(() => {});
    }
  }

  // ─── STATE MANAGEMENT ─────────────────────────────────────────────

  showMenu() {
    this.state = State.MENU;
    this.loop.stop();
    this.cleanupGame();
    this.ui.showMenu();
  }

  startGame(mode, mapId = 'arena') {
    this.gameMode = mode;
    this.mapId = mapId;
    this.mapConfig = getMapConfig(mapId);
    this.isOnline = mode !== 'solo';

    if (this.isOnline) {
      this.state = State.LOBBY;
      this.ui.showLobby(mode);
    } else {
      this.enterPlaying();
    }
  }

  async enterPlaying() {
    this.state = State.PLAYING;

    // Show loading screen
    this.ui.showLoading();

    // Build world asynchronously (pass renderer for quality-aware building)
    this.world = new WorldBuilder(this.renderer.scene, this.assets, this.renderer, this.mapConfig);
    await this.world.build((step, progress) => {
      this.ui.updateLoadingProgress(step, progress);
    });
    this.collision.setWallGrid(this.world.wallGrid, this.mapConfig.tileSize);
    this.ui.hud.setWallGrid(this.world.wallGrid);

    // Projectile pool (InstancedMesh for all bullets)
    this.projectilePool = new ProjectilePool(this.renderer.scene, this.assets);

    // Create player at center
    const spawnX = this.mapConfig.width / 2;
    const spawnY = this.mapConfig.height / 2;

    // Set trail config for particle effects
    this._trailConfig = TrailConfig[this.equippedTrail] || TrailConfig.none;

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
      this.spawnOfflinePickups();
    }

    // Hide loading, show HUD
    this.ui.hideLoading();
    this.ui.showHUD(this.gameMode);

    // Start loop
    this.loop.start();
  }

  // ─── GAME LOOP ────────────────────────────────────────────────────

  update(dt) {
    // Handle skydive state
    if (this.state === State.SKYDIVING) {
      this.updateSkydive(dt);
      return;
    }

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

    // Handle weapon switching (number keys 1-5 or scroll wheel)
    this._handleWeaponSwitch(input);

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

    // Flush projectile pool (single InstancedMesh update for all bullets)
    if (this.projectilePool) this.projectilePool.flush();

    // Update particles
    this.particles.update(dt);

    // Update pickups (floating/rotating animation)
    for (const cp of this.clientPickups.values()) {
      cp.update(dt);
    }

    // Update world animations + light position + day/night cycle
    if (this.world) {
      this.world.updateTimeOfDay(dt);
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
        const bullets = this.player.shoot();
        if (bullets) {
          for (const b of bullets) {
            const bullet = new ClientProjectile(this, b.x, b.y, b.angle, true, b.weaponType);
            this.playerBullets.push(bullet);
          }
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

    // Check pickup collisions
    this.checkOfflinePickups();
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

  connectAndCreateRoom(mode) {
    if (this.network) { this.network.disconnect(); }
    this.network = new NetworkManager();
    this._setupLobbyCallbacks();
    this.network.connect();
    this._waitForConnection(() => this.network.createRoom(mode, this.mapId));
  }

  connectAndJoinRoom(code, mode) {
    if (this.network) { this.network.disconnect(); }
    this.network = new NetworkManager();
    this._setupLobbyCallbacks();
    this.network.connect();
    this._waitForConnection(() => this.network.joinRoom(code));
  }

  hostStartMatch() {
    if (!this.network?.connected) return;
    this.network.requestStartMatch();
  }

  leaveLobby() {
    if (this.network) { this.network.disconnect(); this.network = null; }
    this.ui.showLobby(this.gameMode);
  }

  _setupLobbyCallbacks() {
    this.network.onRoomCreated = (data) => {
      this.ui.lobby.showLobby(data.code, data.players, data.maxPlayers, data.isHost);
    };
    this.network.onRoomJoined = (data) => {
      this.ui.lobby.showLobby(data.code, data.players, data.maxPlayers, data.isHost);
    };
    this.network.onRoomUpdate = (data) => {
      this.ui.lobby.updatePlayers(data.players, data.maxPlayers);
    };
    this.network.onJoinFailed = (data) => {
      this.ui.lobby.showError(data.reason);
      this.network.disconnect();
      this.network = null;
    };
    this.network.onMatchStart = () => {
      this.enterPlaying();
    };
  }

  _waitForConnection(callback) {
    let checkCount = 0;
    const check = setInterval(() => {
      checkCount++;
      if (this.network?.connected) {
        clearInterval(check);
        callback();
      }
      if (checkCount > 50) {
        clearInterval(check);
        this.ui.lobby.showError('Could not connect. Is the server running?');
        this.network?.disconnect();
        this.network = null;
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
    this.network.onZoneUpdate = (data) => this.handleZoneUpdate(data);
    this.network.onBREliminated = (data) => this.handleBREliminated(data);
    this.network.onFlagUpdate = (data) => this.handleFlagUpdate(data);
    this.network.onHillUpdate = (data) => this.handleHillUpdate(data);
    this.network.onAchievementUnlocked = (data) => {
      this.ui.achievementToast.show(data);
      if (!this.unlockedAchievements.includes(data.id)) {
        this.unlockedAchievements.push(data.id);
      }
    };

    // Authenticate socket if logged in
    const playerId = localStorage.getItem('sa_playerId');
    const username = localStorage.getItem('sa_username');
    if (playerId && username) {
      this.network.authenticate(playerId, username);
    }
  }

  handleSnapshot(snapshot) {
    const myState = snapshot.players.find(p => p.id === this.network.playerId);
    if (myState) {
      this.reconcileLocalPlayer(myState);
      this.player.health = myState.health;
      this.player.maxHealth = myState.maxHealth;
      this.player.alive = myState.alive;
      this.player.setShield(myState.shieldActive);
      if (myState.weaponType && myState.weaponType !== this.player.weaponType) {
        this.player.setWeapon(myState.weaponType);
        this.ui.hud.setWeapon(myState.weaponType);
      }
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

    // Remove disconnected (only on full snapshots, not deltas)
    if (!snapshot.delta) {
      for (const [id] of this.remotePlayers) {
        if (!snapshot.players.find(p => p.id === id)) {
          this.remotePlayers.get(id).destroy();
          this.remotePlayers.delete(id);
        }
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

    // Server pickups
    if (snapshot.pickups) {
      this.syncPickups(snapshot.pickups);
    }

    // Server destructibles
    if (snapshot.destructibles) {
      this.syncDestructibles(snapshot.destructibles);
    }
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
        proj = new ClientProjectile(this, pState.x, pState.y, pState.rotation, isPlayer, pState.weaponType || 'auto_rifle');
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

  syncPickups(pickupStates) {
    const activeIds = new Set();
    for (const ps of pickupStates) {
      activeIds.add(ps.id);
      let cp = this.clientPickups.get(ps.id);
      if (!cp) {
        cp = new ClientPickup(this.renderer.scene, ps.id, ps.x, ps.y, ps.pickupType);
        this.clientPickups.set(ps.id, cp);
      }
      cp.setAlive(ps.alive);
    }
    // Remove pickups no longer in snapshot
    for (const [id, cp] of this.clientPickups) {
      if (!activeIds.has(id)) {
        cp.destroy();
        this.clientPickups.delete(id);
      }
    }
  }

  syncDestructibles(destStates) {
    for (const ds of destStates) {
      let cd = this.clientDestructibles.get(ds.id);
      if (!cd) {
        // Create 3D mesh for destructible
        const isCrate = ds.type === 'crate';
        const geo = isCrate
          ? new THREE.BoxGeometry(12, 12, 12)
          : new THREE.CylinderGeometry(6, 6, 16, 8);
        const color = isCrate ? 0x8B6914 : 0x555555;
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(ds.x, isCrate ? 6 : 8, ds.y);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.renderer.scene.add(mesh);
        cd = { mesh, type: ds.type, alive: true };
        this.clientDestructibles.set(ds.id, cd);
      }
      if (ds.alive !== cd.alive) {
        cd.alive = ds.alive;
        cd.mesh.visible = ds.alive;
        if (!ds.alive) {
          // Destruction particles
          this.particles.emit(ds.x, 8, ds.y, {
            count: 10, speed: 80, color: ds.type === 'crate' ? 0x8B6914 : 0x555555, lifetime: 0.4, size: 2
          });
        }
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

  handleZoneUpdate(data) {
    this._brZone = { x: data.x, y: data.y, radius: data.radius, shrinking: data.shrinking };

    // Create or update zone ring mesh
    if (!this._brZoneMesh) {
      const ringGeo = new THREE.RingGeometry(1, 1.05, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff4444, transparent: true, opacity: 0.3,
        side: THREE.DoubleSide, depthWrite: false
      });
      this._brZoneMesh = new THREE.Mesh(ringGeo, ringMat);
      this._brZoneMesh.rotation.x = -Math.PI / 2;
      this._brZoneMesh.position.y = 1;
      this.renderer.scene.add(this._brZoneMesh);
    }

    // Scale the ring to match zone radius
    this._brZoneMesh.position.set(data.x, 1, data.y);
    this._brZoneMesh.scale.set(data.radius, data.radius, 1);

    // Update minimap zone indicator
    if (this.ui.hud && this.ui.hud.updateZone) {
      this.ui.hud.updateZone(data.x, data.y, data.radius);
    }
  }

  handleBREliminated(data) {
    this._brAliveCount = data.remaining;
    if (this.ui.hud && this.ui.hud.updateAliveCount) {
      this.ui.hud.updateAliveCount(data.remaining);
    }
  }

  handleFlagUpdate(data) {
    // Render flag positions on minimap and in 3D
    if (this.ui.hud && this.ui.hud.updateFlags) {
      this.ui.hud.updateFlags(data.flags, data.scores);
    }

    // Create/update 3D flag meshes
    if (!this._flagMeshes) {
      this._flagMeshes = {};
      for (const team of ['red', 'blue']) {
        const color = team === 'red' ? 0xff4444 : 0x4488ff;
        const poleGeo = new THREE.CylinderGeometry(0.8, 0.8, 40, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.5 });
        const pole = new THREE.Mesh(poleGeo, poleMat);

        const flagGeo = new THREE.PlaneGeometry(12, 8);
        const flagMat = new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 1.0,
          side: THREE.DoubleSide, transparent: true, opacity: 0.8
        });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(6, 14, 0);

        const group = new THREE.Group();
        group.add(pole);
        group.add(flag);
        this.renderer.scene.add(group);
        this._flagMeshes[team] = group;
      }
    }

    for (const team of ['red', 'blue']) {
      const fd = data.flags[team];
      const mesh = this._flagMeshes[team];
      mesh.position.set(fd.x, 20, fd.y);
      mesh.visible = !fd.carrier; // Hide when being carried (attached to player)
    }
  }

  handleHillUpdate(data) {
    if (this.ui.hud && this.ui.hud.updateHill) {
      this.ui.hud.updateHill(data.x, data.y, data.radius, data.controlling, data.scores);
    }

    // Create/update hill zone mesh in 3D
    if (!this._hillMesh) {
      const hillGeo = new THREE.RingGeometry(1, 1.02, 48);
      const hillMat = new THREE.MeshBasicMaterial({
        color: 0xffff44, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide, depthWrite: false
      });
      this._hillMesh = new THREE.Mesh(hillGeo, hillMat);
      this._hillMesh.rotation.x = -Math.PI / 2;
      this._hillMesh.position.y = 0.5;
      this.renderer.scene.add(this._hillMesh);
    }

    this._hillMesh.position.set(data.x, 0.5, data.y);
    this._hillMesh.scale.set(data.radius, data.radius, 1);

    // Color based on controlling team
    if (data.controlling === 'red') {
      this._hillMesh.material.color.setHex(0xff4444);
    } else if (data.controlling === 'blue') {
      this._hillMesh.material.color.setHex(0x4488ff);
    } else {
      this._hillMesh.material.color.setHex(0xffff44); // neutral
    }
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

  // ─── WEAPON SWITCHING ──────────────────────────────────────────

  _handleWeaponSwitch(input) {
    if (!this.player || !this.player.alive) return;

    const weaponList = [
      WeaponType.AUTO_RIFLE,
      WeaponType.PISTOL,
      WeaponType.SMG,
      WeaponType.SHOTGUN,
      WeaponType.SNIPER
    ];

    let newWeapon = null;

    // Number keys 1-5
    if (input.weaponSwitch >= 1 && input.weaponSwitch <= 5) {
      newWeapon = weaponList[input.weaponSwitch - 1];
    }

    // Scroll wheel
    if (input.scrollSwitch) {
      this.player.cycleWeapon(input.scrollSwitch);
      newWeapon = this.player.weaponType;
    }

    if (newWeapon && newWeapon !== this.player.weaponType) {
      this.player.setWeapon(newWeapon);
    }

    if (newWeapon) {
      this.ui.hud.setWeapon(this.player.weaponType);
      if (this.isOnline && this.network?.connected) {
        this.network.sendWeaponSwitch(this.player.weaponType);
      }
    }
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
    const targetX = Math.max(20, Math.min(this.mapConfig.width - 20,
      this.player.x + Math.cos(angle) * 200));
    const targetY = Math.max(20, Math.min(this.mapConfig.height - 20,
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
    // Show "RESPAWNING..." for 2s, then enter skydive
    setTimeout(() => this.enterSkydive(), 2000);
  }

  // ─── SKYDIVE RESPAWN ────────────────────────────────────────────

  enterSkydive() {
    this.state = State.SKYDIVING;
    this._skydiveX = this.mapConfig.width / 2;
    this._skydiveZ = this.mapConfig.height / 2;
    this._skydiveDescending = false;
    this._descentStart = 0;
    this._descentDuration = 1500; // 1.5s descent

    // Listen for click/space to land
    this._skydiveLandHandler = (e) => {
      if (e.type === 'mousedown' && e.button === 0) this.beginDescent();
      if (e.type === 'keydown' && e.code === 'Space') this.beginDescent();
    };
    window.addEventListener('mousedown', this._skydiveLandHandler);
    window.addEventListener('keydown', this._skydiveLandHandler);

    // Show skydive HUD
    this.ui.hud.showSkydive();
    if (this.world) this.world.showLandingMarker(this._skydiveX, this._skydiveZ);
  }

  updateSkydive(dt) {
    if (!this.input) return;
    const input = this.input.getInput();

    // Handle ESC during skydive
    if (input.escape) {
      this._cleanupSkydive();
      this.returnToMenu();
      return;
    }

    // Keep world animating
    this.particles.update(dt);
    if (this.world) {
      this.world.updateSky(dt);
      this.world.updateWater(dt);
    }

    // Descending animation
    if (this._skydiveDescending) {
      const elapsed = performance.now() - this._descentStart;
      const progress = Math.min(elapsed / this._descentDuration, 1);
      this.renderer.descendCamera(this._skydiveX, this._skydiveZ, progress);
      this.ui.hud.updateSkydiveAlt(Math.round(1200 * (1 - progress)));

      if (progress >= 1) {
        this._finishLanding();
      }
      return;
    }

    // Move landing position with WASD
    const speed = 400;
    const margin = 100;
    if (input.up) this._skydiveZ -= speed * dt;
    if (input.down) this._skydiveZ += speed * dt;
    if (input.left) this._skydiveX -= speed * dt;
    if (input.right) this._skydiveX += speed * dt;

    // Clamp to world bounds
    this._skydiveX = Math.max(margin, Math.min(this.mapConfig.width - margin, this._skydiveX));
    this._skydiveZ = Math.max(margin, Math.min(this.mapConfig.height - margin, this._skydiveZ));

    // Update camera and marker
    this.renderer.followSkydive(this._skydiveX, this._skydiveZ);
    if (this.world) this.world.showLandingMarker(this._skydiveX, this._skydiveZ);
    this.ui.hud.updateSkydiveAlt(1200);
  }

  beginDescent() {
    if (this._skydiveDescending) return;
    this._skydiveDescending = true;
    this._descentStart = performance.now();
  }

  _finishLanding() {
    // Respawn player at chosen position
    this.player.respawn(this._skydiveX, this._skydiveZ);
    this.state = State.PLAYING;

    // Clean up skydive
    this._cleanupSkydive();
    this.ui.hud.hideSkydive();
    if (this.world) this.world.hideLandingMarker();

    // Reset camera to TPP
    this.renderer.setCameraPosition(this._skydiveX, this._skydiveZ);
  }

  _cleanupSkydive() {
    if (this._skydiveLandHandler) {
      window.removeEventListener('mousedown', this._skydiveLandHandler);
      window.removeEventListener('keydown', this._skydiveLandHandler);
      this._skydiveLandHandler = null;
    }
    this.ui.hud.hideSkydive();
    if (this.world) this.world.hideLandingMarker();
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
      const x = margin + Math.random() * (this.mapConfig.width - margin * 2);
      const y = margin + Math.random() * (this.mapConfig.height - margin * 2);
      const bot = new ClientBot(this, x, y, BotType.GRUNT);
      this.bots.push(bot);
    }
  }

  spawnOfflinePickups() {
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;
    const defs = [
      { type: PickupType.WEAPON_SMG,     x: W * 0.25, y: H * 0.25 },
      { type: PickupType.WEAPON_SHOTGUN, x: W * 0.75, y: H * 0.25 },
      { type: PickupType.WEAPON_SNIPER,  x: W * 0.5,  y: H * 0.15 },
      { type: PickupType.WEAPON_SMG,     x: W * 0.25, y: H * 0.75 },
      { type: PickupType.WEAPON_SHOTGUN, x: W * 0.75, y: H * 0.75 },
      { type: PickupType.WEAPON_SNIPER,  x: W * 0.5,  y: H * 0.85 },
      { type: PickupType.HEALTH, x: W * 0.35, y: H * 0.5 },
      { type: PickupType.HEALTH, x: W * 0.65, y: H * 0.5 },
      { type: PickupType.HEALTH, x: W * 0.5,  y: H * 0.35 },
      { type: PickupType.HEALTH, x: W * 0.5,  y: H * 0.65 },
      { type: PickupType.SHIELD, x: W * 0.15, y: H * 0.5 },
      { type: PickupType.SHIELD, x: W * 0.85, y: H * 0.5 },
    ];
    let idCounter = 0;
    for (const d of defs) {
      const id = `pickup_${idCounter++}`;
      const cp = new ClientPickup(this.renderer.scene, id, d.x, d.y, d.type);
      cp._pickupType = d.type;
      cp._respawnAt = 0;
      this.clientPickups.set(id, cp);
    }
  }

  checkOfflinePickups() {
    if (!this.player || !this.player.alive) return;
    const px = this.player.x;
    const py = this.player.y;
    const pr = this.player.radius;

    for (const [id, cp] of this.clientPickups) {
      if (!cp.alive) {
        // Check respawn (30 seconds)
        if (cp._respawnAt && performance.now() >= cp._respawnAt) {
          cp.setAlive(true);
          cp._respawnAt = 0;
        }
        continue;
      }
      const dx = px - cp.x;
      const dy = py - cp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20 + pr) {
        const config = PickupConfig[cp._pickupType];
        if (config.weaponType) {
          this.player.setWeapon(config.weaponType);
          this.ui.hud.setWeapon(config.weaponType);
        }
        if (config.healAmount > 0) {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + config.healAmount);
        }
        if (config.shieldDuration > 0) {
          this.player.setShield(true);
          setTimeout(() => { if (this.player) this.player.setShield(false); }, config.shieldDuration);
        }
        // Pickup effect particles
        this.particles.emit(cp.x, 15, cp.y, {
          count: 10, speed: 60, color: config.color, lifetime: 0.4, size: 2
        });
        cp.setAlive(false);
        cp._respawnAt = performance.now() + 30000;
      }
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
    for (const cp of this.clientPickups.values()) cp.destroy();
    for (const cd of this.clientDestructibles.values()) {
      this.renderer.scene.remove(cd.mesh);
      cd.mesh.geometry.dispose();
      cd.mesh.material.dispose();
    }
    this.playerBullets = [];
    this.botBullets = [];
    this.bots = [];
    this.remotePlayers.clear();
    this.serverProjectiles.clear();
    this.clientPickups.clear();
    this.clientDestructibles.clear();
    if (this._brZoneMesh) {
      this.renderer.scene.remove(this._brZoneMesh);
      this._brZoneMesh.geometry.dispose();
      this._brZoneMesh.material.dispose();
      this._brZoneMesh = null;
    }
    this._brZone = null;
    this._brAliveCount = 0;
    if (this._flagMeshes) {
      for (const team of ['red', 'blue']) {
        if (this._flagMeshes[team]) {
          this.renderer.scene.remove(this._flagMeshes[team]);
          this._flagMeshes[team].traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
        }
      }
      this._flagMeshes = null;
    }
    if (this._hillMesh) {
      this.renderer.scene.remove(this._hillMesh);
      this._hillMesh.geometry.dispose();
      this._hillMesh.material.dispose();
      this._hillMesh = null;
    }
    if (this.projectilePool) { this.projectilePool.destroy(); this.projectilePool = null; }
    if (this.world) { this.world.destroy(); this.world = null; }
    if (this.input) { this.input.destroy(); this.input = null; }
    if (this.network) { this.network.disconnect(); this.network = null; }
    this.particles.clear();
  }
}
