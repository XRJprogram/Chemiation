/* Loaded only by the local /experience route, never by the normal application. */
window.addEventListener('load', () => {
  const ai = window.aiAssistant, studio = window.chemiationStudio;
  const realConfig = ai.getConfig.bind(ai);
  const demoConfig = () => ({ provider: 'custom', baseUrl: location.origin + '/__preview__/v1', model: 'local-sn2-example', apiKey: 'local-example-only', timeoutMs: 90000 });
  const modeKey = 'chemiation_preview_mode';
  let mode = new URL(location.href).searchParams.get('mode');
  if (!['real', 'demo'].includes(mode)) { try { mode = sessionStorage.getItem(modeKey); } catch (_) { /* URL mode still works without storage. */ } }
  if (!['real', 'demo'].includes(mode)) mode = 'demo';
  const bar = document.createElement('div'); bar.className = 'guided-preview-bar';
  const label = document.createElement('span'); label.textContent = '本地示例 · 固定 SN2 响应，未调用真实模型';
  const start = document.createElement('button'); start.textContent = '开始完整体验';
  const real = document.createElement('button'); real.textContent = '使用真实模型';
  const status = document.createElement('span'); status.className = 'guided-preview-status'; status.setAttribute('role', 'status');
  bar.append(label, start, real, status);
  const style = document.createElement('style');
  style.textContent = '.guided-preview-bar{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:7px;padding:5px 12px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);font-family:var(--font-sans);font-size:11px;line-height:1.5;color:var(--color-mid-brown);flex-shrink:0}.guided-preview-bar button{border:1px solid var(--border-color);background:var(--bg-primary);color:var(--color-accent);border-radius:6px;padding:3px 8px;font:inherit;cursor:pointer}.guided-preview-bar button:hover{background:var(--color-accent-soft);border-color:var(--color-accent)}.guided-preview-bar button:disabled{opacity:.4;cursor:default}.guided-preview-status:empty{display:none}.guided-preview-status{color:var(--color-accent)}';
  document.head.append(style); document.querySelector('.header-bar').after(bar);
  function applyMode() {
    ai.getConfig = mode === 'real' ? realConfig : demoConfig;
    label.textContent = mode === 'real' ? '真实模型模式 · 请求发往你保存的模型接口' : '本地示例 · 固定 SN2 响应，未调用真实模型';
    start.textContent = mode === 'real' ? '测试真实模型完整流程' : '开始完整体验';
    real.textContent = mode === 'real' ? '返回本地示例' : '使用真实模型';
    try { sessionStorage.setItem(modeKey, mode); } catch (_) { /* Keep the current mode in memory. */ }
    const url = new URL(location.href); url.searchParams.set('mode', mode);
    history.replaceState(null, '', url);
  }
  applyMode();
  document.getElementById('studio-messages').addEventListener('click', e => { if (e.target.closest('button')) status.textContent = ''; });
  document.getElementById('studio-messages').addEventListener('submit', () => { status.textContent = ''; });
  real.addEventListener('click', () => {
    if (studio.busy || studio.loading || studio.committing) { status.textContent = '请先等待或停止本轮生成。'; return; }
    status.textContent = ''; mode = mode === 'demo' ? 'real' : 'demo';
    applyMode();
    if (mode === 'real') { ai.openModal('new', { legacy: true }); ai.switchTab('settings'); }
  });
  start.addEventListener('click', async () => {
    if (studio.busy || studio.loading || studio.committing) { status.textContent = '请先等待或停止本轮生成。'; return; }
    status.textContent = ''; start.disabled = true;
    try {
      const cfg = ai.getConfig();
      if (mode === 'real' && !cfg.apiKey && cfg.provider !== 'ollama') {
        status.textContent = '请先保存自己的模型配置，再点击测试。';
        ai.openModal('new', { legacy: true }); ai.switchTab('settings'); return;
      }
      const previousId = studio.session.id;
      await studio.newSession(); studio.show();
      if (studio.session.id === previousId) { status.textContent = '新对话尚未创建成功，请检查保存提示后重试。'; return; }
      await studio.submit(mode === 'real'
        ? '请新生成“苯乙烯溴加成真实模型测试”的完整 CCPL 动画。先不要输出脚本，请先用问题表单询问我希望采用“基础教学版”还是“详细机理版”，提供选项并允许自由补充，收到回答后再生成。反应对象为苯乙烯 C6H5—CH=CH2 与 Br2，采用无水、非亲核介质中的教学模型，产物为 C6H5—CHBr—CH2Br。依次展示反应物、桥式溴鎓离子与 Br−、溴离子背面进攻开环后的产物。苯环保持芳香性，突出侧链键级与形式电荷变化。全体系始终包含 8 个碳、8 个氢、2 个溴，总电荷为 0，原子编号保持一致。按顺序输出完整闭合的步骤，让左侧随通过基础检查的完整步骤逐步预览，最后给出可播放的完整脚本。'
        : '请生成溴甲烷与氢氧根发生 SN2 反应的动画。先问我希望采用基础教学版还是详细讲解版，回答后再生成完整脚本。');
      if (mode === 'real' && !studio.busy && studio.session.workflow?.stage === 'information' && document.querySelector('#studio-messages .studio-match')) {
        status.textContent = '找到相近机理；要测试新生成，请点聊天中的“根据我的要求重新推演”。';
      }
    } catch (e) { status.textContent = e.message; }
    finally { start.disabled = false; }
  });
});
