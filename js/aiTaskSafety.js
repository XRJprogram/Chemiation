/* Shared safeguards for AI responses. No network provider or DOM dependency. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChemiationAISafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const streamReader = typeof ChemiationAIStream !== 'undefined' ? ChemiationAIStream :
    (typeof require === 'function' ? require('./aiStream.js') : null);

  const ELEMENTS = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og R X M').split(' '));
  const BACKUP_KEY = 'chemiation_ai_draft_backup_v1';
  function error(code, message) {
    const result = new Error(message);
    result.code = code;
    if (code === 'CANCELLED') result.name = 'AbortError';
    if (code === 'TIMEOUT') result.name = 'TimeoutError';
    return result;
  }

  // The deadline covers both response headers and body, even if a transport
  // ignores AbortSignal. Late completions are consumed by Promise.race.
  async function requestCompletion(cfg, messages, options = {}) {
    const signal = options.signal;
    if (signal && signal.aborted) throw error('CANCELLED', '请求已中止');
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(cfg.timeoutMs) && cfg.timeoutMs > 0 ? cfg.timeoutMs : 90000;
    let timer;
    let onAbort;
    let accepting = true;
    const callback = (name, value) => {
      if (accepting && !controller.signal.aborted && typeof options[name] === 'function') options[name](value);
    };
    const interrupted = new Promise((_, reject) => {
      onAbort = () => { reject(error('CANCELLED', '请求已中止')); controller.abort(); };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        reject(error('TIMEOUT', `请求超时（${Math.round(timeoutMs / 1000)} 秒），草稿未改变`));
        controller.abort();
      }, timeoutMs);
    });
    const work = (async () => {
      let endpoint = String(cfg.baseUrl || '').replace(/\/+$/, '');
      if (!endpoint) throw error('CONFIG', '请配置 API 端点');
      if (!endpoint.endsWith('/chat/completions')) endpoint += '/chat/completions';
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      const payload = { model: cfg.model, messages, temperature: 0.2 };
      if (cfg.stream !== false) payload.stream = true;
      if (options.maxTokens) payload.max_tokens = options.maxTokens;
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
      if (!res.ok) {
        // Do not echo arbitrary provider response bodies (which may include
        // credentials or user text) into the interface or diagnostic logs.
        const hints = { 400: '请求格式错误，请检查端点和参数', 401: '认证失败，请检查 API Key', 402: '账户余额不足', 403: '没有访问权限', 404: '端点或模型不存在', 422: '模型参数不兼容', 429: '请求频率受限，请稍后重试', 500: '模型服务异常，请稍后重试', 502: '模型网关异常，请稍后重试', 503: '模型服务繁忙，请稍后重试', 504: '模型网关超时，请稍后重试' };
        throw error('HTTP_' + res.status, `HTTP ${res.status}：${hints[res.status] || '请求失败，请检查服务配置'}`);
      }
      const contentType = res.headers && res.headers.get ? res.headers.get('content-type') || '' : '';
      if (/^text\/event-stream\b/i.test(contentType)) {
        if (!streamReader) throw error('STREAM_UNAVAILABLE', '流式组件未加载，请刷新页面');
        callback('onResponse', { transport: 'stream' });
        return streamReader.readCompletion(res, { signal: controller.signal, onDelta: value => callback('onDelta', value) });
      }
      callback('onResponse', { transport: 'json' });
      let data;
      try { data = await res.json(); } catch (_) { throw error('INVALID_RESPONSE', '接口未返回有效 JSON，请检查兼容端点'); }
      const choice = data && Array.isArray(data.choices) && data.choices[0];
      if (!choice || !choice.message || typeof choice.message.content !== 'string') throw error('INVALID_RESPONSE', '接口回复缺少文本内容');
      return { content: choice.message.content, finishReason: choice.finish_reason || null, usage: data.usage || null, transport: 'json' };
    })();
    try { return await Promise.race([work, interrupted]); }
    finally {
      accepting = false;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  function completionIssue(reason) {
    if (reason === 'stop') return '';
    if (reason === 'length') return '输出已截断，不能载入。请缩小生成范围或调整模型输出上限后重新生成。';
    if (reason === 'content_filter') return '模型未完整输出内容（内容过滤），不能载入。';
    if (!reason) return '接口未返回完成标记，无法确认输出完整性，不能载入。';
    return `模型未正常完成（${reason}），结果不完整，不能载入。`;
  }

  function extractScript(text) {
    const input = String(text || '').trim();
    const fences = input.match(/```/g) || [];
    if (!fences.length) return input;
    if (fences.length !== 2) throw error('SCRIPT_FENCE', '代码块未闭合或包含多个代码块，请重新生成完整的单个 CCPL 脚本');
    const block = input.match(/```(?:ccpl|chem|script|json)?[ \t]*\r?\n?([\s\S]*?)```/i);
    if (!block) throw error('SCRIPT_FENCE', '无法识别脚本代码块');
    return block[1].trim();
  }

  function validateScript(script, engine) {
    const diagnostics = [];
    const warnings = [];
    let parsed = null;
    if (!engine || typeof engine.parse !== 'function') return { valid: false, parsed, diagnostics: ['校验器未加载，无法确认脚本有效性'], warnings, repairable: false };
    if (typeof script !== 'string' || !script.trim()) return { valid: false, parsed, diagnostics: ['脚本为空'], warnings };
    if (script.length > 200000) return { valid: false, parsed, diagnostics: ['脚本过长，请分步生成（最多 200000 字符）'], warnings, repairable: false };
    try {
      parsed = engine.parse(script);
      if (!parsed || !Array.isArray(parsed.steps) || !parsed.steps.length) throw new Error('缺少有效反应步骤');
      const identities = new Map();
      let baseline;
      let placeholders = false;
      for (const [index, step] of parsed.steps.entries()) {
        const prefix = `第 ${index + 1} 步`;
        if (!Array.isArray(step.atoms) || !step.atoms.length || !Array.isArray(step.bonds)) throw new Error(`${prefix}缺少原子或化学键数组`);
        const ids = new Set();
        const counts = new Map();
        let charge = 0;
        for (const atom of step.atoms) {
          if (!atom.id || ids.has(atom.id)) throw new Error(`${prefix}原子编号缺失或重复`);
          ids.add(atom.id);
          if (!ELEMENTS.has(atom.element)) throw new Error(`${prefix}存在未知元素 ${atom.element}`);
          if (identities.has(atom.id) && identities.get(atom.id) !== atom.element) throw new Error(`${prefix}原子 ${atom.id} 的元素发生变化`);
          identities.set(atom.id, atom.element);
          if (!['x', 'y', 'z'].every(key => Number.isFinite(atom[key]))) throw new Error(`${prefix}原子 ${atom.id} 坐标无效`);
          if (!Number.isInteger(atom.charge || 0)) throw new Error(`${prefix}原子 ${atom.id} 的形式电荷无效`);
          charge += atom.charge || 0;
          counts.set(atom.element, (counts.get(atom.element) || 0) + 1);
          if (['R', 'X', 'M'].includes(atom.element)) placeholders = true;
        }
        for (const bond of step.bonds) {
          if (!ids.has(bond.atom1Id) || !ids.has(bond.atom2Id) || bond.atom1Id === bond.atom2Id) throw new Error(`${prefix}化学键原子引用无效`);
          if (![1, 1.5, 2, 3].includes(bond.order === undefined ? 1 : bond.order)) throw new Error(`${prefix}化学键键级无效`);
        }
        if (baseline) {
          const elements = new Set([...baseline.counts.keys(), ...counts.keys()]);
          const changed = [...elements].filter(el => (baseline.counts.get(el) || 0) !== (counts.get(el) || 0));
          if (changed.length) throw new Error(`${prefix}元素计数与第一步不守恒（${changed.join('、')}），请显式补齐原料和副产物`);
          if (charge !== baseline.charge) throw new Error(`${prefix}总电荷与第一步不守恒`);
          const missing = [...baseline.ids].filter(id => !ids.has(id));
          const added = [...ids].filter(id => !baseline.ids.has(id));
          if (missing.length || added.length) {
            const describe = values => values.slice(0, 8).join('、') + (values.length > 8 ? '等' : '');
            const details = [missing.length ? `缺少 ${describe(missing)}` : '', added.length ? `新增 ${describe(added)}` : ''].filter(Boolean).join('；');
            throw new Error(`${prefix}原子编号与第一步不一致（${details}），请让同一原子在所有步骤使用相同编号；涉及氢转移时请显式声明氢原子`);
          }
        } else baseline = { counts, charge, ids };
      }
      if (placeholders) warnings.push('含通用基团，仅检查符号计数，具体组成待审核');
      if (parsed.steps.length === 1) warnings.push('单步结果，未进行跨步骤守恒比较');
    } catch (err) { diagnostics.push(err.message || '脚本校验失败'); }
    return { valid: diagnostics.length === 0, parsed, diagnostics, warnings };
  }

  function workspace(editor, app) {
    const index = app && Number.isInteger(app.currentReactionIndex) ? app.currentReactionIndex : null;
    const reaction = index !== null && app.presets ? app.presets[index] : null;
    return { script: editor ? editor.value : '', reactionIndex: index, reactionId: reaction ? reaction.id || null : null };
  }
  function sameTarget(a, b) { return a.reactionIndex === b.reactionIndex && a.reactionId === b.reactionId; }
  function sameWorkspace(a, b) { return sameTarget(a, b) && a.script === b.script; }

  return { BACKUP_KEY, error, requestCompletion, completionIssue, extractScript, validateScript, workspace, sameTarget, sameWorkspace };
});
