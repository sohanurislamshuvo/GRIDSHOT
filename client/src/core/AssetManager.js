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

    // ─── PROCEDURAL GROUND TEXTURE ─────────────────────────────
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gCtx = groundCanvas.getContext('2d');

    // Base concrete color
    gCtx.fillStyle = '#1a1a1e';
    gCtx.fillRect(0, 0, 512, 512);

    // Noise / grime
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const brightness = 20 + Math.random() * 15;
      gCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness + 5}, ${0.3 + Math.random() * 0.3})`;
      gCtx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    // Subtle grid lines
    gCtx.strokeStyle = 'rgba(60, 60, 70, 0.3)';
    gCtx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 64) {
      gCtx.beginPath(); gCtx.moveTo(i, 0); gCtx.lineTo(i, 512); gCtx.stroke();
      gCtx.beginPath(); gCtx.moveTo(0, i); gCtx.lineTo(512, i); gCtx.stroke();
    }

    // Panel lines (thicker, less frequent)
    gCtx.strokeStyle = 'rgba(40, 40, 50, 0.5)';
    gCtx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 256) {
      gCtx.beginPath(); gCtx.moveTo(i, 0); gCtx.lineTo(i, 512); gCtx.stroke();
      gCtx.beginPath(); gCtx.moveTo(0, i); gCtx.lineTo(512, i); gCtx.stroke();
    }

    // Scattered scorch / stain marks
    for (let i = 0; i < 5; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const r = 8 + Math.random() * 20;
      const grad = gCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(10, 10, 12, 0.4)');
      grad.addColorStop(1, 'rgba(10, 10, 12, 0)');
      gCtx.fillStyle = grad;
      gCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(GameConfig.WORLD_WIDTH / 512, GameConfig.WORLD_HEIGHT / 512);

    // Ground roughness map (procedural)
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = 256;
    roughCanvas.height = 256;
    const rCtx = roughCanvas.getContext('2d');
    rCtx.fillStyle = '#ccc';
    rCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const v = 150 + Math.random() * 100;
      rCtx.fillStyle = `rgb(${v},${v},${v})`;
      rCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const roughTexture = new THREE.CanvasTexture(roughCanvas);
    roughTexture.wrapS = THREE.RepeatWrapping;
    roughTexture.wrapT = THREE.RepeatWrapping;
    roughTexture.repeat.copy(groundTexture.repeat);

    this._materials.ground = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughnessMap: roughTexture,
      roughness: 0.85,
      metalness: 0.15
    });

    // ─── WALL MATERIAL ─────────────────────────────────────────
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 128;
    wallCanvas.height = 128;
    const wCtx = wallCanvas.getContext('2d');
    wCtx.fillStyle = '#444450';
    wCtx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2000; i++) {
      const v = 55 + Math.random() * 30;
      wCtx.fillStyle = `rgba(${v}, ${v}, ${v + 5}, 0.4)`;
      wCtx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    wCtx.strokeStyle = 'rgba(30, 30, 35, 0.6)';
    wCtx.lineWidth = 2;
    wCtx.strokeRect(2, 2, 124, 124);

    const wallTexture = new THREE.CanvasTexture(wallCanvas);

    this._materials.wall = new THREE.MeshStandardMaterial({
      map: wallTexture,
      roughness: 0.75,
      metalness: 0.2,
      color: 0x556677
    });

    this._materials.wallTop = new THREE.MeshStandardMaterial({
      color: 0x667788,
      roughness: 0.6,
      metalness: 0.3
    });

    // ─── PLAYER MATERIALS (PBR) ────────────────────────────────
    this._materials.playerBody = new THREE.MeshStandardMaterial({
      color: C.PLAYER_ARMOR, roughness: 0.5, metalness: 0.4
    });
    this._materials.playerHead = new THREE.MeshStandardMaterial({
      color: C.PLAYER_ARMOR, roughness: 0.4, metalness: 0.5
    });
    this._materials.playerVisor = new THREE.MeshStandardMaterial({
      color: C.PLAYER_VISOR,
      emissive: C.PLAYER_VISOR,
      emissiveIntensity: 2.0,
      roughness: 0.1, metalness: 0.9
    });
    this._materials.playerGun = new THREE.MeshStandardMaterial({
      color: 0x222222, roughness: 0.3, metalness: 0.8
    });
    this._materials.playerBoots = new THREE.MeshStandardMaterial({
      color: C.PLAYER_BOOTS, roughness: 0.7, metalness: 0.2
    });

    // ─── BOT MATERIALS ─────────────────────────────────────────
    this._materials.bot = {
      GRUNT: new THREE.MeshStandardMaterial({ color: C.BOT_GRUNT, roughness: 0.55, metalness: 0.35 }),
      FAST: new THREE.MeshStandardMaterial({ color: C.BOT_FAST, roughness: 0.45, metalness: 0.45 }),
      TANK: new THREE.MeshStandardMaterial({ color: C.BOT_TANK, roughness: 0.65, metalness: 0.35 }),
      SNIPER: new THREE.MeshStandardMaterial({ color: C.BOT_SNIPER, roughness: 0.45, metalness: 0.55 }),
      BOSS: new THREE.MeshStandardMaterial({ color: C.BOSS, roughness: 0.35, metalness: 0.55 }),
    };
    this._materials.botEye = {
      GRUNT: new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0 }),
      FAST: new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 2.0 }),
      TANK: new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0xaa44ff, emissiveIntensity: 2.0 }),
      SNIPER: new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 2.0 }),
      BOSS: new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 3.0 }),
    };

    // ─── BULLET MATERIALS (emissive for bloom) ─────────────────
    this._materials.bulletPlayer = new THREE.MeshStandardMaterial({
      color: C.BULLET_PLAYER,
      emissive: C.BULLET_PLAYER,
      emissiveIntensity: 3.0,
      roughness: 0.1, metalness: 0.1
    });
    this._materials.bulletBot = new THREE.MeshStandardMaterial({
      color: C.BULLET_BOT,
      emissive: C.BULLET_BOT,
      emissiveIntensity: 3.0,
      roughness: 0.1, metalness: 0.1
    });

    // ─── SHIELD MATERIAL ───────────────────────────────────────
    this._materials.shield = new THREE.MeshStandardMaterial({
      color: C.SHIELD,
      emissive: C.SHIELD,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      wireframe: true
    });

    // ─── SHARED GEOMETRIES ─────────────────────────────────────
    this._geometries.wall = new THREE.BoxGeometry(GameConfig.TILE_SIZE, 48, GameConfig.TILE_SIZE);
    this._geometries.wallCap = new THREE.BoxGeometry(GameConfig.TILE_SIZE - 2, 4, GameConfig.TILE_SIZE - 2);
    this._geometries.bullet = new THREE.SphereGeometry(3, 8, 8);
    this._geometries.bulletTracer = new THREE.CylinderGeometry(1.5, 1.5, 12, 6);
    this._geometries.shield = new THREE.IcosahedronGeometry(22, 1);

    // Prop geometries
    this._geometries.crate = new THREE.BoxGeometry(12, 12, 12);
    this._geometries.barrel = new THREE.CylinderGeometry(6, 6, 16, 8);
    this._geometries.debris = new THREE.BoxGeometry(4, 2, 6);

    // Prop materials
    this._materials.crate = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.85, metalness: 0.1 });
    this._materials.barrel = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.6, metalness: 0.4 });
    this._materials.debris = new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9, metalness: 0.1 });
  }

  getMaterial(name) { return this._materials[name]; }
  getBotMaterial(type) { return this._materials.bot[type]; }
  getBotEyeMaterial(type) { return this._materials.botEye[type]; }
  getGeometry(name) { return this._geometries[name]; }
}
