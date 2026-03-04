export class HUD {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <div class="hud-top-left">
        <div class="hud-health-text">HP: 100/100</div>
        <div class="hud-health-bar">
          <div class="hud-health-fill"></div>
        </div>
        <div class="hud-stats">K: 0 | D: 0</div>
      </div>
      <div class="hud-top-right">
        <div class="hud-mode"></div>
      </div>
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
      <div class="hud-hitmarker"></div>
      <div class="hud-respawn">RESPAWNING...</div>
      <div class="hud-result"></div>
      <div class="hud-minimap">
        <canvas class="minimap-canvas" width="160" height="160"></canvas>
      </div>
    `;
    root.appendChild(this.el);

    this._healthText = this.el.querySelector('.hud-health-text');
    this._healthFill = this.el.querySelector('.hud-health-fill');
    this._statsText = this.el.querySelector('.hud-stats');
    this._modeText = this.el.querySelector('.hud-mode');
    this._respawnEl = this.el.querySelector('.hud-respawn');
    this._resultEl = this.el.querySelector('.hud-result');
    this._hitmarker = this.el.querySelector('.hud-hitmarker');
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

    // Health bar flash on damage
    if (stats.health < this._prevHealth) {
      this._healthFill.style.transition = 'none';
      this._healthFill.style.filter = 'brightness(2)';
      setTimeout(() => {
        this._healthFill.style.transition = 'width 0.15s';
        this._healthFill.style.filter = 'none';
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
          ui.overlay.style.width = '0%';
          ui.text.textContent = '';
          ui.el.classList.remove('on-cooldown');
        } else {
          const remainPct = (cd.remaining / cd.total) * 100;
          ui.overlay.style.width = `${remainPct}%`;
          ui.text.textContent = `${Math.ceil(cd.remaining / 1000)}s`;
          ui.el.classList.add('on-cooldown');
        }
      }
    }

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

  _drawMinimap(stats) {
    const ctx = this._minimapCtx;
    const w = 160;
    const h = 160;
    const worldW = 2000;
    const worldH = 2000;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(5, 5, 15, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Draw walls if available
    if (this._wallGrid) {
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
    }

    // Border
    ctx.strokeStyle = 'rgba(68, 136, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    // Player position and direction
    if (stats.playerX !== undefined) {
      const px = (stats.playerX / worldW) * w;
      const py = (stats.playerY / worldH) * h;

      // Direction triangle
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(stats.playerAngle || 0);
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
}
