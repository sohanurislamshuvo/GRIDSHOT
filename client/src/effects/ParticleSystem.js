import * as THREE from 'three';

const MAX_PARTICLES = 500;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this._particles = [];

    // Use individual small meshes for particles (simple approach)
    this._pool = [];
    const geo = new THREE.SphereGeometry(1, 4, 4);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this._pool.push({
        mesh,
        mat,
        active: false,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        startSize: 1
      });
    }
  }

  emit(x, y, z, options = {}) {
    const count = options.count || 1;
    const speed = options.speed || 50;
    const color = options.color || 0xffffff;
    const lifetime = options.lifetime || 0.5;
    const size = options.size || 2;

    for (let i = 0; i < count; i++) {
      const p = this._getAvailable();
      if (!p) break;

      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.set(size, size, size);
      p.mat.color.setHex(color);
      p.mat.opacity = 1;
      p.startSize = size;
      p.life = 0;
      p.maxLife = lifetime;

      // Random direction
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.5 + Math.random() * 0.5);
      p.vx = Math.cos(angle) * Math.cos(elevation) * s;
      p.vy = Math.sin(elevation) * s;
      p.vz = Math.sin(angle) * Math.cos(elevation) * s;
    }
  }

  update(dt) {
    for (const p of this._pool) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const t = p.life / p.maxLife;

      // Move
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      // Gravity
      p.vy -= 50 * dt;

      // Fade and shrink
      p.mat.opacity = 1 - t;
      const scale = p.startSize * (1 - t * 0.5);
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  _getAvailable() {
    for (const p of this._pool) {
      if (!p.active) return p;
    }
    return null;
  }

  clear() {
    for (const p of this._pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  dispose() {
    for (const p of this._pool) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    if (this._pool.length > 0) {
      this._pool[0].mesh.geometry.dispose();
    }
  }
}
