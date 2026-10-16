/**
 * Chemiation - AI CCPL Mechanism Generator & Assistant
 * Generates, refines, and fixes CCPL chemical reaction scripts via LLM APIs.
 * Supports OpenAI-compatible endpoints (OpenAI, DeepSeek, Qwen, SiliconFlow, Moonshot, Ollama, etc.)
 * Strictly zero emojis.
 */

const AI_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek (深度求索)',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-flash',
    models: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']
  },
  qwen: {
    name: '阿里通义千问 (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max']
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
  },
  siliconflow: {
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-7B-Instruct']
  },
  moonshot: {
    name: 'Moonshot (月之暗面 Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k']
  },
  ollama: {
    name: '本地 Ollama / 本地模型',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b',
    models: ['qwen2.5:7b', 'llama3:8b', 'deepseek-r1:7b']
  },
  custom: {
    name: '自定义 API 端点',
    baseUrl: '',
    defaultModel: '',
    models: []
  }
};

const CCPL_SYSTEM_PROMPT = `你是一名精通计算化学、有机与无机反应动力学以及机理推演的高级化学专家。
你的任务是根据用户的需求生成、完善或修复 Chemiation 化学反应原理推演脚本 (CCPL)。

CCPL 语法规范与格式要求：
1. 全局定义：
   reaction "<反应名称>"
   equation "<化学反应方程式，如 A + B -> C + D 或 A <=> B>"
   summary "<该反应机理的详细概述、热力学与过渡态说明>"

2. 步骤定义 (按反应路径顺序声明，每步必须使用大括号包裹)：
   step "<步骤名称，如：反应物底物吸附与碰撞>" {
     note "<本基元步骤的具体反应机理描述，如电子转移、质子转移或键断裂>"
     
     # 可选：聚合物重复单元标注（若涉及高分子聚合物）
     # polymer "n" tag "聚合物最简重复单元" exclude "O1 H1"
     
     # 可选：芳香大派键标注（若涉及芳香环）
     # aromatic "C1 C2 C3 C4 C5 C6" tag "Pi_6^6"
     
     # 原子声明 (Auto-Layout 智能排版模式：无需手动计算浮点坐标，引擎会自动运用 VSEPR 求解三维空间构型)：
     # 格式: atom <ID> <元素符号> [可选X Y Z坐标] [radical] [charge=+1/-1]
     atom C1 C
     atom O1 O charge=-1
     atom N1 N charge=+1
     atom Cl1 Cl radical
     
     # 化学键连接拓扑声明：
     # 格式: bond <原子1> <原子2> <键级: 1为单键, 2为双键, 3为三键, 1.5为共振/芳香键>
     bond C1 O1 2
     bond C1 C2 1
   }

3. 化学严谨性与约束：
   - 质量与原子严格守恒：所有步骤中的原子集合必须前后完全守恒，不可无故增删原子。
   - 同一原子在所有步骤必须使用相同 ID，不能通过更换编号表示同一原子；原子声明顺序和成键关系可以变化。
   - 涉及质子转移或氢迁移时，每步使用 hydrogens none 并显式声明全部氢原子，保持氢原子 ID 连续，避免自动补氢产生不同编号。
   - 步进真实性：至少包含 2~4 个确切的基元步骤（例如：底物靠近活化 -> 亲核进攻/中间体生成 -> 消除离去/产物生成）。
   - 元素符号必须是合法的 IUPAC 化学元素符号（如 C, H, O, N, P, S, Cl, Br, Mg, Cu, Fe 等）。
   - 若用户无特殊指定三维坐标，原子声明请直接使用 "atom <ID> <元素>"，交由引擎智能解算，避免坐标冲突。

4. 输出格式约束：
   - 只输出纯净合法的 CCPL 脚本文本，严禁输出任何寒暄、前言或总结废话。
   - 若使用 Markdown 代码块，必须使用 \`\`\`ccpl ... \`\`\`。`;

const AI_TASK_SAFETY = typeof ChemiationAISafety !== 'undefined' ? ChemiationAISafety :
  (typeof require === 'function' ? require('./aiTaskSafety.js') : null);
const AI_EDITING_TOOLS = typeof ChemiationAIEditing !== 'undefined' ? ChemiationAIEditing :
  (typeof require === 'function' ? require('./aiEditingTools.js') : null);
const AI_HISTORY_PANEL = typeof ChemiationAIHistoryPanel !== 'undefined' ? ChemiationAIHistoryPanel :
  (typeof require === 'function' ? require('./aiHistoryPanel.js') : null);

