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
  elements.get('ai-prompt-input').value = 'Create a fixture'; elements.get('script-editor').value = DRAFT;
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
  for (const script of ['aiStream', 'aiTaskSafety', 'aiEditingTools', 'aiHistory', 'aiHistoryPanel', 'aiWorkflow']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/' + script + '.js'), 'utf8'), context);
  context.module = { exports: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/aiAssistant.js'), 'utf8'), context);
  const ai = context.module.exports.aiAssistant;
  ai.getConfig = () => ({ provider: 'mock', baseUrl: 'https://offline.invalid/v1', apiKey: 'fixture', model: 'mock', timeoutMs: options.timeoutMs || 1000 });
  ai.showToast = (message, error) => { ai.toast = { message, error }; };
  return { ai, context, elements, storage, values, app, editor: elements.get('script-editor'), status: elements.get('ai-generation-status') };
}
module.exports = { fixture, response, VALID, DRAFT, delay };
