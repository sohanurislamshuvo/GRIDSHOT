import * as THREE from 'three';

// Reusable temp objects to avoid GC pressure
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler();

export class ProjectilePool {
  constructor(scene, assets, maxPerType = 100) {
    this.scene = scene;
    this.maxPerType = maxPerType;

    const geo = assets.getGeometry('bulletTracer');

    this.playerMesh = new THREE.InstancedMesh(
      geo, assets.getMaterial('bulletPlayer'), maxPerType
    );
    this.botMesh = new THREE.InstancedMesh(
      geo, assets.getMaterial('bulletBot'), maxPerType
    );

    // Initialize all instances as hidden
    _scale.set(0, 0, 0);
    _matrix.compose(_position.set(0, -1000, 0), _quaternion.identity(), _scale);
    for (let i = 0; i < maxPerType; i++) {
      this.playerMesh.setMatrixAt(i, _matrix);
      this.botMesh.setMatrixAt(i, _matrix);
    }
    _scale.set(1, 1, 1);

    this.playerMesh.instanceMatrix.needsUpdate = true;
    this.botMesh.instanceMatrix.needsUpdate = true;

    // Disable frustum culling since bullets span the whole map
    this.playerMesh.frustumCulled = false;
    this.botMesh.frustumCulled = false;

    scene.add(this.playerMesh);
    scene.add(this.botMesh);

    // Track which slots are in use
    this._playerUsed = new Array(maxPerType).fill(false);
    this._botUsed = new Array(maxPerType).fill(false);
    this._dirty = false;
  }

  allocate(isPlayer) {
    const used = isPlayer ? this._playerUsed : this._botUsed;
    for (let i = 0; i < used.length; i++) {
      if (!used[i]) {
        used[i] = true;
        return i;
      }
    }
    return -1; // pool exhausted
  }

  release(index, isPlayer) {
    const used = isPlayer ? this._playerUsed : this._botUsed;
    const mesh = isPlayer ? this.playerMesh : this.botMesh;
    used[index] = false;

    // Hide the instance
    _scale.set(0, 0, 0);
    _matrix.compose(_position.set(0, -1000, 0), _quaternion.identity(), _scale);
    mesh.setMatrixAt(index, _matrix);
    _scale.set(1, 1, 1);
    this._dirty = true;
  }

  updateInstance(index, isPlayer, x, y, angle) {
    const mesh = isPlayer ? this.playerMesh : this.botMesh;
    _euler.set(0, -angle + Math.PI / 2, Math.PI / 2);
    _quaternion.setFromEuler(_euler);
    _matrix.compose(_position.set(x, 10, y), _quaternion, _scale);
    mesh.setMatrixAt(index, _matrix);
    this._dirty = true;
  }

  /** Call once per frame after all projectile updates */
  flush() {
    if (this._dirty) {
      this.playerMesh.instanceMatrix.needsUpdate = true;
      this.botMesh.instanceMatrix.needsUpdate = true;
      this._dirty = false;
    }
  }

  clear() {
    _scale.set(0, 0, 0);
    _matrix.compose(_position.set(0, -1000, 0), _quaternion.identity(), _scale);
    for (let i = 0; i < this.maxPerType; i++) {
      this.playerMesh.setMatrixAt(i, _matrix);
      this.botMesh.setMatrixAt(i, _matrix);
      this._playerUsed[i] = false;
      this._botUsed[i] = false;
    }
    _scale.set(1, 1, 1);
    this.playerMesh.instanceMatrix.needsUpdate = true;
    this.botMesh.instanceMatrix.needsUpdate = true;
    this._dirty = false;
  }

  destroy() {
    this.playerMesh.removeFromParent();
    this.botMesh.removeFromParent();
    this.playerMesh.dispose();
    this.botMesh.dispose();
  }
}
