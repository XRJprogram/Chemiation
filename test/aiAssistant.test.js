const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ReactionScriptEngine } = require('../index.js');

const VALID = 'reaction "AI fixture"\nstep "state" {\nhydrogens none\natom C1 C 0 0 0\n}';
const DRAFT = 'reaction "Original draft"\nstep "original" {\nhydrogens none\natom C1 C 0 0 0\n}';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function response(content = VALID, finishReason = 'stop') {
  return { ok: true, json: async () => ({ choices: [{ message: { content }, finish_reason: finishReason }], usage: { completion_tokens: 12 } }) };
}
function fixture(options = {}) {
  const elements = new Map();
  for (const id of ['ai-prompt-input', 'script-editor', 'ai-preview-code', 'ai-preview-section', 'ai-generation-status', 'ai-btn-generate', 'ai-btn-cancel', 'ai-btn-apply', 'ai-btn-run', 'ai-btn-copy', 'ai-btn-restore-draft', 'btn-ai-restore-draft', 'ai-modal', 'ai-test-result', 'ai-btn-test-conn']) {
    elements.set(id, { value: '', textContent: '', disabled: false, style: {}, classList: { toggle() {} }, dispatchEvent() {}, addEventListener() {} });
  }
  elements.get('ai-prompt-input').value = 'Create a fixture';
  elements.get('script-editor').value = DRAFT;
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const app = { currentReactionIndex: 0, presets: [{ id: 'original-id', name: 'Original draft' }], switchTab() {}, runCustomScript() { this.runs = (this.runs || 0) + 1; } };
  const context = {
    module: { exports: {} }, console, AbortController, TextDecoder, setTimeout, clearTimeout, performance,
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: () => [] },
    localStorage: storage, window: { reactionApp: app }, Event: class { constructor(type) { this.type = type; } },
    fetch: options.fetch || (async () => response())
  };
  if (options.engine !== false) context.ReactionScriptEngine = ReactionScriptEngine;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiStream.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiTaskSafety.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiEditingTools.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiHistory.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiHistoryPanel.js'), 'utf8'), context);
  context.module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiAssistant.js'), 'utf8'), context);
  const ai = context.module.exports.aiAssistant;
  ai.getConfig = () => ({ provider: 'mock', baseUrl: 'https://offline.invalid/v1', apiKey: 'fixture', model: 'mock', timeoutMs: options.timeoutMs || 1000 });
  ai.showToast = (message, error) => { ai.toast = { message, error }; };
  return { ai, context, elements, storage, values, app, editor: elements.get('script-editor'), status: elements.get('ai-generation-status') };
}

test('syntax failures cannot replace the current draft or run', async () => {
  const f = fixture({ fetch: async () => response('invalid CCPL') });
  await f.ai.handleAction();
  f.ai.applyToWorkspace(true);
  assert.equal(f.editor.value, DRAFT, 'invalid output replaced the original draft');
  assert.equal(f.app.runs || 0, 0);
  assert.equal(f.elements.get('ai-btn-apply').disabled, true);
});

test('a length finish reason blocks even syntactically valid partial output', async () => {
  const f = fixture({ fetch: async () => response(VALID, 'length') });
  await f.ai.handleAction();
  f.ai.applyToWorkspace(false);
  assert.equal(f.editor.value, DRAFT, 'truncated output was applied');
  assert.match(f.status.textContent + (f.ai.toast?.message || ''), /截断|不完整/);
});

test('manual edits while the model is running are preserved', async () => {
  let resolve;
  const f = fixture({ fetch: () => new Promise(r => { resolve = r; }) });
  const pending = f.ai.handleAction();
  f.editor.value = 'MANUALLY UPDATED DRAFT';
  resolve(response());
  await pending;
  f.ai.applyToWorkspace(false);
  assert.equal(f.editor.value, 'MANUALLY UPDATED DRAFT', 'new manual edits were overwritten');
});

test('an unresponsive request times out and unlocks controls', async () => {
  const f = fixture({ timeoutMs: 15, fetch: () => new Promise(() => {}) });
  await Promise.race([f.ai.handleAction(), delay(100).then(() => { throw new Error('request did not time out'); })]);
  assert.equal(f.ai.isGenerating, false);
  assert.match(f.status.textContent, /超时/);
  assert.equal(f.editor.value, DRAFT);
});

test('missing validation engine fails closed', async () => {
  const f = fixture({ engine: false });
  await f.ai.handleAction();
  f.ai.applyToWorkspace(false);
  assert.equal(f.editor.value, DRAFT, 'unchecked output was applied');
});

