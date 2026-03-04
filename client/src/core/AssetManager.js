import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class AssetManager {
  constructor() {
    this._materials = {};
    this._geometries = {};
    this._init();
  }

  _init() {
    const C = GameConfig.COLORS;

    // Ground material with grid texture
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 256;
    groundCanvas.height = 256;
    const gCtx = groundCanvas.getContext('2d');
    gCtx.fillStyle = '#1a1a1a';
    gCtx.fillRect(0, 0, 256, 256);
    gCtx.strokeStyle = '#222222';
    gCtx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      gCtx.beginPath(); gCtx.moveTo(i, 0); gCtx.lineTo(i, 256); gCtx.stroke();
      gCtx.beginPath(); gCtx.moveTo(0, i); gCtx.lineTo(256, i); gCtx.stroke();
    }
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(
      GameConfig.WORLD_WIDTH / 256,
      GameConfig.WORLD_HEIGHT / 256
    );

    this._materials.ground = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.9,
      metalness: 0.1
    });

    // Wall material
    this._materials.wall = new THREE.MeshStandardMaterial({
      color: C.WALL,
      roughness: 0.7,
      metalness: 0.2
    });

    // Player materials
    this._materials.playerBody = new THREE.MeshStandardMaterial({ color: C.PLAYER_ARMOR, roughness: 0.6, metalness: 0.3 });
    this._materials.playerHead = new THREE.MeshStandardMaterial({ color: C.PLAYER_ARMOR, roughness: 0.5, metalness: 0.4 });
    this._materials.playerVisor = new THREE.MeshStandardMaterial({ color: C.PLAYER_VISOR, emissive: C.PLAYER_VISOR, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 });
    this._materials.playerGun = new THREE.MeshStandardMaterial({ color: C.PLAYER_GUN, roughness: 0.4, metalness: 0.6 });
    this._materials.playerBoots = new THREE.MeshStandardMaterial({ color: C.PLAYER_BOOTS, roughness: 0.8 });

    // Bot materials by type
    this._materials.bot = {
      GRUNT: new THREE.MeshStandardMaterial({ color: C.BOT_GRUNT, roughness: 0.6, metalness: 0.3 }),
      FAST: new THREE.MeshStandardMaterial({ color: C.BOT_FAST, roughness: 0.5, metalness: 0.4 }),
      TANK: new THREE.MeshStandardMaterial({ color: C.BOT_TANK, roughness: 0.7, metalness: 0.3 }),
      SNIPER: new THREE.MeshStandardMaterial({ color: C.BOT_SNIPER, roughness: 0.5, metalness: 0.5 }),
      BOSS: new THREE.MeshStandardMaterial({ color: C.BOSS, roughness: 0.4, metalness: 0.5 }),
    };
    this._materials.botEye = {
      GRUNT: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      FAST: new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
      TANK: new THREE.MeshBasicMaterial({ color: 0xaa44ff }),
      SNIPER: new THREE.MeshBasicMaterial({ color: 0x00ffaa }),
      BOSS: new THREE.MeshBasicMaterial({ color: 0xff4400 }),
    };

    // Bullet materials
    this._materials.bulletPlayer = new THREE.MeshBasicMaterial({
      color: C.BULLET_PLAYER,
    });
    this._materials.bulletBot = new THREE.MeshBasicMaterial({
      color: C.BULLET_BOT,
    });

    // Shield material
    this._materials.shield = new THREE.MeshBasicMaterial({
      color: C.SHIELD,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Shared geometries
    this._geometries.wall = new THREE.BoxGeometry(GameConfig.TILE_SIZE, 48, GameConfig.TILE_SIZE);
    this._geometries.bullet = new THREE.SphereGeometry(3, 8, 8);
    this._geometries.shield = new THREE.SphereGeometry(20, 16, 16);
  }

  getMaterial(name) { return this._materials[name]; }
  getBotMaterial(type) { return this._materials.bot[type]; }
  getBotEyeMaterial(type) { return this._materials.botEye[type]; }
  getGeometry(name) { return this._geometries[name]; }
}
