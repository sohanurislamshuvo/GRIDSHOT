const WEAPON_NAMES = {
  auto_rifle: 'AUTO RIFLE',
  pistol: 'PISTOL',
  smg: 'SMG',
  shotgun: 'SHOTGUN',
  sniper: 'SNIPER'
};

const WEAPON_INDEX = {
  auto_rifle: 0,
  pistol: 1,
  smg: 2,
  shotgun: 3,
  sniper: 4
};

export class HUD {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <div class="hud-top-left">
        <div class="hud-health-text">HP: 100/100</div>
        <div class="hud-health-bar">
          <div class="hud-health-ghost"></div>
          <div class="hud-health-fill"></div>
        </div>
        <div class="hud-stats">K: 0 | D: 0</div>
        <div class="hud-fps"></div>
      </div>
      <div class="hud-top-center">
        <div class="hud-alive">ALIVE: --</div>
        <canvas class="hud-compass" width="200" height="24"></canvas>
      </div>
      <div class="hud-top-right">
        <div class="hud-mode"></div>
      </div>
      <div class="hud-kill-feed"></div>
      <div class="hud-bottom-center">
        <div class="hud-ability-bar">
          <div class="hud-ability" data-key="dash">
            <div class="hud-ability-label">Q DASH</div>
            <div class="hud-ability-cooldown-overlay"></div>
            <div class="hud-ability-cooldown-text"></div>
          </div>
          <div class="hud-ability" data-key="shield">
            <div class="hud-ability-label">E SHIELD</div>
            <div class="hud-ability-cooldown-overlay"></div>
            <div class="hud-ability-cooldown-text"></div>
          </div>
          <div class="hud-ability" data-key="radar">
            <div class="hud-ability-label">R RADAR</div>
            <div class="hud-ability-cooldown-overlay"></div>
            <div class="hud-ability-cooldown-text"></div>
          </div>
          <div class="hud-ability" data-key="heal">
            <div class="hud-ability-label">F HEAL</div>
            <div class="hud-ability-cooldown-overlay"></div>
            <div class="hud-ability-cooldown-text"></div>
          </div>
        </div>
      </div>
      <div class="hud-bottom-right">
        <div class="hud-weapon-slots">
          <span class="hud-wslot active" data-idx="0">1</span>
          <span class="hud-wslot" data-idx="1">2</span>
          <span class="hud-wslot" data-idx="2">3</span>
          <span class="hud-wslot" data-idx="3">4</span>
          <span class="hud-wslot" data-idx="4">5</span>
        </div>
        <div class="hud-weapon-name">AUTO RIFLE</div>
        <div class="hud-weapon-ammo">&infin;</div>
      </div>
      <div class="hud-crosshair"></div>
      <div class="hud-view-mode">TPP</div>
      <div class="hud-hitmarker"></div>
      <div class="hud-respawn">RESPAWNING...</div>
      <div class="hud-skydive">
        <div class="hud-skydive-text">CHOOSE LANDING ZONE</div>
        <div class="hud-skydive-alt">ALT: 1200m</div>
        <div class="hud-skydive-prompt">CLICK TO LAND</div>
        <div class="hud-skydive-marker"></div>
      </div>
      <div class="hud-result"></div>
      <div class="hud-minimap">
        <canvas class="minimap-canvas" width="200" height="200"></canvas>
      </div>
    `;
    root.appendChild(this.el);

    this._healthText = this.el.querySelector('.hud-health-text');
    this._healthFill = this.el.querySelector('.hud-health-fill');
    this._healthGhost = this.el.querySelector('.hud-health-ghost');
    this._statsText = this.el.querySelector('.hud-stats');
    this._fpsEl = this.el.querySelector('.hud-fps');
    this._modeText = this.el.querySelector('.hud-mode');
    this._respawnEl = this.el.querySelector('.hud-respawn');
    this._resultEl = this.el.querySelector('.hud-result');
    this._hitmarker = this.el.querySelector('.hud-hitmarker');
    this._crosshair = this.el.querySelector('.hud-crosshair');
    this._viewModeEl = this.el.querySelector('.hud-view-mode');
    this._aliveEl = this.el.querySelector('.hud-alive');
    this._killFeedEl = this.el.querySelector('.hud-kill-feed');
    this._compassCanvas = this.el.querySelector('.hud-compass');
    this._compassCtx = this._compassCanvas.getContext('2d');
    this._skydiveEl = this.el.querySelector('.hud-skydive');
    this._skydiveAltEl = this.el.querySelector('.hud-skydive-alt');
    this._weaponNameEl = this.el.querySelector('.hud-weapon-name');
    this._weaponSlots = this.el.querySelectorAll('.hud-wslot');
    this._abilityEls = {};

    this.el.querySelectorAll('.hud-ability').forEach(el => {
      this._abilityEls[el.dataset.key] = {
        el,
        overlay: el.querySelector('.hud-ability-cooldown-overlay'),
        text: el.querySelector('.hud-ability-cooldown-text'),
        label: el.querySelector('.hud-ability-label')
      };
    });

    // Minimap
    this._minimapCanvas = this.el.querySelector('.minimap-canvas');
    this._minimapCtx = this._minimapCanvas.getContext('2d');
    this._radarEnemies = null;
    this._radarTimeout = null;
    this._wallGrid = null;
    this._wallGridCache = null; // Cached offscreen canvas for wall grid
    this._zoneData = null; // { x, y, radius }

    // Mobile labels
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isMobile) {
      for (const [key, ui] of Object.entries(this._abilityEls)) {
        ui.label.textContent = key.toUpperCase();
      }
    }

    // Previous health for damage flash
    this._prevHealth = 100;
  }

  setWallGrid(grid) {
    this._wallGrid = grid;
    this._cacheWallGrid();
  }

  // Cache wall grid to offscreen canvas - avoids 10,000 fillRect calls per frame
  _cacheWallGrid() {
    if (!this._wallGrid) {
      this._wallGridCache = null;
      return;
    }

    const w = 200, h = 200;
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');

    // Background
    ctx.fillStyle = 'rgba(5, 5, 15, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Draw walls once
    ctx.fillStyle = 'rgba(80, 90, 110, 0.6)';
    const gridW = this._wallGrid.length;
    const gridH = this._wallGrid[0]?.length || 0;
    const cellW = w / gridW;
    const cellH = h / gridH;
    for (let gx = 0; gx < gridW; gx++) {
      for (let gy = 0; gy < gridH; gy++) {
        if (this._wallGrid[gx][gy]) {
          ctx.fillRect(gx * cellW, gy * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }

    this._wallGridCache = offscreen;
  }

  setCameraMode(mode) {
    const labels = { tpp: 'TPP', shoulder: 'SHOULDER', fpp: 'FPP' };
    this._viewModeEl.textContent = labels[mode] || mode.toUpperCase();
    // Show crosshair in FPP and shoulder modes
    this._crosshair.style.display = (mode === 'tpp') ? 'none' : 'block';
  }

  setWeapon(weaponType) {
    this._weaponNameEl.textContent = WEAPON_NAMES[weaponType] || 'AUTO RIFLE';
    const idx = WEAPON_INDEX[weaponType] ?? 0;
    this._weaponSlots.forEach((slot, i) => {
      slot.classList.toggle('active', i === idx);
    });
  }

  show(mode) {
    this.el.style.display = 'block';
    this._modeText.textContent = mode.toUpperCase();
    this._respawnEl.style.display = 'none';
    this._resultEl.style.display = 'none';
  }

  hide() {
    this.el.style.display = 'none';
  }

  showHitMarker() {
    this._hitmarker.classList.add('active');
    clearTimeout(this._hitmarkerTimeout);
    this._hitmarkerTimeout = setTimeout(() => {
      this._hitmarker.classList.remove('active');
    }, 100);
  }

  update(stats) {
    // Health
    this._healthText.textContent = `HP: ${stats.health}/${stats.maxHealth}`;
    const pct = stats.health / stats.maxHealth;
    this._healthFill.style.width = `${pct * 100}%`;

    // Health bar gradient color
    if (pct > 0.5) {
      this._healthFill.style.background = 'linear-gradient(90deg, #44ff44, #66ff66)';
      this._healthFill.style.boxShadow = '0 0 8px rgba(68,255,68,0.3)';
    } else if (pct > 0.25) {
      this._healthFill.style.background = 'linear-gradient(90deg, #ff8800, #ffaa00)';
      this._healthFill.style.boxShadow = '0 0 8px rgba(255,170,0,0.3)';
    } else {
      this._healthFill.style.background = 'linear-gradient(90deg, #ff2222, #ff4444)';
      this._healthFill.style.boxShadow = '0 0 8px rgba(255,68,68,0.4)';
    }
    this._healthText.style.color = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff4444';

    // Ghost health bar (delayed red fill showing recent damage)
    if (stats.health < this._prevHealth) {
      // Set ghost to previous width, then animate it down after a delay
      this._healthGhost.style.transition = 'none';
      this._healthGhost.style.width = `${(this._prevHealth / stats.maxHealth) * 100}%`;
      this._healthFill.style.transition = 'none';
      this._healthFill.style.filter = 'brightness(2)';
      setTimeout(() => {
        this._healthFill.style.transition = 'width 0.15s';
        this._healthFill.style.filter = 'none';
        this._healthGhost.style.transition = 'width 0.6s ease-out';
        this._healthGhost.style.width = `${pct * 100}%`;
      }, 80);
    }
    this._prevHealth = stats.health;

    // Stats
    this._statsText.textContent = `K: ${stats.kills} | D: ${stats.deaths}`;

    // Respawn
    this._respawnEl.style.display = stats.alive ? 'none' : 'block';

    // Abilities
    if (stats.abilities) {
      for (const [name, cd] of Object.entries(stats.abilities)) {
        const ui = this._abilityEls[name];
        if (!ui) continue;
        if (cd.ready) {
          ui.overlay.style.setProperty('--cd-pct', '0%');
          ui.text.textContent = '';
          ui.el.classList.remove('on-cooldown');
        } else {
          const remainPct = (cd.remaining / cd.total) * 100;
          ui.overlay.style.setProperty('--cd-pct', `${remainPct}%`);
          ui.text.textContent = `${Math.ceil(cd.remaining / 1000)}s`;
          ui.el.classList.add('on-cooldown');
        }
      }
    }

    // Compass
    this._drawCompass(stats.playerAngle);

    // Minimap
    this._drawMinimap(stats);
  }

  showResult(text, isWin) {
    this._resultEl.textContent = text;
    this._resultEl.style.color = isWin ? '#44ff44' : '#ff4444';
    this._resultEl.style.display = 'block';
  }

  activateRadar(enemies, duration) {
    this._radarEnemies = enemies;
    if (this._radarTimeout) clearTimeout(this._radarTimeout);
    this._radarTimeout = setTimeout(() => {
      this._radarEnemies = null;
    }, duration);
  }

  // ─── SKYDIVE ────────────────────────────────────────────────
  showSkydive() {
    this._skydiveEl.style.display = 'block';
    this._respawnEl.style.display = 'none';
  }

  hideSkydive() {
    this._skydiveEl.style.display = 'none';
  }

  updateSkydiveAlt(height) {
    this._skydiveAltEl.textContent = `ALT: ${Math.round(height)}m`;
  }

  // ─── KILL FEED ───────────────────────────────────────────────
  addKillFeedEntry(killer, victim, isMyKill) {
    const entry = document.createElement('div');
    entry.className = 'kill-feed-entry' + (isMyKill ? ' my-kill' : '');
    entry.innerHTML = `<span class="kf-killer">${killer}</span> <span class="kf-arrow">\u25B8</span> <span class="kf-victim">${victim}</span>`;
    this._killFeedEl.appendChild(entry);

    // Trigger slide-in
    requestAnimationFrame(() => entry.classList.add('visible'));

    // Auto-remove after 5s
    setTimeout(() => {
      entry.classList.add('fading');
      setTimeout(() => entry.remove(), 500);
    }, 5000);

    // Keep max 4 entries
    while (this._killFeedEl.children.length > 4) {
      this._killFeedEl.firstChild.remove();
    }
  }

  // ─── ALIVE COUNT ─────────────────────────────────────────────
  updateAliveCount(count) {
    this._aliveEl.textContent = `ALIVE: ${count}`;
  }

  // ─── FPS ─────────────────────────────────────────────────────
  updateFPS(fps) {
    this._fpsEl.textContent = `FPS: ${fps}`;
  }

  // ─── DAMAGE NUMBERS ──────────────────────────────────────────
  showDamageNumber(damage, screenX, screenY) {
    const el = document.createElement('div');
    el.className = 'hud-damage-number';
    el.textContent = `-${damage}`;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    this.el.appendChild(el);
    requestAnimationFrame(() => el.classList.add('animate'));
    setTimeout(() => el.remove(), 800);
  }

  // ─── COMPASS ─────────────────────────────────────────────────
  _drawCompass(angle) {
    const ctx = this._compassCtx;
    const w = 200, h = 24;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(5, 5, 15, 0.6)';
    ctx.fillRect(0, 0, w, h);

    const directions = [
      { label: 'N', angle: -Math.PI / 2 },
      { label: 'E', angle: 0 },
      { label: 'S', angle: Math.PI / 2 },
      { label: 'W', angle: Math.PI },
    ];

    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerAngle = angle || 0;
    const pixPerRad = w / (Math.PI * 0.8);

    // Draw degree ticks
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180 - Math.PI / 2;
      let diff = rad - centerAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const px = w / 2 + diff * pixPerRad;
      if (px < 5 || px > w - 5) continue;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(px, deg % 45 === 0 ? 4 : 8);
      ctx.lineTo(px, deg % 45 === 0 ? 20 : 16);
      ctx.stroke();
    }

    // Draw cardinal directions
    for (const dir of directions) {
      let diff = dir.angle - centerAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const px = w / 2 + diff * pixPerRad;
      if (px < 10 || px > w - 10) continue;

      const isNorth = dir.label === 'N';
      ctx.fillStyle = isNorth ? '#ff4444' : 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(dir.label, px, h / 2);
    }

    // Center marker
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 5);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(68, 136, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }

  _drawMinimap(stats) {
    const ctx = this._minimapCtx;
    const w = 200;
    const h = 200;
    const worldW = 2000;
    const worldH = 2000;

    ctx.clearRect(0, 0, w, h);

    // Draw cached wall grid (or fallback to background)
    if (this._wallGridCache) {
      ctx.drawImage(this._wallGridCache, 0, 0);
    } else {
      // Background only - no walls
      ctx.fillStyle = 'rgba(5, 5, 15, 0.7)';
      ctx.fillRect(0, 0, w, h);
    }

    // Draw BR zone circle if active
    if (this._zoneData) {
      const zx = (this._zoneData.x / worldW) * w;
      const zy = (this._zoneData.y / worldH) * h;
      const zr = (this._zoneData.radius / worldW) * w;
      ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zx, zy, zr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = 'rgba(68, 136, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    // Player position and direction
    if (stats.playerX !== undefined) {
      const px = (stats.playerX / worldW) * w;
      const py = (stats.playerY / worldH) * h;
      const angle = stats.playerAngle || 0;

      // FOV cone
      const fovHalf = Math.PI / 6; // 60-degree cone
      const coneLen = 20;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(68, 136, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(-fovHalf) * coneLen, Math.sin(-fovHalf) * coneLen);
      ctx.arc(0, 0, coneLen, -fovHalf, fovHalf);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Direction triangle
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, -3);
      ctx.lineTo(-3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Player glow
      ctx.fillStyle = 'rgba(68, 136, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Radar enemies
    if (this._radarEnemies) {
      for (const enemy of this._radarEnemies) {
        const ex = (enemy.x / worldW) * w;
        const ey = (enemy.y / worldH) * h;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  updateZone(x, y, radius) {
    this._zoneData = { x, y, radius };
  }

  updateAliveCount(count) {
    this._aliveEl.textContent = `ALIVE: ${count}`;
  }

  updateFlags(flags, scores) {
    this._flagData = flags;
    this._aliveEl.textContent = `RED: ${scores.red} | BLUE: ${scores.blue}`;
  }

  updateHill(x, y, radius, controlling, scores) {
    this._hillData = { x, y, radius };
    const ctrl = controlling ? controlling.toUpperCase() : 'NONE';
    this._aliveEl.textContent = `RED: ${scores.red} | BLUE: ${scores.blue} | HILL: ${ctrl}`;
  }
}
