const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('../js/aiStudioCore');
const { fixture, response, VALID, DRAFT } = require('./aiFixture.cjs');
const Workflow = require('../js/aiWorkflow');

test('workflow routes vague generation and modification into one relevant local question', () => {
  const create = Workflow.prepare(null, '帮我生成一个酯化反应', { id: 'task-a' });
  assert.equal(create.kind, 'new'); assert.equal(Workflow.preflight(create).field, 'reaction');
  const edit = Workflow.prepare(null, '优化一下', { id: 'task-b' });
  assert.equal(edit.kind, 'refine'); assert.equal(Workflow.preflight(edit).options.length, 3);
  const complete = Workflow.prepare(null, '为乙酸和乙醇生成酯化反应，使用已明确的酸催化教学条件', { id: 'task-c' });
  assert.equal(Workflow.preflight(complete), null);
  assert.equal(Workflow.classify('为什么这一步会断键？', { scoped: true }), 'explain');
  assert.equal(Workflow.classify('修复当前脚本的错误'), 'fix');
});

test('workflow answers preserve original task, separate conditions and survive storage without configuration', () => {
  let task = Workflow.prepare(null, '生成一个酯化反应', { id: 'task-a' });
  task = Workflow.question(task, { field: 'reaction', question: '具体反应物？' }, 'q1');
  task = Workflow.prepare(task, '乙酸与乙醇，补充回答：希望讲解说明清楚', { replyTo: 'q1', messageId: 'a1' });
  assert.equal(task.kind, 'new'); assert.equal(task.policy, 'free'); assert.equal(task.originalRequest, '生成一个酯化反应');
  assert.equal(Workflow.preflight(task), null);
  task = Workflow.question(task, { question: '哪种条件？' }, 'q2');
  task = Workflow.prepare(task, 'CONDITION_A', { replyTo: 'q2', messageId: 'a2' });
  task = Workflow.question(task, { question: '哪种立体要求？' }, 'q3');
  task = Workflow.prepare(task, 'CONDITION_B', { replyTo: 'q3', messageId: 'a3' });
  assert.equal(task.evidence.length, 3);
  assert.throws(() => Workflow.question(task, { question: '哪种条件？' }, 'again'), /已经回答/);
  const session = Core.create(); session.workflow = { ...task, apiKey: 'must-not-store' };
  session.activeGeneration = { prompt: '继续原请求', refining: false, sourceScript: DRAFT, baseScript: DRAFT, projectId: '', scope: null, userMessageId: 'a3', workflow: task, apiKey: 'must-not-store' };
  const normalized = Core.normalize(JSON.parse(JSON.stringify(session)));
  assert.equal(normalized.workflow.evidence[2].answer, 'CONDITION_B');
  assert.equal(normalized.activeGeneration.workflow.id, task.id); assert.equal(normalized.activeGeneration.sourceScript, DRAFT);
  assert.equal(JSON.stringify(normalized).includes('must-not-store'), false);
  assert.ok(Workflow.instruction(normalized.workflow).includes('CONDITION_A'));
  assert.equal(Workflow.normalize({ kind: 'system' }), null);
});

test('workflow uses latest explicit corrections and resets facts for a new reaction', () => {
  let task = Workflow.prepare(null, '完善当前反应', { id: 'a' });
  task = Workflow.question(task, { field: 'solvent', question: '溶剂？' }, 'q');
  task = Workflow.prepare(task, '使用水', { replyTo: 'q' });
  task = Workflow.prepare(task, '把溶剂改为乙醇');
  assert.equal(task.evidence.length, 1); assert.equal(task.evidence[0].answer, '把溶剂改为乙醇');
  const next = Workflow.prepare(task, '生成另一个反应', { id: 'b' });
  assert.equal(next.id, 'b'); assert.equal(next.evidence.length, 0);
});

test('notes-only edits reject structure, coordinates and renamed steps in CCPL and JSON', () => {
  const before = DRAFT.replace('hydrogens none', 'note "Old note"\nhydrogens none');
  const task = { policy: 'notes' };
  assert.deepEqual(Workflow.validateChanges(task, before, before.replace('Old note', 'New explanation')), []);
  for (const modified of [before.replace(' C 0 0 0', ' C 1 0 0'), before.replace('C1 C', 'C1 O'), before.replace('original', 'renamed')]) assert.equal(Workflow.validateChanges(task, before, modified).length, 1);
  const json = { name: 'JSON', steps: [{ name: 'same', note: 'old', atoms: [{ id: 'C1', element: 'C', x: 0, y: 0, z: 0 }], bonds: [] }] };
  const after = structuredClone(json); after.steps[0].note = 'new';
  assert.deepEqual(Workflow.validateChanges(task, JSON.stringify(json), JSON.stringify(after)), []);
  after.steps[0].atoms[0].charge = 1;
  assert.equal(Workflow.validateChanges(task, JSON.stringify(json), JSON.stringify(after)).length, 1);
});

