import * as THREE from 'three';

export class CharacterFactory {
  static createPlayer(assets) {
    const group = new THREE.Group();

    const bodyMat = assets.getMaterial('playerBody');
    const headMat = assets.getMaterial('playerHead');
    const visorMat = assets.getMaterial('playerVisor');
    const gunMat = assets.getMaterial('playerGun');
    const bootMat = assets.getMaterial('playerBoots');

    // Legs (two cylinders)
    const legGeo = new THREE.BoxGeometry(4, 10, 4);
    const leftLeg = new THREE.Mesh(legGeo, bootMat);
    leftLeg.position.set(-4, 5, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bootMat);
    rightLeg.position.set(4, 5, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(12, 12, 8);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.set(0, 16, 0);
    torso.castShadow = true;
    group.add(torso);

    // Arms
    const armGeo = new THREE.BoxGeometry(4, 10, 4);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-10, 16, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(10, 16, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Head (sphere with helmet)
    const headGeo = new THREE.SphereGeometry(5, 8, 8);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 27, 0);
    head.castShadow = true;
    group.add(head);

    // Visor
    const visorGeo = new THREE.BoxGeometry(8, 2, 2);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 27, 4);
    group.add(visor);

    // Gun (attached to right arm, pointing forward)
    const gunGeo = new THREE.BoxGeometry(3, 3, 16);
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(10, 16, 10);
    gun.castShadow = true;
    group.add(gun);

    return group;
  }

  static createBot(type, assets) {
    const group = new THREE.Group();
    const mat = assets.getBotMaterial(type);
    const eyeMat = assets.getBotEyeMaterial(type);

    const configs = {
      GRUNT:  { scale: 1.0, torsoW: 12, torsoH: 12, headR: 5, gunL: 12 },
      FAST:   { scale: 0.85, torsoW: 10, torsoH: 10, headR: 4, gunL: 10 },
      TANK:   { scale: 1.4, torsoW: 16, torsoH: 14, headR: 6, gunL: 14 },
      SNIPER: { scale: 1.0, torsoW: 10, torsoH: 12, headR: 4.5, gunL: 20 },
      BOSS:   { scale: 2.0, torsoW: 18, torsoH: 16, headR: 7, gunL: 16 },
    };
    const cfg = configs[type] || configs.GRUNT;

    // Legs
    const legGeo = new THREE.BoxGeometry(4 * cfg.scale, 10 * cfg.scale, 4 * cfg.scale);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-4 * cfg.scale, 5 * cfg.scale, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(4 * cfg.scale, 5 * cfg.scale, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(cfg.torsoW, cfg.torsoH, 8 * cfg.scale);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.set(0, (10 + cfg.torsoH / 2) * cfg.scale, 0);
    torso.castShadow = true;
    group.add(torso);

    // Arms
    const armGeo = new THREE.BoxGeometry(4 * cfg.scale, 10 * cfg.scale, 4 * cfg.scale);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-(cfg.torsoW / 2 + 2 * cfg.scale), (10 + cfg.torsoH / 2) * cfg.scale, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set((cfg.torsoW / 2 + 2 * cfg.scale), (10 + cfg.torsoH / 2) * cfg.scale, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Head
    let headMesh;
    if (type === 'SNIPER') {
      // Cone hood for sniper
      const coneGeo = new THREE.ConeGeometry(cfg.headR, cfg.headR * 2.5, 6);
      headMesh = new THREE.Mesh(coneGeo, mat);
    } else {
      const headGeo = new THREE.SphereGeometry(cfg.headR, 8, 8);
      headMesh = new THREE.Mesh(headGeo, mat);
    }
    headMesh.position.set(0, (10 + cfg.torsoH + cfg.headR) * cfg.scale, 0);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Eye(s)
    const eyeGeo = new THREE.SphereGeometry(cfg.headR * 0.3, 6, 6);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, (10 + cfg.torsoH + cfg.headR) * cfg.scale, cfg.headR * 0.8);
    group.add(eye);

    if (type === 'BOSS') {
      // Dual eyes for boss
      const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
      eye2.position.set(4, (10 + cfg.torsoH + cfg.headR) * cfg.scale, cfg.headR * 0.7);
      group.add(eye2);
      eye.position.x = -4;

      // Crown
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.3, metalness: 0.8 });
      for (let i = 0; i < 3; i++) {
        const crownGeo = new THREE.ConeGeometry(2, 8, 4);
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set((i - 1) * 6, (10 + cfg.torsoH + cfg.headR * 2 + 4) * cfg.scale, 0);
        group.add(crown);
      }
    }

    if (type === 'TANK') {
      // Shoulder pads
      const padGeo = new THREE.BoxGeometry(8, 4, 8);
      const padMat = assets.getBotMaterial('TANK');
      const leftPad = new THREE.Mesh(padGeo, padMat);
      leftPad.position.set(-(cfg.torsoW / 2 + 4), (10 + cfg.torsoH) * cfg.scale, 0);
      leftPad.castShadow = true;
      group.add(leftPad);
      const rightPad = new THREE.Mesh(padGeo, padMat);
      rightPad.position.set((cfg.torsoW / 2 + 4), (10 + cfg.torsoH) * cfg.scale, 0);
      rightPad.castShadow = true;
      group.add(rightPad);
    }

    // Gun
    const gunGeo = new THREE.BoxGeometry(2 * cfg.scale, 2 * cfg.scale, cfg.gunL);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.6 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set((cfg.torsoW / 2 + 2 * cfg.scale), (10 + cfg.torsoH / 2) * cfg.scale, cfg.gunL / 2);
    gun.castShadow = true;
    group.add(gun);

    return group;
  }
}
