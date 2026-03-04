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
  }

  _buildWalls(wallPositions) {
    const geo = this.assets.getGeometry('wall');
    const mat = this.assets.getMaterial('wall');
    const ts = GameConfig.TILE_SIZE;
    const wallHeight = 24; // half of 48

    // Use InstancedMesh for performance
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
  }

  _buildLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    this.scene.add(ambient);
    this.objects.push(ambient);

    // Main directional light (sun-like)
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(500, 1000, 500);
    dirLight.castShadow = true;

    // Shadow camera covers area around player (updated by renderer)
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -600;
    dirLight.shadow.camera.right = 600;
    dirLight.shadow.camera.top = 600;
    dirLight.shadow.camera.bottom = -600;
    dirLight.shadow.camera.near = 100;
    dirLight.shadow.camera.far = 2000;
    dirLight.shadow.bias = -0.001;

    this.scene.add(dirLight);
    this.scene.add(dirLight.target);
    this.dirLight = dirLight;
    this.objects.push(dirLight);

    // Subtle fog for depth
    this.scene.fog = new THREE.FogExp2(0x111111, 0.0003);
  }

  // Update shadow camera to follow player
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
