import Phaser from 'phaser';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { BotState, BotType } from 'shadow-arena-shared/entities/BotEntity.js';
import { distance, randomInRange } from 'shadow-arena-shared/utils/Vector2.js';

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

    // Create sprite
    const texture = type === BotType.BOSS ? 'boss' : 'bot';
    this.sprite = scene.physics.add.sprite(x, y, texture);
    const radius = type === BotType.BOSS ? 32 : 16;
    this.sprite.setCircle(radius);
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

    // Flee recovery: stop fleeing when health > 40%
    if (this.state === BotState.FLEE && healthPct > 0.4) {
      this.state = BotState.PATROL;
    }

    // Execute state
    switch (this.state) {
      case BotState.PATROL: this.patrol(dt); break;
      case BotState.CHASE: this.chase(dt, player); break;
      case BotState.ATTACK: this.attack(dt, player); break;
      case BotState.FLEE: this.flee(dt, player); break;
    }

    this.drawHealthBar();
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

    // Strafe slightly
    const strafeAngle = angle + Math.PI / 2;
    const strafeSpeed = this.speed * 0.3;
    this.sprite.setVelocity(
      Math.cos(strafeAngle) * strafeSpeed,
      Math.sin(strafeAngle) * strafeSpeed
    );

    // Shoot
    const now = Date.now();
    if (now - this.lastShotTime >= this.shootInterval) {
      this.lastShotTime = now;
      this.scene.spawnBotBullet(this.sprite.x, this.sprite.y, angle, this.damage);
    }
  }

  flee(dt, player) {
    const angle = Math.atan2(this.sprite.y - player.sprite.y, this.sprite.x - player.sprite.x);
    this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    this.sprite.setRotation(angle + Math.PI); // Face toward player while running
  }

  pickNewWaypoint() {
    const margin = 100;
    this.waypointX = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
    this.waypointY = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin);
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    this.health -= amount;
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
    this.pickNewWaypoint();
  }

  drawHealthBar() {
    this.healthBar.clear();
    if (!this.alive) return;

    const barWidth = this.type === BotType.BOSS ? 64 : 32;
    const barHeight = 4;
    const x = this.sprite.x - barWidth / 2;
    const yOff = this.type === BotType.BOSS ? 40 : 24;
    const y = this.sprite.y - yOff;

    this.healthBar.fillStyle(GameConfig.COLORS.HEALTH_BG, 0.8);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    const pct = this.health / this.maxHealth;
    const color = pct > 0.5 ? GameConfig.COLORS.HEALTH_GREEN : GameConfig.COLORS.HEALTH_RED;
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, barWidth * pct, barHeight);
  }

  destroy() {
    this.sprite.destroy();
    this.healthBar.destroy();
  }
}
