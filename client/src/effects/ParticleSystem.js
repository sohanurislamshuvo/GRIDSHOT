import * as THREE from 'three';

const DEFAULT_MAX_PARTICLES = 600;

export class ParticleSystem {
  constructor(scene, maxParticles = DEFAULT_MAX_PARTICLES) {
    this.scene = scene;
    this._maxParticles = maxParticles;

    // InstancedMesh for all particles (single draw call)
    const geo = new THREE.SphereGeometry(1, 5, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false
    });
    this._instancedMesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this._instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._instancedMesh.frustumCulled = false;

    // Instance colors
    this._instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(maxParticles * 3), 3
    );
    this._instancedMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

    // Hide all by default (scale to 0)
    const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < maxParticles; i++) {
      this._instancedMesh.setMatrixAt(i, hideMatrix);
    }
    this._instancedMesh.instanceMatrix.needsUpdate = true;

    scene.add(this._instancedMesh);

    // Particle data
    this._particles = new Array(maxParticles);
    for (let i = 0; i < maxParticles; i++) {
      this._particles[i] = {
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        startSize: 1,
        opacity: 1
      };
    }

    this._matrix = new THREE.Matrix4();
    this._color = new THREE.Color();
    this._nextIndex = 0;
  }

  emit(x, y, z, options = {}) {
    const count = options.count || 1;
    const speed = options.speed || 50;
    const color = options.color || 0xffffff;
    const lifetime = options.lifetime || 0.5;
    const size = options.size || 2;

    this._color.setHex(color);

    for (let i = 0; i < count; i++) {
      const p = this._getAvailable();
      if (!p) break;

      p.active = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.startSize = size;
      p.life = 0;
      p.maxLife = lifetime;
      p.opacity = 1;

      // Random direction
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.5 + Math.random() * 0.5);
      p.vx = Math.cos(angle) * Math.cos(elevation) * s;
      p.vy = Math.sin(elevation) * s;
      p.vz = Math.sin(angle) * Math.cos(elevation) * s;

      // Set color for this instance
      this._instancedMesh.setColorAt(p.index, this._color);
    }

    if (this._instancedMesh.instanceColor) {
      this._instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  update(dt) {
    let anyActive = false;

    for (let i = 0; i < this._maxParticles; i++) {
      const p = this._particles[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        // Hide instance
        this._matrix.makeScale(0, 0, 0);
        this._instancedMesh.setMatrixAt(i, this._matrix);
        anyActive = true;
        continue;
      }

      anyActive = true;
      const t = p.life / p.maxLife;

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Gravity
      p.vy -= 50 * dt;

      // Shrink and fade
      const scale = p.startSize * (1 - t * 0.5);
      p.opacity = 1 - t;

      // Update instance matrix (position + scale)
      this._matrix.makeScale(scale, scale, scale);
      this._matrix.setPosition(p.x, p.y, p.z);
      this._instancedMesh.setMatrixAt(i, this._matrix);
    }

    if (anyActive) {
      this._instancedMesh.instanceMatrix.needsUpdate = true;
    }

    // Update global opacity via material
    this._instancedMesh.material.opacity = 1;
  }

  _getAvailable() {
    // Round-robin search
    for (let j = 0; j < this._maxParticles; j++) {
      const idx = (this._nextIndex + j) % this._maxParticles;
      if (!this._particles[idx].active) {
        this._particles[idx].index = idx;
        this._nextIndex = (idx + 1) % this._maxParticles;
        return this._particles[idx];
      }
    }
    // Overwrite oldest
    const idx = this._nextIndex;
    this._particles[idx].index = idx;
    this._nextIndex = (idx + 1) % this._maxParticles;
    return this._particles[idx];
  }

  clear() {
    const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this._maxParticles; i++) {
      this._particles[i].active = false;
      this._instancedMesh.setMatrixAt(i, hideMatrix);
    }
    this._instancedMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this._instancedMesh);
    this._instancedMesh.geometry.dispose();
    this._instancedMesh.material.dispose();
    this._instancedMesh.dispose();
  }
}
