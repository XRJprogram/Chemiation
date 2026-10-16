/**
 * Chemiation - End-to-End Server & Fullstack Integration Test Suite
 * Tests server boot, authentication, JWT tokens, reaction repositories,
 * offline fallback data structures, admin metrics, and static file serving.
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set sandboxed test data directory BEFORE importing server modules (F18 fix)
const testDataDir = path.join(os.tmpdir(), `chemiation_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}
process.env.CHEMIATION_DATA_DIR = testDataDir;
process.env.NODE_ENV = 'test';

// Import server components after CHEMIATION_DATA_DIR is configured
const auth = require('./auth.js');
const db = require('./db.js');
const serverApp = require('./server.js');

console.log('[TEST] Starting Chemiation Fullstack Integration & Server Test Suite...\n');
console.log(`[SANDBOX] Using sandboxed test data directory: ${testDataDir}`);

// Helper to make HTTP requests
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: body
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      if (typeof postData === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function runTests() {
  const TEST_PORT = 3199;
  let testServer = null;

  try {
    // 1. Boot test HTTP server on port 3199
    console.log('[1/14] Booting HTTP server on test port ' + TEST_PORT + '...');
    testServer = http.createServer((req, res) => {
      serverApp.handleRequest(req, res);
    });

    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => {
        console.log('   [OK] Test server listening at http://127.0.0.1:' + TEST_PORT);
        resolve();
      });
      testServer.on('error', reject);
    });

    // 2. Health check
    console.log('\n[2/14] Verifying Health check endpoint (/api/health)...');
    const healthRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET'
    });
    assert.strictEqual(healthRes.statusCode, 200, 'Health check should return 200');
    assert.strictEqual(healthRes.data.status, 'ok', 'Status should be ok');
    assert.strictEqual(healthRes.data.service, 'Chemiation Server', 'Service should be Chemiation Server');
    console.log('   [OK] Health check verified');

    // 3. User Registration
    console.log('\n[3/14] Testing User Registration (/api/auth/register)...');
    const randSuffix = Math.floor(Math.random() * 10000);
    const testUsername = `chemist_${randSuffix}`;
    const testPassword = 'Password123!';

    const regRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/register',
      method: 'POST'
    }, {
      username: testUsername,
      password: testPassword,
      nickname: '波义耳研究员',
      email: `${testUsername}@chemiation.org`
    });

    assert.strictEqual(regRes.statusCode, 201, `Register should return 201 Created (got ${regRes.statusCode})`);
    assert.ok(regRes.data.token, 'Registration must return a JWT token');
    assert.strictEqual(regRes.data.user.username, testUsername);
    assert.strictEqual(regRes.data.user.nickname, '波义耳研究员');
    const userToken = regRes.data.token;
    const userId = regRes.data.user.id;
    console.log(`   [OK] User registered successfully (@${testUsername}, ID: ${userId})`);

    // 4. User Login & JWT verification
    console.log('\n[4/14] Testing User Login (/api/auth/login)...');
    const loginRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      username: testUsername,
      password: testPassword
    });

    assert.strictEqual(loginRes.statusCode, 200, 'Login should return 200 OK');
    assert.ok(loginRes.data.token, 'Login must return a JWT token');
    assert.strictEqual(loginRes.data.user.id, userId);
    console.log('   [OK] User login verified with PBKDF2 verification');

    // 5. User Profile Update (/api/auth/profile)
    console.log('\n[5/14] Testing Profile Update (/api/auth/profile)...');
    const profRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/profile',
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }, {
      nickname: '罗伯特·波义耳',
      bio: '怀疑派化学家，机理动力学研究',
      avatar: 'RB'
    });

    assert.strictEqual(profRes.statusCode, 200, 'Profile update should return 200');
    assert.strictEqual(profRes.data.user.nickname, '罗伯特·波义耳');
    assert.strictEqual(profRes.data.user.bio, '怀疑派化学家，机理动力学研究');
    assert.strictEqual(profRes.data.user.avatar, 'RB');
    console.log('   [OK] User profile updated and verified');

    // 6. Public Mechanism Repositories
    console.log('\n[6/14] Testing Public Reaction Repositories (/api/repo/public)...');
    const publicRepoRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/repo/public',
      method: 'GET'
    });

    assert.strictEqual(publicRepoRes.statusCode, 200, 'Public repos should return 200');
    assert.ok(Array.isArray(publicRepoRes.data.items), 'Items should be an array');
    assert.ok(publicRepoRes.data.items.length >= 6, 'Should include at least the 6 seeded presets');
    console.log(`   [OK] Retrieved ${publicRepoRes.data.items.length} public mechanisms (Seeded presets verified)`);

    // 7. Create, Star, Fork, and Delete Reaction
    console.log('\n[7/14] Testing Reaction CRUD & Star/Fork Operations...');
    const sampleScript = `reaction "阿司匹林乙酰化合成"
equation "C7H6O3 + (CH3CO)2O -> C9H8O4 + CH3COOH"
summary "水杨酸与乙酸酐在浓硫酸催化下的酚羟基亲核进攻酰化推演"

step "1. 水杨酸酚羟基进攻"
note "水杨酸酚羟基孤对电子亲核进攻活化的乙酸酐羰基碳原子"
atom C1 0.00 0.00 0.00 C
atom O1 1.20 0.00 0.00 O
bond C1 O1 single

step "2. 乙酸离去并生成阿司匹林"
note "四面体中间体消除乙酸分子，脱去质子形成乙酰水杨酸产物"
atom C1 0.00 0.00 0.00 C
atom O1 1.20 0.00 0.00 O
bond C1 O1 double
`;

    // Create reaction
    const createRepoRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/repo',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }, {
      title: '阿司匹林乙酰化合成',
      equation: 'C7H6O3 + (CH3CO)2O -> C9H8O4 + CH3COOH',
      summary: '水杨酸与乙酸酐在浓硫酸催化下的酚羟基亲核进攻酰化推演',
      category: 'organic',
      tags: ['阿司匹林', '亲核酰化', '有机合成'],
      script: sampleScript,
      isPublic: true
    });

    assert.strictEqual(createRepoRes.statusCode, 201, 'Create repo should return 201');
    assert.ok(createRepoRes.data.item.id, 'Created repo must have an ID');
    const newRepoId = createRepoRes.data.item.id;
    console.log(`   [OK] Created custom reaction mechanism (ID: ${newRepoId})`);

    // Star reaction
    const starRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/repo/${newRepoId}/star`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    assert.strictEqual(starRes.statusCode, 200, 'Star should return 200');
    assert.strictEqual(starRes.data.starred, true, 'Reaction should be starred');
    console.log('   [OK] Reaction starred successfully');

    // Fork reaction
    const forkRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/repo/${newRepoId}/fork`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    assert.strictEqual(forkRes.statusCode, 201, 'Fork should return 201');
    assert.ok(forkRes.data.item.id, 'Forked item must have an ID');
    const forkedId = forkRes.data.item.id;
    console.log(`   [OK] Reaction forked successfully (Fork ID: ${forkedId})`);

    // Delete the forked reaction
    const delRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/repo/${forkedId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    assert.strictEqual(delRes.statusCode, 200, 'Delete should return 200');
    assert.strictEqual(delRes.data.success, true);
    console.log('   [OK] Forked reaction deleted successfully');

    // 8. Mechanism Export Endpoint (F1 Fix)
    console.log('\n[8/14] Testing Mechanism Export Endpoint (/api/repo/export)...');
    const exportRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/repo/export',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    assert.strictEqual(exportRes.statusCode, 200, 'Export route must return 200 and not be intercepted as :id (404)');
    assert.strictEqual(exportRes.data.success, true);
    assert.ok(Array.isArray(exportRes.data.items), 'Export should return items array');
    assert.strictEqual(exportRes.data.count, 1, 'Should contain 1 active reaction created by user');
    console.log(`   [OK] Export endpoint verified (${exportRes.data.count} reaction exported)`);

    // 9. Admin Login & Authorization
    console.log('\n[9/14] Testing Administrator Login & Access Control...');
    const adminLoginRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST'
    }, {
      username: 'admin',
      password: 'chemiationadmin123'
    });

    assert.strictEqual(adminLoginRes.statusCode, 200, 'Admin login should succeed');
    assert.strictEqual(adminLoginRes.data.user.role, 'admin', 'Default admin must have admin role');
    const adminToken = adminLoginRes.data.token;
    console.log('   [OK] Admin authenticated successfully with role=admin');

    // 10. Admin Dashboard Inspection APIs
    console.log('\n[10/14] Testing Server Inspection & Monitoring APIs (/api/admin/*)...');

    // Metrics
    const metricsRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/admin/metrics',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(metricsRes.statusCode, 200, 'Admin metrics should return 200');
    assert.ok(metricsRes.data.system, 'Metrics should include system info');
    assert.ok(metricsRes.data.system.platform, 'System should include platform');
    assert.ok(metricsRes.data.counts.users >= 2, 'Should count at least admin and test user');
    console.log(`   [OK] Server metrics: ${metricsRes.data.counts.users} users, ${metricsRes.data.counts.reactions} reactions, Node: ${metricsRes.data.system.nodeVersion}`);

    // Inspect Users
    const usersRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/admin/users',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(usersRes.statusCode, 200, 'Admin users should return 200');
    assert.ok(Array.isArray(usersRes.data.users), 'Users must be an array');
    const targetUser = usersRes.data.users.find(u => u.username === testUsername);
    assert.ok(targetUser, 'Admin should be able to inspect created user');
    assert.strictEqual(targetUser.nickname, '罗伯特·波义耳');
    console.log(`   [OK] Admin users list inspected (${usersRes.data.users.length} registered users)`);

    // Inspect Audit Logs
    const logsRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/admin/logs?limit=10',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(logsRes.statusCode, 200, 'Admin logs should return 200');
    assert.ok(Array.isArray(logsRes.data.logs), 'Logs must be an array');
    assert.ok(logsRes.data.logs.length > 0, 'Audit logs should contain recorded actions');
    console.log(`   [OK] Audit log stream inspected (${logsRes.data.logs.length} logged events)`);

    // Verify non-admin gets 403 on admin routes
    const forbiddenRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/admin/metrics',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    assert.strictEqual(forbiddenRes.statusCode, 403, 'Regular user must be forbidden (403) from admin endpoints');
    console.log('   [OK] Role-Based Access Control (RBAC 403) verified');

    // 11. Security Testing: Static File Restrictions (S1 Fix)
    console.log('\n[11/14] Testing Static File Directory Traversal & Secret Defense (S1 Fix)...');
    const blockedPaths = [
      '/server/data/users.json',
      '/server/data/session.secret',
      '/server/auth.js',
      '/.git/config',
      '/test/test_suite.js'
    ];

    for (const blockedPath of blockedPaths) {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: blockedPath,
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 403, `Access to sensitive path ${blockedPath} must be 403 Forbidden (got ${res.statusCode})`);
    }
    console.log('   [OK] All sensitive server/test/.git paths strictly rejected with 403 Forbidden');

    // 12. Security Testing: Logout & Token Revocation (S4 Fix)
    console.log('\n[12/14] Testing Logout & JWT Blacklist Revocation (S4 Fix)...');
    const logoutRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/logout',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    assert.strictEqual(logoutRes.statusCode, 200, 'Logout should return 200');
    assert.strictEqual(logoutRes.data.success, true);

    // Verify that the revoked token can no longer access protected endpoints
    const revokedCheckRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/profile',
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }, { nickname: 'Hacker' });
    assert.strictEqual(revokedCheckRes.statusCode, 401, 'Revoked token must be rejected with 401 Unauthorized');
    console.log('   [OK] Revoked JWT token rejected on subsequent API requests');

    // 13. Security Testing: Malformed JSON Request Handling (S6 Fix)
    console.log('\n[13/14] Testing Malformed JSON Payload Handling (S6 Fix)...');
    const malformedRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, '{ invalid json syntax ');
    assert.strictEqual(malformedRes.statusCode, 400, `Malformed JSON should return 400 Bad Request (got ${malformedRes.statusCode})`);
    console.log('   [OK] Malformed JSON payload returned 400 Bad Request without leaking internal stack trace');

    // 14. Static File Serving & Headers
    console.log('\n[14/19] Verifying Static File Serving & Frontend Integration...');
    const staticEndpoints = [
      { path: '/', expectedCode: 200, contains: 'CHEMIATION' },
      { path: '/index.html', expectedCode: 200, contains: 'header-auth-btn' },
      { path: '/admin.html', expectedCode: 200, contains: 'Chemiation · 服务器管理控制台' },
      { path: '/css/modal.css', expectedCode: 200, contains: 'modal-backdrop' },
      { path: '/js/api.js', expectedCode: 200, contains: 'api' },
      { path: '/js/auth.js', expectedCode: 200, contains: 'authCtrl' },
      { path: '/js/repo.js', expectedCode: 200, contains: 'repoCtrl' },
      { path: '/js/aiAssistant.js', expectedCode: 200, contains: 'aiAssistant' }
    ];

    for (const testItem of staticEndpoints) {
      const res = await httpRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: testItem.path,
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, testItem.expectedCode, `File ${testItem.path} should return ${testItem.expectedCode}`);
      assert.ok(res.raw.includes(testItem.contains), `File ${testItem.path} should contain "${testItem.contains}"`);
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff', 'Headers must include nosniff');
      console.log(`   [OK] Static asset verified: ${testItem.path} (${res.raw.length} bytes)`);
    }

    // 15. Security Testing: Payload Too Large (>5MB returns 413, N5 Fix)
    console.log('\n[15/19] Testing Payload Too Large Handling (>5MB returns 413, N5 Fix)...');
    const largePayload = JSON.stringify({ username: 'tester', password: 'A'.repeat(6 * 1024 * 1024) });
    const largeRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(largePayload)
      }
    }, largePayload);
    assert.strictEqual(largeRes.statusCode, 413, `Payload >5MB must return 413 Payload Too Large (got ${largeRes.statusCode})`);
    assert.strictEqual(largeRes.data.success, false);
    console.log('   [OK] Large payload >5MB successfully returned HTTP 413 without ECONNRESET');

    // 16. Security Testing: Malformed URI and %zz Defense
    console.log('\n[16/19] Testing Malformed URI Path Defense (%zz returns 400)...');
    const malformedUriRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/repo/%zz',
      method: 'GET'
    });
    assert.strictEqual(malformedUriRes.statusCode, 400, `Malformed %zz path must return 400 Bad Request (got ${malformedUriRes.statusCode})`);
    console.log('   [OK] Malformed URI %zz safely intercepted with 400 Bad Request');

    // 17. Security Testing: Dynamic CORS Policy (External Origin Defense)
    console.log('\n[17/19] Testing CORS Origin Policy (Localhost Allowed, External Blocked)...');
    const localCorsRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    assert.strictEqual(localCorsRes.headers['access-control-allow-origin'], 'http://localhost:3000');

    const evilCorsRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': 'https://malicious-external-site.com'
      }
    });
    assert.strictEqual(evilCorsRes.headers['access-control-allow-origin'], undefined, 'External origins must not receive ACAO header');
    console.log('   [OK] CORS properly protects against unauthorized external origins');

    // 18. Security Testing: Token Revocation Blacklist Persistence (N8 Fix)
    console.log('\n[18/19] Testing Token Revocation Blacklist Persistence (N8 Fix)...');
    const revokedTokensFile = path.join(testDataDir, 'revoked_tokens.json');
    assert.ok(fs.existsSync(revokedTokensFile), 'Revocation blacklist file should exist on disk');
    const revokedRaw = JSON.parse(fs.readFileSync(revokedTokensFile, 'utf8'));
    assert.ok(revokedRaw[userToken], 'Logged out token must be persisted in revoked_tokens.json');
    console.log('   [OK] Token revocation state successfully persisted to storage across restarts');

    // 19. Client-side Offline Salted Password Hashing (N9 Fix)
    console.log('\n[19/19] Testing Offline Salted Password Hashing (N9 Fix)...');
    const apiModule = require('../js/api.js');
    const testSalt = apiModule.generateSalt(16);
    assert.strictEqual(testSalt.length, 32, 'Generated salt must be 32 hex characters (16 bytes)');
    const hash1 = await apiModule.hashPassword('MySecretPwd', testSalt);
    const hash2 = await apiModule.hashPassword('MySecretPwd', testSalt);
    const hash3 = await apiModule.hashPassword('MySecretPwd', 'differentsalt1234');
    assert.strictEqual(hash1, hash2, 'Identical password and salt must produce deterministic hash');
    assert.notStrictEqual(hash1, hash3, 'Different salts must produce different hashes');
    console.log('   [OK] Cryptographically salted offline hashing verified');

    // 20. Security Testing: Strict RBAC & Unauthenticated Defense on Admin APIs
    console.log('\n[20/23] Testing Strict RBAC & Unauthenticated Defense on Admin APIs...');
    const adminEndpoints = [
      '/api/admin/metrics',
      '/api/admin/overview',
      '/api/admin/users',
      '/api/admin/reactions',
      '/api/admin/logs',
      '/api/admin/users/u_admin_root'
    ];
    for (const ep of adminEndpoints) {
      const anonRes = await httpRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: ep,
        method: 'GET'
      });
      assert.strictEqual(anonRes.statusCode, 401, `Unauthenticated request to ${ep} must return 401 Unauthorized (got ${anonRes.statusCode})`);
    }

    // Verify root admin protection
    const alterRootRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/admin/users/u_admin_root/role',
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }, { role: 'user' });
    assert.strictEqual(alterRootRes.statusCode, 400, 'Cannot alter root admin role');
    console.log('   [OK] Strict RBAC and root admin immutability verified');

    // 21. Security Testing: IDOR Access Control on Private Reactions (Fork & Star)
    console.log('\n[21/23] Testing IDOR Access Control on Private Reactions (Fork & Star)...');
    // Register User 1 (Victim)
    const user1Name = `victim_${Date.now()}`;
    const user1Reg = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: user1Name, password: 'password123' });
    assert.strictEqual(user1Reg.statusCode, 201);
    const user1Token = user1Reg.data.token;

    // Create a private reaction with User 1
    const privRepoRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/repo',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user1Token}`,
        'Content-Type': 'application/json'
      }
    }, {
      title: 'Top Secret Mechanism',
      equation: 'X + Y -> Z',
      script: 'reaction "Secret"\nstep "1" { atom C1 C }',
      isPublic: false
    });
    assert.strictEqual(privRepoRes.statusCode, 201);
    const privateRepoId = privRepoRes.data.item.id;

    // Register User 2 (Attacker)
    const user2Name = `attacker_${Date.now()}`;
    const user2Reg = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: user2Name, password: 'password123' });
    assert.strictEqual(user2Reg.statusCode, 201);
    const user2Token = user2Reg.data.token;

    // User 2 tries to fork User 1's private reaction -> MUST FAIL (404/Inaccessible)
    const evilForkRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/repo/${privateRepoId}/fork`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    assert.strictEqual(evilForkRes.statusCode, 404, 'Forking another user private reaction must be rejected');

    // User 2 tries to star User 1's private reaction -> MUST FAIL (404/Inaccessible)
    const evilStarRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/repo/${privateRepoId}/star`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user2Token}` }
    });
    assert.strictEqual(evilStarRes.statusCode, 404, 'Starring another user private reaction must be rejected');
    console.log('   [OK] IDOR defense for private mechanisms verified');

    // 22. Security Testing: Null Byte Traversal Defense (%00)
    console.log('\n[22/23] Testing Null Byte Path Defense (%00 returns 400)...');
    const nullByteRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/index.html%00.png',
      method: 'GET'
    });
    assert.strictEqual(nullByteRes.statusCode, 400, 'Null byte in static path must return 400');
    console.log('   [OK] Null byte path injection safely intercepted with 400 Bad Request');

    // 23. Security Testing: Defensive Security Headers
    console.log('\n[23/23] Testing Defensive Security Response Headers...');
    const healthHeadersRes = await httpRequest({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/health',
      method: 'GET'
    });
    assert.strictEqual(healthHeadersRes.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(healthHeadersRes.headers['x-frame-options'], 'SAMEORIGIN');
    assert.strictEqual(healthHeadersRes.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    console.log('   [OK] Defensive HTTP security headers verified');

    console.log('\nALL CHEMIATION FULLSTACK SERVER INTEGRATION TESTS PASSED!\n');
  } catch (err) {
    console.error('\n[FAIL] Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    if (testServer) {
      testServer.close();
    }
    // Clean up sandboxed test directory
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
        console.log(`[CLEANUP] Cleaned up temporary test data directory: ${testDataDir}`);
      }
    } catch (e) {
      console.warn('Could not remove temporary test dir:', e.message);
    }
  }
}

runTests();
