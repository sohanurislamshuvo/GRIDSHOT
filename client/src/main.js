import './styles.css';
import { Game } from './Game.js';

const game = new Game(
  document.getElementById('game-container'),
  document.getElementById('ui-root')
);
