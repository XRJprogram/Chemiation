/* Canvas-first conversation controller. Generation delegates to the existing safety pipeline. */
(function (root) {
  'use strict';
  const Core = root.ChemiationStudioCore;
  const Workflow = root.ChemiationAIWorkflow;
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
  const studio = {
    ready: false, busy: false, proposal: null, scope: null, session: null,
    localQueue: Promise.resolve(), cloudQueue: Promise.resolve(), pendingCloud: new Map(), revisions: new Map(), localRevisions: new Map(), conflicts: new Set(), recoveries: new Map(), epoch: 0,
    owner() { return root.aiAssistant.currentHistoryOwner(); },
    project() {
      const app = root.reactionApp, reaction = app.presets[app.currentReactionIndex];
      if (!reaction) return { id: 'workspace', name: '当前机理' };
      let valid = false;
      try { valid = !!Core.projectId(reaction.id); } catch (_) { /* Assign a durable identity below. */ }
      if (!valid || app.presets.some((r, i) => i !== app.currentReactionIndex && r.id === reaction.id)) {
        reaction.id = Core.id(); app.savePresetsToStorage();
      }
      return { id: reaction.id, name: reaction.name || '未命名机理' };
    },
    pointer(owner = this.owner(), project = this.currentProject?.id || this.project().id) { return 'chemiation_studio_active:' + owner + ':project:' + encodeURIComponent(project); },
    async init() {
      if (this.ready || !$('studio-form')) return;
      this.ready = true; this.store = root.ChemiationStudioStore.create();
      this.bind();
      root.reactionApp.switchTab('chat');
      await this.loadOwner({ restoreProject: true });
      this.updateContext();
      requestAnimationFrame(() => this.fitCanvas());
    },
    async loadOwner({ restoreProject = false } = {}) {
      this.closePanels();
      this.cancelLookup();
      const owner = this.owner(); this.changingProject = true;
      if (restoreProject) {
        try {
          const saved = localStorage.getItem('chemiation_studio_project:' + owner);
          const index = root.reactionApp.presets.findIndex(r => r.id === saved);
          if (index >= 0 && index !== root.reactionApp.currentReactionIndex) root.reactionApp.loadReaction(index);
        } catch (_) { /* Default to the currently open mechanism. */ }
      }
      const project = this.project(); clearTimeout(this.draftTimer);
      let previousSave = Promise.resolve();
      if (this.loadedOwner === owner && this.session && !this.loading) {
        if (this.busy) {
          this.addMessage('assistant', '已切换机理项目，本轮生成已停止。之前发送的内容保留在这段对话中。', '', this.session.activeGeneration ? { retry: this.session.activeGeneration } : {});
          this.session.activeGeneration = null;
          if (this.session.workflow) this.session.workflow.stage = 'failed';
        }
        previousSave = this.persist().catch(() => {});
      }
      root.aiAssistant.cancelGeneration(true); this.runSequence = (this.runSequence || 0) + 1;
      this.setBusy(false); this.clearLivePreview(); this.liveBase = null; this.discard();
      const epoch = ++this.epoch;
      this.loadedOwner = owner;
      this.currentProject = project; this.sessionIndex = []; this.proposal = null; this.scope = null;
      this.loading = true; this.session = Core.create(project); $('studio-input').value = ''; $('studio-library').hidden = true;
      this.changingProject = false; this.render(); this.setBusy(false);
      let session, locals = [];
      try {
        await previousSave;
        await this.localQueue.catch(() => {});
        const id = localStorage.getItem(this.pointer(owner));
        if (id) session = await this.store.get(owner, id);
        session = this.recoveries.get(owner + ':' + project.id) || session;
        if (session?.projectId !== project.id) session = null;
        locals = (await this.store.list(owner, project.id)).map(item => ({ ...item, local: true }));
        if (!session && locals.length) session = await this.store.get(owner, locals[0].id);
      } catch (e) { this.notice(e.message); }
      if (epoch !== this.epoch || owner !== this.owner()) return;
      this.session = session || Core.create(project); this.sessionIndex = locals;
      this.restoreScope();
      $('studio-input').value = this.session.draft || '';
      this.loading = false; this.remember(); this.render(); this.setBusy(false); this.notice(this.recoveries.has(owner + ':' + project.id) ? '此项目有尚未成功保存的本机副本，请先导出或重试保存' : '');
      if (this.session.activeGeneration) {
        const interrupted = this.session.activeGeneration; this.session.activeGeneration = null;
        if (this.session.workflow) this.session.workflow.stage = 'failed';
        this.addMessage('assistant', '上次生成因页面关闭或刷新而中断，已确认信息和原稿仍保留，可以重试原请求。', '', { retry: interrupted, failure: { status: 'interrupted', detail: '页面已重新载入，上次网络请求没有继续执行。', fragment: '' } });
        this.persist().catch(() => {});
      }
      this.refreshSessions({ restoreIfEmpty: !session }).catch(e => this.notice(e.message));
    },
    remember() {
      try { localStorage.setItem(this.pointer(), this.session.id); localStorage.setItem('chemiation_studio_project:' + this.owner(), this.currentProject.id); } catch (_) { /* Local persistence status is reported by persist(). */ }
      const key = this.owner() + ':' + this.session.id;
      this.revisions.set(key, this.session.revision || 0);
      this.localRevisions.set(key, this.session.localRevision || 0);
    },
    notice(text = '') { $('studio-notice').textContent = text; $('studio-notice').hidden = !text; },
    state(text) { $('studio-save-state').textContent = text; },
    async request(path, options = {}, token = root.api.getToken()) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(API_CONFIG.baseUrl + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, signal: controller.signal });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { const e = new Error(body.error || '会话服务暂时不可用'); e.statusCode = res.status; throw e; }
        return body;
      } finally { clearTimeout(timer); }
    },
    persist(session = this.session) {
      const owner = this.owner(), token = root.api.getToken();
      if (session === this.session) {
        session.draft = $('studio-input').value;
        session.scope = this.savedScope();
      }
      if (session.projectId === this.currentProject?.id) session.projectName = this.currentProject.name;
      session.updatedAt = new Date().toISOString();
      let snapshot;
      try { snapshot = Core.normalize(session); } catch (e) { this.recoveries.set(owner + ':' + session.projectId, session); this.notice(e.message + '；可以先导出当前会话'); return Promise.reject(e); }
      const key = owner + ':' + snapshot.id;
      this.state('正在保存…');
      const write = this.localQueue.catch(() => {}).then(async () => {
        snapshot.localRevision = this.localRevisions.get(key) ?? snapshot.localRevision;
        const saved = await this.store.put(owner, snapshot);
        if (saved.conflict) throw new Error('另一个窗口更新了此聊天。请导出当前副本后重新打开，未覆盖旧记录');
        if (this.recoveries.get(owner + ':' + snapshot.projectId)?.id === snapshot.id) this.recoveries.delete(owner + ':' + snapshot.projectId);
        this.localRevisions.set(key, saved.localRevision);
        if (this.owner() === owner && saved.projectId === this.currentProject?.id) {
          const old = this.sessionIndex?.find(item => item.id === saved.id);
          this.sessionIndex = (this.sessionIndex || []).filter(item => item.id !== saved.id).concat({ ...old, ...Core.metadata(saved), local: true });
          this.renderSessionPicker();
        }
        if (this.owner() === owner && this.session.id === snapshot.id) { this.session.localRevision = saved.localRevision; this.state(owner === 'guest' ? '已保存在本机' : '本机已保存 · 等待同步'); }
        if (owner !== 'guest' && token) this.queueCloud(owner, token, saved);
        return saved;
      });
      this.localQueue = write;
      write.catch(e => { this.recoveries.set(owner + ':' + snapshot.projectId, snapshot); if (owner === this.owner() && this.session.id === snapshot.id) { this.state('保存未完成 · 可导出'); this.notice(e.message); } });
      return write;
    },
    renderSessionPicker() {
      const select = $('studio-session-select'); if (!select || !this.session) return;
      const project = this.currentProject || this.project();
      const choices = (this.sessionIndex || []).filter(v => v.projectId === project.id);
      const active = choices.findIndex(v => v.id === this.session.id);
      if (active < 0) choices.push(Core.metadata(this.session));
      else choices[active] = { ...choices[active], ...Core.metadata(this.session) };
      choices.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      select.replaceChildren(...choices.map(item => { const option = node('option', item.title); option.value = item.id; return option; }));
      select.value = this.session.id; select.disabled = this.busy || this.loading || this.committing;
      $('studio-project-count').textContent = `${choices.length} 段对话`;
      const projects = $('studio-project-select');
      projects.replaceChildren(...root.reactionApp.presets.map((r, index) => { const option = node('option', r.name); option.value = String(index); return option; }));
      projects.value = String(root.reactionApp.currentReactionIndex); projects.disabled = this.committing;
      $('studio-project-name').textContent = project.name;
      $('studio-session-name').textContent = this.session.title;
      $('studio-project-toggle').title = `${project.name} / ${this.session.title} · 切换项目与对话`;
      $('studio-project-toggle').disabled = !!(this.loading || this.committing);
    },
    async sessionEntries(projectId) {
      const owner = this.owner(), locals = await this.store.list(owner, projectId);
      const entries = new Map(locals.map(v => [v.id, { ...v, local: true }]));
      let cloudError = false;
      if (owner !== 'guest' && root.api.getToken()) {
        try {
          let offset = 0;
          do {
            const result = await this.request('/api/studio/sessions?projectId=' + encodeURIComponent(projectId) + '&offset=' + offset);
            for (const v of result.items || []) if ((v.projectId || '') === projectId) entries.set(v.id, { ...v, ...entries.get(v.id), cloud: true });
            offset = result.nextOffset;
          } while (offset !== null && offset !== undefined);
        } catch (_) { cloudError = true; }
      }
      return { items: [...entries.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), cloudError };
    },
    async refreshSessions({ restoreIfEmpty = false } = {}) {
      const owner = this.owner(), epoch = this.epoch, project = this.currentProject, id = this.session.id;
      const result = await this.sessionEntries(project.id);
      if (owner !== this.owner() || epoch !== this.epoch || project.id !== this.currentProject.id) return;
      this.sessionIndex = result.items; this.renderSessionPicker();
      if (restoreIfEmpty && this.session.id === id && !this.session.messages.length && !this.session.versions.length && !$('studio-input').value && !this.busy) {
        if (result.items.length) await this.openSession(result.items[0].id, !result.items[0].local);
        else await this.persist();
      }
    },
    queueCloud(owner, token, snapshot) {
      const key = owner + ':' + snapshot.id;
      const queued = this.pendingCloud.has(key); this.pendingCloud.set(key, snapshot);
      if (queued) return;
      this.cloudQueue = this.cloudQueue.catch(() => {}).then(async () => {
        // Local form drafts save immediately; combine rapid edits into one cloud write.
        await new Promise(resolve => setTimeout(resolve, 250));
        snapshot = this.pendingCloud.get(key); this.pendingCloud.delete(key);
        if (this.conflicts.has(key)) return;
        try {
          const { session } = await this.request('/api/studio/sessions/' + snapshot.id, {
            method: 'PUT', body: JSON.stringify({ session: snapshot, expectedRevision: Math.max(this.revisions.get(key) || 0, snapshot.revision) })
          }, token);
          if ((session.projectId || '') !== snapshot.projectId) throw new Error('云端版本尚未支持机理项目，请更新后端后重新同步');
          this.revisions.set(key, session.revision);
          await this.store.markSynced(owner, snapshot.id, session.revision);
          if (JSON.stringify(session.workflow || null) !== JSON.stringify(snapshot.workflow || null) || JSON.stringify(session.scope || null) !== JSON.stringify(snapshot.scope || null) || JSON.stringify(session.messages) !== JSON.stringify(snapshot.messages)) {
            const error = new Error('本机内容已保存；云端尚未完整保留任务流程、步骤范围、表单草稿或重试记录，请同时更新 js/aiStudioCore.js 和 js/aiWorkflow.js。');
            error.upgradeRequired = true; throw error;
          }
          if (this.owner() === owner && this.session.id === snapshot.id) {
            this.session.revision = session.revision;
            this.state(this.session.localRevision === snapshot.localRevision ? '本机已保存 · 已同步云端' : '本机已保存 · 同步中');
          }
        } catch (e) {
          if (e.statusCode === 409) this.conflicts.add(key);
          if (this.owner() === owner && this.session.id === snapshot.id) {
            this.state(e.upgradeRequired ? '本机已保存 · 云端需要更新' : e.statusCode === 409 ? '本机已保存 · 存在版本冲突' : '本机已保存 · 云端待重试');
            this.notice(e.upgradeRequired || e.statusCode === 409 ? e.message : '聊天已保存在本机，云端暂未同步。可在历史中重试。');
          }
        }
      });
    },
    addMessage(role, text, versionId = '', extra = {}) {
      const message = { id: Core.id(), role, text: String(text).slice(0, 12000), versionId, createdAt: new Date().toISOString(), ...extra };
      this.session.messages.push(message);
      if (role === 'user' && this.session.title === '新的机理对话') this.session.title = message.text.slice(0, 36);
      this.renderMessage(message); this.syncQuestionForms(); $('studio-welcome')?.remove(); this.follow(!!message.question); return message;
    },
    renderMessage(m) {
      const block = node('article', undefined, 'studio-message ' + m.role);
      block.append(node('div', m.role === 'user' ? '你' : '机理助手', 'studio-message-label'));
      if (m.question) this.renderQuestion(m, block);
      else block.append(node('p', m.text));
      if (m.failure?.detail || m.failure?.fragment) {
        const details = node('details', undefined, 'studio-failure-details'); details.append(node('summary', '查看失败原因与已收到的片段'));
        if (m.failure.detail) details.append(node('p', m.failure.detail));
        if (m.failure.fragment) details.append(node('pre', m.failure.fragment));
        block.append(details);
      }
      if (m.retry) {
        const retry = node('button', '重试这次生成 ↻', 'studio-message-link'); retry.dataset.retryId = m.id;
        retry.title = m.retry.scope ? `使用原请求，只修改第 ${m.retry.scope.index + 1} 步` : '使用原请求和原脚本重新生成';
        retry.disabled = this.busy || this.loading || this.committing;
        retry.addEventListener('click', () => this.retryGeneration(m.id)); block.append(retry);
      }
      if (m.versionId) {
        const button = node('button', '查看这个脚本版本 ↗', 'studio-message-link');
        button.disabled = this.busy;
        button.addEventListener('click', () => this.restoreVersion(m.versionId)); block.append(button);
      }
      $('studio-messages').append(block); return block;
    },
    renderQuestion(message, block) {
      const question = Core.normalizeQuestion(message.question);
      if (!question) { block.append(node('p', message.text)); return; }
      const form = node('form', undefined, 'studio-question'); form.dataset.questionId = message.id;
      const heading = node('div', undefined, 'studio-question-heading');
      heading.append(node('span', '?', 'studio-question-icon'), node('span', '补充一项信息，继续推演'));
      const fields = node('fieldset'); fields.append(node('legend', question.question));
      const choices = node('div', undefined, 'studio-question-options');
      question.options.forEach((option, index) => {
        const label = node('label', undefined, 'studio-option'), input = node('input');
        input.type = 'radio'; input.name = 'answer-' + message.id; input.value = option.value;
        input.checked = message.answerDraft?.selected === option.value;
        const body = node('span', undefined, 'studio-option-body'); body.append(node('strong', option.label));
        if (option.description) body.append(node('small', option.description));
        label.append(input, node('span', String.fromCharCode(65 + index), 'studio-option-letter'), body, node('span', '✓', 'studio-option-check')); choices.append(label);
      });
      const label = node('label', question.options.length ? '自由回答 / 补充说明' : '你的回答', 'studio-answer-label');
      const custom = node('textarea'); custom.id = 'answer-' + message.id; custom.rows = 2; custom.maxLength = 2000;
      custom.placeholder = question.options.length ? '也可以直接输入，或补充所选条件…' : '请输入具体底物、条件或你的想法…'; label.htmlFor = custom.id;
      custom.value = message.answerDraft?.text || '';
      const footer = node('div', undefined, 'studio-question-footer'), hint = node('span', '选择一项或自由回答');
      const button = node('button', '提交并继续 →', 'studio-primary'); button.type = 'submit'; button.disabled = true;
      footer.append(hint, button); fields.append(choices, label, custom, footer); form.append(heading, fields);
      const update = () => {
        if (this.busy || this.loading || this.committing || !this.isQuestionActive(message.id)) return;
        const next = { selected: form.querySelector('input:checked')?.value || '', text: custom.value };
        if (JSON.stringify(next) !== JSON.stringify(message.answerDraft)) { message.answerDraft = next; this.persist().catch(() => {}); }
        button.disabled = !(next.selected || next.text.trim()); this.follow(true);
      };
      form.addEventListener('input', update); form.addEventListener('change', update);
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (this.busy || this.loading || this.committing || !this.isQuestionActive(message.id)) return;
        const selected = form.querySelector('input:checked')?.value, free = custom.value.trim();
        if (!selected && !free) return;
        const answer = `关于“${question.question}”\n` + [selected ? '选择：' + selected : '', free ? '补充回答：' + free : ''].filter(Boolean).join('\n');
        this.submit(answer, { replyTo: message.id });
      });
      block.append(form);
    },
    isQuestionActive(id) { return this.session.messages.at(-1)?.id === id; },
    syncQuestionForms() {
      const last = this.session.messages.at(-1), questionId = last?.question ? last.id : '';
      if (this.currentQuestionId !== questionId) { this.composerExpanded = false; this.currentQuestionId = questionId; }
      $('studio-form').hidden = !!questionId && !this.composerExpanded;
      $('studio-write-message').hidden = !questionId;
      $('studio-write-message').textContent = this.composerExpanded ? '收起输入框，回到问题表单 ↑' : '想换个要求？直接发消息 ↗';
      $('studio-write-message').setAttribute('aria-expanded', String(!!this.composerExpanded));
      for (const form of $('studio-messages').querySelectorAll('.studio-question')) {
        const active = this.isQuestionActive(form.dataset.questionId);
        form.classList.toggle('is-answered', !active); form.querySelector('fieldset').disabled = this.busy || this.loading || this.committing || !active;
        form.querySelector('.studio-question-heading > span:last-child').textContent = active ? '补充一项信息，继续推演' : '已回答 · 条件已带入后续推演';
        form.querySelector('button[type="submit"]').disabled = this.busy || this.loading || this.committing || !active || !(form.querySelector('input:checked') || form.querySelector('textarea').value.trim());
      }
    },
    render() {
      const messages = $('studio-messages');
      if (!this.welcome) this.welcome = $('studio-welcome')?.cloneNode(true);
      messages.replaceChildren();
      if (!this.session.messages.length && this.welcome) messages.append(this.welcome.cloneNode(true));
      this.session.messages.forEach(m => this.renderMessage(m));
      this.syncQuestionForms();
      $('studio-candidate').hidden = !this.proposal;
      $('studio-live').hidden = !this.busy;
      this.renderScope();
      this.state(this.session.revision ? '已载入已保存的会话' : '自动保存在本机');
      this.renderSessionPicker();
      this.updateContext(); this.follow();
    },
    follow(instant = false) { const box = $('studio-messages'); box.scrollTo({ top: box.scrollHeight, behavior: instant ? 'instant' : 'auto' }); },
    show() { root.reactionApp.toggleWorkspace(true); root.reactionApp.switchTab('chat'); if (!$('studio-form').hidden) $('studio-input').focus(); requestAnimationFrame(() => { this.fitCanvas(); this.follow(true); }); },
    fitCanvas() {
      const app = root.reactionApp, renderer = app.renderer;
      const compact = matchMedia('(orientation: portrait), (max-width: 820px)').matches;
      const reaction = app.studioPreview?.reaction || app.presets[app.currentReactionIndex];
      const points = (reaction?.steps || []).flatMap(s => s.atoms || []).map(a => renderer.rotatePoint(a));
      if (!points.length) return;
      const x = Math.max(1, ...points.map(p => Math.abs(p.x))), y = Math.max(1, ...points.map(p => Math.abs(p.y)));
      renderer.targetZoom = Math.max(8, Math.min(renderer.getBaseZoom(), (renderer.width - 40) / (2 * x), (renderer.height - 110) / (2 * y)));
      renderer.studioLabelScale = renderer.studioSavedLabelScale = Math.max(compact ? .5 : .6, Math.min(1, renderer.targetZoom / (compact ? 42 : 62)));
      renderer.targetPanX = 0; renderer.targetPanY = compact ? 27 : 0;
    },
    updateContext() {
      if (this.ready && !this.changingProject && this.currentProject && this.currentProject.id !== this.project().id) { this.loadOwner().catch(e => this.notice(e.message)); return; }
      if (this.currentProject && !this.changingProject && this.currentProject.name !== this.project().name) { this.currentProject.name = this.project().name; this.renderSessionPicker(); }
      const app = root.reactionApp, reaction = app.studioPreview?.reaction || app.presets[app.currentReactionIndex];
      $('studio-context-name').textContent = reaction?.steps?.[app.currentStepIndex]?.name || reaction?.name || '当前反应';
      if (this.liveBase && !ChemiationAISafety.sameWorkspace(this.liveBase, root.aiAssistant.getWorkspace())) {
        this.liveInvalidated = true; this.clearLivePreview();
      }
      if (this.proposal && !ChemiationAISafety.sameTarget(this.proposal.base, root.aiAssistant.getWorkspace())) {
        this.proposal = null; $('studio-candidate').hidden = true; this.notice('已切换反应，候选结果保留在历史版本中');
      }
      this.renderScope();
      if (!this.busy && !this.proposal) this.canvasStatus();
    },
    refineStep() {
      if (this.busy || this.loading || this.committing) return;
      const app = root.reactionApp;
      const script = this.proposal?.script || app.scriptEditor.value;
      const index = app.currentStepIndex;
      try {
        const document = ChemiationAIEditing.documentOf(script);
        if (!document.steps[index]) throw new Error('当前步骤不可用');
        this.scope = { index, script, stepName: document.steps[index].name, projectId: this.currentProject.id, target: root.aiAssistant.getWorkspace() };
        this.renderScope(); this.persist().catch(() => {});
        this.show();
      } catch (e) { this.notice(e.message); }
    },
    savedScope() {
      return this.scope ? Core.normalizeScope({ ...this.scope, projectId: this.scope.projectId || this.currentProject.id, baseScript: this.scope.target.script }) : null;
    },
    restoreScope() {
      let saved = this.session.scope;
      const current = root.aiAssistant.getWorkspace();
      if (saved && saved.projectId === this.currentProject.id && saved.script === saved.baseScript && Core.sameScriptContent(saved.baseScript, current.script)) {
        saved = { ...saved, script: current.script, baseScript: current.script };
      }
      this.scope = saved ? { ...saved, target: { ...root.aiAssistant.getWorkspace(), script: saved.baseScript,
        reactionId: saved.projectId } } : null;
      if (this.scope && this.scopeValid()) root.reactionApp.goToStep(this.scope.index, false);
    },
    scopeValid() {
      if (!this.scope) return true;
      if (this.scope.projectId !== this.currentProject.id || !ChemiationAISafety.sameWorkspace(this.scope.target, root.aiAssistant.getWorkspace())) return false;
      try { return !!ChemiationAIEditing.documentOf(this.scope.script).steps[this.scope.index]; } catch (_) { return false; }
    },
    renderScope() {
      $('studio-scope-tag').hidden = !this.scope;
      $('studio-input').placeholder = this.scope ? '这一步哪里需要完善？也可以先提问…' : '描述反应，或说说你想怎样完善…';
      if (this.scope) $('studio-scope-label').textContent = `只完善第 ${this.scope.index + 1} 步 · ${this.scope.stepName || '指定步骤'}${this.scopeValid() ? '' : '（原稿已变化，请重新选择）'}`;
    },
    async retryGeneration(messageId) {
      if (this.busy || this.loading || this.committing || root.aiAssistant.isGenerating) return;
      let request = this.session.messages.find(m => m.id === messageId)?.retry;
      if (!request) return;
      const current = root.aiAssistant.getWorkspace().script;
      if (request.projectId === this.currentProject.id && request.sourceScript === request.baseScript &&
          (!request.scope || request.scope.script === request.baseScript) && Core.sameScriptContent(request.baseScript, current)) {
        request = { ...request, baseScript: current, sourceScript: current,
          scope: request.scope ? { ...request.scope, baseScript: current, script: current } : null };
      }
      if (request.projectId !== this.currentProject.id || request.baseScript !== root.aiAssistant.getWorkspace().script) {
        this.notice('这次请求对应的原脚本已变化。请重新选择要完善的步骤并发送要求；未扩大旧请求的修改范围。'); return;
      }
      this.session.scope = request.scope; this.restoreScope(); this.renderScope();
      if (request.workflow) this.session.workflow = Workflow.normalize(request.workflow);
      await this.generate(request.prompt, request.refining, request);
    },
    cancelLookup() { this.lookupController?.abort(); this.lookupController = null; },
    async lookup(prompt) {
      this.cancelLookup();
      const owner = this.owner(), token = root.api.getToken(), epoch = this.epoch, sessionId = this.session.id, run = this.runSequence;
      const controller = new AbortController(); this.lookupController = controller;
      const current = () => this.lookupController === controller && owner === this.owner() && epoch === this.epoch && sessionId === this.session.id && run === this.runSequence;
      let onAbort;
      const stopped = new Promise(resolve => { onAbort = () => resolve(null); controller.signal.addEventListener('abort', onAbort, { once: true }); });
      const bounded = promise => Promise.race([promise, stopped]);
      const timer = setTimeout(() => controller.abort(), 1600);
      try {
        const app = root.reactionApp;
        const local = app.presets.map(r => ({ id: r.id, title: r.name, equation: r.equation, script: ReactionScriptEngine.serialize(r), source: '本机机理库' }));
        for (const v of this.session.versions) if (v.status === 'accepted' || v.status === 'restored') {
          const check = ChemiationAISafety.validateScript(v.script, ReactionScriptEngine);
          if (check.valid) local.push({ title: check.parsed.name, script: v.script, source: '本次会话已保留的版本' });
        }
        try {
          const metadata = await bounded(this.store.list(owner));
          if (!current()) return [];
          if (!metadata) return Core.match(prompt, local);
          const previous = Core.match(prompt, metadata.flatMap(m => m.mechanisms || []), { metadataOnly: true });
          for (const item of previous) {
            if (controller.signal.aborted || !current()) break;
            const session = await bounded(this.store.get(owner, item.sessionId));
            if (!current()) return [];
            const version = session?.versions.find(v => v.id === item.versionId && ['accepted', 'restored'].includes(v.status));
            if (version) local.push({ title: Core.reactionTitle(version.script), script: version.script, source: '本机历史对话的已保留版本' });
          }
        } catch (_) { /* Existing presets remain available if history cannot be opened. */ }
        if (!current()) return [];
        if (controller.signal.aborted) return Core.match(prompt, local);
        try {
          const res = await bounded(fetch(API_CONFIG.baseUrl + '/api/studio/matches?q=' + encodeURIComponent(prompt), { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: controller.signal }));
          if (res?.ok && current()) { const body = await bounded(res.json()); if (current() && Array.isArray(body?.items)) local.push(...body.items); }
        } catch (_) { /* Local matching is available without the server. */ }
        return current() ? Core.match(prompt, local) : [];
      } finally {
        clearTimeout(timer); controller.signal.removeEventListener('abort', onAbort);
        if (this.lookupController === controller) this.lookupController = null;
      }
    },
    async submit(text, options = {}) {
      const prompt = String(text || $('studio-input').value).trim();
      if (!prompt || this.busy || this.committing || this.loading || this.session.projectId !== this.project().id || root.aiAssistant.isGenerating) return;
      const stepRequest = /(?:只|仅).{0,8}(?:第\s*(\d+)\s*步|(当前步骤|本步|这一步))/.exec(prompt);
      if (stepRequest) {
        const index = stepRequest[1] ? Number(stepRequest[1]) - 1 : root.reactionApp.currentStepIndex;
        try {
          const script = this.proposal?.script || root.reactionApp.scriptEditor.value, doc = ChemiationAIEditing.documentOf(script);
          if (!doc.steps[index]) throw new Error('找不到指定步骤，请重新选择要完善的步骤');
          if (!this.scope || this.scope.index !== index) this.scope = { index, script, stepName: doc.steps[index].name, projectId: this.currentProject.id, target: root.aiAssistant.getWorkspace() };
          this.renderScope();
        } catch (e) { this.notice(e.message); return; }
      }
      if (!this.scopeValid()) { this.notice('原脚本已变化，请重新选择要完善的步骤；当前请求未发送，修改范围不会自动扩大。'); return; }
      if (this.session.messages.length > Core.LIMITS.messages - 4 || this.session.versions.length > Core.LIMITS.versions - 3) { this.notice('本次对话已接近保存上限，请先导出，再新建对话'); return; }
      const epoch = this.epoch, sessionId = this.session.id, run = this.runSequence = (this.runSequence || 0) + 1;
      this.setBusy(true); $('studio-progress').textContent = '正在保留本次输入…';
      this.notice(); $('studio-input').value = '';
      const pending = this.session.messages.at(-1);
      if (!this.session.workflow && pending?.question) {
        const initial = [...this.session.messages].reverse().find(m => m.role === 'user');
        const legacyTask = Workflow.prepare(null, initial?.text || prompt, { id: Core.id(), scoped: !!this.scope, proposal: !!this.proposal });
        this.session.workflow = Workflow.question(legacyTask, pending.question, pending.id);
      }
      const message = this.addMessage('user', prompt, '', { replyTo: options.replyTo || (pending?.question ? pending.id : '') });
      this.session.workflow = Workflow.prepare(this.session.workflow, prompt, { id: Core.id(), replyTo: message.replyTo, messageId: message.id, scoped: !!this.scope, proposal: !!this.proposal });
      const clarification = Workflow.preflight(this.session.workflow);
      if (clarification) {
        this.setBusy(false);
        const question = this.addMessage('assistant', clarification.question, '', { question: clarification });
        this.session.workflow = Workflow.question(this.session.workflow, clarification, question.id);
        await this.persist().catch(() => {}); return;
      }
      try { await this.persist(); } catch (_) { this.setBusy(false); return; }
      if (epoch !== this.epoch || sessionId !== this.session.id || run !== this.runSequence) return;
      $('studio-progress').textContent = '正在查找可参考的已有机理…';
      const refining = this.session.workflow.kind !== 'new';
      let matches;
      try { matches = refining ? [] : await this.lookup(prompt); }
      catch (e) { this.setBusy(false); this.notice(e.message); return; }
      if (epoch !== this.epoch || sessionId !== this.session.id || run !== this.runSequence) return;
      if (matches.length) {
        this.setBusy(false);
        const m = this.addMessage('assistant', '找到了一些可参考的机理。请先核对反应物和条件，再选择预览；名称相近不代表机理已经核实。');
        const block = $('studio-messages').lastElementChild;
        for (const match of matches) {
          const card = node('div', undefined, 'studio-match');
          card.append(node('strong', match.title), node('p', `${match.source} · ${match.reason}`));
          const button = node('button', '预览已有机理 ↗');
          button.addEventListener('click', () => { if (this.session.messages.some(item => item.id === m.id)) this.useMatch(match, prompt); });
          card.append(button); block.append(card);
        }
        const fresh = node('button', '根据我的要求重新推演 →', 'studio-message-link');
        fresh.addEventListener('click', () => { if (!this.busy) this.generate(prompt, false); }); block.append(fresh);
        this.follow(); this.persist().catch(() => {}); return;
      }
      await this.generate(prompt, refining);
    },
    setBusy(value) {
      this.busy = value; $('studio-live').hidden = !value;
      $('studio-input').disabled = !!(this.loading || this.committing);
      $('studio-history-search').disabled = value || this.loading || this.committing;
      for (const button of $('studio-sessions').querySelectorAll('button')) button.disabled = value || this.loading || this.committing;
      for (const id of ['studio-send', 'studio-new', 'studio-history', 'studio-refine-step', 'studio-clear-scope', 'studio-keep', 'studio-before', 'studio-discard', 'studio-settings', 'studio-rename', 'studio-open-rename', 'studio-rename-save', 'studio-rename-cancel', 'studio-rename-input']) $(id).disabled = value || this.loading || this.committing;
      for (const button of $('studio-messages').querySelectorAll('.studio-message-link, .studio-match button')) button.disabled = value || this.loading || this.committing;
      if (value) { $('studio-stream-code').textContent = ''; $('studio-stream-count').textContent = ''; this.streamText = ''; this.generationStartedAt = performance.now(); }
      else { cancelAnimationFrame(this.frame); this.frame = null; clearInterval(this.elapsedTimer); clearTimeout(this.liveTimer); }
      if (this.session) this.syncQuestionForms();
      this.renderSessionPicker();
    },
    canvasStatus(title, note, state = 'generating') {
      const status = $('studio-canvas-status'); status.hidden = !title; status.dataset.state = state;
      $('studio-canvas-title').textContent = title || ''; $('studio-canvas-note').textContent = note || '';
    },
    clearLivePreview() {
      clearTimeout(this.liveTimer); this.liveTimer = null;
      const preview = this.livePreview; this.livePreview = null;
      if (preview && root.reactionApp.studioPreview?.reaction === preview) root.reactionApp.endStudioPreview();
      if (!this.proposal) this.canvasStatus();
    },
    updateLivePreview() {
      this.liveTimer = null;
      if (!this.busy || this.liveInvalidated || !this.liveBase || !ChemiationAISafety.sameWorkspace(this.liveBase, root.aiAssistant.getWorkspace())) return;
      const prefix = Core.completedSteps(this.streamText);
      if (!prefix || prefix.script === this.livePrefix) return;
      this.livePrefix = prefix.script;
      let script = prefix.script;
      try { if (this.liveScope) script = ChemiationAIEditing.mergeSelected(this.liveScope, script); } catch (_) { return; }
      const validation = ChemiationAISafety.validateScript(script, ReactionScriptEngine);
      const intentErrors = Workflow.validateChanges(this.session.workflow, this.liveSource || this.liveBase.script, script);
      if (intentErrors.length) return;
      if (!validation.valid) {
        this.clearLivePreview(); this.canvasStatus('正在检查新步骤', '暂时显示原稿，等待完整且有效的步骤'); return;
      }
      const animate = !!this.livePreview || !!this.liveScope;
      this.livePreview = validation.parsed;
      root.reactionApp.previewStudioReaction(validation.parsed, this.liveScope ? this.liveScope.indices.at(-1) : prefix.count - 1, animate);
      this.fitCanvas();
      this.canvasStatus(this.liveScope ? '当前步骤已实时更新' : `已预览 ${prefix.count} 个完整步骤`, '生成中 · 临时预览，完整检查后才能保留');
      $('studio-live-preview').textContent = this.liveScope ? '← 左侧已更新当前步骤' : `← 左侧已显示第 ${prefix.count} 步`;
    },
    async generate(prompt, refining, retryRequest = null) {
      if (this.loading || this.committing || this.busy && root.aiAssistant.isGenerating) return;
      if (!this.scopeValid()) { this.setBusy(false); this.notice('原脚本已变化，请重新选择要完善的步骤；修改范围不会自动扩大。'); return; }
      if (this.session.messages.length > Core.LIMITS.messages - 2 || this.session.versions.length > Core.LIMITS.versions - 3) { this.setBusy(false); this.notice('本次对话已接近保存上限，请先导出，再新建对话'); return; }
      const source = retryRequest?.sourceScript ?? this.scope?.script ?? this.proposal?.script ?? root.reactionApp.scriptEditor.value;
      const anchor = [...this.session.messages].reverse().find(m => m.role === 'user' && m.text === prompt);
      const request = retryRequest || { prompt, refining: !!(refining || this.scope), sourceScript: source,
        baseScript: root.aiAssistant.getWorkspace().script, projectId: this.currentProject.id, scope: this.savedScope(), userMessageId: anchor?.id || '' };
      request.workflow ||= Workflow.normalize(this.session.workflow) || Workflow.prepare(null, prompt, { id: Core.id(), scoped: !!this.scope, proposal: !!this.proposal });
      this.session.workflow = Workflow.normalize(request.workflow);
      const cfg = root.aiAssistant.getConfig();
      if (!cfg.apiKey && cfg.provider !== 'ollama') {
        this.setBusy(false); this.addMessage('assistant', '生成新机理需要先连接模型。配置完成后，点击下方重试即可。', '', { retry: request, failure: { status: 'configuration', detail: '请在模型设置中配置接口与密钥。', fragment: '' } });
        root.aiAssistant.openModal('new', { legacy: true }); root.aiAssistant.switchTab('settings'); this.persist().catch(() => {}); return;
      }
      const epoch = this.epoch, sessionId = this.session.id, run = this.runSequence;
      const previousProposal = this.proposal;
      this.proposal = null; root.reactionApp.endStudioPreview(); $('studio-candidate').hidden = true;
      this.clearLivePreview(); this.livePrefix = ''; this.liveInvalidated = false;
      this.liveBase = root.aiAssistant.getWorkspace();
      this.liveSource = source;
      try { this.liveScope = this.scope ? ChemiationAIEditing.createScope(source, [this.scope.index]) : null; }
      catch (e) { this.liveBase = null; this.setBusy(false); this.notice(e.message); return; }
      this.setBusy(true); $('studio-progress').textContent = '正在推演；原稿已保留…';
      if (this.session.workflow) this.session.workflow.stage = 'generating';
      this.session.activeGeneration = request;
      try { await this.persist(); }
      catch (_) { this.setBusy(false); this.clearLivePreview(); this.liveBase = null; return; }
      if (epoch !== this.epoch || sessionId !== this.session.id || run !== this.runSequence || !this.busy) return;
      $('studio-live-preview').textContent = '← 完整步骤生成后会自动显示在左侧';
      this.canvasStatus('正在生成反应', '左侧保留原稿，等待第一个完整步骤');
      this.cancelled = false;
      this.elapsedTimer = setInterval(() => { $('studio-stream-count').textContent = `${Math.floor((performance.now() - this.generationStartedAt) / 1000)} 秒 · ${this.streamText?.length || 0} 字符`; }, 1000);
      let task;
      let generationError = '';
      try {
        const anchorIndex = this.session.messages.findIndex(m => m.id === request.userMessageId);
        const history = Core.contextPlan(this.session.messages.slice(0, anchorIndex >= 0 ? anchorIndex : this.session.messages.length));
        task = await root.aiAssistant.handleAction({
          chat: true, prompt, mode: request.workflow?.kind === 'fix' ? 'fix' : request.refining ? 'refine' : 'new', sourceScript: source,
          workflow: request.workflow,
          indices: this.scope ? [this.scope.index] : null,
          context: history.messages, contextReport: history,
          onProgress: event => {
            if (epoch !== this.epoch || sessionId !== this.session.id) return;
            if (event.type === 'attempt') {
              if (this.session.workflow) this.session.workflow.stage = event.repairAttempts ? 'repairing' : 'generating';
              this.clearLivePreview(); this.livePrefix = ''; this.streamText = ''; $('studio-stream-code').textContent = '';
              if (!this.liveInvalidated) this.canvasStatus(event.repairAttempts ? `自动纠错 · 第 ${event.repairAttempts} 次` : '正在生成反应', '完整步骤通过基础检查后自动预览');
              $('studio-live-preview').textContent = '← 等待这一轮的完整步骤';
            }
            if (event.type === 'status') { $('studio-progress').textContent = event.text; if (this.session.workflow && event.text.includes('正在检查')) this.session.workflow.stage = 'checking'; }
            if (event.type === 'delta') {
              this.streamText = event.text;
              $('studio-progress').textContent = `正在生成脚本 · 已接收 ${event.text.length} 字符`;
              if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; $('studio-stream-code').textContent = this.streamText; });
              if (!this.liveTimer) this.liveTimer = setTimeout(() => this.updateLivePreview(), 160);
            }
          }
        });
      } catch (e) { generationError = e.message; this.notice(e.message); }
      if (epoch !== this.epoch || sessionId !== this.session.id) return;
      if (!task && this.cancelled) task = { status: 'cancelled' };
      const previewStep = this.livePreview ? root.reactionApp.currentStepIndex : undefined;
      const failedCandidate = task && root.aiAssistant.candidate?.taskId === task.id ? root.aiAssistant.candidate : null;
      const fragment = (task?.streamText || this.streamText || failedCandidate?.raw || '').slice(0, Core.LIMITS.script);
      this.setBusy(false); this.clearLivePreview(); this.liveBase = null; this.streamText = '';
      this.session.activeGeneration = null;
      if (task?.status === 'question') {
        const form = task.questionForm || { question: task.question, options: [] };
        try {
          const next = Workflow.question(this.session.workflow, form, '');
          const message = this.addMessage('assistant', task.question, '', { question: form });
          next.pending.messageId = message.id; this.session.workflow = next;
        } catch (e) { this.addMessage('assistant', e.message, '', { retry: request, failure: { status: 'repeated-question', detail: e.message, fragment: '' } }); this.session.workflow.stage = 'failed'; }
        if (previousProposal && ChemiationAISafety.sameWorkspace(previousProposal.base, root.aiAssistant.getWorkspace())) this.preview(previousProposal);
      } else if (task?.status === 'explained') {
        this.addMessage('assistant', task.explanation); this.session.workflow.stage = 'explained';
        if (previousProposal && ChemiationAISafety.sameWorkspace(previousProposal.base, root.aiAssistant.getWorkspace())) this.preview(previousProposal);
      } else if (task?.status === 'ready' && root.aiAssistant.candidate?.taskId === task.id) {
        const candidate = root.aiAssistant.candidate;
        if (!ChemiationAISafety.sameWorkspace(candidate.base, root.aiAssistant.getWorkspace())) this.addMessage('assistant', '生成期间原稿或反应已变化，未覆盖。结果可在高级生成器的历史中找回。');
        else {
          if (this.session.workflow) this.session.workflow.stage = 'preview';
          const version = this.recordVersion(candidate.script, `AI 推演 ${this.session.versions.length + 1}`, '模型生成', prompt, previousProposal?.versionId);
          this.addMessage('assistant', `${task.repairAttempts ? `经过 ${task.repairAttempts} 次自动纠错，` : ''}新脚本已通过基础结构检查，左侧已打开预览。可以继续告诉我怎么改，满意后保留此版本。`, version.id);
          this.preview({ ...candidate, versionId: version.id, previewStep });
        }
      } else {
        if (this.session.workflow) this.session.workflow.stage = 'failed';
        const detail = task?.errorMessage || generationError || failedCandidate?.scopeError || failedCandidate?.validation?.diagnostics?.join('；') || '未收到通过检查的完整结果，可检查模型设置或补充反应条件。';
        const text = task?.status === 'incomplete' ? '回复被截断，临时预览已撤回，原稿未改动。可以在下方查看片段并重试。' : task?.status === 'cancelled' ? '已停止生成，临时预览已撤回，原稿未改动。' : `这次生成未成功，临时预览已撤回，原稿未改动。\n${detail.slice(0, 350)}`;
        this.addMessage('assistant', text, '', { retry: request, failure: { status: task?.status || 'failed', detail, fragment } });
        if (previousProposal && ChemiationAISafety.sameWorkspace(previousProposal.base, root.aiAssistant.getWorkspace())) this.preview(previousProposal);
      }
      this.persist().catch(() => {}); this.follow();
    },
    recordVersion(script, label, source, request = '', parentId) {
      const version = { id: Core.id(), script, label, source, request, status: 'candidate', createdAt: new Date().toISOString(), parentId: parentId || this.session.activeVersionId, scope: this.scope ? `第 ${this.scope.index + 1} 步` : '整份脚本', workflow: Workflow.normalize(this.session.workflow) };
      this.session.versions.push(version); return version;
    },
    useMatch(match, prompt) {
      if (this.busy) return;
      if (this.session.versions.length >= Core.LIMITS.versions - 2) { this.notice('当前会话版本已满，请导出后新建会话'); return; }
      const validation = ChemiationAISafety.validateScript(match.script, ReactionScriptEngine);
      if (!validation.valid) { this.notice('这个已有脚本未通过基础检查，请选择重新推演；未更新动画。'); return; }
      const version = this.recordVersion(match.script, validation.parsed.name, match.source, prompt);
      this.addMessage('assistant', `已从${match.source}载入“${validation.parsed.name}”供预览。请核对条件与步骤解释，再决定是否保留。`, version.id);
      this.preview({ script: match.script, complete: true, validation, base: root.aiAssistant.getWorkspace(), applied: false, versionId: version.id });
      this.persist().catch(() => {});
    },
    preview(proposal) {
      if (this.busy || !proposal.complete || !proposal.validation?.valid) return;
      if (!ChemiationAISafety.sameWorkspace(proposal.base, root.aiAssistant.getWorkspace())) { this.notice('原稿已变化，请从历史重新打开这个版本'); return; }
      this.proposal = proposal; this.before = false;
      if (this.session.workflow) this.session.workflow.stage = 'preview';
      if (this.scope) this.scope.script = proposal.script;
      $('studio-keep').disabled = false;
      root.reactionApp.previewStudioReaction(proposal.validation.parsed, this.scope ? this.scope.index : proposal.previewStep ?? 0);
      $('studio-candidate').hidden = false; $('studio-before').textContent = '对比原稿';
      $('studio-candidate-title').textContent = proposal.restore ? '左侧正在预览历史版本' : '左侧正在预览新版本';
      const warnings = proposal.validation.warnings || [];
      $('studio-candidate-note').textContent = `共 ${proposal.validation.parsed.steps.length} 个结构状态 · 基础检查通过，原稿尚未改动${warnings.length ? '；' + warnings.join('；') : ''}`;
      $('studio-keep').textContent = proposal.restore ? '恢复此版本 ↗' : '保留此版本 ↗';
      this.canvasStatus(proposal.restore ? '历史版本预览' : '新版本已就绪', '基础检查通过 · 点击“保留此版本”应用', 'ready');
      this.show();
    },
    compare() {
      if (!this.proposal || this.busy) return;
      this.before = !this.before;
      if (this.before) root.reactionApp.endStudioPreview();
      else root.reactionApp.previewStudioReaction(this.proposal.validation.parsed, this.scope ? this.scope.index : this.proposal.previewStep ?? 0);
      $('studio-before').textContent = this.before ? '查看新版本' : '对比原稿';
      this.canvasStatus(this.before ? '正在对比原稿' : '新版本预览', this.before ? '点击“查看新版本”返回候选结果' : '基础检查通过 · 确认后保留', this.before ? 'original' : 'ready');
    },
    discard() {
      if (this.busy) return;
      root.reactionApp.endStudioPreview(); this.proposal = null;
      this.scope = null; $('studio-scope-tag').hidden = true;
      $('studio-candidate').hidden = true;
      this.canvasStatus();
    },
    async keep() {
      if (this.busy || this.committing || !this.proposal) return;
      const p = this.proposal, app = root.reactionApp, owner = this.owner(), epoch = this.epoch;
      if (!ChemiationAISafety.sameWorkspace(p.base, root.aiAssistant.getWorkspace())) { this.notice('原稿已变化，未覆盖；可在历史中预览结果'); return; }
      if (app.presets.some((r, i) => i !== app.currentReactionIndex && r.name.trim() === p.validation.parsed.name.trim())) {
        this.notice('机理库中已有同名作品。请在对话中要求给这个副本换个名称，再保留。'); return;
      }
      if (!this.session.versions.some(v => v.script === p.base.script && v.status !== 'candidate')) {
        const baseline = this.recordVersion(p.base.script, '修改前的原始草稿', '工作区原稿'); baseline.status = 'accepted'; baseline.scope = '整份脚本';
      }
      this.committing = true; $('studio-keep').disabled = true;
      try { await this.persist(); } catch (_) { this.committing = false; $('studio-keep').disabled = false; return; }
      if (owner !== this.owner() || epoch !== this.epoch) { this.committing = false; return; }
      root.reactionApp.endStudioPreview(); this.proposal = null;
      root.aiAssistant.candidate = { ...p, historyRef: null, applied: false };
      if (!root.aiAssistant.applyToWorkspace(true)) { this.committing = false; $('studio-keep').disabled = false; this.proposal = p; this.notice('未能载入：请检查高级生成器中的提示，原稿备份仍保留'); return; }
      let version = this.session.versions.find(v => v.id === p.versionId);
      if (p.restore) { version = this.recordVersion(p.script, '恢复：' + (version?.label || '历史版本'), '版本恢复'); version.parentId = p.versionId; version.status = 'restored'; }
      else if (version) version.status = 'accepted';
      if (version) this.session.activeVersionId = version.id;
      if (this.session.workflow) this.session.workflow.stage = 'saved';
      $('studio-candidate').hidden = true;
      this.canvasStatus();
      this.scope = null; $('studio-scope-tag').hidden = true;
      this.addMessage('assistant', p.restore ? '已恢复这个版本。恢复前的脚本也已保存，可以随时找回。' : '已保留这个版本，工作区脚本和左侧动画已同步。');
      await this.persist().catch(() => {}); this.committing = false; this.show();
    },
    restoreVersion(id) {
      if (this.busy) return;
      const version = this.session.versions.find(v => v.id === id); if (!version) return;
      const validation = ChemiationAISafety.validateScript(version.script, ReactionScriptEngine);
      if (!validation.valid) { this.notice('这个历史草稿未通过检查，无法播放；可以导出会话找回脚本'); return; }
      this.scope = null; $('studio-scope-tag').hidden = true;
      $('studio-library').hidden = true;
      this.preview({ script: version.script, validation, complete: true, base: root.aiAssistant.getWorkspace(), applied: false, restore: true, versionId: version.id });
      this.persist().catch(() => {});
    },
    async history() {
      if (this.busy || this.loading || this.committing) return;
      $('studio-library').hidden = false; $('studio-library-status').textContent = '正在读取已保存的会话…';
      $('studio-sessions').replaceChildren(); $('studio-versions').replaceChildren(); $('studio-legacy-sessions').replaceChildren();
      const owner = this.owner(), epoch = this.epoch;
      try {
        const [current, legacy] = await Promise.all([this.sessionEntries(this.currentProject.id), this.sessionEntries('')]);
        if (owner !== this.owner() || epoch !== this.epoch) return;
        this.sessionIndex = current.items; this.renderSessionPicker();
        $('studio-library-status').textContent = current.cloudError ? '云端暂时不可用，以下为本机记录。' : '仅显示本机理项目的对话；切换不会自动替换当前脚本。';
        this.renderHistorySessions();
        for (const item of legacy.items) {
          const row = node('div', undefined, 'studio-history-row'), text = node('div');
          text.append(node('strong', item.title), node('p', '旧对话 · 尚未关联机理项目'));
          const button = node('button', '复制到本项目'); button.addEventListener('click', () => this.importLegacy(item.id, !item.local));
          row.append(text, button); $('studio-legacy-sessions').append(row);
        }
        $('studio-legacy-section').hidden = !legacy.items.length;
        for (const version of [...this.session.versions].reverse()) {
          const row = node('div', undefined, 'studio-history-row'), text = node('div');
          text.append(node('strong', version.label), node('p', `${version.status === 'candidate' ? '候选' : '已保留'} · ${version.scope || '脚本'} · ${new Date(version.createdAt).toLocaleString()}`));
          const button = node('button', '预览'); button.addEventListener('click', () => this.restoreVersion(version.id)); row.append(text, button); $('studio-versions').append(row);
        }
      } catch (e) { $('studio-library-status').textContent = e.message; }
    },
    renderHistorySessions() {
      const list = $('studio-sessions'), query = $('studio-history-search').value.trim().normalize('NFKC').toLocaleLowerCase();
      const owner = this.owner(), epoch = this.epoch;
      const current = () => owner === this.owner() && epoch === this.epoch && !this.busy && !this.loading && !this.committing;
      const items = (this.sessionIndex || []).filter(item => item.projectId === this.currentProject.id && (!query || item.title.normalize('NFKC').toLocaleLowerCase().includes(query)));
      list.replaceChildren();
      if (!items.length) list.append(node('p', query ? '没有找到这个名称的对话。' : '本项目还没有已保存的对话。', 'studio-muted'));
      for (const item of items) {
        const row = node('div', undefined, 'studio-history-row'); row.dataset.sessionId = item.id;
        const text = node('div'), actions = node('div', undefined, 'studio-history-buttons');
        text.append(node('strong', item.title), node('p', `${item.messageCount} 条消息 · ${item.versionCount} 个版本${item.id === this.session.id ? ' · 当前对话' : ''}`));
        const button = node('button', '打开'); button.addEventListener('click', () => { if (current()) this.openSession(item.id, !item.local); }); actions.append(button);
        if (item.cloud && item.local) { const remote = node('button', '云端'); remote.addEventListener('click', () => { if (current()) this.openSession(item.id, true); }); actions.append(remote); }
        const rename = node('button', '改名'), remove = node('button', '删除');
        rename.addEventListener('click', () => {
          if (!current()) return;
          row.querySelector('.studio-history-edit')?.remove();
          const form = node('form', undefined, 'studio-history-edit'), input = node('input');
          input.type = 'text'; input.maxLength = 100; input.value = item.title; input.setAttribute('aria-label', '新的对话名称');
          const save = node('button', '保存名称'), cancel = node('button', '取消'); save.type = 'submit'; cancel.type = 'button';
          cancel.addEventListener('click', () => form.remove()); form.append(input, save, cancel); row.append(form); input.focus(); input.select();
          form.addEventListener('submit', e => { e.preventDefault(); if (current() && input.value.trim()) this.renameSession(item, input.value.trim()); });
        });
        remove.addEventListener('click', () => {
          if (!current()) return;
          row.querySelector('.studio-history-edit')?.remove();
          const form = node('div', undefined, 'studio-history-edit');
          form.append(node('p', `删除“${item.title}”及其中的聊天、草稿和脚本版本？${owner === 'guest' ? '' : '云端记录也会删除。'}当前机理脚本保留。`));
          const confirm = node('button', '确认删除'), cancel = node('button', '取消'); confirm.className = 'studio-delete-confirm';
          confirm.addEventListener('click', () => { if (current()) this.deleteSession(item); }); cancel.addEventListener('click', () => form.remove());
          form.append(confirm, cancel); row.append(form);
        });
        actions.append(rename, remove); row.append(text, actions); list.append(row);
      }
    },
    async renameSession(item, title, { refreshHistory = true } = {}) {
      title = title.trim().slice(0, 100);
      if (!title || this.busy || this.loading || this.committing || item.projectId !== this.currentProject.id) return false;
      const owner = this.owner(), epoch = this.epoch;
      let session, previousTitle, saved = false;
      this.committing = true; this.setBusy(false);
      try {
        session = item.id === this.session.id ? this.session : await this.store.get(owner, item.id);
        if (!session) { session = (await this.request('/api/studio/sessions/' + item.id)).session; session.localRevision = 0; }
        if (owner !== this.owner() || epoch !== this.epoch) return false;
        if (session?.projectId !== this.currentProject.id) throw new Error('这段对话不属于当前机理项目');
        previousTitle = session.title; session.title = title; await this.persist(session); saved = true;
      } catch (e) {
        if (owner === this.owner() && epoch === this.epoch) {
          if (session === this.session && previousTitle !== undefined) { session.title = previousTitle; this.renderSessionPicker(); }
          this.notice('名称保存未完成：' + e.message);
        }
      }
      finally { this.committing = false; this.setBusy(this.busy); }
      if (refreshHistory && owner === this.owner() && epoch === this.epoch) await this.history();
      return saved;
    },
    async deleteSession(item) {
      if (this.busy || this.loading || this.committing || item.projectId !== this.currentProject.id) return;
      const owner = this.owner(), token = root.api.getToken(), epoch = this.epoch;
      clearTimeout(this.draftTimer);
      this.committing = true; this.setBusy(false);
      try {
        await this.persist(); await this.cloudQueue.catch(() => {});
        if (owner !== this.owner() || epoch !== this.epoch) return;
        if (owner !== 'guest') {
          if (!token) throw new Error('请登录后删除云端对话；本机记录已保留');
          await this.request('/api/studio/sessions/' + item.id, { method: 'DELETE' }, token);
        }
        await this.store.remove(owner, item.id);
        const key = owner + ':' + item.id;
        this.revisions.delete(key); this.localRevisions.delete(key); this.conflicts.delete(key);
        if (this.recoveries.get(owner + ':' + item.projectId)?.id === item.id) this.recoveries.delete(owner + ':' + item.projectId);
        if (owner !== this.owner() || epoch !== this.epoch) return;
        this.sessionIndex = this.sessionIndex.filter(v => v.id !== item.id);
        if (this.session.id === item.id) {
          clearTimeout(this.draftTimer); this.discard(); this.session = Core.create(this.currentProject); ++this.epoch;
          $('studio-input').value = ''; this.remember(); this.render(); await this.persist();
        }
        this.notice('对话已删除，当前机理脚本保留。');
      } catch (e) { if (owner === this.owner() && epoch === this.epoch) this.notice('删除未完成：' + e.message); }
      finally { this.committing = false; this.setBusy(this.busy); }
      if (owner === this.owner() && item.projectId === this.currentProject.id) await this.history();
    },
    async openSession(id, remote = false) {
      this.closePanels();
      if (this.busy || this.committing || this.loading || id === this.session.id && !remote) return;
      const owner = this.owner(), epoch = this.epoch;
      try {
        const saving = this.session.localRevision || this.session.messages.length || this.session.versions.length || $('studio-input').value ? this.persist() : Promise.resolve();
        this.loading = true; this.setBusy(false);
        await saving;
        if (remote) await this.cloudQueue.catch(() => {});
        const local = await this.store.get(owner, id);
        let session = remote ? (await this.request('/api/studio/sessions/' + id)).session : local;
        if (owner !== this.owner() || epoch !== this.epoch || !session) return;
        if (session.projectId !== this.currentProject.id) throw new Error('这段对话不属于当前机理项目，未载入');
        if (remote) {
          if (local && JSON.stringify([local.title, local.messages, local.versions, local.draft, local.scope, local.workflow]) !== JSON.stringify([session.title, session.messages, session.versions, session.draft, session.scope, session.workflow])) {
            const fork = { ...local, id: Core.id(), title: local.title + '（本地副本）', revision: 0, localRevision: 0 };
            await this.store.put(owner, fork);
          }
          session.localRevision = local?.localRevision || 0;
          const result = await this.store.put(owner, session);
          if (result.conflict) throw new Error('本机记录刚刚变化，请导出后重试');
          session = result; this.conflicts.delete(owner + ':' + id);
        }
        if (owner !== this.owner() || epoch !== this.epoch || session.projectId !== this.currentProject.id) return;
        this.discard(); this.session = Core.normalize(session); this.restoreScope(); ++this.epoch;
        $('studio-input').value = this.session.draft || ''; this.loading = false;
        this.remember(); this.render(); this.setBusy(false); $('studio-library').hidden = true; this.notice();
      } catch (e) { this.notice(e.message); $('studio-library-status').textContent = e.message; }
      finally { if (owner === this.owner() && epoch === this.epoch) { this.loading = false; this.setBusy(false); } }
    },
    async importLegacy(id, remote = false) {
      if (this.busy || this.loading || this.committing) return;
      const owner = this.owner(), epoch = this.epoch;
      try {
        await this.persist();
        const original = remote ? (await this.request('/api/studio/sessions/' + id)).session : await this.store.get(owner, id);
        if (epoch !== this.epoch || owner !== this.owner()) return;
        if (!original || original.projectId) throw new Error('仅支持复制未归属的旧对话');
        this.discard();
        this.session = Core.normalize({ ...original, id: Core.id(), projectId: this.currentProject.id, projectName: this.currentProject.name, revision: 0, localRevision: 0 }); ++this.epoch;
        $('studio-input').value = this.session.draft || ''; this.remember(); this.render(); await this.persist();
        $('studio-library').hidden = true; this.notice('旧对话已复制到本项目，原记录保持保留');
      } catch (e) { this.notice(e.message); }
    },
    async newSession() {
      this.closePanels();
      if (this.busy || this.committing || this.loading) return;
      const owner = this.owner(), epoch = this.epoch;
      try { await this.persist(); } catch (_) { return; }
      if (owner !== this.owner() || epoch !== this.epoch) return;
      this.discard(); this.scope = null; this.session = Core.create(this.currentProject); ++this.epoch;
      $('studio-input').value = ''; this.remember(); this.render(); this.notice(); $('studio-library').hidden = true; this.show();
      await this.persist().catch(() => {});
    },
    exportSession() {
      const blob = new Blob([JSON.stringify({ ...this.session, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = node('a'); a.href = url; a.download = `Chemiation-聊天与脚本-${this.session.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onUserChanged() {
      if (!this.ready) return;
      if (this.loadedOwner === this.owner()) return;
      root.aiAssistant.cancelGeneration(true); this.setBusy(false); this.clearLivePreview(); this.liveBase = null; this.discard();
      $('studio-library').hidden = true; this.loadOwner({ restoreProject: true });
    },
    closePanels(restoreFocus = false) {
      for (const [panel, trigger] of [['studio-project-panel', 'studio-project-toggle'], ['studio-tools-menu', 'studio-more']]) {
        const p = $(panel), t = $(trigger); if (!p || !t) continue;
        const wasOpen = !p.hidden; p.hidden = true; t.setAttribute('aria-expanded', 'false');
        if (restoreFocus && wasOpen) t.focus();
      }
      if ($('studio-rename-form')) $('studio-rename-form').hidden = true;
      this.renameTarget = null;
    },
    fitProjectPanel() {
      const panel = $('studio-project-panel');
      if (!panel.hidden) panel.style.maxHeight = Math.max(130, root.innerHeight - panel.getBoundingClientRect().top - 12) + 'px';
    },
    openCurrentRename() {
      if (this.busy || this.loading || this.committing) return;
      this.closePanels();
      $('studio-library').hidden = true;
      $('studio-project-panel').hidden = false; $('studio-project-toggle').setAttribute('aria-expanded', 'true');
      this.renameTarget = { id: this.session.id, projectId: this.currentProject.id, owner: this.owner(), epoch: this.epoch };
      $('studio-rename-form').hidden = false; $('studio-rename-input').value = this.session.title;
      this.fitProjectPanel(); $('studio-rename-input').focus(); $('studio-rename-input').select();
    },
    togglePanel(panel, trigger) {
      const opening = $(panel).hidden;
      this.closePanels();
      if (!opening) return;
      $(panel).hidden = false; $(trigger).setAttribute('aria-expanded', 'true');
      this.fitProjectPanel();
      $(panel).querySelector('select:not(:disabled), button:not(:disabled)')?.focus();
    },
    bind() {
      $('studio-project-toggle').addEventListener('click', () => this.togglePanel('studio-project-panel', 'studio-project-toggle'));
      $('studio-more').addEventListener('click', () => this.togglePanel('studio-tools-menu', 'studio-more'));
      $('studio-rename').addEventListener('click', () => this.openCurrentRename());
      $('studio-open-rename').addEventListener('click', () => this.openCurrentRename());
      $('studio-rename-cancel').addEventListener('click', () => this.closePanels(true));
      $('studio-rename-form').addEventListener('submit', async e => {
        e.preventDefault(); const target = this.renameTarget;
        if (!target || target.id !== this.session.id || target.epoch !== this.epoch || target.owner !== this.owner()) return;
        const saved = await this.renameSession(target, $('studio-rename-input').value, { refreshHistory: false });
        if (saved && target.id === this.session.id && target.epoch === this.epoch && target.owner === this.owner()) { this.closePanels(true); this.notice('对话名称已保存。'); }
      });
      $('studio-close-project').addEventListener('click', () => this.closePanels(true));
      $('studio-collapse').addEventListener('click', () => { this.closePanels(); root.reactionApp.toggleWorkspace(false); });
      document.addEventListener('pointerdown', e => { if (!e.target.closest('.studio-projectbar, .studio-menu-wrap')) this.closePanels(); });
      document.addEventListener('focusin', e => { if (!e.target.closest('.studio-projectbar, .studio-menu-wrap')) this.closePanels(); });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && (!$('studio-project-panel').hidden || !$('studio-tools-menu').hidden)) { e.preventDefault(); this.closePanels(true); }
      });
      $('studio-project-select').addEventListener('change', e => { this.closePanels(true); if (!this.committing) root.reactionApp.loadReaction(Number(e.target.value)); });
      $('studio-session-select').addEventListener('change', e => {
        this.closePanels(true);
        const item = (this.sessionIndex || []).find(v => v.id === e.target.value);
        if (item) this.openSession(item.id, !item.local);
      });
      $('studio-input').addEventListener('input', () => {
        clearTimeout(this.draftTimer);
        const owner = this.owner(), id = this.session.id, epoch = this.epoch;
        this.session.draft = $('studio-input').value;
        this.draftTimer = setTimeout(() => { if (owner === this.owner() && id === this.session.id && epoch === this.epoch && !this.loading && !this.committing) this.persist().catch(() => {}); }, 500);
      });
      $('studio-write-message').addEventListener('click', () => {
        this.composerExpanded = !this.composerExpanded; this.syncQuestionForms();
        if (this.composerExpanded) $('studio-input').focus();
        this.follow();
      });
      $('studio-form').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
      $('studio-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.submit(); } });
      $('studio-messages').addEventListener('click', e => { const b = e.target.closest('[data-studio-prompt], [data-studio-current]'); if (!b) return; if (b.dataset.studioCurrent) { this.refineStep(); $('studio-input').value = '完善本步骤的机理说明，保持其他步骤不变'; } else this.submit(b.dataset.studioPrompt); });
      $('studio-settings').addEventListener('click', () => { this.closePanels(); root.aiAssistant.openModal('new', { legacy: true }); root.aiAssistant.switchTab('settings'); });
      $('studio-history').addEventListener('click', () => { this.closePanels(); this.history(); });
      $('studio-history-search').addEventListener('input', () => this.renderHistorySessions());
      $('studio-new').addEventListener('click', () => this.newSession());
      $('studio-refine-step').addEventListener('click', () => this.refineStep());
      $('studio-clear-scope').addEventListener('click', () => { this.scope = null; this.renderScope(); this.persist().catch(() => {}); });
      $('studio-cancel').addEventListener('click', () => {
        this.cancelLookup();
        if (root.aiAssistant.isGenerating) { this.cancelled = true; root.aiAssistant.cancelGeneration(); }
        else {
          ++this.runSequence; this.setBusy(false);
          const request = this.session.activeGeneration; this.session.activeGeneration = null;
          if (this.session.workflow) this.session.workflow.stage = 'failed';
          this.clearLivePreview(); this.liveBase = null;
          this.addMessage('assistant', request ? '已停止生成，原稿未改动。' : '已停止检索，原稿未改动。', '', request ? { retry: request } : {});
          this.persist().catch(() => {});
        }
      });
      $('studio-keep').addEventListener('click', () => this.keep());
      $('studio-discard').addEventListener('click', () => { this.discard(); this.renderScope(); this.persist().catch(() => {}); });
      $('studio-before').addEventListener('click', () => this.compare());
      $('studio-close-library').addEventListener('click', () => { $('studio-library').hidden = true; $('studio-more').focus(); });
      $('studio-export').addEventListener('click', () => this.exportSession());
      $('studio-retry-sync').addEventListener('click', () => { if (!this.conflicts.has(this.owner() + ':' + this.session.id)) this.persist().catch(() => {}); else $('studio-library-status').textContent = '请先导出本地副本，再打开云端版本。'; });
      root.addEventListener('chemiation:step', () => this.updateContext());
      root.addEventListener('resize', () => { this.fitProjectPanel(); clearTimeout(this.fitTimer); this.fitTimer = setTimeout(() => this.fitCanvas(), 150); });
      $('script-editor').addEventListener('input', () => {
        this.renderScope();
        if (this.liveBase) { this.liveInvalidated = true; this.clearLivePreview(); }
        if (this.proposal && !ChemiationAISafety.sameWorkspace(this.proposal.base, root.aiAssistant.getWorkspace())) { root.reactionApp.endStudioPreview(); this.canvasStatus(); $('studio-keep').disabled = true; this.notice('原稿已手动修改，已停止预览。候选仍保留在聊天历史中。'); }
      });
    }
  };
  root.chemiationStudio = studio;
})(window);
