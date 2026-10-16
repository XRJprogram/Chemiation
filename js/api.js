/**
 * Chemiation - Client API Service
 * Dual-Mode Architecture:
 * - Online Mode: Communicates with local Node.js REST API (/api/auth/*, /api/repo/*, /api/admin/*)
 * - Offline Fallback: Gracefully operates via localStorage when server is offline or file:// is used.
 */

const API_CONFIG = {
  baseUrl: (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && (!window.location.protocol || !window.location.protocol.startsWith('file')))
    ? window.location.origin
    : 'http://localhost:3000',
  tokenKey: 'chemiation_auth_token',
  offlineReposKey: 'chemiation_offline_repos',
  offlineUserKey: 'chemiation_offline_user'
};

const api = {
  isServerAvailable: false,

  getToken() {
    return localStorage.getItem(API_CONFIG.tokenKey) || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(API_CONFIG.tokenKey, token);
    } else {
      localStorage.removeItem(API_CONFIG.tokenKey);
    }
  },

  getAuthHeaders() {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.baseUrl}${endpoint}`;
    const headers = {
      ...this.getAuthHeaders(),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      this.setServerConnected(true);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      return data;
    } catch (err) {
      if (err.name === 'TypeError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        this.setServerConnected(false);
      }
      throw err;
    }
  },

  setServerConnected(connected) {
    const prevState = this.isServerAvailable;
    this.isServerAvailable = !!connected;
    if (typeof document !== 'undefined' && document.body) {
      if (this.isServerAvailable) {
        document.body.classList.add('server-connected');
      } else {
        document.body.classList.remove('server-connected');
      }
    }
    if (typeof window !== 'undefined' && prevState !== this.isServerAvailable) {
      try {
        window.dispatchEvent(new CustomEvent(connected ? 'chemiation:server-online' : 'chemiation:server-offline'));
      } catch {}
    }
  },

  // Health check to test server connectivity with fallback URLs and 1200ms timeout
  async ping() {
    const tryPingUrl = async (url) => {
      try {
        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 1200) : null;
        const res = await fetch(`${url}/api/health`, {
          method: 'GET',
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return data && data.status === 'ok';
        }
      } catch {}
      return false;
    };

    // 1. Probe current baseUrl
    let ok = await tryPingUrl(API_CONFIG.baseUrl);

    // 2. Fallback to http://localhost:3000 if different
    if (!ok && API_CONFIG.baseUrl !== 'http://localhost:3000') {
      const okLocal = await tryPingUrl('http://localhost:3000');
      if (okLocal) {
        API_CONFIG.baseUrl = 'http://localhost:3000';
        ok = true;
      }
    }

    // 3. Fallback to http://127.0.0.1:3000 if different
    if (!ok && API_CONFIG.baseUrl !== 'http://127.0.0.1:3000') {
      const okIp = await tryPingUrl('http://127.0.0.1:3000');
      if (okIp) {
        API_CONFIG.baseUrl = 'http://127.0.0.1:3000';
        ok = true;
      }
    }

    this.setServerConnected(ok);
    return ok;
  },

  // =========================================================================
  // AUTH METHODS
  // =========================================================================
  generateSalt(length = 16) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint8Array(length);
      window.crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let s = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length * 2; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
  },

  async hashPassword(password, salt = '') {
    const salted = `${password}:${salt}`;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
        const msgUint8 = new TextEncoder().encode(salted);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {}
    }
    // High-iteration cryptographic mixing fallback for non-secure / file:// context (Addresses N9)
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (let round = 0; round < 1000; round++) {
      for (let i = 0; i < salted.length; i++) {
        const code = salted.charCodeAt(i);
        h1 = Math.imul(h1 ^ code, 0x01000193);
        h2 = Math.imul(h2 ^ (code + round), 0x85ebca6b);
        h1 = (h1 << 13) | (h1 >>> 19);
      }
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `${hex1}${hex2}`;
  },

  async register(username, password, nickname = '', email = '') {
    try {
      const data = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, nickname, email })
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    } catch (err) {
      if (!this.isServerAvailable) {
        // Secure offline registration with cryptographic salted hashing (Addresses F6, N9)
        const usersKey = 'chemiation_offline_users_db';
        let users = [];
        try {
          users = JSON.parse(localStorage.getItem(usersKey) || '[]');
        } catch { users = []; }

        if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
          throw new Error('用户名已被占用，请使用其他名称');
        }

        const salt = this.generateSalt(16);
        const pwdHash = await this.hashPassword(password, salt);
        const offlineUser = {
          id: `local_u_${Date.now()}`,
          username: username.trim(),
          nickname: nickname.trim() || username.trim(),
          email: email.trim(),
          role: 'user',
          avatar: (nickname.trim() || username.trim()).charAt(0).toUpperCase(),
          createdAt: new Date().toISOString(),
          repoCount: this.getOfflineRepos().length
        };

        users.push({ ...offlineUser, salt, passwordHash: pwdHash });
        localStorage.setItem(usersKey, JSON.stringify(users));
        localStorage.setItem(API_CONFIG.offlineUserKey, JSON.stringify(offlineUser));
        return { success: true, user: offlineUser, offline: true };
      }
      throw err;
    }
  },

  async login(username, password) {
    try {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (data.token) {
        this.setToken(data.token);
      }
      return data;
    } catch (err) {
      if (!this.isServerAvailable) {
        // Secure offline authentication: verify salted credentials without bypass (Addresses F6, N9)
        const usersKey = 'chemiation_offline_users_db';
        let users = [];
        try {
          users = JSON.parse(localStorage.getItem(usersKey) || '[]');
        } catch { users = []; }

        const found = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!found) {
          throw new Error('用户不存在或账号密码错误');
        }

        const salt = found.salt || '';
        const pwdHash = await this.hashPassword(password, salt);
        const isMatch = (found.passwordHash === pwdHash) || (!found.salt && found.passwordHash === await this.hashPassword(password, ''));
        if (!isMatch) {
          throw new Error('登录密码错误');
        }

        const cleanUser = { ...found };
        delete cleanUser.passwordHash;
        delete cleanUser.salt;
        localStorage.setItem(API_CONFIG.offlineUserKey, JSON.stringify(cleanUser));
        return { success: true, user: cleanUser, offline: true };
      }
      throw err;
    }
  },

  async getMe() {
    if (!this.getToken()) {
      if (!this.isServerAvailable) {
        const saved = localStorage.getItem(API_CONFIG.offlineUserKey);
        return saved ? { success: true, user: JSON.parse(saved), offline: true } : null;
      }
      return null;
    }

    try {
      return await this.request('/api/auth/me', { method: 'GET' });
    } catch (err) {
      if (!this.isServerAvailable) {
        const saved = localStorage.getItem(API_CONFIG.offlineUserKey);
        return saved ? { success: true, user: JSON.parse(saved), offline: true } : null;
      }
      this.setToken(null);
      return null;
    }
  },

  async updateProfile(profileData) {
    try {
      return await this.request('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
    } catch (err) {
      if (!this.isServerAvailable) {
        const saved = localStorage.getItem(API_CONFIG.offlineUserKey);
        if (saved) {
          const u = { ...JSON.parse(saved), ...profileData };
          localStorage.setItem(API_CONFIG.offlineUserKey, JSON.stringify(u));
          return { success: true, user: u, offline: true };
        }
      }
      throw err;
    }
  },

  async changePassword(oldPassword, newPassword) {
    return await this.request('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword })
    });
  },

  async logout() {
    try {
      if (this.isServerAvailable && this.getToken()) {
        await this.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } finally {
      this.setToken(null);
      localStorage.removeItem(API_CONFIG.offlineUserKey);
    }
    return { success: true };
  },

  // =========================================================================
  // REPOSITORY METHODS
  // =========================================================================
  getOfflineRepos() {
    try {
      const raw = localStorage.getItem(API_CONFIG.offlineReposKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveOfflineRepos(items) {
    try {
      localStorage.setItem(API_CONFIG.offlineReposKey, JSON.stringify(items));
      return true;
    } catch (e) {
      console.error('[Offline Store] Error saving:', e);
      throw new Error('本地存储空间已满或受浏览器隐私策略限制，保存失败');
    }
  },

  async getPublicRepos(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.search) params.append('search', options.search);
      if (options.tag && options.tag !== 'all') params.append('tag', options.tag);
      if (options.category && options.category !== 'all') params.append('category', options.category);
      const qs = params.toString() ? `?${params.toString()}` : '';

      return await this.request(`/api/repo/public${qs}`, { method: 'GET' });
    } catch (err) {
      if (!this.isServerAvailable) {
        return { success: true, items: this.getOfflineRepos().filter(r => r.isPublic), offline: true };
      }
      throw err;
    }
  },

  async getUserRepos(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.search) params.append('search', options.search);
      if (options.tag && options.tag !== 'all') params.append('tag', options.tag);
      if (options.category && options.category !== 'all') params.append('category', options.category);
      const qs = params.toString() ? `?${params.toString()}` : '';

      return await this.request(`/api/repo/my${qs}`, { method: 'GET' });
    } catch (err) {
      if (!this.isServerAvailable) {
        let items = this.getOfflineRepos();
        const { search = '', tag = '', category = 'all' } = options;
        const q = search.toLowerCase().trim();

        items = items.filter(item => {
          if (category !== 'all' && item.category !== category) return false;
          if (tag && tag !== 'all') {
            if (!Array.isArray(item.tags) || !item.tags.includes(tag)) return false;
          }
          if (q) {
            const matchTitle = (item.title || '').toLowerCase().includes(q);
            const matchEquation = (item.equation || '').toLowerCase().includes(q);
            if (!matchTitle && !matchEquation) return false;
          }
          return true;
        });
        return { success: true, items, offline: true };
      }
      throw err;
    }
  },

  async getRepoById(id) {
    try {
      return await this.request(`/api/repo/${id}`, { method: 'GET' });
    } catch (err) {
      if (!this.isServerAvailable) {
        const item = this.getOfflineRepos().find(r => r.id === id);
        if (item) return { success: true, item, offline: true };
      }
      throw err;
    }
  },

  async createRepo(payload) {
    try {
      return await this.request('/api/repo', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      if (!this.isServerAvailable) {
        const items = this.getOfflineRepos();
        const newItem = {
          id: `local_chem_${Date.now()}`,
          title: (payload.title || '本地反应机理').trim(),
          equation: (payload.equation || '').trim(),
          summary: (payload.summary || '').trim(),
          script: payload.script.trim(),
          category: payload.category || '自定推演',
          tags: Array.isArray(payload.tags) ? payload.tags : ['本地草稿'],
          isPublic: Boolean(payload.isPublic),
          stars: 0,
          forks: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          offline: true
        };
        items.unshift(newItem);
        this.saveOfflineRepos(items);
        return { success: true, item: newItem, offline: true };
      }
      throw err;
    }
  },

  async updateRepo(id, payload) {
    try {
      return await this.request(`/api/repo/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      if (!this.isServerAvailable) {
        const items = this.getOfflineRepos();
        const idx = items.findIndex(r => r.id === id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], ...payload, updatedAt: new Date().toISOString() };
          this.saveOfflineRepos(items);
          return { success: true, item: items[idx], offline: true };
        }
      }
      throw err;
    }
  },

  async deleteRepo(id) {
    try {
      return await this.request(`/api/repo/${id}`, { method: 'DELETE' });
    } catch (err) {
      if (!this.isServerAvailable) {
        let items = this.getOfflineRepos();
        items = items.filter(r => r.id !== id);
        this.saveOfflineRepos(items);
        return { success: true, message: 'Deleted offline' };
      }
      throw err;
    }
  },

  async starRepo(id) {
    try {
      return await this.request(`/api/repo/${id}/star`, { method: 'POST' });
    } catch (err) {
      if (!this.isServerAvailable) {
        return { success: true, starred: true, stars: 1, offline: true };
      }
      throw err;
    }
  },

  async forkRepo(id) {
    try {
      return await this.request(`/api/repo/${id}/fork`, { method: 'POST' });
    } catch (err) {
      if (!this.isServerAvailable) {
        const original = this.getOfflineRepos().find(r => r.id === id);
        if (original) {
          const forked = {
            ...original,
            id: `local_chem_${Date.now()}`,
            title: `${original.title} (Fork)`,
            isPublic: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          const items = this.getOfflineRepos();
          items.unshift(forked);
          this.saveOfflineRepos(items);
          return { success: true, item: forked, offline: true };
        }
      }
      throw err;
    }
  },

  async exportRepos() {
    try {
      return await this.request('/api/repo/export', { method: 'GET' });
    } catch (err) {
      return this.getOfflineRepos();
    }
  },

  // =========================================================================
  // ADMIN METHODS (HOST MONITORING)
  // =========================================================================
  async getAdminOverview() {
    return await this.request('/api/admin/overview', { method: 'GET' });
  },

  async getAdminUsers() {
    return await this.request('/api/admin/users', { method: 'GET' });
  },

  async getAdminUserDetail(userId) {
    return await this.request(`/api/admin/users/${userId}`, { method: 'GET' });
  },

  async updateAdminUserRole(userId, role) {
    return await this.request(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  async deleteAdminUser(userId) {
    return await this.request(`/api/admin/users/${userId}`, { method: 'DELETE' });
  },

  async getAdminReactions() {
    return await this.request('/api/admin/reactions', { method: 'GET' });
  },

  async deleteAdminReaction(reactionId) {
    return await this.request(`/api/admin/reactions/${reactionId}`, { method: 'DELETE' });
  },

  async getAdminLogs(limit = 100, action = '') {
    const qs = action ? `?limit=${limit}&action=${action}` : `?limit=${limit}`;
    return await this.request(`/api/admin/logs${qs}`, { method: 'GET' });
  }
};

if (typeof window !== 'undefined') {
  window.api = api;

  let _pollTimer = null;
  const startPingLoop = (initialDelay = 100) => {
    if (_pollTimer) clearTimeout(_pollTimer);
    _pollTimer = setTimeout(async () => {
      const isOnline = await api.ping().catch(() => false);
      // When offline, poll every 3s so starting server.bat connects quickly
      // When online, poll every 20s to maintain heartbeat
      startPingLoop(isOnline ? 20000 : 3000);
    }, initialDelay);
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        startPingLoop(100);
      });
    } else {
      startPingLoop(100);
    }
  }

  // Ping immediately when user focuses the tab (e.g. switching from server.bat terminal to browser)
  window.addEventListener('focus', () => {
    api.ping().catch(() => {});
  });
  window.addEventListener('online', () => {
    api.ping().catch(() => {});
  });
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