module.exports = { fixture, response, VALID, DRAFT, delay };

test('valid output waits for an explicit load, persists backup and restores it', async () => {
  const f = fixture();
  await f.ai.handleAction();
  assert.equal(f.editor.value, DRAFT);
  assert.equal(f.elements.get('ai-btn-apply').disabled, false);
  assert.equal(f.ai.applyToWorkspace(false), true);
  assert.equal(f.editor.value, VALID);
  const backup = JSON.parse(f.values.get('chemiation_ai_draft_backup_v1'));
  assert.equal(backup.before.script, DRAFT);
  assert.equal(f.ai.restoreDraft(), true);
  assert.equal(f.editor.value, DRAFT);
  assert.equal(f.values.has('chemiation_ai_draft_backup_v1'), false);
});

test('a valid result is rechecked at the write boundary', async () => {
  const f = fixture();
  await f.ai.handleAction();
  f.ai.candidate.script = 'invalid';
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, DRAFT);
});

test('storage quota failure prevents overwriting the original draft', async () => {
  const f = fixture();
  await f.ai.handleAction();
  f.storage.setItem = () => { throw new Error('quota'); };
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, DRAFT);
});

test('switching to a different reaction blocks a stale candidate', async () => {
  const f = fixture();
  await f.ai.handleAction();
  f.app.currentReactionIndex = 1;
  f.app.presets.push({ id: 'another', name: 'Another' });
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, DRAFT);
});

test('manual edits after applying are never overwritten by undo', async () => {
  const f = fixture();
  await f.ai.handleAction();
  f.ai.applyToWorkspace(false);
  f.editor.value = 'NEW MANUAL EDITS';
  assert.equal(f.ai.restoreDraft(), false);
  assert.equal(f.editor.value, 'NEW MANUAL EDITS');
  assert.equal(f.ai.readDraftBackup().before.script, DRAFT);
});

test('undo after run restores both saved reaction and unsaved original draft', async () => {
  const f = fixture();
  f.app.runCustomScript = () => { f.app.presets[0] = ReactionScriptEngine.parse(f.editor.value); };
  f.app.loadReaction = () => { f.editor.value = 'serialized saved reaction'; };
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(true), true);
  assert.notEqual(f.app.presets[0].id, 'original-id');
  assert.equal(f.ai.restoreDraft(), true);
  assert.equal(f.app.presets[0].id, 'original-id');
  assert.equal(f.editor.value, DRAFT);
});

test('backup survives assistant reload', async () => {
  const f = fixture();
  await f.ai.handleAction();
  f.ai.applyToWorkspace(false);
  f.ai.lastDraftBackup = null;
  assert.equal(f.ai.restoreDraft(), true);
  assert.equal(f.editor.value, DRAFT);
});

for (const reason of [undefined, 'content_filter', 'tool_calls', 'aborted']) {
  test(`non-stop completion ${reason} cannot be loaded`, async () => {
    const f = fixture({ fetch: async () => response(VALID, reason === undefined ? null : reason) });
    await f.ai.handleAction();
    assert.equal(f.ai.applyToWorkspace(false), false);
    assert.equal(f.editor.value, DRAFT);
  });
}

