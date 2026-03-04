import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Show loading text
    const cx = GameConfig.VIEW_WIDTH / 2;
    const cy = GameConfig.VIEW_HEIGHT / 2;
    const loadingText = this.add.text(cx, cy - 20, 'Loading...', {
      fontSize: '24px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // Progress bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x333333, 0.8);
    progressBox.fillRect(cx - 160, cy + 10, 320, 30);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x4488ff, 1);
      progressBar.fillRect(cx - 155, cy + 15, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder textures programmatically
    this.createPlaceholderTextures();
  }

  createPlaceholderTextures() {
    // Player sprite (blue circle with direction indicator)
    const playerGfx = this.make.graphics({ add: false });
    playerGfx.fillStyle(GameConfig.COLORS.PLAYER, 1);
    playerGfx.fillCircle(16, 16, 16);
    playerGfx.fillStyle(0xffffff, 1);
    playerGfx.fillRect(16, 14, 16, 4); // Direction line
    playerGfx.generateTexture('player', 32, 32);
    playerGfx.destroy();

    // Bot sprite (red circle)
    const botGfx = this.make.graphics({ add: false });
    botGfx.fillStyle(GameConfig.COLORS.BOT, 1);
    botGfx.fillCircle(16, 16, 16);
    botGfx.fillStyle(0xffffff, 1);
    botGfx.fillRect(16, 14, 16, 4);
    botGfx.generateTexture('bot', 32, 32);
    botGfx.destroy();

    // Boss sprite (orange, larger)
    const bossGfx = this.make.graphics({ add: false });
    bossGfx.fillStyle(GameConfig.COLORS.BOSS, 1);
    bossGfx.fillCircle(32, 32, 32);
    bossGfx.fillStyle(0xffffff, 1);
    bossGfx.fillRect(32, 29, 32, 6);
    bossGfx.generateTexture('boss', 64, 64);
    bossGfx.destroy();

    // Bullet (yellow small circle)
    const bulletGfx = this.make.graphics({ add: false });
    bulletGfx.fillStyle(GameConfig.COLORS.BULLET_PLAYER, 1);
    bulletGfx.fillCircle(4, 4, 4);
    bulletGfx.generateTexture('bullet_player', 8, 8);
    bulletGfx.destroy();

    // Enemy bullet (red small circle)
    const ebulletGfx = this.make.graphics({ add: false });
    ebulletGfx.fillStyle(GameConfig.COLORS.BULLET_BOT, 1);
    ebulletGfx.fillCircle(4, 4, 4);
    ebulletGfx.generateTexture('bullet_bot', 8, 8);
    ebulletGfx.destroy();

    // Shield effect (blue ring)
    const shieldGfx = this.make.graphics({ add: false });
    shieldGfx.lineStyle(3, GameConfig.COLORS.SHIELD, 0.6);
    shieldGfx.strokeCircle(24, 24, 22);
    shieldGfx.generateTexture('shield_effect', 48, 48);
    shieldGfx.destroy();

    // Wall tile
    const wallGfx = this.make.graphics({ add: false });
    wallGfx.fillStyle(GameConfig.COLORS.WALL, 1);
    wallGfx.fillRect(0, 0, 32, 32);
    wallGfx.lineStyle(1, 0x888888, 0.3);
    wallGfx.strokeRect(0, 0, 32, 32);
    wallGfx.generateTexture('wall', 32, 32);
    wallGfx.destroy();

    // Floor tile
    const floorGfx = this.make.graphics({ add: false });
    floorGfx.fillStyle(GameConfig.COLORS.FLOOR, 1);
    floorGfx.fillRect(0, 0, 32, 32);
    floorGfx.lineStyle(1, 0x333333, 0.2);
    floorGfx.strokeRect(0, 0, 32, 32);
    floorGfx.generateTexture('floor', 32, 32);
    floorGfx.destroy();
  }

  create() {
    this.scene.start('MenuScene');
  }
}
