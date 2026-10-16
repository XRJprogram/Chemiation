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
   - 步进真实性：至少包含 2~4 个确切的基元步骤（例如：底物靠近活化 -> 亲核进攻/中间体生成 -> 消除离去/产物生成）。
   - 元素符号必须是合法的 IUPAC 化学元素符号（如 C, H, O, N, P, S, Cl, Br, Mg, Cu, Fe 等）。
   - 若用户无特殊指定三维坐标，原子声明请直接使用 "atom <ID> <元素>"，交由引擎智能解算，避免坐标冲突。

4. 输出格式约束：
   - 只输出纯净合法的 CCPL 脚本文本，严禁输出任何寒暄、前言或总结废话。
   - 若使用 Markdown 代码块，必须使用 \`\`\`ccpl ... \`\`\`。`;

const aiAssistant = {
  currentTab: 'generate', // 'generate' | 'settings'
  currentMode: 'new', // 'new' | 'refine' | 'fix'
  abortController: null,
  isGenerating: false,
  lastGeneratedScript: '',

  // Storage keys
  KEYS: {
    PROVIDER: 'chemiation_ai_provider',
    BASE_URL: 'chemiation_ai_base_url',
    API_KEY: 'chemiation_ai_api_key',
    MODEL: 'chemiation_ai_model'
  },

  init() {
    this.bindEvents();
    this.loadConfig();
  },

  getConfig() {
    const provider = localStorage.getItem(this.KEYS.PROVIDER) || 'deepseek';
    const preset = AI_PROVIDERS[provider] || AI_PROVIDERS.deepseek;
    const baseUrl = localStorage.getItem(this.KEYS.BASE_URL) || preset.baseUrl;
    const apiKey = localStorage.getItem(this.KEYS.API_KEY) || '';
    const model = localStorage.getItem(this.KEYS.MODEL) || preset.defaultModel;

    return { provider, baseUrl, apiKey, model };
  },

  saveConfig(cfg) {
    if (cfg.provider) localStorage.setItem(this.KEYS.PROVIDER, cfg.provider);
    if (cfg.baseUrl !== undefined) localStorage.setItem(this.KEYS.BASE_URL, cfg.baseUrl.trim());
    if (cfg.apiKey !== undefined) localStorage.setItem(this.KEYS.API_KEY, cfg.apiKey.trim());
    if (cfg.model !== undefined) localStorage.setItem(this.KEYS.MODEL, cfg.model.trim());
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

    this.updateKeyBadge();
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

    modal.style.display = 'flex';
  },

  closeModal() {
    if (this.isGenerating && this.abortController) {
      this.abortController.abort();
    }
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
  },

  async handleAction() {
    const cfg = this.getConfig();
    if (!cfg.apiKey && cfg.provider !== 'ollama') {
      this.showToast('请先在 [API 密钥与模型配置] 标签中填入 API Key！', true);
      this.switchTab('settings');
      return;
    }

    const promptInput = document.getElementById('ai-prompt-input');
    const userPrompt = promptInput ? promptInput.value.trim() : '';
    if (!userPrompt) {
      this.showToast('请输入反应名称或修改要求！', true);
      return;
    }

    const editor = document.getElementById('script-editor');
    const currentScript = editor ? editor.value.trim() : '';

    let messages = [
      { role: 'system', content: CCPL_SYSTEM_PROMPT }
    ];

    if (this.currentMode === 'new') {
      messages.push({
        role: 'user',
        content: `请为以下化学反应编写完整的 CCPL 反应推演脚本：\n【反应与机理要求】：${userPrompt}\n请严格遵循 CCPL 语法规范输出。`
      });
    } else if (this.currentMode === 'refine') {
      messages.push({
        role: 'user',
        content: `这是当前编辑器中的 CCPL 脚本：\n\`\`\`ccpl\n${currentScript}\n\`\`\`\n\n请根据以下指示进行完善或修改：\n【修改指示】：${userPrompt}\n请输出修改完善后的完整 CCPL 脚本。`
      });
    } else if (this.currentMode === 'fix') {
      messages.push({
        role: 'user',
        content: `这是当前存在语法或结构错误的 CCPL 脚本：\n\`\`\`ccpl\n${currentScript}\n\`\`\`\n\n错误或排错要求：\n${userPrompt}\n\n请修复所有语法与结构问题，输出修正后的完整 CCPL 脚本。`
      });
    }

    this.setGenerating(true);
    this.updateStatusBadge('正在请求大模型生成推演脚本...', 'pending');

    try {
      this.abortController = new AbortController();
      const rawResult = await this.callChatApi(cfg, messages, this.abortController.signal);
      const cleanScript = this.extractCCPL(rawResult);

      this.lastGeneratedScript = cleanScript;
      const previewEl = document.getElementById('ai-preview-code');
      if (previewEl) previewEl.value = cleanScript;

      const previewBox = document.getElementById('ai-preview-section');
      if (previewBox) previewBox.style.display = 'block';

      // Validate with engine
      this.validateGenerated(cleanScript);
    } catch (err) {
      if (err.name === 'AbortError') {
        this.updateStatusBadge('生成已由用户中止', 'warning');
      } else {
        this.updateStatusBadge(`生成失败: ${err.message}`, 'error');
        this.showToast(`AI 生成错误: ${err.message}`, true);
      }
    } finally {
      this.setGenerating(false);
    }
  },

  async callChatApi(cfg, messages, signal) {
    let endpoint = cfg.baseUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (cfg.apiKey) {
      headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    }

    const payload = {
      model: cfg.model,
      messages,
      temperature: 0.2
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error && errJson.error.message) {
          errMsg = errJson.error.message;
        }
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API 返回的数据结构不包含有效回复');
    }

    return data.choices[0].message.content || '';
  },

  extractCCPL(text) {
    if (!text) return '';
    // Strip markdown code fences if present
    const codeBlockMatch = text.match(/```(?:ccpl|chem|script)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return text.trim();
  },

  validateGenerated(script) {
    if (typeof ReactionScriptEngine === 'undefined') {
      this.updateStatusBadge('脚本已生成', 'success');
      return;
    }

    try {
      const parsed = ReactionScriptEngine.parse(script);
      const stepCount = parsed.steps ? parsed.steps.length : 0;
      this.updateStatusBadge(`语法校验通过 · 包含 ${stepCount} 个推演步骤 (${parsed.name || '反应'})`, 'success');
    } catch (err) {
      this.updateStatusBadge(`语法校验提示: ${err.message}`, 'warning');
    }
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
    const btnRun = document.getElementById('ai-btn-generate');
    const btnCancel = document.getElementById('ai-btn-cancel');

    if (btnRun) {
      btnRun.disabled = isGen;
      btnRun.textContent = isGen ? '正在生成推演脚本...' : '开始生成 / 修改';
    }
    if (btnCancel) {
      btnCancel.style.display = isGen ? 'inline-block' : 'none';
    }
  },

  applyToWorkspace(runImmediately = false) {
    if (!this.lastGeneratedScript) {
      this.showToast('没有可载入的脚本！', true);
      return;
    }

    const editor = document.getElementById('script-editor');
    if (editor) {
      editor.value = this.lastGeneratedScript;
      // Trigger input event to update line gutters
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    this.closeModal();

    if (window.reactionApp) {
      // Switch to script tab
      if (typeof window.reactionApp.switchTab === 'function') {
        window.reactionApp.switchTab('script');
      }
      if (runImmediately && typeof window.reactionApp.runCustomScript === 'function') {
        window.reactionApp.runCustomScript();
      }
    }
  },

  async testConnection() {
    const cfg = this.getConfig();
    const resultEl = document.getElementById('ai-test-result');
    if (resultEl) {
      resultEl.textContent = '正在测试连接...';
      resultEl.className = 'ai-test-result pending';
      resultEl.style.display = 'block';
    }

    try {
      let endpoint = cfg.baseUrl.replace(/\/+$/, '');
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint += '/chat/completions';
      }

      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
      }

      if (resultEl) {
        resultEl.textContent = 'API 连接成功！模型与端点响应正常。';
        resultEl.className = 'ai-test-result success';
      }
      this.updateKeyBadge();
    } catch (err) {
      if (resultEl) {
        resultEl.textContent = `连接失败: ${err.message}`;
        resultEl.className = 'ai-test-result error';
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

    // Mode switching
    const btnNew = document.getElementById('ai-mode-new');
    const btnRefine = document.getElementById('ai-mode-refine');
    const btnFix = document.getElementById('ai-mode-fix');
    if (btnNew) btnNew.addEventListener('click', () => this.setMode('new'));
    if (btnRefine) btnRefine.addEventListener('click', () => this.setMode('refine'));
    if (btnFix) btnFix.addEventListener('click', () => this.setMode('fix'));

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
        if (this.abortController) this.abortController.abort();
      });
    }

    // Apply & Run buttons
    const btnApply = document.getElementById('ai-btn-apply');
    if (btnApply) btnApply.addEventListener('click', () => this.applyToWorkspace(false));

    const btnRun = document.getElementById('ai-btn-run');
    if (btnRun) btnRun.addEventListener('click', () => this.applyToWorkspace(true));

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

        this.saveConfig({ provider, baseUrl, apiKey, model });
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