test('layout-only edits permit positions but protect chemical structure and notes', () => {
  assert.deepEqual(Workflow.validateChanges({ policy: 'layout' }, DRAFT, DRAFT.replace('0 0 0', '1 2 3')), []);
  assert.equal(Workflow.validateChanges({ policy: 'layout' }, DRAFT, DRAFT.replace('C1 C', 'C1 O')).length, 1);
  assert.equal(Workflow.validateChanges({ policy: 'layout' }, DRAFT, DRAFT.replace('original', 'renamed')).length, 1);
});

test('a request to show a core mechanism with a clear layout does not become a layout-only edit', () => {
  for (const options of [{ proposal: true }, { scoped: true }]) {
    const task = Workflow.prepare(null, '请生成苯的硝化完整脚本。本次只展示核心取代过程。苯环布局清晰。', options);
    assert.equal(task.policy, 'free');
  }
  const task = Workflow.prepare(null, '请完善当前机理；本次只展示核心过程，苯环布局清晰。');
  assert.equal(task.policy, 'free');
  for (const prompt of ['只调整空间布局，保持化学结构不变', '仅修改原子坐标', '本轮只允许调整坐标布局', '只调整苯环布局', '只改位置', '仅优化第 2 步的布局', '保持化学结构不变，调整空间布局', '优化布局，不要修改化学键']) {
    assert.equal(Workflow.prepare(null, prompt, { scoped: true }).policy, 'layout', prompt);
  }
});

test('a full mechanism response is not repaired merely because the prompt asks for a clear layout', async () => {
  let calls = 0;
  const prompt = '请完善当前机理；本次只展示核心取代过程。苯环布局清晰。';
  const f = fixture({ fetch: async () => { calls++; return response(VALID); } });
  const task = await f.ai.handleAction({ chat: true, mode: 'refine', prompt, sourceScript: DRAFT, workflow: Workflow.prepare(null, prompt, { proposal: true }) });
  assert.equal(task.status, 'ready'); assert.equal(task.repairAttempts, 0); assert.equal(calls, 1);
  assert.equal(f.editor.value, DRAFT);
});

test('workflow explanations finish without generating a candidate, repairing or asking another question', async () => {
  let calls = 0;
  const f = fixture({ fetch: async () => { calls++; return response('{"type":"explanation","text":"直接说明本步骤的结构变化。"}'); } });
  const task = await f.ai.handleAction({ chat: true, mode: 'refine', prompt: '为什么这一步会这样变化？', workflow: Workflow.prepare(null, '为什么这一步会这样变化？') });
  assert.equal(task.status, 'explained'); assert.equal(calls, 1); assert.equal(task.explanation, '直接说明本步骤的结构变化。');
  assert.equal(f.ai.candidate, null); assert.equal(f.editor.value, DRAFT);
  const wrong = fixture({ fetch: async () => response(VALID) });
  const failed = await wrong.ai.handleAction({ chat: true, mode: 'refine', prompt: '解释一下', workflow: Workflow.prepare(null, '解释一下') });
  assert.equal(failed.status, 'failed'); assert.equal(failed.repairAttempts, 0); assert.equal(wrong.ai.candidate, null);
});

test('a valid but out-of-intent notes edit triggers bounded correction and is checked again before apply', async () => {
  const before = DRAFT.replace('hydrogens none', 'note "Original note"\nhydrogens none');
  const valid = before.replace('Original note', 'Better explanation');
  const invalid = valid.replace('0 0 0', '1 0 0'); let calls = 0, repair;
  const f = fixture({ fetch: async (_url, options) => { calls++; if (calls === 2) repair = JSON.parse(options.body); return response(calls === 1 ? invalid : valid); } });
  f.editor.value = before;
  const task = await f.ai.handleAction({ chat: true, mode: 'refine', prompt: '只修改说明', sourceScript: before, workflow: Workflow.prepare(null, '只修改说明', { scoped: true }) });
  assert.equal(task.status, 'ready'); assert.equal(task.repairAttempts, 1); assert.ok(repair.messages.at(-1).content.includes('受保护'));
  assert.equal(f.editor.value, before);
  f.ai.candidate.script = invalid;
  assert.equal(f.ai.applyToWorkspace(), false); assert.equal(f.editor.value, before);
});

