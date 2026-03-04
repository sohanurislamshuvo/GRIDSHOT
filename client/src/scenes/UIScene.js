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
    // Detect mobile via InputManager
    this._isMobile = this.gameScene?.inputManager?.isMobile || false;

    // Use actual screen dimensions (works with EXPAND scale mode)
    const sw = this.scale.width;
    const sh = this.scale.height;

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

    // Mode display (top-right)
    this.modeText = this.add.text(sw - 20, 20, this.gameMode.toUpperCase(), {
      fontSize: '14px',
      fill: '#4488ff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Ability bar at bottom center
    this.abilityIcons = {};
    this.createAbilityBar();

    // Respawn text (center)
    this.respawnText = this.add.text(
      sw / 2,
      sh / 2 - 50,
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

    // Menu hint / pause button
    if (this._isMobile) {
      this.createPauseButton();
    } else {
      this.add.text(sw - 20, sh - 25, 'ESC: Menu', {
        fontSize: '12px',
        fill: '#555555',
        fontFamily: 'monospace'
      }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100);
    }
  }

  createAbilityBar() {
    const sw = this.scale.width;
    const sh = this.scale.height;

    const abilities = this._isMobile ? [
      { key: 'dash', label: 'DASH', color: GameConfig.COLORS.DASH },
      { key: 'shield', label: 'SHIELD', color: GameConfig.COLORS.SHIELD },
      { key: 'radar', label: 'RADAR', color: GameConfig.COLORS.RADAR },
      { key: 'heal', label: 'HEAL', color: GameConfig.COLORS.HEAL }
    ] : [
      { key: 'dash', label: 'Q DASH', color: GameConfig.COLORS.DASH },
      { key: 'shield', label: 'E SHIELD', color: GameConfig.COLORS.SHIELD },
      { key: 'radar', label: 'R RADAR', color: GameConfig.COLORS.RADAR },
      { key: 'heal', label: 'F HEAL', color: GameConfig.COLORS.HEAL }
    ];

    const btnW = this._isMobile ? 72 : 64;
    const btnH = this._isMobile ? 44 : 36;
    const spacing = this._isMobile ? 84 : 80;
    const y = this._isMobile ? sh - 170 : sh - 50;
    const startX = sw / 2 - (abilities.length * spacing) / 2;

    abilities.forEach((ability, i) => {
      const x = startX + i * spacing + spacing / 2;

      // Background box
      const bg = this.add.graphics().setScrollFactor(0).setDepth(100);
      bg.fillStyle(0x222222, 0.8);
      bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
      bg.lineStyle(2, ability.color, 0.6);
      bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);

      // Label
      const fontSize = this._isMobile ? '12px' : '11px';
      const label = this.add.text(x, y, ability.label, {
        fontSize,
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

      const iconData = { bg, label, overlay, cdText, x, y, color: ability.color, btnW, btnH };

      // On mobile: make ability buttons interactive (tappable)
      if (this._isMobile) {
        const hitArea = this.add.rectangle(x, y, btnW, btnH)
          .setScrollFactor(0)
          .setDepth(104)
          .setAlpha(0.001)
          .setInteractive();

        hitArea.on('pointerdown', () => {
          if (this.gameScene?.inputManager) {
            this.gameScene.inputManager.triggerAbility(ability.key);
          }
          bg.clear();
          bg.fillStyle(0x444444, 0.9);
          bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
          bg.lineStyle(2, ability.color, 1);
          bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);

          this.time.delayedCall(150, () => {
            bg.clear();
            bg.fillStyle(0x222222, 0.8);
            bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
            bg.lineStyle(2, ability.color, 0.6);
            bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6);
          });
        });

        iconData.hitArea = hitArea;
      }

      this.abilityIcons[ability.key] = iconData;
    });
  }

  createPauseButton() {
    const sw = this.scale.width;
    const btnX = sw - 30;
    const btnY = 50;

    const pauseBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    pauseBg.fillStyle(0x222222, 0.8);
    pauseBg.fillRoundedRect(btnX - 20, btnY - 15, 40, 30, 4);
    pauseBg.lineStyle(1, 0x666666, 0.6);
    pauseBg.strokeRoundedRect(btnX - 20, btnY - 15, 40, 30, 4);

    const pauseIcon = this.add.graphics().setScrollFactor(0).setDepth(101);
    pauseIcon.fillStyle(0xffffff, 0.8);
    pauseIcon.fillRect(btnX - 7, btnY - 8, 5, 16);
    pauseIcon.fillRect(btnX + 2, btnY - 8, 5, 16);

    const hitArea = this.add.rectangle(btnX, btnY, 50, 40)
      .setScrollFactor(0)
      .setDepth(102)
      .setAlpha(0.001)
      .setInteractive();

    hitArea.on('pointerdown', () => {
      if (this.gameScene?.returnToMenu) {
        this.gameScene.returnToMenu();
      }
    });
  }

  updateStats(stats) {
    this.healthText.setText(`HP: ${stats.health}/${stats.maxHealth}`);
    this.healthText.setFill(stats.health > 50 ? '#44ff44' : '#ff4444');

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

    this.statsText.setText(`K: ${stats.kills} | D: ${stats.deaths}`);
    this.respawnText.setVisible(!stats.alive);
  }

  onAbilityUsed(data) {
    // The ability cooldowns will be checked in update()
  }

  onRadarActivated(data) {
    const radarIcon = this.abilityIcons.radar;
    if (radarIcon) {
      radarIcon.label.setColor('#ffaa00');
      this.time.delayedCall(data.duration, () => {
        radarIcon.label.setColor('#ffffff');
      });
    }
  }

  update() {
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
        icon.overlay.fillRect(icon.x - icon.btnW / 2, icon.y - icon.btnH / 2, icon.btnW * remainPct, icon.btnH);

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
