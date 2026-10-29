const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ReactionScriptEngine } = require('../index.js');

const PAYLOAD = "<svg onload='window.__renderProbe=true'></svg>";
const SCRIPT = `reaction "${PAYLOAD}"\nstep "${PAYLOAD}" {\nnote "${PAYLOAD}"\nhydrogens none\natom H1 H 0 0 0\n}`;
function appFixture() {
  const cards = [];
  const context = {
    ReactionScriptEngine, console,
    document: { addEventListener() {}, createElement() { return { dataset: {}, addEventListener() {} }; } },
    window: {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/reactionApp.js'), 'utf8') + '\nthis.TestApp = ReactionApp;', context);
  const app = Object.create(context.TestApp.prototype);
  app.stepsListContainer = { innerHTML: '', appendChild(card) { cards.push(card); }, querySelectorAll() { return []; } };
  app.canvasStepToast = { innerHTML: '' };
  app.renderer = { setStep() {} };
  app.currentReactionIndex = 0;
  app.presets = [ReactionScriptEngine.parse(SCRIPT)];
  return { app, cards };
}
function assertTextOnly(html) {
  assert.doesNotMatch(html, /<svg\b/i, 'untrusted text created an executable HTML element');
  assert.match(html, /&lt;svg\b/, 'original text should remain visible');
}

test('parsed step titles and notes stay text in step cards', () => {
  const { app, cards } = appFixture();
  app.buildStepsList(app.presets[0].steps);
  assert.equal(cards.length, 1);
  assertTextOnly(cards[0].innerHTML);
  assert.equal((cards[0].innerHTML.match(/&lt;svg\b/g) || []).length, 2);
});

test('step navigation keeps the canvas title as text', () => {
  const { app } = appFixture();
  app.goToStep(0, false);
  assertTextOnly(app.canvasStepToast.innerHTML);
});

test('community import keeps an overridden reaction title as text', async () => {
  const toast = { innerHTML: '' };
  let loaded;
  const context = {
    ReactionScriptEngine, console,
    document: { getElementById(id) { return id === 'canvas-step-toast' ? toast : null; } },
    window: { reactionApp: { loadCustomReaction(value) { loaded = value; } } },
    alert(message) { assert.fail(message); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/repo.js'), 'utf8'), context);
  await context.window.repoCtrl.loadIntoWorkspace({ id: 'audit', title: PAYLOAD, script: SCRIPT });
  assert.equal(loaded.name, PAYLOAD);
  assertTextOnly(toast.innerHTML);
});

test('ordinary chemical notation still displays formatted text', () => {
  const { app, cards } = appFixture();
  app.buildStepsList([{ name: 'CO2 + H2O', note: 'A & B < C', atoms: [], bonds: [] }]);
  assert.match(cards[0].innerHTML, /CO₂ \+ H₂O/);
  assert.match(cards[0].innerHTML, /A &amp; B &lt; C/);
});