test('empty model response cannot be loaded', async () => {
  const f = fixture({ fetch: async () => response('   ') });
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('deadline includes a hanging response body', async () => {
  const f = fixture({ timeoutMs: 15, fetch: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  await Promise.race([f.ai.handleAction(), delay(100).then(() => { throw new Error('body did not time out'); })]);
  assert.match(f.status.textContent, /超时/);
  assert.equal(f.ai.isGenerating, false);
});

test('manual cancellation releases controls even if transport ignores abort', async () => {
  const f = fixture({ fetch: () => new Promise(() => {}) });
  const pending = f.ai.handleAction();
  f.ai.cancelGeneration();
  await pending;
  assert.equal(f.ai.isGenerating, false);
  assert.match(f.status.textContent, /中止/);
  assert.equal(f.editor.value, DRAFT);
});

test('an old cancelled request cannot overwrite or unlock a newer request', async () => {
  const resolvers = [];
  const f = fixture({ fetch: () => new Promise(resolve => resolvers.push(resolve)) });
  const old = f.ai.handleAction();
  const current = f.ai.handleAction();
  await old;
  assert.equal(f.ai.isGenerating, true);
  resolvers[0](response('invalid late result'));
  await delay(0);
  assert.equal(f.ai.candidate, null);
  assert.equal(f.ai.isGenerating, true);
  resolvers[1](response());
  await current;
  assert.equal(f.ai.candidate.script, VALID);
  assert.equal(f.ai.candidate.validation.valid, true);
});

for (const [name, script] of [
  ['atom disappears', VALID + '\nstep "lost oxygen" {\nhydrogens none\natom C1 C 0 0 0\natom O1 O 1 0 0\n}'],
  ['element changes', VALID + '\nstep "changed" {\nhydrogens none\natom C1 O 0 0 0\n}'],
  ['charge changes', VALID + '\nstep "changed" {\nhydrogens none\natom C1 C 0 0 0 charge=+1\n}']
]) {
  test(`cross-step checks reject ${name}`, async () => {
    const f = fixture({ fetch: async () => response(script) });
    await f.ai.handleAction();
    assert.equal(f.ai.candidate.validation.valid, false);
    assert.equal(f.ai.applyToWorkspace(false), false);
    assert.equal(f.editor.value, DRAFT);
  });
}

test('balanced multi-step result is loadable', async () => {
  const script = VALID + '\nstep "second" {\nhydrogens none\natom C1 C 1 0 0\n}';
  const f = fixture({ fetch: async () => response(script) });
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(false), true);
});

test('JSON inputs receive element checks as well as parser checks', async () => {
  const script = JSON.stringify({ name: 'JSON', steps: [{ name: 'bad', atoms: [{ id: 'X1', element: 'Imaginary', x: 0, y: 0, z: 0 }], bonds: [] }] });
  const f = fixture({ fetch: async () => response(script) });
  await f.ai.handleAction();
  assert.equal(f.ai.candidate.validation.valid, false);
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('an unclosed Markdown code block is not accepted', async () => {
  const f = fixture({ fetch: async () => response('```ccpl\n' + VALID) });
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('connection testing has a bounded timeout', async () => {
  const f = fixture({ timeoutMs: 15, fetch: () => new Promise(() => {}) });
  await f.ai.testConnection();
  assert.match(f.elements.get('ai-test-result').textContent, /超时/);
  assert.equal(f.elements.get('ai-btn-test-conn').disabled, false);
});

test('refine request contains the original script in a proper code block', async () => {
  let payload;
  const f = fixture({ fetch: async (_url, options) => { payload = JSON.parse(options.body); return response(); } });
  f.ai.currentMode = 'refine';
  await f.ai.handleAction();
  assert.ok(payload.messages[1].content.includes('```ccpl\n' + DRAFT + '\n```'));
});

for (const [name, secondIds] of [['all IDs renamed', ['H3', 'H4']], ['one ID renamed', ['H1', 'H3']]]) {
  test(`cross-step identity rejects ${name} despite conserved element counts`, async () => {
    const step = (title, ids) => `step "${title}" {\nhydrogens none\natom ${ids[0]} H 0 0 0\natom ${ids[1]} H 1 0 0\nbond ${ids[0]} ${ids[1]} 1\n}`;
    const script = 'reaction "Identity fixture"\n' + step('first', ['H1', 'H2']) + '\n' + step('second', secondIds);
    const f = fixture({ fetch: async () => response(script) });
    await f.ai.handleAction();
    assert.equal(f.ai.candidate.validation.valid, false);
    assert.match(f.status.textContent, /编号/);
    assert.equal(f.ai.applyToWorkspace(true), false);
    assert.equal(f.editor.value, DRAFT);
    assert.equal(f.app.runs || 0, 0);
  });
}

test('JSON input also rejects replaced atom identities', async () => {
  const atoms = ids => ids.map((id, x) => ({ id, element: 'H', x, y: 0, z: 0 }));
  const script = JSON.stringify({ name: 'Identity JSON', steps: [
    { name: 'first', atoms: atoms(['H1', 'H2']), bonds: [] },
    { name: 'second', atoms: atoms(['H3', 'H4']), bonds: [] }
  ] });
  const f = fixture({ fetch: async () => response(script) });
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, DRAFT);
});

test('reordering the same atoms and changing their bonds remains loadable', async () => {
  const script = 'reaction "Bond change"\nstep "first" {\nhydrogens none\natom H1 H 0 0 0\natom H2 H 1 0 0\nbond H1 H2 1\n}\nstep "second" {\nhydrogens none\natom H2 H 2 0 0 radical\natom H1 H 0 0 0 radical\n}';
  const f = fixture({ fetch: async () => response(script) });
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(false), true);
});

test('automatic correction sends real diagnostics and keeps the draft until explicit load', async () => {
  const payloads = [];
  const f = fixture({ fetch: async (_url, options) => {
    payloads.push(JSON.parse(options.body));
    return response(payloads.length === 1 ? 'invalid CCPL' : VALID);
  } });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(payloads.length, 2);
  assert.match(payloads[1].messages.at(-1).content, /本地工具检查/);
  assert.match(payloads[1].messages.at(-1).content, /未知的全局指令/);
  assert.equal(f.editor.value, DRAFT);
  assert.equal(f.ai.lastTask.repairAttempts, 1);
  assert.equal(f.ai.candidate.validation.valid, true);
  assert.equal(f.ai.applyToWorkspace(false), true);
});

test('automatic correction stops at two additional calls and retains the last failed candidate', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => response('invalid_' + (++calls)) });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 3);
  assert.equal(f.ai.lastTask.repairAttempts, 2);
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.ai.lastGeneratedScript, 'invalid_3');
  assert.equal(f.editor.value, DRAFT);
  assert.match(f.status.textContent, /次数已用完/);
});