test('conversation contract omits configuration and preserves version lineage', () => {
  const s = Core.create();
  s.apiKey = 'must-not-save'; s.owner = 'forged';
  s.messages.push({ id: Core.id(), role: 'user', text: '<script>example</script>', apiKey: 'must-not-save' });
  s.messages.push({ id: Core.id(), role: 'assistant', text: '请选择条件', question: { question: '请选择条件', options: [{ label: '酸性', value: '酸催化', apiKey: 'must-not-save' }], apiKey: 'must-not-save' } });
  s.versions.push({ id: Core.id(), script: VALID, status: 'accepted', label: 'before', createdAt: new Date().toISOString() });
  s.versions.push({ id: Core.id(), script: VALID, status: 'restored', parentId: s.versions[0].id });
  s.activeVersionId = s.versions[1].id;
  const normalized = Core.normalize(s);
  assert.equal(normalized.versions[1].parentId, normalized.versions[0].id);
  assert.equal(normalized.activeVersionId, s.activeVersionId);
  assert.equal(JSON.stringify(normalized).includes('must-not-save'), false);
  assert.equal('owner' in normalized, false);
  assert.equal(normalized.messages[0].text, '<script>example</script>');
  assert.deepEqual(normalized.messages[1].question.options, [{ label: '酸性', value: '酸催化', description: '' }]);
  assert.equal(Core.metadata(normalized).mechanisms[0].title, 'AI fixture');
  assert.equal(Core.reactionTitle('{"name":"JSON reaction","steps":[]}'), 'JSON reaction');
});
test('invalid IDs, oversized conversations and duplicate records are rejected', () => {
  const s = Core.create();
  assert.throws(() => Core.normalize({ ...s, id: '../private' }));
  assert.throws(() => Core.normalize({ ...s, messages: Array(Core.LIMITS.messages + 1).fill({}) }), /上限/);
  const id = Core.id();
  assert.throws(() => Core.normalize({ ...s, messages: [{ id, role: 'user', text: 'a' }, { id, role: 'assistant', text: 'b' }] }), /重复/);
  assert.throws(() => Core.normalize({ ...s, versions: [{ id, script: 'x'.repeat(Core.LIMITS.script + 1) }] }));
});

test('mechanism projects keep a durable identity, conversation drafts and legacy compatibility', () => {
  const s = Core.create({ id: 'mechanism-a', name: '初始名称' }); s.draft = '尚未发送的修改要求';
  const normalized = Core.normalize({ ...s, projectName: '改名后的机理' });
  assert.equal(normalized.projectId, 'mechanism-a'); assert.equal(normalized.draft, s.draft);
  assert.equal(Core.metadata(normalized).projectName, '改名后的机理');
  const legacy = { ...s }; delete legacy.projectId; delete legacy.projectName; delete legacy.draft;
  assert.equal(Core.normalize(legacy).projectId, '');
  assert.equal(Core.normalize(legacy).draft, '');
  assert.throws(() => Core.normalize({ ...s, projectId: {} }), /项目编号/);
  assert.throws(() => Core.normalize({ ...s, projectId: 'a\nprivate' }), /项目编号/);
});
test('lookup never infers scientific review from a title or similarity match', () => {
  const records = [{ title: 'SN2', script: VALID }, { title: 'SN2', script: VALID + '\n', reviewStatus: 'reviewed' }];
  const exact = Core.match('展示SN2', records);
  assert.equal(exact[0].exact, true); assert.equal(exact[0].reviewed, false);
  assert.equal(exact[1].reviewed, true);
  const altered = Core.match('SN2，改成不同溶剂', records);
  assert.equal(altered[0].exact, false);
  assert.equal(Core.match('完全无关的反应', records).length, 0);
});

test('saved edit boundaries and question drafts round trip without saving runtime/configuration fields', () => {
  const s = Core.create({ id: 'mechanism-a' });
  s.scope = { index: 1, projectId: s.projectId, baseScript: DRAFT, script: VALID, stepName: '第二步', apiKey: 'private-sentinel', target: { reactionIndex: 4 } };
  s.messages.push({ id: 'q1', role: 'assistant', text: '条件？', question: { question: '条件？', options: ['酸催化', '碱催化'] }, answerDraft: { selected: '酸催化', text: '还没发送的补充', apiKey: 'private-sentinel' } });
  const restored = Core.normalize(JSON.parse(JSON.stringify(Core.normalize(s))));
  assert.equal(restored.scope.index, 1); assert.equal(restored.scope.projectId, s.projectId);
  assert.equal(restored.scope.baseScript, DRAFT); assert.equal(restored.scope.script, VALID);
  assert.deepEqual(restored.messages[0].answerDraft, { selected: '酸催化', text: '还没发送的补充' });
  assert.equal(JSON.stringify(restored).includes('private-sentinel'), false);
  assert.equal('target' in restored.scope, false);
  assert.equal(Core.normalize(Core.create()).scope, null);
  s.messages[0].answerDraft.selected = '无效选项'; s.messages[0].answerDraft.text = 'a'.repeat(2100);
  assert.deepEqual(Core.normalize(s).messages[0].answerDraft, { selected: '', text: 'a'.repeat(2000) });
});

test('failed requests retain exact prompt, original source and scope, with bounded diagnostics and fragments', () => {
  const s = Core.create({ id: 'mechanism-a' });
  const scope = { index: 0, projectId: s.projectId, baseScript: DRAFT, script: VALID, stepName: '第一步' };
  s.messages.push({ id: 'failed', role: 'assistant', text: '生成失败',
    retry: { prompt: '只改第一步', refining: true, sourceScript: VALID, baseScript: DRAFT, projectId: s.projectId, scope, userMessageId: 'request-1', apiKey: 'private-sentinel' },
    failure: { status: 'incomplete', detail: 'd'.repeat(5000), fragment: 'f'.repeat(Core.LIMITS.script + 1) } });
  const message = Core.normalize(s).messages[0];
  assert.equal(message.retry.prompt, '只改第一步'); assert.equal(message.retry.sourceScript, VALID);
  assert.deepEqual(message.retry.scope, scope); assert.equal(message.retry.userMessageId, 'request-1');
  assert.equal(message.failure.detail.length, 4000); assert.equal(message.failure.fragment.length, Core.LIMITS.script);
  assert.equal(JSON.stringify(message).includes('private-sentinel'), false);
  assert.throws(() => Core.normalizeScope({ ...scope, index: -1 }), /步骤范围/);
  assert.throws(() => Core.normalizeScope({ ...scope, script: 'x'.repeat(Core.LIMITS.script + 1) }), /步骤范围/);
  assert.throws(() => Core.normalizeRetry({ ...message.retry, sourceScript: null }), /重试/);
});

