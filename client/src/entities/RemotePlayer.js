import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

const INTERPOLATION_DELAY = 100; // ms

export class RemotePlayer {
  constructor(scene, id, x, y, team) {
    this.scene = scene;
    this.id = id;
    this.team = team;

    // Drop shadow
    this.shadow = scene.add.sprite(x, y, 'shadow');
    this.shadow.setDepth(8);
    this.shadow.setAlpha(0.35);

    // Create sprite (uses new 48x48 player texture)
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCircle(20, 4, 4);
    this.sprite.setDepth(9);

    // Tint based on team
    if (team === 'red') {
      this.sprite.setTint(0xff6666);
    } else if (team === 'blue') {
      this.sprite.setTint(0x6666ff);
    } else {
      this.sprite.setTint(0xff8800);
    }

    // Health bar
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(20);

    // Shield visual
    this.shieldSprite = scene.add.sprite(x, y, 'shield_effect');
    this.shieldSprite.setDepth(11);
    this.shieldSprite.setVisible(false);

    // Interpolation buffer
    this.positionBuffer = [];
    this.health = GameConfig.PLAYER_MAX_HEALTH;
    this.maxHealth = GameConfig.PLAYER_MAX_HEALTH;
    this.alive = true;
    this.shieldActive = false;
  }

  addSnapshot(state) {
    this.positionBuffer.push({
      x: state.x,
      y: state.y,
      rotation: state.rotation,
      timestamp: Date.now(),
      health: state.health,
      alive: state.alive,
      shieldActive: state.shieldActive
    });

    if (this.positionBuffer.length > 10) {
      this.positionBuffer.shift();
    }

    this.health = state.health;
    this.maxHealth = state.maxHealth;
    this.alive = state.alive;
    this.shieldActive = state.shieldActive;

    this.sprite.setVisible(this.alive);
    this.sprite.body.enable = this.alive;
    this.shadow.setVisible(this.alive);
    this.shieldSprite.setVisible(this.alive && this.shieldActive);
  }

  interpolate() {
    if (this.positionBuffer.length < 2) return;

    const renderTime = Date.now() - INTERPOLATION_DELAY;

    let previous = null;
    let target = null;

    for (let i = 0; i < this.positionBuffer.length - 1; i++) {
      if (this.positionBuffer[i].timestamp <= renderTime &&
          this.positionBuffer[i + 1].timestamp >= renderTime) {
        previous = this.positionBuffer[i];
        target = this.positionBuffer[i + 1];
        break;
      }
    }

    if (!previous || !target) {
      const latest = this.positionBuffer[this.positionBuffer.length - 1];
      this.sprite.setPosition(latest.x, latest.y);
      this.sprite.setRotation(latest.rotation);
    } else {
      const timeDiff = target.timestamp - previous.timestamp;
      const elapsed = renderTime - previous.timestamp;
      const t = timeDiff > 0 ? elapsed / timeDiff : 0;
      const clampedT = Math.max(0, Math.min(1, t));

      const x = Phaser.Math.Linear(previous.x, target.x, clampedT);
      const y = Phaser.Math.Linear(previous.y, target.y, clampedT);
      const rotation = Phaser.Math.Angle.RotateTo(previous.rotation, target.rotation, clampedT);

      this.sprite.setPosition(x, y);
      this.sprite.setRotation(rotation);
    }

    // Update shadow position
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 4);

    // Update shield position
    if (this.shieldActive) {
      this.shieldSprite.setPosition(this.sprite.x, this.sprite.y);
    }

    this.drawHealthBar();
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
  }
}