const aiAssistant = {
  currentTab: 'generate', // 'generate' | 'settings'
  currentMode: 'new', // 'new' | 'refine' | 'fix'
  abortController: null,
  isGenerating: false,
  lastGeneratedScript: '',
  candidate: null,
  activeTask: null,
  lastTask: null,
  taskSequence: 0,
  lastDraftBackup: null,
  connectionController: null,
  scopeSourceText: null,
  historyManager: null,
  lastDraftBackupOwner: null,

  // Storage keys
  KEYS: {
    PROVIDER: 'chemiation_ai_provider',
    BASE_URL: 'chemiation_ai_base_url',
    API_KEY: 'chemiation_ai_api_key',
    MODEL: 'chemiation_ai_model',
    TIMEOUT: 'chemiation_ai_timeout_seconds',
    STREAM: 'chemiation_ai_stream_enabled'
  },

  init() {
    this.bindEvents();
    this.loadConfig();
    this.updateActionButtons();
    this.getHistoryManager()?.bind();
  },

  currentHistoryOwner() {
    return window.currentUser && window.currentUser.id ? 'user:' + window.currentUser.id : 'guest';
  },

  getHistoryManager() {
    if (!this.historyManager && AI_HISTORY_PANEL) this.historyManager = AI_HISTORY_PANEL.create(this);
    return this.historyManager;
  },

  onUserChanged() {
    if (this.historyManager) this.historyManager.onUserChanged();
    this.lastDraftBackup = null;
    this.updateActionButtons();
  },

  getConfig() {
    const provider = localStorage.getItem(this.KEYS.PROVIDER) || 'deepseek';
    const preset = AI_PROVIDERS[provider] || AI_PROVIDERS.deepseek;
    const baseUrl = localStorage.getItem(this.KEYS.BASE_URL) || preset.baseUrl;
    const apiKey = localStorage.getItem(this.KEYS.API_KEY) || '';
    const model = localStorage.getItem(this.KEYS.MODEL) || preset.defaultModel;

    const seconds = Number(localStorage.getItem(this.KEYS.TIMEOUT) || 90);
    const timeoutSeconds = Number.isFinite(seconds) ? Math.min(300, Math.max(5, seconds)) : 90;
    return { provider, baseUrl, apiKey, model, timeoutMs: timeoutSeconds * 1000, stream: localStorage.getItem(this.KEYS.STREAM) !== 'false' };
  },

  saveConfig(cfg) {
    if (cfg.stream !== undefined) localStorage.setItem(this.KEYS.STREAM, String(!!cfg.stream));
    if (cfg.provider) localStorage.setItem(this.KEYS.PROVIDER, cfg.provider);
    if (cfg.baseUrl !== undefined) localStorage.setItem(this.KEYS.BASE_URL, cfg.baseUrl.trim());
    if (cfg.apiKey !== undefined) localStorage.setItem(this.KEYS.API_KEY, cfg.apiKey.trim());
    if (cfg.model !== undefined) localStorage.setItem(this.KEYS.MODEL, cfg.model.trim());
    if (cfg.timeoutSeconds !== undefined) {
      const seconds = Number(cfg.timeoutSeconds);
      localStorage.setItem(this.KEYS.TIMEOUT, String(Number.isFinite(seconds) ? Math.min(300, Math.max(5, seconds)) : 90));
    }
  },

  loadConfig() {
    const cfg = this.getConfig();
    const providerSel = document.getElementById('ai-provider-select');
    const baseUrlInput = document.getElementById('ai-base-url');
    const apiKeyInput = document.getElementById('ai-api-key');
    const modelInput = document.getElementById('ai-model-name');

    if (providerSel) providerSel.value = cfg.provider;
    if (baseUrlInput) baseUrlInput.value = cfg.baseUrl;
    if (apiKeyInput) apiKeyInput.value = cfg.apiKey;
    if (modelInput) modelInput.value = cfg.model;
    const timeoutInput = document.getElementById('ai-timeout-seconds');
    if (timeoutInput) timeoutInput.value = cfg.timeoutMs / 1000;
    const streamInput = document.getElementById('ai-stream-enabled');
    if (streamInput) streamInput.checked = cfg.stream;

    this.updateKeyBadge();
    this.updateAutomationSummary();
  },

  updateKeyBadge() {
    const cfg = this.getConfig();
    const badge = document.getElementById('ai-key-status-badge');
    if (!badge) return;

    if (cfg.apiKey) {
      badge.textContent = '[API 密钥已配置]';
      badge.className = 'ai-status-pill configured';
    } else {
      badge.textContent = '[未配置 API 密钥]';
      badge.className = 'ai-status-pill unconfigured';
    }
  },

  openModal(initialMode = 'new') {
    const modal = document.getElementById('ai-modal');
    if (!modal) return;

    this.loadConfig();
    this.switchTab('generate');
    this.setMode(initialMode);

    // If opening in refine or fix mode, populate relevant fields
    if (initialMode === 'refine' || initialMode === 'fix') {
      const editor = document.getElementById('script-editor');
      const currentScript = editor ? editor.value.trim() : '';
      const promptEl = document.getElementById('ai-prompt-input');

      if (initialMode === 'fix') {
        const errorEl = document.getElementById('script-error-toast');
        const errMsg = errorEl && errorEl.style.display !== 'none' ? errorEl.textContent : '';
        if (promptEl) {
          promptEl.value = errMsg ? `请修复以下 CCPL 脚本语法错误：\n${errMsg}` : '请检查并修复当前脚本中的语法或化学结构不匹配问题。';
        }
      } else if (promptEl && !promptEl.value.trim()) {
        promptEl.value = '在当前脚本各基元步骤之间优化过渡态机理，并补充详细机理说明。';
      }
    }

    this.updateActionButtons();
    modal.style.display = 'flex';
  },

  closeModal() {
    if (this.isGenerating) this.cancelGeneration();
    const modal = document.getElementById('ai-modal');
    if (modal) modal.style.display = 'none';
  },

  switchTab(tab) {
    this.currentTab = tab;
    const tabGen = document.getElementById('ai-tab-generate');
    const tabSet = document.getElementById('ai-tab-settings');
    const paneGen = document.getElementById('ai-pane-generate');
    const paneSet = document.getElementById('ai-pane-settings');

    if (tabGen) tabGen.classList.toggle('active', tab === 'generate');
    if (tabSet) tabSet.classList.toggle('active', tab === 'settings');
    if (paneGen) paneGen.style.display = tab === 'generate' ? 'block' : 'none';
    if (paneSet) paneSet.style.display = tab === 'settings' ? 'block' : 'none';
    const tabHistory = document.getElementById('ai-tab-history');
    const paneHistory = document.getElementById('ai-pane-history');
    if (tabHistory) tabHistory.classList.toggle('active', tab === 'history');
    if (paneHistory) paneHistory.style.display = tab === 'history' ? 'block' : 'none';
    if (tab === 'history') this.getHistoryManager()?.load();
  },

  setMode(mode) {
    this.currentMode = mode;
    const btnNew = document.getElementById('ai-mode-new');
    const btnRefine = document.getElementById('ai-mode-refine');
    const btnFix = document.getElementById('ai-mode-fix');
    const promptInput = document.getElementById('ai-prompt-input');
    const promptLabel = document.getElementById('ai-prompt-label');

    if (btnNew) btnNew.classList.toggle('active', mode === 'new');
    if (btnRefine) btnRefine.classList.toggle('active', mode === 'refine');
    if (btnFix) btnFix.classList.toggle('active', mode === 'fix');

    if (promptLabel) {
      if (mode === 'new') {
        promptLabel.textContent = '反应名称或推演要求：';
        if (promptInput) promptInput.placeholder = '例如: 乙酸乙酯酸催化水解机理；或 Diels-Alder 环加成反应推演...';
      } else if (mode === 'refine') {
        promptLabel.textContent = '完善与修改指示：';
        if (promptInput) promptInput.placeholder = '例如: 在第1步和第2步之间增加一个四面体加成态；或把氢原子补充为显式声明...';
      } else if (mode === 'fix') {
        promptLabel.textContent = '排错要求与报错信息：';
        if (promptInput) promptInput.placeholder = '输入脚本报错信息或需要纠正的错误结构...';
      }
    }
    this.updateScopeControls();
  },

  updateScopeControls() {
    const section = document.getElementById('ai-edit-scope');
    if (!section) return;
    section.style.display = this.currentMode === 'new' ? 'none' : 'block';
    const selected = document.getElementById('ai-scope-selected');
    const picker = document.getElementById('ai-step-picker');
    if (picker) picker.style.display = selected && selected.checked ? 'block' : 'none';
    if (this.currentMode !== 'new') this.refreshStepChoices();
    const limit = document.getElementById('ai-repair-limit');
    const auto = document.getElementById('ai-auto-repair');
    if (limit) limit.disabled = this.isGenerating || !auto || !auto.checked;
    this.updateAutomationSummary();
  },

  updateAutomationSummary() {
    const summary = document.getElementById('ai-automation-summary');
    if (!summary) return;
    const stream = document.getElementById('ai-stream-enabled');
    const display = !stream || stream.checked ? '自动显示生成过程' : '收到完整结果后再显示';
    const repairs = this.getRepairLimit();
    summary.textContent = `${display}；${repairs ? `检查失败时最多自动修正 ${repairs} 次` : '自动纠错已关闭，检查失败后可手动排错'}。`;
  },

  refreshStepChoices() {
    const container = document.getElementById('ai-step-options');
    const help = document.getElementById('ai-scope-help');
    if (!container || !AI_EDITING_TOOLS) return;
    const script = this.getWorkspace().script;
    if (this.scopeSourceText === script && container.childElementCount) return;
    this.scopeSourceText = script;
    container.replaceChildren();
    try {
      const source = AI_EDITING_TOOLS.documentOf(script);
      const current = window.reactionApp ? window.reactionApp.currentStepIndex : 0;
      for (const step of source.steps) {
        const label = document.createElement('label');
        label.className = 'ai-step-choice';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.value = String(step.index);
        input.checked = step.index === (Number.isInteger(current) && current < source.steps.length ? current : 0);
        input.disabled = this.isGenerating;
        const text = document.createElement('span');
        text.textContent = `第 ${step.index + 1} 步：${step.name}`;
        label.append(input, text); container.appendChild(label);
      }
      if (help) help.textContent = '未选中的步骤、反应名称和其他全局信息会保持原样；此模式不能增删步骤。';
    } catch (err) {
      if (help) help.textContent = err.message;
    }
  },

  getEditScope(base) {
    const selected = document.getElementById('ai-scope-selected');
    if (this.currentMode === 'new' || !selected || !selected.checked) return null;
    if (this.scopeSourceText !== null && this.scopeSourceText !== base.script) {
      this.refreshStepChoices();
      throw new Error('原稿已变化，请重新确认要修改的步骤后再生成');
    }
    const indices = [...document.querySelectorAll('#ai-step-options input:checked')].map(input => Number(input.value));
    return AI_EDITING_TOOLS.createScope(base.script, indices);
  },

  getRepairLimit() {
    const checkbox = document.getElementById('ai-auto-repair');
    if (!checkbox || !checkbox.checked) return 0;
    const select = document.getElementById('ai-repair-limit');
    const value = Number(select ? select.value : 2);
    return Number.isFinite(value) ? Math.max(0, Math.min(2, Math.floor(value))) : 2;
  },

  outputInstruction(task) {
    if (!task.scope) return task.mode !== 'new' && task.base.script.trimStart().startsWith('{') ? '请输出修改后的完整 JSON 脚本，保持未涉及的原子编号与步骤。' : '请输出完整 CCPL 脚本，保持未涉及的原子编号与步骤。';
    const names = task.scope.indices.map(index => `第 ${index + 1} 步（${task.scope.document.steps[index].name}）`).join('、');
    const format = task.scope.document.format === 'json' ? '仅输出 {"steps":[选中步骤对象...]}，不要输出其他根字段' : '仅输出选中的完整 step 块，不要输出 reaction、equation、summary 等全局指令';
    return `严格只修改 ${names}，按它们在原稿中的顺序返回，共 ${task.scope.indices.length} 步。${format}。不要增删步骤。程序将保持未选中的内容逐字不变，并将这些步骤合并回原稿。合并后的全部步骤仍需满足原子编号、元素计数和总电荷约束。`;
  },

  showCandidate(candidate) {
    this.candidate = candidate;
    this.lastGeneratedScript = candidate.script;
    const preview = document.getElementById('ai-preview-code');
    if (preview) preview.value = candidate.script;
    const box = document.getElementById('ai-preview-section');
    if (box) box.style.display = 'block';
    const title = document.getElementById('ai-preview-title');
    if (title) title.textContent = candidate.complete ? '生成脚本预览' : '未完成的生成片段';
    const note = document.getElementById('ai-stream-note');
    if (note) {
      note.style.display = candidate.complete ? 'none' : 'block';
      note.textContent = '生成未完整完成，以下片段仅供查看或复制，不能载入或推演。';
    }
    this.renderComparison(candidate.complete ? candidate : null);
  },

  startStreamAttempt(task) {
    this.stopStreamAttempt(task);
    task.streamEpoch = (task.streamEpoch || 0) + 1;
    task.previousCandidate = this.candidate && this.candidate.taskId === task.id ? this.candidate : null;
    task.streamText = '';
    task.receivedChars = 0;
    task.transport = null;
    task.progressPhase = task.repairAttempts ? `自动纠错 ${task.repairAttempts}/${task.repairLimit}，等待返回` : '等待模型返回脚本';
    this.candidate = null;
    this.lastGeneratedScript = '';
    const title = document.getElementById('ai-preview-title');
    if (title) title.textContent = task.repairAttempts ? `自动纠错 ${task.repairAttempts} · 临时预览` : '正在生成 · 临时预览';
    const note = document.getElementById('ai-stream-note');
    if (note) {
      note.style.display = 'block';
      note.textContent = task.scope ? '先逐步显示选中步骤的片段，接收完成后再合并原稿并检查。' : '正在接收的内容尚未检查，完成后才能载入；原稿保持不变。';
    }
    const progress = document.getElementById('ai-stream-progress');
    if (progress) { progress.style.display = 'flex'; progress.classList.toggle('is-receiving', true); }
    const preview = document.getElementById('ai-preview-code');
    if (preview) { preview.value = ''; preview.scrollTop = 0; }
    const box = document.getElementById('ai-preview-section');
    if (box) box.style.display = 'block';
    const copy = document.getElementById('ai-btn-copy');
    if (copy) copy.disabled = true;
    this.renderComparison(null);
    this.renderStreamPreview(task);
    if (box && typeof box.scrollIntoView === 'function' && this.currentTab === 'generate') box.scrollIntoView({ block: 'nearest' });
    const tick = () => {
      if (this.activeTask !== task) return;
      this.renderStreamProgress(task);
      task.clockTimer = setTimeout(tick, 1000);
    };
    if (progress) task.clockTimer = setTimeout(tick, 1000);
    return task.streamEpoch;
  },

  receiveStreamDelta(task, epoch, value) {
    if (this.activeTask !== task || task.streamEpoch !== epoch || task.controller.signal.aborted || !value.delta) return;
    const first = !task.streamText;
    task.streamText += value.delta;
    task.receivedChars = task.streamText.length;
    if (task.firstContentMs === undefined) task.firstContentMs = performance.now() - task.startedAt;
    task.progressPhase = task.repairAttempts ? `正在接收纠错结果 ${task.repairAttempts}/${task.repairLimit}` : '正在接收脚本';
    if (first) this.renderStreamPreview(task);
    else if (!task.previewTimer) task.previewTimer = setTimeout(() => {
      task.previewTimer = null;
      if (task.streamEpoch === epoch) this.renderStreamPreview(task);
    }, 80);
  },

  renderStreamProgress(task) {
    if (this.activeTask !== task) return;
    const progress = document.getElementById('ai-stream-progress-text');
    if (progress) progress.textContent = `${task.progressPhase} · 已用 ${Math.floor((performance.now() - task.startedAt) / 1000)} 秒 · 已收到 ${task.receivedChars || 0} 字符`;
  },

  renderStreamPreview(task) {
    if (this.activeTask !== task) return;
    const preview = document.getElementById('ai-preview-code');
    const follow = document.getElementById('ai-stream-follow');
    if (preview && preview.value !== task.streamText) {
      const previousScroll = preview.scrollTop;
      preview.value = task.streamText || '';
      preview.scrollTop = !follow || follow.checked ? preview.scrollHeight : previousScroll;
    }
    this.lastGeneratedScript = task.streamText || '';
    const copy = document.getElementById('ai-btn-copy');
    if (copy) copy.disabled = !this.lastGeneratedScript;
    this.renderStreamProgress(task);
  },

  stopStreamAttempt(task, phase) {
    clearTimeout(task.previewTimer); clearTimeout(task.clockTimer);
    task.previewTimer = null; task.clockTimer = null;
    if (phase) task.progressPhase = phase;
    if (this.activeTask === task && task.streamText !== undefined) this.renderStreamPreview(task);
  },

  preserveStreamDraft(task) {
    if (task.streamText) this.showCandidate({ taskId: task.id, base: task.base, scope: task.scope, raw: task.streamText, script: task.streamText, complete: false, validation: null, applied: false });
    else if (task.previousCandidate) this.showCandidate(task.previousCandidate);
  },

  finishStreamProgress(task, phase) {
    task.progressPhase = phase;
    this.renderStreamProgress(task);
    const progress = document.getElementById('ai-stream-progress');
    if (progress) progress.classList.toggle('is-receiving', false);
    if (!task.streamText && !this.candidate && task.status !== 'ready') {
      const title = document.getElementById('ai-preview-title');
      if (title) title.textContent = '暂无生成内容';
      const note = document.getElementById('ai-stream-note');
      if (note) note.textContent = '本次没有收到可显示的脚本文本；原稿保持不变。';
    }
  },

  renderComparison(candidate) {
    const section = document.getElementById('ai-comparison-section');
    if (!section || !AI_EDITING_TOOLS) return;
    section.style.display = candidate ? 'block' : 'none';
    if (!candidate) return;
    const before = document.getElementById('ai-compare-before');
    const after = document.getElementById('ai-compare-after');
    const summary = document.getElementById('ai-change-summary');
    const rows = document.getElementById('ai-diff-lines');
    if (before) before.value = candidate.base.script;
    if (after) after.value = candidate.script;
    if (rows) rows.replaceChildren();
    if (candidate.scopeError) {
      if (summary) summary.textContent = `回复尚未合并到原稿：${candidate.scopeError}。右侧仅显示本次回复，不能载入。`;
      return;
    }
    const diff = AI_EDITING_TOOLS.compare(candidate.base.script, candidate.script);
    candidate.comparison = diff;
    if (diff.unavailable) {
      if (summary) summary.textContent = '文本过长，未计算逐行变化；完整内容可在两侧查看。';
      return;
    }
    const changed = diff.changedSteps.map(step => `第 ${step.index + 1} 步`).join('、');
    const scope = candidate.scope ? `仅修改选中的 ${candidate.scope.indices.length} 个步骤；` : '';
    if (summary) summary.textContent = diff.identical ? '候选结果与生成开始时的草稿相同。' :
      `${scope}新增 ${diff.added} 行，删除 ${diff.removed} 行${changed ? `；变化步骤：${changed}` : ''}${diff.globalChanged ? '；全局信息有变化' : ''}${diff.lineEndingsOnly ? '；仅换行方式变化' : ''}${diff.approximate ? '；长文本按整段替换比较' : ''}${diff.truncated ? '；下方仅展示部分变化，完整内容见两侧文本' : ''}。`;
    if (rows) for (const row of diff.rows) {
      const line = document.createElement('div');
      line.className = `ai-diff-line ai-diff-${row.type}`;
      const prefix = row.type === 'add' ? '+' : row.type === 'remove' ? '−' : ' ';
      line.textContent = row.type === 'gap' ? row.text : `${prefix} ${row.oldLine || '·'} / ${row.newLine || '·'}  ${row.text.slice(0, 1200)}${row.text.length > 1200 ? '…' : ''}`;
      rows.appendChild(line);
    }
  },

  getWorkspace() {
    return AI_TASK_SAFETY.workspace(document.getElementById('script-editor'), window.reactionApp);
  },

  cancelGeneration(silent = false) {
    const task = this.activeTask;
    if (!task) return;
    this.stopStreamAttempt(task, '已中止，片段已保留');
    this.preserveStreamDraft(task);
    this.finishStreamProgress(task, '已中止，片段已保留');
    this.activeTask = null;
    task.status = 'cancelled';
    const history = this.getHistoryManager();
    if (task.streamText) history?.capture(task, this.candidate, true);
    history?.archive(task);
    task.controller.abort();
    this.abortController = null;
    this.setGenerating(false);
    if (!silent) this.updateStatusBadge('生成已中止，原草稿未改变', 'warning');
  },

  async handleAction() {
    if (!AI_TASK_SAFETY || !AI_EDITING_TOOLS) { this.showToast('AI 校验组件未加载，请刷新页面', true); return; }
    const cfg = this.getConfig();
    if (!cfg.apiKey && cfg.provider !== 'ollama') {
      this.showToast('请先在 [API 密钥与模型配置] 标签中填入 API Key！', true);
      this.switchTab('settings');
      return;
    }
    const promptInput = document.getElementById('ai-prompt-input');
    const userPrompt = promptInput ? promptInput.value.trim() : '';
    if (!userPrompt) { this.showToast('请输入反应名称或修改要求！', true); return; }
    const base = this.getWorkspace();
    let scope;
    try { scope = this.getEditScope(base); }
    catch (err) { this.showToast(err.message, true); return; }
    this.cancelGeneration(true);
    const task = {
      id: ++this.taskSequence,
      controller: new AbortController(),
      base,
      scope,
      mode: this.currentMode,
      status: 'generating',
      startedAt: performance.now(),
      repairLimit: this.getRepairLimit(),
      repairAttempts: 0,
      attempts: [],
      generationMs: 0,
      validationMs: 0
    };
    this.getHistoryManager()?.begin(task, cfg, userPrompt);
    task.deadlineAt = task.startedAt + (Number.isFinite(cfg.timeoutMs) && cfg.timeoutMs > 0 ? cfg.timeoutMs : 90000);
    this.activeTask = task;
    this.lastTask = task;
    this.abortController = task.controller;
    this.candidate = null;
    this.lastGeneratedScript = '';
    const preview = document.getElementById('ai-preview-code');
    if (preview) preview.value = '';
    const box = document.getElementById('ai-preview-section');
    if (box) box.style.display = 'none';
    this.renderComparison(null);
    const jsonOutput = task.scope ? task.scope.document.format === 'json' : task.mode !== 'new' && task.base.script.trimStart().startsWith('{');
    const formatOverride = jsonOutput ? '\n\n本次输出格式例外：使用合法 JSON，不要转换为 CCPL。' + (task.scope ? '仅返回包含 steps 数组的对象，数组中只有选中的步骤，不要返回全局字段。' : '返回修改后的完整 JSON 机理对象。') :
      task.scope ? '\n\n本次是指定步骤修改：只返回选中的完整 step 块，不要返回 reaction、equation、summary 等全局声明。' : '';
    const messages = [{ role: 'system', content: CCPL_SYSTEM_PROMPT + formatOverride }];
    if (task.mode === 'new') {
      messages.push({ role: 'user', content: `请为以下化学反应编写完整的 CCPL 反应推演脚本：\n【反应与机理要求】：${userPrompt}\n请严格遵循 CCPL 语法规范输出。` });
    } else {
      const action = task.mode === 'fix' ? '修复所有语法与结构问题' : '根据指示完善或修改';
      const language = task.base.script.trimStart().startsWith('{') ? 'json' : 'ccpl';
      messages.push({ role: 'user', content: `当前脚本：\n\`\`\`${language}\n${task.base.script}\n\`\`\`\n\n请${action}：\n${userPrompt}\n${this.outputInstruction(task)}` });
    }
    this.setGenerating(true);
    this.updateStatusBadge('正在生成，原草稿已保留...', 'pending');
    try {
      let requestMessages = messages;
      const failures = new Set();
      for (;;) {
        const remaining = task.deadlineAt - performance.now();
        if (remaining <= 0) throw AI_TASK_SAFETY.error('TIMEOUT', '任务超时，已停止自动纠错；原草稿未改变');
        const requestedAt = performance.now();
        const epoch = this.startStreamAttempt(task);
        const response = await this.callChatApi({ ...cfg, timeoutMs: remaining }, requestMessages, task.controller.signal, {
          onResponse: value => {
            if (this.activeTask !== task || task.streamEpoch !== epoch) return;
            task.transport = value.transport;
            task.progressPhase = value.transport === 'json' ? '接口将返回完整结果，等待接收完成' : '已连接，等待脚本文本';
            this.renderStreamProgress(task);
          },
          onDelta: cfg.stream === false ? undefined : value => this.receiveStreamDelta(task, epoch, value)
        });
        if (this.activeTask !== task) return;
        task.receivedChars = response.content.length;
        this.stopStreamAttempt(task, '接收完成，正在检查');
        const attempt = { generationMs: performance.now() - requestedAt, finishReason: response.finishReason, usage: response.usage, transport: response.transport };
        task.attempts.push(attempt);
        task.generationMs += attempt.generationMs;
        task.finishReason = response.finishReason;
        task.usage = response.usage;
        const issue = AI_TASK_SAFETY.completionIssue(response.finishReason);
        const candidate = { taskId: task.id, base: task.base, scope: task.scope, raw: response.content, script: response.content, complete: !issue, validation: null, applied: false };
        if (issue) {
          if (task.scope) candidate.scopeError = issue;
          this.showCandidate(candidate);
          this.getHistoryManager()?.capture(task, candidate);
          task.status = 'incomplete';
          this.updateStatusBadge(issue, 'warning');
          break;
        }
        const started = performance.now();
        try {
          const extracted = this.extractCCPL(response.content);
          candidate.script = task.scope ? AI_EDITING_TOOLS.mergeSelected(task.scope, extracted) : extracted;
          candidate.validation = this.validateGenerated(candidate.script);
        } catch (err) {
          candidate.scopeError = task.scope ? err.message : null;
          candidate.validation = { valid: false, diagnostics: [err.message], warnings: [], parsed: null };
        }
        task.validationMs += performance.now() - started;
        attempt.diagnostics = candidate.validation.diagnostics;
        this.showCandidate(candidate);
        this.getHistoryManager()?.capture(task, candidate);
        if (candidate.validation.valid) {
          task.status = 'ready';
          if (task.repairAttempts) this.updateStatusBadge(`自动纠错 ${task.repairAttempts} 次后脚本检查通过；化学机理仍需专业审核`, 'success');
          break;
        }
        task.status = 'invalid';
        const diagnostics = candidate.validation.diagnostics.join('；');
        const fingerprint = candidate.script + '\n' + diagnostics;
        let stop = '';
        if (candidate.validation.repairable === false) stop = '当前检查无法自动修复';
        else if (!AI_TASK_SAFETY.sameWorkspace(task.base, this.getWorkspace())) stop = '当前草稿或机理已变化，已停止自动纠错';
        else if (failures.has(fingerprint)) stop = '模型重复返回相同错误，已停止自动纠错';
        else if (task.repairAttempts >= task.repairLimit) stop = task.repairLimit ? '自动纠错次数已用完' : '校验未通过';
        if (stop) { this.updateStatusBadge(`${stop}：${diagnostics}`, 'warning'); break; }
        failures.add(fingerprint);
        task.repairAttempts++;
        this.updateStatusBadge(`检测到错误，正在自动纠错 ${task.repairAttempts}/${task.repairLimit}；原草稿未改变`, 'pending');
        requestMessages = [...messages,
          { role: 'assistant', content: response.content.slice(0, 200000) },
          { role: 'user', content: `上次输出未通过本地工具检查：\n${diagnostics}\n请根据这些诊断修复结果，保持原始需求。${this.outputInstruction(task)}\n只输出修复结果，不要解释。` }
        ];
      }
    } catch (err) {
      if (this.activeTask !== task) return;
      this.stopStreamAttempt(task, '生成中断，片段已保留');
      this.preserveStreamDraft(task);
      if (task.streamText) this.getHistoryManager()?.capture(task, this.candidate, true);
      task.status = err.name === 'AbortError' ? 'cancelled' : 'failed';
      task.errorCode = err.code || err.name;
      const message = err.name === 'AbortError' ? '生成已中止，原草稿未改变' : err.message;
      this.updateStatusBadge(message, 'warning');
      if (err.name !== 'AbortError') this.showToast(message, true);
    } finally {
      if (this.activeTask === task) {
        clearTimeout(task.previewTimer); clearTimeout(task.clockTimer);
        this.finishStreamProgress(task, task.status === 'ready' ? '已接收并完成检查' : '已结束，请查看状态提示');
        task.totalMs = performance.now() - task.startedAt;
        this.activeTask = null;
        this.abortController = null;
        this.setGenerating(false);
        this.getHistoryManager()?.archive(task);
      }
    }
  },

  async callChatApi(cfg, messages, signal, options = {}) {
    return AI_TASK_SAFETY.requestCompletion(cfg, messages, { ...options, signal });
  },

  extractCCPL(text) {
    return AI_TASK_SAFETY.extractScript(text);
  },

  validateGenerated(script) {
    const engine = typeof ReactionScriptEngine === 'undefined' ? null : ReactionScriptEngine;
    const result = AI_TASK_SAFETY.validateScript(script, engine);
    if (result.valid) {
      const warnings = result.warnings.length ? `；${result.warnings.join('；')}` : '';
      this.updateStatusBadge(`脚本检查通过 · ${result.parsed.steps.length} 步${warnings}；化学机理仍需专业审核`, 'success');
    } else {
      this.updateStatusBadge(`校验未通过：${result.diagnostics.join('；')}`, 'warning');
    }
    return result;
  },

  updateActionButtons() {
    const candidate = this.candidate;
    const ready = !this.isGenerating && candidate && candidate.complete && candidate.validation && candidate.validation.valid && !candidate.applied;
    for (const id of ['ai-btn-apply', 'ai-btn-run']) {
      const button = document.getElementById(id);
      if (button) button.disabled = !ready;
    }
    const copy = document.getElementById('ai-btn-copy');
    if (copy) copy.disabled = !this.lastGeneratedScript;
    const backup = this.readDraftBackup();
    for (const id of ['ai-btn-restore-draft', 'btn-ai-restore-draft']) {
      const button = document.getElementById(id);
      if (button) button.disabled = this.isGenerating || !backup;
    }
    const section = document.getElementById('ai-backup-section');
    if (section) section.style.display = backup ? 'block' : 'none';
    const code = document.getElementById('ai-backup-code');
    if (code) code.value = backup ? backup.before.script : '';
    if (this.historyManager) this.historyManager.updateControls();
  },

  updateStatusBadge(text, type = 'pending') {
    const badge = document.getElementById('ai-generation-status');
    if (!badge) return;

    badge.textContent = `[${text}]`;
    badge.className = `ai-status-badge ${type}`;
    badge.style.display = 'inline-block';
  },

  setGenerating(isGen) {
    this.isGenerating = isGen;
    const button = document.getElementById('ai-btn-generate');
    const cancel = document.getElementById('ai-btn-cancel');
    if (button) {
      button.disabled = isGen;
      button.textContent = isGen ? '正在生成推演脚本...' : '开始生成 / 修改';
    }
    if (cancel) cancel.style.display = isGen ? 'inline-block' : 'none';
    for (const id of ['ai-mode-new', 'ai-mode-refine', 'ai-mode-fix', 'ai-scope-all', 'ai-scope-selected', 'ai-auto-repair', 'ai-repair-limit', 'ai-stream-enabled']) {
      const control = document.getElementById(id);
      if (control) control.disabled = isGen;
    }
    for (const input of document.querySelectorAll('#ai-step-options input')) input.disabled = isGen;
    this.updateScopeControls();
    this.updateActionButtons();
  },

  backupStorageKey(owner = this.currentHistoryOwner()) {
    return owner === 'guest' ? AI_TASK_SAFETY.BACKUP_KEY : AI_TASK_SAFETY.BACKUP_KEY + ':' + encodeURIComponent(owner);
  },

  readDraftBackup() {
    const owner = this.currentHistoryOwner();
    if (this.lastDraftBackup && this.lastDraftBackupOwner === owner) return this.lastDraftBackup;
    try {
      const raw = localStorage.getItem(this.backupStorageKey(owner));
      const backup = raw ? JSON.parse(raw) : null;
      if (backup && (!backup.owner || backup.owner === owner) && backup.version === 1 && backup.before && typeof backup.before.script === 'string' && typeof backup.appliedScript === 'string' && backup.after) {
        this.lastDraftBackup = backup;
        this.lastDraftBackupOwner = owner;
        return backup;
      }
    } catch (_) { /* A missing or damaged backup never enables restoration. */ }
    return null;
  },

  saveDraftBackup(backup, owner = this.currentHistoryOwner()) {
    backup.owner = owner;
    localStorage.setItem(this.backupStorageKey(owner), JSON.stringify(backup));
    this.lastDraftBackup = backup;
    this.lastDraftBackupOwner = owner;
  },

  applyToWorkspace(runImmediately = false) {
    const candidate = this.candidate;
    if (this.isGenerating || !candidate || !candidate.complete || !candidate.validation || !candidate.validation.valid || candidate.applied) {
      this.showToast('结果尚未完整通过校验，不能载入；原草稿未改变', true);
      return false;
    }
    const editor = document.getElementById('script-editor');
    const app = window.reactionApp;
    if (candidate.historyRef && candidate.historyRef.owner !== this.currentHistoryOwner()) {
      this.showToast('账号已变化，请基于当前账号重新生成或选择历史版本', true);
      return false;
    }
    if (!editor || !AI_TASK_SAFETY.sameWorkspace(candidate.base, this.getWorkspace())) {
      this.showToast('当前草稿或机理已变化，未覆盖。请基于当前内容重新生成；候选结果仍可复制。', true);
      return false;
    }
    try { AI_EDITING_TOOLS.assertScope(candidate.scope, candidate.script); }
    catch (err) {
      candidate.validation = { valid: false, diagnostics: [err.message], warnings: [] };
      this.updateStatusBadge(err.message, 'warning');
      this.showToast(err.message, true);
      this.updateActionButtons();
      return false;
    }
    // Check again at the actual write boundary, including changes to the engine.
    const validation = this.validateGenerated(candidate.script);
    candidate.validation = validation;
    if (!validation.valid) { this.updateActionButtons(); return false; }
    if (app && Array.isArray(app.presets) && app.presets.some((p, index) => index !== app.currentReactionIndex && p.name.trim() === validation.parsed.name.trim())) {
      this.showToast('机理名称与其他作品重复，请修改后重新生成；原草稿未改变', true);
      return false;
    }
    let backup;
    try {
      backup = {
        version: 1,
        savedAt: new Date().toISOString(),
        before: candidate.base,
        after: candidate.base,
        appliedScript: candidate.script,
        reaction: app && app.presets && app.presets[app.currentReactionIndex] ? JSON.parse(JSON.stringify(app.presets[app.currentReactionIndex])) : null,
        ran: !!runImmediately
      };
      // Persistence must succeed before any editor or reaction is changed.
      this.saveDraftBackup(backup);
    } catch (_) {
      this.showToast('无法保存原草稿备份，本次未载入。请检查浏览器存储空间或权限。', true);
      return false;
    }
    editor.value = candidate.script;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    candidate.applied = true;
    if (app) {
      if (typeof app.switchTab === 'function') app.switchTab('script');
      if (runImmediately && typeof app.runCustomScript === 'function') app.runCustomScript();
    }
    backup.after = this.getWorkspace();
    try { this.saveDraftBackup(backup); }
    catch (_) { this.lastDraftBackup = backup; }
    this.updateActionButtons();
    this.getHistoryManager()?.applied(candidate.historyRef, this.lastTask && this.lastTask.historyRecord && candidate.historyRef && this.lastTask.historyRecord.id === candidate.historyRef.recordId ? this.lastTask.historyWrite : null);
    this.closeModal();
    return true;
  },

  restoreDraft() {
    const backup = this.readDraftBackup();
    if (!backup || this.isGenerating) return false;
    const current = this.getWorkspace();
    if (!AI_TASK_SAFETY.sameTarget(backup.after, current) || current.script !== backup.appliedScript) {
      this.showToast('当前草稿或机理已再次变化，未覆盖。可在 AI 面板“草稿备份”中复制原稿。', true);
      return false;
    }
    const app = window.reactionApp;
    if (backup.ran && backup.reaction && app && app.presets) {
      app.presets[app.currentReactionIndex] = JSON.parse(JSON.stringify(backup.reaction));
      if (typeof app.savePresetsToStorage === 'function') app.savePresetsToStorage();
      if (typeof app.loadReaction === 'function') app.loadReaction(app.currentReactionIndex);
      if (app.presetSelect && app.presetSelect.options[app.currentReactionIndex]) app.presetSelect.options[app.currentReactionIndex].textContent = `${app.currentReactionIndex + 1}. ${backup.reaction.name}`;
    }
    const editor = document.getElementById('script-editor');
    editor.value = backup.before.script;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    if (app && typeof app.switchTab === 'function') app.switchTab('script');
    try { localStorage.removeItem(this.backupStorageKey()); } catch (_) { /* Keep the backup available if storage is read-only. */ }
    this.lastDraftBackup = null;
    this.candidate = null;
    this.lastGeneratedScript = '';
    this.renderComparison(null);
    this.updateActionButtons();
    this.showToast('已恢复 AI 载入前的草稿', false);
    return true;
  },

  async testConnection() {
    const cfg = this.getConfig();
    if (this.connectionController) this.connectionController.abort();
    const controller = new AbortController();
    this.connectionController = controller;
    const result = document.getElementById('ai-test-result');
    const button = document.getElementById('ai-btn-test-conn');
    if (button) button.disabled = true;
    if (result) { result.textContent = '正在测试连接...'; result.className = 'ai-test-result pending'; result.style.display = 'block'; }
    try {
      await AI_TASK_SAFETY.requestCompletion({ ...cfg, stream: false, timeoutMs: Math.min(cfg.timeoutMs || 90000, 15000) }, [{ role: 'user', content: 'hi' }], { signal: controller.signal, maxTokens: 5 });
      if (this.connectionController !== controller) return;
      if (result) { result.textContent = 'API 连接成功；端点与模型已响应。'; result.className = 'ai-test-result success'; }
      this.updateKeyBadge();
    } catch (err) {
      if (this.connectionController !== controller) return;
      if (result) { result.textContent = `连接失败：${err.message}`; result.className = 'ai-test-result error'; }
    } finally {
      if (this.connectionController === controller) {
        this.connectionController = null;
        if (button) button.disabled = false;
      }
    }
  },

  showToast(msg, isError = false) {
    const el = document.getElementById('ai-modal-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `ai-modal-toast ${isError ? 'error' : 'success'}`;
    el.style.display = 'block';
    setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 3500);
  },

  bindEvents() {
    // Tab switching
    const tabGen = document.getElementById('ai-tab-generate');
    const tabSet = document.getElementById('ai-tab-settings');
    if (tabGen) tabGen.addEventListener('click', () => this.switchTab('generate'));
    if (tabSet) tabSet.addEventListener('click', () => this.switchTab('settings'));
    const tabHistory = document.getElementById('ai-tab-history');
    if (tabHistory) tabHistory.addEventListener('click', () => this.switchTab('history'));

    // Mode switching
    const btnNew = document.getElementById('ai-mode-new');
    const btnRefine = document.getElementById('ai-mode-refine');
    const btnFix = document.getElementById('ai-mode-fix');
    if (btnNew) btnNew.addEventListener('click', () => this.setMode('new'));
    if (btnRefine) btnRefine.addEventListener('click', () => this.setMode('refine'));
    if (btnFix) btnFix.addEventListener('click', () => this.setMode('fix'));
    const streamInput = document.getElementById('ai-stream-enabled');
    if (streamInput) streamInput.addEventListener('change', () => {
      this.saveConfig({ stream: streamInput.checked });
      this.updateAutomationSummary();
    });
    const repairLimit = document.getElementById('ai-repair-limit');
    if (repairLimit) repairLimit.addEventListener('change', () => this.updateAutomationSummary());
    const follow = document.getElementById('ai-stream-follow');
    const streamPreview = document.getElementById('ai-preview-code');
    if (follow && streamPreview) {
      follow.addEventListener('change', () => { if (follow.checked) streamPreview.scrollTop = streamPreview.scrollHeight; });
      streamPreview.addEventListener('scroll', () => {
        if (this.isGenerating && streamPreview.scrollHeight - streamPreview.scrollTop - streamPreview.clientHeight > 32) follow.checked = false;
      });
    }
    for (const id of ['ai-scope-all', 'ai-scope-selected', 'ai-auto-repair']) {
      const control = document.getElementById(id);
      if (control) control.addEventListener('change', () => this.updateScopeControls());
    }

    // Prompt chips
    const chips = document.querySelectorAll('.ai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const promptInput = document.getElementById('ai-prompt-input');
        if (promptInput) {
          promptInput.value = chip.getAttribute('data-prompt') || chip.textContent;
        }
      });
    });

    // Action button
    const btnGenerate = document.getElementById('ai-btn-generate');
    if (btnGenerate) btnGenerate.addEventListener('click', () => this.handleAction());

    const btnCancel = document.getElementById('ai-btn-cancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.cancelGeneration();
      });
    }

    // Apply & Run buttons
    const btnApply = document.getElementById('ai-btn-apply');
    if (btnApply) btnApply.addEventListener('click', () => this.applyToWorkspace(false));

    const btnRun = document.getElementById('ai-btn-run');
    if (btnRun) btnRun.addEventListener('click', () => this.applyToWorkspace(true));

    for (const id of ['ai-btn-restore-draft', 'btn-ai-restore-draft']) {
      const button = document.getElementById(id);
      if (button) button.addEventListener('click', () => this.restoreDraft());
    }
    const editor = document.getElementById('script-editor');
    if (editor) editor.addEventListener('input', () => this.updateActionButtons());

    const btnCopy = document.getElementById('ai-btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (this.lastGeneratedScript) {
          navigator.clipboard.writeText(this.lastGeneratedScript).then(() => {
            this.showToast('已复制脚本到剪贴板！', false);
          });
        }
      });
    }

    // Provider select change
    const providerSel = document.getElementById('ai-provider-select');
    if (providerSel) {
      providerSel.addEventListener('change', (e) => {
        const provKey = e.target.value;
        const preset = AI_PROVIDERS[provKey];
        if (preset) {
          const baseUrlInput = document.getElementById('ai-base-url');
          const modelInput = document.getElementById('ai-model-name');
          if (baseUrlInput) baseUrlInput.value = preset.baseUrl;
          if (modelInput) modelInput.value = preset.defaultModel;
        }
      });
    }

    // Save config button
    const btnSaveCfg = document.getElementById('ai-btn-save-config');
    if (btnSaveCfg) {
      btnSaveCfg.addEventListener('click', () => {
        const provider = document.getElementById('ai-provider-select')?.value || 'deepseek';
        const baseUrl = document.getElementById('ai-base-url')?.value || '';
        const apiKey = document.getElementById('ai-api-key')?.value || '';
        const model = document.getElementById('ai-model-name')?.value || '';

        const timeoutSeconds = document.getElementById('ai-timeout-seconds')?.value || 90;
        this.saveConfig({ provider, baseUrl, apiKey, model, timeoutSeconds });
        this.updateKeyBadge();
        this.showToast('API 与模型配置已安全保存！', false);
      });
    }

    // Test connection button
    const btnTest = document.getElementById('ai-btn-test-conn');
    if (btnTest) btnTest.addEventListener('click', () => this.testConnection());

    // Clear key button
    const btnClearKey = document.getElementById('ai-btn-clear-key');
    if (btnClearKey) {
      btnClearKey.addEventListener('click', () => {
        const apiKeyInput = document.getElementById('ai-api-key');
        if (apiKeyInput) apiKeyInput.value = '';
        localStorage.removeItem(this.KEYS.API_KEY);
        this.updateKeyBadge();
        this.showToast('API 密钥已从本地存储清除', false);
      });
    }

    // Password visibility toggle
    const toggleEye = document.getElementById('ai-toggle-key-visibility');
    if (toggleEye) {
      toggleEye.addEventListener('click', () => {
        const apiKeyInput = document.getElementById('ai-api-key');
        if (apiKeyInput) {
          apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
        }
      });
    }

    // Modal close buttons
    const closeBtns = document.querySelectorAll('.close-ai-modal');
    closeBtns.forEach(btn => btn.addEventListener('click', () => this.closeModal()));

    const modal = document.getElementById('ai-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    }
  }
};

if (typeof window !== 'undefined') {
  window.aiAssistant = aiAssistant;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { aiAssistant, AI_PROVIDERS, CCPL_SYSTEM_PROMPT };
}
