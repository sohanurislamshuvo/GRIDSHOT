export class GameOverScreen {
  constructor(root, game) {
    this.game = game;

    this.el = document.createElement('div');
    this.el.className = 'gameover-screen';
    this.el.innerHTML = `
      <h1 class="gameover-title"></h1>
      <div class="gameover-stats"></div>
      <div class="gameover-xp"></div>
      <div class="gameover-level"></div>
      <div class="gameover-achievements"></div>
      <button class="menu-btn gameover-btn">RETURN TO MENU</button>
    `;
    this.el.style.display = 'none';
    root.appendChild(this.el);

    this.el.querySelector('.gameover-btn').addEventListener('click', () => {
      this.game.returnToMenu();
    });
  }

  show(title, isWin, stats = {}) {
    this.el.style.display = 'flex';
    const titleEl = this.el.querySelector('.gameover-title');
    titleEl.textContent = title;
    titleEl.style.color = isWin ? '#44ff44' : '#ff4444';

    const kills = stats.kills || 0;
    const deaths = stats.deaths || 0;
    const kd = deaths > 0 ? (kills / deaths).toFixed(1) : kills;

    const statsEl = this.el.querySelector('.gameover-stats');
    statsEl.innerHTML = `
      <div class="go-stat-row">
        <span class="go-stat-label">KILLS</span>
        <span class="go-stat-value">${kills}</span>
      </div>
      <div class="go-stat-row">
        <span class="go-stat-label">DEATHS</span>
        <span class="go-stat-value">${deaths}</span>
      </div>
      <div class="go-stat-row">
        <span class="go-stat-label">K/D</span>
        <span class="go-stat-value">${kd}</span>
      </div>
    `;

    // Clear XP/level/achievements until MATCH_RESULTS arrives
    this.el.querySelector('.gameover-xp').innerHTML = '';
    this.el.querySelector('.gameover-level').innerHTML = '';
    this.el.querySelector('.gameover-achievements').innerHTML = '';
  }

  showMatchResults(data) {
    const xpEl = this.el.querySelector('.gameover-xp');
    const totalXP = (data.xpEarned || 0) + (data.achievementXP || 0);
    let xpHtml = `<div class="go-xp-title">+${totalXP} XP</div>`;
    if (data.xpEarned) xpHtml += `<div class="go-xp-detail">Match: +${data.xpEarned}</div>`;
    if (data.achievementXP) xpHtml += `<div class="go-xp-detail">Achievements: +${data.achievementXP}</div>`;
    xpEl.innerHTML = xpHtml;

    // Level progress bar
    const levelEl = this.el.querySelector('.gameover-level');
    const leveledUp = data.newLevel > data.oldLevel;
    const pct = data.xpForNextLevel > 0
      ? Math.min(100, Math.round((data.currentLevelXP / data.xpForNextLevel) * 100))
      : 100;

    let levelHtml = '';
    if (leveledUp) {
      levelHtml += `<div class="go-levelup">LEVEL UP! ${data.oldLevel} → ${data.newLevel}</div>`;
    }
    levelHtml += `
      <div class="go-level-label">LEVEL ${data.newLevel}</div>
      <div class="go-level-bar-bg">
        <div class="go-level-bar-fill" style="width:0%"></div>
      </div>
      <div class="go-level-xp">${data.currentLevelXP} / ${data.xpForNextLevel} XP</div>
    `;
    levelEl.innerHTML = levelHtml;

    // Animate the bar fill
    const fill = levelEl.querySelector('.go-level-bar-fill');
    if (fill) {
      requestAnimationFrame(() => { fill.style.width = `${pct}%`; });
    }

    // New achievements
    if (data.newAchievements && data.newAchievements.length > 0) {
      const achEl = this.el.querySelector('.gameover-achievements');
      let achHtml = '<div class="go-ach-title">ACHIEVEMENTS UNLOCKED</div><div class="go-ach-list">';
      for (const ach of data.newAchievements) {
        achHtml += `<div class="go-ach-item">
          <span class="go-ach-icon">${ach.icon}</span>
          <span class="go-ach-name">${ach.name}</span>
          <span class="go-ach-xp">+${ach.xpReward} XP</span>
        </div>`;
      }
      achHtml += '</div>';
      achEl.innerHTML = achHtml;
    }
  }

  hide() {
    this.el.style.display = 'none';
  }
}
