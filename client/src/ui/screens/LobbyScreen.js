const MODE_LABELS = {
  duel: '1v1 DUEL',
  team2v2: '2v2 TEAM',
  team3v3: '3v3 TEAM'
};

export class LobbyScreen {
  constructor(root, game) {
    this.game = game;
    this._mode = 'duel';
    this._isHost = false;
    this._maxPlayers = 2;

    this.el = document.createElement('div');
    this.el.className = 'lobby-screen';
    this.el.innerHTML = `
      <h1 class="lobby-title">SHADOW ARENA</h1>
      <h2 class="lobby-mode-label">1v1 DUEL</h2>

      <div class="lobby-initial">
        <button class="menu-btn lobby-create-btn">CREATE MATCH</button>
        <div class="lobby-join-row">
          <input class="lobby-code-input" type="text" placeholder="ENTER CODE" maxlength="6" spellcheck="false" autocomplete="off">
          <button class="menu-btn lobby-join-btn">JOIN</button>
        </div>
        <button class="menu-btn lobby-back-btn">BACK</button>
      </div>

      <div class="lobby-view" style="display:none">
        <div class="lobby-code-row">
          <span class="lobby-code-label">MATCH CODE:</span>
          <span class="lobby-code"></span>
          <button class="lobby-copy-btn">COPY</button>
        </div>
        <div class="lobby-players"></div>
        <div class="lobby-actions">
          <button class="menu-btn lobby-start-btn" disabled>START MATCH</button>
          <button class="menu-btn lobby-leave-btn">LEAVE</button>
        </div>
      </div>

      <div class="lobby-status"></div>
    `;
    this.el.style.display = 'none';
    root.appendChild(this.el);

    // Refs
    this._initialEl = this.el.querySelector('.lobby-initial');
    this._viewEl = this.el.querySelector('.lobby-view');
    this._modeLabelEl = this.el.querySelector('.lobby-mode-label');
    this._codeEl = this.el.querySelector('.lobby-code');
    this._codeInputEl = this.el.querySelector('.lobby-code-input');
    this._playersEl = this.el.querySelector('.lobby-players');
    this._startBtn = this.el.querySelector('.lobby-start-btn');
    this._statusEl = this.el.querySelector('.lobby-status');

    // Force uppercase on code input
    this._codeInputEl.addEventListener('input', () => {
      this._codeInputEl.value = this._codeInputEl.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // Button events
    this.el.querySelector('.lobby-create-btn').addEventListener('click', () => {
      this._statusEl.textContent = 'Connecting...';
      this.game.connectAndCreateRoom(this._mode);
    });

    this.el.querySelector('.lobby-join-btn').addEventListener('click', () => {
      const code = this._codeInputEl.value.trim();
      if (code.length < 4) {
        this._statusEl.textContent = 'Enter a valid code';
        return;
      }
      this._statusEl.textContent = 'Connecting...';
      this.game.connectAndJoinRoom(code, this._mode);
    });

    this._codeInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.el.querySelector('.lobby-join-btn').click();
      }
    });

    this.el.querySelector('.lobby-back-btn').addEventListener('click', () => {
      this.game.returnToMenu();
    });

    this.el.querySelector('.lobby-copy-btn').addEventListener('click', () => {
      const code = this._codeEl.textContent;
      const copyBtn = this.el.querySelector('.lobby-copy-btn');
      const showCopied = () => {
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
      };

      // clipboard API requires secure context (HTTPS/localhost)
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code).then(showCopied).catch(() => {
          this._fallbackCopy(code);
          showCopied();
        });
      } else {
        this._fallbackCopy(code);
        showCopied();
      }
    });

    this._startBtn.addEventListener('click', () => {
      this.game.hostStartMatch();
    });

    this.el.querySelector('.lobby-leave-btn').addEventListener('click', () => {
      this.game.leaveLobby();
    });
  }

  show(mode) {
    this._mode = mode;
    this._modeLabelEl.textContent = MODE_LABELS[mode] || mode.toUpperCase();
    this.el.style.display = 'flex';
    this._initialEl.style.display = 'flex';
    this._viewEl.style.display = 'none';
    this._statusEl.textContent = '';
    this._codeInputEl.value = '';
  }

  hide() {
    this.el.style.display = 'none';
  }

  showLobby(code, players, maxPlayers, isHost) {
    this._isHost = isHost;
    this._maxPlayers = maxPlayers;
    this._initialEl.style.display = 'none';
    this._viewEl.style.display = 'flex';
    this._statusEl.textContent = '';
    this._codeEl.textContent = code;
    this._startBtn.style.display = isHost ? '' : 'none';
    this.updatePlayers(players, maxPlayers);
  }

  updatePlayers(players, maxPlayers) {
    this._maxPlayers = maxPlayers || this._maxPlayers;
    const isTeamMode = this._mode === 'team2v2' || this._mode === 'team3v3';

    let html = `<div class="lobby-players-title">PLAYERS (${players.length}/${this._maxPlayers})</div>`;

    for (const p of players) {
      const hostTag = p.isHost ? ' (Host)' : '';
      const teamClass = p.team ? ` ${p.team}` : '';
      const teamLabel = isTeamMode && p.team ? `<span class="lobby-team-tag ${p.team}">${p.team.toUpperCase()}</span>` : '';
      html += `<div class="lobby-player${teamClass}">
        <span class="lobby-player-name">Player${hostTag}</span>
        ${teamLabel}
      </div>`;
    }

    // Empty slots
    for (let i = players.length; i < this._maxPlayers; i++) {
      const team = isTeamMode ? (i < this._maxPlayers / 2 ? 'red' : 'blue') : '';
      const teamLabel = isTeamMode ? `<span class="lobby-team-tag ${team}">${team.toUpperCase()}</span>` : '';
      html += `<div class="lobby-player empty">
        <span class="lobby-player-name">Waiting...</span>
        ${teamLabel}
      </div>`;
    }

    this._playersEl.innerHTML = html;

    // Enable/disable start button
    const isFull = players.length >= this._maxPlayers;
    this._startBtn.disabled = !isFull;
    this._startBtn.textContent = isFull ? 'START MATCH' : `WAITING (${players.length}/${this._maxPlayers})`;
  }

  _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  showError(message) {
    this._statusEl.textContent = message;
    this._statusEl.style.color = '#ff4444';
    setTimeout(() => { this._statusEl.style.color = ''; }, 3000);
  }
}
