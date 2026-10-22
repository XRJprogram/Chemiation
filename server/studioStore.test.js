/* Isolated local API tests and an Upstash REST contract emulator.
   No production credentials, database or paid model calls are used. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chemiation-conversations-'));
process.env.NODE_ENV = 'test';
process.env.CHEMIATION_DATA_DIR = dataDir;
const Core = require('../js/aiStudioCore');
const store = require('./studioStore');
const adapter = require('./upstashAdapter');
const db = require('./db');
const server = require('./server');
const SCRIPT = 'reaction "Saved SN2 example"\nstep "First step" {\n}\n';
let base, alice, bob;

async function request(route, method = 'GET', token = '', body) {
  const res = await fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}
const route = session => '/api/studio/sessions/' + session.id;
const put = (session, expectedRevision = 0, token = alice.token) => request(route(session), 'PUT', token, { session, expectedRevision });
function session(projectId = 'mechanism-a', id = Core.id()) {
  return { ...Core.create({ id: projectId, name: 'Example mechanism' }), id };
}

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  const register = async username => (await request('/api/auth/register', 'POST', '', { username, password: 'Studio123!abcd' })).body;
  alice = await register('studio_alice'); bob = await register('studio_bob');
  assert.ok(alice.token); assert.ok(bob.token);
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  // Only recursively remove the temporary directory this test created.
  const resolved = fs.realpathSync(dataDir), tempRoot = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved), tempRoot);
  assert.ok(path.basename(resolved).startsWith('chemiation-conversations-'));
  fs.rmSync(resolved, { recursive: true, force: true });
});

test('normalization keeps question forms, replies and version ancestry, without configuration fields', () => {
  const value = session();
  value.messages = [
    { id: 'question-1', role: 'assistant', text: 'Choose conditions', question: { question: 'Which catalyst?', options: ['Acid', { label: 'Other', value: 'My answer', description: 'Specify conditions' }] } },
    { id: 'answer-1', role: 'user', text: 'My own answer', replyTo: 'question-1' }
  ];
  value.versions = [
    { id: 'v1', script: SCRIPT, status: 'accepted' },
    { id: 'v2', script: SCRIPT + '# restored', status: 'restored', parentId: 'v1' }
  ];
  value.activeVersionId = 'v2'; value.draft = 'Unsent draft';
  value.apiKey = 'sentinel-private-config'; value.config = { token: 'sentinel-private-config' }; value.userId = 'spoofed';
  const normalized = Core.normalize(value);
  assert.equal(normalized.messages[0].question.options.length, 2);
  assert.equal(normalized.messages[1].replyTo, 'question-1');
  assert.equal(normalized.versions[1].parentId, 'v1');
  assert.equal(normalized.activeVersionId, 'v2'); assert.equal(normalized.draft, value.draft);
  assert.equal(JSON.stringify(normalized).includes('sentinel-private-config'), false);
  assert.equal('userId' in normalized, false);
});

test('validation bounds document size and rejects malformed IDs or records', () => {
  assert.throws(() => Core.key('../escape'), { statusCode: 400 });
  assert.throws(() => Core.normalize({ ...session(), projectId: 'a\nb' }), { statusCode: 400 });
  assert.throws(() => Core.normalize({ ...session(), messages: [{ id: 'm', role: 'system', text: 'x' }] }), { statusCode: 400 });
  assert.throws(() => Core.normalize({ ...session(), messages: Array(161).fill({}) }), { statusCode: 413 });
  assert.throws(() => Core.normalize({ ...session(), versions: [{ id: 'v', script: 'x'.repeat(200001) }] }), { statusCode: 400 });
  assert.throws(() => Core.normalize({ ...session(), versions: [{ id: 'v', script: '' }, { id: 'v', script: '' }] }), { statusCode: 400 });
});

test('every session operation requires the existing account login', async () => {
  const value = session();
  for (const [url, method, body] of [
    ['/api/studio/sessions', 'GET'], [route(value), 'GET'],
    [route(value), 'PUT', { session: value, expectedRevision: 0 }], [route(value), 'DELETE']
  ]) {
    const result = await request(url, method, '', body);
    assert.equal(result.status, 401); assert.equal(result.headers.get('cache-control'), 'no-store');
  }
});

test('API persists normalized chats and scripts, with a server-controlled revision and timestamp', async () => {
  const value = session('persistence', 'persisted');
  value.draft = 'Draft waiting for an answer';
  value.messages.push({ id: 'm1', role: 'user', text: 'Private message' });
  value.versions.push({ id: 'v1', script: SCRIPT, status: 'accepted' });
  value.activeVersionId = 'v1'; value.apiKey = 'sentinel-private-config'; value.revision = 999;
  const saved = await put(value);
  assert.equal(saved.status, 200); assert.equal(saved.body.session.revision, 1);
  assert.equal(saved.headers.get('cache-control'), 'no-store');
  assert.equal(JSON.stringify(saved.body).includes('sentinel-private-config'), false);
  const fetched = await request(route(value), 'GET', alice.token);
  assert.equal(fetched.body.session.draft, value.draft);
  assert.equal(fetched.body.session.versions[0].script, SCRIPT);
  // Read from a fresh Node process, rather than an in-memory test fixture.
  const child = execFileSync(process.execPath, ['-e',
    'require("./server/studioStore").get(process.argv[1], "persisted").then(s => process.stdout.write(JSON.stringify(s)))', alice.user.id
  ], { cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'test', CHEMIATION_DATA_DIR: dataDir }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(child), fetched.body.session);
});

test('projects contain independent sibling conversations, drafts and versions, with pagination', async () => {
  const first = session('project-siblings', 'sibling-a'), second = session('project-siblings', 'sibling-b');
  first.draft = 'First draft'; second.draft = 'Second draft';
  first.versions = [{ id: 'v-a', script: SCRIPT, status: 'candidate' }];
  for (const value of [first, second, session('another-project', 'sibling-c'), session('', 'legacy')]) assert.equal((await put(value)).status, 200);
  const page1 = (await request('/api/studio/sessions?projectId=project-siblings&limit=1', 'GET', alice.token)).body;
  const page2 = (await request('/api/studio/sessions?projectId=project-siblings&limit=1&offset=1', 'GET', alice.token)).body;
  assert.equal(page1.nextOffset, 1); assert.equal(page2.nextOffset, null);
  assert.notEqual(page1.items[0].id, page2.items[0].id);
  assert.equal(page1.items[0].projectId, 'project-siblings');
  assert.equal('messages' in page1.items[0], false); assert.equal('versions' in page1.items[0], false);
  assert.equal((await request(route(first), 'GET', alice.token)).body.session.draft, 'First draft');
  const savedSecond = (await request(route(second), 'GET', alice.token)).body.session;
  assert.equal(savedSecond.draft, 'Second draft'); assert.deepEqual(savedSecond.versions, []);
  assert.deepEqual((await request('/api/studio/sessions?projectId=', 'GET', alice.token)).body.items.map(v => v.id), ['legacy']);
});

test('another account cannot read or delete a chat or spoof its ownership', async () => {
  const value = session('isolation', 'private-a');
  value.messages.push({ id: 'private-msg', role: 'user', text: 'Alice secret' });
  assert.equal((await put(value)).status, 200);
  assert.equal((await request(route(value), 'GET', bob.token)).status, 404);
  assert.deepEqual((await request('/api/studio/sessions', 'GET', bob.token)).body.items, []);
  assert.equal((await request(route(value), 'DELETE', bob.token)).status, 200);
  assert.equal((await request(route(value), 'GET', alice.token)).status, 200);
  const impostor = { ...value, userId: alice.user.id, messages: [] };
  assert.equal((await put(impostor, 0, bob.token)).status, 200);
  assert.equal((await request(route(value), 'GET', alice.token)).body.session.messages[0].text, 'Alice secret');
});

test('stale writes and project reassignment return 409 while a project rename is allowed', async () => {
  const value = session('immutable-project', 'cas');
  const original = (await put(value)).body.session;
  assert.equal((await put({ ...value, title: 'stale' }, 0)).status, 409);
  assert.equal((await put({ ...value, projectId: 'other' }, 1)).status, 409);
  const updated = await put({ ...value, projectName: 'Renamed mechanism', createdAt: 'spoofed-date' }, 1);
  assert.equal(updated.status, 200); assert.equal(updated.body.session.revision, 2);
  assert.equal(updated.body.session.createdAt, original.createdAt);
  assert.equal(updated.body.session.projectName, 'Renamed mechanism');
  assert.equal((await request(route(value), 'PUT', alice.token, { session: value })).status, 400);
  for (const revision of [-1, 0.1, Number.MAX_SAFE_INTEGER]) assert.equal((await put(value, revision)).status, 400);
});

test('invalid or oversized updates leave the previous stored script intact', async () => {
  const value = session('validation', 'safe-script');
  value.versions.push({ id: 'v1', script: SCRIPT, status: 'accepted' });
  assert.equal((await put(value)).status, 200);
  assert.equal((await put({ ...value, versions: Array(41).fill(value.versions[0]) }, 1)).status, 413);
  assert.equal((await put({ ...value, projectId: {} }, 1)).status, 400);
  const fetched = (await request(route(value), 'GET', alice.token)).body.session;
  assert.equal(fetched.revision, 1); assert.equal(fetched.versions[0].script, SCRIPT);
});

test('lookup only uses public or own mechanisms and own accepted/restored script versions', async () => {
  const query = title => '/api/studio/matches?q=' + encodeURIComponent(title);
  for (const [title, isPublic] of [['UniquePrivateSN2', false], ['UniquePublicEster', true]]) db.createReaction({ userId: alice.user.id, title, script: SCRIPT, isPublic });
  assert.equal((await request(query('UniquePrivateSN2'))).body.items.length, 0);
  assert.equal((await request(query('UniquePrivateSN2'), 'GET', bob.token)).body.items.length, 0);
  assert.equal((await request(query('UniquePrivateSN2'), 'GET', alice.token)).body.items.length, 1);
  assert.equal((await request(query('UniquePublicEster'))).body.items.length, 1);
  const value = session('history-matches', 'history');
  value.versions = [{ id: 'accepted', script: SCRIPT, status: 'accepted' }, { id: 'candidate', script: 'reaction "CandidateOnly"', status: 'candidate' }];
  assert.equal((await put(value)).status, 200);
  const result = await request(query('Saved SN2 example'), 'GET', alice.token);
  assert.ok(result.body.items.length > 0); assert.equal(result.body.items[0].reviewStatus, 'unreviewed');
  assert.equal(result.body.items[0].source, '历史对话的已保留版本');
  assert.equal((await request(query('Saved SN2 example'), 'GET', bob.token)).body.items.length, 0);
  assert.equal((await request(query('CandidateOnly'), 'GET', alice.token)).body.items.length, 0);
});

test('local account limit does not delete old records, and deleting a chat removes its lookup', async () => {
  for (let i = 0; i < 100; i++) await store.save('limit-owner', 's' + i, session('cap', 's' + i), 0);
  await assert.rejects(store.save('limit-owner', 'overflow', session('cap', 'overflow'), 0), { statusCode: 413 });
  assert.equal((await store.get('limit-owner', 's0')).revision, 1);
  const value = session('deleted', 'delete-me');
  assert.equal((await put(value)).status, 200);
  assert.equal((await request(route(value), 'DELETE', alice.token)).status, 200);
  assert.equal((await request(route(value), 'GET', alice.token)).status, 404);
});

test('server files and conversation data cannot be fetched as static files', async () => {
  for (const url of ['/server/studioStore.js', '/server/studioStore.test.js', '/server/data/studio/private.json']) assert.equal((await request(url)).status, 403);
});

// Emulates Redis command results over HTTP; EVAL's Lua is captured, not executed.
// This exercises the real adapter transport without calling a production database.
async function redisFixture(t) {
  const hashes = new Map(), indexes = new Map(), commands = [];
  const hash = key => { if (!hashes.has(key)) hashes.set(key, new Map()); return hashes.get(key); };
  let unavailable = false;
  const previous = { url: adapter.url, token: adapter.token, prefix: adapter.prefix, env: process.env.NODE_ENV };
  const mock = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    assert.equal(req.headers.authorization, 'Bearer mock-only-token');
    const command = JSON.parse(body); commands.push(command);
    if (unavailable) { res.end(JSON.stringify({ error: 'mock store unavailable' })); return; }
    const [op, key, ...args] = command;
    let result;
    if (op === 'HGET') result = hash(key).get(args[0]) || null;
    else if (op === 'HVALS') result = [...hash(key).values()];
    else if (op === 'HMGET') result = args.map(id => hash(key).get(id) || null);
    else if (op === 'ZREVRANGE') result = [...(indexes.get(key) || [])].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).map(v => v[0]).slice(args[0], args[1] + 1);
    else if (op === 'EVAL') {
      const [source, count, ...rest] = command.slice(1);
      assert.equal(count, 3);
      const [sessions, index, metadata] = rest.slice(0, count);
      const [id, revision, encoded, score, meta, project] = rest.slice(count);
      assert.equal(source.includes('cjson.encode'), false);
      assert.ok(source.includes("redis.call('HGET',KEYS[1],ARGV[1])") || source.includes("redis.call('HDEL',KEYS[1],ARGV[1])"));
      if (source.includes("redis.call('HDEL'")) {
        hash(sessions).delete(id); hash(metadata).delete(id); indexes.get(index)?.delete(id); result = 1;
      } else {
        const old = hash(sessions).get(id);
        if ((old ? JSON.parse(old).revision : 0) !== revision) result = -1;
        else if (old && (JSON.parse(old).projectId || '') !== project) result = -3;
        else if (!old && hash(sessions).size >= 100) result = -2;
        else {
          hash(sessions).set(id, encoded); hash(metadata).set(id, meta);
          if (!indexes.has(index)) indexes.set(index, new Map());
          indexes.get(index).set(id, score); result = encoded;
        }
      }
    } else { res.end(JSON.stringify({ error: 'unexpected command ' + op })); return; }
    res.end(JSON.stringify({ result }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  adapter.url = 'http://127.0.0.1:' + mock.address().port; adapter.token = 'mock-only-token'; adapter.prefix = 'test-custom-prefix:';
  process.env.NODE_ENV = 'production';
  t.after(async () => {
    Object.assign(adapter, { url: previous.url, token: previous.token, prefix: previous.prefix }); process.env.NODE_ENV = previous.env;
    await new Promise(resolve => mock.close(resolve));
  });
  return { commands, hashes, fail: () => { unavailable = true; } };
}

test('Upstash transport: per-account keys, empty arrays, concurrent save conflicts and project immutability', async t => {
  const mock = await redisFixture(t);
  const value = session('cloud-project', 'cloud-chat');
  const results = await Promise.allSettled([store.save('owner', value.id, value, 0), store.save('owner', value.id, value, 0)]);
  assert.equal(results.filter(v => v.status === 'fulfilled').length, 1);
  assert.equal(results.find(v => v.status === 'rejected').reason.statusCode, 409);
  const loaded = await store.get('owner', value.id);
  assert.deepEqual(loaded.messages, []); assert.deepEqual(loaded.versions, []);
  assert.equal(await store.get('other-owner', value.id), null);
  assert.equal((await store.list('owner')).items[0].id, value.id);
  assert.equal((await store.list('owner', 0, 1, 'cloud-project')).items[0].projectId, 'cloud-project');
  assert.deepEqual((await store.list('owner', 0, 20, 'another-project')).items, []);
  await assert.rejects(store.save('owner', value.id, { ...loaded, projectId: 'moved' }, 1), { statusCode: 409 });
  loaded.versions = [{ id: 'cloud-version', script: SCRIPT, status: 'accepted' }];
  await store.save('owner', value.id, loaded, 1);
  assert.equal((await store.findMechanisms('owner', 'Saved SN2 example'))[0].script, SCRIPT);
  for (const command of mock.commands) {
    const keys = command[0] === 'EVAL' ? command.slice(3, 6) : command.slice(1, 2);
    assert.ok(keys.every(k => /^test-custom-prefix:studio:\{(?:owner|other-owner)\}:(sessions|index|metadata)$/.test(k)));
  }
  await store.remove('other-owner', value.id); assert.ok(await store.get('owner', value.id));
  await store.remove('owner', value.id);
  assert.equal(await store.get('owner', value.id), null); assert.deepEqual((await store.list('owner')).items, []);
});

test('configured cloud failure returns 503 and never writes a local shadow copy', async t => {
  const mock = await redisFixture(t); mock.fail();
  const value = session('cloud-failure', 'never-local');
  const result = await put(value);
  assert.equal(result.status, 503); assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(fs.existsSync(path.join(dataDir, 'studio', alice.user.id, value.id + '.json')), false);
  for (const operation of [() => store.list(alice.user.id), () => store.get(alice.user.id, value.id), () => store.remove(alice.user.id, value.id)]) await assert.rejects(operation, /unavailable/);
});

test('cloud capacity errors preserve existing data and do not create partial metadata', async t => {
  const mock = await redisFixture(t);
  for (let i = 0; i < 100; i++) await store.save('cloud-cap', 's' + i, session('cap', 's' + i), 0);
  await assert.rejects(store.save('cloud-cap', 'overflow', session('cap', 'overflow'), 0), { statusCode: 413 });
  assert.equal((await store.get('cloud-cap', 's0')).revision, 1);
  assert.equal(await store.get('cloud-cap', 'overflow'), null);
  assert.equal([...mock.hashes.values()].some(hash => hash.has('overflow')), false);
});
