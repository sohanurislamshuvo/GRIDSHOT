import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class ClientProjectile {
  constructor(game, x, y, angle, isPlayerBullet = true) {
    this.game = game;
    this.scene = game.renderer.scene;

    // Game state
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.radius = GameConfig.BULLET_RADIUS;
    this.damage = GameConfig.BULLET_DAMAGE;
    this.alive = true;
    this.isPlayerBullet = isPlayerBullet;
    this.serverId = null;

    // Velocity
    this.vx = Math.cos(angle) * GameConfig.BULLET_SPEED;
    this.vy = Math.sin(angle) * GameConfig.BULLET_SPEED;

    // Lifetime
    this._createdAt = performance.now();

    // 3D mesh
    const geo = game.assets.getGeometry('bullet');
    const mat = isPlayerBullet
      ? game.assets.getMaterial('bulletPlayer')
      : game.assets.getMaterial('bulletBot');
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 10, y);
    this.scene.add(this.mesh);

    // Point light for glow
    const glowColor = isPlayerBullet ? 0xffff00 : 0xff6666;
    this.light = new THREE.PointLight(glowColor, 0.5, 60);
    this.light.position.set(x, 10, y);
    this.scene.add(this.light);
  }

  update(dt) {
    if (!this.alive) return;

    // Move
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Sync 3D
    this.mesh.position.set(this.x, 10, this.y);
    this.light.position.set(this.x, 10, this.y);

    // Trail particle
    if (Math.random() < 0.5) {
      const color = this.isPlayerBullet ? 0xffff88 : 0xff8888;
      this.game.particles.emit(this.x, 10, this.y, {
        count: 1, speed: 5, color, lifetime: 0.15, size: 1.5
      });
    }

    // Check lifetime
    if (performance.now() - this._createdAt > GameConfig.BULLET_LIFETIME) {
      this.destroy();
      return;
    }

    // Check world bounds
    if (this.x < 0 || this.x > GameConfig.WORLD_WIDTH || this.y < 0 || this.y > GameConfig.WORLD_HEIGHT) {
      this.destroy();
    }
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.mesh.position.set(x, 10, y);
    this.light.position.set(x, 10, y);
  }

  destroy() {
    this.alive = false;
    this.scene.remove(this.mesh);
    this.scene.remove(this.light);
    this.mesh.geometry?.dispose();
    this.light.dispose();
  }
}
