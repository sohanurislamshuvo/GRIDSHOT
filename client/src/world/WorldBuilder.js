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

    this._buildGround();
    this._buildWalls(wallData.wallPositions);
    this._buildProps(wallData.wallPositions);
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
