export const WeaponType = {
  AUTO_RIFLE: 'auto_rifle',
  PISTOL: 'pistol',
  SMG: 'smg',
  SHOTGUN: 'shotgun',
  SNIPER: 'sniper'
};

export const WeaponConfig = {
  [WeaponType.AUTO_RIFLE]: {
    name: 'Auto Rifle',
    damage: 15,
    fireRate: 5,
    bulletSpeed: 500,
    bulletRadius: 4,
    bulletLifetime: 2000,
    spread: 0.03,
    projectileCount: 1,
    tracerColor: 0xffff00,
    tracerLength: 12,
    unlockLevel: 1
  },
  [WeaponType.PISTOL]: {
    name: 'Pistol',
    damage: 20,
    fireRate: 3,
    bulletSpeed: 550,
    bulletRadius: 4,
    bulletLifetime: 2000,
    spread: 0.02,
    projectileCount: 1,
    tracerColor: 0xffcc44,
    tracerLength: 10,
    unlockLevel: 1
  },
  [WeaponType.SMG]: {
    name: 'SMG',
    damage: 8,
    fireRate: 10,
    bulletSpeed: 450,
    bulletRadius: 3,
    bulletLifetime: 1500,
    spread: 0.06,
    projectileCount: 1,
    tracerColor: 0xffff88,
    tracerLength: 8,
    unlockLevel: 2
  },
  [WeaponType.SHOTGUN]: {
    name: 'Shotgun',
    damage: 8,
    fireRate: 1.5,
    bulletSpeed: 400,
    bulletRadius: 3,
    bulletLifetime: 800,
    spread: 0.15,
    projectileCount: 6,
    tracerColor: 0xff8844,
    tracerLength: 8,
    unlockLevel: 3
  },
  [WeaponType.SNIPER]: {
    name: 'Sniper',
    damage: 60,
    fireRate: 0.8,
    bulletSpeed: 900,
    bulletRadius: 3,
    bulletLifetime: 3000,
    spread: 0.005,
    projectileCount: 1,
    tracerColor: 0x44ffff,
    tracerLength: 18,
    unlockLevel: 5
  }
};
