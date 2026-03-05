import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { Quality } from '../core/Renderer.js';
import { generateWallData } from './WallGenerator.js';
import { TimeOfDaySystem } from './TimeOfDaySystem.js';

export class WorldBuilder {
  constructor(scene, assets, renderer, mapConfig) {
    this.scene = scene;
    this.assets = assets;
    this.renderer = renderer;
    this.mapConfig = mapConfig || { width: this.mapConfig.width, height: this.mapConfig.height, tileSize: this.mapConfig.tileSize, biome: 'urban', pillarSpacing: 15, wallDensity: 200, hasWater: true, hasTrees: true, hasBushes: true, fogDensity: 0.00025 };
    this.quality = renderer ? renderer.quality : Quality.HIGH;
    this.shadowMapSize = renderer ? renderer.getShadowMapSize() : 4096;
    this.objects = [];
    this.wallGrid = null;
    this.treePositions = [];
    this.timeOfDay = null;
  }

  /** Build the world asynchronously, yielding between steps for responsive loading */
  async build(onProgress) {
    const mc = this.mapConfig;
    const wallData = generateWallData(mc);
    this.wallGrid = wallData.grid;

    const steps = [
      { name: 'Sky', fn: () => this._buildSky() },
      { name: 'Ground', fn: () => this._buildGround() },
      { name: 'Walls', fn: () => this._buildWalls(wallData.wallPositions) },
      { name: 'Props', fn: () => this._buildProps(wallData.wallPositions) },
    ];

    if (mc.hasTrees) {
      steps.push({ name: 'Trees', fn: () => this._buildTrees(wallData.wallPositions) });
    }

    // Only build decorative elements on MEDIUM+ quality
    if (this.quality > Quality.LOW && mc.hasBushes) {
      steps.push({ name: 'Bushes', fn: () => this._buildBushes(wallData.wallPositions) });
      steps.push({ name: 'Rocks', fn: () => this._buildRocks(wallData.wallPositions) });
    }

    if (mc.hasWater) {
      steps.push({ name: 'Water', fn: () => this._buildWater() });
    }

    // Wall accents and lamp posts on MEDIUM+ quality
    if (this.quality > Quality.LOW) {
      steps.push({ name: 'WallAccents', fn: () => this._buildWallAccents(wallData.wallPositions) });
      steps.push({ name: 'LampPosts', fn: () => this._buildLampPosts(wallData.wallPositions) });
    }

    steps.push({ name: 'Lighting', fn: () => this._buildLighting() });

    for (let i = 0; i < steps.length; i++) {
      steps[i].fn();
      if (onProgress) onProgress(steps[i].name, (i + 1) / steps.length);
      // Yield to event loop so the browser can paint progress
      await new Promise(r => setTimeout(r, 0));
    }
  }

  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(3000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDayFactor: { value: 1.0 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uDayFactor;
        varying vec3 vWorldPos;

        // Simple hash noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          float height = normalize(vWorldPos).y;
          float df = uDayFactor;

          // Night colors (dark navy)
          vec3 nightBottom = vec3(0.02, 0.03, 0.06);
          vec3 nightMid = vec3(0.04, 0.06, 0.12);
          vec3 nightZenith = vec3(0.06, 0.08, 0.18);

          // Day colors (blue-gray)
          vec3 dayBottom = vec3(0.04, 0.06, 0.10);
          vec3 dayMid = vec3(0.10, 0.15, 0.23);
          vec3 dayZenith = vec3(0.15, 0.22, 0.35);

          vec3 bottomColor = mix(nightBottom, dayBottom, df);
          vec3 midColor = mix(nightMid, dayMid, df);
          vec3 zenithColor = mix(nightZenith, dayZenith, df);

          float t = smoothstep(-0.1, 0.4, height);
          float t2 = smoothstep(0.3, 0.9, height);
          vec3 sky = mix(bottomColor, midColor, t);
          sky = mix(sky, zenithColor, t2);

          // Cloud wisps (upper hemisphere only, dimmer at night)
          if (height > 0.05) {
            vec2 cloudUV = vWorldPos.xz * 0.001 + uTime * 0.003;
            float cloud = noise(cloudUV * 3.0) * 0.5 + noise(cloudUV * 7.0) * 0.25 + noise(cloudUV * 13.0) * 0.125;
            cloud = smoothstep(0.35, 0.7, cloud);
            float cloudFade = smoothstep(0.05, 0.3, height) * (1.0 - smoothstep(0.7, 1.0, height));
            vec3 cloudColor = mix(vec3(0.08, 0.10, 0.18), vec3(0.2, 0.25, 0.35), df);
            sky = mix(sky, cloudColor, cloud * cloudFade * 0.4);
          }

          // Stars at night (tiny bright dots)
          if (df < 0.3 && height > 0.1) {
            vec2 starUV = vWorldPos.xz * 0.05;
            float star = hash(floor(starUV));
            star = step(0.992, star) * (1.0 - df / 0.3);
            float twinkle = sin(uTime * 2.0 + star * 100.0) * 0.3 + 0.7;
            sky += vec3(star * twinkle * 0.8);
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(this.mapConfig.width / 2, 0, this.mapConfig.height / 2);
    this.scene.add(skyMesh);
    this.objects.push(skyMesh);
    this._skyMaterial = skyMat;
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(this.mapConfig.width, this.mapConfig.height);
    const mat = this.assets.getMaterial('ground');
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.mapConfig.width / 2, 0, this.mapConfig.height / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.objects.push(ground);

    const W = this.mapConfig.width;
    const H = this.mapConfig.height;

    // ─── TERRAIN ZONE OVERLAYS ──────────────────────────────────
    // Grass overlay (north / day half)
    const grassMat = this.assets.getMaterial('groundGrass');
    if (grassMat) {
      const grassGeo = new THREE.PlaneGeometry(W, H / 2);
      const grassOverlay = new THREE.Mesh(grassGeo, grassMat);
      grassOverlay.rotation.x = -Math.PI / 2;
      grassOverlay.position.set(W / 2, 0.12, H / 4);
      grassOverlay.receiveShadow = true;
      this.scene.add(grassOverlay);
      this.objects.push(grassOverlay);
    }

    // Dirt path strips (center cross)
    const dirtMat = this.assets.getMaterial('groundDirt');
    if (dirtMat) {
      // Horizontal path
      const dirtHGeo = new THREE.PlaneGeometry(W * 0.6, 40);
      const dirtH = new THREE.Mesh(dirtHGeo, dirtMat);
      dirtH.rotation.x = -Math.PI / 2;
      dirtH.position.set(W / 2, 0.08, H / 2);
      this.scene.add(dirtH);
      this.objects.push(dirtH);

      // Vertical path
      const dirtVGeo = new THREE.PlaneGeometry(40, H * 0.6);
      const dirtV = new THREE.Mesh(dirtVGeo, dirtMat);
      dirtV.rotation.x = -Math.PI / 2;
      dirtV.position.set(W / 2, 0.08, H / 2);
      this.scene.add(dirtV);
      this.objects.push(dirtV);
    }

    // ─── BOUNDARY WALLS (concrete barriers) ─────────────────────
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a44, roughness: 0.8, metalness: 0.15
    });
    const edgeEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0x334466, emissive: 0x223355, emissiveIntensity: 0.6, roughness: 0.3
    });
    const edgeGeo = new THREE.BoxGeometry(W + 8, 30, 6);
    const edgeGeo2 = new THREE.BoxGeometry(6, 30, H + 8);

    const edges = [
      { geo: edgeGeo, pos: [W / 2, 15, -3] },
      { geo: edgeGeo, pos: [W / 2, 15, H + 3] },
      { geo: edgeGeo2, pos: [-3, 15, H / 2] },
      { geo: edgeGeo2, pos: [W + 3, 15, H / 2] },
    ];
    for (const e of edges) {
      const mesh = new THREE.Mesh(e.geo, edgeMat);
      mesh.position.set(...e.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.objects.push(mesh);
    }
    // Emissive strip on top
    const stripGeo = new THREE.BoxGeometry(W + 8, 2, 3);
    const stripGeo2 = new THREE.BoxGeometry(3, 2, H + 8);
    const strips = [
      { geo: stripGeo, pos: [W / 2, 31, -3] },
      { geo: stripGeo, pos: [W / 2, 31, H + 3] },
      { geo: stripGeo2, pos: [-3, 31, H / 2] },
      { geo: stripGeo2, pos: [W + 3, 31, H / 2] },
    ];
    for (const s of strips) {
      const mesh = new THREE.Mesh(s.geo, edgeEmissiveMat);
      mesh.position.set(...s.pos);
      this.scene.add(mesh);
      this.objects.push(mesh);
    }
  }

  _buildWalls(wallPositions) {
    const geo = this.assets.getGeometry('wall');
    const mat = this.assets.getMaterial('wall');
    const ts = this.mapConfig.tileSize;
    const wallHeight = 24;

    // Main wall bodies
    const instancedWall = new THREE.InstancedMesh(geo, mat, wallPositions.length);
    instancedWall.castShadow = true;
    instancedWall.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    for (let i = 0; i < wallPositions.length; i++) {
      const wp = wallPositions[i];
      matrix.setPosition(
        wp.x * ts + ts / 2,
        wallHeight,
        wp.y * ts + ts / 2
      );
      instancedWall.setMatrixAt(i, matrix);
    }
    instancedWall.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedWall);
    this.objects.push(instancedWall);

    // Wall top caps (slightly different material for bevel look)
    const capGeo = this.assets.getGeometry('wallCap');
    const capMat = this.assets.getMaterial('wallTop');
    const instancedCap = new THREE.InstancedMesh(capGeo, capMat, wallPositions.length);
    instancedCap.castShadow = true;

    for (let i = 0; i < wallPositions.length; i++) {
      const wp = wallPositions[i];
      matrix.setPosition(
        wp.x * ts + ts / 2,
        wallHeight + 26,
        wp.y * ts + ts / 2
      );
      instancedCap.setMatrixAt(i, matrix);
    }
    instancedCap.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedCap);
    this.objects.push(instancedCap);
  }

  /** Create chunked InstancedMeshes from a list of items, splitting into a CHUNK_GRID x CHUNK_GRID grid */
  _createChunkedInstances(items, geo, mat, castShadow = true, receiveShadow = true) {
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;
    const GRID = 4; // 4x4 chunks
    const chunkW = W / GRID;
    const chunkH = H / GRID;

    // Bucket items into chunks
    const buckets = new Array(GRID * GRID).fill(null).map(() => []);
    for (const item of items) {
      const cx = Math.min(GRID - 1, Math.floor(item.x / chunkW));
      const cz = Math.min(GRID - 1, Math.floor(item.z / chunkH));
      buckets[cz * GRID + cx].push(item);
    }

    const m = new THREE.Matrix4();
    for (let ci = 0; ci < buckets.length; ci++) {
      const bucket = buckets[ci];
      if (bucket.length === 0) continue;

      const instanced = new THREE.InstancedMesh(geo, mat, bucket.length);
      instanced.castShadow = castShadow;
      instanced.receiveShadow = receiveShadow;

      for (let i = 0; i < bucket.length; i++) {
        instanced.setMatrixAt(i, bucket[i].matrix || m);
      }
      instanced.instanceMatrix.needsUpdate = true;
      instanced.computeBoundingSphere();
      this.scene.add(instanced);
      this.objects.push(instanced);
    }
  }

  _buildProps(wallPositions) {
    const ts = this.mapConfig.tileSize;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));

    const props = [];
    const propTypes = ['crate', 'barrel', 'debris'];
    const gridW = Math.floor(this.mapConfig.width / ts);
    const gridH = Math.floor(this.mapConfig.height / ts);

    for (let gx = 2; gx < gridW - 2; gx += 3) {
      for (let gy = 2; gy < gridH - 2; gy += 3) {
        const hash = ((gx * 48271) ^ (gy * 16807)) >>> 0;
        if (hash % 7 !== 0) continue;
        if (wallSet.has(`${gx},${gy}`)) continue;

        const typeIdx = hash % 3;
        const type = propTypes[typeIdx];
        const ox = ((hash >> 4) % 20) - 10;
        const oz = ((hash >> 8) % 20) - 10;
        props.push({
          type,
          x: gx * ts + ts / 2 + ox,
          z: gy * ts + ts / 2 + oz,
          rotY: (hash % 628) / 100
        });
      }
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();

    for (const type of propTypes) {
      const typeProps = props.filter(pp => pp.type === type);
      if (typeProps.length === 0) continue;

      const geo = this.assets.getGeometry(type);
      const mat = this.assets.getMaterial(type);

      // Pre-compute matrices for chunking
      const items = typeProps.map(prop => {
        const yOff = type === 'barrel' ? 8 : type === 'crate' ? 6 : 1;
        p.set(prop.x, yOff, prop.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotY);
        m.compose(p, q, s);
        return { x: prop.x, z: prop.z, matrix: m.clone() };
      });

      this._createChunkedInstances(items, geo, mat);
    }
  }

  _buildTrees(wallPositions) {
    const ts = this.mapConfig.tileSize;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;
    const gridW = Math.floor(W / ts);
    const gridH = Math.floor(H / ts);

    // Collect tree positions via deterministic hash
    const trees = [];
    const centerX = W / 2, centerY = H / 2;
    for (let gx = 3; gx < gridW - 3; gx += 4) {
      for (let gy = 3; gy < gridH - 3; gy += 4) {
        const hash = ((gx * 92837) ^ (gy * 38491)) >>> 0;
        if (hash % 11 !== 0) continue;
        if (wallSet.has(`${gx},${gy}`)) continue;
        // Avoid center spawn area (200 unit radius)
        const wx = gx * ts + ts / 2;
        const wz = gy * ts + ts / 2;
        const dc = Math.sqrt((wx - centerX) ** 2 + (wz - centerY) ** 2);
        if (dc < 200) continue;

        const scale = 0.7 + (hash % 60) / 100; // 0.7 to 1.3
        const ox = ((hash >> 3) % 16) - 8;
        const oz = ((hash >> 7) % 16) - 8;
        const tx = wx + ox;
        const tz = wz + oz;
        trees.push({ x: tx, z: tz, scale });
        this.treePositions.push({ x: tx, z: tz, radius: 6 });
      }
    }

    if (trees.length === 0) return;

    const trunkGeo = this.assets.getGeometry('treeTrunk');
    const trunkMat = this.assets.getMaterial('treeTrunk');
    const canopyGeo1 = this.assets.getGeometry('treeCanopy1');
    const canopyGeo2 = this.assets.getGeometry('treeCanopy2');
    const canopyGeo3 = this.assets.getGeometry('treeCanopy3');
    const canopyMat = this.assets.getMaterial('treeCanopy');

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    // Pre-compute matrices per tree for each layer
    const trunkItems = [];
    const c1Items = [];
    const c2Items = [];
    const c3Items = [];

    for (const t of trees) {
      const sc = t.scale;
      s.set(sc, sc, sc);

      p.set(t.x, 15 * sc, t.z); m.compose(p, q, s);
      trunkItems.push({ x: t.x, z: t.z, matrix: m.clone() });

      p.set(t.x, 28 * sc, t.z); m.compose(p, q, s);
      c1Items.push({ x: t.x, z: t.z, matrix: m.clone() });

      p.set(t.x, 38 * sc, t.z); m.compose(p, q, s);
      c2Items.push({ x: t.x, z: t.z, matrix: m.clone() });

      p.set(t.x, 46 * sc, t.z); m.compose(p, q, s);
      c3Items.push({ x: t.x, z: t.z, matrix: m.clone() });
    }

    this._createChunkedInstances(trunkItems, trunkGeo, trunkMat, true, true);
    this._createChunkedInstances(c1Items, canopyGeo1, canopyMat, true, false);
    this._createChunkedInstances(c2Items, canopyGeo2, canopyMat, true, false);
    this._createChunkedInstances(c3Items, canopyGeo3, canopyMat, true, false);
  }

  _buildBushes(wallPositions) {
    const ts = this.mapConfig.tileSize;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));
    const gridW = Math.floor(this.mapConfig.width / ts);
    const gridH = Math.floor(this.mapConfig.height / ts);

    const bushes = [];
    for (let gx = 2; gx < gridW - 2; gx += 3) {
      for (let gy = 2; gy < gridH - 2; gy += 3) {
        const hash = ((gx * 65537) ^ (gy * 28657)) >>> 0;
        if (hash % 13 !== 0) continue;
        if (wallSet.has(`${gx},${gy}`)) continue;

        const ox = ((hash >> 5) % 20) - 10;
        const oz = ((hash >> 9) % 20) - 10;
        const scaleX = 0.8 + (hash % 40) / 100;
        const scaleY = 0.6 + ((hash >> 2) % 50) / 100;
        const scaleZ = 0.8 + ((hash >> 4) % 40) / 100;
        bushes.push({
          x: gx * ts + ts / 2 + ox,
          z: gy * ts + ts / 2 + oz,
          sx: scaleX, sy: scaleY, sz: scaleZ
        });
      }
    }

    if (bushes.length === 0) return;

    const geo = this.assets.getGeometry('bush');
    const mat = this.assets.getMaterial('bush');

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    const items = bushes.map(b => {
      p.set(b.x, 3 * b.sy, b.z);
      s.set(b.sx, b.sy, b.sz);
      m.compose(p, q, s);
      return { x: b.x, z: b.z, matrix: m.clone() };
    });

    this._createChunkedInstances(items, geo, mat);
  }

  _buildRocks(wallPositions) {
    const ts = this.mapConfig.tileSize;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));
    const gridW = Math.floor(this.mapConfig.width / ts);
    const gridH = Math.floor(this.mapConfig.height / ts);

    const rocks = [];
    for (let gx = 1; gx < gridW - 1; gx += 5) {
      for (let gy = 1; gy < gridH - 1; gy += 5) {
        const hash = ((gx * 31337) ^ (gy * 54773)) >>> 0;
        if (hash % 9 !== 0) continue;
        if (wallSet.has(`${gx},${gy}`)) continue;

        const ox = ((hash >> 3) % 24) - 12;
        const oz = ((hash >> 6) % 24) - 12;
        const scale = 0.6 + (hash % 80) / 100;
        const rotY = (hash % 628) / 100;
        const rotX = ((hash >> 10) % 40) / 100 - 0.2;
        rocks.push({
          x: gx * ts + ts / 2 + ox,
          z: gy * ts + ts / 2 + oz,
          scale, rotY, rotX
        });
      }
    }

    if (rocks.length === 0) return;

    const geo = this.assets.getGeometry('rock');
    const mat = this.assets.getMaterial('rock');

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    const items = rocks.map(r => {
      p.set(r.x, 2 * r.scale, r.z);
      s.set(r.scale, r.scale * 0.7, r.scale);
      euler.set(r.rotX, r.rotY, 0);
      q.setFromEuler(euler);
      m.compose(p, q, s);
      return { x: r.x, z: r.z, matrix: m.clone() };
    });

    this._createChunkedInstances(items, geo, mat);
  }

  _buildWater() {
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;
    const cx = W / 2, cz = H / 2;

    // Water pool at map center with animated shader
    const waterGeo = this.assets.getGeometry('waterPool');
    if (!waterGeo) return;

    const waterTex = this.assets.getTexture('water');
    const waterShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWaterTex: { value: waterTex },
        uOpacity: { value: 0.85 }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 pos = position;
          // Sine wave displacement on Y (becomes Z after rotation)
          float dist = length(pos.xy);
          float wave1 = sin(pos.x * 0.15 + uTime * 2.0) * 1.2;
          float wave2 = sin(pos.y * 0.12 + uTime * 1.5 + 1.0) * 0.8;
          float wave3 = sin((pos.x + pos.y) * 0.1 + uTime * 2.5) * 0.5;
          float edgeFade = smoothstep(70.0, 50.0, dist);
          float displacement = (wave1 + wave2 + wave3) * edgeFade;
          vWave = displacement / 2.5;
          pos.z = pos.z + displacement;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uWaterTex;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vWave;

        void main() {
          // Animated UVs for caustic movement
          vec2 uv1 = vUv * 2.0 + vec2(uTime * 0.02, uTime * 0.015);
          vec2 uv2 = vUv * 2.0 + vec2(-uTime * 0.015, uTime * 0.01);
          vec3 tex1 = texture2D(uWaterTex, uv1).rgb;
          vec3 tex2 = texture2D(uWaterTex, uv2).rgb;
          vec3 waterColor = mix(tex1, tex2, 0.5);

          // Specular highlight from waves
          float spec = pow(max(0.0, vWave * 0.5 + 0.5), 4.0) * 0.3;
          waterColor += vec3(spec * 0.3, spec * 0.5, spec * 0.7);

          // Caustic bright spots
          float caustic = sin(vUv.x * 30.0 + uTime * 3.0) * sin(vUv.y * 25.0 + uTime * 2.0);
          caustic = max(0.0, caustic) * 0.15;
          waterColor += vec3(caustic * 0.2, caustic * 0.5, caustic * 0.7);

          // Edge fade
          float dist = length(vUv - 0.5) * 2.0;
          float alpha = uOpacity * smoothstep(1.0, 0.7, dist);

          gl_FragColor = vec4(waterColor, alpha);
        }
      `
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterShaderMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(cx, -0.5, cz);
    waterMesh.receiveShadow = true;
    this.scene.add(waterMesh);
    this.objects.push(waterMesh);
    this._waterMaterial = waterShaderMat;

    // Dirt ring around water
    const edgeGeo = this.assets.getGeometry('waterEdgeRing');
    const edgeMat = this.assets.getMaterial('waterEdge');
    if (edgeGeo && edgeMat) {
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.rotation.x = -Math.PI / 2;
      edgeMesh.position.set(cx, 0.05, cz);
      this.scene.add(edgeMesh);
      this.objects.push(edgeMesh);
    }
  }

  _buildWallAccents(wallPositions) {
    const ts = this.mapConfig.tileSize;
    const geo = this.assets.getGeometry('wallAccent');
    const mat = this.assets.getMaterial('wallAccent');
    if (!geo || !mat) return;

    // Emissive accent strip at mid-height on each wall
    const accentMesh = new THREE.InstancedMesh(geo, mat, wallPositions.length);
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < wallPositions.length; i++) {
      const wp = wallPositions[i];
      matrix.setPosition(
        wp.x * ts + ts / 2,
        18,  // Mid-height accent line
        wp.y * ts + ts / 2
      );
      accentMesh.setMatrixAt(i, matrix);
    }
    accentMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(accentMesh);
    this.objects.push(accentMesh);

    // Second accent strip near the top
    const accentMesh2 = new THREE.InstancedMesh(geo, mat, wallPositions.length);
    for (let i = 0; i < wallPositions.length; i++) {
      const wp = wallPositions[i];
      matrix.setPosition(
        wp.x * ts + ts / 2,
        42,  // Near-top accent line
        wp.y * ts + ts / 2
      );
      accentMesh2.setMatrixAt(i, matrix);
    }
    accentMesh2.instanceMatrix.needsUpdate = true;
    this.scene.add(accentMesh2);
    this.objects.push(accentMesh2);
  }

  _buildLampPosts(wallPositions) {
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;
    const ts = this.mapConfig.tileSize;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));

    // Place lamp posts at path intersections and along paths
    const lampPositions = [
      // Center intersection
      { x: W / 2 + 30, z: H / 2 + 30 },
      { x: W / 2 - 30, z: H / 2 - 30 },
      // Along horizontal path
      { x: W * 0.3, z: H / 2 + 25 },
      { x: W * 0.7, z: H / 2 - 25 },
      // Along vertical path
      { x: W / 2 + 25, z: H * 0.3 },
      { x: W / 2 - 25, z: H * 0.7 },
    ].filter(lp => {
      // Ensure no wall collision
      const gx = Math.floor(lp.x / ts);
      const gz = Math.floor(lp.z / ts);
      return !wallSet.has(`${gx},${gz}`);
    });

    const poleGeo = this.assets.getGeometry('lampPole');
    const poleMat = this.assets.getMaterial('lampPole');
    const bulbGeo = this.assets.getGeometry('lampBulb');
    const bulbMat = this.assets.getMaterial('lampBulb');
    const armGeo = this.assets.getGeometry('lampArm');
    const armMat = this.assets.getMaterial('lampArm');

    for (const lp of lampPositions) {
      // Pole
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lp.x, 25, lp.z);
      pole.castShadow = true;
      this.scene.add(pole);
      this.objects.push(pole);

      // Arm (horizontal extension at top)
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(lp.x + 5, 50, lp.z);
      this.scene.add(arm);
      this.objects.push(arm);

      // Bulb
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(lp.x + 5, 48, lp.z);
      this.scene.add(bulb);
      this.objects.push(bulb);

      // PointLight from bulb
      const light = new THREE.PointLight(0xffddaa, 0.8, 150);
      light.position.set(lp.x + 5, 48, lp.z);
      this.scene.add(light);
      this.objects.push(light);
    }
  }

  _buildLighting() {
    const W = this.mapConfig.width;
    const H = this.mapConfig.height;

    // Ambient light (brighter)
    this.ambient = new THREE.AmbientLight(0x445566, 0.8);
    this.scene.add(this.ambient);
    this.objects.push(this.ambient);

    // Hemisphere light (brighter sky)
    this.hemi = new THREE.HemisphereLight(0x6688aa, 0x222225, 0.6);
    this.scene.add(this.hemi);
    this.objects.push(this.hemi);

    // Main directional light (warmer, stronger sun)
    const dirLight = new THREE.DirectionalLight(0xfff0dd, 2.0);
    dirLight.position.set(500, 1000, 500);
    dirLight.castShadow = this.quality > Quality.LOW;
    dirLight.shadow.mapSize.width = this.shadowMapSize;
    dirLight.shadow.mapSize.height = this.shadowMapSize;
    dirLight.shadow.camera.left = -600;
    dirLight.shadow.camera.right = 600;
    dirLight.shadow.camera.top = 600;
    dirLight.shadow.camera.bottom = -600;
    dirLight.shadow.camera.near = 100;
    dirLight.shadow.camera.far = 2000;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);
    this.scene.add(dirLight.target);
    this.dirLight = dirLight;
    this.objects.push(dirLight);

    // Zone and corner PointLights (skip on LOW quality — keep only directional + ambient + hemi)
    if (this.quality > Quality.LOW) {
      // ─── DAY ZONE lights (north half, Z < 1000) ──────────────────
      const dayLights = [
        { pos: [500, 100, 400], color: 0xffeebb, intensity: 1.2, range: 1200 },
        { pos: [1500, 100, 400], color: 0xffeebb, intensity: 1.2, range: 1200 },
        { pos: [1000, 120, 200], color: 0xffddaa, intensity: 0.8, range: 1000 },
      ];
      for (const dl of dayLights) {
        const light = new THREE.PointLight(dl.color, dl.intensity, dl.range);
        light.position.set(...dl.pos);
        this.scene.add(light);
        this.objects.push(light);
      }

      // ─── NIGHT ZONE lights (south half, Z > 1000) ────────────────
      const nightLights = [
        { pos: [500, 80, 1600], color: 0x4466aa, intensity: 0.8, range: 1000 },
        { pos: [1500, 80, 1600], color: 0x4466aa, intensity: 0.8, range: 1000 },
      ];
      for (const nl of nightLights) {
        const light = new THREE.PointLight(nl.color, nl.intensity, nl.range);
        light.position.set(...nl.pos);
        this.scene.add(light);
        this.objects.push(light);
      }

      // Corner accent lights (north bright, south dimmer)
      const cornerLights = [
        { pos: [200, 60, 200], color: 0x4466ff, intensity: 0.8, range: 800 },
        { pos: [W - 200, 60, 200], color: 0xffaa44, intensity: 0.8, range: 800 },
        { pos: [200, 60, H - 200], color: 0x44ff88, intensity: 0.4, range: 600 },
        { pos: [W - 200, 60, H - 200], color: 0x6644aa, intensity: 0.4, range: 600 },
      ];
      for (const cl of cornerLights) {
        const light = new THREE.PointLight(cl.color, cl.intensity, cl.range);
        light.position.set(...cl.pos);
        this.scene.add(light);
        this.objects.push(light);
      }
    }

    // Atmospheric fog (denser on LOW to hide reduced detail)
    const baseFog = this.mapConfig.fogDensity || 0.00025;
    const fogDensity = this.quality === Quality.LOW ? baseFog * 2 : baseFog;
    this.scene.fog = new THREE.FogExp2(0x1a2a3a, fogDensity);

    // Day/Night cycle system
    this.timeOfDay = new TimeOfDaySystem(
      this.dirLight, this.ambient, this.hemi, this.scene, this.renderer
    );
  }

  showLandingMarker(x, z) {
    if (!this._landingMarker) {
      const ringGeo = new THREE.RingGeometry(18, 22, 32);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 1.5,
        transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false
      });
      this._landingMarker = new THREE.Mesh(ringGeo, ringMat);
      this._landingMarker.rotation.x = -Math.PI / 2;
      this._landingMarker.position.y = 0.5;
      this.scene.add(this._landingMarker);

      // Inner dot
      const dotGeo = new THREE.CircleGeometry(4, 16);
      const dotMat = new THREE.MeshStandardMaterial({
        color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 2.0,
        transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false
      });
      this._landingDot = new THREE.Mesh(dotGeo, dotMat);
      this._landingDot.rotation.x = -Math.PI / 2;
      this._landingDot.position.y = 0.6;
      this.scene.add(this._landingDot);
    }
    this._landingMarker.position.x = x;
    this._landingMarker.position.z = z;
    this._landingDot.position.x = x;
    this._landingDot.position.z = z;
    this._landingMarker.visible = true;
    this._landingDot.visible = true;
  }

  hideLandingMarker() {
    if (this._landingMarker) this._landingMarker.visible = false;
    if (this._landingDot) this._landingDot.visible = false;
  }

  updateSky(dt) {
    if (this._skyMaterial) {
      this._skyMaterial.uniforms.uTime.value += dt;
      if (this.timeOfDay) {
        this._skyMaterial.uniforms.uDayFactor.value = this.timeOfDay.getDayFactor();
      }
    }
  }

  updateTimeOfDay(dt) {
    if (this.timeOfDay) {
      this.timeOfDay.update(dt);
    }
  }

  updateWater(dt) {
    if (this._waterMaterial) {
      this._waterMaterial.uniforms.uTime.value += dt;
    }
  }

  updateLightTarget(x, z) {
    if (this.dirLight) {
      this.dirLight.position.set(x + 300, 1000, z + 300);
      this.dirLight.target.position.set(x, 0, z);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  destroy() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.objects = [];
  }
}
