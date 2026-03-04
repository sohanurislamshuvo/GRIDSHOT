import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { BotState, BotType } from 'shadow-arena-shared/entities/BotEntity.js';
import { distance, randomInRange } from 'shadow-arena-shared/utils/Vector2.js';

// Texture key and radius mapping per bot type
const BOT_TEXTURE_MAP = {
  [BotType.GRUNT]:  { texture: 'bot_grunt', radius: 16, shadowTex: 'shadow' },
  [BotType.FAST]:   { texture: 'bot_fast',  radius: 14, shadowTex: 'shadow' },
  [BotType.TANK]:   { texture: 'bot_tank',  radius: 22, shadowTex: 'shadow' },
  [BotType.SNIPER]: { texture: 'bot_sniper', radius: 16, shadowTex: 'shadow' },
  [BotType.BOSS]:   { texture: 'boss',      radius: 32, shadowTex: 'shadow_large' },
};

const BOT_TYPE_COLORS = {
  [BotType.GRUNT]:  GameConfig.COLORS.BOT_GRUNT,
  [BotType.FAST]:   GameConfig.COLORS.BOT_FAST,
  [BotType.TANK]:   GameConfig.COLORS.BOT_TANK,
  [BotType.SNIPER]: GameConfig.COLORS.BOT_SNIPER,
  [BotType.BOSS]:   GameConfig.COLORS.BOSS,
};

export class ClientBot {
  constructor(scene, x, y, type = BotType.GRUNT) {
    this.scene = scene;
    this.type = type;
    this.alive = true;

    // Stats based on type
    const stats = this.getStats(type);
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.shootInterval = stats.shootInterval;
    this.detectionRange = GameConfig.BOT_DETECTION_RANGE;
    this.attackRange = GameConfig.BOT_ATTACK_RANGE;

    // Texture and radius from mapping
    const mapping = BOT_TEXTURE_MAP[type] || BOT_TEXTURE_MAP[BotType.GRUNT];
    const radius = mapping.radius;

    // Drop shadow
    this.shadow = scene.add.sprite(x, y, mapping.shadowTex);
    this.shadow.setDepth(8);
    this.shadow.setAlpha(0.35);

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, mapping.texture);
    this.sprite.setCircle(radius, (this.sprite.width / 2) - radius, (this.sprite.height / 2) - radius);
    this.sprite.setDepth(9);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.botRef = this;

    // Health bar
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(20);