test('scope reload equivalence ignores only comments and whitespace outside quoted content', () => {
  assert.equal(Core.sameScriptContent('# old heading\n' + DRAFT, '# new heading\n\n' + DRAFT.replace('atom C1', '  atom   C1') + '\n// generated heading'), true);
  assert.equal(Core.sameScriptContent(DRAFT, DRAFT.replace('atom C1 C', 'atom C1 O')), false);
  assert.equal(Core.sameScriptContent(DRAFT, DRAFT.replace('original', 'original changed')), false);
  assert.equal(Core.sameScriptContent(VALID + '\nnote "a # // b"', VALID + '\nnote "a # // c"'), false);
  assert.equal(Core.sameScriptContent(VALID + '\nnote "a  b"', VALID + '\nnote "a b"'), false);
  assert.equal(Core.sameScriptContent(VALID + '\nnote "a \\" # b"', VALID + '\nnote "a \\" # c"'), false);
  assert.equal(Core.sameScriptContent('atom C1 C\nbond C1 C2', 'bond C1 C2\natom C1 C'), false);
});
test('chat questions finish without repair, candidate application or draft replacement', async () => {
  let requests = 0;
  const f = fixture({ fetch: async () => { requests++; return response('{"type":"question","question":"具体底物和溶剂是什么？"}'); } });
  f.context.ChemiationStudioCore = Core;
  const task = await f.ai.handleAction({ chat: true, prompt: '取代反应' });
  assert.equal(task.status, 'question'); assert.match(task.question, /底物/);
  assert.equal(requests, 1); assert.equal(f.editor.value, DRAFT); assert.equal(f.ai.candidate, null);
});

test('question forms keep bounded choices and free answers without inventing conditions', async () => {
  const content = JSON.stringify({ type: 'question', question: '选择底物？', options: ['溴乙烷', { label: '氯乙烷', value: 'CH3CH2Cl', description: '指定结构' }, '溴乙烷', null] });
  const q = Core.questionForm(content);
  assert.equal(q.question, '选择底物？'); assert.equal(q.options.length, 2);
  assert.equal(Core.questionForm('{"type":"question","question":"具体底物？"}').options.length, 0);
  assert.equal(Core.questionForm('{"type":"question","question":""}'), null);
  assert.equal(Core.questionForm(VALID), null);
  assert.equal(Core.normalizeQuestion({ question: 'x'.repeat(5000), options: Array(12).fill('a'.repeat(500)) }).question.length, 4000);
  const f = fixture({ fetch: async () => response(content) }); f.context.ChemiationStudioCore = Core;
  const task = await f.ai.handleAction({ chat: true, prompt: '需要具体底物' });
  assert.equal(task.status, 'question'); assert.deepEqual(task.questionForm, q);
  assert.ok(Core.context([{ role: 'assistant', text: q.question, question: q }])[0].content.includes('CH3CH2Cl'));
});

test('live preview extracts complete CCPL steps and ignores torn blocks and quoted braces', () => {
  assert.equal(Core.completedSteps('step "尚未完成" {\natom C1 C 0 0 0'), null);
  assert.equal(Core.completedSteps('{"type":"question","question":"选择？"}'), null);
  const one = VALID.replace('state', 'brace } in title').replace('hydrogens none', 'note "} and \\"quoted\\""\nhydrogens none');
  const prefix = Core.completedSteps('```ccpl\n' + one + '\nstep "unfinished" {\natom');
  assert.equal(prefix.count, 1); assert.equal(prefix.script, one);
  assert.equal(Core.completedSteps(one + '\nstep "next"\n{\nhydrogens none\natom C1 C 1 0 0\n} // closed').count, 2);
  assert.equal(Core.completedSteps('x'.repeat(Core.LIMITS.script + 1)), null);
});

