import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ProgressionSystem } from 'shadow-arena-shared/systems/ProgressionSystem.js';
import { AchievementConfig } from 'shadow-arena-shared/config/AchievementConfig.js';
import { SkinConfig, TrailConfig, getUnlockedSkins, getUnlockedTrails } from 'shadow-arena-shared/config/CosmeticConfig.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shadow-arena-dev-secret-change-in-production';

// Simple in-memory rate limiter for auth endpoints
const authAttempts = new Map(); // ip -> { count, resetAt }
function authRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    entry.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + 60000 }); // 10 per minute
  }
  // Cleanup old entries periodically
  if (authAttempts.size > 1000) {
    for (const [key, val] of authAttempts) {
      if (now > val.resetAt) authAttempts.delete(key);
    }
  }
  next();
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function createRoutes(playerRepo) {
  const router = Router();

  // Register
  router.post('/auth/register', authRateLimit, async (req, res) => {
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
  router.post('/auth/login', authRateLimit, async (req, res) => {
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
      const cosmetics = playerRepo.getCosmetics(player.id);
      const achievements = playerRepo.getAchievements(player.id);

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
          unlockedAbilities: JSON.parse(player.unlocked_abilities || '["dash"]'),
          equippedSkin: cosmetics?.equippedSkin || 'default',
          equippedTrail: cosmetics?.equippedTrail || 'none',
          achievements: achievements.map(a => a.achievement_id)
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

  // ─── FRIENDS ─────────────────────────────────────────────────────

  // Send friend request
  router.post('/friends/request', authMiddleware, (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ error: 'Username required' });

      const friend = playerRepo.findByUsername(username);
      if (!friend) return res.status(404).json({ error: 'Player not found' });
      if (friend.id === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });

      playerRepo.sendFriendRequest(req.user.id, friend.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Friend request error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Accept friend request
  router.post('/friends/accept', authMiddleware, (req, res) => {
    try {
      const { requesterId } = req.body;
      if (!requesterId) return res.status(400).json({ error: 'Requester ID required' });

      playerRepo.acceptFriend(requesterId, req.user.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Accept friend error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Remove friend
  router.delete('/friends/:friendId', authMiddleware, (req, res) => {
    try {
      playerRepo.removeFriend(req.user.id, req.params.friendId);
      res.json({ success: true });
    } catch (err) {
      console.error('Remove friend error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get friends list
  router.get('/friends', authMiddleware, (req, res) => {
    try {
      const friends = playerRepo.getFriends(req.user.id);
      const pending = playerRepo.getPendingRequests(req.user.id);
      res.json({ friends, pending });
    } catch (err) {
      console.error('Get friends error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ─── ACHIEVEMENTS ────────────────────────────────────────────────

  // Get player achievements
  router.get('/player/:id/achievements', (req, res) => {
    try {
      const unlocked = playerRepo.getAchievements(req.params.id);
      const unlockedIds = unlocked.map(a => a.achievement_id);

      const all = Object.entries(AchievementConfig).map(([id, ach]) => ({
        id,
        ...ach,
        unlocked: unlockedIds.includes(id),
        unlockedAt: unlocked.find(a => a.achievement_id === id)?.unlocked_at || null
      }));

      res.json(all);
    } catch (err) {
      console.error('Achievements error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ─── COSMETICS ───────────────────────────────────────────────────

  // Get cosmetics
  router.get('/player/:id/cosmetics', (req, res) => {
    try {
      const player = playerRepo.findById(req.params.id);
      if (!player) return res.status(404).json({ error: 'Player not found' });

      const cosmetics = playerRepo.getCosmetics(req.params.id);
      const level = ProgressionSystem.getLevelFromXP(player.xp).level;

      res.json({
        equippedSkin: cosmetics?.equippedSkin || 'default',
        equippedTrail: cosmetics?.equippedTrail || 'none',
        unlockedSkins: getUnlockedSkins(level),
        unlockedTrails: getUnlockedTrails(level),
        allSkins: Object.entries(SkinConfig).map(([id, cfg]) => ({
          id, name: cfg.name, unlockLevel: cfg.unlockLevel,
          unlocked: level >= cfg.unlockLevel
        })),
        allTrails: Object.entries(TrailConfig).map(([id, cfg]) => ({
          id, name: cfg.name, unlockLevel: cfg.unlockLevel,
          unlocked: level >= cfg.unlockLevel
        }))
      });
    } catch (err) {
      console.error('Cosmetics error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Equip cosmetic
  router.post('/cosmetics/equip', authMiddleware, (req, res) => {
    try {
      const { skin, trail } = req.body;
      const player = playerRepo.findById(req.user.id);
      if (!player) return res.status(404).json({ error: 'Player not found' });

      const level = ProgressionSystem.getLevelFromXP(player.xp).level;
      const cosmetics = playerRepo.getCosmetics(req.user.id);

      let equippedSkin = cosmetics?.equippedSkin || 'default';
      let equippedTrail = cosmetics?.equippedTrail || 'none';
      const unlocked = cosmetics?.unlockedCosmetics || ['default'];

      if (skin && SkinConfig[skin]) {
        if (level < SkinConfig[skin].unlockLevel) {
          return res.status(403).json({ error: `Skin requires level ${SkinConfig[skin].unlockLevel}` });
        }
        equippedSkin = skin;
        if (!unlocked.includes(skin)) unlocked.push(skin);
      }

      if (trail && TrailConfig[trail]) {
        if (level < TrailConfig[trail].unlockLevel) {
          return res.status(403).json({ error: `Trail requires level ${TrailConfig[trail].unlockLevel}` });
        }
        equippedTrail = trail;
      }

      playerRepo.updateCosmetics(req.user.id, equippedSkin, equippedTrail, unlocked);
      res.json({ equippedSkin, equippedTrail });
    } catch (err) {
      console.error('Equip cosmetic error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
