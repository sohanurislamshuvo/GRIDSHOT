export const SkinConfig = {
  default: {
    name: 'Operative',
    bodyColor: 0x2244aa,
    headColor: 0x334455,
    visorColor: 0x44aaff,
    bootColor: 0x222233,
    accentColor: 0x555566,
    emissiveColor: 0x112244,
    metalness: 0.4,
    roughness: 0.6,
    unlockLevel: 1
  },
  crimson: {
    name: 'Crimson',
    bodyColor: 0x882222,
    headColor: 0x443333,
    visorColor: 0xff4444,
    bootColor: 0x332222,
    accentColor: 0x664444,
    emissiveColor: 0x441111,
    metalness: 0.4,
    roughness: 0.6,
    unlockLevel: 3
  },
  ghost: {
    name: 'Ghost',
    bodyColor: 0xcccccc,
    headColor: 0xdddddd,
    visorColor: 0xaaffaa,
    bootColor: 0x999999,
    accentColor: 0xaaaaaa,
    emissiveColor: 0x224422,
    metalness: 0.3,
    roughness: 0.4,
    unlockLevel: 5
  },
  venom: {
    name: 'Venom',
    bodyColor: 0x115511,
    headColor: 0x223322,
    visorColor: 0x44ff44,
    bootColor: 0x112211,
    accentColor: 0x336633,
    emissiveColor: 0x114411,
    metalness: 0.5,
    roughness: 0.5,
    unlockLevel: 7
  },
  solar: {
    name: 'Solar',
    bodyColor: 0xbb6600,
    headColor: 0x885500,
    visorColor: 0xffaa00,
    bootColor: 0x553300,
    accentColor: 0x996633,
    emissiveColor: 0x442200,
    metalness: 0.6,
    roughness: 0.4,
    unlockLevel: 10
  },
  void: {
    name: 'Void',
    bodyColor: 0x220044,
    headColor: 0x110033,
    visorColor: 0xaa44ff,
    bootColor: 0x110022,
    accentColor: 0x443366,
    emissiveColor: 0x220044,
    metalness: 0.7,
    roughness: 0.3,
    unlockLevel: 12
  },
  gold: {
    name: 'Gold Elite',
    bodyColor: 0xaa8800,
    headColor: 0xccaa00,
    visorColor: 0xffdd44,
    bootColor: 0x665500,
    accentColor: 0xddbb44,
    emissiveColor: 0x443300,
    metalness: 0.9,
    roughness: 0.2,
    unlockLevel: 15
  },
  neon: {
    name: 'Neon',
    bodyColor: 0x111133,
    headColor: 0x111144,
    visorColor: 0x00ffff,
    bootColor: 0x111122,
    accentColor: 0x222255,
    emissiveColor: 0x0044aa,
    metalness: 0.5,
    roughness: 0.3,
    unlockLevel: 20
  }
};

export const TrailConfig = {
  none: {
    name: 'None',
    color: null,
    unlockLevel: 1
  },
  fire: {
    name: 'Fire Trail',
    color: 0xff4400,
    emissive: 0xff2200,
    unlockLevel: 5
  },
  ice: {
    name: 'Ice Trail',
    color: 0x44aaff,
    emissive: 0x2266ff,
    unlockLevel: 8
  },
  electric: {
    name: 'Electric Trail',
    color: 0xffff00,
    emissive: 0xaaaa00,
    unlockLevel: 12
  },
  shadow: {
    name: 'Shadow Trail',
    color: 0x6622cc,
    emissive: 0x4411aa,
    unlockLevel: 15
  },
  gold: {
    name: 'Gold Trail',
    color: 0xffcc00,
    emissive: 0xddaa00,
    unlockLevel: 20
  }
};

export function getUnlockedSkins(level) {
  return Object.entries(SkinConfig)
    .filter(([, cfg]) => level >= cfg.unlockLevel)
    .map(([id]) => id);
}

export function getUnlockedTrails(level) {
  return Object.entries(TrailConfig)
    .filter(([, cfg]) => level >= cfg.unlockLevel)
    .map(([id]) => id);
}
