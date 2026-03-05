import { ProfilePanel } from './ProfilePanel.js';

export class MenuScreen {
  constructor(root, game) {
    this.game = game;
    this.selectedMap = 'arena';

    this.el = document.createElement('div');
    this.el.className = 'menu-screen';
    this.el.innerHTML = `
      <h1 class="menu-title">SHADOW ARENA</h1>
      <h2 class="menu-subtitle">TACTICAL OPS</h2>
      <div class="menu-status"></div>
      <div class="menu-account"></div>
      <div class="menu-map-select">
        <span class="map-label">MAP:</span>
        <button class="map-btn active" data-map="arena">Arena</button>
        <button class="map-btn" data-map="warehouse">Warehouse</button>
        <button class="map-btn" data-map="desert">Desert</button>
      </div>
      <div class="menu-buttons">
        <button class="menu-btn" data-mode="solo">SOLO MISSION</button>
        <button class="menu-btn" data-mode="battle_royale">BATTLE ROYALE (Online)</button>
        <button class="menu-btn" data-mode="ctf">CAPTURE THE FLAG (Online)</button>
        <button class="menu-btn" data-mode="koth">KING OF THE HILL (Online)</button>
        <button class="menu-btn" data-mode="duel">1v1 DUEL (Online)</button>
        <button class="menu-btn" data-mode="team2v2">2v2 TEAM (Online)</button>
        <button class="menu-btn" data-mode="team3v3">3v3 TEAM (Online)</button>
      </div>
      <div class="menu-bottom-bar">
        <button class="menu-profile-btn">PROFILE</button>
      </div>
      <div class="menu-controls"></div>
    `;
    root.appendChild(this.el);

    // Profile panel
    this.profilePanel = new ProfilePanel(root, game);

    // Map selection
    this.el.querySelectorAll('.map-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMap = btn.dataset.map;
      });
    });

    // Mode buttons
    this.el.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.game.startGame(mode, this.selectedMap);
      });
    });

    // Profile button
    this.el.querySelector('.menu-profile-btn').addEventListener('click', () => {
      this.profilePanel.show();
    });

    // Controls hint
    const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const controlsEl = this.el.querySelector('.menu-controls');
    if (isMobile) {
      controlsEl.textContent = 'Left Joystick: Move | Right Joystick: Aim + Shoot';
    } else {
      controlsEl.innerHTML = 'WASD: Move | Mouse: Aim | Click: Shoot<br>Q: Dash | E: Shield | R: Radar | F: Heal | V: Switch View';
    }

    this.statusEl = this.el.querySelector('.menu-status');
    this.accountEl = this.el.querySelector('.menu-account');

    // Check for saved login
    this._checkAuth();
  }

  _checkAuth() {
    const token = localStorage.getItem('sa_token');
    const username = localStorage.getItem('sa_username');

    if (token && username) {
      this.accountEl.innerHTML = `
        <span class="account-user">Logged in as <strong>${username}</strong></span>
        <button class="account-logout-btn">LOGOUT</button>
      `;
      this.accountEl.querySelector('.account-logout-btn').addEventListener('click', () => {
        localStorage.removeItem('sa_token');
        localStorage.removeItem('sa_username');
        localStorage.removeItem('sa_playerId');
        this.game.playerLevel = 1;
        this.game.equippedSkin = 'default';
        this.game.equippedTrail = 'none';
        this.game.unlockedAchievements = [];
        this._checkAuth();
      });
    } else {
      this.accountEl.innerHTML = `
        <div class="account-form">
          <input type="text" class="account-input" placeholder="Username" maxlength="20">
          <input type="password" class="account-input" placeholder="Password">
          <button class="account-btn">LOGIN</button>
          <button class="account-btn account-reg-btn">REGISTER</button>
        </div>
        <div class="account-error"></div>
      `;
      const inputs = this.accountEl.querySelectorAll('.account-input');
      const loginBtn = this.accountEl.querySelector('.account-btn');
      const regBtn = this.accountEl.querySelector('.account-reg-btn');
      const errEl = this.accountEl.querySelector('.account-error');

      const doAuth = (endpoint) => {
        const username = inputs[0].value.trim();
        const password = inputs[1].value;
        if (!username || !password) { errEl.textContent = 'Fill in both fields'; return; }
        fetch(`/api/auth/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        }).then(r => r.json()).then(data => {
          if (data.error) {
            errEl.textContent = data.error;
          } else {
            localStorage.setItem('sa_token', data.token);
            localStorage.setItem('sa_username', data.player.username);
            localStorage.setItem('sa_playerId', data.player.id);
            this.game.playerLevel = data.player.level || 1;
            this.game.equippedSkin = data.player.equippedSkin || 'default';
            this.game.equippedTrail = data.player.equippedTrail || 'none';
            this.game.unlockedAchievements = data.player.achievements || [];
            this._checkAuth();
          }
        }).catch(() => { errEl.textContent = 'Connection error'; });
      };

      loginBtn.addEventListener('click', () => doAuth('login'));
      regBtn.addEventListener('click', () => doAuth('register'));
    }
  }

  show() {
    this.el.style.display = 'flex';
    this.statusEl.textContent = '';
    this._checkAuth();
  }

  hide() {
    this.el.style.display = 'none';
    this.profilePanel.hide();
  }

  showStatus(text) {
    this.statusEl.textContent = text;
  }
}
