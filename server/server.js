/**
 * Chemiation - Chemical Reaction Principle & Mechanism Studio
 * Fullstack HTTP & REST API Server Engine
 * Minimalist, high-performance architecture · Zero external dependencies.
 * Hardened Security: S1 Path Traversal Guard, S3 Async PBKDF2, S4 Rate Limiting & Token Revocation, Q3 ETag & Gzip.
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const db = require('./db');
const auth = require('./auth');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');

// MIME types dictionary for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.ccpl': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// Allowed static file extensions for serving (Addresses S1)
const ALLOWED_STATIC_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.ico', '.txt', '.ccpl', '.md'
]);

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

class PayloadTooLargeError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 413;
  }
}

function getCorsHeaders(req) {
  const origin = req ? req.headers['origin'] : null;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff'
  };
  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else {
    try {
      const u = new URL(origin);
      if (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '[::1]' ||
        u.hostname.endsWith('.local')
      ) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Vary'] = 'Origin';
      }
    } catch {}
  }
  return headers;
}

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
}

function sendJson(res, statusCode, payload, req = null) {
  const effectiveReq = req || res.req;
  const cors = getCorsHeaders(effectiveReq);
  const security = getSecurityHeaders();
  const extraHeaders = {};
  if (statusCode === 413) {
    extraHeaders['Connection'] = 'close';
  }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...cors,
    ...security,
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let exceeded = false;
    req.on('data', chunk => {
      if (exceeded) return;
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        exceeded = true;
        // Drain and discard remaining incoming bytes so client receives 413 without socket reset (Addresses N5)
        req.on('data', () => {});
        try { req.resume(); } catch {}
        const err = new PayloadTooLargeError('Payload Too Large / 请求体过大 (限制 5MB)');
        reject(err);
      }
    });
    req.on('end', () => {
      if (exceeded) return;
      if (!body.trim()) {
        return resolve({});
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new BadRequestError('Invalid JSON payload / 请求体不是有效的 JSON 格式'));
      }
    });
    req.on('error', (err) => {
      if (!exceeded) reject(err);
    });
  });
}

function getClientIp(req) {
  // Only trust X-Forwarded-For when TRUST_PROXY is explicitly enabled (Addresses N3)
  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const parts = String(xff).split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  }
  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    '127.0.0.1'
  );
}

// Bounded in-memory rate limiting map: ip -> { count, resetTime } (Addresses N3 OOM defense)
const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitMap = new Map();

function checkRateLimit(ip, maxRequests = 25, windowMs = 60000) {
  const now = Date.now();

  // Proactive eviction if capacity is nearing upper bound to avoid hashDoS / OOM
  if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, rec] of rateLimitMap.entries()) {
      if (now > rec.resetTime) {
        rateLimitMap.delete(key);
      }
    }
    if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      let evicted = 0;
      for (const key of rateLimitMap.keys()) {
        rateLimitMap.delete(key);
        if (++evicted >= 100) break;
      }
    }
  }

  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(ip, record);
    return true;
  }
  record.count++;
  return record.count <= maxRequests;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of rateLimitMap.entries()) {
    if (now > rec.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Hardened Static File Serving (Addresses S1, S5, Q3)
 * Protects server files, secrets, .git, and test directories from download.
 * Supports ETag (304 Not Modified) and Gzip compression.
 */
