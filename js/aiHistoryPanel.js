(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChemiationAIHistoryPanel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const history = typeof ChemiationAIHistory !== 'undefined' ? ChemiationAIHistory : require('./aiHistory.js');
  const safety = typeof ChemiationAISafety !== 'undefined' ? ChemiationAISafety : require('./aiTaskSafety.js');
  const editing = typeof ChemiationAIEditing !== 'undefined' ? ChemiationAIEditing : require('./aiEditingTools.js');
  const element = id => document.getElementById(id);
  const statusName = value => ({ ready: '检查通过', invalid: '检查未通过', incomplete: '未完整结束', failed: '请求失败', cancelled: '已中止', saved: '草稿快照' }[value] || '历史记录');
  const modeName = value => ({ new: '新建', refine: '修改', fix: '排错' }[value] || '快照');
  const engine = () => typeof ReactionScriptEngine === 'undefined' ? null : ReactionScriptEngine;
  class Panel {
    constructor(assistant) {
      this.assistant = assistant;
      this.store = history.createStore({ indexedDB: typeof indexedDB === 'undefined' ? null : indexedDB, localStorage });
      this.entries = []; this.record = null; this.versionId = null; this.pending = null;
      this.viewSequence = 0; this.listSequence = 0; this.busy = false; this.viewOwner = this.owner();
    }
    owner() { return window.currentUser && window.currentUser.id ? 'user:' + window.currentUser.id : 'guest'; }
    targetName() {
      const app = window.reactionApp;
      return app && app.presets && app.presets[app.currentReactionIndex] ? app.presets[app.currentReactionIndex].name || '当前机理' : '当前编辑器';
    }
    notice(message, owner = this.owner()) {
      if (owner !== this.owner()) return;
      const node = element('ai-history-save-notice');
      if (node) { node.textContent = message; node.style.display = message ? 'block' : 'none'; }
    }
    begin(task, cfg, prompt) {
      task.historyOwner = this.owner();
      task.historyRecord = {
        id: history.id(), createdAt: new Date().toISOString(), kind: 'generation', title: prompt.slice(0, 100), prompt,
        mode: task.mode, status: 'generating', provider: cfg.provider, model: cfg.model,
        targetName: this.targetName(), targetId: task.base.reactionId || '',
        versions: [{ id: 'base', label: '生成前草稿', kind: 'draft', script: task.base.script, complete: false, valid: false }]
      };
    }
    capture(task, candidate, partial = false) {
      if (!task.historyRecord || !candidate) return;
      const versionId = partial ? `partial-${task.streamEpoch || 1}` : `attempt-${task.attempts.length}`;
      if (task.historyRecord.versions.some(value => value.id === versionId)) return;
      const oversized = candidate.script.length > 200000;
      const kind = partial || !candidate.complete || candidate.scopeError || oversized ? 'fragment' : 'generated';
      if (kind === 'generated' && candidate.validation?.valid && candidate.validation.parsed?.name) task.historyRecord.title = candidate.validation.parsed.name;
      task.historyRecord.versions.push({
        id: versionId, label: partial ? '中断时收到的片段' : task.repairAttempts ? `自动纠错 ${task.repairAttempts} 的结果` : '首次生成结果',
        kind, script: oversized ? candidate.script.slice(0, 200000) : candidate.script,
        complete: kind === 'generated' && candidate.complete, valid: !!(candidate.validation && candidate.validation.valid),
        finishReason: partial ? '' : task.finishReason, createdAt: new Date().toISOString(),
        diagnostics: oversized ? ['输出过长，历史只保留前 200000 字符'] : candidate.validation ? candidate.validation.diagnostics : []
      });
      candidate.historyRef = { owner: task.historyOwner, recordId: task.historyRecord.id, versionId };
    }
    archive(task) {
      if (!task.historyRecord || task.historyWrite) return task.historyWrite;
      task.historyRecord.status = task.status;
      task.historyRecord.repairAttempts = task.repairAttempts;
      task.historyRecord.errorCode = task.errorCode || '';
      this.notice('正在保存本次生成历史…', task.historyOwner);
      task.historyWrite = this.store.put(task.historyOwner, task.historyRecord).then(result => {
        this.notice(result.pruned ? `本地历史空间有上限，已自动清理 ${result.pruned} 条较旧记录；可导出历史另存。` : '', task.historyOwner);
        if (this.assistant.currentTab === 'history' && task.historyOwner === this.owner()) this.load();
        return result;
      }).catch(err => { this.notice(`本次生成历史未保存：${err.message}。结果仍可查看、复制。`, task.historyOwner); return null; });
      return task.historyWrite;
    }
    applied(reference, waitFor) {
      if (!reference) return;
      Promise.resolve(waitFor).then(result => {
        if (waitFor && !result) return;
        return this.store.markApplied(reference.owner, reference.recordId, reference.versionId);
      }).then(() => {
        if (this.assistant.currentTab === 'history' && reference.owner === this.owner()) this.load();
      }).catch(err => this.notice(`版本已载入，但历史标记未更新：${err.message}`, reference.owner));
    }
    async load() {
      const sequence = ++this.listSequence, owner = this.owner();
      const message = element('ai-history-feedback');
      if (message) message.textContent = '正在读取本地历史…';
      try {
        const entries = await this.store.list(owner);
        if (sequence !== this.listSequence || owner !== this.owner()) return;
        this.entries = entries;
        const info = element('ai-history-storage-info');
        if (info) info.textContent = `保存在当前浏览器，按本地账号分开；最多 ${this.store.limits.records} 条，并受总空间限制。较旧记录会自动清理，可导出另存；不会跨设备同步。`;
        if (message) message.textContent = entries.length ? `共 ${entries.length} 条记录。` : '还没有历史记录。完成一次生成，或点击“保存当前草稿”后，会出现在这里。';
        this.renderList();
      } catch (err) { if (sequence === this.listSequence && owner === this.owner() && message) message.textContent = err.message; }
      this.updateControls();
    }
    renderList() {
      const container = element('ai-history-list');
      if (!container) return;
      container.replaceChildren();
      const search = (element('ai-history-search')?.value || '').trim().toLowerCase();
      const filter = element('ai-history-filter')?.value || 'all';
      const entries = this.entries.filter(record =>
        (!search || [record.title, record.prompt, record.targetName, record.model].join(' ').toLowerCase().includes(search)) &&
        (filter === 'all' || (filter === 'snapshot' ? record.kind === 'snapshot' : filter === 'ready' ? record.status === 'ready' : record.kind !== 'snapshot' && record.status !== 'ready')));
      for (const record of entries) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'ai-history-item'; button.dataset.historyId = record.id;
        button.classList.toggle('active', !!this.record && this.record.id === record.id);
        const title = document.createElement('strong'); title.textContent = record.title;
        const info = document.createElement('span');
        info.textContent = `${new Date(record.createdAt).toLocaleString('zh-CN')} · ${modeName(record.mode)} · ${statusName(record.status)} · ${record.versions.length} 个版本${record.appliedAt ? ' · 曾载入' : ''}`;
        button.append(title, info); button.addEventListener('click', () => this.select(record.id)); container.appendChild(button);
      }
      if (!entries.length) { const empty = document.createElement('p'); empty.textContent = '没有匹配的历史记录。'; container.appendChild(empty); }
    }
    async select(recordId) {
      const sequence = ++this.viewSequence, owner = this.owner();
      this.pending = null;
      try {
        const record = await this.store.get(owner, recordId);
        if (sequence !== this.viewSequence || owner !== this.owner()) return;
        if (!record) throw new Error('这条历史记录已不存在，请刷新列表');
        this.record = record;
        const select = element('ai-history-version');
        if (select) {
          select.replaceChildren();
          for (const version of record.versions) {
            const option = document.createElement('option'); option.value = version.id;
            option.textContent = version.label; select.appendChild(option);
          }
          select.value = record.versions.at(-1).id;
        }
        this.selectVersion(record.versions.at(-1).id);
        this.renderList();
        const detail = element('ai-history-detail'); if (detail && typeof detail.scrollIntoView === 'function') detail.scrollIntoView({ block: 'nearest' });
      } catch (err) { if (sequence === this.viewSequence && owner === this.owner()) this.assistant.showToast(err.message, true); }
    }
    selectVersion(versionId) {
      const version = this.record && this.record.versions.find(value => value.id === versionId);
      if (!version) return;
      this.versionId = version.id; this.pending = null;
      const detail = element('ai-history-detail'); if (detail) detail.style.display = 'block';
      const compare = element('ai-history-comparison'); if (compare) compare.style.display = 'none';
      const text = element('ai-history-code'); if (text) text.value = version.script;
      const meta = element('ai-history-meta');
      if (meta) meta.textContent = `${this.record.title} · 来源：${this.record.targetName || '编辑器'}${this.record.model ? ` · ${this.record.model}` : ''} · ${version.kind === 'draft' ? '原稿快照，可按原样恢复为草稿' : version.complete && version.valid ? '当时检查通过，恢复时会重新检查' : '未完整通过检查，仅可查看和复制'}${version.diagnostics.length ? '；' + version.diagnostics.join('；') : ''}`;
      const prompt = element('ai-history-prompt'); if (prompt) prompt.textContent = this.record.prompt || '手动或恢复前保存的草稿';
      this.updateControls();
    }
    currentVersion() { return this.record && this.record.versions.find(value => value.id === this.versionId); }
    eligibility(version) {
      if (version.kind === 'draft') return { allowed: true, message: '这是原稿快照，可能包含未完成的编辑；仅恢复到编辑器，不会自动推演。' };
      if (version.kind !== 'generated' || !version.complete || !version.valid) return { allowed: false, message: '这个 AI 结果未完整通过检查，只能查看和复制，不能恢复载入。' };
      const validation = safety.validateScript(version.script, engine());
      return { allowed: validation.valid, message: validation.valid ? '本次检查通过；恢复后仍需人工确认化学机理。' : `重新检查未通过：${validation.diagnostics.join('；')}` };
    }
    async prepare() {
      if (this.assistant.isGenerating || this.busy || !this.record) return false;
      const owner = this.owner(), recordId = this.record.id, versionId = this.versionId, sequence = this.viewSequence;
      try {
        const record = await this.store.get(owner, recordId);
        if (owner !== this.owner() || sequence !== this.viewSequence || recordId !== this.record?.id || versionId !== this.versionId) return false;
        const version = record && record.versions.find(value => value.id === versionId);
        if (!version) throw new Error('该版本已不存在，请刷新历史');
        const base = this.assistant.getWorkspace(), check = this.eligibility(version);
        this.pending = { owner, recordId, versionId, script: version.script, kind: version.kind, base, allowed: check.allowed };
        const diff = editing.compare(base.script, version.script);
        const before = element('ai-history-current'), after = element('ai-history-selected');
        if (before) before.value = base.script;
        if (after) after.value = version.script;
        const summary = element('ai-history-compare-summary');
        if (summary) summary.textContent = `将恢复到当前编辑器「${this.targetName()}」。${diff.identical ? '内容与当前草稿相同。' : `新增 ${diff.added} 行、删除 ${diff.removed} 行${diff.approximate ? '（长文本按整段比较）' : ''}。`}${check.message}恢复前会保存当前草稿，可通过工具栏撤销。`;
        const area = element('ai-history-comparison'); if (area) area.style.display = 'block';
        if (area && typeof area.scrollIntoView === 'function') area.scrollIntoView({ block: 'nearest' });
        this.updateControls(); return true;
      } catch (err) { this.assistant.showToast(err.message, true); return false; }
    }
    snapshotRecord(base, title, source) {
      return { id: history.id(), createdAt: new Date().toISOString(), kind: 'snapshot', status: 'saved', title,
        targetName: this.targetName(), targetId: base.reactionId || '', sourceRecordId: source?.recordId, sourceVersionId: source?.versionId,
        versions: [{ id: 'draft', label: title, kind: 'draft', script: base.script, complete: false, valid: false }] };
    }
    async snapshot() {
      if (this.assistant.isGenerating || this.busy) return false;
      const owner = this.owner(), base = this.assistant.getWorkspace();
      this.busy = true; this.updateControls();
      try {
        await this.store.put(owner, this.snapshotRecord(base, '手动保存的草稿：' + this.targetName()));
        if (owner === this.owner()) { this.notice(''); await this.load(); this.assistant.showToast('已保存点击时的草稿，可在历史中找回', false); }
        return true;
      } catch (err) { if (owner === this.owner()) this.assistant.showToast('草稿快照未保存：' + err.message, true); return false; }
      finally { this.busy = false; this.updateControls(); }
    }
    async restore() {
      const pending = this.pending;
      if (!pending || !pending.allowed || this.busy || this.assistant.isGenerating) return false;
      this.busy = true; this.updateControls();
      try {
        const unchanged = () => pending.owner === this.owner() && safety.sameWorkspace(pending.base, this.assistant.getWorkspace()) && this.pending === pending;
        if (!unchanged()) throw new Error('当前草稿、目标机理或账号已变化，请重新对比后再恢复');
        const record = await this.store.get(pending.owner, pending.recordId);
        const version = record && record.versions.find(value => value.id === pending.versionId);
        if (!version || version.script !== pending.script || version.kind !== pending.kind) throw new Error('历史版本已变化，请重新选择并对比');
        const check = this.eligibility(version);
        if (!check.allowed) throw new Error(check.message);
        if (!unchanged()) throw new Error('当前草稿已变化，请重新对比后再恢复');
        await this.store.put(pending.owner, this.snapshotRecord(pending.base, '恢复前草稿：' + this.targetName(), pending));
        if (!unchanged()) throw new Error('保存备份期间草稿或账号已变化，本次未覆盖，请重新对比');
        const finalCheck = this.eligibility(version);
        if (!finalCheck.allowed) throw new Error(finalCheck.message);
        this.assistant.saveDraftBackup({ version: 1, savedAt: new Date().toISOString(), before: pending.base, after: pending.base, appliedScript: version.script, reaction: null, ran: false }, pending.owner);
        const editor = element('script-editor');
        if (!editor) throw new Error('编辑器未加载，本次未恢复');
        editor.value = version.script; editor.dispatchEvent(new Event('input', { bubbles: true }));
        const app = window.reactionApp; if (app && typeof app.switchTab === 'function') app.switchTab('script');
        this.assistant.candidate = null; this.assistant.lastGeneratedScript = ''; this.assistant.scopeSourceText = null;
        const preview = element('ai-preview-code'); if (preview) preview.value = '';
        const previewArea = element('ai-preview-section'); if (previewArea) previewArea.style.display = 'none';
        this.assistant.renderComparison(null); this.assistant.updateActionButtons();
        this.pending = null;
        this.applied({ owner: pending.owner, recordId: pending.recordId, versionId: pending.versionId });
        this.assistant.updateStatusBadge('已恢复历史版本；可用“撤销 AI 载入”找回恢复前的草稿', 'success');
        this.assistant.closeModal(); return true;
      } catch (err) { this.assistant.showToast(err.message + '；当前草稿未覆盖', true); return false; }
      finally { this.busy = false; this.updateControls(); }
    }
    updateControls() {
      const blocked = this.busy || this.assistant.isGenerating;
      for (const id of ['ai-history-save-draft', 'ai-history-prepare']) {
        const button = element(id); if (button) button.disabled = blocked || (id === 'ai-history-prepare' && !this.currentVersion());
      }
      const restore = element('ai-history-restore'); if (restore) restore.disabled = blocked || !this.pending || !this.pending.allowed;
      const copy = element('ai-history-copy'); if (copy) copy.disabled = !this.currentVersion();
    }
    onUserChanged() {
      if (this.viewOwner === this.owner()) return;
      this.assistant.cancelGeneration(true);
      this.viewOwner = this.owner(); this.viewSequence++; this.listSequence++;
      this.entries = []; this.record = null; this.versionId = null; this.pending = null;
      this.assistant.candidate = null; this.assistant.lastGeneratedScript = ''; this.assistant.lastDraftBackup = null;
      this.assistant.renderComparison(null);
      for (const id of ['ai-history-detail', 'ai-history-comparison', 'ai-preview-section']) { const node = element(id); if (node) node.style.display = 'none'; }
      for (const id of ['ai-history-code', 'ai-history-current', 'ai-history-selected', 'ai-preview-code']) { const node = element(id); if (node) node.value = ''; }
      for (const id of ['ai-history-meta', 'ai-history-prompt', 'ai-history-compare-summary']) { const node = element(id); if (node) node.textContent = ''; }
      const versions = element('ai-history-version'); if (versions) versions.replaceChildren();
      const search = element('ai-history-search'); if (search) search.value = '';
      const filter = element('ai-history-filter'); if (filter) filter.value = 'all';
      this.assistant.updateStatusBadge('账号已切换，请重新生成或选择历史版本', 'pending');
      const progress = element('ai-stream-progress'); if (progress) progress.style.display = 'none';
      this.notice(''); this.renderList(); this.updateControls(); this.assistant.updateActionButtons();
      if (this.assistant.currentTab === 'history') this.load();
    }
    bind() {
      const bind = (id, event, callback) => { const node = element(id); if (node) node.addEventListener(event, callback); };
      bind('ai-history-refresh', 'click', () => this.load());
      bind('ai-history-search', 'input', () => this.renderList());
      bind('ai-history-filter', 'change', () => this.renderList());
      bind('ai-history-version', 'change', event => this.selectVersion(event.target.value));
      bind('ai-history-prepare', 'click', () => this.prepare());
      bind('ai-history-restore', 'click', () => this.restore());
      bind('ai-history-save-draft', 'click', () => this.snapshot());
      bind('ai-history-export', 'click', async () => {
        const owner = this.owner();
        try {
          const records = await this.store.export(owner);
          if (owner !== this.owner()) return;
          const blob = new Blob([JSON.stringify({ schema: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json;charset=utf-8' });
          const url = URL.createObjectURL(blob), link = document.createElement('a');
          link.href = url; link.download = 'Chemiation_AI历史_' + new Date().toISOString().slice(0, 10) + '.json';
          link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) { if (owner === this.owner()) this.assistant.showToast('导出失败：' + err.message, true); }
      });
      bind('ai-history-copy', 'click', () => {
        const version = this.currentVersion(); if (!version) return;
        navigator.clipboard.writeText(version.script).then(() => this.assistant.showToast('已复制所选历史版本', false)).catch(() => this.assistant.showToast('复制失败，可在文本框中手动复制', true));
      });
    }
  }
  return { create: assistant => new Panel(assistant) };
});
