/**
 * Chemiation - Upstash Redis Serverless Cloud Adapter
 * Direct REST API client over HTTPS. Zero external dependencies.
 * Enables persistent global cloud storage across desktop installations and web clients.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function autoLoadEnv() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env')
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            let val = trimmed.substring(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        });
      } catch {}
    }
  }
}

class UpstashAdapter {
  constructor() {
    autoLoadEnv();
    this.url = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
    let p = (process.env.UPSTASH_REDIS_PREFIX || 'chemiation:').trim();
    if (!p.endsWith(':') && !p.endsWith('_') && !p.endsWith('.')) {
      p += ':';
    }
    this.prefix = p;
  }

  isConfigured() {
    return Boolean(this.url && this.token && this.url.startsWith('http'));
  }

  // Key namespace generators to guarantee complete isolation from other projects
  keyUsers() { return `${this.prefix}users`; }
  keyReactions() { return `${this.prefix}reactions`; }
  keyLogs() { return `${this.prefix}logs`; }
  keyRevoked() { return `${this.prefix}revoked_tokens`; }

  /**
   * Execute a single Redis command via Upstash REST API
   * @param {Array<string|number>} command E.g. ['GET', 'key'] or ['HSET', 'hash', 'field', 'value']
   */
  async execute(command) {
    if (!this.isConfigured()) {
      throw new Error('Upstash Redis credentials are not configured');
    }

    const payload = JSON.stringify(command);
    const parsedUrl = new URL(this.url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(
        parsedUrl,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 8000
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) {
                return reject(new Error(`Upstash Error: ${json.error}`));
              }
              resolve(json.result);
            } catch (err) {
              reject(new Error(`Upstash Invalid JSON Response: ${data.substring(0, 100)}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Upstash Request Timeout (8s)'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Execute multiple commands in a single HTTP round-trip
   * @param {Array<Array<string|number>>} commands
   */
  async pipeline(commands) {
    if (!this.isConfigured()) {
      throw new Error('Upstash Redis credentials are not configured');
    }

    const payload = JSON.stringify(commands);
    const pipelineUrl = new URL(`${this.url}/pipeline`);
    const isHttps = pipelineUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(
        pipelineUrl,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 10000
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (!Array.isArray(json)) {
                return reject(new Error('Upstash pipeline returned non-array response'));
              }
              resolve(json.map(item => item.result));
            } catch (err) {
              reject(new Error(`Upstash Pipeline Parse Error: ${data.substring(0, 100)}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Upstash Pipeline Request Timeout (10s)'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Test connectivity to Upstash instance
   */
  async testConnection() {
    try {
      const res = await this.execute(['PING']);
      return { success: res === 'PONG', response: res };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Load entire database snapshot from Upstash
   */
  async loadAllData() {
    if (!this.isConfigured()) return null;

    try {
      const [rawUsers, rawReactions, rawLogs, rawRevoked] = await this.pipeline([
        ['HGETALL', this.keyUsers()],
        ['HGETALL', this.keyReactions()],
        ['LRANGE', this.keyLogs(), 0, 499],
        ['SMEMBERS', this.keyRevoked()]
      ]);

      const users = [];
      if (rawUsers && typeof rawUsers === 'object') {
        const entries = Array.isArray(rawUsers)
          ? this._pairsToEntries(rawUsers)
          : Object.entries(rawUsers);
        for (const [, val] of entries) {
          try { users.push(JSON.parse(val)); } catch {}
        }
      }

      const reactions = [];
      if (rawReactions && typeof rawReactions === 'object') {
        const entries = Array.isArray(rawReactions)
          ? this._pairsToEntries(rawReactions)
          : Object.entries(rawReactions);
        for (const [, val] of entries) {
          try { reactions.push(JSON.parse(val)); } catch {}
        }
      }

      const logs = [];
      if (Array.isArray(rawLogs)) {
        for (const item of rawLogs) {
          try { logs.push(typeof item === 'string' ? JSON.parse(item) : item); } catch {}
        }
      }

      const revokedTokens = Array.isArray(rawRevoked) ? rawRevoked : [];

      return { users, reactions, logs, revokedTokens };
    } catch (err) {
      console.error('[Upstash] Failed to load data snapshot:', err.message);
      return null;
    }
  }

  /**
   * Helper to parse Redis array-form hash responses [k1, v1, k2, v2, ...]
   */
  _pairsToEntries(arr) {
    const entries = [];
    for (let i = 0; i < arr.length; i += 2) {
      entries.push([arr[i], arr[i + 1]]);
    }
    return entries;
  }

  /**
   * Sync a user record to Upstash
   */
  async saveUser(user) {
    if (!this.isConfigured() || !user || !user.id) return;
    try {
      await this.execute(['HSET', this.keyUsers(), user.id, JSON.stringify(user)]);
    } catch (err) {
      console.error(`[Upstash] Error saving user ${user.id}:`, err.message);
    }
  }

  /**
   * Delete a user from Upstash
   */
  async deleteUser(userId) {
    if (!this.isConfigured() || !userId) return;
    try {
      await this.execute(['HDEL', this.keyUsers(), userId]);
    } catch (err) {
      console.error(`[Upstash] Error deleting user ${userId}:`, err.message);
    }
  }

  /**
   * Sync a reaction mechanism record to Upstash
   */
  async saveReaction(reaction) {
    if (!this.isConfigured() || !reaction || !reaction.id) return;
    try {
      await this.execute(['HSET', this.keyReactions(), reaction.id, JSON.stringify(reaction)]);
    } catch (err) {
      console.error(`[Upstash] Error saving reaction ${reaction.id}:`, err.message);
    }
  }

  /**
   * Delete a reaction mechanism from Upstash
   */
  async deleteReaction(reactionId) {
    if (!this.isConfigured() || !reactionId) return;
    try {
      await this.execute(['HDEL', this.keyReactions(), reactionId]);
    } catch (err) {
      console.error(`[Upstash] Error deleting reaction ${reactionId}:`, err.message);
    }
  }

  /**
   * Push an audit log entry to Upstash and trim to 500 items to conserve quota
   */
  async addLog(logItem) {
    if (!this.isConfigured() || !logItem) return;
    try {
      await this.pipeline([
        ['LPUSH', this.keyLogs(), JSON.stringify(logItem)],
        ['LTRIM', this.keyLogs(), 0, 499]
      ]);
    } catch (err) {
      console.error('[Upstash] Error adding log entry:', err.message);
    }
  }

  /**
   * Blacklist a revoked JWT token
   */
  async revokeToken(token) {
    if (!this.isConfigured() || !token) return;
    try {
      await this.execute(['SADD', this.keyRevoked(), token]);
    } catch (err) {
      console.error('[Upstash] Error revoking token:', err.message);
    }
  }

  /**
   * Initial seeding to Upstash if database namespace is empty
   */
  async seedInitialData(users, reactions) {
    if (!this.isConfigured()) return;
    try {
      const commands = [];
      if (Array.isArray(users)) {
        for (const u of users) {
          commands.push(['HSET', this.keyUsers(), u.id, JSON.stringify(u)]);
        }
      }
      if (Array.isArray(reactions)) {
        for (const r of reactions) {
          commands.push(['HSET', this.keyReactions(), r.id, JSON.stringify(r)]);
        }
      }
      if (commands.length > 0) {
        await this.pipeline(commands);
        console.log(`[Upstash] Successfully seeded ${users.length} users and ${reactions.length} mechanisms to Upstash Redis with prefix "${this.prefix}".`);
      }
    } catch (err) {
      console.error('[Upstash] Seeding failed:', err.message);
    }
  }
}

module.exports = new UpstashAdapter();
