import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { CharacterFactory } from './CharacterFactory.js';

export class ClientPlayer {
  constructor(game, x, y) {
    this.game = game;
    this.scene = game.renderer.scene;

    // Game state
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.radius = GameConfig.PLAYER_RADIUS;
    this.health = GameConfig.PLAYER_MAX_HEALTH;
    this.maxHealth = GameConfig.PLAYER_MAX_HEALTH;
    this.alive = true;
    this.speed = GameConfig.PLAYER_SPEED;
    this.shieldActive = false;

    // Shooting
    this._lastShotTime = 0;
    this._fireInterval = 1000 / GameConfig.FIRE_RATE;

    // 3D model
    this.group = CharacterFactory.createPlayer(game.assets);
    this.group.position.set(x, 0, y);
    this.scene.add(this.group);

    // Shadow (flat dark circle on ground)
    const shadowGeo = new THREE.CircleGeometry(12, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.5, y);
    this.scene.add(this.shadow);

    // Shield mesh (invisible by default)
    this.shieldMesh = new THREE.Mesh(
      game.assets.getGeometry('shield'),
      game.assets.getMaterial('shield')
    );
    this.shieldMesh.position.set(x, 15, y);
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);

    // Original materials for flash restore
    this._originalMaterials = [];
    this.group.traverse(child => {
      if (child.isMesh) this._originalMaterials.push({ mesh: child, material: child.material });
    });
    this._flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  }

  update(input, dt) {
    if (!this.alive) return;

    // Movement
    let mx = 0, my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;

    // Normalize diagonal
    if (mx !== 0 && my !== 0) {
      const inv = 1 / Math.SQRT2;
      mx *= inv;
      my *= inv;
    }

    this.x += mx * this.speed * dt;
    this.y += my * this.speed * dt;

    // Rotation (aim angle)
    this.rotation = input.angle;

    this.syncModel();

    // Movement dust particles
    if (mx !== 0 || my !== 0) {
      if (Math.random() < 0.3) {
        this.game.particles.emit(this.x, 2, this.y, {
          count: 1, speed: 20, color: 0x888888, lifetime: 0.3, size: 1.5
        });
      }
    }
  }

  syncModel() {
    this.group.position.set(this.x, 0, this.y);
    this.group.rotation.y = -this.rotation + Math.PI / 2;
    this.shadow.position.set(this.x, 0.5, this.y);
    this.shieldMesh.position.set(this.x, 15, this.y);
  }

  shoot() {
    const now = performance.now();
    if (now - this._lastShotTime < this._fireInterval) return null;
    this._lastShotTime = now;

    const gunDist = 24;
    const bx = this.x + Math.cos(this.rotation) * gunDist;
    const by = this.y + Math.sin(this.rotation) * gunDist;

    // Muzzle flash particles
    this.game.particles.emit(bx, 12, by, {
      count: 3, speed: 40, color: 0xffffaa, lifetime: 0.08, size: 3
    });

    return { x: bx, y: by, angle: this.rotation };
  }

  takeDamage(amount) {
    if (this.shieldActive) amount = Math.floor(amount * 0.2);
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    } else {
      this._flashWhite();
      this.game.shakeCamera();
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
    this.shieldMesh.visible = false;

    this.game.particles.emit(this.x, 15, this.y, {
      count: 12, speed: 120, color: GameConfig.COLORS.PLAYER, lifetime: 0.4, size: 3
    });
  }

  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.health = this.maxHealth;
    this.alive = true;
    this.shieldActive = false;
    this.group.visible = true;
    this.shadow.visible = true;
    this.shieldMesh.visible = false;
    this.syncModel();
  }

  setShield(active) {
    this.shieldActive = active;
    this.shieldMesh.visible = active;
  }

  setHealTint(active) {
    if (active) {
      const greenMat = new THREE.MeshBasicMaterial({ color: 0x88ff88 });
      this.group.traverse(child => {
        if (child.isMesh) child.material = greenMat;
      });
    } else {
      for (const { mesh, material } of this._originalMaterials) {
        mesh.material = material;
      }
    }
  }

  destroy() {
    this.scene.remove(this.group);
    this.scene.remove(this.shadow);
    this.scene.remove(this.shieldMesh);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
    });
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
