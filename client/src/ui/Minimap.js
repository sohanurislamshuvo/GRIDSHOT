import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class Minimap {
  constructor(scene) {
    this.scene = scene;
    this.size = 150;
    this.padding = 10;
    this.x = GameConfig.VIEW_WIDTH - this.size - this.padding;
    this.y = this.padding;
    this.scale = this.size / GameConfig.WORLD_WIDTH;

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(90);

    this.radarDots = [];
    this.radarActive = false;
    this.radarTimer = null;
  }

  update(player, bots) {
    this.graphics.clear();

    // Background
    this.graphics.fillStyle(0x000000, 0.6);
    this.graphics.fillRect(this.x, this.y, this.size, this.size);
    this.graphics.lineStyle(1, 0x444444, 0.8);
    this.graphics.strokeRect(this.x, this.y, this.size, this.size);

    // Player dot (always visible)
    if (player && player.alive) {
      const px = this.x + player.sprite.x * this.scale;
      const py = this.y + player.sprite.y * this.scale;
      this.graphics.fillStyle(0x4488ff, 1);
      this.graphics.fillCircle(px, py, 3);
    }

    // Bot dots (only visible during radar)
    if (this.radarActive && bots) {
      for (const bot of bots) {
        if (!bot.alive) continue;
        const bx = this.x + (bot.sprite ? bot.sprite.x : bot.x) * this.scale;
        const by = this.y + (bot.sprite ? bot.sprite.y : bot.y) * this.scale;
        this.graphics.fillStyle(0xff4444, 1);
        this.graphics.fillCircle(bx, by, 2);
      }
    }

    // Radar dots from server
    if (this.radarActive) {
      for (const dot of this.radarDots) {
        const dx = this.x + dot.x * this.scale;
        const dy = this.y + dot.y * this.scale;
        this.graphics.fillStyle(0xffaa00, 0.8);
        this.graphics.fillCircle(dx, dy, 2);
      }
    }
  }

  activateRadar(enemies, duration) {
    this.radarActive = true;
    this.radarDots = enemies || [];

    if (this.radarTimer) {
      this.radarTimer.destroy();
    }

    this.radarTimer = this.scene.time.delayedCall(duration, () => {
      this.radarActive = false;
      this.radarDots = [];
    });
  }

  destroy() {
    this.graphics.destroy();
    if (this.radarTimer) this.radarTimer.destroy();
  }
}