test('repeated identical failures stop correction early', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return response('invalid CCPL'); } });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 2);
  assert.match(f.status.textContent, /相同错误/);
});

test('truncation never starts automatic correction', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return response(VALID, 'length'); } });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 1);
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('network or authentication failures do not trigger correction', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return { ok: false, status: 401 }; } });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 1);
  assert.equal(f.ai.lastTask.status, 'failed');
});

test('a manual draft change stops further correction requests', async () => {
  let f, calls = 0;
  f = fixture({ fetch: async () => { calls++; f.editor.value = 'MANUAL'; return response('invalid CCPL'); } });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 1);
  assert.equal(f.editor.value, 'MANUAL');
  assert.match(f.status.textContent, /草稿或机理已变化/);
});

test('cancel during correction stops a hanging transport and releases the interface', async () => {
  let calls = 0, started;
  const ready = new Promise(resolve => { started = resolve; });
  const f = fixture({ fetch: async () => {
    if (++calls === 1) return response('invalid CCPL');
    started(); return new Promise(() => {});
  } });
  f.ai.getRepairLimit = () => 2;
  const pending = f.ai.handleAction();
  await ready;
  f.ai.cancelGeneration();
  await pending;
  assert.equal(calls, 2);
  assert.equal(f.ai.isGenerating, false);
  assert.equal(f.editor.value, DRAFT);
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('all correction attempts share the original task deadline', async () => {
  const budgets = [];
  const f = fixture({ timeoutMs: 60 });
  f.ai.getRepairLimit = () => 2;
  f.ai.callChatApi = async cfg => {
    budgets.push(cfg.timeoutMs);
    if (budgets.length === 1) { await delay(15); return { content: 'invalid', finishReason: 'stop' }; }
    return f.context.ChemiationAISafety.requestCompletion(cfg, []);
  };
  f.context.fetch = () => new Promise(() => {});
  await f.ai.handleAction();
  assert.equal(budgets.length, 2);
  assert.ok(budgets[1] < budgets[0] - 5);
  assert.equal(f.ai.isGenerating, false);
  assert.match(f.status.textContent, /超时/);
});

const EDITING = require('../js/aiEditingTools.js');
const STEP_ONE = 'step "first" {\nnote "preserved"\nhydrogens none\natom H1 H 0 0 0\n}';
const STEP_TWO = 'step "second" {\nnote "original"\nhydrogens none\natom H1 H 1 0 0\n}';
const MULTI = 'reaction "Scoped"\n# preserve comments\n' + STEP_ONE + '\n' + STEP_TWO + '\n# footer\n';
const PATCH = STEP_TWO.replace('original', 'updated');
function scopedFixture(options) {
  const f = fixture(options);
  f.ai.currentMode = 'refine'; f.editor.value = MULTI;
  f.ai.getEditScope = base => EDITING.createScope(base.script, [1]);
  return f;
}

test('a scoped response merges only the selected step and can be undone exactly', async () => {
  let sent;
  const f = scopedFixture({ fetch: async (_url, options) => { sent = JSON.parse(options.body); return response(PATCH); } });
  await f.ai.handleAction();
  assert.match(sent.messages[1].content, /严格只修改 第 2 步/);
  assert.equal(f.ai.candidate.script, MULTI.replace(STEP_TWO, PATCH));
  assert.equal(f.editor.value, MULTI);
  assert.equal(f.ai.applyToWorkspace(false), true);
  assert.equal(f.ai.restoreDraft(), true);
  assert.equal(f.editor.value, MULTI);
});

test('a full rewrite is rejected in scoped mode and can be automatically corrected into a patch', async () => {
  let calls = 0;
  const f = scopedFixture({ fetch: async () => response(++calls === 1 ? MULTI.replace('preserved', 'unwanted') : PATCH) });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 2);
  assert.equal(f.ai.applyToWorkspace(false), true);
  assert.equal(f.editor.value, MULTI.replace(STEP_TWO, PATCH));
});

test('write-time scope verification rejects a later change to an unselected step', async () => {
  const f = scopedFixture({ fetch: async () => response(PATCH) });
  await f.ai.handleAction();
  f.ai.candidate.script = f.ai.candidate.script.replace('preserved', 'tampered');
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, MULTI);
  assert.match(f.status.textContent, /未选中/);
});

