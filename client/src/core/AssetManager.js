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
    gCtx.fillStyle = '#2a2a30';
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
    gCtx.strokeStyle = 'rgba(80, 80, 90, 0.4)';
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

    // ─── ENHANCED WALL MATERIAL ─────────────────────────────────
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 256;
    wallCanvas.height = 256;
    const wCtx = wallCanvas.getContext('2d');

    // Base concrete color
    wCtx.fillStyle = '#3e3e48';
    wCtx.fillRect(0, 0, 256, 256);

    // Surface noise
    for (let i = 0; i < 6000; i++) {
      const v = 45 + Math.random() * 35;
      wCtx.fillStyle = `rgba(${v}, ${v}, ${v + 5}, 0.3)`;
      wCtx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }

    // Panel lines (horizontal seams)
    wCtx.strokeStyle = 'rgba(25, 25, 30, 0.7)';
    wCtx.lineWidth = 2;
    for (const y of [64, 128, 192]) {
      wCtx.beginPath(); wCtx.moveTo(0, y); wCtx.lineTo(256, y); wCtx.stroke();
      wCtx.strokeStyle = 'rgba(70, 70, 80, 0.3)';
      wCtx.beginPath(); wCtx.moveTo(0, y + 2); wCtx.lineTo(256, y + 2); wCtx.stroke();
      wCtx.strokeStyle = 'rgba(25, 25, 30, 0.7)';
    }
    // Vertical seams
    for (const x of [85, 170]) {
      wCtx.beginPath(); wCtx.moveTo(x, 0); wCtx.lineTo(x, 256); wCtx.stroke();
    }

    // Cracks (random-walk dark lines)
    wCtx.strokeStyle = 'rgba(15, 15, 20, 0.6)';
    wCtx.lineWidth = 1;
    for (let c = 0; c < 4; c++) {
      let cx = Math.random() * 256, cy = Math.random() * 256;
      wCtx.beginPath();
      wCtx.moveTo(cx, cy);
      for (let s = 0; s < 12; s++) {
        cx += (Math.random() - 0.5) * 20;
        cy += (Math.random() - 0.3) * 15;
        wCtx.lineTo(cx, cy);
      }
      wCtx.stroke();
    }

    // Rust / weathering patches (orange-brown near bottom)
    for (let i = 0; i < 3; i++) {
      const rx = Math.random() * 200 + 28;
      const ry = 180 + Math.random() * 60;
      const rr = 10 + Math.random() * 18;
      const grad = wCtx.createRadialGradient(rx, ry, 0, rx, ry, rr);
      grad.addColorStop(0, 'rgba(90, 55, 30, 0.35)');
      grad.addColorStop(1, 'rgba(90, 55, 30, 0)');
      wCtx.fillStyle = grad;
      wCtx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
    }

    // Bolt / rivet dots at panel intersections
    wCtx.fillStyle = 'rgba(60, 60, 70, 0.8)';
    for (const x of [85, 170]) {
      for (const y of [64, 128, 192]) {
        wCtx.beginPath(); wCtx.arc(x, y, 3, 0, Math.PI * 2); wCtx.fill();
        wCtx.fillStyle = 'rgba(80, 80, 90, 0.4)';
        wCtx.beginPath(); wCtx.arc(x + 1, y + 1, 2, 0, Math.PI * 2); wCtx.fill();
        wCtx.fillStyle = 'rgba(60, 60, 70, 0.8)';
      }
    }

    // Outer border
    wCtx.strokeStyle = 'rgba(25, 25, 30, 0.6)';
    wCtx.lineWidth = 3;
    wCtx.strokeRect(2, 2, 252, 252);

    const wallTexture = new THREE.CanvasTexture(wallCanvas);

    // ─── WALL NORMAL MAP ────────────────────────────────────────
    const wallNormCanvas = document.createElement('canvas');
    wallNormCanvas.width = 256;
    wallNormCanvas.height = 256;
    const nCtx = wallNormCanvas.getContext('2d');
    // Flat normal: rgb(128, 128, 255)
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, 256, 256);
    // Panel edge normals (indentation)
    nCtx.strokeStyle = 'rgb(100, 128, 255)';
    nCtx.lineWidth = 3;
    for (const y of [64, 128, 192]) {
      nCtx.beginPath(); nCtx.moveTo(0, y); nCtx.lineTo(256, y); nCtx.stroke();
    }
    for (const x of [85, 170]) {
      nCtx.beginPath(); nCtx.moveTo(x, 0); nCtx.lineTo(x, 256); nCtx.stroke();
    }
    // Highlight edges
    nCtx.strokeStyle = 'rgb(155, 128, 255)';
    nCtx.lineWidth = 1;
    for (const y of [66, 130, 194]) {
      nCtx.beginPath(); nCtx.moveTo(0, y); nCtx.lineTo(256, y); nCtx.stroke();
    }
    // Noise for roughness variation
    for (let i = 0; i < 2000; i++) {
      const v = 120 + Math.random() * 16;
      nCtx.fillStyle = `rgb(${v}, ${128}, ${245 + Math.random() * 20})`;
      nCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const wallNormalTexture = new THREE.CanvasTexture(wallNormCanvas);

    this._materials.wall = new THREE.MeshStandardMaterial({
      map: wallTexture,
      normalMap: wallNormalTexture,
      normalScale: new THREE.Vector2(0.5, 0.5),
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
      GRUNT: new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.6 }),
      FAST: new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.6 }),
      TANK: new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0xaa44ff, emissiveIntensity: 0.6 }),
      SNIPER: new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.6 }),
      BOSS: new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff4400, emissiveIntensity: 0.8 }),
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

    // ─── TREE GEOMETRIES & MATERIALS ─────────────────────────────
    // Trunk
    this._geometries.treeTrunk = new THREE.CylinderGeometry(3, 4, 30, 6);
    this._materials.treeTrunk = new THREE.MeshStandardMaterial({
      color: 0x553322, roughness: 0.9, metalness: 0.05
    });

    // Canopy layers (3 stacked cones for pine tree look)
    this._geometries.treeCanopy1 = new THREE.ConeGeometry(18, 22, 7); // bottom (widest)
    this._geometries.treeCanopy2 = new THREE.ConeGeometry(14, 18, 7); // middle
    this._geometries.treeCanopy3 = new THREE.ConeGeometry(9, 14, 7);  // top
    this._materials.treeCanopy = new THREE.MeshStandardMaterial({
      color: 0x1a4a1a, roughness: 0.8, metalness: 0.05,
      emissive: 0x0a2a0a, emissiveIntensity: 0.15
    });

    // ─── BUSH GEOMETRY & MATERIAL ────────────────────────────────
    this._geometries.bush = new THREE.SphereGeometry(6, 6, 5);
    this._materials.bush = new THREE.MeshStandardMaterial({
      color: 0x1e5a1e, roughness: 0.85, metalness: 0.05,
      emissive: 0x0a2a0a, emissiveIntensity: 0.1
    });

    // ─── ROCK GEOMETRY & MATERIAL ────────────────────────────────
    this._geometries.rock = new THREE.DodecahedronGeometry(5, 0);
    this._materials.rock = new THREE.MeshStandardMaterial({
      color: 0x556060, roughness: 0.95, metalness: 0.1
    });

    // ─── GRASS PATCH ─────────────────────────────────────────────
    this._geometries.grassPatch = new THREE.PlaneGeometry(20, 20);
    this._materials.grassPatch = new THREE.MeshStandardMaterial({
      color: 0x1a3a1a, roughness: 0.95, metalness: 0.0,
      transparent: true, opacity: 0.4, side: THREE.DoubleSide
    });

    // ─── TERRAIN ZONE TEXTURES ───────────────────────────────────
    // Grass texture (north / day zone overlay)
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 512; grassCanvas.height = 512;
    const grCtx = grassCanvas.getContext('2d');
    grCtx.fillStyle = '#2a3a1a';
    grCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 10000; i++) {
      const g = 30 + Math.random() * 40;
      const r = 20 + Math.random() * 20;
      grCtx.fillStyle = `rgba(${r}, ${g + 20}, ${r - 5}, ${0.2 + Math.random() * 0.3})`;
      grCtx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 4);
    }
    // Sparse grass blades
    grCtx.strokeStyle = 'rgba(40, 80, 30, 0.3)';
    grCtx.lineWidth = 1;
    for (let i = 0; i < 200; i++) {
      const bx = Math.random() * 512;
      const by = Math.random() * 512;
      grCtx.beginPath(); grCtx.moveTo(bx, by); grCtx.lineTo(bx + (Math.random() - 0.5) * 6, by - 4 - Math.random() * 8); grCtx.stroke();
    }
    const grassTexture = new THREE.CanvasTexture(grassCanvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(GameConfig.WORLD_WIDTH / 1024, (GameConfig.WORLD_HEIGHT / 2) / 1024);
    this._materials.groundGrass = new THREE.MeshStandardMaterial({
      map: grassTexture, roughness: 0.9, metalness: 0.0,
      transparent: true, opacity: 0.4, depthWrite: false
    });

    // Dirt texture (paths)
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 256; dirtCanvas.height = 256;
    const dCtx = dirtCanvas.getContext('2d');
    dCtx.fillStyle = '#3a2a1a';
    dCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const v = 35 + Math.random() * 30;
      dCtx.fillStyle = `rgba(${v + 15}, ${v}, ${v - 10}, ${0.3 + Math.random() * 0.3})`;
      dCtx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    const dirtTexture = new THREE.CanvasTexture(dirtCanvas);
    dirtTexture.wrapS = THREE.RepeatWrapping;
    dirtTexture.wrapT = THREE.RepeatWrapping;
    this._materials.groundDirt = new THREE.MeshStandardMaterial({
      map: dirtTexture, roughness: 0.95, metalness: 0.0,
      transparent: true, opacity: 0.3, depthWrite: false
    });

    // ─── WATER MATERIAL ──────────────────────────────────────────
    const waterCanvas = document.createElement('canvas');
    waterCanvas.width = 256; waterCanvas.height = 256;
    const wtCtx = waterCanvas.getContext('2d');
    wtCtx.fillStyle = '#0a1520';
    wtCtx.fillRect(0, 0, 256, 256);
    // Caustic patterns
    for (let i = 0; i < 3000; i++) {
      const b = 15 + Math.random() * 35;
      const g = 20 + Math.random() * 30;
      wtCtx.fillStyle = `rgba(${5}, ${g}, ${b + 10}, ${0.2 + Math.random() * 0.3})`;
      wtCtx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    // Light caustic streaks
    wtCtx.strokeStyle = 'rgba(30, 60, 80, 0.15)';
    wtCtx.lineWidth = 2;
    for (let i = 0; i < 15; i++) {
      wtCtx.beginPath();
      wtCtx.moveTo(Math.random() * 256, Math.random() * 256);
      wtCtx.quadraticCurveTo(Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256);
      wtCtx.stroke();
    }
    const waterTexture = new THREE.CanvasTexture(waterCanvas);
    waterTexture.wrapS = THREE.RepeatWrapping;
    waterTexture.wrapT = THREE.RepeatWrapping;
    waterTexture.repeat.set(2, 2);
    this._textures = this._textures || {};
    this._textures.water = waterTexture;
    this._materials.water = new THREE.MeshStandardMaterial({
      map: waterTexture, color: 0x112233,
      roughness: 0.05, metalness: 0.8,
      transparent: true, opacity: 0.85
    });
    this._materials.waterEdge = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a, roughness: 0.95, metalness: 0.0,
      transparent: true, opacity: 0.5, depthWrite: false
    });

    // Water geometry
    this._geometries.waterPool = new THREE.CircleGeometry(70, 32);
    this._geometries.waterEdgeRing = new THREE.RingGeometry(68, 85, 32);
  }

  getMaterial(name) { return this._materials[name]; }
  getBotMaterial(type) { return this._materials.bot[type]; }
  getBotEyeMaterial(type) { return this._materials.botEye[type]; }
  getGeometry(name) { return this._geometries[name]; }
  getTexture(name) { return this._textures?.[name]; }
}
