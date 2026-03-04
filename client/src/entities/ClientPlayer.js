import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class ClientPlayer {
  constructor(scene, x, y) {
    this.scene = scene;
    this.entity = null; // Reference to PlayerEntity (shared logic)

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCircle(16);
    this.sprite.setDepth(10);
    this.sprite.body.setCollideWorldBounds(true);

    // Health bar
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(20);

    // Shield visual
    this.shieldSprite = scene.add.sprite(x, y, 'shield_effect');
    this.shieldSprite.setDepth(11);
    this.shieldSprite.setVisible(false);
    this.shieldSprite.setAlpha(0.6);

    // Track state
    this.health = GameConfig.PLAYER_MAX_HEALTH;
    this.maxHealth = GameConfig.PLAYER_MAX_HEALTH;
    this.alive = true;
    this.speed = GameConfig.PLAYER_SPEED;
    this.lastShotTime = 0;
    this.shieldActive = false;
  }

  update(input, dt) {
    if (!this.alive) return;

    // Movement
    let mx = 0, my = 0;
    if (input.up) my = -1;
    if (input.down) my = 1;
    if (input.left) mx = -1;
    if (input.right) mx = 1;

    // Normalize diagonal
    if (mx !== 0 && my !== 0) {
      const inv = 1 / Math.SQRT2;
      mx *= inv;
      my *= inv;
    }

    this.sprite.setVelocity(mx * this.speed, my * this.speed);

    // Rotation (aim)
    this.sprite.setRotation(input.angle);

    // Update health bar position
    this.drawHealthBar();

    // Update shield position
    if (this.shieldActive) {
      this.shieldSprite.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  shoot() {
    const now = Date.now();
    const interval = 1000 / GameConfig.FIRE_RATE;
    if (now - this.lastShotTime < interval) return null;
    if (!this.alive) return null;

    this.lastShotTime = now;

    // Spawn position slightly in front of player
    const offsetX = Math.cos(this.sprite.rotation) * 20;
    const offsetY = Math.sin(this.sprite.rotation) * 20;

    return {
      x: this.sprite.x + offsetX,
      y: this.sprite.y + offsetY,
      angle: this.sprite.rotation
    };
  }

  takeDamage(amount) {
    let actual = amount;
    if (this.shieldActive) {
      actual = Math.floor(amount * 0.2);
    }
    this.health -= actual;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
    return actual;
  }

  die() {
    this.alive = false;
    this.sprite.setVisible(false);
    this.sprite.body.enable = false;
    this.healthBar.clear();
    this.shieldSprite.setVisible(false);
  }

  respawn(x, y) {
    this.health = this.maxHealth;
    this.alive = true;
    this.sprite.setPosition(x, y);
    this.sprite.setVisible(true);
    this.sprite.body.enable = true;
    this.shieldActive = false;
    this.shieldSprite.setVisible(false);
  }

  setShield(active) {
    this.shieldActive = active;
    this.shieldSprite.setVisible(active);
    if (active) {
      this.shieldSprite.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  drawHealthBar() {
    this.healthBar.clear();
    if (!this.alive) return;

    const barWidth = 32;
    const barHeight = 4;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - 24;

    // Background
    this.healthBar.fillStyle(GameConfig.COLORS.HEALTH_BG, 0.8);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    // Health fill
    const pct = this.health / this.maxHealth;
    const color = pct > 0.5 ? GameConfig.COLORS.HEALTH_GREEN : GameConfig.COLORS.HEALTH_RED;
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, barWidth * pct, barHeight);
  }

  destroy() {
    this.sprite.destroy();
    this.healthBar.destroy();
    this.shieldSprite.destroy();
  }
}