test('JSON live preview uses only closed step objects and supports selected-step merging', () => {
  const Editing = require('../js/aiEditingTools'), Safety = require('../js/aiTaskSafety'), { ReactionScriptEngine } = require('../index');
  const a = { name: 'quoted } step', atoms: [{ id: 'C1', element: 'C', x: 0, y: 0, z: 0 }], bonds: [] };
  const header = '{"name":"JSON preview","steps":[';
  const first = JSON.stringify(a);
  const prefix = Core.completedSteps(header + first + ',{"name":"torn","atoms":[');
  assert.equal(prefix.count, 1); assert.deepEqual(JSON.parse(prefix.script).steps, [a]);
  assert.equal(Safety.validateScript(prefix.script, ReactionScriptEngine).valid, true);
  const scope = Editing.createScope(VALID + '\nstep "next" {\nhydrogens none\natom C1 C 1 0 0\n}', [1]);
  const patch = Core.completedSteps('step "next" {\nhydrogens none\natom C1 C 2 0 0\n}\nstep "torn" {');
  const merged = Editing.mergeSelected(scope, patch.script);
  assert.equal(Editing.documentOf(merged).steps[0].text, Editing.documentOf(VALID).steps[0].text);
  assert.equal(Safety.validateScript(merged, ReactionScriptEngine).valid, true);
  const invalid = Core.completedSteps(VALID + '\nstep "invalid" {\nhydrogens none\natom C1 O 0 0 0\n}');
  assert.equal(Safety.validateScript(invalid.script, ReactionScriptEngine).valid, false);
});
test('chat defaults to repair and retains conversation context', async () => {
  const calls = [];
  const f = fixture({ fetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return response(calls.length === 1 ? 'not a script' : VALID); } });
  f.context.ChemiationStudioCore = Core;
  const task = await f.ai.handleAction({ chat: true, prompt: '生成', context: [{ role: 'user', content: '采用已明确的条件' }] });
  assert.equal(task.status, 'ready'); assert.equal(task.repairAttempts, 1);
  assert.equal(calls.length, 2); assert.ok(calls[0].messages.some(m => m.content === '采用已明确的条件'));
  assert.equal(f.editor.value, DRAFT);
});

test('chat requests streaming even with an older disabled setting and resets each repair attempt', async () => {
  const calls = [], progress = [];
  const f = fixture({ fetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return response(calls.length === 1 ? 'invalid' : VALID); } });
  const originalConfig = f.ai.getConfig;
  f.ai.getConfig = () => ({ ...originalConfig(), stream: false });
  const task = await f.ai.handleAction({ chat: true, prompt: '完善说明', onProgress: e => progress.push(e) });
  assert.equal(task.status, 'ready'); assert.ok(calls.every(c => c.stream === true));
  assert.deepEqual(progress.filter(e => e.type === 'attempt').map(e => e.repairAttempts), [0, 1]);
});
test('a follow-up can refine a preview without changing the editor or its conflict baseline', async () => {
  let payload;
  const f = fixture({ fetch: async (_url, options) => { payload = JSON.parse(options.body); return response(VALID); } });
  const source = VALID.replace('AI fixture', 'Previous preview');
  const task = await f.ai.handleAction({ chat: true, prompt: '完善说明', mode: 'refine', sourceScript: source });
  assert.equal(task.base.script, DRAFT); assert.equal(f.editor.value, DRAFT);
  assert.ok(payload.messages.at(-1).content.includes(source));
});

function bondedFixture(element, count, charge = 0, order = 1) {
  const atoms = [{ id: 'Center', element, charge, x: 0, y: 0, z: 0 }];
  const bonds = [];
  for (let i = 0; i < count; i++) {
    atoms.push({ id: 'H' + i, element: 'H', x: i + 1, y: 1, z: 0 });
    bonds.push({ atom1Id: 'Center', atom2Id: 'H' + i, order });
  }
  return { name: 'Valence test', steps: [{ name: 'State', atoms, bonds, hydrogensMode: 'none' }] };
}

test('ordinary impossible covalent states are rejected with step and atom diagnostics', () => {
  const Safety = require('../js/aiTaskSafety');
  for (const [element, count, charge] of [['C', 5, 0], ['H', 2, 0], ['N', 4, 0], ['N', 3, -1], ['O', 3, 0], ['O', 2, -1], ['F', 2, 0]]) {
    const result = Safety.validateParsed(bondedFixture(element, count, charge));
    assert.equal(result.valid, false, element + ':' + charge);
    assert.match(result.diagnostics[0], /第 1 步原子 Center/); assert.match(result.diagnostics[0], /键级总和/);
  }
});

test('common ions, radicals and underspecified atoms are not filled in or rejected for missing bonds', () => {
  const Safety = require('../js/aiTaskSafety');
  for (const [element, count, charge] of [['C', 4, 0], ['C', 3, 1], ['C', 0, 0], ['N', 4, 1], ['O', 3, 1], ['O', 1, -1], ['H', 0, 1]]) {
    const value = bondedFixture(element, count, charge), before = JSON.stringify(value);
    assert.equal(Safety.validateParsed(value).valid, true, element + ':' + charge);
    assert.equal(JSON.stringify(value), before);
  }
  const radical = bondedFixture('C', 3); radical.steps[0].atoms[0].radical = true;
  assert.equal(Safety.validateParsed(radical).valid, true);
});