test('scoped changes still require full reaction conservation checks', async () => {
  const f = scopedFixture({ fetch: async () => response(PATCH.replace('H1 H', 'H1 O')) });
  await f.ai.handleAction();
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, MULTI);
});

test('no selected step is reported before any model request', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return response(); } });
  f.ai.getEditScope = base => EDITING.createScope(base.script, []);
  await f.ai.handleAction();
  assert.equal(calls, 0);
  assert.match(f.ai.toast.message, /选择/);
});

test('missing local validation cannot spend additional model calls on automatic correction', async () => {
  let calls = 0;
  const f = fixture({ engine: false, fetch: async () => { calls++; return response(); } });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 1);
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('a malformed closed response can be repaired without replacing the original draft', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => response(++calls === 1 ? '```ccpl\n' + VALID : VALID) });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(calls, 2);
  assert.equal(f.ai.candidate.validation.valid, true);
  assert.equal(f.editor.value, DRAFT);
});

test('a late repair response cannot overwrite a newer task', async () => {
  let calls = 0, started, release;
  const ready = new Promise(resolve => { started = resolve; });
  const f = fixture({ fetch: async () => {
    if (++calls === 1) return response('invalid');
    if (calls === 2) { started(); return new Promise(resolve => { release = resolve; }); }
    return response(VALID);
  } });
  f.ai.getRepairLimit = () => 2;
  const old = f.ai.handleAction();
  await ready;
  const current = f.ai.handleAction();
  await Promise.all([old, current]);
  release(response('late invalid repair'));
  await delay(0);
  assert.equal(f.ai.candidate.script, VALID);
  assert.equal(f.ai.lastTask.status, 'ready');
  assert.equal(f.editor.value, DRAFT);
});

