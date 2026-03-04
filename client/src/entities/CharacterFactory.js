import * as THREE from 'three';

export class CharacterFactory {
  static createPlayer(assets) {
    const group = new THREE.Group();

    const bodyMat = assets.getMaterial('playerBody');
    const headMat = assets.getMaterial('playerHead');
    const visorMat = assets.getMaterial('playerVisor');
    const gunMat = assets.getMaterial('playerGun');
    const bootMat = assets.getMaterial('playerBoots');

    // Legs (capsule geometry for smoother look)
    const legGeo = new THREE.CapsuleGeometry(2.5, 7, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, bootMat);
    leftLeg.position.set(-4, 6, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bootMat);
    rightLeg.position.set(4, 6, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Torso (cylinder for tactical vest look)
    const torsoGeo = new THREE.CylinderGeometry(5, 6, 12, 8);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.set(0, 16, 0);
    torso.castShadow = true;
    group.add(torso);

    // Chest plate (front armor detail)
    const chestGeo = new THREE.BoxGeometry(9, 8, 2);
    const chest = new THREE.Mesh(chestGeo, bodyMat);
    chest.position.set(0, 17, 4);
    chest.castShadow = true;
    group.add(chest);

    // Arms (capsule geometry)
    const armGeo = new THREE.CapsuleGeometry(2, 8, 4, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-8, 16, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(8, 16, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Head (sphere with helmet shape)
    const headGeo = new THREE.SphereGeometry(5, 12, 10);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 27, 0);
    head.castShadow = true;
    group.add(head);

    // Helmet rim
    const rimGeo = new THREE.TorusGeometry(5, 1, 6, 12, Math.PI);
    const rim = new THREE.Mesh(rimGeo, headMat);
    rim.position.set(0, 26, 0);
    rim.rotation.x = -Math.PI / 2;
    rim.rotation.z = Math.PI;
    group.add(rim);

    // Visor (wider, curved look)
    const visorGeo = new THREE.BoxGeometry(8, 2.5, 2);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 27, 4.5);
    group.add(visor);

    // Gun (detailed barrel with grip)
    const gunBarrelGeo = new THREE.CylinderGeometry(1.2, 1.5, 18, 8);
    const gunBarrel = new THREE.Mesh(gunBarrelGeo, gunMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(8, 14, 12);
    gunBarrel.castShadow = true;
    group.add(gunBarrel);

    // Gun grip
    const gripGeo = new THREE.BoxGeometry(2, 5, 3);
    const grip = new THREE.Mesh(gripGeo, gunMat);
    grip.position.set(8, 12, 5);
    group.add(grip);

    // Muzzle tip (emissive ring)
    const muzzleGeo = new THREE.TorusGeometry(1.5, 0.3, 6, 8);
    const muzzleMat = new THREE.MeshStandardMaterial({
      color: 0x666666, emissive: 0x443300, emissiveIntensity: 0.5, metalness: 0.9
    });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.position.set(8, 14, 21);
    group.add(muzzle);

    return group;
  }

  static createBot(type, assets) {
    const group = new THREE.Group();
    const mat = assets.getBotMaterial(type);
    const eyeMat = assets.getBotEyeMaterial(type);

    const configs = {
      GRUNT:  { scale: 1.0, torsoR: 5, torsoH: 12, headR: 5, gunL: 12 },
      FAST:   { scale: 0.85, torsoR: 4, torsoH: 10, headR: 4, gunL: 10 },
      TANK:   { scale: 1.4, torsoR: 7, torsoH: 14, headR: 6, gunL: 14 },
      SNIPER: { scale: 1.0, torsoR: 4.5, torsoH: 12, headR: 4.5, gunL: 22 },
      BOSS:   { scale: 2.0, torsoR: 8, torsoH: 16, headR: 7, gunL: 16 },
    };
    const cfg = configs[type] || configs.GRUNT;
    const s = cfg.scale;

    // Legs (capsules)
    const legGeo = new THREE.CapsuleGeometry(2.5 * s, 7 * s, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, mat);
    leftLeg.position.set(-4 * s, 6 * s, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, mat);
    rightLeg.position.set(4 * s, 6 * s, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Torso (cylinder)
    const torsoGeo = new THREE.CylinderGeometry(cfg.torsoR * 0.9, cfg.torsoR, cfg.torsoH, 8);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.set(0, (10 + cfg.torsoH / 2) * s, 0);
    torso.castShadow = true;
    group.add(torso);

    // Arms (capsules)
    const armGeo = new THREE.CapsuleGeometry(2 * s, 8 * s, 4, 8);
    const leftArm = new THREE.Mesh(armGeo, mat);
    leftArm.position.set(-(cfg.torsoR + 2 * s), (10 + cfg.torsoH / 2) * s, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, mat);
    rightArm.position.set((cfg.torsoR + 2 * s), (10 + cfg.torsoH / 2) * s, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Head
    let headMesh;
    if (type === 'SNIPER') {
      // Hood / pointed helmet
      const hoodGeo = new THREE.ConeGeometry(cfg.headR, cfg.headR * 2.5, 6);
      headMesh = new THREE.Mesh(hoodGeo, mat);
      // Add face plate
      const facePlate = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.headR * 1.2, cfg.headR * 0.6, 1),
        eyeMat
      );
      facePlate.position.set(0, -cfg.headR * 0.3, cfg.headR * 0.7);
      headMesh.add(facePlate);
    } else {
      const headGeo = new THREE.SphereGeometry(cfg.headR, 10, 8);
      headMesh = new THREE.Mesh(headGeo, mat);
    }
    headMesh.position.set(0, (10 + cfg.torsoH + cfg.headR) * s, 0);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Eyes (emissive for bloom glow)
    if (type !== 'SNIPER') {
      const eyeGeo = new THREE.SphereGeometry(cfg.headR * 0.25, 8, 8);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, (10 + cfg.torsoH + cfg.headR) * s, cfg.headR * 0.85);
      group.add(eye);

      if (type === 'BOSS') {
        const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
        eye2.position.set(4, (10 + cfg.torsoH + cfg.headR) * s, cfg.headR * 0.75);
        group.add(eye2);
        eye.position.x = -4;
      }
    }

    // Type-specific details
    if (type === 'BOSS') {
      // Crown spikes
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 1.5, metalness: 0.8
      });
      for (let i = 0; i < 5; i++) {
        const crownGeo = new THREE.ConeGeometry(1.5, 6, 4);
        const crown = new THREE.Mesh(crownGeo, crownMat);
        const angle = (i / 5) * Math.PI * 2;
        crown.position.set(
          Math.cos(angle) * 5,
          (10 + cfg.torsoH + cfg.headR * 2 + 2) * s,
          Math.sin(angle) * 5
        );
        group.add(crown);
      }
    }

