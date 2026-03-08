import { MenuScreen } from './screens/MenuScreen.js';
import { LobbyScreen } from './screens/LobbyScreen.js';
import { GameOverScreen } from './screens/GameOverScreen.js';
import { HUD } from './hud/HUD.js';
import { AchievementToast } from './hud/AchievementToast.js';
import { VirtualJoystick } from './mobile/VirtualJoystick.js';
import { MobileAbilityButtons } from './mobile/MobileAbilityButtons.js';

export class UIManager {
  constructor(root, game) {
    this.root = root;
    this.game = game;

    this.isMobile = ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0)
      || (window.innerWidth < 1024 && 'orientation' in window);

    // Create UI layers
    this.menu = new MenuScreen(root, game);
    this.lobby = new LobbyScreen(root, game);
    this.gameOver = new GameOverScreen(root, game);
    this.hud = new HUD(root);
    this.achievementToast = new AchievementToast(root);

    // Mobile controls
    this.moveJoystick = null;
    this.aimJoystick = null;
    this.abilityButtons = null;
  }

  showLoading() {
    this.menu.hide();
    this.lobby.hide();
    this.hud.hide();
    this.gameOver.hide();

    if (!this._loadingEl) {
      this._loadingEl = document.createElement('div');
      this._loadingEl.className = 'loading-screen';
      this._loadingEl.innerHTML = `
        <div class="loading-title">LOADING</div>
        <div class="loading-step">Initializing...</div>
        <div class="loading-bar-bg"><div class="loading-bar-fill"></div></div>
      `;
      this.root.appendChild(this._loadingEl);
    }
    this._loadingEl.style.display = 'flex';
  }

  updateLoadingProgress(step, progress) {
    if (!this._loadingEl) return;
    const stepEl = this._loadingEl.querySelector('.loading-step');
    const fillEl = this._loadingEl.querySelector('.loading-bar-fill');
    if (stepEl) stepEl.textContent = `Building ${step}...`;
    if (fillEl) fillEl.style.width = `${Math.round(progress * 100)}%`;
  }

  hideLoading() {
    if (this._loadingEl) this._loadingEl.style.display = 'none';
  }

  showMenu() {
    this.menu.show();
    this.lobby.hide();
    this.hud.hide();
    this.gameOver.hide();
    this._hideMobileControls();
    this.hideLoading();
  }

  showLobby(mode) {
    this.menu.hide();
    this.lobby.show(mode);
    this.hud.hide();
    this.gameOver.hide();
    this._hideMobileControls();
  }

  showHUD(mode) {
    this.menu.hide();
    this.lobby.hide();
    this.gameOver.hide();
    this.hud.show(mode);

    if (this.isMobile) {
      this._showMobileControls();
    }
  }

  showMatchResult(text, isWin) {
    this.hud.showResult(text, isWin);
  }

  updateHUD(stats) {
    this.hud.update(stats);
  }

  activateRadar(enemies, duration) {
    this.hud.activateRadar(enemies, duration);
  }

  _showMobileControls() {
    // Move joystick (bottom-left)
    this.moveJoystick = new VirtualJoystick(this.root, {
      x: 100, y: window.innerHeight - 100,
      baseColor: '#4488ff', thumbColor: '#88bbff'
    });

    // Aim joystick (bottom-right)
    this.aimJoystick = new VirtualJoystick(this.root, {
      x: window.innerWidth - 100, y: window.innerHeight - 100,
      baseColor: '#ff4444', thumbColor: '#ff8888'
    });

    // Ability buttons
    this.abilityButtons = new MobileAbilityButtons(this.root, (name) => {
      if (this.game.input) this.game.input.triggerAbility(name);
    });

    // Wire joysticks to input manager
    if (this.game.input) {
      this.game.input.moveJoystick = this.moveJoystick;
      this.game.input.aimJoystick = this.aimJoystick;
    }
  }

  _hideMobileControls() {
    if (this.moveJoystick) { this.moveJoystick.destroy(); this.moveJoystick = null; }
    if (this.aimJoystick) { this.aimJoystick.destroy(); this.aimJoystick = null; }
    if (this.abilityButtons) { this.abilityButtons.destroy(); this.abilityButtons = null; }
  }
}
