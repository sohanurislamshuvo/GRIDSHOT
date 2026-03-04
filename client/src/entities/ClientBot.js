import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { BotState, BotType } from 'shadow-arena-shared/entities/BotEntity.js';
import { distance, randomInRange } from 'shadow-arena-shared/utils/Vector2.js';
import { CharacterFactory } from './CharacterFactory.js';

const BOT_STATS = {
  [BotType.GRUNT]:  { health: 80,  speed: 120, damage: 10, shootInterval: 800,  radius: 16 },
  [BotType.FAST]:   { health: 50,  speed: 200, damage: 8,  shootInterval: 600,  radius: 14 },
  [BotType.TANK]:   { health: 200, speed: 80,  damage: 15, shootInterval: 1200, radius: 22 },
  [BotType.SNIPER]: { health: 60,  speed: 100, damage: 25, shootInterval: 1500, radius: 16 },
  [BotType.BOSS]:   { health: 500, speed: 100, damage: 20, shootInterval: 600,  radius: 32 },
};

export class ClientBot {
  constructor(game, x, y, type) {
    this.game = game;
    this.scene = game.renderer.scene;
    this.type = type;

    const stats = BOT_STATS[type] || BOT_STATS[BotType.GRUNT];
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.radius = stats.radius;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.shootInterval = stats.shootInterval;
    this.alive = true;
    this.serverId = null;

    // AI state
    this.state = BotState.PATROL;
    this.waypointX = x;
    this.waypointY = y;
    this.lastShotTime = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;

    // 3D model
    this.group = CharacterFactory.createBot(type, game.assets);
    this.group.position.set(x, 0, y);
    this.scene.add(this.group);

    // Soft shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowRadius = type === BotType.BOSS ? 30 : 14;
    const shadowGeo = new THREE.PlaneGeometry(shadowRadius * 2, shadowRadius * 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.3, y);
    this.scene.add(this.shadow);

    // For flash effect
    this._originalMaterials = [];
    this.group.traverse(child => {
      if (child.isMesh) this._originalMaterials.push({ mesh: child, material: child.material });
    });
    this._flashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0
    });

    // Walk animation
    this._walkPhase = 0;

    this._pickWaypoint();
  }

  _pickWaypoint() {
    const margin = 100;
    this.waypointX = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
    this.waypointY = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
  }

  update(dt, player) {
    if (!this.alive) return;

    const distToPlayer = distance(this.x, this.y, player.x, player.y);
    const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);

    // State transitions
    const healthPct = this.health / this.maxHealth;
    if (healthPct < GameConfig.BOT_FLEE_HEALTH_PERCENT) {
      this.state = BotState.FLEE;
    } else if (distToPlayer <= GameConfig.BOT_ATTACK_RANGE && player.alive) {
      this.state = BotState.ATTACK;
    } else if (distToPlayer <= GameConfig.BOT_DETECTION_RANGE && player.alive) {
      this.state = BotState.CHASE;
    } else {
      this.state = BotState.PATROL;
    }

    let vx = 0, vy = 0;
    switch (this.state) {
      case BotState.PATROL: {
        const distToWP = distance(this.x, this.y, this.waypointX, this.waypointY);
        if (distToWP < 20) this._pickWaypoint();
        const wpAngle = Math.atan2(this.waypointY - this.y, this.waypointX - this.x);
        vx = Math.cos(wpAngle) * this.speed * 0.5;
        vy = Math.sin(wpAngle) * this.speed * 0.5;
        this.rotation = wpAngle;
        break;
      }
      case BotState.CHASE: {
        vx = Math.cos(angleToPlayer) * this.speed;
        vy = Math.sin(angleToPlayer) * this.speed;
        this.rotation = angleToPlayer;
        break;
      }
      case BotState.ATTACK: {
        this.strafeTimer += dt;
        if (this.strafeTimer > 0.3) {
          this.strafeTimer = 0;
          this.strafeDir = -this.strafeDir;
        }
        const strafeAngle = angleToPlayer + Math.PI / 2 * this.strafeDir;
        vx = Math.cos(strafeAngle) * this.speed * 0.3;
        vy = Math.sin(strafeAngle) * this.speed * 0.3;
        this.rotation = angleToPlayer;
        this._tryShoot(angleToPlayer);
        break;
      }
      case BotState.FLEE: {
        const fleeAngle = angleToPlayer + Math.PI;
        vx = Math.cos(fleeAngle) * this.speed;
        vy = Math.sin(fleeAngle) * this.speed;
        this.rotation = fleeAngle;
        break;
      }
    }

    this.x += vx * dt;
    this.y += vy * dt;

    // Walk animation
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      this._walkPhase += dt * 8;
      const swing = Math.sin(this._walkPhase) * 0.25;
      const children = this.group.children;
      if (children[0]) children[0].position.y += swing * 1.5;
      if (children[1]) children[1].position.y -= swing * 1.5;
    }

    this.syncModel();
  }

  _tryShoot(angle) {
    const now = Date.now();
    if (now - this.lastShotTime < this.shootInterval) return;
    this.lastShotTime = now;

    const gunDist = 20;
    const bx = this.x + Math.cos(angle) * gunDist;
    const by = this.y + Math.sin(angle) * gunDist;

    // Muzzle flash
    this.game.particles.emit(bx, 14, by, {
      count: 3, speed: 40, color: 0xffaa44, lifetime: 0.06, size: 2.5
    });

    // Brief muzzle light
    const flash = new THREE.PointLight(0xff8844, 1.5, 30);
    flash.position.set(bx, 14, by);
    this.scene.add(flash);
    setTimeout(() => { this.scene.remove(flash); flash.dispose(); }, 40);

    this.game.spawnBotBullet(bx, by, angle, this.damage);
  }

  setServerState(state) {
    this.x = state.x;
    this.y = state.y;
    this.rotation = state.rotation;
    this.health = state.health;
    this.maxHealth = state.maxHealth;
    this.alive = state.alive;
    this.group.visible = state.alive;
    this.shadow.visible = state.alive;
    this.syncModel();
  }

  syncModel() {
    this.group.position.set(this.x, 0, this.y);
    this.group.rotation.y = -this.rotation + Math.PI / 2;
    this.shadow.position.set(this.x, 0.3, this.y);
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    } else {
      this._flashWhite();
      // Hit sparks
      this.game.particles.emit(this.x, 15, this.y, {
        count: 3, speed: 60, color: 0xffaa44, lifetime: 0.15, size: 1.5
      });
    }
  }

  _flashWhite() {
    this.group.traverse(child => {
      if (child.isMesh) child.material = this._flashMat;
    });
    setTimeout(() => {
      for (const { mesh, material } of this._originalMaterials) {
        mesh.material = material;
      }
    }, 80);
  }

  die() {
    this.alive = false;
    this.group.visible = false;
    this.shadow.visible = false;

    const color = GameConfig.COLORS[`BOT_${this.type}`] || GameConfig.COLORS.BOT;

    // Multi-layered death effect
    this.game.particles.emit(this.x, 15, this.y, {
      count: 15, speed: 130, color, lifetime: 0.4, size: 3
    });
    this.game.particles.emit(this.x, 8, this.y, {
      count: 8, speed: 60, color: 0xffaa44, lifetime: 0.25, size: 2
    });
    // Smoke
    this.game.particles.emit(this.x, 10, this.y, {
      count: 6, speed: 30, color: 0x555555, lifetime: 0.6, size: 4
    });

    setTimeout(() => this.respawn(), GameConfig.PLAYER_RESPAWN_TIME);
  }

  respawn() {
    const margin = 100;
    this.x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
    this.y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
    this.health = this.maxHealth;
    this.alive = true;
    this.state = BotState.PATROL;
    this.group.visible = true;
    this.shadow.visible = true;
    this._pickWaypoint();
    this.syncModel();
  }

  destroy() {
    this.scene.remove(this.group);
    this.scene.remove(this.shadow);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
    });
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
