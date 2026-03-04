import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.result = data.result || 'defeat';
    this.stats = data.stats || {};
    this.xpEarned = data.xpEarned || 0;
  }

  create() {
    const cx = GameConfig.VIEW_WIDTH / 2;

    // Background
    this.add.rectangle(cx, GameConfig.VIEW_HEIGHT / 2,
      GameConfig.VIEW_WIDTH, GameConfig.VIEW_HEIGHT, 0x000000, 0.85);

    // Result text
    const isWin = this.result === 'victory';
    this.add.text(cx, 80, isWin ? 'VICTORY' : 'DEFEAT', {
      fontSize: '48px',
      fill: isWin ? '#44ff44' : '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Stats
    const statsY = 180;
    const stats = [
      `Kills: ${this.stats.kills || 0}`,
      `Deaths: ${this.stats.deaths || 0}`,
      `Waves: ${this.stats.wavesCleared || '-'}`,
      `XP Earned: +${this.xpEarned}`
    ];

    stats.forEach((text, i) => {
      this.add.text(cx, statsY + i * 35, text, {
        fontSize: '20px', fill: '#ffffff', fontFamily: 'monospace'
      }).setOrigin(0.5);
    });

    // Rating change
    if (this.stats.ratingChange !== undefined) {
      const changeColor = this.stats.ratingChange >= 0 ? '#44ff44' : '#ff4444';
      const changePrefix = this.stats.ratingChange >= 0 ? '+' : '';
      this.add.text(cx, statsY + stats.length * 35, `Rating: ${changePrefix}${this.stats.ratingChange}`, {
        fontSize: '20px', fill: changeColor, fontFamily: 'monospace'
      }).setOrigin(0.5);
    }

    // Return button
    const btn = this.add.text(cx, GameConfig.VIEW_HEIGHT - 80, 'RETURN TO MENU', {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#333333', padding: { x: 30, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ fill: '#4488ff' }));
    btn.on('pointerout', () => btn.setStyle({ fill: '#ffffff' }));
    btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
