import { MenuScreen } from './screens/MenuScreen.js';
import { GameOverScreen } from './screens/GameOverScreen.js';
import { HUD } from './hud/HUD.js';
import { VirtualJoystick } from './mobile/VirtualJoystick.js';
import { MobileAbilityButtons } from './mobile/MobileAbilityButtons.js';

export class UIManager {
  constructor(root, game) {
    this.root = root;
    this.game = game;

    this.isMobile = ('ontouchstart' in window)
      || (navigator.maxTouchPoints > 0)
      || (window.innerWidth < 1024 && 'orientation' in window);

    // Load CSS
    this._loadStyles();

    // Create UI layers
    this.menu = new MenuScreen(root, game);
    this.gameOver = new GameOverScreen(root, game);
    this.hud = new HUD(root);

    // Mobile controls
    this.moveJoystick = null;
    this.aimJoystick = null;
    this.abilityButtons = null;
  }

  _loadStyles() {
    if (document.getElementById('game-styles')) return;
    const link = document.createElement('link');
    link.id = 'game-styles';
    link.rel = 'stylesheet';
    link.href = '/src/styles.css';
    document.head.appendChild(link);
  }

  showMenu() {
    this.menu.show();
    this.hud.hide();
    this.gameOver.hide();
    this._hideMobileControls();
  }

  showConnecting() {
    this.menu.showStatus('Connecting to server...');
  }

  showStatus(text) {
    this.menu.showStatus(text);
  }

  showHUD(mode) {
    this.menu.hide();
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
