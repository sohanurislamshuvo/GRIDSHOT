import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { generateWallData } from './WallGenerator.js';

export class WorldBuilder {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.objects = [];

    const wallData = generateWallData();
    this.wallGrid = wallData.grid;
    this.treePositions = []; // exported for collision

    this._buildGround();
    this._buildWalls(wallData.wallPositions);
    this._buildProps(wallData.wallPositions);
    this._buildTrees(wallData.wallPositions);
    this._buildBushes(wallData.wallPositions);
    this._buildRocks(wallData.wallPositions);
    this._buildLighting();
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(GameConfig.WORLD_WIDTH, GameConfig.WORLD_HEIGHT);
    const mat = this.assets.getMaterial('ground');
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GameConfig.WORLD_WIDTH / 2, 0, GameConfig.WORLD_HEIGHT / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.objects.push(ground);

    // World boundary edges (thin glowing lines)
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x334466,
      emissive: 0x223355,
      emissiveIntensity: 1.0,
      roughness: 0.3
    });
    const W = GameConfig.WORLD_WIDTH;
    const H = GameConfig.WORLD_HEIGHT;
    const edgeGeo = new THREE.BoxGeometry(W, 6, 4);
    const edgeGeo2 = new THREE.BoxGeometry(4, 6, H);

    const edges = [
      { geo: edgeGeo, pos: [W / 2, 3, 0] },
      { geo: edgeGeo, pos: [W / 2, 3, H] },
      { geo: edgeGeo2, pos: [0, 3, H / 2] },
      { geo: edgeGeo2, pos: [W, 3, H / 2] },
    ];
    for (const e of edges) {
      const mesh = new THREE.Mesh(e.geo, edgeMat);
      mesh.position.set(...e.pos);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.objects.push(mesh);
    }
  }

  _buildWalls(wallPositions) {
    const geo = this.assets.getGeometry('wall');
    const mat = this.assets.getMaterial('wall');
    const ts = GameConfig.TILE_SIZE;
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

  _buildProps(wallPositions) {
    const ts = GameConfig.TILE_SIZE;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));

    const props = [];
    const propTypes = ['crate', 'barrel', 'debris'];
    const gridW = Math.floor(GameConfig.WORLD_WIDTH / ts);
    const gridH = Math.floor(GameConfig.WORLD_HEIGHT / ts);

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

    for (const type of propTypes) {
      const typeProps = props.filter(p => p.type === type);
      if (typeProps.length === 0) continue;

      const geo = this.assets.getGeometry(type);
      const mat = this.assets.getMaterial(type);
      const instanced = new THREE.InstancedMesh(geo, mat, typeProps.length);
      instanced.castShadow = true;
      instanced.receiveShadow = true;

      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3(1, 1, 1);
      const p = new THREE.Vector3();

      for (let i = 0; i < typeProps.length; i++) {
        const prop = typeProps[i];
        const yOff = type === 'barrel' ? 8 : type === 'crate' ? 6 : 1;
        p.set(prop.x, yOff, prop.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotY);
        m.compose(p, q, s);
        instanced.setMatrixAt(i, m);
      }
      instanced.instanceMatrix.needsUpdate = true;
      this.scene.add(instanced);
      this.objects.push(instanced);
    }
  }

  _buildTrees(wallPositions) {
    const ts = GameConfig.TILE_SIZE;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));
    const W = GameConfig.WORLD_WIDTH;
    const H = GameConfig.WORLD_HEIGHT;
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

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const canopy1Mesh = new THREE.InstancedMesh(canopyGeo1, canopyMat, trees.length);
    const canopy2Mesh = new THREE.InstancedMesh(canopyGeo2, canopyMat, trees.length);
    const canopy3Mesh = new THREE.InstancedMesh(canopyGeo3, canopyMat, trees.length);
    trunkMesh.castShadow = true;
    canopy1Mesh.castShadow = true;
    canopy2Mesh.castShadow = true;
    canopy3Mesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const sc = t.scale;

      // Trunk
      p.set(t.x, 15 * sc, t.z);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      trunkMesh.setMatrixAt(i, m);

      // Canopy layer 1 (bottom)
      p.set(t.x, 28 * sc, t.z);
      m.compose(p, q, s);
      canopy1Mesh.setMatrixAt(i, m);

      // Canopy layer 2 (middle)
      p.set(t.x, 38 * sc, t.z);
      m.compose(p, q, s);
      canopy2Mesh.setMatrixAt(i, m);

      // Canopy layer 3 (top)
      p.set(t.x, 46 * sc, t.z);
      m.compose(p, q, s);
      canopy3Mesh.setMatrixAt(i, m);
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    canopy1Mesh.instanceMatrix.needsUpdate = true;
    canopy2Mesh.instanceMatrix.needsUpdate = true;
    canopy3Mesh.instanceMatrix.needsUpdate = true;

    this.scene.add(trunkMesh, canopy1Mesh, canopy2Mesh, canopy3Mesh);
    this.objects.push(trunkMesh, canopy1Mesh, canopy2Mesh, canopy3Mesh);
  }

  _buildBushes(wallPositions) {
    const ts = GameConfig.TILE_SIZE;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));
    const gridW = Math.floor(GameConfig.WORLD_WIDTH / ts);
    const gridH = Math.floor(GameConfig.WORLD_HEIGHT / ts);

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
    const mesh = new THREE.InstancedMesh(geo, mat, bushes.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    for (let i = 0; i < bushes.length; i++) {
      const b = bushes[i];
      p.set(b.x, 3 * b.sy, b.z);
      s.set(b.sx, b.sy, b.sz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.objects.push(mesh);
  }

  _buildRocks(wallPositions) {
    const ts = GameConfig.TILE_SIZE;
    const wallSet = new Set(wallPositions.map(wp => `${wp.x},${wp.y}`));
    const gridW = Math.floor(GameConfig.WORLD_WIDTH / ts);
    const gridH = Math.floor(GameConfig.WORLD_HEIGHT / ts);

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
    const mesh = new THREE.InstancedMesh(geo, mat, rocks.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      p.set(r.x, 2 * r.scale, r.z);
      s.set(r.scale, r.scale * 0.7, r.scale);
      euler.set(r.rotX, r.rotY, 0);
      q.setFromEuler(euler);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.objects.push(mesh);
  }

  _buildLighting() {
    // Ambient light (cool blue tone)
    const ambient = new THREE.AmbientLight(0x303050, 0.6);
    this.scene.add(ambient);
    this.objects.push(ambient);

    // Hemisphere light for sky/ground color variation
    const hemi = new THREE.HemisphereLight(0x334466, 0x111115, 0.4);
    this.scene.add(hemi);
    this.objects.push(hemi);

    // Main directional light (warm sun-like)
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
    dirLight.position.set(500, 1000, 500);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
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

    // Accent point lights at map corners
    const cornerLights = [
      { pos: [200, 60, 200], color: 0x4466ff, intensity: 0.8 },
      { pos: [GameConfig.WORLD_WIDTH - 200, 60, 200], color: 0xff4444, intensity: 0.6 },
      { pos: [200, 60, GameConfig.WORLD_HEIGHT - 200], color: 0x44ff88, intensity: 0.6 },
      { pos: [GameConfig.WORLD_WIDTH - 200, 60, GameConfig.WORLD_HEIGHT - 200], color: 0xffaa22, intensity: 0.6 },
    ];
    for (const cl of cornerLights) {
      const light = new THREE.PointLight(cl.color, cl.intensity, 800);
      light.position.set(...cl.pos);
      this.scene.add(light);
      this.objects.push(light);
    }

    // Atmospheric fog
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.00035);
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