test('a scoped JSON patch is validated as a whole reaction and preserves untouched source bytes', async () => {
  const atom = { id: 'H1', element: 'H', x: 0, y: 0, z: 0 };
  const script = JSON.stringify({ name: 'JSON source', summary: 'Keep this', steps: [
    { name: 'one', atoms: [atom], bonds: [] },
    { name: 'two', note: 'old', atoms: [atom], bonds: [] }
  ] }, null, 2);
  const patch = JSON.stringify({ steps: [{ name: 'two', note: 'new', atoms: [atom], bonds: [] }] });
  let sent;
  const f = fixture({ fetch: async (_url, options) => { sent = JSON.parse(options.body); return response(patch); } });
  f.editor.value = script; f.ai.currentMode = 'refine';
  f.ai.getEditScope = base => EDITING.createScope(base.script, [1]);
  await f.ai.handleAction();
  assert.match(sent.messages[0].content, /使用合法 JSON，不要转换为 CCPL/);
  assert.match(sent.messages[1].content, /```json/);
  assert.equal(f.ai.applyToWorkspace(false), true);
  const before = EDITING.documentOf(script), after = EDITING.documentOf(f.editor.value);
  assert.equal(after.steps[0].text, before.steps[0].text);
  assert.equal(JSON.parse(f.editor.value).steps[1].note, 'new');
});

function liveResponse() {
  let control;
  const body = new ReadableStream({ start(controller) { control = controller; } });
  return {
    response: { ok: true, headers: { get: () => 'text/event-stream' }, body },
    send(content, reason = null) {
      control.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: reason }] }) + '\n\n'));
    },
    done() { control.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); },
    close() { control.close(); }
  };
}
function streamUI(f) {
  for (const id of ['ai-stream-progress', 'ai-stream-progress-text', 'ai-preview-title', 'ai-stream-note']) {
    f.elements.set(id, { textContent: '', style: {}, classList: { toggle() {} } });
  }
}

test('stream text appears before completion without parsing or touching the draft', async () => {
  const live = liveResponse();
  const f = fixture({ fetch: async () => live.response }); streamUI(f);
  let parses = 0;
  f.context.ReactionScriptEngine = { parse(script) { parses++; return ReactionScriptEngine.parse(script); } };
  const pending = f.ai.handleAction();
  live.send(VALID.slice(0, 25));
  await delay(0);
  assert.equal(f.elements.get('ai-preview-code').value, VALID.slice(0, 25));
  assert.equal(f.elements.get('ai-btn-apply').disabled, true);
  assert.equal(f.editor.value, DRAFT);
  assert.equal(f.ai.candidate, null);
  assert.equal(parses, 0, 'the parser should never run on an arriving token');
  live.send(VALID.slice(25), 'stop'); live.done();
  await pending;
  assert.equal(parses, 1);
  assert.equal(f.ai.candidate.script, VALID);
  assert.equal(f.ai.candidate.validation.valid, true);
  assert.equal(f.editor.value, DRAFT);
  assert.ok(f.ai.lastTask.firstContentMs >= 0);
  assert.equal(f.ai.lastTask.attempts[0].transport, 'stream');
  assert.equal(f.ai.lastTask.clockTimer, null);
});

test('stream cancellation keeps a copyable partial result but never enables load or correction', async () => {
  const live = liveResponse();
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return live.response; } }); streamUI(f);
  f.ai.getRepairLimit = () => 2;
  const pending = f.ai.handleAction();
  live.send('reaction "partial"'); await delay(0);
  f.ai.cancelGeneration(); await pending;
  assert.equal(calls, 1);
  assert.equal(f.ai.lastGeneratedScript, 'reaction "partial"');
  assert.equal(f.ai.candidate.complete, false);
  assert.equal(f.ai.applyToWorkspace(false), false);
  assert.equal(f.editor.value, DRAFT);
  assert.equal(f.elements.get('ai-btn-copy').disabled, false);
  assert.equal(f.ai.lastTask.previewTimer, null);
  assert.equal(f.ai.lastTask.clockTimer, null);
});

test('a timed-out stream retains already received text and releases its timers', async () => {
  const live = liveResponse();
  const f = fixture({ timeoutMs: 20, fetch: async () => live.response }); streamUI(f);
  const pending = f.ai.handleAction();
  live.send('partial text');
  await pending;
  assert.match(f.status.textContent, /超时/);
  assert.equal(f.ai.lastGeneratedScript, 'partial text');
  assert.equal(f.ai.candidate.complete, false);
  assert.equal(f.ai.isGenerating, false);
  assert.equal(f.ai.lastTask.clockTimer, null);
});

test('a clean stream EOF without finish metadata blocks even a syntactically valid script', async () => {
  const live = liveResponse();
  const f = fixture({ fetch: async () => live.response });
  f.ai.getRepairLimit = () => 2;
  const pending = f.ai.handleAction();
  live.send(VALID); live.close(); await pending;
  assert.equal(f.ai.lastGeneratedScript, VALID);
  assert.equal(f.ai.candidate.complete, false);
  assert.equal(f.ai.lastTask.repairAttempts, 0);
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('a malformed stream keeps earlier text without launching a model correction', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: 'earlier text' } }] }) + '\n\ndata: broken json\n\n'));
    controller.close();
  } });
  const f = fixture({ fetch: async () => ({ ok: true, headers: { get: () => 'text/event-stream' }, body }) });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  assert.equal(f.ai.lastGeneratedScript, 'earlier text');
  assert.equal(f.ai.lastTask.repairAttempts, 0);
  assert.equal(f.ai.applyToWorkspace(false), false);
});

test('automatic correction streams into a fresh preview instead of appending to the failed response', async () => {
  const first = liveResponse(), second = liveResponse();
  let calls = 0, started;
  const ready = new Promise(resolve => { started = resolve; });
  const f = fixture({ fetch: async () => { if (++calls === 1) return first.response; started(); return second.response; } });
  f.ai.getRepairLimit = () => 2;
  const pending = f.ai.handleAction();
  first.send('invalid previous output', 'stop'); first.done();
  await ready;
  second.send(VALID.slice(0, 15)); await delay(0);
  assert.equal(f.elements.get('ai-preview-code').value, VALID.slice(0, 15));
  assert.equal(f.ai.candidate, null);
  assert.equal(f.editor.value, DRAFT);
  second.send(VALID.slice(15), 'stop'); second.done(); await pending;
  assert.equal(calls, 2);
  assert.equal(f.ai.candidate.validation.valid, true);
  assert.equal(f.ai.candidate.script, VALID);
});

test('a selected-step stream is only merged and validated after it finishes', async () => {
  const live = liveResponse();
  const f = scopedFixture({ fetch: async () => live.response });
  const pending = f.ai.handleAction();
  live.send(PATCH.slice(0, 25)); await delay(0);
  assert.equal(f.elements.get('ai-preview-code').value, PATCH.slice(0, 25));
  assert.equal(f.editor.value, MULTI);
  assert.equal(f.ai.candidate, null);
  live.send(PATCH.slice(25), 'stop'); live.done(); await pending;
  assert.equal(f.ai.candidate.script, MULTI.replace(STEP_TWO, PATCH));
  assert.equal(f.ai.applyToWorkspace(false), true);
});

test('late deltas and queued preview updates cannot replace a newer task', async () => {
  const handlers = [];
  const f = fixture(); streamUI(f);
  f.ai.callChatApi = (_cfg, _messages, _signal, options) => new Promise(resolve => { handlers.push({ options, resolve }); });
  const old = f.ai.handleAction();
  handlers[0].options.onDelta({ delta: 'old text' });
  handlers[0].options.onDelta({ delta: ' queued text' });
  const current = f.ai.handleAction();
  handlers[1].options.onDelta({ delta: 'new text' });
  handlers[0].options.onDelta({ delta: 'late stale text' });
  handlers[0].resolve({ content: VALID, finishReason: 'stop' });
  await old; await delay(100);
  assert.equal(f.elements.get('ai-preview-code').value, 'new text');
  assert.equal(f.ai.isGenerating, true);
  handlers[1].resolve({ content: VALID, finishReason: 'stop' }); await current;
  assert.equal(f.ai.candidate.script, VALID);
});

test('JSON fallback reports received characters instead of leaving a zero-character completion', async () => {
  const f = fixture(); streamUI(f);
  await f.ai.handleAction();
  assert.equal(f.ai.lastTask.receivedChars, VALID.length);
  assert.match(f.elements.get('ai-stream-progress-text').textContent, new RegExp(`已收到 ${VALID.length} 字符`));
  assert.equal(f.ai.candidate.validation.valid, true);
});

async function completedHistory(f) {
  await f.ai.lastTask.historyWrite;
  const manager = f.ai.getHistoryManager();
  const entry = await manager.store.get(manager.owner(), f.ai.lastTask.historyRecord.id);
  return { manager, entry };
}
async function chooseHistory(f, versionId) {
  const { manager, entry } = await completedHistory(f);
  manager.record = entry; manager.versionId = versionId || entry.versions.at(-1).id;
  return { manager, entry };
}

test('completed generations persist both their exact input and final result without API credentials', async () => {
  const f = fixture();
  f.ai.getConfig = () => ({ provider: 'mock', model: 'test-model', baseUrl: 'https://offline.invalid', apiKey: 'private-history-key', timeoutMs: 1000 });
  await f.ai.handleAction();
  const { manager, entry } = await completedHistory(f);
  assert.equal(entry.versions[0].script, DRAFT);
  assert.equal(entry.versions[1].script, VALID);
  assert.equal(entry.versions[1].kind, 'generated');
  assert.equal(entry.versions[1].valid, true);
  assert.equal(entry.status, 'ready');
  assert.doesNotMatch(JSON.stringify(await manager.store.export(manager.owner())), /private-history-key|offline.invalid/);
  const reloaded = f.context.ChemiationAIHistory.createStore({ localStorage: f.storage });
  assert.equal((await reloaded.get(manager.owner(), entry.id)).versions[1].script, VALID);
});

test('one history task retains the initial failed output and its corrected version', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => response(++calls === 1 ? 'invalid first' : VALID) });
  f.ai.getRepairLimit = () => 2;
  await f.ai.handleAction();
  const { entry } = await completedHistory(f);
  assert.equal(entry.versions.length, 3);
  assert.equal(entry.versions[1].valid, false);
  assert.equal(entry.versions[2].valid, true);
  assert.equal(entry.repairAttempts, 1);
});

test('cancelled streams archive one partial version and the pre-generation draft', async () => {
  const live = liveResponse(), f = fixture({ fetch: async () => live.response });
  const pending = f.ai.handleAction(); live.send('partial history text'); await delay(0);
  f.ai.cancelGeneration(); await pending;
  const { entry } = await completedHistory(f);
  assert.equal(entry.status, 'cancelled');
  assert.equal(entry.versions.length, 2);
  assert.equal(entry.versions[1].kind, 'fragment');
  assert.equal(entry.versions[1].script, 'partial history text');
});

test('historical restoration is staged, backs up the current draft and supports exact undo', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f);
  const current = DRAFT + '\n# later unsaved work'; f.editor.value = current;
  assert.equal(await manager.prepare(), true);
  assert.equal(f.editor.value, current);
  assert.equal(await manager.restore(), true);
  assert.equal(f.editor.value, VALID);
  assert.equal(f.app.runs || 0, 0);
  const entries = await manager.store.export(manager.owner());
  assert.ok(entries.some(entry => entry.kind === 'snapshot' && entry.versions[0].script === current));
  assert.equal(f.ai.restoreDraft(), true);
  assert.equal(f.editor.value, current);
});

test('history cannot restore a generated result that failed checking or ended incompletely', async () => {
  for (const finish of ['stop', 'length']) {
    const f = fixture({ fetch: async () => response(finish === 'stop' ? 'invalid CCPL' : VALID, finish) });
    await f.ai.handleAction();
    const { manager } = await chooseHistory(f);
    await manager.prepare();
    assert.equal(manager.pending.allowed, false);
    assert.equal(await manager.restore(), false);
    assert.equal(f.editor.value, DRAFT);
  }
});

test('original draft snapshots can be recovered exactly even when the draft contains unfinished edits', async () => {
  const f = fixture(); const unfinished = 'reaction "unfinished'; f.editor.value = unfinished;
  await f.ai.handleAction();
  const { manager } = await chooseHistory(f, 'base');
  f.editor.value = DRAFT;
  await manager.prepare();
  assert.equal(await manager.restore(), true);
  assert.equal(f.editor.value, unfinished);
  assert.equal(f.app.runs || 0, 0);
});

test('manual edits after comparison prevent restoration from replacing the new draft', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  f.editor.value = 'NEW HAND EDIT';
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, 'NEW HAND EDIT');
});

test('switching the target reaction after comparison prevents restoration', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  f.app.presets.push({ id: 'different', name: 'Different' }); f.app.currentReactionIndex = 1;
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, DRAFT);
});

test('history backup failure prevents the restoration write', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  manager.store.put = async () => { throw new Error('quota'); };
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, DRAFT);
});

test('single-undo backup failure also prevents a historical restoration', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  const save = f.storage.setItem;
  f.storage.setItem = (key, value) => { if (key === f.ai.backupStorageKey()) throw new Error('quota'); save(key, value); };
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, DRAFT);
});

test('edits made while the history backup is being saved are never overwritten', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  const put = manager.store.put;
  manager.store.put = async (...args) => { f.editor.value = 'EDIT DURING SAVE'; return put(...args); };
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, 'EDIT DURING SAVE');
});

test('history restoration repeats validation at the actual write boundary', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  const put = manager.store.put;
  manager.store.put = async (...args) => { f.context.ReactionScriptEngine = { parse() { throw new Error('new validation failure'); } }; return put(...args); };
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, DRAFT);
});

test('changing the selected history version invalidates a prepared restoration', async () => {
  const f = fixture(); await f.ai.handleAction();
  const { manager } = await chooseHistory(f); await manager.prepare();
  manager.selectVersion('base');
  assert.equal(await manager.restore(), false);
  assert.equal(f.editor.value, DRAFT);
});

test('manual snapshots save the clicked draft without generating or applying anything', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return response(); } });
  const manager = f.ai.getHistoryManager();
  assert.equal(await manager.snapshot(), true);
  assert.equal(calls, 0);
  const entries = await manager.store.export(manager.owner());
  assert.equal(entries[0].kind, 'snapshot');
  assert.equal(entries[0].versions[0].script, DRAFT);
  assert.equal(f.editor.value, DRAFT);
});

test('account switches cancel active generation and isolate history and the undo backup', async () => {
  const live = liveResponse(), f = fixture({ fetch: async () => live.response });
  f.context.window.currentUser = { id: 'alice' };
  const pending = f.ai.handleAction(); live.send('Alice partial'); await delay(0);
  f.context.window.currentUser = { id: 'bob' }; f.ai.onUserChanged(); await pending;
  await f.ai.lastTask.historyWrite;
  const manager = f.ai.getHistoryManager();
  assert.equal((await manager.store.list('user:alice')).length, 1);
  assert.equal((await manager.store.list('user:bob')).length, 0);
  assert.equal(f.ai.candidate, null);
  assert.equal(f.ai.readDraftBackup(), null);
  assert.equal(f.editor.value, DRAFT);
});

test('generation still finishes when its history cannot be saved', async () => {
  const f = fixture();
  const manager = f.ai.getHistoryManager(); manager.store.put = async () => { throw new Error('storage denied'); };
  await f.ai.handleAction(); await f.ai.lastTask.historyWrite;
  assert.equal(f.ai.candidate.validation.valid, true);
  assert.equal(f.ai.isGenerating, false);
  assert.equal(f.editor.value, DRAFT);
});
