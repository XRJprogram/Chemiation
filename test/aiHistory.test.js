const test = require('node:test');
const assert = require('node:assert/strict');
const history = require('../js/aiHistory.js');
function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function record(id = 'record-1', script = 'original\r\n  draft\n', day = 1) {
  return { id, createdAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`, kind: 'generation', title: 'Title ' + id,
    prompt: 'Generate a mechanism', status: 'ready', provider: 'mock', model: 'mock-model',
    versions: [{ id: 'base', label: 'Original', kind: 'draft', script, complete: false, valid: false }] };
}

test('history persists exact source text across store instances', async () => {
  const localStorage = storage();
  await history.createStore({ localStorage }).put('guest', record());
  const restored = await history.createStore({ localStorage }).get('guest', 'record-1');
  assert.equal(restored.versions[0].script, 'original\r\n  draft\n');
});

test('guest and different account histories remain separate even when record IDs match', async () => {
  const store = history.createStore({ localStorage: storage() });
  await store.put('guest', record('same', 'guest text'));
  await store.put('user:one', record('same', 'one text'));
  await store.put('user:two', record('same', 'two text'));
  assert.equal((await store.get('user:one', 'same')).versions[0].script, 'one text');
  assert.equal((await store.get('user:two', 'same')).versions[0].script, 'two text');
  assert.equal((await store.list('guest')).length, 1);
});

test('only whitelisted fields are persisted and metadata lists omit script bodies', async () => {
  const localStorage = storage(), store = history.createStore({ localStorage });
  await store.put('guest', { ...record(), apiKey: 'private-credential', baseUrl: 'private-endpoint', headers: { Authorization: 'private-token' },
    versions: [{ ...record().versions[0], apiKey: 'private-version-key', reasoning: 'private-reasoning' }] });
  const serialized = [...localStorage.values.values()].join('');
  assert.doesNotMatch(serialized, /private-credential|private-endpoint|private-token|private-version-key|private-reasoning/);
  const list = await store.list('guest');
  assert.equal(Object.hasOwn(list[0].versions[0], 'script'), false);
  assert.equal(list[0].versions[0].characters, record().versions[0].script.length);
});

test('quota failures leave the prior history unchanged', async () => {
  const localStorage = storage(), store = history.createStore({ localStorage });
  await store.put('guest', record());
  const before = localStorage.getItem(history.PREFIX + 'guest');
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(store.put('guest', record('new')), { code: 'HISTORY_QUOTA' });
  assert.equal(localStorage.getItem(history.PREFIX + 'guest'), before);
  assert.equal((await store.list('guest')).length, 1);
});

test('retention keeps the new record and reports removed older records', async () => {
  const store = history.createStore({ localStorage: storage(), limits: { records: 2, characters: 100000 } });
  await store.put('guest', record('one', 'one', 1));
  await store.put('guest', record('two', 'two', 2));
  const result = await store.put('guest', record('three', 'three', 3));
  assert.equal(result.pruned, 1);
  assert.equal(await store.get('guest', 'one'), null);
  assert.deepEqual((await store.list('guest')).map(value => value.id), ['three', 'two']);
});

test('character budgets are enforced without truncating saved drafts', async () => {
  const first = record('one', 'x'.repeat(1000), 1), second = record('two', 'y'.repeat(1000), 2);
  const size = JSON.stringify(history.normalize(first)).length;
  const store = history.createStore({ localStorage: storage(), limits: { records: 10, characters: size + 20 } });
  await store.put('guest', first);
  assert.equal((await store.put('guest', second)).pruned, 1);
  assert.equal((await store.get('guest', 'two')).versions[0].script, 'y'.repeat(1000));
  await assert.rejects(store.put('guest', record('too-big', 'z'.repeat(10000))), { code: 'HISTORY_TOO_LARGE' });
  assert.equal((await store.list('guest')).length, 1);
});

test('damaged local data is not silently overwritten by a new history save', async () => {
  const localStorage = storage(); localStorage.setItem(history.PREFIX + 'guest', 'corrupt-data');
  const store = history.createStore({ localStorage });
  await assert.rejects(store.put('guest', record()), { code: 'HISTORY_FORMAT' });
  assert.equal(localStorage.getItem(history.PREFIX + 'guest'), 'corrupt-data');
});

test('applied markers update the existing record without duplicating versions', async () => {
  const store = history.createStore({ localStorage: storage() });
  await store.put('guest', record());
  await store.markApplied('guest', 'record-1', 'base');
  const entry = await store.get('guest', 'record-1');
  assert.equal(entry.appliedVersionId, 'base');
  assert.ok(entry.appliedAt);
  assert.equal(entry.versions.length, 1);
  await assert.rejects(store.markApplied('guest', 'record-1', 'missing'), { code: 'HISTORY_MISSING' });
});

test('queued saves retain concurrent results and failed writes do not poison later saves', async () => {
  const store = history.createStore({ localStorage: storage(), limits: { records: 100, characters: 1000000 } });
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.put('guest', record('item-' + i))));
  await assert.rejects(store.put('guest', { ...record('bad'), versions: [] }));
  await store.put('guest', record('last'));
  assert.equal((await store.list('guest')).length, 21);
});

test('invalid identity, duplicate version IDs and oversized drafts are rejected', () => {
  assert.throws(() => history.normalize({ ...record(), id: 'x'.repeat(121) }), { code: 'HISTORY_FORMAT' });
  assert.throws(() => history.normalize({ ...record(), createdAt: new Date() }), { code: 'HISTORY_FORMAT' });
  assert.throws(() => history.normalize({ ...record(), versions: [record().versions[0], record().versions[0]] }), { code: 'HISTORY_FORMAT' });
  assert.throws(() => history.normalize(record('long', 'x'.repeat(200001))), { code: 'HISTORY_FORMAT' });
});

test('export contains all retained version bodies and no API configuration', async () => {
  const store = history.createStore({ localStorage: storage() });
  await store.put('guest', record());
  const exported = await store.export('guest');
  assert.equal(exported[0].versions[0].script, record().versions[0].script);
  assert.equal(Object.hasOwn(exported[0], 'apiKey'), false);
});

test('an initially blocked IndexedDB open can be retried rather than caching its rejection', async () => {
  let calls = 0;
  const store = history.createStore({ indexedDB: { open() { calls++; throw new Error('blocked'); } } });
  await assert.rejects(store.list('guest'), { code: 'HISTORY_STORAGE' });
  await assert.rejects(store.list('guest'), { code: 'HISTORY_STORAGE' });
  assert.equal(calls, 2);
});