test('fused aromatic carbon and metal coordination retain explicit review boundaries', () => {
  const Safety = require('../js/aiTaskSafety');
  const fused = bondedFixture('C', 3, 0, 1.5);
  fused.steps[0].atoms.slice(1).forEach(a => { a.element = 'C'; });
  assert.equal(Safety.validateParsed(fused).valid, true);
  fused.steps[0].atoms.push({ id: 'ExtraH', element: 'H', x: 0, y: 0, z: 2 });
  fused.steps[0].bonds.push({ atom1Id: 'Center', atom2Id: 'ExtraH', order: 1 });
  assert.equal(Safety.validateParsed(fused).valid, false);
  const coordination = bondedFixture('O', 3); coordination.steps[0].atoms[3].element = 'Fe';
  const result = Safety.validateParsed(coordination);
  assert.equal(result.valid, true); assert.ok(result.warnings.some(w => w.includes('配位')));
});

test('CCPL and JSON pass through the same valence check and automatic correction', async () => {
  const { ReactionScriptEngine } = require('../index'), Safety = require('../js/aiTaskSafety');
  const bad = bondedFixture('C', 5), json = JSON.stringify(bad), ccpl = ReactionScriptEngine.serialize(bad);
  assert.equal(Safety.validateScript(json, ReactionScriptEngine).valid, false);
  assert.equal(Safety.validateScript(ccpl, ReactionScriptEngine).valid, false);
  const sent = [];
  const f = fixture({ fetch: async (_url, options) => { sent.push(JSON.parse(options.body)); return response(sent.length === 1 ? ccpl : VALID); } });
  const task = await f.ai.handleAction({ chat: true, prompt: 'Generate a valid reaction' });
  assert.equal(task.status, 'ready'); assert.equal(task.repairAttempts, 1);
  assert.ok(sent[1].messages.at(-1).content.includes('Center')); assert.ok(sent[1].messages.at(-1).content.includes('键级总和'));
  assert.equal(f.editor.value, DRAFT);
});

test('long chat context retains original requirements and earlier answered conditions in chronological order', () => {
  const question = { id: 'q1', role: 'assistant', text: 'Which solvent?', question: { options: [{ label: 'Water', value: 'H2O' }] } };
  const messages = [{ id: 'initial', role: 'user', text: 'INITIAL_SUBSTRATE keep atom IDs' }, question,
    { id: 'a1', role: 'user', text: 'Use water', replyTo: 'q1' },
    ...Array.from({ length: 22 }, (_, i) => ({ id: 'm' + i, role: i % 2 ? 'user' : 'assistant', text: 'Later discussion ' + i })),
    { id: 'change', role: 'user', text: 'Latest instruction: use ethanol instead' }];
  const result = Core.contextPlan(messages), text = JSON.stringify(result.messages);
  assert.ok(text.includes('INITIAL_SUBSTRATE')); assert.ok(text.includes('Use water')); assert.ok(text.includes('H2O'));
  assert.ok(text.indexOf('Use water') < text.indexOf('Latest instruction'));
  assert.deepEqual(result.messages, Core.context(messages));
  assert.ok(result.omitted > 0); assert.equal(result.initialOmitted, false);
});

test('context budgets keep whole messages and flag omitted history rather than inventing a summary', () => {
  const messages = Array.from({ length: 80 }, (_, i) => ({ id: 'm' + i, role: i % 2 ? 'assistant' : 'user', text: 'MARKER_' + i + ' ' + 'x'.repeat(2000) }));
  const result = Core.contextPlan(messages);
  assert.ok(result.characters <= 20000); assert.ok(result.messages.length <= 32); assert.ok(result.omitted > 0);
  assert.ok(result.messages.some(m => m.content === messages[0].text));
  assert.ok(result.messages.some(m => m.content === messages.at(-1).text));
  assert.ok(result.messages.every(m => messages.some(original => original.role === m.role && original.text === m.content)));
  assert.deepEqual(Core.context([]), []);
});

test('the model is told about missing context and latest explicit user changes', async () => {
  let payload;
  const f = fixture({ fetch: async (_url, options) => { payload = JSON.parse(options.body); return response(VALID); } });
  await f.ai.handleAction({ chat: true, prompt: 'Continue', context: Core.context([{ role: 'user', text: 'Original substrate' }]), contextReport: { omitted: 20, initialOmitted: false } });
  assert.ok(payload.messages[0].content.includes('20 条较早记录未附带'));
  assert.ok(payload.messages[0].content.includes('最新的明确要求为准'));
  assert.ok(payload.messages.some(m => m.role === 'user' && m.content === 'Original substrate'));
});

function lookupFixture() {
  const vm = require('node:vm');
  const root = { ChemiationStudioCore: Core, reactionApp: { presets: [] }, api: { getToken: () => 'old-token' } };
  const requests = [];
  const context = { window: root, document: {}, AbortController, setTimeout, clearTimeout,
    ChemiationAISafety: require('../js/aiTaskSafety'), ReactionScriptEngine: require('../index').ReactionScriptEngine,
    API_CONFIG: { baseUrl: 'https://offline.invalid' },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ items: [] }) }; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiStudio.js'), 'utf8'), context);
  const studio = root.chemiationStudio;
  let owner = 'first-account'; studio.owner = () => owner;
  studio.session = { id: 'chat-a', versions: [] }; studio.store = { list: async () => [], get: async () => null };
  return { studio, root, requests, context, changeOwner: value => { owner = value; } };
}

