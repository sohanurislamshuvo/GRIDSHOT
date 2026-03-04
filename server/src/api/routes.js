import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ProgressionSystem } from 'shadow-arena-shared/systems/ProgressionSystem.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shadow-arena-dev-secret-change-in-production';

export function createRoutes(playerRepo) {
  const router = Router();

  // Register
  router.post('/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 3-20 characters' });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }

      // Check if username exists
      const existing = playerRepo.findByUsername(username);
      if (existing) {
        return res.status(409).json({ error: 'Username already taken' });
      }

      const hash = bcrypt.hashSync(password, 10);
      const player = playerRepo.create(username, hash);

      const token = jwt.sign({ id: player.id, username: player.username }, JWT_SECRET, {
        expiresIn: '7d'
      });

      res.json({
        token,
        player: {
          id: player.id,
          username: player.username,
          level: player.level,
          xp: player.xp,
          rating: player.rating,
          rank: ProgressionSystem.getRankTier(player.rating)
        }
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Login
  router.post('/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const player = playerRepo.findByUsername(username);
      if (!player) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = bcrypt.compareSync(password, player.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: player.id, username: player.username }, JWT_SECRET, {
        expiresIn: '7d'
      });

      const levelInfo = ProgressionSystem.getLevelFromXP(player.xp);

      res.json({
        token,
        player: {
          id: player.id,
          username: player.username,
          level: levelInfo.level,
          xp: player.xp,
          currentLevelXP: levelInfo.currentXP,
          xpForNextLevel: levelInfo.xpForNextLevel,
          rating: player.rating,
          rank: ProgressionSystem.getRankTier(player.rating),
          wins: player.wins,
          losses: player.losses,
          kills: player.kills,
          deaths: player.deaths,
          unlockedAbilities: JSON.parse(player.unlocked_abilities || '["dash"]')
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get player stats
  router.get('/player/:id/stats', (req, res) => {
    const player = playerRepo.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const levelInfo = ProgressionSystem.getLevelFromXP(player.xp);

    res.json({
      id: player.id,
      username: player.username,
      level: levelInfo.level,
      xp: player.xp,
      rating: player.rating,
      rank: ProgressionSystem.getRankTier(player.rating),
      wins: player.wins,
      losses: player.losses,
      kills: player.kills,
      deaths: player.deaths,
      kd: player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills
    });
  });

  // Leaderboard
  router.get('/leaderboard', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const players = playerRepo.getLeaderboard(limit);

    res.json(players.map((p, i) => ({
      rank: i + 1,
      username: p.username,
      level: p.level,
      rating: p.rating,
      tier: ProgressionSystem.getRankTier(p.rating).name,
      wins: p.wins,
      losses: p.losses
    })));
  });

  // Match history
  router.get('/player/:id/matches', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const matches = playerRepo.getMatchHistory(req.params.id, limit);
    res.json(matches);
  });

  return router;
}
