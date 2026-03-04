import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

const config = {
  type: Phaser.AUTO,
  width: GameConfig.VIEW_WIDTH,
  height: GameConfig.VIEW_HEIGHT,
  parent: document.body,
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  pixelArt: true
};

new Phaser.Game(config);