test('changing accounts during slow local lookup cannot send the previous prompt under the new account', async () => {
  const f = lookupFixture(); let release;
  f.studio.store.list = () => new Promise(resolve => { release = resolve; });
  const pending = f.studio.lookup('PRIVATE_PREVIOUS_ACCOUNT_PROMPT');
  f.changeOwner('new-account'); f.root.api.getToken = () => 'new-token'; release([]);
  assert.deepEqual(Array.from(await pending), []); assert.equal(f.requests.length, 0);
});

test('cancelled lookup settles before IndexedDB and ignores its late response', async () => {
  const f = lookupFixture(); let release;
  f.studio.store.list = () => new Promise(resolve => { release = resolve; });
  const pending = f.studio.lookup('private'); f.studio.cancelLookup();
  const result = await Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('cancel did not settle')), 100))]);
  assert.equal(result.length, 0); release([]); await Promise.resolve(); assert.equal(f.requests.length, 0);
});

test('lookup deadline includes a stuck local history store and still returns local presets', async () => {
  const f = lookupFixture();
  // Shorten only this test's lookup timer; the production budget remains 1600 ms.
  f.context.setTimeout = (callback, ms) => setTimeout(callback, ms === 1600 ? 15 : ms);
  f.studio.store.list = () => new Promise(() => {});
  const parsed = require('../index').ReactionScriptEngine.parse(VALID); f.root.reactionApp.presets = [parsed];
  const result = await f.studio.lookup('AI fixture');
  assert.equal(result.length, 1); assert.equal(f.requests.length, 0);
});

test('account-owned conversation API: revisions, isolation, persistence and private lookup', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chemiation-studio-test-'));
  process.env.CHEMIATION_DATA_DIR = dir; process.env.NODE_ENV = 'test';
  const db = require('../server/db');
  const server = require('../server/server');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (route, method = 'GET', token = '', body) => {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const register = async username => (await request('/api/auth/register', 'POST', '', { username, password: 'Studio123!abcd' })).body;
  const a = await register('studio_a'), b = await register('studio_b');
  assert.ok(a.token); assert.ok(b.token);
  const session = Core.create(), route = '/api/studio/sessions/' + session.id;
  session.messages.push({ id: Core.id(), role: 'user', text: 'private chat' });
  const formMessage = { id: Core.id(), role: 'assistant', text: '选择条件', question: { question: '选择条件', options: [{ label: '酸催化', value: '使用酸催化条件', description: '由用户确定' }] } };
  session.messages.push(formMessage, { id: Core.id(), role: 'user', text: '我补充反应物', replyTo: formMessage.id });
  session.versions.push({ id: Core.id(), label: 'draft', script: VALID, status: 'accepted' });
  session.apiKey = 'secret-must-not-persist';
  assert.equal((await request(route, 'PUT', '', { session, expectedRevision: 0 })).status, 401);
  const saved = await request(route, 'PUT', a.token, { session, expectedRevision: 0 });
  assert.equal(saved.status, 200); assert.equal(saved.body.session.revision, 1);
  const fetched = (await request(route, 'GET', a.token)).body.session;
  assert.deepEqual(fetched.messages[1].question, formMessage.question);
  assert.equal(fetched.messages[2].replyTo, formMessage.id);
  assert.equal(JSON.stringify(saved.body).includes('secret-must-not-persist'), false);
  assert.equal((await request(route, 'GET', b.token)).status, 404);
  assert.equal((await request('/api/studio/sessions', 'GET', b.token)).body.items.length, 0);
  assert.equal((await request(route, 'PUT', a.token, { session, expectedRevision: 0 })).status, 409);
  const updated = await request(route, 'PUT', a.token, { session: { ...session, title: 'updated' }, expectedRevision: 1 });
  assert.equal(updated.body.session.revision, 2);
  assert.equal((await request('/api/studio/sessions', 'GET', a.token)).body.items[0].title, 'updated');
  const historyQuery = '/api/studio/matches?q=AI%20fixture';
  assert.equal((await request(historyQuery)).body.items.length, 0);
  assert.equal((await request(historyQuery, 'GET', b.token)).body.items.length, 0);
  assert.equal((await request(historyQuery, 'GET', a.token)).body.items[0].source, '历史对话的已保留版本');
  const huge = { ...session, versions: Array(41).fill(session.versions[0]) };
  assert.equal((await request(route, 'PUT', a.token, { session: huge, expectedRevision: 2 })).status, 413);
  assert.equal((await request(route, 'GET', a.token)).body.session.revision, 2);
  const projects = [Core.create({ id: 'mechanism-a', name: '项目 A' }), Core.create({ id: 'mechanism-a', name: '项目 A' }), Core.create({ id: 'mechanism-b', name: '项目 B' })];
  for (const item of projects) assert.equal((await request('/api/studio/sessions/' + item.id, 'PUT', a.token, { session: item, expectedRevision: 0 })).status, 200);
  const projectPage = (await request('/api/studio/sessions?projectId=mechanism-a&limit=1', 'GET', a.token)).body;
  assert.equal(projectPage.items.length, 1); assert.equal(projectPage.nextOffset, 1);
  assert.equal(projectPage.items[0].projectId, 'mechanism-a');
  const nextProjectPage = (await request('/api/studio/sessions?projectId=mechanism-a&limit=1&offset=1', 'GET', a.token)).body;
  assert.equal(nextProjectPage.items[0].projectId, 'mechanism-a'); assert.equal(nextProjectPage.nextOffset, null);
  assert.notEqual(nextProjectPage.items[0].id, projectPage.items[0].id);
  assert.equal((await request('/api/studio/sessions?projectId=mechanism-a', 'GET', b.token)).body.items.length, 0);
  assert.deepEqual((await request('/api/studio/sessions?projectId=', 'GET', a.token)).body.items.map(v => v.id), [session.id]);
  const move = await request('/api/studio/sessions/' + projects[0].id, 'PUT', a.token, { session: { ...projects[0], projectId: 'mechanism-b' }, expectedRevision: 1 });
  assert.equal(move.status, 409); assert.equal((await request('/api/studio/sessions/' + projects[0].id, 'GET', a.token)).body.session.projectId, 'mechanism-a');
  assert.ok([403, 404].includes((await request('/api/studio/sessions/../private', 'GET', a.token)).status));
  db.createReaction({ userId: a.user.id, title: 'UniquePrivateSN2', script: VALID, isPublic: false });
  const query = '/api/studio/matches?q=UniquePrivateSN2';
  assert.equal((await request(query)).body.items.length, 0);
  assert.equal((await request(query, 'GET', b.token)).body.items.length, 0);
  assert.equal((await request(query, 'GET', a.token)).body.items.length, 1);
  delete require.cache[require.resolve('../server/studioStore')];
  assert.equal((await require('../server/studioStore').get(a.user.id, session.id)).revision, 2);
  assert.equal((await request(route, 'DELETE', b.token)).status, 200);
  assert.equal((await request(route, 'GET', a.token)).status, 200);
  assert.equal((await request(route, 'DELETE', a.token)).status, 200);
  assert.equal((await request(route, 'GET', a.token)).status, 404);
});

