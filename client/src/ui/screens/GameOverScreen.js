export class GameOverScreen {
  constructor(root, game) {
    this.game = game;

    this.el = document.createElement('div');
    this.el.className = 'gameover-screen';
    this.el.innerHTML = `
      <h1 class="gameover-title"></h1>
      <div class="gameover-stats"></div>
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

    const statsEl = this.el.querySelector('.gameover-stats');
    statsEl.innerHTML = `
      <div>Kills: ${stats.kills || 0}</div>
      <div>Deaths: ${stats.deaths || 0}</div>
    `;
  }

  hide() {
    this.el.style.display = 'none';
  }
}