    // AI state
    this.state = BotState.PATROL;
    this.waypointX = x;
    this.waypointY = y;
    this.lastShotTime = 0;
    this.stateTimer = 0;
    this.target = null;
  }

  getStats(type) {
    const stats = {
      [BotType.GRUNT]:  { health: 80,  speed: 120, damage: 10, shootInterval: 800 },
      [BotType.FAST]:   { health: 50,  speed: 200, damage: 8,  shootInterval: 600 },
      [BotType.TANK]:   { health: 200, speed: 80,  damage: 15, shootInterval: 1200 },
      [BotType.SNIPER]: { health: 60,  speed: 100, damage: 25, shootInterval: 1500 },
      [BotType.BOSS]:   { health: 500, speed: 100, damage: 20, shootInterval: 600 }
    };
    return stats[type] || stats[BotType.GRUNT];
  }

  update(dt, player) {
    if (!this.alive) return;
    if (!player || !player.alive) {
      this.patrol(dt);
      this.updateShadow();
      this.drawHealthBar();
      return;
    }

    const dist = distance(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
    this.target = player;

    // FSM transitions
    const healthPct = this.health / this.maxHealth;
    if (healthPct < GameConfig.BOT_FLEE_HEALTH_PERCENT && this.state !== BotState.FLEE) {
      this.state = BotState.FLEE;
    } else if (dist <= this.attackRange && this.state !== BotState.FLEE) {
      this.state = BotState.ATTACK;
    } else if (dist <= this.detectionRange && this.state !== BotState.FLEE) {
      this.state = BotState.CHASE;
    } else if (this.state !== BotState.FLEE) {
      this.state = BotState.PATROL;
    }

    // Flee recovery
    if (this.state === BotState.FLEE && healthPct > 0.4) {
      this.state = BotState.PATROL;
    }

    switch (this.state) {
      case BotState.PATROL: this.patrol(dt); break;
      case BotState.CHASE: this.chase(dt, player); break;
      case BotState.ATTACK: this.attack(dt, player); break;
      case BotState.FLEE: this.flee(dt, player); break;
    }

    this.updateShadow();
    this.drawHealthBar();
  }

  updateShadow() {
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 4);
  }

  patrol(dt) {
    const dist = distance(this.sprite.x, this.sprite.y, this.waypointX, this.waypointY);
    if (dist < 20) {
      this.pickNewWaypoint();
    }

    const angle = Math.atan2(this.waypointY - this.sprite.y, this.waypointX - this.sprite.x);
    this.sprite.setVelocity(Math.cos(angle) * this.speed * 0.5, Math.sin(angle) * this.speed * 0.5);
    this.sprite.setRotation(angle);
  }

  chase(dt, player) {
    const angle = Math.atan2(player.sprite.y - this.sprite.y, player.sprite.x - this.sprite.x);
    this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.sprite.setRotation(angle);
  }

  attack(dt, player) {
    const angle = Math.atan2(player.sprite.y - this.sprite.y, player.sprite.x - this.sprite.x);
    this.sprite.setRotation(angle);

    const strafeAngle = angle + Math.PI / 2;
    const strafeSpeed = this.speed * 0.3;
    this.sprite.setVelocity(
      Math.cos(strafeAngle) * strafeSpeed,
      Math.sin(strafeAngle) * strafeSpeed
    );

    const now = Date.now();
    if (now - this.lastShotTime >= this.shootInterval) {
      this.lastShotTime = now;
      this.scene.spawnBotBullet(this.sprite.x, this.sprite.y, angle, this.damage);
      // Muzzle flash
      if (this.scene.spawnMuzzleFlash) {
        const fx = this.sprite.x + Math.cos(angle) * 20;
        const fy = this.sprite.y + Math.sin(angle) * 20;
        this.scene.spawnMuzzleFlash(fx, fy);
      }
    }
  }

  flee(dt, player) {
    const angle = Math.atan2(this.sprite.y - player.sprite.y, this.sprite.x - player.sprite.x);
    this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.sprite.setRotation(angle + Math.PI);
  }

  pickNewWaypoint() {
    const margin = 100;
    this.waypointX = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
    this.waypointY = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    this.health -= amount;

    // Hit flash
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.alive) this.sprite.clearTint();
    });

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
    return amount;
  }

  die() {
    this.alive = false;
    this.sprite.setVisible(false);
    this.sprite.body.enable = false;
    this.healthBar.clear();
    this.shadow.setVisible(false);

    // Death explosion
    const color = BOT_TYPE_COLORS[this.type] || GameConfig.COLORS.BOT_GRUNT;
    if (this.scene.spawnDeathExplosion) {
      this.scene.spawnDeathExplosion(this.sprite.x, this.sprite.y, color);
    }

    // Respawn after delay
    this.scene.time.delayedCall(GameConfig.PLAYER_RESPAWN_TIME, () => {
      this.respawn();
    });
  }

  respawn() {
    const margin = 100;
    const x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
    const y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
    this.sprite.setPosition(x, y);
    this.health = this.maxHealth;
    this.alive = true;
    this.state = BotState.PATROL;
    this.sprite.setVisible(true);
    this.sprite.body.enable = true;
    this.shadow.setVisible(true);
    this.pickNewWaypoint();
  }

  drawHealthBar() {
    this.healthBar.clear();
    if (!this.alive) return;

    const barWidth = this.type === BotType.BOSS ? 64 : this.type === BotType.TANK ? 48 : 36;
    const barHeight = 5;
    const x = this.sprite.x - barWidth / 2;
    const yOff = this.type === BotType.BOSS ? 44 : this.type === BotType.TANK ? 32 : 26;
    const y = this.sprite.y - yOff;

    // Border
    this.healthBar.fillStyle(0x000000, 0.9);
    this.healthBar.fillRoundedRect(x - 1, y - 1, barWidth + 2, barHeight + 2, 2);

    // Background
    this.healthBar.fillStyle(GameConfig.COLORS.HEALTH_BG, 0.9);
    this.healthBar.fillRoundedRect(x, y, barWidth, barHeight, 2);

    // Health fill
    const pct = this.health / this.maxHealth;
    let color;
    if (pct > 0.6) color = GameConfig.COLORS.HEALTH_GREEN;
    else if (pct > 0.3) color = GameConfig.COLORS.HEALTH_YELLOW;
    else color = GameConfig.COLORS.HEALTH_RED;

    if (pct > 0) {
      this.healthBar.fillStyle(color, 1);
      this.healthBar.fillRoundedRect(x, y, barWidth * pct, barHeight, 2);
    }

    // Highlight shine
    this.healthBar.fillStyle(0xffffff, 0.2);
    this.healthBar.fillRect(x + 1, y + 1, Math.max(0, barWidth * pct - 2), 1);
  }

  destroy() {
    this.sprite.destroy();
    this.healthBar.destroy();
    this.shadow.destroy();
  }
}
