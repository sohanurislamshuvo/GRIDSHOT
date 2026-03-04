import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class Scoreboard {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;

    this.container = scene.add.container(
      GameConfig.VIEW_WIDTH / 2,
      GameConfig.VIEW_HEIGHT / 2
    );
    this.container.setScrollFactor(0);
    this.container.setDepth(250);
    this.container.setVisible(false);

    // Background
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x000000, 0.85);
    this.bg.fillRoundedRect(-200, -150, 400, 300, 10);
    this.bg.lineStyle(2, 0x4488ff, 0.8);
    this.bg.strokeRoundedRect(-200, -150, 400, 300, 10);
    this.container.add(this.bg);

    // Title
    this.title = scene.add.text(0, -130, 'SCOREBOARD', {
      fontSize: '20px', fill: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.title);

    // Player rows
    this.rows = [];
  }

  update(players) {
    // Clear existing rows
    this.rows.forEach(row => row.destroy());
    this.rows = [];

    if (!players) return;

    const sorted = [...players].sort((a, b) => b.kills - a.kills);

    sorted.forEach((p, i) => {
      const y = -90 + i * 30;
      const teamColor = p.team === 'red' ? '#ff6666' :
                         p.team === 'blue' ? '#6666ff' : '#ffffff';

      const row = this.scene.add.text(0, y,
        `${p.username || p.id.substring(0, 8)}  K:${p.kills} D:${p.deaths}`, {
          fontSize: '14px', fill: teamColor, fontFamily: 'monospace'
        }).setOrigin(0.5);

      this.container.add(row);
      this.rows.push(row);
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  show() {
    this.visible = true;
    this.container.setVisible(true);
  }

  hide() {
    this.visible = false;
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy();
  }
}