test('cloud adapter uses atomic revisions, preserves empty arrays and surfaces failures', async () => {
  const adapter = require('../server/upstashAdapter');
  const store = require('../server/studioStore');
  const previous = { execute: adapter.execute, configured: adapter.isConfigured, env: process.env.NODE_ENV };
  const saved = new Map(), metadata = new Map(), commands = [];
  adapter.isConfigured = () => true; process.env.NODE_ENV = 'production';
  adapter.execute = async command => {
    commands.push(command);
    if (command[0] === 'HGET') return saved.get(command[2]) || null;
    if (command[0] === 'HVALS') return [...metadata.values()];
    if (command[0] === 'ZREVRANGE') return [...metadata.keys()];
    if (command[0] === 'HMGET') { assert.ok(command[1].endsWith(':metadata')); return command.slice(2).map(id => metadata.get(id)); }
    if (command[0] === 'EVAL') {
      const [, source, keyCount] = command;
      const [id, revision, encoded, , meta, project] = command.slice(3 + keyCount);
      assert.equal(source.includes('cjson.encode'), false);
      const old = saved.get(id);
      if ((old ? JSON.parse(old).revision : 0) !== revision) return -1;
      if (old && (JSON.parse(old).projectId || '') !== project) return -3;
      saved.set(id, encoded); metadata.set(id, meta); return encoded;
    }
    throw new Error('Unexpected Redis command');
  };
  try {
    const session = Core.create({ id: 'cloud-project-a', name: '云端项目 A' });
    const results = await Promise.allSettled([store.save('owner', session.id, session, 0), store.save('owner', session.id, session, 0)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.statusCode, 409);
    const loaded = await store.get('owner', session.id);
    assert.deepEqual(loaded.messages, []); assert.deepEqual(loaded.versions, []);
    assert.equal(loaded.revision, 1);
    const index = await store.list('owner');
    assert.equal(index.items[0].id, session.id); assert.equal('versions' in index.items[0], false);
    const withVersion = { ...loaded, versions: [{ id: Core.id(), label: 'accepted', script: VALID, status: 'accepted' }] };
    await store.save('owner', session.id, withVersion, 1);
    assert.equal((await store.list('owner', 0, 20, 'cloud-project-a')).items[0].projectId, 'cloud-project-a');
    assert.equal((await store.list('owner', 0, 20, 'cloud-project-b')).items.length, 0);
    await assert.rejects(store.save('owner', session.id, { ...withVersion, projectId: 'cloud-project-b' }, 2), e => e.statusCode === 409);
    const matches = await store.findMechanisms('owner', 'AI fixture');
    assert.equal(matches[0].script, VALID); assert.equal(matches[0].reviewStatus, 'unreviewed');
    assert.ok(commands.some(c => c[0] === 'EVAL'));
    adapter.execute = async () => { throw new Error('cloud unavailable'); };
    await assert.rejects(store.save('owner', session.id, session, 1), /cloud unavailable/);
  } finally { adapter.execute = previous.execute; adapter.isConfigured = previous.configured; process.env.NODE_ENV = previous.env; }
});
