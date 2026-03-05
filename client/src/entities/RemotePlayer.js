import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { CharacterFactory } from './CharacterFactory.js';

const INTERPOLATION_DELAY = 100;

// Shared team materials - avoids creating duplicate materials per player
const TEAM_MATERIALS = new Map();
function getTeamMaterial(team) {
  if (!team) return null;
  if (TEAM_MATERIALS.has(team)) return TEAM_MATERIALS.get(team);
  const teamColors = { red: 0xff4444, blue: 0x4444ff, orange: 0xffaa00 };
  const tintColor = teamColors[team] || 0xffffff;
  const mat = new THREE.MeshStandardMaterial({ color: tintColor, roughness: 0.6, metalness: 0.3 });
  TEAM_MATERIALS.set(team, mat);
  return mat;
}

export class RemotePlayer {
  constructor(game, id, x, y, team) {
    this.game = game;
    this.scene = game.renderer.scene;
    this.id = id;
    this.team = team;

    // State
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.health = GameConfig.PLAYER_MAX_HEALTH;
    this.maxHealth = GameConfig.PLAYER_MAX_HEALTH;
    this.alive = true;

    // Ring buffer for snapshots - O(1) vs O(n) for shift()
    this._snapshots = new Array(10);
    this._snapshotHead = 0;
    this._snapshotCount = 0;

    // 3D model
    this.group = CharacterFactory.createPlayer(game.assets);
    this.group.position.set(x, 0, y);

    // Team color tint - uses shared materials
    if (team) {
      const tintMat = getTeamMaterial(team);
      this.group.traverse(child => {
        if (child.isMesh) child.material = tintMat;
      });
    }

    this.scene.add(this.group);

    // Shadow
    const shadowGeo = new THREE.CircleGeometry(12, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(x, 0.5, y);
    this.scene.add(this.shadow);
  }

  addSnapshot(state) {
    // Ring buffer insert - O(1) instead of shift() O(n)
    this._snapshots[this._snapshotHead] = {
      x: state.x,
      y: state.y,
      rotation: state.rotation,
      health: state.health,
      alive: state.alive,
      timestamp: Date.now()
    };
    this._snapshotHead = (this._snapshotHead + 1) % 10;
    if (this._snapshotCount < 10) this._snapshotCount++;

    this.health = state.health;
    this.maxHealth = state.maxHealth;
    this.alive = state.alive;
    this.group.visible = state.alive;
    this.shadow.visible = state.alive;
  }

  // Get snapshots in chronological order from ring buffer
  _getOrderedSnapshots() {
    if (this._snapshotCount === 0) return [];
    const result = [];
    const start = (this._snapshotHead - this._snapshotCount + 10) % 10;
    for (let i = 0; i < this._snapshotCount; i++) {
      result.push(this._snapshots[(start + i) % 10]);
    }
    return result;
  }

  interpolate() {
    if (this._snapshotCount < 2) {
      if (this._snapshotCount === 1) {
        const s = this._snapshots[(this._snapshotHead - 1 + 10) % 10];
        this.x = s.x;
        this.y = s.y;
        this.rotation = s.rotation;
        this._syncModel();
      }
      return;
    }

    const snapshots = this._getOrderedSnapshots();
    const renderTime = Date.now() - INTERPOLATION_DELAY;
    let i = 0;
    while (i < snapshots.length - 1 && snapshots[i + 1].timestamp <= renderTime) {
      i++;
    }

    if (i < snapshots.length - 1) {
      const a = snapshots[i];
      const b = snapshots[i + 1];
      const range = b.timestamp - a.timestamp;
      const t = range > 0 ? Math.max(0, Math.min(1, (renderTime - a.timestamp) / range)) : 1;

      this.x = a.x + (b.x - a.x) * t;
      this.y = a.y + (b.y - a.y) * t;
      this.rotation = this._lerpAngle(a.rotation, b.rotation, t);
    } else {
      const last = snapshots[snapshots.length - 1];
      this.x = last.x;
      this.y = last.y;
      this.rotation = last.rotation;
    }

    this._syncModel();
  }

  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  _syncModel() {
    this.group.position.set(this.x, 0, this.y);
    this.group.rotation.y = -this.rotation + Math.PI / 2;
    this.shadow.position.set(this.x, 0.5, this.y);
  }

  destroy() {
    this.scene.remove(this.group);
    this.scene.remove(this.shadow);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
    });
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
