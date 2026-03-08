export class LeaderboardScreen {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'leaderboard-panel';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <div class="leaderboard-header">
        <h2 class="leaderboard-title">LEADERBOARD</h2>
        <button class="profile-close-btn leaderboard-close">X</button>
      </div>
      <div class="leaderboard-content"></div>
    `;
    root.appendChild(this.el);

    this.el.querySelector('.leaderboard-close').addEventListener('click', () => this.hide());
  }

  show() {
    this.el.style.display = 'flex';
    this._load();
  }

  hide() {
    this.el.style.display = 'none';
  }

  _load() {
    const content = this.el.querySelector('.leaderboard-content');
    content.innerHTML = '<div class="lb-loading">Loading...</div>';

    fetch('/api/leaderboard?limit=50')
      .then(r => r.json())
      .then(players => {
        if (!players || players.length === 0) {
          content.innerHTML = '<div class="lb-loading">No players yet</div>';
          return;
        }

        const myUsername = localStorage.getItem('sa_username');
        const tierColors = {
          Platinum: '#E5E4E2',
          Gold: '#FFD700',
          Silver: '#C0C0C0',
          Bronze: '#CD7F32'
        };

        let html = `
          <div class="lb-table">
            <div class="lb-row lb-header">
              <span class="lb-rank">#</span>
              <span class="lb-name">PLAYER</span>
              <span class="lb-lvl">LV</span>
              <span class="lb-rating">RATING</span>
              <span class="lb-tier">TIER</span>
              <span class="lb-wl">W/L</span>
            </div>
        `;

        for (const p of players) {
          const isMe = p.username === myUsername;
          const color = tierColors[p.tier] || '#888';
          const rowCls = `lb-row${isMe ? ' lb-me' : ''}`;
          html += `
            <div class="${rowCls}">
              <span class="lb-rank">${p.rank}</span>
              <span class="lb-name">${p.username}</span>
              <span class="lb-lvl">${p.level}</span>
              <span class="lb-rating">${p.rating}</span>
              <span class="lb-tier" style="color:${color}">${p.tier}</span>
              <span class="lb-wl">${p.wins}/${p.losses}</span>
            </div>
          `;
        }

        html += '</div>';
        content.innerHTML = html;
      })
      .catch(() => {
        content.innerHTML = '<div class="lb-loading">Failed to load leaderboard</div>';
      });
  }
}
