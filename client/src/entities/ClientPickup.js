import * as THREE from 'three';
import { PickupType, PickupConfig } from 'shadow-arena-shared/entities/PickupEntity.js';

const PICKUP_ICONS = {
  [PickupType.WEAPON_SMG]: 'gun',
  [PickupType.WEAPON_SHOTGUN]: 'gun',
  [PickupType.WEAPON_SNIPER]: 'gun',
  [PickupType.HEALTH]: 'cross',
  [PickupType.SHIELD]: 'diamond',
};

export class ClientPickup {
  constructor(scene, id, x, y, pickupType) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;
    this.pickupType = pickupType;
    this.alive = true;
    this._phase = Math.random() * Math.PI * 2; // random start phase for bob

    const config = PickupConfig[pickupType] || PickupConfig[PickupType.HEALTH];
    const color = config.color;

    // Create pickup group
    this.group = new THREE.Group();

    // Icon mesh based on type
    const icon = PICKUP_ICONS[pickupType] || 'cross';
    let iconGeo;
    if (icon === 'gun') {
      iconGeo = new THREE.BoxGeometry(6, 3, 2);
    } else if (icon === 'cross') {
      iconGeo = new THREE.BoxGeometry(4, 8, 2);
    } else {
      iconGeo = new THREE.OctahedronGeometry(4, 0);
    }

    const iconMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.4
    });

    this._iconMesh = new THREE.Mesh(iconGeo, iconMat);
    this.group.add(this._iconMesh);

    // Cross pickup gets a second bar
    if (icon === 'cross') {
      const barGeo = new THREE.BoxGeometry(8, 3, 2);
      const bar = new THREE.Mesh(barGeo, iconMat);
      this.group.add(bar);
    }

    // Outer glow ring
    const ringGeo = new THREE.RingGeometry(6, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this._ring = new THREE.Mesh(ringGeo, ringMat);
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.y = -8;
    this.group.add(this._ring);

    this.group.position.set(x, 15, y);
    this.scene.add(this.group);
  }

  update(dt) {
    if (!this.alive) return;

    this._phase += dt * 2.5;

    // Floating bob
    this.group.position.y = 15 + Math.sin(this._phase) * 3;

    // Slow rotation
    this._iconMesh.rotation.y += dt * 1.5;

    // Ring pulse
    const pulse = 0.2 + Math.sin(this._phase * 1.5) * 0.1;
    this._ring.material.opacity = pulse;
  }

  setAlive(alive) {
    this.alive = alive;
    this.group.visible = alive;
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
