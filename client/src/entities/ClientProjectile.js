import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class ClientProjectile {
  constructor(scene, x, y, angle, isPlayerBullet = true) {
    this.scene = scene;
    this.createdAt = Date.now();

    const texture = isPlayerBullet ? 'bullet_player' : 'bullet_bot';
    this.sprite = scene.physics.add.sprite(x, y, texture);
    this.sprite.setCircle(6);
    this.sprite.setDepth(5);
    this.sprite.setRotation(angle);

    // Set velocity
    const speed = GameConfig.BULLET_SPEED;
    this.sprite.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );

    this.sprite.projectileRef = this;
    this.isPlayerBullet = isPlayerBullet;
    this.damage = isPlayerBullet ? GameConfig.BULLET_DAMAGE : GameConfig.BOT_DAMAGE;
    this.alive = true;

    // Trailing particle emitter
    const trailColor = isPlayerBullet ? 0xffff88 : 0xff8888;
    this.trail = scene.add.particles(0, 0, 'particle_white', {
      speed: 0,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 150,
      tint: trailColor,
      frequency: 20,
      follow: this.sprite,
    });
    this.trail.setDepth(4);
  }

  update() {
    // Auto-destroy after lifetime
    if (Date.now() - this.createdAt > GameConfig.BULLET_LIFETIME) {
      this.destroy();
      return;
    }

    // Destroy if out of world bounds
    if (this.sprite.x < 0 || this.sprite.x > GameConfig.WORLD_WIDTH ||
        this.sprite.y < 0 || this.sprite.y > GameConfig.WORLD_HEIGHT) {
      this.destroy();
    }
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;

    if (this.trail) {
      this.trail.stop();
      this.scene.time.delayedCall(200, () => {
        if (this.trail) {
          this.trail.destroy();
          this.trail = null;
        }
      });
    }

    this.sprite.destroy();
  }
}
