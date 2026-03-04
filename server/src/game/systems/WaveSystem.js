import { WaveConfig } from 'shadow-arena-shared/config/WaveConfig.js';
import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';
import { BotEntity, BotType, BotState } from 'shadow-arena-shared/entities/BotEntity.js';
import { MessageTypes } from 'shadow-arena-shared/utils/MessageTypes.js';
import { randomInRange } from 'shadow-arena-shared/utils/Vector2.js';
import { BotAI } from '../ai/BotAI.js';
import { BossAI } from '../ai/BossAI.js';

export class WaveSystem {
  constructor(room) {
    this.room = room;
    this.currentWave = 0;
    this.botsAlive = 0;
    this.waveActive = false;
    this.nextWaveTimer = 3000; // Start first wave after 3 seconds
    this.totalKills = 0;
  }

  update(dt, now) {
    // Count alive bots
    this.botsAlive = 0;
    for (const bot of this.room.bots.values()) {
      if (bot.alive) this.botsAlive++;
    }

    if (!this.waveActive && this.botsAlive === 0) {
      this.nextWaveTimer -= dt * 1000;
      if (this.nextWaveTimer <= 0) {
        this.startNextWave(now);
      }
    }
  }

  startNextWave(now) {
    this.currentWave++;
    this.waveActive = true;

    const isBossWave = this.currentWave % WaveConfig.BOSS_WAVE_INTERVAL === 0;
    const waveData = this.calculateWaveData(this.currentWave);

    // Notify clients
    this.room.io.to(this.room.id).emit(MessageTypes.WAVE_START, {
      wave: this.currentWave,
      botCount: waveData.botCount,
      isBossWave
    });

    if (isBossWave) {
      this.spawnBoss(waveData);
    }

    this.spawnWaveBots(waveData);
  }

  calculateWaveData(wave) {
    const botCount = WaveConfig.BASE_BOTS_PER_WAVE + Math.floor((wave - 1) * WaveConfig.BOTS_INCREASE_PER_WAVE);
    const healthMult = 1 + (wave - 1) * WaveConfig.HEALTH_SCALE;
    const speedMult = Math.min(1 + (wave - 1) * WaveConfig.SPEED_SCALE, WaveConfig.SPEED_CAP);
    const damageMult = 1 + (wave - 1) * WaveConfig.DAMAGE_SCALE;

    // Determine available bot types
    const types = [];
    for (const [type, unlockWave] of Object.entries(WaveConfig.TYPE_UNLOCKS)) {
      if (wave >= unlockWave) types.push(type);
    }

    return { botCount, healthMult, speedMult, damageMult, types };
  }

  spawnWaveBots(waveData) {
    const { botCount, healthMult, speedMult, damageMult, types } = waveData;
    const margin = 100;

    for (let i = 0; i < botCount; i++) {
      // Spawn at edges of map
      const edge = Math.floor(Math.random() * 4);
      let x, y;
      switch (edge) {
        case 0: x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin); y = margin; break;
        case 1: x = GameConfig.WORLD_WIDTH - margin; y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin); break;
        case 2: x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin); y = GameConfig.WORLD_HEIGHT - margin; break;
        case 3: x = margin; y = randomInRange(margin, GameConfig.WORLD_HEIGHT - margin); break;
      }

      const typeKey = types[Math.floor(Math.random() * types.length)];
      const bot = new BotEntity(x, y, typeKey);
      bot.applyDifficultyMultiplier(healthMult, speedMult, damageMult);

      this.room.bots.set(bot.id, bot);
      this.room.botAIs.set(bot.id, new BotAI(bot, this.room));
    }
  }

  spawnBoss(waveData) {
    const cx = GameConfig.WORLD_WIDTH / 2;
    const margin = 200;
    // Spawn boss at a random edge
    const x = randomInRange(margin, GameConfig.WORLD_WIDTH - margin);
    const y = margin;

    const boss = new BotEntity(x, y, BotType.BOSS);
    boss.applyDifficultyMultiplier(
      waveData.healthMult * WaveConfig.BOSS_HEALTH_MULTIPLIER,
      waveData.speedMult * WaveConfig.BOSS_SPEED_MULTIPLIER,
      waveData.damageMult * WaveConfig.BOSS_DAMAGE_MULTIPLIER
    );

    this.room.bots.set(boss.id, boss);
    this.room.botAIs.set(boss.id, new BossAI(boss, this.room));

    this.room.io.to(this.room.id).emit(MessageTypes.BOSS_SPAWN, {
      id: boss.id,
      x: boss.x,
      y: boss.y,
      health: boss.health,
      wave: this.currentWave
    });
  }

  onBotKilled(botId) {
    this.totalKills++;

    // Check if wave is complete
    let allDead = true;
    for (const bot of this.room.bots.values()) {
      if (bot.alive) { allDead = false; break; }
    }

    if (allDead) {
      this.waveActive = false;
      this.nextWaveTimer = WaveConfig.TIME_BETWEEN_WAVES;

      // Clear dead bots
      for (const [id, bot] of this.room.bots.entries()) {
        if (!bot.alive) {
          this.room.bots.delete(id);
          this.room.botAIs.delete(id);
        }
      }

      this.room.io.to(this.room.id).emit(MessageTypes.WAVE_COMPLETE, {
        wave: this.currentWave,
        nextWaveIn: WaveConfig.TIME_BETWEEN_WAVES,
        totalKills: this.totalKills
      });
    }
  }
}
