/**
 * Chemiation - Authentication & Security Engine
 * Cryptographic security using Node.js native crypto module (Zero external dependencies).
 * PBKDF2 (100,000 rounds, SHA-512) async password hashing with cryptographic salt.
 * HMAC-SHA256 signed session tokens with persistence secret and real-time revocation.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.CHEMIATION_DATA_DIR || path.join(__dirname, 'data');
const SECRET_FILE = path.join(DATA_DIR, 'session.secret');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const REVOKED_TOKENS_FILE = path.join(DATA_DIR, 'revoked_tokens.json');
const MAX_REVOKED_TOKENS = 5000;

// Token revocation blacklist (token -> expiration timestamp in seconds)
const revokedTokens = new Map();

function loadRevokedTokens() {
  try {
    if (fs.existsSync(REVOKED_TOKENS_FILE)) {
      const raw = fs.readFileSync(REVOKED_TOKENS_FILE, 'utf8');
      const data = JSON.parse(raw);
      const now = Math.floor(Date.now() / 1000);
      for (const [token, exp] of Object.entries(data)) {
        if (typeof exp === 'number' && exp > now) {
          revokedTokens.set(token, exp);
        }
      }
    }
  } catch (err) {
    console.warn('[Auth] Could not load revoked_tokens.json:', err.message);
  }
}

function saveRevokedTokens() {
  try {
    const obj = {};
    const now = Math.floor(Date.now() / 1000);
    for (const [token, exp] of revokedTokens.entries()) {
      if (exp > now) {
        obj[token] = exp;
      }
    }
    const tmp = `${REVOKED_TOKENS_FILE}.tmp_${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, REVOKED_TOKENS_FILE);
  } catch (err) {
    // Non-fatal if filesystem cannot be written
  }
}

// Initial load
loadRevokedTokens();

// Periodically clean up expired entries in the revocation blacklist and persist
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  let changed = false;
  for (const [token, exp] of revokedTokens.entries()) {
    if (exp <= now) {
      revokedTokens.delete(token);
      changed = true;
    }
  }
  if (changed) {
    saveRevokedTokens();
  }
}, 30 * 60 * 1000).unref();

// Ensure secret persists across restarts without predictable fallbacks
function getOrCreateSecret() {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing && existing.length >= 32) return existing;
    }
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, 'utf8');
    return secret;
  } catch (err) {
    console.error('[Auth] Failed to persist session.secret to disk, generating in-memory ephemeral secret:', err.message);
    // Never fallback to a predictable hardcoded string (Addresses Q8)
    return crypto.randomBytes(48).toString('hex');
  }
}

const JWT_SECRET = getOrCreateSecret();
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

const auth = {
  /**
   * Generate 16-byte cryptographic hex salt
   */
  generateSalt() {
    return crypto.randomBytes(16).toString('hex');
  },

  /**
   * Compute PBKDF2 SHA-512 hash with 100,000 iterations asynchronously (Addresses S3)
   * Prevents event loop blocking under concurrent authentication requests.
   */
  hashPasswordAsync(password, salt) {
    return new Promise((resolve, reject) => {
      if (!password || !salt) return reject(new Error('Password and salt are required'));
      crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  },

  /**
   * Synchronous fallback for boot initialization / seeding
   */
  hashPassword(password, salt) {
    if (!password || !salt) throw new Error('Password and salt are required');
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  },

  /**
   * Verify candidate password asynchronously in constant time
   */
  async verifyPassword(candidatePassword, salt, expectedHash) {
    if (!candidatePassword || !salt || !expectedHash) return false;
    try {
      const candidateHash = await this.hashPasswordAsync(candidatePassword, salt);
      const a = Buffer.from(candidateHash, 'hex');
      const b = Buffer.from(expectedHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  /**
   * Sign a standard JWT (HMAC-SHA256)
   */
  createToken(user) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role || 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  },

  /**
   * Verify token integrity and expiration, returning decoded payload or null
   */
  verifyToken(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') return null;
    if (this.isTokenRevoked(tokenStr)) return null;

    const parts = tokenStr.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expectedSig);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
      }
      const payload = JSON.parse(base64UrlDecode(encodedPayload));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null; // Expired
      }
      return payload;
    } catch {
      return null;
    }
  },

  /**
   * Revoke token upon user logout (Addresses S4, N8)
   */
  revokeToken(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') return;

    // Prune if map exceeds max capacity
    if (revokedTokens.size >= MAX_REVOKED_TOKENS) {
      const now = Math.floor(Date.now() / 1000);
      for (const [t, exp] of revokedTokens.entries()) {
        if (exp <= now) revokedTokens.delete(t);
      }
      if (revokedTokens.size >= MAX_REVOKED_TOKENS) {
        let count = 0;
        for (const t of revokedTokens.keys()) {
          revokedTokens.delete(t);
          if (++count >= 100) break;
        }
      }
    }

    try {
      const parts = tokenStr.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        const exp = payload.exp || (Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
        revokedTokens.set(tokenStr, exp);
      } else {
        revokedTokens.set(tokenStr, Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
      }
    } catch {
      revokedTokens.set(tokenStr, Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
    }
    saveRevokedTokens();
  },

  /**
   * Check if token has been revoked
   */
  isTokenRevoked(tokenStr) {
    if (!tokenStr) return false;
    return revokedTokens.has(tokenStr);
  },

  /**
   * Extract authenticated user from incoming HTTP request
   */
  authenticateRequest(req, db) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7).trim();
    const payload = this.verifyToken(token);
    if (!payload || !payload.sub) {
      return null;
    }
    const user = db.findUserById(payload.sub);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname || user.username,
      role: user.role || 'user',
      avatar: user.avatar || '',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      token // retain token reference for logout revocation
    };
  }
};

module.exports = auth;
