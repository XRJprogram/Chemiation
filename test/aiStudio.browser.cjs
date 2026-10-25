/* Real browser + temporary local server. Model responses are fixtures, never a paid API. */
const { chromium } = require(process.env.CHEMIATION_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
process.env.CHEMIATION_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chemiation-studio-browser-'));
process.env.NODE_ENV = 'test';
const server = require('../server/server');
const Core = require('../js/aiStudioCore');
const responses = [], requests = [];
const model = http.createServer((req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers); res.end(); return; }
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    requests.push(JSON.parse(body)); const fixture = responses.shift();
    if (!fixture) { res.writeHead(500, headers); res.end(); return; }
    if (fixture.hang) { res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream' }); res.write(': waiting\n\n'); return; }
    res.writeHead(200, { ...headers, 'Content-Type': 'text/event-stream' });
    const chunks = fixture.chunks || fixture.text.match(/[\s\S]{1,160}/g) || ['']; let i = 0;
    const timer = setInterval(() => {
      if (i < chunks.length) res.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: chunks[i++] }, finish_reason: null }] }) + '\n\n');
      else { clearInterval(timer); res.end('data: ' + JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: fixture.finish || 'stop' }] }) + '\n\ndata: [DONE]\n\n'); }
    }, fixture.delay || 30);
    res.on('close', () => clearInterval(timer));
  });
});
const passed = [];
const note = text => { passed.push(text); console.log('PASS', text); };
async function screenshot(page, name) {
  if (!process.env.CHEMIATION_SCREENSHOTS) return;
  fs.mkdirSync(process.env.CHEMIATION_SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(process.env.CHEMIATION_SCREENSHOTS, name + '.png') });
}
async function tool(page, id) {
  if (await page.locator('#studio-tools-menu').isHidden()) await page.locator('#studio-more').click();
  await page.locator('#' + id).click();
}
async function choose(page, id, value) {
  if (await page.locator('#studio-project-panel').isHidden()) await page.locator('#studio-project-toggle').click();
  await page.locator('#' + id).selectOption(value);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port, modelUrl = 'http://127.0.0.1:' + model.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHEMIATION_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://**/*', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => chemiationStudio.session && !chemiationStudio.loading && reactionApp.activeTab === 'chat');
    const columns = await page.evaluate(() => {
      const canvas = document.querySelector('.viewport-wrapper').getBoundingClientRect();
      const workspace = document.getElementById('workspace-sidebar').getBoundingClientRect();
      return { canvasRight: canvas.right, workspaceLeft: workspace.left,
        tabs: [...document.querySelectorAll('.workspace-tabs > button')].map(b => b.id),
        embedded: document.getElementById('workspace-sidebar').contains(document.getElementById('tab-pane-chat')),
        standalone: !!document.getElementById('ai-chat-sidebar') };
    });
    assert.ok(columns.canvasRight <= columns.workspaceLeft + 1);
    assert.equal(columns.embedded, true); assert.equal(columns.standalone, false);
    assert.deepEqual(columns.tabs, ['tab-btn-steps', 'tab-btn-script', 'tab-btn-chat']);
    await page.locator('#tab-btn-steps').click(); await page.locator('#studio-form').waitFor({ state: 'hidden' });
    await page.locator('#tab-btn-script').click(); await page.locator('#script-editor').waitFor({ state: 'visible' });
    await page.locator('#btn-fullscreen-script').click();
    assert.ok((await page.locator('#script-editor').boundingBox()).width > 1000);
    await page.keyboard.press('Escape');
    await page.locator('#tab-btn-chat').click();
    await page.locator('#studio-input').waitFor({ state: 'visible' });
    note('AI chat is a module after the CCPL tab, inside the existing workspace');
    assert.equal(await page.locator('.workspace-header').isVisible(), false);
    const compactHeight = await page.evaluate(() => document.querySelector('.workspace-tabs').getBoundingClientRect().height + document.querySelector('.studio-projectbar').getBoundingClientRect().height);
    assert.ok(compactHeight <= 100, 'compact navigation leaves room for conversation');
    await page.locator('#studio-project-toggle').click();
    assert.equal(await page.locator('#studio-project-toggle').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#studio-project-panel').isVisible(), false);
    assert.equal(await page.locator('#studio-project-toggle').evaluate(el => el === document.activeElement), true);
    await page.locator('#studio-more').click();
    await page.locator('#studio-input').click();
    assert.equal(await page.locator('#studio-tools-menu').isVisible(), false);
    await page.locator('#studio-project-toggle').click();
    await page.locator('#tab-btn-script').click();
    await page.locator('#tab-btn-chat').click();
    assert.equal(await page.locator('#studio-project-panel').isVisible(), false);
    note('compact navigation preserves tools; popovers close on Escape, outside focus and tab switching');
    const renameBaseline = await page.locator('#script-editor').inputValue();
    const firstTitle = await page.evaluate(() => chemiationStudio.session.title);
    await page.locator('#studio-input').fill('重命名时保留这份未发送草稿');
    await tool(page, 'studio-rename');
    await page.locator('#studio-rename-input').fill('取消后不应采用的名称');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => chemiationStudio.session.title), firstTitle);
    await page.locator('#studio-project-toggle').click();
    await page.locator('#studio-open-rename').click();
    await page.locator('#studio-rename-input').fill('视觉统一体验 · 对话改名');
    await page.locator('#studio-rename-save').click();
    await page.waitForFunction(() => !chemiationStudio.committing && chemiationStudio.session.title === '视觉统一体验 · 对话改名');
    assert.equal(await page.locator('#studio-session-name').textContent(), '视觉统一体验 · 对话改名');
    assert.equal(await page.locator('#studio-input').inputValue(), '重命名时保留这份未发送草稿');
    assert.equal(await page.locator('#script-editor').inputValue(), renameBaseline);
    await page.reload(); await page.waitForFunction(() => chemiationStudio.session && !chemiationStudio.loading);
    assert.equal(await page.locator('#studio-session-name').textContent(), '视觉统一体验 · 对话改名');
    assert.equal(await page.locator('#studio-input').inputValue(), '重命名时保留这份未发送草稿');
    await tool(page, 'studio-rename');
    await page.locator('#studio-rename-input').fill('   '); await page.locator('#studio-rename-save').click();
    assert.equal(await page.evaluate(() => chemiationStudio.session.title), '视觉统一体验 · 对话改名');
    await page.locator('#studio-rename-cancel').click();
    await page.locator('#studio-input').fill('');
    note('direct rename supports menu and project entries, cancellation and reload without changing the script or unfinished chat draft');
    const original = await page.locator('#script-editor').inputValue();
    const blocks = await page.evaluate(() => ChemiationAIEditing.documentOf(reactionApp.scriptEditor.value).steps.map(s => s.text));
    await page.evaluate(url => aiAssistant.saveConfig({ provider: 'custom', baseUrl: url + '/v1', apiKey: 'dummy-browser-test', model: 'fixture' }), modelUrl);
    await page.locator('[data-studio-prompt]').first().click();
    await page.getByRole('button', { name: '预览已有机理' }).first().click();
    await page.locator('#studio-candidate').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#script-editor').inputValue(), original);
    assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), true);
    assert.equal(requests.length, 0); note('existing mechanism lookup previews without a model call or editor mutation');
    await page.locator('#studio-discard').click();

    await page.locator('#studio-refine-step').click();
    responses.push({ text: JSON.stringify({ type: 'question', question: '希望这一步重点解释电子转移，还是空间构型？', options: [{ label: '电子转移', value: '解释电子转移过程', description: '说明键的断裂与形成' }, { label: '空间构型', value: '解释空间构型变化' }] }) });
    await page.locator('#studio-input').fill('先问我一个问题，再完善本步'); await page.locator('#studio-send').click();
    await page.getByText('希望这一步重点解释电子转移，还是空间构型？', { exact: true }).waitFor();
    assert.equal(requests.length, 1); assert.equal(await page.locator('#script-editor').inputValue(), original);
    await page.reload(); await page.waitForFunction(() => chemiationStudio.session && !chemiationStudio.loading);
    const question = page.locator('.studio-question').last();
    assert.equal(await question.locator('input[type=radio]').count(), 2);
    assert.equal(await question.locator('button[type=submit]').isDisabled(), true);
    assert.equal(await page.locator('#studio-form').isVisible(), false);
    await page.locator('#studio-write-message').click(); await page.locator('#studio-input').waitFor({ state: 'visible' });
    await page.locator('#studio-write-message').click(); assert.equal(await page.locator('#studio-form').isVisible(), false);
    assert.equal(await page.evaluate(() => chemiationStudio.scope?.index), 0);
    assert.ok(await page.locator('#studio-scope-tag').isVisible());
    await question.getByText('电子转移', { exact: true }).click();
    await question.locator('textarea').fill('重点解释电子转移，只修改说明');
    assert.equal(await question.locator('button[type=submit]').isEnabled(), true);
    const questionChat = await page.evaluate(async () => { await chemiationStudio.localQueue; return chemiationStudio.session.id; });
    await page.reload(); await page.waitForFunction(id => chemiationStudio.session?.id === id && !chemiationStudio.loading, questionChat);
    assert.equal(await question.locator('input:checked').inputValue(), '解释电子转移过程');
    assert.equal(await question.locator('textarea').inputValue(), '重点解释电子转移，只修改说明');
    assert.equal(await page.evaluate(() => chemiationStudio.scope?.index), 0);
    await page.locator('#studio-new').click();
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id !== id, questionChat);
    assert.equal(await page.evaluate(() => chemiationStudio.scope), null);
    await choose(page, 'studio-session-select', questionChat);
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, questionChat);
    assert.equal(await question.locator('textarea').inputValue(), '重点解释电子转移，只修改说明');
    assert.equal(await question.locator('input:checked').inputValue(), '解释电子转移过程');
    assert.equal(await page.evaluate(() => chemiationStudio.scope?.index), 0);
    await screenshot(page, '01-问题选项与自由回答');
    note('step scope, selected option and unfinished free answer survive reload and switching sibling chats');

    const edited = blocks[0].replace(/note\s+"[^"\n]*"/, 'note "浏览器测试：补充本步说明，保持结构与其他步骤不变"');
    responses.push({ text: 'invalid script' }, { text: edited });
    await question.locator('button[type=submit]').click();
    await page.waitForFunction(() => document.getElementById('studio-stream-code').textContent.includes('step'));
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    const changed = await page.evaluate(() => ({ source: chemiationStudio.proposal.script, step: chemiationStudio.scope.index, corrections: aiAssistant.lastTask.repairAttempts }));
    assert.equal(changed.corrections, 1); assert.equal(changed.step, 0);
    const changedBlocks = await page.evaluate(() => ChemiationAIEditing.documentOf(chemiationStudio.proposal.script).steps.map(s => s.text));
    assert.equal(changedBlocks[0], edited); assert.deepEqual(changedBlocks.slice(1), blocks.slice(1));
    assert.equal(await page.locator('#script-editor').inputValue(), original);
    assert.ok(requests.at(-1).messages.some(m => m.content.includes('解释电子转移过程') && m.content.includes('补充回答')));
    assert.equal(await question.locator('textarea').isDisabled(), true); note('form answers reach the model once; repair preserves every unselected step');
    await page.locator('#studio-before').click(); assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), false);
    await page.locator('#studio-before').click(); assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), true);
    await page.locator('#studio-keep').click();
    await page.waitForFunction(() => !chemiationStudio.proposal && chemiationStudio.session.activeVersionId);
    assert.equal(await page.locator('#script-editor').inputValue(), changed.source); note('keep commits script and animation, preserving the original as a separate version');

    const conversationId = await page.evaluate(() => chemiationStudio.session.id);
    await page.reload(); await page.waitForFunction(id => chemiationStudio.session?.id === id && !chemiationStudio.loading, conversationId);
    assert.ok(await page.locator('.studio-message.user').filter({ hasText: '重点解释电子转移，只修改说明' }).count());
    await tool(page, 'studio-history');
    await page.waitForFunction(() => document.getElementById('studio-library-status').textContent !== '正在读取已保存的会话…');
    const baseline = page.locator('#studio-versions .studio-history-row').filter({ hasText: '修改前的原始草稿' });
    await baseline.getByRole('button', { name: '预览', exact: true }).click();
    await page.locator('#studio-keep').click(); await page.waitForFunction(() => !chemiationStudio.proposal);
    assert.equal(await page.locator('#script-editor').inputValue(), original);
    assert.equal(await page.evaluate(() => chemiationStudio.session.versions.at(-1).status), 'restored'); note('reload restores chat; restoring a script creates a new recovery record');

    const complete = original.replace('乙酸与乙醇费歇尔酯化反应', '截断的测试结果');
    responses.push({ text: complete, finish: 'length', delay: 1 });
    await page.locator('#studio-input').fill('完善当前脚本'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy);
    assert.equal(await page.evaluate(() => chemiationStudio.proposal), null);
    assert.equal(await page.locator('#script-editor').inputValue(), original); note('truncated output cannot update the canvas or overwrite a script');

    responses.push({ hang: true });
    await page.locator('#studio-input').fill('完善当前脚本的说明'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => aiAssistant.isGenerating); await page.locator('#studio-cancel').click();
    await page.waitForFunction(() => !chemiationStudio.busy);
    assert.equal(await page.locator('#script-editor').inputValue(), original); note('stop cancels an open stream and unlocks the composer');

    const liveFirst = await page.evaluate(script => {
      const first = ChemiationAIEditing.documentOf(script).steps[0];
      return script.slice(0, first.end).replace('乙酸与乙醇费歇尔酯化反应', '实时预览 · 酯化反应');
    }, original);
    const liveSecond = '\n' + blocks[1];
    const secondSplit = liveSecond.indexOf('\n', 1) + 1;
    responses.push({ chunks: [liveFirst + liveSecond.slice(0, secondSplit), liveSecond.slice(secondSplit)], delay: 900 });
    await page.locator('#studio-input').fill('展示实时模型测试反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => chemiationStudio.busy && chemiationStudio.livePreview?.steps.length === 1);
    assert.equal(await page.locator('#script-editor').inputValue(), original);
    assert.equal(await page.evaluate(() => reactionApp.studioPreview.reaction.steps.length), 1);
    assert.ok(await page.locator('#studio-canvas-status').isVisible());
    await page.waitForFunction(() => chemiationStudio.busy && chemiationStudio.livePreview?.steps.length === 2);
    assert.equal(await page.evaluate(() => reactionApp.currentStepIndex), 1);
    await screenshot(page, '02-生成中左侧实时预览');
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    await page.locator('#studio-discard').click(); note('canvas updates complete steps before model completion and never renders a torn step');

    responses.push({ chunks: [liveFirst, '\nstep "无效状态" {\nhydrogens none\natom Changed O 0 0 0\n}'], delay: 650 }, { chunks: [liveFirst, liveSecond], delay: 650 });
    await page.locator('#studio-input').fill('演示自动纠错模型测试反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => chemiationStudio.busy && !!chemiationStudio.livePreview);
    await page.waitForFunction(() => aiAssistant.activeTask?.repairAttempts === 1 && !chemiationStudio.livePreview);
    assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), false);
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.equal(await page.evaluate(() => aiAssistant.lastTask.repairAttempts), 1);
    assert.equal(await page.locator('#script-editor').inputValue(), original);
    await page.locator('#studio-discard').click(); note('invalid later steps withdraw the prefix and each correction starts a fresh live preview');

    responses.push({ chunks: [liveFirst, liveSecond], finish: 'length', delay: 650 });
    await page.locator('#studio-input').fill('演示截断模型测试反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => chemiationStudio.busy && !!chemiationStudio.livePreview);
    await page.waitForFunction(() => !chemiationStudio.busy);
    assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), false);
    assert.equal(await page.locator('#script-editor').inputValue(), original);
    assert.equal(await page.locator('#studio-canvas-status').isVisible(), false);
    note('a truncated completion withdraws all temporary previews and restores the original canvas');

    responses.push({ chunks: [liveFirst, liveSecond], delay: 900 });
    await page.locator('#studio-input').fill('演示停止模型测试反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => chemiationStudio.busy && !!chemiationStudio.livePreview);
    await page.locator('#studio-cancel').click(); await page.waitForFunction(() => !chemiationStudio.busy);
    assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), false);
    assert.equal(await page.locator('#script-editor').inputValue(), original); note('stopping during a live preview restores the original reaction without retaining a partial version');

    responses.push({ chunks: [liveFirst, liveSecond], delay: 650 });
    await page.locator('#studio-input').fill('演示切换机理模型测试反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => chemiationStudio.busy && !!chemiationStudio.livePreview);
    await page.evaluate(() => reactionApp.loadReaction(1));
    await page.waitForFunction(() => !chemiationStudio.loading && chemiationStudio.session.projectId === reactionApp.presets[1].id);
    const switched = await page.locator('#script-editor').inputValue();
    await page.waitForFunction(() => !chemiationStudio.busy);
    assert.equal(await page.locator('#script-editor').inputValue(), switched);
    assert.equal(await page.evaluate(() => !!reactionApp.studioPreview), false);
    await page.evaluate(() => reactionApp.loadReaction(0));
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, conversationId);
    note('switching reaction during streaming invalidates live preview and blocks stale results');

    // A text-only model question still has a free-answer form; it does not invent scientific options.
    responses.push({ text: '{"type":"question","question":"请提供具体反应物与溶剂"}' });
    await page.locator('#studio-input').fill('继续之前先问我具体条件'); await page.locator('#studio-send').click();
    await page.locator('.studio-question').last().waitFor();
    await page.waitForFunction(() => !chemiationStudio.busy);
    const freeQuestion = page.locator('.studio-question').last();
    assert.equal(await freeQuestion.locator('input').count(), 0);
    await freeQuestion.locator('textarea').fill('由我自行输入具体条件');
    assert.equal(await freeQuestion.locator('button[type=submit]').isEnabled(), true);
    note('older text-only question responses retain a free-answer path');

    // An actual second tab may not overwrite the newer local session.
    const second = await context.newPage(); await second.goto(base);
    await second.waitForFunction(id => chemiationStudio.session?.id === id && !chemiationStudio.loading, conversationId);
    await page.evaluate(async () => { chemiationStudio.addMessage('user', 'first tab writes'); await chemiationStudio.persist(); });
    const conflict = await second.evaluate(async () => { chemiationStudio.addMessage('user', 'stale second tab'); try { await chemiationStudio.persist(); return false; } catch (_) { return true; } });
    assert.equal(conflict, true); await second.close(); note('stale local tabs cannot overwrite a newer chat');

    // Use real authentication and the existing server API, with isolated test data.
    const registered = await page.evaluate(async () => {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'browser_studio_user', password: 'Studio123!Browser' }) });
      const data = await res.json(); api.setToken(data.token); authCtrl.setUser(data.user); return data.user.id;
    });
    await page.waitForFunction(() => !chemiationStudio.loading && chemiationStudio.owner() !== 'guest');
    assert.equal(await page.evaluate(() => chemiationStudio.session.messages.length), 0);
    const cloud = await page.evaluate(async () => { chemiationStudio.addMessage('user', 'cloud conversation'); await chemiationStudio.persist(); await chemiationStudio.cloudQueue; return { id: chemiationStudio.session.id, revision: chemiationStudio.session.revision }; });
    assert.ok(cloud.revision > 0);
    const remote = await page.evaluate(async id => (await (await fetch('/api/studio/sessions/' + id, { headers: api.getAuthHeaders() })).json()).session, cloud.id);
    assert.equal(remote.messages[0].text, 'cloud conversation');
    const credentials = await page.evaluate(() => ({ token: api.getToken(), user: window.currentUser }));
    const remoteContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const remotePage = await remoteContext.newPage(); await remotePage.route('https://**/*', route => route.abort());
    await remotePage.goto(base); await remotePage.waitForFunction(() => chemiationStudio.session && !chemiationStudio.loading);
    await remotePage.evaluate(value => { api.setToken(value.token); authCtrl.setUser(value.user); }, credentials);
    await remotePage.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, cloud.id);
    assert.ok(await remotePage.getByText('cloud conversation', { exact: true }).count());
    assert.equal(await remotePage.evaluate(() => chemiationStudio.session.projectId), await page.evaluate(() => chemiationStudio.currentProject.id));
    await remoteContext.close();
    note('a fresh browser restores the signed-in project conversation from server storage');
    await page.evaluate(() => { api.setToken(''); authCtrl.setUser(null); });
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, conversationId);
    assert.equal(await page.getByText('cloud conversation', { exact: true }).count(), 0); note('signed-in chat sync uses real server persistence; logout isolates private records');

    responses.push({ text: JSON.stringify({ type: 'question', question: '这次演示更想突出哪部分？', options: ['键的断裂与形成', '原子的空间变化'] }) });
    await page.locator('#studio-input').fill('继续完善前，先问我演示重点'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && chemiationStudio.session.messages.at(-1)?.question?.options.length === 2);

    for (const [width, height] of [[1440, 960], [1180, 820], [1024, 768], [736, 950], [390, 844], [320, 640]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      {
        const sessionId = await page.evaluate(() => chemiationStudio.session.id);
        const draft = await page.locator('#script-editor').inputValue();
        await page.locator('#tab-btn-script').click();
        await page.locator('#script-editor').waitFor({ state: 'visible' });
        await page.locator('#tab-pane-chat').waitFor({ state: 'hidden' });
        await page.locator('#tab-btn-chat').click();
        await page.locator('#tab-pane-chat').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#script-editor').inputValue(), draft);
        assert.equal(await page.evaluate(() => chemiationStudio.session.id), sessionId);
        await page.locator('#play-btn').waitFor({ state: 'visible' });
      }
      const layout = await page.evaluate(() => {
        const input = document.getElementById(document.getElementById('studio-form').hidden ? 'studio-write-message' : 'studio-input').getBoundingClientRect(), pane = document.getElementById('tab-pane-chat').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, clipped: input.bottom > pane.bottom + 1, logHeight: document.getElementById('studio-messages').getBoundingClientRect().height };
      });
      assert.equal(layout.overflow, false, JSON.stringify({ width, layout })); assert.equal(layout.clipped, false, JSON.stringify({ width, layout }));
      assert.ok(layout.logHeight >= 55, JSON.stringify({ width, layout }));
      if (width === 390 || width === 320) {
        const form = page.locator('.studio-question').last();
        await form.locator('button[type=submit]').scrollIntoViewIfNeeded();
        const formLayout = await form.evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth }));
        assert.ok(formLayout.scroll <= formLayout.width + 1);
        await screenshot(page, '03-手机问题表单-' + width);
      }
    }
    await page.setViewportSize({ width: 1440, height: 960 }); await page.waitForTimeout(200);
    await tool(page, 'studio-collapse');
    await page.locator('#tab-pane-chat').waitFor({ state: 'hidden' });
    await page.locator('#btn-expand-workspace').click();
    await page.locator('#tab-pane-chat').waitFor({ state: 'visible' });
    await page.locator('#studio-write-message').waitFor({ state: 'visible' });
    note('narrow-screen switching and workspace collapse preserve the draft, chat and playback controls');
    const firstProject = await page.evaluate(() => ({ id: chemiationStudio.currentProject.id, sessionId: chemiationStudio.session.id, script: reactionApp.scriptEditor.value }));
    await page.evaluate(async () => { chemiationStudio.addMessage('user', 'PROJECT_A_FIRST_PRIVATE_MARKER'); chemiationStudio.session.title = '方案一 · 初始推演'; await chemiationStudio.persist(); });
    await page.locator('#studio-input').fill('第一段对话尚未发送的内容');
    await page.locator('#studio-new').click();
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id !== id, firstProject.sessionId);
    const secondSessionId = await page.evaluate(() => chemiationStudio.session.id);
    assert.equal(await page.evaluate(() => chemiationStudio.session.versions.length), 0);
    await page.evaluate(async () => { chemiationStudio.addMessage('user', 'PROJECT_A_SECOND_CONTEXT'); chemiationStudio.session.title = '方案二 · 细化机理'; await chemiationStudio.persist(); });
    await choose(page, 'studio-session-select', firstProject.sessionId);
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, firstProject.sessionId);
    assert.equal(await page.locator('#studio-input').inputValue(), '第一段对话尚未发送的内容');
    assert.ok(await page.getByText('PROJECT_A_FIRST_PRIVATE_MARKER', { exact: true }).isVisible());
    assert.equal(await page.locator('#studio-messages').getByText('PROJECT_A_SECOND_CONTEXT', { exact: true }).count(), 0);
    assert.equal(await page.locator('#script-editor').inputValue(), firstProject.script);
    assert.ok(await page.evaluate(() => chemiationStudio.session.versions.length > 0));
    await choose(page, 'studio-session-select', secondSessionId);
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, secondSessionId);
    note('one mechanism supports multiple independent chats, drafts and version lists without changing its script');

    await choose(page, 'studio-project-select', '1');
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.currentProject.id !== id, firstProject.id);
    const secondProject = await page.evaluate(() => ({ id: chemiationStudio.currentProject.id, sessionId: chemiationStudio.session.id }));
    assert.equal(await page.locator('#studio-session-select option[value="' + firstProject.sessionId + '"]').count(), 0);
    assert.equal(await page.getByText('PROJECT_A_FIRST_PRIVATE_MARKER', { exact: true }).count(), 0);
    await page.evaluate(async () => { chemiationStudio.addMessage('user', 'PROJECT_B_PRIVATE_MARKER'); chemiationStudio.session.title = '反应条件讨论'; await chemiationStudio.persist(); });
    await page.locator('#studio-input').fill('项目 B 的未发送草稿');
    await choose(page, 'studio-project-select', '0');
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, secondSessionId);
    assert.equal(await page.getByText('PROJECT_B_PRIVATE_MARKER', { exact: true }).count(), 0);
    await choose(page, 'studio-project-select', '1');
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, secondProject.sessionId);
    assert.equal(await page.locator('#studio-input').inputValue(), '项目 B 的未发送草稿');
    await page.reload();
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, secondProject.sessionId);
    assert.equal(await page.evaluate(() => reactionApp.currentReactionIndex), 1);
    assert.equal(await page.locator('#studio-input').inputValue(), '项目 B 的未发送草稿');
    note('switching and reloading restores the selected project, its last chat and unsent draft');

    await choose(page, 'studio-project-select', '0');
    await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, secondSessionId);
    responses.push({ text: '{"type":"question","question":"继续完善哪一项？","options":["结构说明","播放节奏"]}' });
    await page.locator('#studio-input').fill('继续完善本机理，先问我一个问题'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.session.messages.at(-1)?.question);
    const sentContext = JSON.stringify(requests.at(-1).messages);
    assert.ok(sentContext.includes('PROJECT_A_SECOND_CONTEXT'));
    assert.equal(sentContext.includes('PROJECT_A_FIRST_PRIVATE_MARKER'), false);
    assert.equal(sentContext.includes('PROJECT_B_PRIVATE_MARKER'), false);
    await screenshot(page, '04-机理项目下的多段对话');
    note('the model receives only the selected chat context, not other project or sibling chats');

    await page.evaluate(() => {
      reactionApp.scriptEditor.value = reactionApp.scriptEditor.value.replace(/reaction "[^"\n]*"/, 'reaction "酯化反应项目（已改名）"');
      reactionApp.runCustomScript();
    });
    assert.equal(await page.evaluate(() => chemiationStudio.currentProject.id), firstProject.id);
    assert.equal(await page.evaluate(() => chemiationStudio.session.id), secondSessionId);
    assert.ok((await page.locator('#studio-project-select').inputValue()) === '0');
    await page.evaluate(async () => { await chemiationStudio.persist(); });
    await page.locator('#tab-btn-chat').click();
    note('renaming a mechanism preserves its project identity and existing conversations');

    const legacyId = await page.evaluate(async () => {
      const s = ChemiationStudioCore.create(); s.title = '升级前的旧对话'; s.messages.push({ id: ChemiationStudioCore.id(), role: 'user', text: 'LEGACY_RECORD_PRESERVED' });
      await chemiationStudio.store.put(chemiationStudio.owner(), s); return s.id;
    });
    await tool(page, 'studio-history');
    await page.locator('#studio-legacy-sessions .studio-history-row').filter({ hasText: '升级前的旧对话' }).getByRole('button', { name: '复制到本项目' }).click();
    await page.waitForFunction(() => document.getElementById('studio-library').hidden && chemiationStudio.session.title === '升级前的旧对话');
    const copied = await page.evaluate(async id => ({ id: chemiationStudio.session.id, projectId: chemiationStudio.session.projectId, originalProject: (await chemiationStudio.store.get(chemiationStudio.owner(), id)).projectId }), legacyId);
    assert.notEqual(copied.id, legacyId); assert.equal(copied.projectId, firstProject.id); assert.equal(copied.originalProject, '');
    note('unassigned old chats can be explicitly copied into a project while preserving the original');

    await tool(page, 'studio-settings');
    await page.locator('#ai-pane-settings').waitFor({ state: 'visible' });
    const savedModel = await page.evaluate(() => aiAssistant.getConfig().model);
    await page.locator('#ai-api-key').fill('unsaved-browser-fixture-key');
    await page.locator('#ai-model-name').fill('unsaved-connection-model');
    responses.push({ text: 'hi' });
    await page.locator('#ai-btn-test-conn').click();
    await page.waitForFunction(() => document.getElementById('ai-test-result').classList.contains('success'));
    assert.equal(requests.at(-1).model, 'unsaved-connection-model');
    assert.equal(await page.evaluate(() => aiAssistant.getConfig().model), savedModel);
    await page.locator('#ai-api-key').fill('');
    const beforeEmptyTest = requests.length;
    await page.locator('#ai-btn-test-conn').click();
    await page.waitForFunction(() => document.getElementById('ai-test-result').textContent.includes('输入框为空'));
    assert.equal(requests.length, beforeEmptyTest);
    await page.locator('#ai-modal .close-ai-modal').click();
    note('connection test uses unsaved visible settings and never silently reuses a saved key after clearing');
    await page.setViewportSize({ width: 320, height: 640 }); await page.waitForTimeout(200);
    responses.push({ hang: true });
    await page.locator('#studio-input').fill('完善本机理的说明'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => aiAssistant.isGenerating);
    const compactLayout = () => page.evaluate(() => {
      const input = document.getElementById('studio-input').getBoundingClientRect(), pane = document.getElementById('tab-pane-chat').getBoundingClientRect();
      return { clipped: input.bottom > pane.bottom + 1, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(await compactLayout(), { clipped: false, overflow: false });
    await page.locator('#studio-cancel').click(); await page.waitForFunction(() => !chemiationStudio.busy);
    const compactScript = await page.locator('#script-editor').inputValue(); responses.push({ text: compactScript });
    await page.locator('#studio-input').fill('完善当前机理的说明'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.deepEqual(await compactLayout(), { clipped: false, overflow: false });
    await screenshot(page, '05-手机项目对话与生成预览');
    await page.locator('#studio-discard').click();
    note('project controls, composer and playback remain usable during generation and preview at 320 px');

    await page.setViewportSize({ width: 1440, height: 960 });
    async function startNewChat() {
      const previous = await page.evaluate(() => chemiationStudio.session.id);
      await page.locator('#studio-new').click();
      await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id !== id, previous);
    }
    await startNewChat();
    await page.evaluate(async () => {
      const s = chemiationStudio.session;
      const first = { id: ChemiationStudioCore.id(), role: 'user', text: 'LONG_CONTEXT_FIXED_SUBSTRATE: keep this specific substrate' };
      const q = { id: ChemiationStudioCore.id(), role: 'assistant', text: 'Which solvent?', question: { question: 'Which solvent?', options: [{ label: 'Water', value: 'H2O' }, { label: 'Ethanol', value: 'EtOH' }] } };
      s.messages = [first, q, { id: ChemiationStudioCore.id(), role: 'user', text: 'LONG_CONTEXT_CONFIRMED_WATER', replyTo: q.id },
        ...Array.from({ length: 26 }, (_, i) => ({ id: ChemiationStudioCore.id(), role: i % 2 ? 'user' : 'assistant', text: 'Later discussion ' + i }))];
      await chemiationStudio.persist(); chemiationStudio.render();
    });
    responses.push({ text: '{"type":"question","question":"要完善说明还是空间布局？","options":["说明","空间布局"]}' });
    await page.locator('#studio-input').fill('继续完善这个反应的说明'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.session.messages.at(-1)?.question);
    const retained = JSON.stringify(requests.at(-1).messages);
    assert.ok(retained.includes('LONG_CONTEXT_FIXED_SUBSTRATE'));
    assert.ok(retained.includes('LONG_CONTEXT_CONFIRMED_WATER')); assert.ok(retained.includes('H2O'));
    assert.ok(retained.includes('条较早记录未附带'));
    note('long browser conversations retain the original substrate and earlier answered conditions');

    await startNewChat();
    const valenceBase = await page.locator('#script-editor').inputValue();
    const invalidCarbon = 'reaction "Invalid five-bond carbon"\nstep "Bad state" {\nhydrogens none\natom Center C 0 0 0\n' +
      Array.from({ length: 5 }, (_, i) => `atom H${i} H ${i + 1} 1 0\nbond Center H${i} 1`).join('\n') + '\n}';
    responses.push({ text: invalidCarbon, delay: 10 }, { text: valenceBase, delay: 10 });
    await page.locator('#studio-input').fill('展示价键校验模型测试反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.equal(await page.evaluate(() => aiAssistant.lastTask.repairAttempts), 1);
    assert.ok(requests.at(-1).messages.at(-1).content.includes('Center'));
    assert.ok(requests.at(-1).messages.at(-1).content.includes('键级总和'));
    assert.equal(await page.locator('#script-editor').inputValue(), valenceBase);
    await page.locator('#studio-discard').click();
    await page.evaluate(() => {
      const value = { name: 'Coordination review', steps: [{ name: 'Needs review', hydrogensMode: 'none',
        atoms: [{ id: 'O', element: 'O', x: 0, y: 0, z: 0 }, { id: 'H1', element: 'H', x: 1, y: 0, z: 0 },
          { id: 'H2', element: 'H', x: -1, y: 0, z: 0 }, { id: 'Fe', element: 'Fe', x: 0, y: 2, z: 0 }],
        bonds: [{ atom1Id: 'O', atom2Id: 'H1', order: 1 }, { atom1Id: 'O', atom2Id: 'H2', order: 1 }, { atom1Id: 'O', atom2Id: 'Fe', order: 1 }] }] };
      const script = JSON.stringify(value), validation = ChemiationAISafety.validateScript(script, ReactionScriptEngine);
      if (!validation.valid) throw new Error(validation.diagnostics.join(';'));
      chemiationStudio.preview({ script, validation, complete: true, base: aiAssistant.getWorkspace() });
    });
    assert.ok((await page.locator('#studio-candidate-note').textContent()).includes('配位'));
    assert.equal(await page.locator('#script-editor').inputValue(), valenceBase);
    await page.locator('#studio-discard').click();
    note('five-bond carbon triggers bounded automatic correction before a candidate can be kept');

    await startNewChat();
    await page.evaluate(() => {
      const originalList = chemiationStudio.store.list;
      window.testLookupWaiting = false;
      chemiationStudio.store.list = (...args) => args[1] === undefined ? new Promise(resolve => {
        window.testLookupWaiting = true; window.releaseTestLookup = () => { chemiationStudio.store.list = originalList; resolve([]); };
      }) : originalList(...args);
    });
    const beforeLookupCancel = requests.length;
    await page.locator('#studio-input').fill('演示等待本机检索的反应'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => window.testLookupWaiting);
    await page.locator('#studio-cancel').click();
    await page.waitForFunction(() => !chemiationStudio.busy);
    await page.evaluate(() => window.releaseTestLookup());
    assert.equal(requests.length, beforeLookupCancel);
    assert.ok(await page.getByText('已停止检索，原稿未改动。', { exact: true }).isVisible());
    assert.equal(await page.locator('#script-editor').inputValue(), valenceBase);
    note('stopping while local history is slow settles immediately without a late model request');

    await page.evaluate(value => { api.setToken(value.token); authCtrl.setUser(value.user); }, credentials);
    await page.waitForFunction(() => !chemiationStudio.loading && chemiationStudio.owner() !== 'guest');
    await startNewChat();
    const retryBase = await page.locator('#script-editor').inputValue();
    const retryBlocks = await page.evaluate(() => ChemiationAIEditing.documentOf(reactionApp.scriptEditor.value).steps.map(s => s.text));
    await page.locator('#studio-refine-step').click();
    const scopedIndex = await page.evaluate(() => chemiationStudio.scope.index);
    const retriedStep = retryBlocks[scopedIndex].replace(/note\s+"[^"\n]*"/, 'note "只重试指定步骤的说明"');
    responses.push({ text: retriedStep, finish: 'length', delay: 5 });
    await page.locator('#studio-input').fill('只完善这个步骤的说明，其他不动'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.session.messages.at(-1)?.retry);
    await page.evaluate(async () => { await chemiationStudio.localQueue; });
    const retryChat = await page.evaluate(() => chemiationStudio.session.id);
    await page.reload(); await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, retryChat);
    const retryReloadedBase = await page.locator('#script-editor').inputValue();
    const failedMessage = page.locator('.studio-message').filter({ has: page.locator('[data-retry-id]') }).last();
    await failedMessage.locator('summary').click();
    assert.equal(await failedMessage.locator('pre').textContent(), retriedStep);
    assert.equal(await page.evaluate(() => chemiationStudio.scope.index), scopedIndex);
    const beforeRetry = requests.length;
    responses.push({ text: retriedStep, delay: 5 });
    await failedMessage.getByRole('button', { name: '重试这次生成' }).click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.equal(requests.length, beforeRetry + 1);
    assert.ok(requests.at(-1).messages.at(-1).content.includes('只完善这个步骤的说明，其他不动'));
    const retryResult = await page.evaluate(() => ChemiationAIEditing.documentOf(chemiationStudio.proposal.script).steps.map(s => s.text));
    retryBlocks.forEach((block, i) => assert.equal(retryResult[i], i === scopedIndex ? retriedStep : block));
    assert.equal(await page.locator('#script-editor').inputValue(), retryReloadedBase);
    assert.equal(await page.evaluate(() => chemiationStudio.session.messages.filter(m => m.role === 'user').length), 1);
    await screenshot(page, '06-失败片段与原范围重试');
    note('failed fragments and retry survive reload, preserve the exact original request and change only its selected step');

    await page.locator('#studio-discard').click();
    await page.evaluate(() => { reactionApp.scriptEditor.value = reactionApp.scriptEditor.value.replace(/note\s+"[^"\n]*"/, 'note "用户修改后的步骤说明"'); reactionApp.scriptEditor.dispatchEvent(new Event('input')); });
    const beforeStaleRetry = requests.length;
    await failedMessage.getByRole('button', { name: '重试这次生成' }).click();
    assert.ok((await page.locator('#studio-notice').textContent()).includes('原脚本已变化'));
    assert.equal(requests.length, beforeStaleRetry);
    await page.locator('#studio-refine-step').click();
    await page.evaluate(() => { reactionApp.scriptEditor.value = reactionApp.scriptEditor.value.replace('用户修改后的步骤说明', '再次改变步骤说明'); reactionApp.scriptEditor.dispatchEvent(new Event('input')); });
    await page.locator('#studio-input').fill('继续完善这个步骤'); await page.locator('#studio-send').click();
    assert.equal(await page.locator('#studio-input').inputValue(), '继续完善这个步骤');
    assert.equal(requests.length, beforeStaleRetry);
    assert.ok((await page.locator('#studio-scope-label').textContent()).includes('重新选择'));
    await page.evaluate(script => { reactionApp.scriptEditor.value = script; reactionApp.scriptEditor.dispatchEvent(new Event('input')); }, retryBase);
    await page.locator('#studio-clear-scope').click();
    note('changed originals block retry and scoped follow-ups without silently widening the edit boundary or dropping input');

    await tool(page, 'studio-history');
    const retryRow = page.locator('#studio-sessions .studio-history-row[data-session-id="' + retryChat + '"]');
    await retryRow.getByRole('button', { name: '改名', exact: true }).click();
    await retryRow.getByLabel('新的对话名称').fill('流程测试甲 · 指定步骤');
    await retryRow.getByRole('button', { name: '保存名称' }).click();
    await page.waitForFunction(() => !chemiationStudio.committing && chemiationStudio.session.title === '流程测试甲 · 指定步骤');
    await page.locator('#studio-close-library').click();
    await startNewChat();
    const managementChat = await page.evaluate(() => chemiationStudio.session.id);
    await page.evaluate(async () => { chemiationStudio.addMessage('user', '用于管理功能测试'); await chemiationStudio.persist(); await chemiationStudio.cloudQueue; });
    await tool(page, 'studio-history');
    const managedRow = page.locator('#studio-sessions .studio-history-row[data-session-id="' + managementChat + '"]');
    await managedRow.getByRole('button', { name: '改名', exact: true }).click();
    await managedRow.getByLabel('新的对话名称').fill('流程测试乙 · 条件讨论');
    await managedRow.getByRole('button', { name: '保存名称' }).click();
    await page.waitForFunction(() => !chemiationStudio.committing && chemiationStudio.session.title === '流程测试乙 · 条件讨论');
    await page.locator('#studio-history-search').fill('流程测试甲');
    await retryRow.waitFor();
    assert.equal(await managedRow.count(), 0);
    await page.evaluate(async id => {
      await chemiationStudio.cloudQueue;
      await chemiationStudio.store.remove(chemiationStudio.owner(), id);
      chemiationStudio.localRevisions.delete(chemiationStudio.owner() + ':' + id);
    }, retryChat);
    await retryRow.getByRole('button', { name: '改名', exact: true }).click();
    await retryRow.getByLabel('新的对话名称').fill('流程测试甲 · 旧请求保留');
    await retryRow.getByRole('button', { name: '保存名称' }).click();
    await page.waitForFunction(() => !chemiationStudio.committing);
    assert.equal(await page.evaluate(() => chemiationStudio.session.id), managementChat);
    const renamedCloudChat = await page.evaluate(async id => ({ owner: chemiationStudio.owner(), id, session: await chemiationStudio.store.get(chemiationStudio.owner(), id),
      index: await chemiationStudio.store.list(chemiationStudio.owner()), notice: document.getElementById('studio-notice').textContent }), retryChat);
    assert.ok(renamedCloudChat.session, JSON.stringify(renamedCloudChat));
    assert.equal(renamedCloudChat.session.title, '流程测试甲 · 旧请求保留');
    assert.ok(renamedCloudChat.session.messages.find(m => m.retry));
    await page.locator('#studio-history-search').fill('不存在的名称');
    await page.getByText('没有找到这个名称的对话。', { exact: true }).waitFor();
    await page.locator('#studio-history-search').fill('流程测试乙');
    await managedRow.waitFor(); await managedRow.getByRole('button', { name: '删除', exact: true }).click();
    await managedRow.getByRole('button', { name: '取消', exact: true }).click();
    assert.ok(await page.evaluate(async id => !!await chemiationStudio.store.get(chemiationStudio.owner(), id), managementChat));
    await screenshot(page, '07-历史搜索与对话管理');
    note('history searches titles and renames current or cloud-only sibling chats without losing failed requests; cancelled deletion preserves records');

    const deletionUrl = '**/api/studio/sessions/' + managementChat;
    await page.route(deletionUrl, route => route.request().method() === 'DELETE' ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test storage unavailable"}' }) : route.continue());
    await managedRow.getByRole('button', { name: '删除', exact: true }).click();
    await managedRow.getByRole('button', { name: '确认删除' }).click();
    await page.waitForFunction(() => !chemiationStudio.committing && document.getElementById('studio-notice').textContent.includes('删除未完成'));
    assert.ok(await page.evaluate(async id => !!await chemiationStudio.store.get(chemiationStudio.owner(), id), managementChat));
    await page.unroute(deletionUrl);
    await managedRow.waitFor();
    const staleDeleted = await page.evaluate(async id => await chemiationStudio.store.get(chemiationStudio.owner(), id), managementChat);
    await managedRow.getByRole('button', { name: '删除', exact: true }).click();
    await managedRow.getByRole('button', { name: '确认删除' }).click();
    await page.waitForFunction(id => !chemiationStudio.committing && chemiationStudio.session.id !== id, managementChat);
    const deleted = await page.evaluate(async ({ id, stale }) => ({
      local: await chemiationStudio.store.get(chemiationStudio.owner(), id),
      remoteStatus: (await fetch('/api/studio/sessions/' + id, { headers: api.getAuthHeaders() })).status,
      staleWrite: await chemiationStudio.store.put(chemiationStudio.owner(), stale)
    }), { id: managementChat, stale: staleDeleted });
    assert.equal(deleted.local, null); assert.equal(deleted.remoteStatus, 404); assert.equal(deleted.staleWrite.conflict, true);
    assert.equal(await page.locator('#script-editor').inputValue(), retryBase);
    await page.reload(); await page.waitForFunction(() => !chemiationStudio.loading && !!chemiationStudio.session);
    assert.ok((await page.locator('#studio-session-select option').allTextContents()).includes('流程测试甲 · 旧请求保留'));
    assert.equal(await page.locator('#studio-session-select option[value="' + managementChat + '"]').count(), 0);
    note('cloud deletion failures keep the local chat; confirmed deletion removes both copies and stale writes cannot resurrect it');

    const oldCloudUrl = '**/api/studio/sessions/*';
    await page.route(oldCloudUrl, async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const response = await route.fetch(), body = await response.json();
      if (body.session) { delete body.session.scope; body.session.messages.forEach(m => { delete m.answerDraft; delete m.retry; delete m.failure; }); }
      await route.fulfill({ response, json: body });
    });
    await page.evaluate(async () => {
      chemiationStudio.addMessage('assistant', '补充条件？', '', { question: { question: '补充条件？', options: [{ label: '酸性', value: '酸性' }] }, answerDraft: { selected: '酸性', text: '本机应保留的草稿' } });
      await chemiationStudio.persist(); await chemiationStudio.cloudQueue;
    });
    assert.ok((await page.locator('#studio-save-state').textContent()).includes('云端需要更新'));
    assert.equal(await page.evaluate(async () => (await chemiationStudio.store.get(chemiationStudio.owner(), chemiationStudio.session.id)).messages.at(-1).answerDraft.text), '本机应保留的草稿');
    await page.unroute(oldCloudUrl);
    note('an older cloud normalizer dropping new fields is detected instead of falsely reporting a complete sync');

    await startNewChat();
    await page.evaluate(() => aiAssistant.saveConfig({ provider: 'custom', baseUrl: 'http://unused.invalid/v1', apiKey: '', model: 'fixture' }));
    const beforeWorkflow = requests.length;
    await page.locator('#studio-input').fill('帮我生成一个酯化反应'); await page.locator('#studio-send').click();
    await page.locator('.studio-question').last().waitFor();
    assert.equal(requests.length, beforeWorkflow);
    assert.equal(await page.locator('#ai-modal').isVisible(), false);
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.pending.field), 'reaction');
    const workflowChat = await page.evaluate(async () => { await chemiationStudio.localQueue; return chemiationStudio.session.id; });
    await page.reload(); await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id, workflowChat);
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.originalRequest), '帮我生成一个酯化反应');
    note('a vague new reaction asks for reactants locally before any model configuration or paid request, and its task survives reload');
    await page.evaluate(url => aiAssistant.saveConfig({ provider: 'custom', baseUrl: url + '/v1', apiKey: 'dummy-browser-test', model: 'fixture' }), modelUrl);
    const workflowSource = await page.locator('#script-editor').inputValue();
    responses.push({ text: workflowSource, delay: 5 });
    await page.locator('.studio-question').last().locator('textarea').fill('WORKFLOW_SUBSTRATE_A 与 WORKFLOW_SUBSTRATE_B，按已明确条件展示完整反应。');
    await page.locator('.studio-question').last().getByRole('button', { name: '提交并继续' }).click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.equal(requests.length, beforeWorkflow + 1);
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.kind), 'new');
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.stage), 'preview');
    assert.ok(requests.at(-1).messages[0].content.includes('WORKFLOW_SUBSTRATE_A'));
    assert.ok(requests.at(-1).messages[0].content.includes('帮我生成一个酯化反应'));
    assert.equal(await page.locator('#script-editor').inputValue(), workflowSource);
    await page.locator('#studio-discard').click();
    note('answering a required question continues the original new-generation task directly into a checked animation preview');

    await startNewChat();
    const beforeGoal = requests.length;
    await page.locator('#studio-input').fill('优化一下'); await page.locator('#studio-send').click();
    const goalForm = page.locator('.studio-question').last();
    await goalForm.getByText('讲解说明', { exact: true }).click();
    assert.equal(requests.length, beforeGoal);
    responses.push({ text: workflowSource.replace(/note\s+"[^"\n]*"/, 'note "流程测试：让说明更清楚，结构不变"'), delay: 5 });
    await goalForm.getByRole('button', { name: '提交并继续' }).click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.equal(requests.length, beforeGoal + 1);
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.policy), 'notes');
    await page.locator('#studio-discard').click();
    note('vague refinement asks for the change goal once, while a notes-only answer generates without unrelated condition questions');

    await startNewChat();
    const workflowBlocks = await page.evaluate(() => ChemiationAIEditing.documentOf(reactionApp.scriptEditor.value).steps.map(s => s.text));
    const explicitStep = workflowBlocks[1].replace(/note\s+"[^"\n]*"/, 'note "流程测试：仅修改第2步说明"');
    responses.push({ text: explicitStep, delay: 5 });
    await page.locator('#studio-input').fill('只修改第2步的说明，其他不变'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    assert.equal(await page.evaluate(() => chemiationStudio.scope.index), 1);
    const explicitBlocks = await page.evaluate(() => ChemiationAIEditing.documentOf(chemiationStudio.proposal.script).steps.map(s => s.text));
    workflowBlocks.forEach((block, i) => assert.equal(explicitBlocks[i], i === 1 ? explicitStep : block));
    await page.locator('#studio-discard').click();
    note('an explicit step number in natural language creates a program-enforced boundary before generation');

    await startNewChat();
    responses.push({ text: '{"type":"explanation","text":"本轮只解释已有步骤，不修改机理或脚本。"}' });
    await page.locator('#studio-input').fill('为什么这一步会发生变化？'); await page.locator('#studio-send').click();
    await page.getByText('本轮只解释已有步骤，不修改机理或脚本。', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.stage), 'explained');
    assert.equal(await page.evaluate(() => chemiationStudio.proposal), null);
    assert.equal(await page.locator('.studio-question').count(), 0);
    assert.equal(await page.locator('#script-editor').inputValue(), workflowSource);
    note('explanation requests return plain chat content without forced forms or an executable script');

    await startNewChat();
    responses.push({ text: '{"type":"question","field":"solvent","question":"请选择溶剂？","options":["水","乙醇"]}' },
      { text: '{"type":"question","field":"solvent","question":"请选择溶剂？","options":["水","乙醇"]}' });
    await page.locator('#studio-input').fill('继续完善本机理，先明确必要条件'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.session.workflow.pending);
    const solvent = page.locator('.studio-question').last(); await solvent.getByText('水', { exact: true }).click(); await solvent.getByRole('button', { name: '提交并继续' }).click();
    await page.waitForFunction(() => !chemiationStudio.busy && chemiationStudio.session.messages.at(-1)?.failure?.status === 'repeated-question');
    assert.equal(await page.locator('.studio-question').count(), 1);
    assert.ok(await page.evaluate(() => chemiationStudio.session.workflow.evidence[0].answer.includes('水')));
    note('a model repeating an already answered question is stopped while the confirmed answer remains saved');

    await startNewChat(); responses.push({ hang: true });
    await page.locator('#studio-input').fill('完善本机理的说明'); await page.locator('#studio-send').click();
    await page.waitForFunction(() => aiAssistant.isGenerating);
    const interruptedChat = await page.evaluate(async () => { await chemiationStudio.localQueue; return chemiationStudio.session.id; });
    await page.reload(); await page.waitForFunction(id => !chemiationStudio.loading && chemiationStudio.session.id === id && !!chemiationStudio.session.messages.at(-1)?.retry, interruptedChat);
    assert.ok((await page.locator('.studio-message').last().textContent()).includes('页面关闭或刷新'));
    assert.equal(await page.evaluate(() => chemiationStudio.session.workflow.policy), 'notes');
    assert.equal(await page.locator('#script-editor').inputValue(), workflowSource);
    responses.push({ text: workflowSource, delay: 5 });
    await page.locator('[data-retry-id]').last().click(); await page.waitForFunction(() => !chemiationStudio.busy && !!chemiationStudio.proposal);
    note('refresh during generation recovers the exact request and task constraints and permits a safe retry');
    assert.equal(errors.length, 0, errors.join('\n')); note('desktop and 320–736 px mobile layouts keep the composer visible with no page errors');
    console.log(JSON.stringify({ passed: passed.length, modelRequests: requests.length, cloudUser: !!registered }));
  } catch (error) {
    console.error('Browser failure state:', await page.evaluate(async () => ({
      notice: document.getElementById('studio-notice').textContent,
      owner: chemiationStudio.owner(), loadedOwner: chemiationStudio.loadedOwner,
      sessionId: chemiationStudio.session.id, localIndex: await chemiationStudio.store.list(chemiationStudio.owner()),
      busy: chemiationStudio.busy, scopeValid: chemiationStudio.scopeValid(),
      scopeIndex: chemiationStudio.scope?.index, lastStatus: aiAssistant.lastTask?.status,
      failure: chemiationStudio.session.messages.at(-1)?.failure?.detail,
      requestSourceLength: chemiationStudio.session.messages.findLast(m => m.retry)?.retry?.baseScript.length,
      currentSourceLength: reactionApp.scriptEditor.value.length
    })).catch(() => ({})));
    await screenshot(page, '失败诊断'); throw error;
  } finally {
    await browser.close(); model.closeAllConnections(); await new Promise(resolve => model.close(resolve)); await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