function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal attacks
  let safePath = '';
  try {
    const decoded = decodeURIComponent(relativePath);
    if (decoded.includes('\0') || relativePath.includes('\0')) {
      return sendJson(res, 400, { success: false, error: 'Bad Request / 非法请求路径包含空字符' });
    }
    safePath = path.normalize(decoded).replace(/^(\.\.[\/\\])+/, '');
  } catch {
    return sendJson(res, 400, { success: false, error: 'Bad Request / 非法请求路径' });
  }

  if (safePath.includes('\0')) {
    return sendJson(res, 400, { success: false, error: 'Bad Request / 非法请求路径包含空字符' });
  }

  const normalizedLower = safePath.toLowerCase().replace(/\\/g, '/');
  const cleanPath = normalizedLower.replace(/^\/+/, '');

  // Special route for admin console (located inside server/admin.html)
  if (cleanPath === 'admin.html' || cleanPath === 'admin' || cleanPath === 'server/admin.html') {
    return sendStreamFile(req, res, path.join(__dirname, 'admin.html'), '.html');
  }

  // S1 Fix: Strictly protect server internals, secrets, test files, and hidden directories
  if (
    cleanPath.startsWith('server/') ||
    cleanPath === 'server' ||
    cleanPath.startsWith('test/') ||
    cleanPath === 'test' ||
    cleanPath.startsWith('.git') ||
    cleanPath.startsWith('scratch/') ||
    cleanPath.includes('/.') ||
    cleanPath.startsWith('.') ||
    cleanPath.includes('session.secret') ||
    (cleanPath.endsWith('.json') && !cleanPath.startsWith('manifest'))
  ) {
    return sendJson(res, 403, { success: false, error: 'Forbidden / 敏感资源已被安全拦截' });
  }

  const filePath = path.join(ROOT_DIR, safePath);

  // Ensure filePath stays strictly within ROOT_DIR
  const rel = path.relative(ROOT_DIR, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return sendJson(res, 403, { success: false, error: 'Forbidden' });
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_STATIC_EXTENSIONS.has(ext)) {
    return sendJson(res, 403, { success: false, error: 'File type not allowed' });
  }

  sendStreamFile(req, res, filePath, ext);
}

function sendStreamFile(req, res, filePath, ext) {
  try {
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        return sendJson(res, 404, { success: false, error: 'File Not Found' });
      }

      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const etag = `W/"${stats.size}-${Math.floor(stats.mtimeMs)}"`;

      // Q3 Fix: ETag & 304 Not Modified
      if (req.headers['if-none-match'] === etag) {
        const security = getSecurityHeaders();
        res.writeHead(304, {
          'ETag': etag,
          'Cache-Control': 'public, max-age=3600',
          ...security
        });
        return res.end();
      }

      const cors = getCorsHeaders(req);
      const security = getSecurityHeaders();
      const headers = {
        'Content-Type': contentType,
        ...cors,
        ...security,
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600'
      };

      // Q3 Fix: Gzip compression for text-based assets
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const canGzip = /\bgzip\b/.test(acceptEncoding) && /^(text\/|application\/(javascript|json)|image\/svg\+xml)/.test(contentType);

      if (canGzip) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers);
        const gzip = zlib.createGzip({ level: 6 });
        fs.createReadStream(filePath).pipe(gzip).pipe(res);
      } else {
        headers['Content-Length'] = stats.size;
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
      }
    });
  } catch {
    return sendJson(res, 400, { success: false, error: 'Bad Request' });
  }
}

