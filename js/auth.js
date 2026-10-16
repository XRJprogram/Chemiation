/**
 * Chemiation - Authentication & User Profile Controller
 * Manages user session, login/registration dialogs, profile card, and header user badge.
 */

window.currentUser = null;

const authCtrl = {
  currentTab: 'login', // 'login' | 'register'

  async init() {
    this.bindEvents();
    try {
      const res = await api.getMe();
      if (res && res.user) {
        this.setUser(res.user);
      } else {
        this.setUser(null);
      }
    } catch {
      this.setUser(null);
    }
  },

  setUser(user) {
    window.currentUser = user;
    this.updateHeaderBadge();
    if (window.repoCtrl && typeof window.repoCtrl.onUserChanged === 'function') {
      window.repoCtrl.onUserChanged(user);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  getInitials(u) {
    if (!u) return 'U';
    if (u.avatar && typeof u.avatar === 'string' && !/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\u2300-\u23FF]/.test(u.avatar)) {
      return u.avatar.trim().substring(0, 3).toUpperCase();
    }
    const name = u.nickname || u.username || 'User';
    return name.charAt(0).toUpperCase();
  },

  updateHeaderBadge() {
    const container = document.getElementById('header-user-section');
    if (!container) return;

    const isZh = (typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.currentLang === 'zh') ||
      (document.documentElement.lang === 'zh-CN');

    if (window.currentUser) {
      const u = window.currentUser;
      const isAdmin = u.role === 'admin';
      const initials = this.getInitials(u);
      container.innerHTML = `
        <div id="header-user-badge" class="header-user-badge" title="${isZh ? '个人中心与操作菜单' : 'User Menu'} (@${this.escapeHtml(u.username)})">
          <span class="user-badge-avatar">${this.escapeHtml(initials)}</span>
          <span class="user-badge-name">@${this.escapeHtml(u.nickname || u.username)}</span>
          ${isAdmin ? '<span style="font-size: 10px; background: rgba(184, 74, 40, 0.15); color: #b84a28; padding: 1px 4px; border-radius: 4px; font-weight: 700;">ADMIN</span>' : ''}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        <div id="user-dropdown-menu" class="user-dropdown-menu">
          <div style="padding: 10px 16px 8px; border-bottom: 1px solid rgba(94, 65, 47, 0.1);">
            <div style="font-weight: 700; font-size: 13px; color: var(--color-dark-brown);">@${this.escapeHtml(u.username)}</div>
            <div style="font-size: 11px; color: var(--color-text-muted);">${this.escapeHtml(u.email || (isAdmin ? '系统管理员' : 'Chemiation 研究员'))}</div>
          </div>
          <div class="user-dropdown-item" id="dropdown-my-repo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>${isZh ? '我的云端机理仓库' : 'My Cloud Repository'}</span>
          </div>
          <div class="user-dropdown-item" id="dropdown-save-repo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
            <span>${isZh ? '保存当前推演到云端' : 'Save Current to Cloud'}</span>
          </div>
          <div class="user-dropdown-item" id="dropdown-profile">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>${isZh ? '个人资料设置' : 'Profile Settings'}</span>
          </div>
          <a class="user-dropdown-item" href="admin.html" target="_blank" style="text-decoration: none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
            <span>${isZh ? '服务器监控管理台' : 'Server Dashboard'}</span>
          </a>
          <div class="user-dropdown-divider"></div>
          <div class="user-dropdown-item" id="dropdown-logout" style="color: #c82333;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>${isZh ? '退出登录' : 'Sign Out'}</span>
          </div>
        </div>
      `;

      // Bind badge click to toggle dropdown
      const badge = document.getElementById('header-user-badge');
      const menu = document.getElementById('user-dropdown-menu');

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
      });

      document.getElementById('dropdown-my-repo').addEventListener('click', () => {
        menu.style.display = 'none';
        if (window.repoCtrl) window.repoCtrl.openModal('my');
      });

      document.getElementById('dropdown-save-repo').addEventListener('click', () => {
        menu.style.display = 'none';
        if (window.repoCtrl) window.repoCtrl.openSaveModal();
      });

      document.getElementById('dropdown-profile').addEventListener('click', () => {
        menu.style.display = 'none';
        this.openProfileModal();
      });

      document.getElementById('dropdown-logout').addEventListener('click', () => {
        menu.style.display = 'none';
        this.handleLogout();
      });

      // Close on outside click
      document.addEventListener('click', () => {
        if (menu) menu.style.display = 'none';
      });
    } else {
      // Not logged in: show primary "登录 / 注册" button at far right
      container.innerHTML = `
        <button id="header-auth-btn" class="header-auth-btn" title="${isZh ? '登录或注册账号以使用云端机理仓库' : 'Sign In or Register'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>${isZh ? '登录 / 注册' : 'Sign In'}</span>
        </button>
      `;

      const authBtn = document.getElementById('header-auth-btn');
      if (authBtn) {
        authBtn.addEventListener('click', () => this.openModal());
      }
    }
  },

  openModal(defaultTab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    this.clearMessages();
    this.switchTab(defaultTab);
    modal.style.display = 'flex';
  },

  closeModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
    this.clearMessages();
  },

  openProfileModal() {
    if (!window.currentUser) return this.openModal('login');
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    const u = window.currentUser;
    const nameEl = document.getElementById('profile-modal-username');
    const nickInput = document.getElementById('profile-input-nickname');
    const emailInput = document.getElementById('profile-input-email');
    const bioInput = document.getElementById('profile-input-bio');
    const avatarInput = document.getElementById('profile-input-avatar');
    const avatarPreview = document.getElementById('profile-modal-avatar-preview');
    const roleEl = document.getElementById('profile-modal-role');
    const repoCountEl = document.getElementById('profile-modal-repocount');

    const initials = this.getInitials(u);
    if (nameEl) nameEl.textContent = `@${u.username}`;
    if (nickInput) nickInput.value = u.nickname || u.username;
    if (emailInput) emailInput.value = u.email || '';
    if (bioInput) bioInput.value = u.bio || '';
    if (avatarInput) avatarInput.value = (u.avatar && !/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\u2300-\u23FF]/.test(u.avatar)) ? u.avatar : initials;
    if (avatarPreview) avatarPreview.textContent = initials;
    if (roleEl) roleEl.textContent = u.role || 'user';
    if (repoCountEl) repoCountEl.textContent = `${u.repoCount || 0} 个机理项目`;

    this.clearProfileMessages();
    modal.style.display = 'flex';
  },

  closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
    this.clearProfileMessages();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.clearMessages();

    const tabLogin = document.getElementById('auth-tab-login');
    const tabReg = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('auth-form-login');
    const formReg = document.getElementById('auth-form-register');

    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabReg) tabReg.classList.remove('active');
      if (formLogin) formLogin.style.display = 'block';
      if (formReg) formReg.style.display = 'none';
    } else {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabReg) tabReg.classList.add('active');
      if (formLogin) formLogin.style.display = 'none';
      if (formReg) formReg.style.display = 'block';
    }
  },

  showMessage(msg, isError = true) {
    const msgEl = document.getElementById('auth-status-message');
    if (!msgEl) return;
    msgEl.textContent = msg;
    msgEl.className = `auth-message ${isError ? 'error' : 'success'}`;
    msgEl.style.display = 'block';
  },

  clearMessages() {
    const msgEl = document.getElementById('auth-status-message');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
    }
  },

  showProfileMessage(msg, isError = true) {
    const msgEl = document.getElementById('profile-status-message');
    if (!msgEl) return;
    msgEl.textContent = msg;
    msgEl.className = `auth-message ${isError ? 'error' : 'success'}`;
    msgEl.style.display = 'block';
  },

  clearProfileMessages() {
    const msgEl = document.getElementById('profile-status-message');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.style.display = 'none';
    }
  },

  async handleLogin(e) {
    if (e) e.preventDefault();
    this.clearMessages();

    const userInput = document.getElementById('login-input-username');
    const passInput = document.getElementById('login-input-password');
    const username = userInput ? userInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (!username || !password) {
      return this.showMessage('请输入用户名和密码');
    }

    try {
      const res = await api.login(username, password);
      if (res && res.user) {
        this.setUser(res.user);
        this.showMessage('登录成功！正在进入...', false);
        if (userInput) userInput.value = '';
        if (passInput) passInput.value = '';
        setTimeout(() => {
          this.closeModal();
          if (window.repoCtrl) window.repoCtrl.loadRepos();
        }, 500);
      }
    } catch (err) {
      this.showMessage(err.message || '登录失败，请检查账号密码');
    }
  },

  async handleRegister(e) {
    if (e) e.preventDefault();
    this.clearMessages();

    const userInput = document.getElementById('reg-input-username');
    const nickInput = document.getElementById('reg-input-nickname');
    const passInput = document.getElementById('reg-input-password');
    const emailInput = document.getElementById('reg-input-email');

    const username = userInput ? userInput.value.trim() : '';
    const nickname = nickInput ? nickInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (!username || username.length < 3 || username.length > 32) {
      return this.showMessage('用户名需在 3 到 32 个字符之间');
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return this.showMessage('用户名仅支持字母、数字、下划线及中文');
    }
    if (!password || password.length < 6) {
      return this.showMessage('密码长度至少需要 6 位');
    }

    try {
      const res = await api.register(username, password, nickname, email);
      if (res && res.user) {
        this.setUser(res.user);
        this.showMessage('注册并登录成功！', false);
        if (userInput) userInput.value = '';
        if (nickInput) nickInput.value = '';
        if (passInput) passInput.value = '';
        if (emailInput) emailInput.value = '';
        setTimeout(() => {
          this.closeModal();
          if (window.repoCtrl) window.repoCtrl.loadRepos();
        }, 500);
      }
    } catch (err) {
      this.showMessage(err.message || '注册失败，用户名可能已被占用');
    }
  },

  async handleUpdateProfile(e) {
    if (e) e.preventDefault();
    this.clearProfileMessages();

    const nickInput = document.getElementById('profile-input-nickname');
    const emailInput = document.getElementById('profile-input-email');
    const bioInput = document.getElementById('profile-input-bio');
    const avatarInput = document.getElementById('profile-input-avatar');

    try {
      const defaultInitial = this.getInitials(window.currentUser);
      const res = await api.updateProfile({
        nickname: nickInput ? nickInput.value.trim() : '',
        email: emailInput ? emailInput.value.trim() : '',
        bio: bioInput ? bioInput.value.trim() : '',
        avatar: avatarInput && avatarInput.value.trim() ? avatarInput.value.trim().substring(0, 4) : defaultInitial
      });
      if (res && res.user) {
        this.setUser({ ...window.currentUser, ...res.user });
        this.showProfileMessage('个人资料已成功更新！', false);
      }
    } catch (err) {
      this.showProfileMessage(err.message || '更新失败');
    }
  },

  async handleLogout() {
    await api.logout();
    this.setUser(null);
    this.closeProfileModal();
    if (window.repoCtrl) window.repoCtrl.loadRepos();
  },

  bindEvents() {
    // Auth modal tabs
    const tabLogin = document.getElementById('auth-tab-login');
    if (tabLogin) tabLogin.addEventListener('click', () => this.switchTab('login'));

    const tabReg = document.getElementById('auth-tab-register');
    if (tabReg) tabReg.addEventListener('click', () => this.switchTab('register'));

    // Forms
    const formLogin = document.getElementById('auth-form-login');
    if (formLogin) formLogin.addEventListener('submit', (e) => this.handleLogin(e));

    const formReg = document.getElementById('auth-form-register');
    if (formReg) formReg.addEventListener('submit', (e) => this.handleRegister(e));

    const formProfile = document.getElementById('profile-form');
    if (formProfile) formProfile.addEventListener('submit', (e) => this.handleUpdateProfile(e));

    // Close buttons
    document.querySelectorAll('.close-auth-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    document.querySelectorAll('.close-profile-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeProfileModal());
    });

    // Close on backdrop click
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) this.closeModal();
      });
    }

    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) this.closeProfileModal();
      });
    }
  }
};

window.authCtrl = authCtrl;

if (typeof window !== 'undefined') {
  window.addEventListener('chemiation:server-online', () => {
    if (window.authCtrl && typeof window.authCtrl.init === 'function') {
      window.authCtrl.init().catch(() => {});
    }
  });
}
