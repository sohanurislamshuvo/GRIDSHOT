import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  init(data) {
    this.gameScene = data.gameScene;
    this.gameMode = data.mode;
  }

  create() {
    // Health display
    this.healthText = this.add.text(20, 20, 'HP: 100/100', {
      fontSize: '16px',
      fill: '#44ff44',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3
    }).setScrollFactor(0).setDepth(100);

    // Health bar (large, at top)
    this.healthBarGfx = this.add.graphics().setScrollFactor(0).setDepth(100);

    // Kill/Death display
    this.statsText = this.add.text(20, 65, 'K: 0 | D: 0', {
      fontSize: '14px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setScrollFactor(0).setDepth(100);

    // Mode display
    this.modeText = this.add.text(GameConfig.VIEW_WIDTH - 20, 20, this.gameMode.toUpperCase(), {
      fontSize: '14px',
      fill: '#4488ff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Ability bar at bottom center
    this.abilityIcons = {};
    this.createAbilityBar();

    // Respawn text (hidden by default)
    this.respawnText = this.add.text(
      GameConfig.VIEW_WIDTH / 2,
      GameConfig.VIEW_HEIGHT / 2 - 50,
      'RESPAWNING...',
      {
        fontSize: '32px',
        fill: '#ff4444',
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setVisible(false);

    // Listen for events from game scene
    if (this.gameScene) {
      this.gameScene.events.on('statsUpdate', this.updateStats, this);
      this.gameScene.events.on('abilityUsed', this.onAbilityUsed, this);
      this.gameScene.events.on('radarActivated', this.onRadarActivated, this);
    }

    // ESC hint
    this.add.text(GameConfig.VIEW_WIDTH - 20, GameConfig.VIEW_HEIGHT - 25, 'ESC: Menu', {
      fontSize: '12px',
      fill: '#555555',
      fontFamily: 'monospace'
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
  }

  createAbilityBar() {
    const abilities = [
      { key: 'dash', label: 'Q DASH', color: GameConfig.COLORS.DASH },
      { key: 'shield', label: 'E SHIELD', color: GameConfig.COLORS.SHIELD },
      { key: 'radar', label: 'R RADAR', color: GameConfig.COLORS.RADAR },
      { key: 'heal', label: 'F HEAL', color: GameConfig.COLORS.HEAL }
    ];

    const startX = GameConfig.VIEW_WIDTH / 2 - (abilities.length * 80) / 2;
    const y = GameConfig.VIEW_HEIGHT - 50;

    abilities.forEach((ability, i) => {
      const x = startX + i * 80 + 40;

      // Background box
      const bg = this.add.graphics().setScrollFactor(0).setDepth(100);
      bg.fillStyle(0x222222, 0.8);
      bg.fillRoundedRect(x - 32, y - 18, 64, 36, 6);
      bg.lineStyle(2, ability.color, 0.6);
      bg.strokeRoundedRect(x - 32, y - 18, 64, 36, 6);

      // Label
      const label = this.add.text(x, y, ability.label, {
        fontSize: '11px',
        fill: '#ffffff',
        fontFamily: 'monospace'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

      // Cooldown overlay
      const overlay = this.add.graphics().setScrollFactor(0).setDepth(102);
      overlay.setVisible(false);

      // Cooldown timer text
      const cdText = this.add.text(x, y, '', {
        fontSize: '14px',
        fill: '#ffaa00',
        fontFamily: 'monospace',
        fontStyle: 'bold'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(103);

      this.abilityIcons[ability.key] = { bg, label, overlay, cdText, x, y, color: ability.color };
    });
  }

  updateStats(stats) {
    // Update health text
    this.healthText.setText(`HP: ${stats.health}/${stats.maxHealth}`);
    this.healthText.setFill(stats.health > 50 ? '#44ff44' : '#ff4444');

    // Update health bar
    this.healthBarGfx.clear();
    const barW = 200;
    const barH = 12;
    const barX = 20;
    const barY = 42;

    this.healthBarGfx.fillStyle(0x333333, 0.8);
    this.healthBarGfx.fillRect(barX, barY, barW, barH);

    const pct = stats.health / stats.maxHealth;
    const color = pct > 0.5 ? 0x44ff44 : (pct > 0.25 ? 0xffaa00 : 0xff4444);
    this.healthBarGfx.fillStyle(color, 1);
    this.healthBarGfx.fillRect(barX, barY, barW * pct, barH);

    // Stats text
    this.statsText.setText(`K: ${stats.kills} | D: ${stats.deaths}`);

    // Respawn text
    this.respawnText.setVisible(!stats.alive);
  }

  onAbilityUsed(data) {
    // The ability cooldowns will be checked in update()
  }

  onRadarActivated(data) {
    // Flash radar indicator
    const radarIcon = this.abilityIcons.radar;
    if (radarIcon) {
      radarIcon.label.setColor('#ffaa00');
      this.time.delayedCall(data.duration, () => {
        radarIcon.label.setColor('#ffffff');
      });
    }
  }

  update() {
    // Update ability cooldown displays
    if (!this.gameScene || !this.gameScene.getAbilityCooldowns) return;

    const cooldowns = this.gameScene.getAbilityCooldowns();
    for (const [name, cd] of Object.entries(cooldowns)) {
      const icon = this.abilityIcons[name];
      if (!icon) continue;

      if (cd.ready) {
        icon.overlay.setVisible(false);
        icon.cdText.setText('');
        icon.label.setAlpha(1);
      } else {
        icon.overlay.setVisible(true);
        icon.overlay.clear();
        icon.overlay.fillStyle(0x000000, 0.6);
        const remainPct = cd.remaining / cd.total;
        icon.overlay.fillRect(icon.x - 32, icon.y - 18, 64 * remainPct, 36);

        const secs = Math.ceil(cd.remaining / 1000);
        icon.cdText.setText(`${secs}s`);
        icon.label.setAlpha(0.5);
      }
    }
  }

  shutdown() {
    if (this.gameScene) {
      this.gameScene.events.off('statsUpdate', this.updateStats, this);
      this.gameScene.events.off('abilityUsed', this.onAbilityUsed, this);
      this.gameScene.events.off('radarActivated', this.onRadarActivated, this);
    }
  }
}
