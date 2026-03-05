import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { WeaponType, WeaponConfig } from 'shadow-arena-shared/config/WeaponConfig.js';
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

    // Weapon system
    this.weaponType = WeaponType.AUTO_RIFLE;
    this._weaponList = [
      WeaponType.AUTO_RIFLE,
      WeaponType.PISTOL,
      WeaponType.SMG,
      WeaponType.SHOTGUN,
      WeaponType.SNIPER
    ];
    this._weaponIndex = 0;

    // Shooting (derived from weapon config)
    this._lastShotTime = 0;
    this._fireInterval = 1000 / WeaponConfig[this.weaponType].fireRate;

    // 3D model
    this.group = CharacterFactory.createPlayer(game.assets, this.weaponType, game.equippedSkin || 'default');
    this.group.position.set(x, 0, y);
    this.scene.add(this.group);

    // Soft shadow (gradient canvas texture)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.4)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowGeo = new THREE.PlaneGeometry(28, 28);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.3, y);
    this.scene.add(this.shadow);

    // Shield mesh (icosahedron wireframe with glow)
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
    this._flashMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0
    });

    // Reusable muzzle flash light (avoids creating/destroying PointLights per shot)
    this._muzzleLight = new THREE.PointLight(0xffff88, 0, 40);
    this._muzzleLight.visible = false;
    this.scene.add(this._muzzleLight);
    this._muzzleLightTimer = null;

    // Dash ghost trail
    this._dashGhosts = [];

    // Walk animation phase
    this._walkPhase = 0;
  }

  update(input, dt) {
    if (!this.alive) return;

    // Movement
    let mx = 0, my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;

    if (mx !== 0 && my !== 0) {
      const inv = 1 / Math.SQRT2;
      mx *= inv;
      my *= inv;
    }

    this.x += mx * this.speed * dt;
    this.y += my * this.speed * dt;

    // Rotation (aim angle)
    this.rotation = input.angle;

    // Walk animation
    const moving = mx !== 0 || my !== 0;
    if (moving) {
      this._walkPhase += dt * 10;
      const swing = Math.sin(this._walkPhase) * 0.3;
      // Animate legs
      const children = this.group.children;
      if (children[0]) children[0].position.y = 6 + swing * 2;  // left leg
      if (children[1]) children[1].position.y = 6 - swing * 2;  // right leg
      // Arm bob
      if (children[4]) children[4].position.y = 16 + swing;     // left arm
      if (children[5]) children[5].position.y = 16 - swing;     // right arm
    } else {
      this._walkPhase = 0;
    }

    this.syncModel();

    // Movement dust particles
    if (moving) {
      if (Math.random() < 0.3) {
        this.game.particles.emit(this.x, 1, this.y, {
          count: 1, speed: 15, color: 0x555555, lifetime: 0.4, size: 1.5
        });
      }
      // Trail effect based on equipped cosmetic
      const trailCfg = this.game._trailConfig;
      if (trailCfg && trailCfg.color !== null && Math.random() < 0.5) {
        this.game.particles.emit(this.x, 5, this.y, {
          count: 1, speed: 8, color: trailCfg.color, lifetime: 0.6, size: 2.0
        });
      }
    }

    // Rotate shield
    if (this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += dt * 1.5;
      this.shieldMesh.rotation.x += dt * 0.5;
    }

    // Update dash ghosts
    this._updateDashGhosts(dt);
  }

  syncModel() {
    this.group.position.set(this.x, 0, this.y);
    this.group.rotation.y = -this.rotation + Math.PI / 2;
    this.shadow.position.set(this.x, 0.3, this.y);
    this.shieldMesh.position.set(this.x, 15, this.y);
  }

  setWeapon(weaponType) {
    const wep = WeaponConfig[weaponType];
    if (!wep) return;
    this.weaponType = weaponType;
    this._fireInterval = 1000 / wep.fireRate;
    const idx = this._weaponList.indexOf(weaponType);
    if (idx >= 0) this._weaponIndex = idx;

    // Swap gun model
    CharacterFactory.attachGun(this.group, weaponType, this.game.assets);

    // Refresh original materials cache (for flash restore)
    this._originalMaterials = [];
    this.group.traverse(child => {
      if (child.isMesh) this._originalMaterials.push({ mesh: child, material: child.material });
    });
  }

  cycleWeapon(direction) {
    this._weaponIndex = (this._weaponIndex + direction + this._weaponList.length) % this._weaponList.length;
    this.setWeapon(this._weaponList[this._weaponIndex]);
  }

  shoot() {
    const now = performance.now();
    if (now - this._lastShotTime < this._fireInterval) return null;
    this._lastShotTime = now;

    const wep = WeaponConfig[this.weaponType] || WeaponConfig[WeaponType.AUTO_RIFLE];
    const gunDist = 24;
    const bx = this.x + Math.cos(this.rotation) * gunDist;
    const by = this.y + Math.sin(this.rotation) * gunDist;

    // Muzzle flash particles
    this.game.particles.emit(bx, 14, by, {
      count: 5, speed: 60, color: wep.tracerColor, lifetime: 0.06, size: 3
    });
    // Reuse muzzle flash light
    this._muzzleLight.position.set(bx, 14, by);
    this._muzzleLight.intensity = 2;
    this._muzzleLight.visible = true;
    if (this._muzzleLightTimer) clearTimeout(this._muzzleLightTimer);
    this._muzzleLightTimer = setTimeout(() => {
      this._muzzleLight.intensity = 0;
      this._muzzleLight.visible = false;
    }, 50);

    // Generate projectiles (multiple for shotgun)
    const bullets = [];
    for (let i = 0; i < wep.projectileCount; i++) {
      const spread = (Math.random() - 0.5) * wep.spread * 2;
      bullets.push({ x: bx, y: by, angle: this.rotation + spread, weaponType: this.weaponType });
    }
    return bullets;
  }

  takeDamage(amount) {
    if (this.shieldActive) amount = Math.floor(amount * 0.2);
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    } else {
      this._flashWhite();
      this.game.renderer.flashDamage();
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

    // Death explosion with multiple colored bursts
    this.game.particles.emit(this.x, 15, this.y, {
      count: 20, speed: 150, color: GameConfig.COLORS.PLAYER, lifetime: 0.5, size: 3
    });
    this.game.particles.emit(this.x, 10, this.y, {
      count: 10, speed: 80, color: 0xffaa44, lifetime: 0.3, size: 2
    });
    this.game.particles.emit(this.x, 5, this.y, {
      count: 8, speed: 40, color: 0x888888, lifetime: 0.6, size: 4
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

    // Spawn-in flash
    this.game.particles.emit(x, 15, y, {
      count: 12, speed: 80, color: 0x4488ff, lifetime: 0.4, size: 2
    });
  }

  setShield(active) {
    this.shieldActive = active;
    this.shieldMesh.visible = active;
  }

  setCameraMode(mode) {
    if (mode === 'fpp') {
      this.group.visible = false;
      this.shadow.visible = false;
    } else {
      if (this.alive) {
        this.group.visible = true;
        this.shadow.visible = true;
      }
    }
  }

  setHealTint(active) {
    if (active) {
      const healMat = new THREE.MeshStandardMaterial({
        color: 0x88ff88, emissive: 0x44ff44, emissiveIntensity: 1.0
      });
      this.group.traverse(child => {
        if (child.isMesh) child.material = healMat;
      });
      // Heal particles rising
      this._healParticleInterval = setInterval(() => {
        if (!this.alive) return;
        this.game.particles.emit(
          this.x + (Math.random() - 0.5) * 10,
          5 + Math.random() * 20,
          this.y + (Math.random() - 0.5) * 10,
          { count: 1, speed: 30, color: 0x44ff88, lifetime: 0.5, size: 2 }
        );
      }, 100);
    } else {
      for (const { mesh, material } of this._originalMaterials) {
        mesh.material = material;
      }
      if (this._healParticleInterval) {
        clearInterval(this._healParticleInterval);
        this._healParticleInterval = null;
      }
    }
  }

  // Dash ghost trail effect
  spawnDashGhost() {
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0.4, depthWrite: false
    });
    const ghost = this.group.clone();
    ghost.traverse(child => { if (child.isMesh) child.material = ghostMat; });
    ghost.position.copy(this.group.position);
    ghost.rotation.copy(this.group.rotation);
    this.scene.add(ghost);
    this._dashGhosts.push({ mesh: ghost, life: 0.3 });
  }

  _updateDashGhosts(dt) {
    for (let i = this._dashGhosts.length - 1; i >= 0; i--) {
      const g = this._dashGhosts[i];
      g.life -= dt;
      if (g.life <= 0) {
        this.scene.remove(g.mesh);
        this._dashGhosts.splice(i, 1);
      } else {
        g.mesh.traverse(child => {
          if (child.isMesh && child.material.opacity !== undefined) {
            child.material.opacity = g.life / 0.3 * 0.4;
          }
        });
      }
    }
  }

  destroy() {
    this.scene.remove(this.group);
    this.scene.remove(this.shadow);
    this.scene.remove(this.shieldMesh);
    this.scene.remove(this._muzzleLight);
    if (this._muzzleLightTimer) clearTimeout(this._muzzleLightTimer);
    this._muzzleLight.dispose();
    for (const g of this._dashGhosts) this.scene.remove(g.mesh);
    this._dashGhosts = [];
    if (this._healParticleInterval) clearInterval(this._healParticleInterval);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
    });
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
