import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export function isWallTile(x, y, mapWidth, mapHeight) {
  const pillarSpacing = 15;
  const px = x % pillarSpacing;
  const py = y % pillarSpacing;

  if (px >= 7 && px <= 9 && py >= 7 && py <= 9) {
    const cx = Math.floor(mapWidth / 2 / pillarSpacing);
    const cy = Math.floor(mapHeight / 2 / pillarSpacing);
    const ix = Math.floor(x / pillarSpacing);
    const iy = Math.floor(y / pillarSpacing);
    if (ix === cx && iy === cy) return false;
    return true;
  }

  const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  if (hash % 200 === 0) {
    const distFromCenter = Math.sqrt(Math.pow(x - mapWidth / 2, 2) + Math.pow(y - mapHeight / 2, 2));
    if (distFromCenter > 10) return true;
  }

  return false;
}

export function generateWallData() {
  const mapWidth = Math.floor(GameConfig.WORLD_WIDTH / GameConfig.TILE_SIZE);
  const mapHeight = Math.floor(GameConfig.WORLD_HEIGHT / GameConfig.TILE_SIZE);

  // Boolean grid for collision
  const grid = [];
  // Wall tile positions for rendering
  const wallPositions = [];

  for (let y = 0; y < mapHeight; y++) {
    const row = [];
    for (let x = 0; x < mapWidth; x++) {
      const isBorder = x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1;
      const isWall = isBorder || isWallTile(x, y, mapWidth, mapHeight);
      row.push(isWall);
      if (isWall) {
        wallPositions.push({ x, y });
      }
    }
    grid.push(row);
  }

  return { grid, wallPositions, mapWidth, mapHeight };
}
