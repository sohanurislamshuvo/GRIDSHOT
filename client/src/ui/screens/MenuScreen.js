export class MenuScreen {
  constructor(root, game) {
    this.game = game;

    this.el = document.createElement('div');
    this.el.className = 'menu-screen';
    this.el.innerHTML = `
      <h1 class="menu-title">SHADOW ARENA</h1>
      <h2 class="menu-subtitle">TACTICAL OPS</h2>
      <div class="menu-status"></div>
      <div class="menu-buttons">
        <button class="menu-btn" data-mode="solo">SOLO MISSION</button>
        <button class="menu-btn" data-mode="duel">1v1 DUEL (Online)</button>
        <button class="menu-btn" data-mode="team2v2">2v2 TEAM (Online)</button>
        <button class="menu-btn" data-mode="team3v3">3v3 TEAM (Online)</button>
      </div>
      <div class="menu-controls"></div>
    `;
    root.appendChild(this.el);

    // Button events
    this.el.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.game.startGame(mode);
      });
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
  }

  show() {
    this.el.style.display = 'flex';
    this.statusEl.textContent = '';
  }

  hide() {
    this.el.style.display = 'none';
  }

  showStatus(text) {
    this.statusEl.textContent = text;
  }
}
