import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { NetworkManager } from '../systems/NetworkManager.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const cx = GameConfig.VIEW_WIDTH / 2;
    const cy = GameConfig.VIEW_HEIGHT / 2;

    // Title
    this.add.text(cx, 80, 'SHADOW ARENA', {
      fontSize: '48px', fill: '#4488ff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(cx, 130, 'TACTICAL OPS', {
      fontSize: '28px', fill: '#aaaaaa', fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(cx, 180, '', {
      fontSize: '14px', fill: '#ffaa00', fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Menu buttons
    const btnStyle = {
      fontSize: '22px', fill: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#333333', padding: { x: 30, y: 12 }
    };

    this.createButton(cx, cy - 60, 'SOLO MISSION', btnStyle, () => {
      this.scene.start('GameScene', { mode: 'solo' });
    });

    this.createButton(cx, cy + 10, '1v1 DUEL (Online)', btnStyle, () => {
      this.startOnlineMode('duel');
    });

    this.createButton(cx, cy + 80, '2v2 TEAM (Online)', btnStyle, () => {
      this.startOnlineMode('team2v2');
    });

    this.createButton(cx, cy + 150, '3v3 TEAM (Online)', btnStyle, () => {
      this.startOnlineMode('team3v3');
    });

    // Controls info
    this.add.text(cx, GameConfig.VIEW_HEIGHT - 60, 'WASD: Move | Mouse: Aim | Click: Shoot', {
      fontSize: '14px', fill: '#666666', fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.add.text(cx, GameConfig.VIEW_HEIGHT - 35, 'Q: Dash | E: Shield | R: Radar | F: Heal', {
      fontSize: '14px', fill: '#666666', fontFamily: 'monospace'
    }).setOrigin(0.5);
  }

  createButton(x, y, label, style, onClick) {
    const btn = this.add.text(x, y, label, style)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ fill: '#4488ff' }));
    btn.on('pointerout', () => btn.setStyle({ fill: '#ffffff' }));
    btn.on('pointerdown', onClick);

    return btn;
  }

  startOnlineMode(mode) {
    this.statusText.setText('Connecting to server...');

    const net = new NetworkManager(this);
    net.connect();

    // Wait for connection
    const checkConnection = this.time.addEvent({
      delay: 100,
      repeat: 50,
      callback: () => {
        if (net.connected) {
          checkConnection.destroy();
          this.statusText.setText(`Connected! Searching for ${mode} match...`);

          // Join matchmaking queue
          net.joinQueue(mode);

          // When match is found, start game
          net.onMatchStart = (data) => {
            this.scene.start('GameScene', {
              mode,
              networkManager: net
            });
          };
        }
      }
    });

    // Timeout after 5 seconds
    this.time.delayedCall(5000, () => {
      if (!net.connected) {
        checkConnection.destroy();
        this.statusText.setText('Could not connect. Is the server running? (node server/src/index.js)');
        net.disconnect();
      }
    });
  }
}
