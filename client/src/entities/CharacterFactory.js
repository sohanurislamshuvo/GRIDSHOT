import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SkinConfig } from 'shadow-arena-shared/config/CosmeticConfig.js';

// Gun part tag for identifying removable gun meshes
const GUN_TAG = '__gun__';

export class CharacterFactory {
  static createPlayer(assets, weaponType = 'auto_rifle', skinId = 'default') {
    const group = new THREE.Group();
    const skin = SkinConfig[skinId] || SkinConfig.default;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: skin.bodyColor,
      emissive: skin.emissiveColor,
      emissiveIntensity: 0.3,
      roughness: skin.roughness,
      metalness: skin.metalness
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: skin.headColor,
      roughness: skin.roughness + 0.1,
      metalness: skin.metalness
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: skin.visorColor,
      emissive: skin.visorColor,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: skin.bootColor,
      roughness: 0.7,
      metalness: 0.3
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: skin.accentColor, roughness: 0.5, metalness: 0.6
    });

    // Store skin id on group for trail effects
    group.userData.skinId = skinId;

    // === children[0]: leftLeg ===
    const legGeo = new THREE.CapsuleGeometry(2.5, 7, 4, 8);
    const leftLeg = new THREE.Mesh(legGeo, bootMat);
    leftLeg.position.set(-4, 6, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    // === children[1]: rightLeg ===
    const rightLeg = new THREE.Mesh(legGeo, bootMat);
    rightLeg.position.set(4, 6, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // === children[2]: torso ===
    const torsoGeo = new THREE.CylinderGeometry(5, 6, 12, 8);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.set(0, 16, 0);
    torso.castShadow = true;
    group.add(torso);

    // === children[3]: chest plate ===
    const chestGeo = new THREE.BoxGeometry(9, 8, 2);
    const chest = new THREE.Mesh(chestGeo, bodyMat);
    chest.position.set(0, 17, 4);
    chest.castShadow = true;
    group.add(chest);

    // === children[4]: leftArm ===
    const armGeo = new THREE.CapsuleGeometry(2, 8, 4, 8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-8, 16, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    // === children[5]: rightArm ===
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(8, 16, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // === Merged static geometry (reduces draw calls) ===
    // Head group (headMat): head sphere + helmet rim
    const headGeos = [];
    const hg1 = new THREE.SphereGeometry(5, 12, 10);
    hg1.translate(0, 27, 0);
    headGeos.push(hg1);
    const hg2 = new THREE.TorusGeometry(5, 1, 6, 12, Math.PI);
    hg2.rotateX(-Math.PI / 2);
    hg2.rotateZ(Math.PI);
    hg2.translate(0, 26, 0);
    headGeos.push(hg2);
    const mergedHead = new THREE.Mesh(mergeGeometries(headGeos), headMat);
    mergedHead.castShadow = true;
    group.add(mergedHead);

    // Visor (standalone material)
    const visorGeo = new THREE.BoxGeometry(8, 2.5, 2);
    visorGeo.translate(0, 27, 4.5);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    group.add(visor);

    // Accent group (accentMat): shoulder pads, belt, pouches, backpack, knee guards
    const accentGeos = [];
    const ag1 = new THREE.BoxGeometry(5, 2, 5); ag1.translate(-9, 21, 0); accentGeos.push(ag1);
    const ag2 = new THREE.BoxGeometry(5, 2, 5); ag2.translate(9, 21, 0); accentGeos.push(ag2);
    const ag3 = new THREE.TorusGeometry(6, 0.8, 4, 12); ag3.rotateX(Math.PI / 2); ag3.translate(0, 11, 0); accentGeos.push(ag3);
    const ag4 = new THREE.BoxGeometry(2.5, 3, 2); ag4.translate(-5, 11, 3); accentGeos.push(ag4);
    const ag5 = new THREE.BoxGeometry(2.5, 3, 2); ag5.translate(5, 11, 3); accentGeos.push(ag5);
    const ag6 = new THREE.BoxGeometry(7, 8, 4); ag6.translate(0, 17, -5); accentGeos.push(ag6);
    const ag7 = new THREE.SphereGeometry(1.5, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2); ag7.translate(-4, 6, 2.5); accentGeos.push(ag7);
    const ag8 = new THREE.SphereGeometry(1.5, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2); ag8.translate(4, 6, 2.5); accentGeos.push(ag8);
    const mergedAccent = new THREE.Mesh(mergeGeometries(accentGeos), accentMat);
    mergedAccent.castShadow = true;
    group.add(mergedAccent);

    // Antenna + tip (small detail, merged into one mesh)
    const antennaGeos = [];
    const antGeo = new THREE.CylinderGeometry(0.2, 0.2, 6, 4); antGeo.translate(3, 33, -2); antennaGeos.push(antGeo);
    const tipGeo = new THREE.SphereGeometry(0.5, 6, 6); tipGeo.translate(3, 36, -2); antennaGeos.push(tipGeo);
    const antennaMat = new THREE.MeshStandardMaterial({
      color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 2.0, metalness: 0.8
    });
    const mergedAntenna = new THREE.Mesh(mergeGeometries(antennaGeos), antennaMat);
    group.add(mergedAntenna);

    // Gun (weapon-specific)
    CharacterFactory.attachGun(group, weaponType, assets);

    return group;
  }

  /** Attach weapon-specific gun model to character group */
  static attachGun(group, weaponType, assets) {
    // Remove old gun meshes
    for (let i = group.children.length - 1; i >= 0; i--) {
      if (group.children[i].userData.tag === GUN_TAG) {
        const child = group.children[i];
        group.remove(child);
        if (child.geometry) child.geometry.dispose();
      }
    }

    const gunMat = assets.getMaterial('playerGun');
    const muzzleMat = new THREE.MeshStandardMaterial({
      color: 0x666666, emissive: 0x443300, emissiveIntensity: 0.5, metalness: 0.9
    });

    const addGunPart = (mesh) => {
      mesh.userData.tag = GUN_TAG;
      group.add(mesh);
    };

    switch (weaponType) {
      case 'sniper': {
        // Long thin barrel
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 1.0, 28, 8), gunMat
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(8, 14, 16);
        barrel.castShadow = true;
        addGunPart(barrel);
        // Scope
        const scope = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.2, 6, 6), gunMat
        );
        scope.rotation.x = Math.PI / 2;
        scope.position.set(8, 17, 10);
        addGunPart(scope);
        // Scope lens
        const lens = new THREE.Mesh(
          new THREE.CircleGeometry(1.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x2244aa, emissiveIntensity: 1.5 })
        );
        lens.position.set(8, 17, 13.1);
        addGunPart(lens);
        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 3), gunMat);
        grip.position.set(8, 12, 4);
        addGunPart(grip);
        // Muzzle
        const muzzle = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.3, 6, 8), muzzleMat);
        muzzle.position.set(8, 14, 30);
        addGunPart(muzzle);
        break;
      }
      case 'shotgun': {
        // Wide short barrel
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(2.0, 2.5, 14, 8), gunMat
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(8, 14, 10);
        barrel.castShadow = true;
        addGunPart(barrel);
        // Pump grip
        const pump = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 5), gunMat);
        pump.position.set(8, 12, 7);
        addGunPart(pump);
        // Stock
        const stock = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), gunMat);
        stock.position.set(8, 14, -1);
        addGunPart(stock);
        // Muzzle
        const muzzle = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.4, 6, 8), muzzleMat);
        muzzle.position.set(8, 14, 17);
        addGunPart(muzzle);
        break;
      }
      case 'smg': {
        // Compact barrel
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.3, 10, 8), gunMat
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(8, 14, 8);
        barrel.castShadow = true;
        addGunPart(barrel);
        // Magazine
        const mag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 2), gunMat);
        mag.position.set(8, 10, 6);
        addGunPart(mag);
        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2.5), gunMat);
        grip.position.set(8, 12, 4);
        addGunPart(grip);
        // Muzzle
        const muzzle = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.3, 6, 8), muzzleMat);
        muzzle.position.set(8, 14, 13);
        addGunPart(muzzle);
        break;
      }
      case 'pistol': {
        // Short barrel
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.2, 8, 8), gunMat
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(8, 14, 7);
        barrel.castShadow = true;
        addGunPart(barrel);
        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 2.5), gunMat);
        grip.position.set(8, 11, 3);
        addGunPart(grip);
        // Muzzle
        const muzzle = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.25, 6, 8), muzzleMat);
        muzzle.position.set(8, 14, 11);
        addGunPart(muzzle);
        break;
      }
      default: { // auto_rifle
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.5, 18, 8), gunMat
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(8, 14, 12);
        barrel.castShadow = true;
        addGunPart(barrel);
        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 3), gunMat);
        grip.position.set(8, 12, 5);
        addGunPart(grip);
        // Muzzle
        const muzzle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.3, 6, 8), muzzleMat);
        muzzle.position.set(8, 14, 21);
        addGunPart(muzzle);
        break;
      }
    }
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

    // === Merged body (torso + arms + head for non-SNIPER) ===
    const bodyGeos = [];
    const tGeo = new THREE.CylinderGeometry(cfg.torsoR * 0.9, cfg.torsoR, cfg.torsoH, 8);
    tGeo.translate(0, (10 + cfg.torsoH / 2) * s, 0);
    bodyGeos.push(tGeo);

    const laGeo = new THREE.CapsuleGeometry(2 * s, 8 * s, 4, 8);
    laGeo.translate(-(cfg.torsoR + 2 * s), (10 + cfg.torsoH / 2) * s, 0);
    bodyGeos.push(laGeo);

    const raGeo = new THREE.CapsuleGeometry(2 * s, 8 * s, 4, 8);
    raGeo.translate((cfg.torsoR + 2 * s), (10 + cfg.torsoH / 2) * s, 0);
    bodyGeos.push(raGeo);

    if (type !== 'SNIPER') {
      const hGeo = new THREE.SphereGeometry(cfg.headR, 10, 8);
      hGeo.translate(0, (10 + cfg.torsoH + cfg.headR) * s, 0);
      bodyGeos.push(hGeo);
    }

    const mergedBody = new THREE.Mesh(mergeGeometries(bodyGeos), mat);
    mergedBody.castShadow = true;
    group.add(mergedBody);

    // SNIPER head (separate because it has face plate child)
    if (type === 'SNIPER') {
      const hoodGeo = new THREE.ConeGeometry(cfg.headR, cfg.headR * 2.5, 6);
      const headMesh = new THREE.Mesh(hoodGeo, mat);
      const facePlate = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.headR * 1.2, cfg.headR * 0.6, 1),
        eyeMat
      );
      facePlate.position.set(0, -cfg.headR * 0.3, cfg.headR * 0.7);
      headMesh.add(facePlate);
      headMesh.position.set(0, (10 + cfg.torsoH + cfg.headR) * s, 0);
      headMesh.castShadow = true;
      group.add(headMesh);
    }

    // === Merged eyes (eyeMat) ===
    if (type !== 'SNIPER') {
      const eyeGeos = [];
      if (type === 'BOSS') {
        const e1 = new THREE.SphereGeometry(cfg.headR * 0.25, 8, 8);
        e1.translate(-4, (10 + cfg.torsoH + cfg.headR) * s, cfg.headR * 0.85);
        eyeGeos.push(e1);
        const e2 = new THREE.SphereGeometry(cfg.headR * 0.25, 8, 8);
        e2.translate(4, (10 + cfg.torsoH + cfg.headR) * s, cfg.headR * 0.75);
        eyeGeos.push(e2);
      } else {
        const e1 = new THREE.SphereGeometry(cfg.headR * 0.25, 8, 8);
        e1.translate(0, (10 + cfg.torsoH + cfg.headR) * s, cfg.headR * 0.85);
        eyeGeos.push(e1);
      }
      const mergedEyes = new THREE.Mesh(mergeGeometries(eyeGeos), eyeMat);
      group.add(mergedEyes);
    }

    // === Type-specific merged details ===
    if (type === 'BOSS') {
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 1.5, metalness: 0.8
      });
      const crownGeos = [];
      for (let i = 0; i < 5; i++) {
        const cg = new THREE.ConeGeometry(1.5, 6, 4);
        const angle = (i / 5) * Math.PI * 2;
        cg.translate(
          Math.cos(angle) * 5,
          (10 + cfg.torsoH + cfg.headR * 2 + 2) * s,
          Math.sin(angle) * 5
        );
        crownGeos.push(cg);
      }
      const mergedCrown = new THREE.Mesh(mergeGeometries(crownGeos), crownMat);
      group.add(mergedCrown);
    }

    if (type === 'TANK') {
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x555566, roughness: 0.5, metalness: 0.6
      });
      const armorGeos = [];
      const lp = new THREE.BoxGeometry(10, 5, 10);
      lp.translate(-(cfg.torsoR + 5), (10 + cfg.torsoH) * s, 0);
      armorGeos.push(lp);
      const rp = new THREE.BoxGeometry(10, 5, 10);
      rp.translate((cfg.torsoR + 5), (10 + cfg.torsoH) * s, 0);
      armorGeos.push(rp);
      const cp = new THREE.BoxGeometry(cfg.torsoR * 1.8, cfg.torsoH * 0.6, 3);
      cp.translate(0, (10 + cfg.torsoH / 2) * s, cfg.torsoR * 0.8);
      armorGeos.push(cp);
      const mergedArmor = new THREE.Mesh(mergeGeometries(armorGeos), padMat);
      mergedArmor.castShadow = true;
      group.add(mergedArmor);
    }

    if (type === 'FAST') {
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

  /** Apply skin colors to an existing player group */
  static applySkin(group, skinId) {
    const skin = SkinConfig[skinId] || SkinConfig.default;
    group.userData.skinId = skinId;

    // children[0,1] = legs (bootMat)
    const bootMat = new THREE.MeshStandardMaterial({
      color: skin.bootColor, roughness: 0.7, metalness: 0.3
    });
    if (group.children[0]) group.children[0].material = bootMat;
    if (group.children[1]) group.children[1].material = bootMat;

    // children[2,3,4,5] = torso, chest, arms (bodyMat)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: skin.bodyColor, emissive: skin.emissiveColor,
      emissiveIntensity: 0.3, roughness: skin.roughness, metalness: skin.metalness
    });
    for (let i = 2; i <= 5; i++) {
      if (group.children[i]) group.children[i].material = bodyMat;
    }

    // children[6] = merged head (headMat)
    if (group.children[6]) {
      group.children[6].material = new THREE.MeshStandardMaterial({
        color: skin.headColor, roughness: skin.roughness + 0.1, metalness: skin.metalness
      });
    }

    // children[7] = visor
    if (group.children[7]) {
      group.children[7].material = new THREE.MeshStandardMaterial({
        color: skin.visorColor, emissive: skin.visorColor,
        emissiveIntensity: 1.5, roughness: 0.1, metalness: 0.9,
        transparent: true, opacity: 0.85
      });
    }

    // children[8] = accent
    if (group.children[8]) {
      group.children[8].material = new THREE.MeshStandardMaterial({
        color: skin.accentColor, roughness: 0.5, metalness: 0.6
      });
    }
  }
}
