/**
 * Chemiation - Database Engine
 * Lightweight atomic JSON file persistence layer.
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');
const upstashAdapter = require('./upstashAdapter');

const DATA_DIR = process.env.CHEMIATION_DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const REACTIONS_FILE = path.join(DATA_DIR, 'reactions.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return ['自定推演'];
  return tags
    .map(t => String(t).trim().replace(/[<>"'/\\&`\x00-\x1F]/g, '').substring(0, 30))
    .filter(t => t.length > 0)
    .slice(0, 10);
}

function safeReadJSON(filePath, defaultData = []) {
  try {
    if (!fs.existsSync(filePath)) {
      safeWriteJSON(filePath, defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[DB] Error reading ${filePath}:`, err.message);
    return defaultData;
  }
}

function safeWriteJSON(filePath, data) {
  const tmpFile = `${filePath}.tmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const serialized = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpFile, serialized, 'utf8');
  fs.renameSync(tmpFile, filePath);
}

// In-memory cache for ultra-fast query and atomic sync
let usersCache = safeReadJSON(USERS_FILE, []);
let reactionsCache = safeReadJSON(REACTIONS_FILE, []);
let logsCache = safeReadJSON(LOGS_FILE, []);

// Initial Seeding
function initSeeds() {
  // If either users or reactions are empty, initialize with rich community ecosystem
  if (usersCache.length === 0 || reactionsCache.length === 0) {
    try {
      const { communityUsers, communityReactions } = require('./seed_community');
      if (usersCache.length === 0) {
        usersCache = JSON.parse(JSON.stringify(communityUsers));
        safeWriteJSON(USERS_FILE, usersCache);
        console.log(`[DB] Seeded ${usersCache.length} community researcher accounts.`);
      }
      if (reactionsCache.length === 0) {
        reactionsCache = JSON.parse(JSON.stringify(communityReactions));
        safeWriteJSON(REACTIONS_FILE, reactionsCache);
        console.log(`[DB] Seeded ${reactionsCache.length} community chemical mechanism repositories.`);
      }
    } catch (err) {
      console.warn('[DB] Could not seed community ecosystem:', err.message);
    }
  }


  // 3. Seed initial system startup log
  if (logsCache.length === 0) {
    logsCache.push({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'SYSTEM_INIT',
      userId: 'system',
      username: 'SYSTEM',
      details: 'Chemiation 反应原理推演工坊服务与数据库引擎初始化就绪。',
      ip: '127.0.0.1'
    });
    safeWriteJSON(LOGS_FILE, logsCache);
  }
}

initSeeds();

function shouldSyncCloud() {
  return process.env.NODE_ENV !== 'test' && upstashAdapter.isConfigured();
}

async function initUpstashSync() {
  if (!shouldSyncCloud()) return;
  try {
    const conn = await upstashAdapter.testConnection();
    if (!conn.success) {
      console.warn('[Upstash] Cloud connection test failed:', conn.error);
      return;
    }
    console.log('[Upstash] Connected to Upstash Redis Cloud successfully!');
    const cloudData = await upstashAdapter.loadAllData();
    if (cloudData && (cloudData.users.length > 0 || cloudData.reactions.length > 0)) {
      usersCache = cloudData.users;
      reactionsCache = cloudData.reactions;
      if (cloudData.logs.length > 0) logsCache = cloudData.logs;
      safeWriteJSON(USERS_FILE, usersCache);
      safeWriteJSON(REACTIONS_FILE, reactionsCache);
      console.log(`[Upstash] Cloud sync complete (${usersCache.length} users, ${reactionsCache.length} mechanisms).`);
    } else {
      console.log('[Upstash] Cloud database is empty, migrating local data to Upstash...');
      await upstashAdapter.seedInitialData(usersCache, reactionsCache);
    }
  } catch (err) {
    console.warn('[Upstash] Cloud sync exception:', err.message);
  }
}

initUpstashSync();

const db = {
  // =========================================================================
  // USER OPERATIONS
  // =========================================================================
  findUserByUsername(username) {
    if (!username) return null;
    const lower = username.toLowerCase().trim();
    return usersCache.find(u => u.username.toLowerCase() === lower) || null;
  },

  findUserById(id) {
    if (!id) return null;
    return usersCache.find(u => u.id === id) || null;
  },

  getAllUsers() {
    return usersCache.map(u => ({
      id: u.id,
      username: u.username,
      nickname: u.nickname || u.username,
      email: u.email || '',
      role: u.role || 'user',
      avatar: u.avatar || 'U',
      bio: u.bio || '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLoginAt: u.lastLoginAt || u.createdAt,
      loginCount: u.loginCount || 1,
      repoCount: reactionsCache.filter(r => r.userId === u.id).length
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  createUser({ username, passwordHash, salt, nickname = '', email = '', role = 'user', bio = '', avatar = 'U' }) {
    const now = new Date().toISOString();
    const id = `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user = {
      id,
      username: username.trim(),
      passwordHash,
      salt,
      role: role === 'admin' ? 'admin' : 'user',
      nickname: (nickname || username).trim(),
      email: email.trim(),
      avatar: avatar || 'U',
      bio: (bio || '').trim(),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      loginCount: 1
    };
    usersCache.push(user);
    safeWriteJSON(USERS_FILE, usersCache);
    if (shouldSyncCloud()) upstashAdapter.saveUser(user).catch(() => {});
    return user;
  },

  updateUser(id, updates = {}) {
    const index = usersCache.findIndex(u => u.id === id);
    if (index === -1) return null;

    const existing = usersCache[index];
    const updated = {
      ...existing,
      nickname: updates.nickname !== undefined ? updates.nickname.trim() : existing.nickname,
      email: updates.email !== undefined ? updates.email.trim() : existing.email,
      avatar: updates.avatar !== undefined ? updates.avatar : existing.avatar,
      bio: updates.bio !== undefined ? updates.bio.trim() : existing.bio,
      role: updates.role !== undefined ? updates.role : existing.role,
      passwordHash: updates.passwordHash !== undefined ? updates.passwordHash : existing.passwordHash,
      salt: updates.salt !== undefined ? updates.salt : existing.salt,
      updatedAt: new Date().toISOString()
    };
    usersCache[index] = updated;
    safeWriteJSON(USERS_FILE, usersCache);
    if (shouldSyncCloud()) upstashAdapter.saveUser(updated).catch(() => {});
    return updated;
  },

  updateLoginStats(id) {
    const user = usersCache.find(u => u.id === id);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      user.loginCount = (user.loginCount || 0) + 1;
      safeWriteJSON(USERS_FILE, usersCache);
      if (shouldSyncCloud()) upstashAdapter.saveUser(user).catch(() => {});
    }
  },

  deleteUser(id) {
    const beforeCount = usersCache.length;
    usersCache = usersCache.filter(u => u.id !== id);
    const deleted = usersCache.length < beforeCount;
    if (deleted) {
      safeWriteJSON(USERS_FILE, usersCache);
      // Clean up user's private reactions or reassign
      reactionsCache = reactionsCache.filter(r => r.userId !== id);
      safeWriteJSON(REACTIONS_FILE, reactionsCache);
      if (shouldSyncCloud()) upstashAdapter.deleteUser(id).catch(() => {});
    }
    return deleted;
  },

  // =========================================================================
  // REACTION REPOSITORY OPERATIONS
  // =========================================================================
  getReactionsByUserId(userId, options = {}) {
    const { search = '', tag = '', category = 'all' } = options;
    const q = search.toLowerCase().trim();

    return reactionsCache
      .filter(item => item.userId === userId)
      .filter(item => {
        if (category !== 'all' && item.category !== category) return false;
        if (tag && tag !== 'all') {
          if (!Array.isArray(item.tags) || !item.tags.includes(tag)) return false;
        }
        if (q) {
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchEquation = (item.equation || '').toLowerCase().includes(q);
          const matchSummary = (item.summary || '').toLowerCase().includes(q);
          const matchScript = (item.script || '').toLowerCase().includes(q);
          if (!matchTitle && !matchEquation && !matchSummary && !matchScript) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  getPublicReactions(options = {}) {
    const { search = '', tag = '', category = 'all' } = options;
    const q = search.toLowerCase().trim();

    return reactionsCache
      .filter(item => item.isPublic === true)
      .filter(item => {
        if (category !== 'all' && item.category !== category) return false;
        if (tag && tag !== 'all') {
          if (!Array.isArray(item.tags) || !item.tags.includes(tag)) return false;
        }
        if (q) {
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchEquation = (item.equation || '').toLowerCase().includes(q);
          const matchSummary = (item.summary || '').toLowerCase().includes(q);
          if (!matchTitle && !matchEquation && !matchSummary) return false;
        }
        return true;
      })
      .sort((a, b) => (b.stars || 0) - (a.stars || 0) || new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  getAllReactions() {
    return [...reactionsCache].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  getReactionById(id) {
    const item = reactionsCache.find(r => r.id === id);
    if (item) {
      item.views = (item.views || 0) + 1;
      safeWriteJSON(REACTIONS_FILE, reactionsCache);
    }
    return item || null;
  },

  createReaction({ userId, title, equation = '', summary = '', script, category = '自定推演', tags = [], isPublic = true }) {
    const now = new Date().toISOString();
    const id = `chem_repo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newReaction = {
      id,
      userId,
      title: (title || '未命名化学反应机理').trim().substring(0, 100),
      equation: (equation || '').trim().substring(0, 200),
      summary: (summary || '').trim().substring(0, 500),
      script: (script || '').trim().substring(0, 200000),
      category: (category || '自定推演').trim().substring(0, 50),
      tags: sanitizeTags(tags),
      isPublic: Boolean(isPublic),
      stars: 0,
      starredBy: [],
      forks: 0,
      forkedFrom: null,
      views: 1,
      createdAt: now,
      updatedAt: now
    };
    reactionsCache.unshift(newReaction);
    safeWriteJSON(REACTIONS_FILE, reactionsCache);
    if (shouldSyncCloud()) upstashAdapter.saveReaction(newReaction).catch(() => {});
    return newReaction;
  },

  updateReaction(id, userId, updates = {}) {
    const index = reactionsCache.findIndex(r => r.id === id);
    if (index === -1) return null;

    const existing = reactionsCache[index];
    // Permission: owner or admin
    const user = this.findUserById(userId);
    const isOwner = existing.userId === userId;
    const isAdmin = user && user.role === 'admin';
    if (!isOwner && !isAdmin) return null;

    const updated = {
      ...existing,
      title: updates.title !== undefined ? updates.title.trim().substring(0, 100) : existing.title,
      equation: updates.equation !== undefined ? updates.equation.trim().substring(0, 200) : existing.equation,
      summary: updates.summary !== undefined ? updates.summary.trim().substring(0, 500) : existing.summary,
      script: updates.script !== undefined ? updates.script.trim().substring(0, 200000) : existing.script,
      category: updates.category !== undefined ? updates.category.trim().substring(0, 50) : existing.category,
      tags: updates.tags !== undefined ? sanitizeTags(updates.tags) : existing.tags,
      isPublic: updates.isPublic !== undefined ? Boolean(updates.isPublic) : existing.isPublic,
      updatedAt: new Date().toISOString()
    };
    reactionsCache[index] = updated;
    safeWriteJSON(REACTIONS_FILE, reactionsCache);
    if (shouldSyncCloud()) upstashAdapter.saveReaction(updated).catch(() => {});
    return updated;
  },

  deleteReaction(id, userId) {
    const index = reactionsCache.findIndex(r => r.id === id);
    if (index === -1) return false;

    const existing = reactionsCache[index];
    const user = this.findUserById(userId);
    const isOwner = existing.userId === userId;
    const isAdmin = user && user.role === 'admin';
    if (!isOwner && !isAdmin) return false;

    reactionsCache.splice(index, 1);
    safeWriteJSON(REACTIONS_FILE, reactionsCache);
    if (shouldSyncCloud()) upstashAdapter.deleteReaction(id).catch(() => {});
    return true;
  },

  starReaction(id, userId) {
    const item = reactionsCache.find(r => r.id === id);
    if (!item) return null;

    const user = this.findUserById(userId);
    // Access Control (IDOR defense): Cannot star private reactions of others unless admin
    if (!item.isPublic && item.userId !== userId && (!user || user.role !== 'admin')) {
      return null;
    }

    if (!Array.isArray(item.starredBy)) item.starredBy = [];
    const idx = item.starredBy.indexOf(userId);
    let starred = false;

    if (idx >= 0) {
      item.starredBy.splice(idx, 1);
      item.stars = Math.max(0, (item.stars || 1) - 1);
      starred = false;
    } else {
      item.starredBy.push(userId);
      item.stars = (item.stars || 0) + 1;
      starred = true;
    }

    safeWriteJSON(REACTIONS_FILE, reactionsCache);
    if (shouldSyncCloud()) upstashAdapter.saveReaction(item).catch(() => {});
    return { starred, stars: item.stars };
  },

  forkReaction(id, userId) {
    const original = reactionsCache.find(r => r.id === id);
    if (!original) return null;

    const user = this.findUserById(userId);
    // Access Control (IDOR defense): Cannot fork private reactions of others unless admin
    if (!original.isPublic && original.userId !== userId && (!user || user.role !== 'admin')) {
      return null;
    }

    original.forks = (original.forks || 0) + 1;
    const now = new Date().toISOString();
    const newId = `chem_repo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const forked = {
      id: newId,
      userId,
      title: `${original.title} (Fork)`.substring(0, 100),
      equation: (original.equation || '').substring(0, 200),
      summary: (original.summary || '').substring(0, 500),
      script: original.script,
      category: (original.category || '自定推演').substring(0, 50),
      tags: [...(original.tags || []), 'forked'].slice(0, 10),
      isPublic: false,
      stars: 0,
      starredBy: [],
      forks: 0,
      forkedFrom: original.id,
      views: 0,
      createdAt: now,
      updatedAt: now
    };

    reactionsCache.unshift(forked);
    safeWriteJSON(REACTIONS_FILE, reactionsCache);
    if (shouldSyncCloud()) {
      upstashAdapter.saveReaction(original).catch(() => {});
      upstashAdapter.saveReaction(forked).catch(() => {});
    }
    return forked;
  },

  importReactions(userId, items = []) {
    if (!Array.isArray(items)) return [];
    const now = new Date().toISOString();
    const imported = [];
    // Cap import to 50 items to prevent mass insertion / DoS
    const safeItems = items.slice(0, 50);

    safeItems.forEach(item => {
      if (!item || !item.script || typeof item.script !== 'string') return;
      const id = `chem_repo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const repo = {
        id,
        userId,
        title: (item.title || '导入的化学机理').trim().substring(0, 100),
        equation: (item.equation || '').trim().substring(0, 200),
        summary: (item.summary || '').trim().substring(0, 500),
        script: item.script.trim().substring(0, 200000),
        category: (item.category || '外部导入').trim().substring(0, 50),
        tags: sanitizeTags(Array.isArray(item.tags) ? item.tags : ['导入机理']),
        isPublic: Boolean(item.isPublic),
        stars: 0,
        starredBy: [],
        forks: 0,
        forkedFrom: null,
        views: 0,
        createdAt: now,
        updatedAt: now
      };
      reactionsCache.unshift(repo);
      imported.push(repo);
    });

    if (imported.length > 0) {
      safeWriteJSON(REACTIONS_FILE, reactionsCache);
      if (shouldSyncCloud()) {
        imported.forEach(r => upstashAdapter.saveReaction(r).catch(() => {}));
      }
    }
    return imported;
  },

  countUserReactions(userId) {
    return reactionsCache.filter(r => r.userId === userId).length;
  },

  // =========================================================================
  // LOGGING & AUDIT TRAIL
  // =========================================================================
  addLog(action, userId = 'guest', username = 'Guest', details = '', ip = '127.0.0.1') {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      userId,
      username,
      details,
      ip
    };
    logsCache.unshift(entry);
    // Keep last 500 logs to prevent file explosion
    if (logsCache.length > 500) {
      logsCache = logsCache.slice(0, 500);
    }
    safeWriteJSON(LOGS_FILE, logsCache);
    if (shouldSyncCloud()) upstashAdapter.addLog(entry).catch(() => {});
    return entry;
  },

  getLogs(limit = 100, filterAction = '') {
    let list = logsCache;
    if (filterAction) {
      list = list.filter(l => l.action === filterAction);
    }
    return list.slice(0, limit);
  },

  // =========================================================================
  // SYSTEM METRICS & STATS
  // =========================================================================
  getSystemStats() {
    let totalStorageBytes = 0;
    try {
      if (fs.existsSync(USERS_FILE)) totalStorageBytes += fs.statSync(USERS_FILE).size;
      if (fs.existsSync(REACTIONS_FILE)) totalStorageBytes += fs.statSync(REACTIONS_FILE).size;
      if (fs.existsSync(LOGS_FILE)) totalStorageBytes += fs.statSync(LOGS_FILE).size;
    } catch {}

    const mem = process.memoryUsage();

    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`
      },
      counts: {
        users: usersCache.length,
        reactions: reactionsCache.length,
        publicReactions: reactionsCache.filter(r => r.isPublic).length,
        privateReactions: reactionsCache.filter(r => !r.isPublic).length,
        logs: logsCache.length
      },
      storage: {
        totalBytes: totalStorageBytes,
        formatted: `${(totalStorageBytes / 1024).toFixed(2)} KB`
      }
    };
  }
};

module.exports = db;