async function handleRequest(req, res) {
  res.req = req;
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(req);
    res.writeHead(204, {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { success: false, error: 'Bad Request / 非法 URL 格式' }, req);
  }

  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;
  const method = req.method.toUpperCase();
  const clientIp = getClientIp(req);

  try {
    // =========================================================================
    // 0. HEALTH CHECK
    // =========================================================================
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'Chemiation Server',
        timestamp: new Date().toISOString()
      });
    }

    // =========================================================================
    // 1. API ROUTES: AUTHENTICATION
    // =========================================================================

    // POST /api/auth/register
    if (method === 'POST' && pathname === '/api/auth/register') {
      if (!checkRateLimit(clientIp, 25, 60000)) {
        return sendJson(res, 429, { success: false, error: 'Too many registration requests. Please wait a minute.' });
      }

      const body = await parseJsonBody(req);
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();
      const nickname = (body.nickname || username).trim();
      const email = (body.email || '').trim();

      if (!username || username.length < 3 || username.length > 32) {
        return sendJson(res, 400, {
          success: false,
          error: 'Username must be between 3 and 32 characters / 用户名需在 3 到 32 个字符之间'
        });
      }
      if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
        return sendJson(res, 400, {
          success: false,
          error: 'Username can only contain alphanumeric characters, underscores, or Chinese / 用户名仅支持字母、数字、下划线及中文'
        });
      }
      if (!password || password.length < 6 || password.length > 64) {
        return sendJson(res, 400, {
          success: false,
          error: 'Password must be between 6 and 64 characters / 密码长度需在 6 到 64 位之间'
        });
      }

      if (db.findUserByUsername(username)) {
        return sendJson(res, 409, {
          success: false,
          error: 'Username already taken / 用户名已被占用，请使用其他名称'
        });
      }

      const salt = auth.generateSalt();
      // S3 Fix: Async PBKDF2
      const passwordHash = await auth.hashPasswordAsync(password, salt);
      const newUser = db.createUser({
        username,
        passwordHash,
        salt,
        nickname,
        email,
        role: 'user'
      });
      const token = auth.createToken(newUser);

      db.addLog('USER_REGISTER', newUser.id, newUser.username, `用户注册成功 (${newUser.nickname})`, clientIp);

      return sendJson(res, 201, {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          nickname: newUser.nickname,
          email: newUser.email,
          role: newUser.role,
          avatar: newUser.avatar,
          createdAt: newUser.createdAt,
          repoCount: 0
        },
        token
      });
    }

    // POST /api/auth/login
    if (method === 'POST' && pathname === '/api/auth/login') {
      if (!checkRateLimit(clientIp, 25, 60000)) {
        return sendJson(res, 429, { success: false, error: 'Too many login attempts. Please wait a minute.' });
      }

      const body = await parseJsonBody(req);
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();

      if (!username || !password) {
        return sendJson(res, 400, {
          success: false,
          error: 'Username and password are required / 请输入用户名和密码'
        });
      }

      const user = db.findUserByUsername(username);
      if (!user) {
        return sendJson(res, 401, {
          success: false,
          error: 'Invalid credentials / 用户名或密码错误'
        });
      }

      // S3 Fix: Async PBKDF2 password verification
      const isValid = await auth.verifyPassword(password, user.salt, user.passwordHash);
      if (!isValid) {
        db.addLog('LOGIN_FAILED', user.id, username, '登录密码校验失败', clientIp);
        return sendJson(res, 401, {
          success: false,
          error: 'Invalid credentials / 用户名或密码错误'
        });
      }

      db.updateLoginStats(user.id);
      db.addLog('USER_LOGIN', user.id, user.username, '用户成功登录系统', clientIp);

      const token = auth.createToken(user);
      const repoCount = db.countUserReactions(user.id);

      return sendJson(res, 200, {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          role: user.role || 'user',
          avatar: user.avatar || 'U',
          bio: user.bio || '',
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          repoCount
        },
        token
      });
    }

    // GET /api/auth/me
    if (method === 'GET' && pathname === '/api/auth/me') {
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 未登录或凭据已失效' });
      }
      const fullUser = db.findUserById(user.id);
      const repoCount = db.countUserReactions(user.id);
      return sendJson(res, 200, {
        success: true,
        user: {
          id: fullUser.id,
          username: fullUser.username,
          nickname: fullUser.nickname || fullUser.username,
          email: fullUser.email || '',
          role: fullUser.role || 'user',
          avatar: fullUser.avatar || 'U',
          bio: fullUser.bio || '',
          createdAt: fullUser.createdAt,
          lastLoginAt: fullUser.lastLoginAt,
          loginCount: fullUser.loginCount,
          repoCount
        }
      });
    }

    // PUT /api/auth/profile
    if (method === 'PUT' && pathname === '/api/auth/profile') {
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const body = await parseJsonBody(req);
      const nickname = typeof body.nickname === 'string' ? body.nickname.trim().substring(0, 32) : undefined;
      const email = typeof body.email === 'string' ? body.email.trim().substring(0, 64) : undefined;
      const avatar = typeof body.avatar === 'string' ? body.avatar.trim().substring(0, 16) : undefined;
      const bio = typeof body.bio === 'string' ? body.bio.trim().substring(0, 256) : undefined;
      const updated = db.updateUser(user.id, {
        nickname,
        email,
        avatar,
        bio
      });
      db.addLog('USER_UPDATE_PROFILE', user.id, user.username, '更新个人资料', clientIp);
      return sendJson(res, 200, { success: true, user: updated });
    }

    // PUT /api/auth/password
    if (method === 'PUT' && pathname === '/api/auth/password') {
      if (!checkRateLimit(clientIp, 15, 60000)) {
        return sendJson(res, 429, { success: false, error: 'Too many password update attempts. Please wait a minute.' });
      }
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const body = await parseJsonBody(req);
      const { oldPassword, newPassword } = body;
      if (!oldPassword || !newPassword || newPassword.length < 6 || newPassword.length > 64) {
        return sendJson(res, 400, { success: false, error: 'New password must be between 6 and 64 characters / 新密码长度需在 6 到 64 位之间' });
      }
      const fullUser = db.findUserById(user.id);
      const isMatch = await auth.verifyPassword(oldPassword, fullUser.salt, fullUser.passwordHash);
      if (!isMatch) {
        return sendJson(res, 403, { success: false, error: 'Current password incorrect / 原密码输入错误' });
      }
      const newSalt = auth.generateSalt();
      const newHash = await auth.hashPasswordAsync(newPassword, newSalt);
      db.updateUser(user.id, { passwordHash: newHash, salt: newSalt });
      db.addLog('USER_CHANGE_PASSWORD', user.id, user.username, '修改登录密码', clientIp);
      return sendJson(res, 200, { success: true, message: 'Password updated successfully' });
    }

    // POST /api/auth/logout (Addresses S4: real JWT revocation)
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const authHeader = req.headers['authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        auth.revokeToken(token);
      }
      const user = auth.authenticateRequest(req, db);
      if (user) {
        db.addLog('USER_LOGOUT', user.id, user.username, '用户登出', clientIp);
      }
      return sendJson(res, 200, { success: true, message: 'Logged out and token revoked successfully' });
    }

    // =========================================================================
    // 2. API ROUTES: REACTION REPOSITORY (云端反应机理仓库)
    // F1 Fix: Named endpoints placed strictly BEFORE parametric /:id routes
    // =========================================================================

    // GET /api/repo/public - Community public reactions (no auth required)
    if (method === 'GET' && pathname === '/api/repo/public') {
      const search = searchParams.get('search') || '';
      const tag = searchParams.get('tag') || '';
      const category = searchParams.get('category') || 'all';

      const items = db.getPublicReactions({ search, tag, category });
      // Enrich with author display info
      const enriched = items.map(item => {
        const author = db.findUserById(item.userId);
        return {
          ...item,
          authorName: author ? (author.nickname || author.username) : 'Chemiation 团队',
          authorAvatar: author ? (author.avatar || 'U') : 'U'
        };
      });
      return sendJson(res, 200, { success: true, items: enriched });
    }

    // GET /api/repo/my - Current user's reactions
    if (method === 'GET' && pathname === '/api/repo/my') {
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
      }
      const search = searchParams.get('search') || '';
      const tag = searchParams.get('tag') || '';
      const category = searchParams.get('category') || 'all';

      const items = db.getReactionsByUserId(user.id, { search, tag, category });
      return sendJson(res, 200, { success: true, items });
    }

    // GET /api/repo/export - Export user reactions as JSON (Addresses F1)
    if (method === 'GET' && pathname === '/api/repo/export') {
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
      }
      const items = db.getReactionsByUserId(user.id);
      const cors = getCorsHeaders(req);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="chemiation_repo_${user.username}_${Date.now()}.json"`,
        ...cors,
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(JSON.stringify({
        success: true,
        count: items.length,
        exportedAt: new Date().toISOString(),
        items
      }, null, 2));
      return;
    }

    // POST /api/repo/import - Import reaction JSON array
    if (method === 'POST' && pathname === '/api/repo/import') {
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
      }
      const body = await parseJsonBody(req);
      const items = Array.isArray(body) ? body : (body.items || []);
      const imported = db.importReactions(user.id, items);
      db.addLog('REPO_IMPORT', user.id, user.username, `批量导入机理 ${imported.length} 项`, clientIp);
      return sendJson(res, 200, { success: true, count: imported.length, items: imported });
    }

    // POST /api/repo - Save / Create new reaction in cloud repository
    if (method === 'POST' && pathname === '/api/repo') {
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
      }
      const body = await parseJsonBody(req);
      const { title, equation, summary, script, category, tags, isPublic } = body;

      if (!script || typeof script !== 'string' || !script.trim()) {
        return sendJson(res, 400, { success: false, error: 'CCPL mechanism script is required / 推演脚本内容不能为空' });
      }
      if (script.length > 200000) {
        return sendJson(res, 400, { success: false, error: 'Script too large / 脚本内容过长 (限制 200KB)' });
      }

      const item = db.createReaction({
        userId: user.id,
        title: title || '未命名化学反应机理',
        equation: equation || '',
        summary: summary || '',
        script,
        category: category || '自定推演',
        tags: Array.isArray(tags) ? tags : [],
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true
      });

      db.addLog('REPO_CREATE', user.id, user.username, `保存新反应到云端仓库: ${item.title}`, clientIp);

      return sendJson(res, 201, { success: true, item });
    }

    // Parametric /api/repo/:id routes using clean regex matching
    const repoMatch = pathname.match(/^\/api\/repo\/([a-zA-Z0-9_-]+)$/);
    if (repoMatch) {
      const id = repoMatch[1];

      // GET /api/repo/:id - Get single reaction
      if (method === 'GET') {
        const item = db.getReactionById(id);
        if (!item) {
          return sendJson(res, 404, { success: false, error: 'Reaction not found / 未找到该反应机理' });
        }
        if (!item.isPublic) {
          const user = auth.authenticateRequest(req, db);
          if (!user || (user.id !== item.userId && user.role !== 'admin')) {
            return sendJson(res, 403, { success: false, error: 'Access denied / 私有反应无权查看' });
          }
        }
        const author = db.findUserById(item.userId);
        return sendJson(res, 200, {
          success: true,
          item: {
            ...item,
            authorName: author ? (author.nickname || author.username) : 'Chemiation 团队',
            authorAvatar: author ? (author.avatar || 'U') : 'U'
          }
        });
      }

      // PUT /api/repo/:id - Update existing reaction
      if (method === 'PUT') {
        const user = auth.authenticateRequest(req, db);
        if (!user) {
          return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
        }
        const body = await parseJsonBody(req);
        const updated = db.updateReaction(id, user.id, body);
        if (!updated) {
          return sendJson(res, 404, {
            success: false,
            error: 'Reaction not found or permission denied / 反应不存在或无权修改'
          });
        }
        db.addLog('REPO_UPDATE', user.id, user.username, `更新云端反应: ${updated.title}`, clientIp);
        return sendJson(res, 200, { success: true, item: updated });
      }

      // DELETE /api/repo/:id - Delete personal reaction
      if (method === 'DELETE') {
        const user = auth.authenticateRequest(req, db);
        if (!user) {
          return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
        }
        const ok = db.deleteReaction(id, user.id);
        if (!ok) {
          return sendJson(res, 404, {
            success: false,
            error: 'Reaction not found or permission denied / 反应不存在或无权删除'
          });
        }
        db.addLog('REPO_DELETE', user.id, user.username, `从仓库删除反应 (ID: ${id})`, clientIp);
        return sendJson(res, 200, { success: true, message: 'Reaction deleted successfully' });
      }
    }

    // POST /api/repo/:id/star - Star / unstar reaction
    const starMatch = pathname.match(/^\/api\/repo\/([a-zA-Z0-9_-]+)\/star$/);
    if (method === 'POST' && starMatch) {
      const id = starMatch[1];
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
      }
      const starResult = db.starReaction(id, user.id);
      if (!starResult) {
        return sendJson(res, 404, { success: false, error: 'Reaction not found / 未找到该反应机理' });
      }
      db.addLog(starResult.starred ? 'REPO_STAR' : 'REPO_UNSTAR', user.id, user.username, `${starResult.starred ? '标星收藏' : '取消标星'} 机理 (ID: ${id})`, clientIp);
      return sendJson(res, 200, { success: true, starred: starResult.starred, stars: starResult.stars });
    }

    // POST /api/repo/:id/fork - Fork reaction into user's own repository
    const forkMatch = pathname.match(/^\/api\/repo\/([a-zA-Z0-9_-]+)\/fork$/);
    if (method === 'POST' && forkMatch) {
      const id = forkMatch[1];
      const user = auth.authenticateRequest(req, db);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录' });
      }
      const forked = db.forkReaction(id, user.id);
      if (!forked) {
        return sendJson(res, 404, { success: false, error: 'Original reaction not found or inaccessible / 原机理不存在或无权访问' });
      }
      db.addLog('REPO_FORK', user.id, user.username, `Fork 机理副本: ${forked.title}`, clientIp);
      return sendJson(res, 201, { success: true, item: forked });
    }

    // =========================================================================
    // 3. API ROUTES: SERVER HOST & ADMIN (服务器端查看用户的各种信息)
    // Hardened RBAC: Strictly require authenticated administrator on all admin endpoints
    // =========================================================================

    function requireAdmin(req, res) {
      const authUser = auth.authenticateRequest(req, db);
      if (!authUser) {
        sendJson(res, 401, { success: false, error: 'Unauthorized / 请先登录管理员账号' });
        return null;
      }
      if (authUser.role !== 'admin') {
        sendJson(res, 403, { success: false, error: 'Forbidden / 需要系统管理员权限' });
        return null;
      }
      return authUser;
    }

    // GET /api/admin/overview or /api/admin/metrics - Host system metrics & stats
    if (method === 'GET' && (pathname === '/api/admin/overview' || pathname === '/api/admin/metrics')) {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const stats = db.getSystemStats();
      const recentLogs = db.getLogs(15);
      return sendJson(res, 200, {
        success: true,
        stats,
        recentLogs,
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptime: process.uptime()
        },
        counts: stats.counts,
        storage: stats.storage,
        memory: stats.memory
      });
    }

    // GET /api/admin/users - Inspect all users & their statistics
    if (method === 'GET' && pathname === '/api/admin/users') {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const users = db.getAllUsers();
      return sendJson(res, 200, { success: true, users, total: users.length });
    }

    // GET /api/admin/users/:id - Inspect detailed user info and their reactions
    if (method === 'GET' && pathname.startsWith('/api/admin/users/')) {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const userId = pathname.substring('/api/admin/users/'.length);
      const user = db.findUserById(userId);
      if (!user) {
        return sendJson(res, 404, { success: false, error: 'User not found / 用户不存在' });
      }
      const userReactions = db.getReactionsByUserId(userId);
      const userLogs = db.getLogs(50).filter(l => l.userId === userId);

      return sendJson(res, 200, {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname || user.username,
          email: user.email || '',
          role: user.role || 'user',
          avatar: user.avatar || 'U',
          bio: user.bio || '',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
          loginCount: user.loginCount || 1,
          repoCount: userReactions.length
        },
        reactions: userReactions,
        logs: userLogs
      });
    }

    // PUT /api/admin/users/:id/role - Toggle or set user role
    if (method === 'PUT' && pathname.match(/^\/api\/admin\/users\/[^/]+\/role$/)) {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const userId = pathname.split('/')[4];
      if (userId === 'u_admin_root') {
        return sendJson(res, 400, { success: false, error: 'Cannot modify primary root administrator role / 无法修改系统超级管理员角色' });
      }
      const body = await parseJsonBody(req);
      const updated = db.updateUser(userId, { role: body.role === 'admin' ? 'admin' : 'user' });
      if (!updated) {
        return sendJson(res, 404, { success: false, error: 'User not found' });
      }
      db.addLog('ADMIN_CHANGE_ROLE', authUser.id, authUser.username, `修改用户 ${updated.username} 权限为 ${updated.role}`, clientIp);
      return sendJson(res, 200, { success: true, user: updated });
    }

    // DELETE /api/admin/users/:id - Delete user from server
    if (method === 'DELETE' && pathname.startsWith('/api/admin/users/')) {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const userId = pathname.substring('/api/admin/users/'.length);
      if (userId === 'u_admin_root' || userId === authUser.id) {
        return sendJson(res, 400, { success: false, error: 'Cannot delete primary root administrator account' });
      }
      const ok = db.deleteUser(userId);
      if (!ok) {
        return sendJson(res, 404, { success: false, error: 'User not found' });
      }
      db.addLog('ADMIN_DELETE_USER', authUser.id, authUser.username, `管理员删除用户 (ID: ${userId})`, clientIp);
      return sendJson(res, 200, { success: true, message: 'User deleted' });
    }

    // GET /api/admin/reactions - View all reactions on the server
    if (method === 'GET' && pathname === '/api/admin/reactions') {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const reactions = db.getAllReactions();
      const enriched = reactions.map(r => {
        const author = db.findUserById(r.userId);
        return {
          ...r,
          authorName: author ? (author.nickname || author.username) : 'Unknown',
          authorRole: author ? author.role : 'user'
        };
      });
      return sendJson(res, 200, { success: true, reactions: enriched });
    }

    // DELETE /api/admin/reactions/:id - Delete any reaction (admin moderation)
    if (method === 'DELETE' && pathname.startsWith('/api/admin/reactions/')) {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const reactionId = pathname.substring('/api/admin/reactions/'.length);
      const ok = db.deleteReaction(reactionId, authUser.id);
      if (!ok) {
        return sendJson(res, 404, { success: false, error: 'Reaction not found' });
      }
      db.addLog('ADMIN_DELETE_REACTION', authUser.id, authUser.username, `管理员删除机理 (ID: ${reactionId})`, clientIp);
      return sendJson(res, 200, { success: true, message: 'Reaction deleted' });
    }

    // GET /api/admin/logs - Query audit activity logs
    if (method === 'GET' && pathname === '/api/admin/logs') {
      const authUser = requireAdmin(req, res);
      if (!authUser) return;
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500);
      const filterAction = (searchParams.get('action') || '').substring(0, 50);
      const logs = db.getLogs(limit, filterAction);
      return sendJson(res, 200, { success: true, logs, total: logs.length });
    }

    // =========================================================================
    // 4. STATIC FILE SERVING
    // =========================================================================
    if (method === 'GET') {
      serveStaticFile(req, res, pathname);
      return;
    }

    // Fallback for unknown methods/paths
    sendJson(res, 404, { success: false, error: 'Endpoint Not Found' });
  } catch (err) {
    if (err.statusCode) {
      return sendJson(res, err.statusCode, { success: false, error: err.message }, req);
    }
    console.error(`[Server Error] ${method} ${pathname}:`, err);
    sendJson(res, 500, { success: false, error: 'Internal Server Error' }, req);
  }
}

const server = http.createServer(handleRequest);
server.handleRequest = handleRequest;

if (require.main === module) {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[错误] 端口 ${PORT} 已被占用！无法启动服务端。`);
      console.error(`请检查是否有其他 Chemiation 或 Node.js 进程正在运行，或关闭占用 ${PORT} 端口的程序。\n`);
    } else {
      console.error('\n[Server Fatal Error]', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log('================================================================');
    console.log(' Chemiation · Chemical Reaction Principle & Mechanism Studio');
    console.log(` Server Engine running at: http://localhost:${PORT}`);
    console.log(` Admin Dashboard available at: http://localhost:${PORT}/admin.html`);
    console.log(` Static Root: ${ROOT_DIR}`);
    console.log(' Pure Minimalist Architecture · Zero External Dependencies');
    console.log('================================================================');

    if (process.argv.includes('--open') || process.env.AUTO_OPEN === '1') {
      const openCmd = process.platform === 'win32' ? 'start ""' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
      const { exec } = require('child_process');
      exec(`${openCmd} "http://localhost:${PORT}"`);
    }
  });
}

module.exports = server;