    if (type === 'TANK') {
      // Heavy shoulder armor plates
      const padGeo = new THREE.BoxGeometry(10, 5, 10);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x555566, roughness: 0.5, metalness: 0.6
      });
      const leftPad = new THREE.Mesh(padGeo, padMat);
      leftPad.position.set(-(cfg.torsoR + 5), (10 + cfg.torsoH) * s, 0);
      leftPad.castShadow = true;
      group.add(leftPad);

      const rightPad = new THREE.Mesh(padGeo, padMat);
      rightPad.position.set((cfg.torsoR + 5), (10 + cfg.torsoH) * s, 0);
      rightPad.castShadow = true;
      group.add(rightPad);

      // Chest plate
      const chestGeo = new THREE.BoxGeometry(cfg.torsoR * 1.8, cfg.torsoH * 0.6, 3);
      const chestPlate = new THREE.Mesh(chestGeo, padMat);
      chestPlate.position.set(0, (10 + cfg.torsoH / 2) * s, cfg.torsoR * 0.8);
      group.add(chestPlate);
    }

    if (type === 'FAST') {
      // Streamlined back fin
      const finGeo = new THREE.BoxGeometry(1, 8 * s, 6 * s);
      const finMat = new THREE.MeshStandardMaterial({
        color: 0x888800, emissive: 0x444400, emissiveIntensity: 0.5
      });
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.set(0, (10 + cfg.torsoH * 0.7) * s, -4 * s);
      group.add(fin);
    }

    // Gun (cylindrical barrel)
    const gunGeo = new THREE.CylinderGeometry(1.2 * s, 1.5 * s, cfg.gunL, 8);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.7 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.rotation.x = Math.PI / 2;
    gun.position.set((cfg.torsoR + 2 * s), (10 + cfg.torsoH / 2) * s, cfg.gunL / 2);
    gun.castShadow = true;
    group.add(gun);

    return group;
  }
}
