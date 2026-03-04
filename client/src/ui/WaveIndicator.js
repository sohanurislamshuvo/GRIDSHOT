import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class WaveIndicator {
  constructor(scene) {
    this.scene = scene;
    this.currentWave = 0;
    this.botsRemaining = 0;

    this.waveText = scene.add.text(GameConfig.VIEW_WIDTH / 2, 20, '', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.announcementText = scene.add.text(
      GameConfig.VIEW_WIDTH / 2,
      GameConfig.VIEW_HEIGHT / 3,
      '', {
        fontSize: '36px',
        fill: '#ffaa00',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);
  }

  showWaveStart(wave, botCount, isBossWave) {
    this.currentWave = wave;
    this.botsRemaining = botCount;

    const text = isBossWave ? `BOSS WAVE ${wave}!` : `WAVE ${wave}`;
    this.announcementText.setText(text);
    this.announcementText.setVisible(true);
    this.announcementText.setAlpha(1);
    this.announcementText.setFill(isBossWave ? '#ff4444' : '#ffaa00');

    this.scene.tweens.add({
      targets: this.announcementText,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      onComplete: () => this.announcementText.setVisible(false)
    });
  }

  showWaveComplete(wave, nextWaveIn) {
    this.announcementText.setText(`WAVE ${wave} COMPLETE`);
    this.announcementText.setFill('#44ff44');
    this.announcementText.setVisible(true);
    this.announcementText.setAlpha(1);

    this.scene.tweens.add({
      targets: this.announcementText,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      onComplete: () => this.announcementText.setVisible(false)
    });
  }

  update(botsRemaining) {
    this.botsRemaining = botsRemaining;
    if (this.currentWave > 0) {
      this.waveText.setText(`Wave ${this.currentWave} - ${this.botsRemaining} enemies`);
    }
  }

  destroy() {
    this.waveText.destroy();
    this.announcementText.destroy();
  }
}
