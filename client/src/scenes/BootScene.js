import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const cx = GameConfig.VIEW_WIDTH / 2;
    const cy = GameConfig.VIEW_HEIGHT / 2;
    const loadingText = this.add.text(cx, cy - 20, 'Loading...', {
      fontSize: '24px',
      fill: '#ffffff'
    }).setOrigin(0.5);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x333333, 0.8);
    progressBox.fillRect(cx - 160, cy + 10, 320, 30);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x4488ff, 1);
      progressBar.fillRect(cx - 155, cy + 15, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    this.createAllTextures();
  }

  createAllTextures() {
    this.createPlayerTexture();
    this.createBotGruntTexture();
    this.createBotFastTexture();
    this.createBotTankTexture();
    this.createBotSniperTexture();
    this.createBossTexture();
    this.createBulletTextures();
    this.createShieldTexture();
    this.createParticleTextures();
    this.createShadowTextures();
    this.createWallTexture();
    this.createFloorTexture();
  }

  // ── Player (48x48) - Top-down human operative facing RIGHT ──
  createPlayerTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const w = 48, h = 48;
    const cx = w / 2, cy = h / 2;

    // Drop shadow baked into texture
    gfx.fillStyle(C.SHADOW, 0.2);
    gfx.fillEllipse(cx + 1, cy + 2, 30, 18);

    // -- Legs (two dark rectangles behind body, slight gap) --
    gfx.fillStyle(C.PLAYER_BOOTS, 1);
    gfx.fillRect(cx - 14, cy - 5, 8, 4);   // left leg
    gfx.fillRect(cx - 14, cy + 1, 8, 4);   // right leg

    // -- Body / Torso (rounded shape) --
    // Outer body (darker armor border)
    gfx.fillStyle(C.PLAYER_ARMOR_DARK, 1);
    gfx.fillRoundedRect(cx - 8, cy - 9, 18, 18, 4);
    // Inner body (armor fill)
    gfx.fillStyle(C.PLAYER_ARMOR, 1);
    gfx.fillRoundedRect(cx - 7, cy - 8, 16, 16, 3);
    // Highlight on top-left of armor
    gfx.fillStyle(C.PLAYER_HIGHLIGHT, 0.3);
    gfx.fillRoundedRect(cx - 6, cy - 7, 10, 6, 2);

    // Belt detail (thin dark line across waist)
    gfx.fillStyle(C.PLAYER_ARMOR_DARK, 0.8);
    gfx.fillRect(cx - 7, cy + 2, 16, 2);

    // -- Left arm (tucked by body side) --
    gfx.fillStyle(C.PLAYER_ARMOR, 1);
    gfx.fillRect(cx - 2, cy - 12, 6, 4);   // left arm above body
    // Arm outline
    gfx.lineStyle(1, C.PLAYER_ARMOR_DARK, 0.7);
    gfx.strokeRect(cx - 2, cy - 12, 6, 4);

    // -- Right arm (extended forward holding gun) --
    gfx.fillStyle(C.PLAYER_ARMOR, 1);
    gfx.fillRect(cx - 2, cy + 8, 6, 4);    // right arm below body
    // Arm outline
    gfx.lineStyle(1, C.PLAYER_ARMOR_DARK, 0.7);
    gfx.strokeRect(cx - 2, cy + 8, 6, 4);

    // Skin (hand gripping gun)
    gfx.fillStyle(C.PLAYER_SKIN, 1);
    gfx.fillRect(cx + 4, cy + 8, 3, 4);

    // -- Weapon (extends from right hand forward) --
    gfx.fillStyle(C.PLAYER_GUN, 1);
    gfx.fillRect(cx + 7, cy + 8, 14, 4);   // gun barrel
    gfx.fillStyle(C.PLAYER_GUN_DARK, 1);
    gfx.fillRect(cx + 7, cy + 8, 14, 1);   // top shadow
    gfx.fillStyle(0xaaaaaa, 0.6);
    gfx.fillRect(cx + 7, cy + 11, 14, 1);  // bottom highlight
    // Muzzle tip (bright)
    gfx.fillStyle(0xcccccc, 1);
    gfx.fillRect(cx + 20, cy + 8, 2, 4);

    // -- Head (circle with helmet) --
    // Helmet (outer)
    gfx.fillStyle(C.PLAYER_ARMOR_DARK, 1);
    gfx.fillCircle(cx + 6, cy, 8);
    // Helmet (inner)
    gfx.fillStyle(C.PLAYER_ARMOR, 1);
    gfx.fillCircle(cx + 6, cy, 7);
    // Face/skin area
    gfx.fillStyle(C.PLAYER_SKIN, 1);
    gfx.fillCircle(cx + 8, cy, 4);
    // Visor (glowing cyan)
    gfx.fillStyle(C.PLAYER_VISOR, 1);
    gfx.fillRect(cx + 10, cy - 2, 4, 4);
    // Visor glow
    gfx.fillStyle(C.PLAYER_VISOR, 0.3);
    gfx.fillRect(cx + 9, cy - 3, 6, 6);

    gfx.generateTexture('player', w, h);
    gfx.destroy();
  }

  // ── Bot GRUNT (40x40) - Red stocky soldier humanoid ──
  createBotGruntTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const s = 40, cx = s / 2, cy = s / 2;

    // Shadow
    gfx.fillStyle(C.SHADOW, 0.2);
    gfx.fillEllipse(cx + 1, cy + 2, 26, 14);

    // Legs
    gfx.fillStyle(0x442222, 1);
    gfx.fillRect(cx - 12, cy - 4, 7, 4);
    gfx.fillRect(cx - 12, cy + 1, 7, 4);

    // Body
    gfx.fillStyle(C.BOT_GRUNT_DARK, 1);
    gfx.fillRoundedRect(cx - 6, cy - 8, 16, 16, 3);
    gfx.fillStyle(C.BOT_GRUNT, 1);
    gfx.fillRoundedRect(cx - 5, cy - 7, 14, 14, 2);

    // Arms
    gfx.fillStyle(C.BOT_GRUNT, 1);
    gfx.fillRect(cx - 2, cy - 10, 5, 3);
    gfx.fillRect(cx - 2, cy + 7, 5, 3);

    // Gun
    gfx.fillStyle(C.PLAYER_GUN, 1);
    gfx.fillRect(cx + 5, cy + 7, 10, 3);

    // Head
    gfx.fillStyle(C.BOT_GRUNT_DARK, 1);
    gfx.fillCircle(cx + 5, cy, 7);
    gfx.fillStyle(C.BOT_GRUNT, 1);
    gfx.fillCircle(cx + 5, cy, 6);

    // Red angry eye
    gfx.fillStyle(0xff0000, 1);
    gfx.fillCircle(cx + 8, cy, 3);
    gfx.fillStyle(0xffaaaa, 1);
    gfx.fillCircle(cx + 8, cy, 1);

    gfx.generateTexture('bot_grunt', s, s);
    gfx.destroy();

    // Also generate legacy 'bot' key for backwards compatibility
    const gfx2 = this.make.graphics({ add: false });
    gfx2.fillStyle(C.SHADOW, 0.2);
    gfx2.fillEllipse(17, 18, 26, 14);
    gfx2.fillStyle(C.BOT_GRUNT_DARK, 1);
    gfx2.fillCircle(16, 16, 14);
    gfx2.fillStyle(C.BOT_GRUNT, 1);
    gfx2.fillCircle(16, 16, 12);
    gfx2.fillStyle(0xff0000, 1);
    gfx2.fillCircle(20, 16, 3);
    gfx2.fillStyle(0xffaaaa, 1);
    gfx2.fillCircle(20, 16, 1);
    gfx2.fillStyle(C.PLAYER_GUN, 1);
    gfx2.fillRect(26, 14, 6, 4);
    gfx2.generateTexture('bot', 32, 32);
    gfx2.destroy();
  }

  // ── Bot FAST (36x36) - Orange lean humanoid with speed lines ──
  createBotFastTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const s = 36, cx = s / 2, cy = s / 2;

    // Shadow
    gfx.fillStyle(C.SHADOW, 0.2);
    gfx.fillEllipse(cx + 1, cy + 2, 22, 12);

    // Speed lines (behind body)
    gfx.lineStyle(1, C.BOT_FAST, 0.4);
    gfx.lineBetween(cx - 16, cy - 4, cx - 6, cy - 4);
    gfx.lineBetween(cx - 14, cy, cx - 6, cy);
    gfx.lineBetween(cx - 16, cy + 4, cx - 6, cy + 4);

    // Legs (thin)
    gfx.fillStyle(0x553300, 1);
    gfx.fillRect(cx - 10, cy - 3, 5, 3);
    gfx.fillRect(cx - 10, cy + 1, 5, 3);

    // Slim body
    gfx.fillStyle(C.BOT_FAST_DARK, 1);
    gfx.fillRoundedRect(cx - 4, cy - 6, 12, 12, 3);
    gfx.fillStyle(C.BOT_FAST, 1);
    gfx.fillRoundedRect(cx - 3, cy - 5, 10, 10, 2);

    // Arms (thin)
    gfx.fillStyle(C.BOT_FAST, 1);
    gfx.fillRect(cx - 1, cy - 8, 4, 3);
    gfx.fillRect(cx - 1, cy + 5, 4, 3);

    // Gun (short)
    gfx.fillStyle(C.PLAYER_GUN, 1);
    gfx.fillRect(cx + 4, cy + 5, 8, 3);

    // Head (smaller)
    gfx.fillStyle(C.BOT_FAST_DARK, 1);
    gfx.fillCircle(cx + 4, cy, 6);
    gfx.fillStyle(C.BOT_FAST, 1);
    gfx.fillCircle(cx + 4, cy, 5);

    // Eye
    gfx.fillStyle(0xff4400, 1);
    gfx.fillCircle(cx + 7, cy, 2);
    gfx.fillStyle(0xffcc88, 1);
    gfx.fillCircle(cx + 7, cy, 1);

    gfx.generateTexture('bot_fast', s, s);
    gfx.destroy();
  }

  // ── Bot TANK (52x52) - Purple bulky humanoid with shoulder pads ──
  createBotTankTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const s = 52, cx = s / 2, cy = s / 2;

    // Shadow
    gfx.fillStyle(C.SHADOW, 0.2);
    gfx.fillEllipse(cx + 1, cy + 2, 36, 20);

    // Legs (thick)
    gfx.fillStyle(0x332244, 1);
    gfx.fillRect(cx - 16, cy - 6, 10, 5);
    gfx.fillRect(cx - 16, cy + 2, 10, 5);

    // Body (extra wide)
    gfx.fillStyle(C.BOT_TANK_DARK, 1);
    gfx.fillRoundedRect(cx - 8, cy - 12, 22, 24, 4);
    gfx.fillStyle(C.BOT_TANK, 1);
    gfx.fillRoundedRect(cx - 7, cy - 11, 20, 22, 3);

    // Armor plate detail
    gfx.lineStyle(1, C.BOT_TANK_DARK, 0.5);
    gfx.strokeRect(cx - 4, cy - 8, 14, 16);

    // Shoulder pads (top and bottom)
    gfx.fillStyle(C.BOT_TANK_DARK, 1);
    gfx.fillRoundedRect(cx - 4, cy - 16, 10, 6, 2);
    gfx.fillRoundedRect(cx - 4, cy + 10, 10, 6, 2);
    gfx.fillStyle(C.BOT_TANK, 0.8);
    gfx.fillRoundedRect(cx - 3, cy - 15, 8, 4, 1);
    gfx.fillRoundedRect(cx - 3, cy + 11, 8, 4, 1);

    // Arms (thick)
    gfx.fillStyle(C.BOT_TANK, 1);
    gfx.fillRect(cx, cy - 14, 8, 4);
    gfx.fillRect(cx, cy + 10, 8, 4);

    // Heavy gun
    gfx.fillStyle(C.PLAYER_GUN_DARK, 1);
    gfx.fillRect(cx + 8, cy + 8, 14, 5);
    gfx.fillStyle(C.PLAYER_GUN, 1);
    gfx.fillRect(cx + 8, cy + 9, 14, 3);

    // Rivets
    gfx.fillStyle(0xaaaaaa, 0.8);
    gfx.fillCircle(cx - 1, cy - 7, 2);
    gfx.fillCircle(cx + 9, cy - 7, 2);
    gfx.fillCircle(cx - 1, cy + 7, 2);
    gfx.fillCircle(cx + 9, cy + 7, 2);

    // Head (heavy helmet)
    gfx.fillStyle(C.BOT_TANK_DARK, 1);
    gfx.fillCircle(cx + 8, cy, 9);
    gfx.fillStyle(C.BOT_TANK, 1);
    gfx.fillCircle(cx + 8, cy, 7);

    // Visor slit (narrow red)
    gfx.fillStyle(0xff0000, 0.9);
    gfx.fillRect(cx + 11, cy - 2, 5, 4);
    gfx.fillStyle(0xffaaaa, 0.7);
    gfx.fillRect(cx + 12, cy - 1, 3, 2);

    gfx.generateTexture('bot_tank', s, s);
    gfx.destroy();
  }

  // ── Bot SNIPER (40x40) - Teal slim humanoid with hood and long rifle ──
  createBotSniperTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const s = 40, cx = s / 2, cy = s / 2;

    // Shadow
    gfx.fillStyle(C.SHADOW, 0.2);
    gfx.fillEllipse(cx + 1, cy + 2, 26, 14);

    // Legs
    gfx.fillStyle(0x224433, 1);
    gfx.fillRect(cx - 12, cy - 3, 6, 3);
    gfx.fillRect(cx - 12, cy + 1, 6, 3);

    // Slim body
    gfx.fillStyle(C.BOT_SNIPER_DARK, 1);
    gfx.fillRoundedRect(cx - 5, cy - 7, 14, 14, 3);
    gfx.fillStyle(C.BOT_SNIPER, 1);
    gfx.fillRoundedRect(cx - 4, cy - 6, 12, 12, 2);

    // Arms
    gfx.fillStyle(C.BOT_SNIPER, 1);
    gfx.fillRect(cx - 1, cy - 9, 5, 3);
    gfx.fillRect(cx - 1, cy + 6, 5, 3);

    // Long sniper rifle
    gfx.fillStyle(C.PLAYER_GUN_DARK, 1);
    gfx.fillRect(cx + 4, cy + 6, 18, 3);
    gfx.fillStyle(C.PLAYER_GUN, 1);
    gfx.fillRect(cx + 4, cy + 7, 18, 1);
    // Scope on rifle
    gfx.fillStyle(0x66ffcc, 0.7);
    gfx.fillCircle(cx + 10, cy + 7, 2);

    // Hooded head (triangle/pointed shape)
    gfx.fillStyle(C.BOT_SNIPER_DARK, 1);
    gfx.fillTriangle(cx + 2, cy - 8, cx + 14, cy, cx + 2, cy + 8);
    gfx.fillStyle(C.BOT_SNIPER, 1);
    gfx.fillTriangle(cx + 3, cy - 6, cx + 12, cy, cx + 3, cy + 6);

    // Eye (single green glow)
    gfx.fillStyle(0x00ff88, 1);
    gfx.fillCircle(cx + 9, cy, 2);
    gfx.fillStyle(0xaaffcc, 1);
    gfx.fillCircle(cx + 9, cy, 1);

    gfx.generateTexture('bot_sniper', s, s);
    gfx.destroy();
  }

  // ── Boss (72x72) - Large orange humanoid with crown and dual weapons ──
  createBossTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const s = 72, cx = s / 2, cy = s / 2;

    // Shadow
    gfx.fillStyle(C.SHADOW, 0.25);
    gfx.fillEllipse(cx + 2, cy + 3, 52, 28);

    // Legs (thick)
    gfx.fillStyle(0x553300, 1);
    gfx.fillRect(cx - 22, cy - 8, 12, 6);
    gfx.fillRect(cx - 22, cy + 3, 12, 6);

    // Body (massive torso)
    gfx.fillStyle(C.BOSS_DARK, 1);
    gfx.fillRoundedRect(cx - 12, cy - 16, 28, 32, 5);
    gfx.fillStyle(C.BOSS, 1);
    gfx.fillRoundedRect(cx - 10, cy - 14, 24, 28, 4);

    // Inner armor detail
    gfx.lineStyle(2, C.BOSS_DARK, 0.5);
    gfx.strokeRoundedRect(cx - 6, cy - 10, 16, 20, 2);

    // Massive shoulder pads
    gfx.fillStyle(C.BOSS_DARK, 1);
    gfx.fillRoundedRect(cx - 6, cy - 22, 14, 8, 3);
    gfx.fillRoundedRect(cx - 6, cy + 14, 14, 8, 3);
    gfx.fillStyle(C.BOSS, 0.9);
    gfx.fillRoundedRect(cx - 5, cy - 21, 12, 6, 2);
    gfx.fillRoundedRect(cx - 5, cy + 15, 12, 6, 2);

    // Arms
    gfx.fillStyle(C.BOSS, 1);
    gfx.fillRect(cx + 2, cy - 20, 10, 6);
    gfx.fillRect(cx + 2, cy + 14, 10, 6);

    // Dual weapons (top and bottom guns)
    gfx.fillStyle(C.PLAYER_GUN_DARK, 1);
    gfx.fillRect(cx + 12, cy - 18, 18, 5);
    gfx.fillRect(cx + 12, cy + 14, 18, 5);
    gfx.fillStyle(C.PLAYER_GUN, 1);
    gfx.fillRect(cx + 12, cy - 17, 18, 3);
    gfx.fillRect(cx + 12, cy + 15, 18, 3);
    // Muzzle tips
    gfx.fillStyle(0xcccccc, 1);
    gfx.fillRect(cx + 29, cy - 18, 3, 5);
    gfx.fillRect(cx + 29, cy + 14, 3, 5);

    // Head (large with helmet)
    gfx.fillStyle(C.BOSS_DARK, 1);
    gfx.fillCircle(cx + 8, cy, 12);
    gfx.fillStyle(C.BOSS, 1);
    gfx.fillCircle(cx + 8, cy, 10);

    // Crown / Horns (three golden triangles)
    gfx.fillStyle(C.BOSS_CROWN, 1);
    gfx.fillTriangle(cx + 2, cy - 10, cx + 5, cy - 18, cx + 8, cy - 10);
    gfx.fillTriangle(cx + 6, cy - 11, cx + 9, cy - 20, cx + 12, cy - 11);
    gfx.fillTriangle(cx + 10, cy - 10, cx + 13, cy - 18, cx + 16, cy - 10);

    // Dual eyes (menacing red glow)
    gfx.fillStyle(0xff0000, 1);
    gfx.fillCircle(cx + 12, cy - 3, 4);
    gfx.fillCircle(cx + 12, cy + 3, 4);
    gfx.fillStyle(0xffaaaa, 1);
    gfx.fillCircle(cx + 12, cy - 3, 2);
    gfx.fillCircle(cx + 12, cy + 3, 2);

    gfx.generateTexture('boss', s, s);
    gfx.destroy();
  }

  // ── Bullets (12x12) - Glowing projectiles ──
  createBulletTextures() {
    // Player bullet
    const pg = this.make.graphics({ add: false });
    pg.fillStyle(GameConfig.COLORS.BULLET_GLOW, 0.2);
    pg.fillCircle(6, 6, 6);
    pg.fillStyle(GameConfig.COLORS.BULLET_GLOW, 0.4);
    pg.fillCircle(6, 6, 4);
    pg.fillStyle(GameConfig.COLORS.BULLET_PLAYER, 1);
    pg.fillCircle(6, 6, 2);
    pg.fillStyle(0xffffff, 0.9);
    pg.fillCircle(6, 6, 1);
    pg.generateTexture('bullet_player', 12, 12);
    pg.destroy();

    // Bot bullet
    const bg = this.make.graphics({ add: false });
    bg.fillStyle(GameConfig.COLORS.BULLET_BOT_GLOW, 0.2);
    bg.fillCircle(6, 6, 6);
    bg.fillStyle(GameConfig.COLORS.BULLET_BOT_GLOW, 0.4);
    bg.fillCircle(6, 6, 4);
    bg.fillStyle(GameConfig.COLORS.BULLET_BOT, 1);
    bg.fillCircle(6, 6, 2);
    bg.fillStyle(0xffffff, 0.9);
    bg.fillCircle(6, 6, 1);
    bg.generateTexture('bullet_bot', 12, 12);
    bg.destroy();
  }

  // ── Shield (52x52) - Energy shield with hex points ──
  createShieldTexture() {
    const gfx = this.make.graphics({ add: false });
    const C = GameConfig.COLORS;
    const cx = 26, cy = 26, r = 24;

    // Outer glow
    gfx.lineStyle(4, C.SHIELD, 0.15);
    gfx.strokeCircle(cx, cy, r + 1);

    // Main ring
    gfx.lineStyle(2, C.SHIELD, 0.6);
    gfx.strokeCircle(cx, cy, r);

    // Inner ring
    gfx.lineStyle(1, C.SHIELD_INNER, 0.3);
    gfx.strokeCircle(cx, cy, r - 4);

    // Hex points around the ring
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const hx = cx + Math.cos(angle) * (r - 2);
      const hy = cy + Math.sin(angle) * (r - 2);
      gfx.fillStyle(C.SHIELD_INNER, 0.3);
      gfx.fillCircle(hx, hy, 3);
    }

    // Faint center fill
    gfx.fillStyle(C.SHIELD, 0.05);
    gfx.fillCircle(cx, cy, r - 2);

    gfx.generateTexture('shield_effect', 52, 52);
    gfx.destroy();
  }

  // ── Particle textures ──
  createParticleTextures() {
    // White dot for particle emitters
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(2, 2, 2);
    gfx.generateTexture('particle_white', 4, 4);
    gfx.destroy();

    // Muzzle flash
    const mfx = this.make.graphics({ add: false });
    mfx.fillStyle(GameConfig.COLORS.MUZZLE_FLASH, 1);
    mfx.fillCircle(4, 4, 4);
    mfx.fillStyle(0xffffff, 1);
    mfx.fillCircle(4, 4, 2);
    mfx.generateTexture('muzzle_flash', 8, 8);
    mfx.destroy();
  }

  // ── Shadow textures ──
  createShadowTextures() {
    // Regular shadow (for players and small bots)
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillEllipse(16, 16, 28, 12);
    gfx.generateTexture('shadow', 32, 32);
    gfx.destroy();

    // Large shadow (for boss)
    const bgfx = this.make.graphics({ add: false });
    bgfx.fillStyle(0x000000, 0.3);
    bgfx.fillEllipse(36, 36, 56, 24);
    bgfx.generateTexture('shadow_large', 72, 72);
    bgfx.destroy();
  }

  // ── Wall tile ──
  createWallTexture() {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(GameConfig.COLORS.WALL, 1);
    gfx.fillRect(0, 0, 32, 32);
    // Brick-like pattern
    gfx.lineStyle(1, 0x888888, 0.3);
    gfx.strokeRect(0, 0, 32, 32);
    gfx.lineStyle(1, 0x555555, 0.2);
    gfx.lineBetween(0, 16, 32, 16);
    gfx.lineBetween(16, 0, 16, 16);
    gfx.lineBetween(0, 16, 0, 32);
    gfx.generateTexture('wall', 32, 32);
    gfx.destroy();
  }

  // ── Floor tile ──
  createFloorTexture() {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(GameConfig.COLORS.FLOOR, 1);
    gfx.fillRect(0, 0, 32, 32);
    gfx.lineStyle(1, 0x333333, 0.2);
    gfx.strokeRect(0, 0, 32, 32);
    gfx.generateTexture('floor', 32, 32);
    gfx.destroy();
  }

  create() {
    this.scene.start('MenuScene');
  }
}
