/**
 * Chemiation - Reaction Repository Controller
 * Cloud storage and public mechanism repository manager (CRUD, search, tags, star/fork, export/import).
 */

const repoCtrl = {
  currentTab: 'public', // 'public' | 'my' | 'offline'
  currentFilter: { search: '', tag: 'all', category: 'all' },
  cachedItems: [],

  init() {
    this.bindEvents();
  },

  onUserChanged(user) {
    if (this.currentTab === 'my') {
      this.loadRepos();
    }
  },

  openModal(defaultTab = 'public') {
    const modal = document.getElementById('repo-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    // If not logged in and requesting 'my', switch to 'public'
    if (!window.currentUser && defaultTab === 'my') {
      defaultTab = 'public';
    }
    this.switchTab(defaultTab);
  },

  closeModal() {
    const modal = document.getElementById('repo-modal');
    if (modal) modal.style.display = 'none';
  },

  openSaveModal() {
    const modal = document.getElementById('save-repo-modal');
    if (!modal) return;

    if (!window.currentUser) {
      if (window.authCtrl) {
        window.authCtrl.openModal('login');
        if (window.authCtrl.showMessage) {
          window.authCtrl.showMessage('请先登录账号，以将化学机理保存至个人云端仓库！', false);
        }
      }
      return;
    }

    // Grab current data from reactionApp / editor
    let currentTitle = '';
    let currentEquation = '';
    let currentSummary = '';
    let currentScript = '';

    const editor = document.getElementById('script-editor');
    if (editor && editor.value.trim()) {
      currentScript = editor.value.trim();
    }

    if (window.reactionApp) {
      const curReaction = window.reactionApp.presets[window.reactionApp.currentReactionIndex];
      if (curReaction) {
        currentTitle = curReaction.name || '';
        currentEquation = curReaction.equation || '';
        currentSummary = curReaction.summary || '';
        if (!currentScript && typeof ReactionScriptEngine !== 'undefined') {
          try {
            currentScript = ReactionScriptEngine.serialize(curReaction);
          } catch {}
        }
      }
    }

    const titleInput = document.getElementById('save-repo-title');
    const eqInput = document.getElementById('save-repo-equation');
    const descInput = document.getElementById('save-repo-desc');
    const scriptInput = document.getElementById('save-repo-script');
    const tagsInput = document.getElementById('save-repo-tags');
    const publicCheckbox = document.getElementById('save-repo-public');

    if (titleInput) titleInput.value = currentTitle || '自定化学反应机理推演';
    if (eqInput) eqInput.value = currentEquation || '';
    if (descInput) descInput.value = currentSummary || '';
    if (scriptInput) scriptInput.value = currentScript || '';
    if (tagsInput) tagsInput.value = '自定推演, 有机机理';
    if (publicCheckbox) publicCheckbox.checked = true;

    this.clearSaveMessages();
    modal.style.display = 'flex';
  },

  closeSaveModal() {
    const modal = document.getElementById('save-repo-modal');
    if (modal) modal.style.display = 'none';
    this.clearSaveMessages();
  },

  clearSaveMessages() {
    const msgEl = document.getElementById('save-repo-status-message');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
    }
  },

  showSaveMessage(msg, isError = true) {
    const msgEl = document.getElementById('save-repo-status-message');
    if (!msgEl) return;
    msgEl.textContent = msg;
    msgEl.className = `auth-message ${isError ? 'error' : 'success'}`;
    msgEl.style.display = 'block';
  },

  switchTab(tab) {
    this.currentTab = tab;

    const tabPub = document.getElementById('repo-tab-public');
    const tabMy = document.getElementById('repo-tab-my');
    const tabOff = document.getElementById('repo-tab-offline');

    if (tabPub) tabPub.classList.toggle('active', tab === 'public');
    if (tabMy) tabMy.classList.toggle('active', tab === 'my');
    if (tabOff) tabOff.classList.toggle('active', tab === 'offline');

    this.loadRepos();
  },

  async loadRepos() {
    const grid = document.getElementById('repo-card-grid');
    if (!grid) return;
    this.loadReqId = (this.loadReqId || 0) + 1;
    const reqId = this.loadReqId;

    grid.innerHTML = '<div class="repo-empty-state">正在加载云端机理数据...</div>';

    try {
      let res;
      if (this.currentTab === 'my') {
        if (!window.currentUser) {
          grid.innerHTML = `
            <div class="repo-empty-state">
              <p style="margin-bottom: 12px; font-size: 14px;">请先登录您的账号以访问个人云端仓库</p>
              <button class="btn-primary" id="btn-login-prompt">立即登录 / 注册</button>
            </div>
          `;
          const btn = document.getElementById('btn-login-prompt');
          if (btn && window.authCtrl) {
            btn.addEventListener('click', () => window.authCtrl.openModal('login'));
          }
          return;
        }
        res = await api.getUserRepos(this.currentFilter);
      } else if (this.currentTab === 'public') {
        res = await api.getPublicRepos(this.currentFilter);
      } else {
        // Offline local store
        const items = api.getOfflineRepos();
        res = { success: true, items };
      }

      if (reqId !== this.loadReqId) return; // Discard stale response (Q2 Fix)

      this.cachedItems = (res && res.items) || [];
      this.renderRepoGrid(this.cachedItems);
    } catch (err) {
      if (reqId !== this.loadReqId) return;
      grid.innerHTML = `<div class="repo-empty-state" style="color: #c82333;">加载失败: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  renderRepoGrid(items) {
    const grid = document.getElementById('repo-card-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
      let emptyMsg = '您在云端仓库中暂未保存任何机理项目。快去编写并点击“保存到云端”吧！';
      if (this.currentTab === 'public') emptyMsg = '未检索到符合条件的公开机理模型。';
      if (this.currentTab === 'offline') emptyMsg = '暂无本地离线草稿记录。';
      grid.innerHTML = `<div class="repo-empty-state">${emptyMsg}</div>`;
      return;
    }

    grid.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'repo-card-item';

      const isOwner = (this.currentTab === 'my') || (this.currentTab === 'offline') ||
        (window.currentUser && item.userId === window.currentUser.id);

      const tagHtml = Array.isArray(item.tags)
        ? item.tags.map(t => `<span class="repo-tag-pill">${this.escapeHtml(t)}</span>`).join('')
        : '';

      const authorName = item.authorName || 'Chemiation 研究员';
      const authorClean = authorName.replace(/\s*\(.*?\)/, '');
      const formattedEquation = this.formatEquation(item.equation);
      const escapedEquation = this.escapeHtml(formattedEquation);

      card.innerHTML = `
        <div>
          <div class="repo-card-head">
            <div class="repo-card-title" title="${this.escapeHtml(item.title || '未命名机理')}">${this.escapeHtml(item.title || '未命名机理')}</div>
          </div>
          ${item.equation ? `<div class="repo-card-equation" title="${escapedEquation}">${escapedEquation}</div>` : ''}
          ${item.summary ? `<div class="repo-card-desc" title="${this.escapeHtml(item.summary)}">${this.escapeHtml(item.summary)}</div>` : ''}
          ${tagHtml ? `<div class="repo-card-tags">${tagHtml}</div>` : ''}
        </div>

        <div>
          <div class="repo-card-footer">
            <div class="repo-card-author" title="@${this.escapeHtml(authorName)}">
              <span class="user-avatar-initials">${this.escapeHtml(this.getAuthorBadge(authorClean, item.authorAvatar))}</span>
              <span>@${this.escapeHtml(authorClean)}</span>
            </div>
            <div class="repo-card-stats">
              <span title="赞/收藏">★ ${parseInt(item.stars || 0, 10)}</span>
              <span title="浏览次数">👁 ${parseInt(item.views || 0, 10)}</span>
            </div>
          </div>

          <div class="repo-card-actions">
            <button class="btn-primary btn-repo-load" data-id="${this.escapeHtml(item.id)}" title="载入到画布进行三维推演">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              载入推演
            </button>
            <button class="btn-secondary btn-repo-action btn-repo-star" data-id="${this.escapeHtml(item.id)}" title="标星收藏">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <button class="btn-secondary btn-repo-action btn-repo-fork" data-id="${this.escapeHtml(item.id)}" title="Fork 副本到我的仓库">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
            </button>
            ${isOwner ? `
              <button class="btn-secondary btn-repo-action btn-repo-edit" data-id="${this.escapeHtml(item.id)}" title="编辑修改此机理">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-danger-sm btn-repo-action btn-repo-del" style="font-size: 15px; font-weight: bold; line-height: 1;" data-id="${this.escapeHtml(item.id)}" title="删除此项目">
                ×
              </button>
            ` : ''}
          </div>
        </div>
      `;

      // Event handlers
      card.querySelector('.btn-repo-load').addEventListener('click', () => {
        this.loadIntoWorkspace(item);
      });

      card.querySelector('.btn-repo-star').addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.toggleStar(item.id);
      });

      card.querySelector('.btn-repo-fork').addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.forkItem(item.id);
      });

      if (isOwner) {
        const editBtn = card.querySelector('.btn-repo-edit');
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleEditItem(item);
          });
        }

        const delBtn = card.querySelector('.btn-repo-del');
        if (delBtn) {
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`确定要从云端删除机理 [${item.title}] 吗？`)) {
              await this.deleteItem(item.id);
            }
          });
        }
      }

      grid.appendChild(card);
    });
  },

  async handleEditItem(item) {
    const newTitle = prompt('修改反应机理名称:', item.title || '');
    if (newTitle === null) return;
    const newSummary = prompt('修改机理描述简介:', item.summary || '');
    if (newSummary === null) return;

    try {
      await api.updateRepo(item.id, {
        title: newTitle.trim() || item.title,
        summary: newSummary.trim()
      });
      this.loadRepos();
    } catch (err) {
      alert(`更新机理失败: ${err.message}`);
    }
  },

  async loadIntoWorkspace(item) {
    if (!item.script) {
      alert('该机理暂无 CCPL 推演脚本内容');
      return;
    }

    try {
      if (typeof ReactionScriptEngine === 'undefined') {
        throw new Error('ReactionScriptEngine 未加载');
      }

      const parsed = ReactionScriptEngine.parse(item.script);
      if (!parsed) throw new Error('解析 CCPL 脚本失败');

      // Preserve title/equation/summary if defined in repo item
      if (item.title) parsed.name = item.title;
      if (item.equation) parsed.equation = this.formatEquation(item.equation);
      if (item.summary) parsed.summary = item.summary;
      parsed.id = item.id;

      if (window.reactionApp && typeof window.reactionApp.loadCustomReaction === 'function') {
        window.reactionApp.loadCustomReaction(parsed);
      } else if (window.reactionApp) {
        // Fallback
        window.reactionApp.presets.unshift(parsed);
        window.reactionApp.loadReaction(0);
      }

      this.closeModal();

      // Show toast
      const toast = document.getElementById('canvas-step-toast');
      if (toast) {
        toast.innerHTML = `<span class="toast-num">已载入</span><span class="toast-title">${parsed.name}</span>`;
      }
    } catch (err) {
      alert(`载入推演失败: ${err.message}`);
    }
  },

  async toggleStar(id) {
    if (!window.currentUser) {
      if (window.authCtrl) window.authCtrl.openModal('login');
      return;
    }
    try {
      const res = await api.starRepo(id);
      if (res && res.success) {
        this.loadRepos();
      }
    } catch (err) {
      alert(`标星失败: ${err.message}`);
    }
  },

  async forkItem(id) {
    if (!window.currentUser) {
      if (window.authCtrl) window.authCtrl.openModal('login');
      return;
    }
    try {
      const res = await api.forkRepo(id);
      if (res && res.success) {
        alert('已成功 Fork 到您的个人云端机理仓库！');
        this.switchTab('my');
      }
    } catch (err) {
      alert(`Fork 失败: ${err.message}`);
    }
  },

  async deleteItem(id) {
    try {
      const res = await api.deleteRepo(id);
      if (res && res.success) {
        this.loadRepos();
        if (window.authCtrl && window.currentUser) {
          window.currentUser.repoCount = Math.max(0, (window.currentUser.repoCount || 1) - 1);
        }
      }
    } catch (err) {
      alert(`删除失败: ${err.message}`);
    }
  },

  async handleSave(e) {
    if (e) e.preventDefault();
    this.clearSaveMessages();

    const titleInput = document.getElementById('save-repo-title');
    const eqInput = document.getElementById('save-repo-equation');
    const descInput = document.getElementById('save-repo-desc');
    const scriptInput = document.getElementById('save-repo-script');
    const catInput = document.getElementById('save-repo-category');
    const tagsInput = document.getElementById('save-repo-tags');
    const publicCheckbox = document.getElementById('save-repo-public');

    const title = titleInput ? titleInput.value.trim() : '';
    const equation = eqInput ? eqInput.value.trim() : '';
    const summary = descInput ? descInput.value.trim() : '';
    const script = scriptInput ? scriptInput.value.trim() : '';
    const category = catInput ? catInput.value : '自定推演';
    const tagsStr = tagsInput ? tagsInput.value.trim() : '';
    const isPublic = publicCheckbox ? publicCheckbox.checked : true;

    if (!title) {
      return this.showSaveMessage('请输入反应机理名称');
    }
    if (!script) {
      return this.showSaveMessage('CCPL 推演脚本内容不能为空');
    }

    const tags = tagsStr
      .split(/[,，、\s]+/)
      .map(t => t.trim())
      .filter(Boolean);

    try {
      const res = await api.createRepo({
        title,
        equation,
        summary,
        script,
        category,
        tags,
        isPublic
      });

      if (res && res.success) {
        this.showSaveMessage('机理已成功保存到云端仓库！', false);
        if (window.currentUser) {
          window.currentUser.repoCount = (window.currentUser.repoCount || 0) + 1;
        }
        setTimeout(() => {
          this.closeSaveModal();
          this.openModal('my');
        }, 600);
      }
    } catch (err) {
      this.showSaveMessage(`保存失败: ${err.message}`);
    }
  },

  async handleExportJSON() {
    try {
      const data = await api.exportRepos();
      const exportItems = (data && data.items) ? data.items : (Array.isArray(data) ? data : []);
      const blob = new Blob([JSON.stringify(exportItems, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chemiation_reactions_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`导出 JSON 失败: ${err.message}`);
    }
  },

  getAuthorBadge(name, avatar) {
    if (avatar && typeof avatar === 'string' && !/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\u2300-\u23FF]/.test(avatar)) {
      return avatar.trim().substring(0, 3).toUpperCase();
    }
    const clean = name || 'User';
    return clean.charAt(0).toUpperCase();
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  formatEquation(eq) {
    if (!eq) return '';
    let text = String(eq);
    if (window.ReactionScriptEngine && typeof window.ReactionScriptEngine.formatChemText === 'function') {
      text = window.ReactionScriptEngine.formatChemText(text);
    }
    return text;
  },

  bindEvents() {
    // Open repo modal buttons
    const btnOpenRepo = document.getElementById('header-repo-cloud-btn');
    if (btnOpenRepo) {
      btnOpenRepo.addEventListener('click', () => this.openModal('public'));
    }

    const btnSaveCloud = document.getElementById('btn-save-cloud');
    if (btnSaveCloud) {
      btnSaveCloud.addEventListener('click', () => this.openSaveModal());
    }

    // Modal tabs
    const tabPub = document.getElementById('repo-tab-public');
    if (tabPub) tabPub.addEventListener('click', () => this.switchTab('public'));

    const tabMy = document.getElementById('repo-tab-my');
    if (tabMy) tabMy.addEventListener('click', () => this.switchTab('my'));

    const tabOff = document.getElementById('repo-tab-offline');
    if (tabOff) tabOff.addEventListener('click', () => this.switchTab('offline'));

    // Search & Filter
    const searchInput = document.getElementById('repo-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter.search = e.target.value.trim();
        this.loadRepos();
      });
    }

    const catFilter = document.getElementById('repo-category-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.currentFilter.category = e.target.value;
        this.loadRepos();
      });
    }

    // Save Form
    const saveForm = document.getElementById('save-repo-form');
    if (saveForm) {
      saveForm.addEventListener('submit', (e) => this.handleSave(e));
    }

    // Export JSON button
    const btnExport = document.getElementById('btn-export-repos-json');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.handleExportJSON());
    }

    // Close buttons
    document.querySelectorAll('.close-repo-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    document.querySelectorAll('.close-save-repo-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeSaveModal());
    });

    // Close on backdrop click
    const repoModal = document.getElementById('repo-modal');
    if (repoModal) {
      repoModal.addEventListener('click', (e) => {
        if (e.target === repoModal) this.closeModal();
      });
    }

    const saveModal = document.getElementById('save-repo-modal');
    if (saveModal) {
      saveModal.addEventListener('click', (e) => {
        if (e.target === saveModal) this.closeSaveModal();
      });
    }
  }
};

window.repoCtrl = repoCtrl;
