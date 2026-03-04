import * as THREE from 'three';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { CharacterFactory } from './CharacterFactory.js';

const INTERPOLATION_DELAY = 100;

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

    // Snapshot buffer
    this._snapshots = [];

    // 3D model
    this.group = CharacterFactory.createPlayer(game.assets);
    this.group.position.set(x, 0, y);

    // Team color tint
    if (team) {
      const teamColors = { red: 0xff4444, blue: 0x4444ff, orange: 0xffaa00 };
      const tintColor = teamColors[team] || 0xffffff;
      const tintMat = new THREE.MeshStandardMaterial({ color: tintColor, roughness: 0.6, metalness: 0.3 });
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
    this._snapshots.push({
      x: state.x,
      y: state.y,
      rotation: state.rotation,
      health: state.health,
      alive: state.alive,
      timestamp: Date.now()
    });
    if (this._snapshots.length > 10) this._snapshots.shift();

    this.health = state.health;
    this.maxHealth = state.maxHealth;
    this.alive = state.alive;
    this.group.visible = state.alive;
    this.shadow.visible = state.alive;
  }

  interpolate() {
    if (this._snapshots.length < 2) {
      if (this._snapshots.length === 1) {
        const s = this._snapshots[0];
        this.x = s.x;
        this.y = s.y;
        this.rotation = s.rotation;
        this._syncModel();
      }
      return;
    }

    const renderTime = Date.now() - INTERPOLATION_DELAY;
    let i = 0;
    while (i < this._snapshots.length - 1 && this._snapshots[i + 1].timestamp <= renderTime) {
      i++;
    }

    if (i < this._snapshots.length - 1) {
      const a = this._snapshots[i];
      const b = this._snapshots[i + 1];
      const range = b.timestamp - a.timestamp;
      const t = range > 0 ? Math.max(0, Math.min(1, (renderTime - a.timestamp) / range)) : 1;

      this.x = a.x + (b.x - a.x) * t;
      this.y = a.y + (b.y - a.y) * t;
      this.rotation = this._lerpAngle(a.rotation, b.rotation, t);
    } else {
      const last = this._snapshots[this._snapshots.length - 1];
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
