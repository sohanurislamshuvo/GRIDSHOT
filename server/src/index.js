import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { GameServer } from './game/GameServer.js';
import { Database } from './persistence/Database.js';
import { PlayerRepository } from './persistence/PlayerRepository.js';
import { createRoutes } from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const app = express();
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST']
  }
});

// Serve client build in production
const clientDist = join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// Initialize persistence
const db = new Database();
const playerRepo = new PlayerRepository(db);

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api', createRoutes(playerRepo));

// Initialize game server
const gameServer = new GameServer(io, playerRepo);
gameServer.start();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Shadow Arena server running on port ${PORT}`);
  console.log(`  API:    http://localhost:${PORT}/api/health`);
  console.log(`  Client: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  db.close();
  process.exit(0);
});
