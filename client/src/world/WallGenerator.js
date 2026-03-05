import { GameConfig } from 'shadow-arena-shared/config/GameConfig.js';

export function isWallTile(x, y, mapWidth, mapHeight, pillarSpacing = 15, wallDensity = 200) {
  const px = x % pillarSpacing;
  const py = y % pillarSpacing;
  const pillarStart = Math.floor(pillarSpacing / 2) - 1;
  const pillarEnd = pillarStart + 2;

  if (px >= pillarStart && px <= pillarEnd && py >= pillarStart && py <= pillarEnd) {
    const cx = Math.floor(mapWidth / 2 / pillarSpacing);
    const cy = Math.floor(mapHeight / 2 / pillarSpacing);
    const ix = Math.floor(x / pillarSpacing);
    const iy = Math.floor(y / pillarSpacing);
    if (ix === cx && iy === cy) return false;
    return true;
  }

  const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  if (hash % wallDensity === 0) {
    const distFromCenter = Math.sqrt(Math.pow(x - mapWidth / 2, 2) + Math.pow(y - mapHeight / 2, 2));
    if (distFromCenter > 10) return true;
  }

  return false;
}

export function generateWallData(mapConfig) {
  const worldW = mapConfig ? mapConfig.width : GameConfig.WORLD_WIDTH;
  const worldH = mapConfig ? mapConfig.height : GameConfig.WORLD_HEIGHT;
  const tileSize = mapConfig ? mapConfig.tileSize : GameConfig.TILE_SIZE;
  const pillarSpacing = mapConfig ? mapConfig.pillarSpacing : 15;
  const wallDensity = mapConfig ? mapConfig.wallDensity : 200;

  const mapWidth = Math.floor(worldW / tileSize);
  const mapHeight = Math.floor(worldH / tileSize);

  // Boolean grid for collision
  const grid = [];
  // Wall tile positions for rendering
  const wallPositions = [];

  for (let y = 0; y < mapHeight; y++) {
    const row = [];
    for (let x = 0; x < mapWidth; x++) {
      const isBorder = x === 0 || x === mapWidth - 1 || y === 0 || y === mapHeight - 1;
      const isWall = isBorder || isWallTile(x, y, mapWidth, mapHeight, pillarSpacing, wallDensity);
      row.push(isWall);
      if (isWall) {
        wallPositions.push({ x, y });
      }
    }
    grid.push(row);
  }

  return { grid, wallPositions, mapWidth, mapHeight };
}
