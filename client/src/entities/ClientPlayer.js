import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class ClientPlayer {
  constructor(scene, x, y) {
    this.scene = scene;
    this.entity = null;

    // Drop shadow (below player)
    this.shadow = scene.add.sprite(x, y, 'shadow');
    this.shadow.setDepth(9);
    this.shadow.setAlpha(0.4);

    // Create sprite (48x48 human texture)
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCircle(20, 4, 4);
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

    // Dust particle emitter (movement effect)
    this.dustEmitter = scene.add.particles(0, 0, 'particle_white', {
      speed: { min: 10, max: 30 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 300,
      tint: 0x888888,
      frequency: -1,
      quantity: 1,
    });
    this.dustEmitter.setDepth(8);

    // Track state
    this.health = GameConfig.PLAYER_MAX_HEALTH;
    this.maxHealth = GameConfig.PLAYER_MAX_HEALTH;
    this.alive = true;
    this.speed = GameConfig.PLAYER_SPEED;
    this.lastShotTime = 0;
    this.shieldActive = false;
    this._dustTimer = 0;
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

    // Update shadow position
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 4);

    // Update health bar position
    this.drawHealthBar();

    // Update shield position
    if (this.shieldActive) {
      this.shieldSprite.setPosition(this.sprite.x, this.sprite.y);
    }

    // Emit dust when moving
    const isMoving = (mx !== 0 || my !== 0);
    if (isMoving) {
      this._dustTimer += dt;
      if (this._dustTimer > 0.06) {
        this._dustTimer = 0;
        this.dustEmitter.emitParticleAt(this.sprite.x, this.sprite.y + 8, 1);
      }
    } else {
      this._dustTimer = 0;
    }
  }

  shoot() {
    const now = Date.now();
    const interval = 1000 / GameConfig.FIRE_RATE;
    if (now - this.lastShotTime < interval) return null;
    if (!this.alive) return null;

    this.lastShotTime = now;

    // Spawn position slightly in front of player
    const offsetX = Math.cos(this.sprite.rotation) * 24;
    const offsetY = Math.sin(this.sprite.rotation) * 24;

    // Muzzle flash effect
    const flashX = this.sprite.x + offsetX;
    const flashY = this.sprite.y + offsetY;
    if (this.scene.spawnMuzzleFlash) {
      this.scene.spawnMuzzleFlash(flashX, flashY);
    }

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

    // Hit flash effect
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.alive) this.sprite.clearTint();
    });

    // Camera micro-shake
    this.scene.cameras.main.shake(60, 0.003);

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
    this.shadow.setVisible(false);

    // Death explosion particles
    if (this.scene.spawnDeathExplosion) {
      this.scene.spawnDeathExplosion(this.sprite.x, this.sprite.y, GameConfig.COLORS.PLAYER);
    }
  }

  respawn(x, y) {
    this.health = this.maxHealth;
    this.alive = true;
    this.sprite.setPosition(x, y);
    this.sprite.setVisible(true);
    this.sprite.body.enable = true;
    this.shieldActive = false;
    this.shieldSprite.setVisible(false);
    this.shadow.setVisible(true);
    this.shadow.setPosition(x, y + 4);
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

    const barWidth = 36;
    const barHeight = 5;
    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y - 30;

    // Border
    this.healthBar.fillStyle(0x000000, 0.9);
    this.healthBar.fillRoundedRect(x - 1, y - 1, barWidth + 2, barHeight + 2, 2);

    // Background
    this.healthBar.fillStyle(GameConfig.COLORS.HEALTH_BG, 0.9);
    this.healthBar.fillRoundedRect(x, y, barWidth, barHeight, 2);

    // Health fill
    const pct = this.health / this.maxHealth;
    let color;
    if (pct > 0.6) color = GameConfig.COLORS.HEALTH_GREEN;
    else if (pct > 0.3) color = GameConfig.COLORS.HEALTH_YELLOW;
    else color = GameConfig.COLORS.HEALTH_RED;

    if (pct > 0) {
      this.healthBar.fillStyle(color, 1);
      this.healthBar.fillRoundedRect(x, y, barWidth * pct, barHeight, 2);
    }

    // Highlight shine
    this.healthBar.fillStyle(0xffffff, 0.2);
    this.healthBar.fillRect(x + 1, y + 1, Math.max(0, barWidth * pct - 2), 1);
  }

  destroy() {
    this.sprite.destroy();
    this.healthBar.destroy();
    this.shieldSprite.destroy();
    this.shadow.destroy();
    if (this.dustEmitter) this.dustEmitter.destroy();
  }
}
