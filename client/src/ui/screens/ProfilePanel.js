import { AchievementConfig } from 'shadow-arena-shared/config/AchievementConfig.js';
import { SkinConfig, TrailConfig } from 'shadow-arena-shared/config/CosmeticConfig.js';

export class ProfilePanel {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'profile-panel';
    this.el.style.display = 'none';
    this.el.innerHTML = `
      <div class="profile-header">
        <button class="profile-close-btn">X</button>
        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="skins">SKINS</button>
          <button class="profile-tab" data-tab="achievements">ACHIEVEMENTS</button>
          <button class="profile-tab" data-tab="friends">FRIENDS</button>
        </div>
      </div>
      <div class="profile-content">
        <div class="profile-tab-content" data-tab="skins"></div>
        <div class="profile-tab-content" data-tab="achievements" style="display:none"></div>
        <div class="profile-tab-content" data-tab="friends" style="display:none"></div>
      </div>
    `;
    root.appendChild(this.el);

    this._closeBtn = this.el.querySelector('.profile-close-btn');
    this._closeBtn.addEventListener('click', () => this.hide());

    this._tabs = this.el.querySelectorAll('.profile-tab');
    this._tabContents = this.el.querySelectorAll('.profile-tab-content');

    this._tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this._tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._tabContents.forEach(tc => {
          tc.style.display = tc.dataset.tab === tab.dataset.tab ? 'block' : 'none';
        });
      });
    });
  }

  show() {
    this.el.style.display = 'flex';
    this._renderSkins();
    this._renderAchievements();
    this._renderFriends();
  }

  hide() {
    this.el.style.display = 'none';
  }

  _renderSkins() {
    const container = this.el.querySelector('[data-tab="skins"]');
    const playerLevel = this.game.playerLevel || 1;
    const equippedSkin = this.game.equippedSkin || 'default';
    const equippedTrail = this.game.equippedTrail || 'none';

    let html = '<div class="skin-section"><h3 class="section-title">CHARACTER SKINS</h3><div class="skin-grid">';
    for (const [id, skin] of Object.entries(SkinConfig)) {
      const unlocked = playerLevel >= skin.unlockLevel;
      const equipped = equippedSkin === id;
      const cls = `skin-card${equipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;
      const colorHex = '#' + skin.bodyColor.toString(16).padStart(6, '0');
      const visorHex = '#' + skin.visorColor.toString(16).padStart(6, '0');
      html += `<div class="${cls}" data-skin="${id}">
        <div class="skin-preview" style="background: linear-gradient(135deg, ${colorHex}, ${visorHex})"></div>
        <div class="skin-name">${skin.name}</div>
        <div class="skin-info">${unlocked ? (equipped ? 'EQUIPPED' : 'CLICK TO EQUIP') : 'LV ' + skin.unlockLevel}</div>
      </div>`;
    }
    html += '</div></div>';

    html += '<div class="skin-section"><h3 class="section-title">TRAIL EFFECTS</h3><div class="skin-grid">';
    for (const [id, trail] of Object.entries(TrailConfig)) {
      const unlocked = playerLevel >= trail.unlockLevel;
      const equipped = equippedTrail === id;
      const cls = `skin-card trail-card${equipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;
      const colorHex = trail.color ? '#' + trail.color.toString(16).padStart(6, '0') : '#333';
      html += `<div class="${cls}" data-trail="${id}">
        <div class="skin-preview trail-preview" style="background: ${id === 'none' ? '#222' : `radial-gradient(circle, ${colorHex}, #111)`}"></div>
        <div class="skin-name">${trail.name}</div>
        <div class="skin-info">${unlocked ? (equipped ? 'EQUIPPED' : 'CLICK TO EQUIP') : 'LV ' + trail.unlockLevel}</div>
      </div>`;
    }
    html += '</div></div>';

    container.innerHTML = html;

    // Skin click handlers
    container.querySelectorAll('.skin-card[data-skin]').forEach(card => {
      card.addEventListener('click', () => {
        const skinId = card.dataset.skin;
        const skin = SkinConfig[skinId];
        if (!skin || (this.game.playerLevel || 1) < skin.unlockLevel) return;
        this.game.equippedSkin = skinId;
        this._equipCosmetic(skinId, null);
        this._renderSkins();
      });
    });

    container.querySelectorAll('.skin-card[data-trail]').forEach(card => {
      card.addEventListener('click', () => {
        const trailId = card.dataset.trail;
        const trail = TrailConfig[trailId];
        if (!trail || (this.game.playerLevel || 1) < trail.unlockLevel) return;
        this.game.equippedTrail = trailId;
        this._equipCosmetic(null, trailId);
        this._renderSkins();
      });
    });
  }

  _equipCosmetic(skin, trail) {
    const token = localStorage.getItem('sa_token');
    if (!token) return;
    const body = {};
    if (skin) body.skin = skin;
    if (trail) body.trail = trail;
    fetch('/api/cosmetics/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  _renderAchievements() {
    const container = this.el.querySelector('[data-tab="achievements"]');
    const unlocked = this.game.unlockedAchievements || [];

    let html = '<div class="achievement-grid">';
    for (const [id, ach] of Object.entries(AchievementConfig)) {
      const isUnlocked = unlocked.includes(id);
      const cls = `achievement-card${isUnlocked ? ' unlocked' : ''}`;
      html += `<div class="${cls}">
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${ach.name}</div>
          <div class="achievement-desc">${ach.description}</div>
          <div class="achievement-reward">+${ach.xpReward} XP</div>
        </div>
        <div class="achievement-status">${isUnlocked ? 'UNLOCKED' : 'LOCKED'}</div>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  _renderFriends() {
    const container = this.el.querySelector('[data-tab="friends"]');
    const token = localStorage.getItem('sa_token');

    if (!token) {
      container.innerHTML = '<div class="friends-login-prompt">Log in to use the friends system</div>';
      return;
    }

    container.innerHTML = `
      <div class="friends-add">
        <input type="text" class="friends-input" placeholder="Enter username..." maxlength="20">
        <button class="friends-add-btn">ADD</button>
      </div>
      <div class="friends-pending"></div>
      <div class="friends-list"></div>
    `;

    const input = container.querySelector('.friends-input');
    const addBtn = container.querySelector('.friends-add-btn');

    addBtn.addEventListener('click', () => {
      const username = input.value.trim();
      if (!username) return;
      fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username })
      }).then(r => r.json()).then(data => {
        if (data.error) {
          input.value = data.error;
        } else {
          input.value = '';
          this._loadFriends(container, token);
        }
      }).catch(() => {});
    });

    this._loadFriends(container, token);
  }

  _loadFriends(container, token) {
    fetch('/api/friends', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(data => {
      const pendingEl = container.querySelector('.friends-pending');
      const listEl = container.querySelector('.friends-list');

      if (data.pending && data.pending.length > 0) {
        let phtml = '<h4 class="section-title">PENDING REQUESTS</h4>';
        for (const req of data.pending) {
          phtml += `<div class="friend-entry pending">
            <span class="friend-name">${req.username} (Lv ${req.level})</span>
            <button class="friend-accept-btn" data-id="${req.player_id}">ACCEPT</button>
          </div>`;
        }
        pendingEl.innerHTML = phtml;

        pendingEl.querySelectorAll('.friend-accept-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            fetch('/api/friends/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ requesterId: btn.dataset.id })
            }).then(() => this._loadFriends(container, token));
          });
        });
      } else {
        pendingEl.innerHTML = '';
      }

      if (data.friends && data.friends.length > 0) {
        let fhtml = '<h4 class="section-title">FRIENDS</h4>';
        for (const f of data.friends) {
          fhtml += `<div class="friend-entry">
            <span class="friend-name">${f.username}</span>
            <span class="friend-level">Lv ${f.level} | ${f.rating} ELO</span>
          </div>`;
        }
        listEl.innerHTML = fhtml;
      } else {
        listEl.innerHTML = '<div class="friends-empty">No friends yet. Add someone!</div>';
      }
    }).catch(() => {});
  }
}
