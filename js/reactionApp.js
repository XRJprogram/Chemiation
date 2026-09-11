/**
 * Chemiation - Reaction Deduction Application Controller
 * 参考 Anychem 架构设计的反应推演工作区与脚本编辑器
 */

class ReactionApp {
  constructor() {
    this.storageKey = 'chemiation_reactions_v11';
    this.langStorageKey = 'chemiation_lang_preference';
    this.lang = this.loadLanguagePreference();
    this.presets = this.loadInitialPresets();
    this.currentReactionIndex = 0;
    this.currentStepIndex = 0;

    this.activeTab = 'steps'; // 'steps' | 'script'
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.playTimer = null;
    this.stepBaseDuration = 2800; // ms

    this.isScriptDirty = false;

    this.initI18n();
    this.initDOM();
    this.initRenderer();
    this.initResizable();
    this.bindEvents();
    this.applyLanguage();
    this.loadReaction(0);
  }

  loadLanguagePreference() {
    try {
      const saved = localStorage.getItem(this.langStorageKey);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch (e) {}
    return 'zh';
  }

  initI18n() {
    this.i18n = {
      zh: {
        docsBtn: '语法手册',
        repoBtn: 'GitHub 仓库',
        workspaceTitle: '推演工作区',
        tabSteps: '机理步骤',
        tabScript: 'CCPL 脚本',
        libraryTitle: '反应机理库',
        btnNew: '+ 新建',
        btnDelete: '🗑 删除',
        stepsSequence: '步骤序列',
        stepsHint: '点击直达任意步',
        scriptTitle: 'CCPL 推演脚本',
        statusSynced: '已同步',
        statusSaving: '已保存',
        statusDirty: '未保存',
        statusError: '语法错误',
        statusRestored: '已还原',
        labelShrink: '缩小',
        placeholderScript: '在此编写或修改 CCPL 反应推演脚本...',
        stepCardNum: '步骤',
        // 对话框与操作
        duplicateNameTitle: '反应名称重复',
        duplicateNameMsg: '机理库中已存在名为 "{name}" 的反应，请使用不同名称以避免混淆。',
        newReactionTitle: '新建化学反应机理',
        newReactionMsg: '请输入新反应机理的名称：',
        newReactionDefault: '新建化学反应',
        newReactionPlaceholder: '例如: 乙醇催化氧化机理',
        createReactionBtn: '创建机理',
        deleteReactionTitle: '删除当前反应机理',
        deleteReactionMsg: '确定要从机理推演库中永久删除反应机理【{name}】吗？此操作无法撤销。',
        deleteConfirmBtn: '删除机理',
        deleteAlertTitle: '无法删除机理',
        deleteAlertMsg: '反应库中至少需要保留 1 个推演机理，无法继续删除。',
        confirmBtn: '确定',
        cancelBtn: '取消',
        playTooltip: '自动推演 (快捷键: Space)',
        pauseTooltip: '暂停 (快捷键: Space)',
        zoomInTitle: '放大 (滚轮向上)',
        zoomOutTitle: '缩小 (滚轮向下)',
        resetCamTitle: '视角复位居中 (快捷键: R)',
        autoRotateTitle: '自动缓速自转',
        expandWorkspaceTitle: '展开推演工作区',
        collapseWorkspaceTitle: '收起推演工作区',
        prevStepTitle: '上一步 (快捷键: ← 或 A)',
        nextStepTitle: '下一步 (快捷键: → 或 D)',
        resetStepTitle: '回到起点',
        saveScriptTitle: '保存脚本 (快捷键: Ctrl + S)',
        fullscreenTitle: '全屏编写模式 (快捷键: F11 / Esc 退出)',
        exitFullscreenTitle: '缩小窗口 (快捷键: Esc / F11)',
        resetScriptTitle: '还原当前机理',
        runScriptTitle: '解析并立即运行推演',
        btnCompleteH: '补全 H',
        completeHTitle: '智能补全氢原子 (快捷键: Alt + H)',
        toastCompleteHSuccess: '已根据元素共价成键方式与电荷自动补全 {count} 个隐式氢原子及共价键！',
        toastCompleteHNone: '当前所有原子共价价态与电荷均已饱和，无需额外补全氢原子。'
      },
      en: {
        docsBtn: 'Docs',
        repoBtn: 'Repository',
        workspaceTitle: 'Workspace',
        tabSteps: 'Steps',
        tabScript: 'CCPL Script',
        libraryTitle: 'Mechanism Library',
        btnNew: '+ New',
        btnDelete: '🗑 Delete',
        stepsSequence: 'Step Sequence',
        stepsHint: 'Click to navigate',
        scriptTitle: 'CCPL Script',
        statusSynced: 'Synced',
        statusSaving: 'Saved',
        statusDirty: 'Unsaved',
        statusError: 'Error',
        statusRestored: 'Restored',
        labelShrink: 'Collapse',
        placeholderScript: 'Compose or edit CCPL deduction scripts here...',
        stepCardNum: 'Step',
        // Dialogs and operations
        duplicateNameTitle: 'Duplicate Reaction Name',
        duplicateNameMsg: 'A reaction named "{name}" already exists in the library. Please choose a unique name.',
        newReactionTitle: 'New Reaction Mechanism',
        newReactionMsg: 'Enter the name of the new reaction mechanism:',
        newReactionDefault: 'New Chemical Reaction',
        newReactionPlaceholder: 'e.g. Catalytic Oxidation of Ethanol',
        createReactionBtn: 'Create',
        deleteReactionTitle: 'Delete Current Mechanism',
        deleteReactionMsg: 'Are you sure you want to permanently delete [{name}] from the library? This cannot be undone.',
        deleteConfirmBtn: 'Delete',
        deleteAlertTitle: 'Cannot Delete',
        deleteAlertMsg: 'At least 1 reaction mechanism must be preserved in the library.',
        confirmBtn: 'OK',
        cancelBtn: 'Cancel',
        playTooltip: 'Auto Play (Key: Space)',
        pauseTooltip: 'Pause (Key: Space)',
        zoomInTitle: 'Zoom In (Scroll Up)',
        zoomOutTitle: 'Zoom Out (Scroll Down)',
        resetCamTitle: 'Reset Camera (Key: R)',
        autoRotateTitle: 'Auto Rotate',
        expandWorkspaceTitle: 'Expand Workspace',
        collapseWorkspaceTitle: 'Collapse Workspace',
        prevStepTitle: 'Previous Step (Key: ← or A)',
        nextStepTitle: 'Next Step (Key: → or D)',
        resetStepTitle: 'Reset to Start',
        saveScriptTitle: 'Save Script (Ctrl + S)',
        fullscreenTitle: 'Fullscreen Mode (F11 / Esc)',
        exitFullscreenTitle: 'Exit Fullscreen (Esc / F11)',
        resetScriptTitle: 'Revert to Current',
        runScriptTitle: 'Parse & Run Mechanism',
        btnCompleteH: 'Fill H',
        completeHTitle: 'Auto-complete Hydrogens (Key: Alt + H)',
        toastCompleteHSuccess: 'Successfully auto-completed {count} implicit hydrogen atoms and covalent bonds based on element valence and formal charge!',
        toastCompleteHNone: 'All atom covalent valences and formal charges are fully saturated; no additional hydrogens needed.'
      }
    };
  }

  t(key, params = {}) {
    const dict = this.i18n[this.lang] || this.i18n.zh;
    let str = dict[key] || this.i18n.zh[key] || key;
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    return str;
  }

  toggleLanguage() {
    this.lang = this.lang === 'zh' ? 'en' : 'zh';
    try {
      localStorage.setItem(this.langStorageKey, this.lang);
    } catch (e) {}
    this.applyLanguage();
  }

  applyLanguage() {
    const dict = this.i18n[this.lang] || this.i18n.zh;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    if (this.scriptEditor) {
      this.scriptEditor.placeholder = dict.placeholderScript;
    }

    if (this.btnZoomIn) this.btnZoomIn.title = dict.zoomInTitle;
    if (this.btnZoomOut) this.btnZoomOut.title = dict.zoomOutTitle;
    if (this.btnResetCam) this.btnResetCam.title = dict.resetCamTitle;
    if (this.btnToggleRotate) this.btnToggleRotate.title = dict.autoRotateTitle;
    if (this.btnExpandWorkspace) this.btnExpandWorkspace.title = dict.expandWorkspaceTitle;
    if (this.btnToggleWorkspace) this.btnToggleWorkspace.title = dict.collapseWorkspaceTitle;
    if (this.prevBtn) this.prevBtn.title = dict.prevStepTitle;
    if (this.nextBtn) this.nextBtn.title = dict.nextStepTitle;
    if (this.resetStepBtn) this.resetStepBtn.title = dict.resetStepTitle;
    if (this.btnSaveScript) this.btnSaveScript.title = dict.saveScriptTitle;
    if (this.btnResetScript) this.btnResetScript.title = dict.resetScriptTitle;
    if (this.btnCompleteHydrogens) this.btnCompleteHydrogens.title = dict.completeHTitle;
    if (this.btnRunScript) this.btnRunScript.title = dict.runScriptTitle;
    if (this.btnNewReaction) this.btnNewReaction.title = dict.btnNew;
    if (this.btnDeleteReaction) this.btnDeleteReaction.title = dict.btnDelete;

    if (this.headerLangBtn) {
      this.headerLangBtn.textContent = this.lang === 'zh' ? '中文' : 'English';
      this.headerLangBtn.title = this.lang === 'zh' ? '当前语言: 中文 (点击切换为 English)' : 'Current Language: English (Click to switch to 中文)';
    }

    const docsBtn = document.getElementById('header-docs-btn');
    if (docsBtn) {
      docsBtn.href = this.lang === 'en' ? 'docs_en.html' : 'docs.html';
      docsBtn.title = this.lang === 'en' ? 'View CCPL Syntax Manual' : '查看 CCPL 语法手册与编写规范';
      docsBtn.textContent = dict.docsBtn || (this.lang === 'en' ? 'Docs' : '语法手册');
    }
    const repoBtn = document.getElementById('header-repo-btn');
    if (repoBtn) {
      repoBtn.title = this.lang === 'zh' ? '前往 GitHub 源代码仓库' : 'Visit GitHub Repository';
      repoBtn.textContent = dict.repoBtn || (this.lang === 'en' ? 'Repository' : 'GitHub 仓库');
    }

    this.updatePlayButtonUI();
  }

  loadInitialPresets() {
    let presets = [];
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          presets = parsed;
        }
      }
    } catch (e) {
      console.warn('[Chemiation] 读取本地存储反应失败，使用内置预设', e);
    }
    if (!presets || presets.length === 0) {
      presets = typeof REACTION_PRESETS !== 'undefined' ? JSON.parse(JSON.stringify(REACTION_PRESETS)) : [];
    }

    // 确保所有反应步骤中的未定坐标原子均经过 3D 拓扑几何解算，并强制烯烃共平面
    if (typeof ReactionScriptEngine !== 'undefined') {
      presets.forEach(reaction => {
        if (reaction && Array.isArray(reaction.steps)) {
          reaction.steps.forEach(step => {
            if (ReactionScriptEngine.autoLayoutStep) ReactionScriptEngine.autoLayoutStep(step);
            if (ReactionScriptEngine.enforceAlkeneCoplanarity) ReactionScriptEngine.enforceAlkeneCoplanarity(step);
          });
        }
      });
    }

    return presets;
  }

  savePresetsToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.presets));
    } catch (e) {
      console.warn('[Chemiation] 保存反应列表至本地存储失败', e);
    }
  }

  initDOM() {
    this.canvas = document.getElementById('reaction-canvas');
    this.presetSelect = document.getElementById('preset-select');
    this.headerLangBtn = document.getElementById('header-lang-btn');

    // 反应机理库操作 DOM
    this.projectBar = document.getElementById('project-bar');
    this.projectNameLabel = document.getElementById('project-name-label');
    this.reactionCountBadge = document.getElementById('reaction-count-badge');
    this.btnNewReaction = document.getElementById('btn-new-reaction');
    this.btnDeleteReaction = document.getElementById('btn-delete-reaction');
    this.fileSaveStatus = document.getElementById('file-save-status');

    // 反应总体信息 (已移除 deltaH, category)
    this.reactionTitle = document.getElementById('reaction-title');
    this.reactionEquation = document.getElementById('reaction-equation');
    this.reactionDesc = document.getElementById('reaction-desc');

    // 右侧推演工作区整体与容器
    this.workspaceSidebar = document.getElementById('workspace-sidebar');
    this.workspaceContent = document.querySelector('.workspace-content');
    this.btnToggleWorkspace = document.getElementById('btn-toggle-workspace');
    this.btnExpandWorkspace = document.getElementById('btn-expand-workspace');
    this.resizeHandle = document.getElementById('resize-handle');

    // 选项卡
    this.tabBtnSteps = document.getElementById('tab-btn-steps');
    this.tabBtnScript = document.getElementById('tab-btn-script');
    this.tabPaneSteps = document.getElementById('tab-pane-steps');
    this.tabPaneScript = document.getElementById('tab-pane-script');

    // 机理步骤卡片列表
    this.stepsListContainer = document.getElementById('steps-list-container');
    this.stepCounterText = document.getElementById('step-counter-text');

    // 脚本编辑器相关 (IDE 风格高亮与行号)
    this.scriptEditor = document.getElementById('script-editor');
    this.ideGutter = document.getElementById('ide-gutter');
    this.ideGutterInner = document.getElementById('ide-gutter-inner');
    this.ideHighlight = document.getElementById('ide-highlight');
    this.ideCode = document.getElementById('ide-code');
    this.btnSaveScript = document.getElementById('btn-save-script');
    this.btnFullscreenScript = document.getElementById('btn-fullscreen-script');
    this.btnRunScript = document.getElementById('btn-run-script');
    this.btnResetScript = document.getElementById('btn-reset-script');
    this.btnCompleteHydrogens = document.getElementById('btn-complete-hydrogens');
    this.scriptErrorToast = document.getElementById('script-error-toast');

    // 底部时间轴与播放控制
    this.timelineTrack = document.getElementById('timeline-track');
    this.prevBtn = document.getElementById('prev-btn');
    this.playBtn = document.getElementById('play-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.resetStepBtn = document.getElementById('reset-step-btn');
    this.speedPills = document.querySelectorAll('.speed-pill');

    // 视口浮动控制小工具（拖动/旋转/平移/缩放）
    this.btnToolRotate = document.getElementById('btn-tool-rotate');
    this.btnToolPan = document.getElementById('btn-tool-pan');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnResetCam = document.getElementById('btn-reset-cam');
    this.btnToggleRotate = document.getElementById('btn-toggle-rotate');

    // 画布浮动状态胶囊
    this.canvasStepToast = document.getElementById('canvas-step-toast');

    // 初始化反应下拉列表
    this.populatePresetSelect();
  }

  populatePresetSelect() {
    if (!this.presetSelect) return;
    this.presetSelect.innerHTML = '';
    this.presets.forEach((preset, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      const formattedName = typeof ReactionScriptEngine !== 'undefined' ? ReactionScriptEngine.formatChemText(preset.name) : preset.name;
      option.textContent = `${idx + 1}. ${formattedName}`;
      this.presetSelect.appendChild(option);
    });
    this.presetSelect.value = this.currentReactionIndex;
    if (this.reactionCountBadge) {
      this.reactionCountBadge.textContent = String(this.presets.length);
    }
  }

  initRenderer() {
    this.renderer = new Pseudo3DRenderer(this.canvas, {
      bg: '#FAF6E9',
      maskBg: '#FAF6E9',
      autoRotate: false,
      toolMode: 'rotate'
    });
    this.renderer.start();

    // 监听容器大小改变，始终保持 1:1 无形变等比投影
    if (window.ResizeObserver && this.canvas && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.renderer.resize();
        this.renderer.render();
      });
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    // 连续推演模式：每步动画完成立即步进到下一步，消除多余等待间隔
    this.renderer.onTransitionEnd = () => {
      if (this.isPlaying) {
        const hasNext = this.nextStep();
        if (!hasNext) {
          this.pause();
        }
      }
    };
  }

  /**
   * 初始化右侧工作区可拖拽调节宽度 (参考 Anychem)
   */
  initResizable() {
    if (!this.resizeHandle || !this.workspaceSidebar) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 420;

    const onMouseDown = (e) => {
      // 竖屏与窄屏移动端禁用横向调节柄
      if (window.matchMedia('(orientation: portrait), (max-width: 820px)').matches) return;

      isResizing = true;
      startX = e.clientX;
      startWidth = this.workspaceSidebar.getBoundingClientRect().width;
      this.workspaceSidebar.style.transition = 'none';
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const dx = startX - e.clientX;
      const newWidth = Math.max(320, Math.min(760, startWidth + dx));
      this.workspaceSidebar.style.setProperty('--sidebar-width', `${newWidth}px`);
      this.workspaceSidebar.style.width = 'var(--sidebar-width)';
      this.renderer.resize();
      this.renderer.render();
    };

    const onMouseUp = () => {
      isResizing = false;
      this.workspaceSidebar.style.transition = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.renderer.resize();
      this.renderer.render();
    };

    this.resizeHandle.addEventListener('mousedown', onMouseDown);
  }

  bindEvents() {
    // 语言切换
    if (this.headerLangBtn) {
      this.headerLangBtn.addEventListener('click', () => {
        this.toggleLanguage();
      });
    }

    // 反应预设切换
    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => {
        this.loadReaction(parseInt(e.target.value, 10));
      });
    }

    // 反应机理库操作：新建反应与删除当前反应
    if (this.btnNewReaction) {
      this.btnNewReaction.addEventListener('click', () => this.handleNewReaction());
    }
    if (this.btnDeleteReaction) {
      this.btnDeleteReaction.addEventListener('click', () => this.handleDeleteReaction());
    }
    if (this.btnSaveScript) {
      this.btnSaveScript.addEventListener('click', () => this.saveCurrentScript());
    }
    if (this.btnFullscreenScript) {
      this.btnFullscreenScript.addEventListener('click', () => this.toggleFullscreenScript());
    }

    // 全局快捷键: Esc 退出脚本全屏，F11 切换脚本全屏，Alt + H 智能补全氢原子
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.tabPaneScript && this.tabPaneScript.classList.contains('fullscreen')) {
          this.toggleFullscreenScript(false);
        }
      } else if (e.key === 'F11' && this.activeTab === 'script') {
        e.preventDefault();
        this.toggleFullscreenScript();
      } else if (e.altKey && (e.key === 'h' || e.key === 'H') && this.activeTab === 'script') {
        e.preventDefault();
        this.handleCompleteHydrogens();
      }
    });

    // 选项卡切换 (机理步骤 vs 脚本编写)
    if (this.tabBtnSteps && this.tabBtnScript) {
      this.tabBtnSteps.addEventListener('click', () => this.switchTab('steps'));
      this.tabBtnScript.addEventListener('click', () => this.switchTab('script'));
    }

    // 工作区收起/展开
    if (this.btnToggleWorkspace) {
      this.btnToggleWorkspace.addEventListener('click', () => this.toggleWorkspace(false));
    }
    if (this.btnExpandWorkspace) {
      this.btnExpandWorkspace.addEventListener('click', () => this.toggleWorkspace(true));
    }

    // 脚本解析与运行
    if (this.btnRunScript) {
      this.btnRunScript.addEventListener('click', () => this.runCustomScript());
    }
    if (this.btnResetScript) {
      this.btnResetScript.addEventListener('click', () => this.resetScriptToCurrent());
    }
    if (this.btnCompleteHydrogens) {
      this.btnCompleteHydrogens.addEventListener('click', () => this.handleCompleteHydrogens());
    }

    // CCPL 脚本 IDE 编辑器交互（高亮、行号、Tab缩进与滚动同步）
    if (this.scriptEditor) {
      this.scriptEditor.addEventListener('input', () => {
        this.updateIDE();
        this.markScriptDirty(true);
      });

      this.scriptEditor.addEventListener('scroll', () => {
        if (this.ideHighlight) {
          this.ideHighlight.scrollTop = this.scriptEditor.scrollTop;
          this.ideHighlight.scrollLeft = this.scriptEditor.scrollLeft;
        }
        if (this.ideGutterInner) {
          this.ideGutterInner.style.transform = `translateY(-${this.scriptEditor.scrollTop}px)`;
        } else if (this.ideGutter) {
          this.ideGutter.scrollTop = this.scriptEditor.scrollTop;
        }
      });

      this.scriptEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = this.scriptEditor.selectionStart;
          const end = this.scriptEditor.selectionEnd;
          this.scriptEditor.value = this.scriptEditor.value.substring(0, start) + '  ' + this.scriptEditor.value.substring(end);
          this.scriptEditor.selectionStart = this.scriptEditor.selectionEnd = start + 2;
          this.updateIDE();
          this.markScriptDirty(true);
        }
      });
    }

    // 播放与步进
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        this.pause();
        this.prevStep();
        if (this.prevBtn) this.prevBtn.blur();
      });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.pause();
        this.nextStep();
        if (this.nextBtn) this.nextBtn.blur();
      });
    }
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => {
        this.togglePlay();
        if (this.playBtn) this.playBtn.blur();
      });
    }
    if (this.resetStepBtn) {
      this.resetStepBtn.addEventListener('click', () => {
        this.pause();
        this.goToStep(0, true);
      });
    }

    // 播放速率选择
    if (this.speedPills) {
      this.speedPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const speed = parseFloat(pill.dataset.speed || '1');
          this.setPlaybackSpeed(speed);
        });
      });
    }

    // 视口交互模式切换（旋转 vs 平移）
    if (this.btnToolRotate) {
      this.btnToolRotate.addEventListener('click', () => {
        this.renderer.setToolMode('rotate');
        this.btnToolRotate.classList.add('active');
        if (this.btnToolPan) this.btnToolPan.classList.remove('active');
      });
    }
    if (this.btnToolPan) {
      this.btnToolPan.addEventListener('click', () => {
        this.renderer.setToolMode('pan');
        this.btnToolPan.classList.add('active');
        if (this.btnToolRotate) this.btnToolRotate.classList.remove('active');
      });
    }

    // 缩放与相机按钮
    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', () => this.renderer.zoomIn());
    }
    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', () => this.renderer.zoomOut());
    }
    if (this.btnResetCam) {
      this.btnResetCam.addEventListener('click', () => this.renderer.resetCamera());
    }
    if (this.btnToggleRotate) {
      this.btnToggleRotate.addEventListener('click', () => {
        this.renderer.autoRotate = !this.renderer.autoRotate;
        this.btnToggleRotate.classList.toggle('active', this.renderer.autoRotate);
      });
    }

    // 全局快捷键
    window.addEventListener('keydown', (e) => {
      // 支持 Ctrl + S (或 Cmd + S) 保存脚本到本地文件
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.saveCurrentScript();
        return;
      }

      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        this.pause();
        this.prevStep();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        this.pause();
        this.nextStep();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.renderer.resetCamera();
      }
    });
  }

  switchTab(tabName) {
    if (tabName === 'steps' && this.isScriptDirty && this.scriptEditor) {
      try {
        const text = this.scriptEditor.value;
        const parsedReaction = ReactionScriptEngine.parse(text);
        this.hideScriptError();

        this.presets[this.currentReactionIndex] = parsedReaction;
        this.savePresetsToStorage();

        if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
        if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
        if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

        if (this.presetSelect && this.presetSelect.options[this.currentReactionIndex]) {
          this.presetSelect.options[this.currentReactionIndex].textContent = `${this.currentReactionIndex + 1}. ${parsedReaction.name}`;
        }

        this.buildStepsList(parsedReaction.steps);
        this.buildTimelineTrack(parsedReaction.steps);
        this.markScriptDirty(false, '已同步');
      } catch (err) {
        // 脚本存在语法错误：严格拦截！不更新且不渲染推演内容，提示报错并保留在编辑区
        this.showScriptError(err.message);
        this.markScriptDirty(true, '语法错误');
        return;
      }
    }

    if (tabName !== 'script' && this.tabPaneScript && this.tabPaneScript.classList.contains('fullscreen')) {
      this.toggleFullscreenScript(false);
    }

    this.activeTab = tabName;
    if (this.tabBtnSteps) this.tabBtnSteps.classList.toggle('active', tabName === 'steps');
    if (this.tabBtnScript) this.tabBtnScript.classList.toggle('active', tabName === 'script');
    if (this.tabPaneSteps) this.tabPaneSteps.style.display = tabName === 'steps' ? 'flex' : 'none';
    if (this.tabPaneScript) this.tabPaneScript.style.display = tabName === 'script' ? 'flex' : 'none';

    if (this.workspaceContent) {
      this.workspaceContent.style.overflowY = tabName === 'script' ? 'hidden' : 'auto';
      if (tabName === 'script') {
        this.workspaceContent.scrollTop = 0;
      }
    }

    if (tabName === 'script') {
      if (this.scriptEditor && !this.scriptEditor.value.trim()) {
        this.resetScriptToCurrent();
      } else {
        this.updateIDE();
      }
    }
  }

  /**
   * 切换 CCPL 脚本编辑器全屏编写模式
   */
  toggleFullscreenScript(forceState) {
    if (!this.tabPaneScript) return;
    const isCurrentlyFullscreen = this.tabPaneScript.classList.contains('fullscreen');
    const targetState = typeof forceState === 'boolean' ? forceState : !isCurrentlyFullscreen;

    if (targetState) {
      this.tabPaneScript.classList.add('fullscreen');
      if (this.btnFullscreenScript) {
        this.btnFullscreenScript.classList.add('active');
        this.btnFullscreenScript.title = '缩小窗口 (快捷键: Esc / F11)';
      }
    } else {
      this.tabPaneScript.classList.remove('fullscreen');
      if (this.btnFullscreenScript) {
        this.btnFullscreenScript.classList.remove('active');
        this.btnFullscreenScript.title = '全屏编写模式 (快捷键: F11 / Esc 退出)';
      }
      if (this.workspaceSidebar) {
        this.workspaceSidebar.classList.remove('collapsed');
        if (this.btnExpandWorkspace) {
          this.btnExpandWorkspace.classList.remove('visible');
        }
      }
    }

    if (this.renderer && typeof this.renderer.resize === 'function') {
      this.renderer.resize();
      this.renderer.render();
    }

    this.updateIDE();
    if (this.scriptEditor) {
      this.scriptEditor.focus();
    }
  }

  toggleWorkspace(open) {
    if (!this.workspaceSidebar) return;
    const mainWorkspace = document.querySelector('.main-workspace');
    if (open) {
      this.workspaceSidebar.classList.remove('collapsed');
      if (mainWorkspace) mainWorkspace.classList.remove('sidebar-collapsed');
      if (this.btnExpandWorkspace) this.btnExpandWorkspace.classList.remove('visible');
    } else {
      this.workspaceSidebar.classList.add('collapsed');
      if (mainWorkspace) mainWorkspace.classList.add('sidebar-collapsed');
      if (this.btnExpandWorkspace) this.btnExpandWorkspace.classList.add('visible');
    }
    setTimeout(() => {
      if (this.renderer && typeof this.renderer.resize === 'function') {
        this.renderer.resize();
        this.renderer.render();
      }
    }, 360);
  }

  loadReaction(reactionIndex) {
    if (!this.presets[reactionIndex]) return;

    this.pause();
    this.currentReactionIndex = reactionIndex;
    const reaction = this.presets[reactionIndex];

    if (typeof ReactionScriptEngine !== 'undefined') {
      if (reaction && Array.isArray(reaction.steps)) {
        reaction.steps.forEach(step => {
          if (ReactionScriptEngine.autoLayoutStep) ReactionScriptEngine.autoLayoutStep(step);
          if (ReactionScriptEngine.enforceAlkeneCoplanarity) ReactionScriptEngine.enforceAlkeneCoplanarity(step);
        });
      }
    }

    const format = typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.formatChemText
      ? ReactionScriptEngine.formatChemText
      : (s => s);

    if (this.reactionTitle) this.reactionTitle.textContent = format(reaction.name);
    if (this.reactionEquation) this.reactionEquation.textContent = format(reaction.equation || '');
    if (this.reactionDesc) this.reactionDesc.textContent = format(reaction.summary || '');

    if (this.presetSelect) {
      this.presetSelect.value = reactionIndex;
    }

    // 重构步骤卡片序列
    this.buildStepsList(reaction.steps);

    // 重建时间轴进度条
    this.buildTimelineTrack(reaction.steps);

    // 同步到脚本编辑器
    if (this.scriptEditor) {
      this.scriptEditor.value = ReactionScriptEngine.serialize(reaction);
      this.updateIDE();
    }
    this.hideScriptError();

    this.renderer.resetCamera();
    this.goToStep(0, false);
  }

  buildStepsList(steps) {
    if (!this.stepsListContainer) return;
    this.stepsListContainer.innerHTML = '';

    const format = typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.formatChemText
      ? ReactionScriptEngine.formatChemText
      : (s => s);

    steps.forEach((step, idx) => {
      const card = document.createElement('div');
      card.className = `step-item-card ${idx === 0 ? 'active' : ''}`;
      card.dataset.stepIndex = idx;

      const cleanTitle = format(step.name.replace(/^\d+\.\s*/, ''));
      const cleanNote = format(step.note || '');
      card.innerHTML = `
        <div class="step-card-top">
          <div class="step-card-num">${idx + 1}</div>
          <div class="step-card-title">${cleanTitle}</div>
        </div>
        <div class="step-card-note">${cleanNote}</div>
      `;

      card.addEventListener('click', () => {
        this.pause();
        this.goToStep(idx, true);
      });

      this.stepsListContainer.appendChild(card);
    });
  }

  buildTimelineTrack(steps) {
    if (!this.timelineTrack) return;
    this.timelineTrack.innerHTML = '';

    const format = typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.formatChemText
      ? ReactionScriptEngine.formatChemText
      : (s => s);

    steps.forEach((step, idx) => {
      const pill = document.createElement('div');
      pill.className = `step-pill ${idx === 0 ? 'active' : ''}`;
      pill.title = `第 ${idx + 1} 步: ${format(step.name)}`;
      pill.addEventListener('click', () => {
        this.pause();
        this.goToStep(idx, true);
      });
      this.timelineTrack.appendChild(pill);
    });
  }

  goToStep(stepIndex, animate = true) {
    const reaction = this.presets[this.currentReactionIndex];
    if (!reaction || !reaction.steps[stepIndex]) return;

    this.currentStepIndex = stepIndex;
    const step = reaction.steps[stepIndex];
    const totalSteps = reaction.steps.length;

    // 渲染器更新
    this.renderer.setStep(step, animate);

    // 更新右侧计数
    if (this.stepCounterText) {
      this.stepCounterText.textContent = `${stepIndex + 1} / ${totalSteps}`;
    }

    // 画布浮动状态吐司
    if (this.canvasStepToast) {
      const format = typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.formatChemText
        ? ReactionScriptEngine.formatChemText
        : (s => s);
      const cleanTitle = format(step.name.replace(/^\d+\.\s*/, ''));
      this.canvasStepToast.innerHTML = `
        <span class="toast-num">${stepIndex + 1}/${totalSteps}</span>
        <span class="toast-title">${cleanTitle}</span>
      `;
    }

    // 滚动并高亮当前步骤卡片
    if (this.stepsListContainer) {
      const cards = this.stepsListContainer.querySelectorAll('.step-item-card');
      let activeCard = null;
      cards.forEach((c, idx) => {
        c.classList.remove('active', 'completed');
        if (idx === stepIndex) {
          c.classList.add('active');
          activeCard = c;
        } else if (idx < stepIndex) {
          c.classList.add('completed');
        }
      });

      // 仅在步骤选项卡当前处于激活状态时，平滑在内部容器内微调滚动，严禁触发外层视口或窗口的累积位移 (Zero CLS)
      if (activeCard && this.activeTab === 'steps' && this.workspaceContent) {
        const container = this.workspaceContent;
        const cardRect = activeCard.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        const offsetTop = cardRect.top - contRect.top;
        const offsetBottom = cardRect.bottom - contRect.bottom;
        const pad = 10;
        if (offsetTop < pad) {
          container.scrollTo({
            top: container.scrollTop + offsetTop - pad,
            behavior: 'smooth'
          });
        } else if (offsetBottom > -pad) {
          container.scrollTo({
            top: container.scrollTop + offsetBottom + pad,
            behavior: 'smooth'
          });
        }
      }
    }

    // 更新时间轴胶囊
    if (this.timelineTrack) {
      const pills = this.timelineTrack.querySelectorAll('.step-pill');
      pills.forEach((p, idx) => {
        p.classList.remove('active', 'completed');
        if (idx === stepIndex) {
          p.classList.add('active');
        } else if (idx < stepIndex) {
          p.classList.add('completed');
        }
      });
    }

    // 控制按钮状态
    if (this.prevBtn) {
      this.prevBtn.style.opacity = stepIndex === 0 ? '0.4' : '1';
      this.prevBtn.style.pointerEvents = stepIndex === 0 ? 'none' : 'auto';
    }
    if (this.nextBtn) {
      this.nextBtn.style.opacity = stepIndex === totalSteps - 1 ? '0.4' : '1';
      this.nextBtn.style.pointerEvents = stepIndex === totalSteps - 1 ? 'none' : 'auto';
    }
  }

  prevStep() {
    if (this.currentStepIndex > 0) {
      this.goToStep(this.currentStepIndex - 1, true);
    }
  }

  nextStep() {
    const reaction = this.presets[this.currentReactionIndex];
    if (this.currentStepIndex < reaction.steps.length - 1) {
      this.goToStep(this.currentStepIndex + 1, true);
      return true;
    }
    return false;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    const reaction = this.presets[this.currentReactionIndex];
    if (!reaction || !reaction.steps || reaction.steps.length <= 1) return;

    this.isPlaying = true;
    this.updatePlayButtonUI();

    // 若当前已在最后一步，则先跳到起点第 0 步
    if (this.currentStepIndex >= reaction.steps.length - 1) {
      this.goToStep(0, false);
    }
    // 连续推演模式：立即步进到下一步并执行动画，动画结束时通过 onTransitionEnd 自动无缝触发下一步
    const hasNext = this.nextStep();
    if (!hasNext) {
      this.pause();
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    this.updatePlayButtonUI();
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    if (this.renderer) {
      this.renderer.transitionDuration = Math.round(920 / speed);
    }
    if (this.speedPills) {
      this.speedPills.forEach(pill => {
        const pSpeed = parseFloat(pill.dataset.speed || '1');
        pill.classList.toggle('active', pSpeed === speed);
      });
    }
  }

  updatePlayButtonUI() {
    if (!this.playBtn) return;
    if (this.isPlaying) {
      this.playBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      `;
      this.playBtn.title = '暂停 (快捷键: Space)';
      this.playBtn.classList.add('primary');
    } else {
      this.playBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
      this.playBtn.title = '自动推演 (快捷键: Space)';
      this.playBtn.classList.remove('primary');
    }
  }

  /**
   * 运行自定义编写的推演脚本并实时保存
   */
  runCustomScript() {
    if (!this.scriptEditor) return;
    const text = this.scriptEditor.value;

    try {
      const parsedReaction = ReactionScriptEngine.parse(text);

      // 检查机理名称是否与库中其他反应重名
      const isDuplicate = this.presets.some((p, idx) => idx !== this.currentReactionIndex && p.name.trim() === parsedReaction.name.trim());
      if (isDuplicate) {
        this.showAlertDialog({
          title: this.t('duplicateNameTitle'),
          message: this.t('duplicateNameMsg', { name: parsedReaction.name })
        });
        this.showScriptError(this.t('duplicateNameMsg', { name: parsedReaction.name }));
        this.markScriptDirty(true, this.t('statusError'));
        return;
      }

      this.hideScriptError();

      this.presets[this.currentReactionIndex] = parsedReaction;
      this.savePresetsToStorage();

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
      if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

      if (this.presetSelect && this.presetSelect.options[this.currentReactionIndex]) {
        this.presetSelect.options[this.currentReactionIndex].textContent = `${this.currentReactionIndex + 1}. ${parsedReaction.name}`;
      }

      this.buildStepsList(parsedReaction.steps);
      this.buildTimelineTrack(parsedReaction.steps);
      this.renderer.resetCamera();
      this.goToStep(0, false);
      this.markScriptDirty(false, this.t('statusSynced'));

      // 切回步骤机理页面查看推演效果
      this.switchTab('steps');
    } catch (err) {
      this.showScriptError(err.message);
      this.markScriptDirty(true, this.t('statusError'));
    }
  }

  /**
   * 保存当前编辑的推演脚本 (Ctrl + S 或点击保存图标)
   */
  saveCurrentScript() {
    if (!this.scriptEditor) return;
    const text = this.scriptEditor.value;

    try {
      const parsedReaction = ReactionScriptEngine.parse(text);

      // 检查机理名称是否与库中其他反应重名
      const isDuplicate = this.presets.some((p, idx) => idx !== this.currentReactionIndex && p.name.trim() === parsedReaction.name.trim());
      if (isDuplicate) {
        this.showAlertDialog({
          title: this.t('duplicateNameTitle'),
          message: this.t('duplicateNameMsg', { name: parsedReaction.name })
        });
        this.showScriptError(this.t('duplicateNameMsg', { name: parsedReaction.name }));
        this.markScriptDirty(true, this.t('statusError'));
        return;
      }

      this.presets[this.currentReactionIndex] = parsedReaction;
      this.savePresetsToStorage();

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
      if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

      if (this.presetSelect && this.presetSelect.options[this.currentReactionIndex]) {
        this.presetSelect.options[this.currentReactionIndex].textContent = `${this.currentReactionIndex + 1}. ${parsedReaction.name}`;
      }

      this.buildStepsList(parsedReaction.steps);
      this.buildTimelineTrack(parsedReaction.steps);
      this.goToStep(this.currentStepIndex || 0, false);
      this.hideScriptError();
      this.markScriptDirty(false, this.t('statusSaving'));
    } catch (err) {
      this.showScriptError(err.message);
      this.markScriptDirty(true, this.t('statusError'));
    }
  }

  /**
   * 还原为当前机理的已保存状态
   */
  resetScriptToCurrent() {
    const reaction = this.presets[this.currentReactionIndex];
    if (reaction && this.scriptEditor) {
      this.scriptEditor.value = ReactionScriptEngine.serialize(reaction);
      this.updateIDE();
      this.hideScriptError();
      this.markScriptDirty(false, '已还原');
    }
  }

  /**
   * 自动缩略氢原子补全：依据元素共价成键方式、形式电荷与自由基自动展开补全
   */
  handleCompleteHydrogens() {
    if (!this.scriptEditor) return;
    const text = this.scriptEditor.value;
    try {
      const res = ReactionScriptEngine.expandImplicitHydrogensInScript(text);
      if (res.count > 0) {
        this.scriptEditor.value = res.script;
        this.updateIDE();
        this.markScriptDirty(true);
        this.showAlertDialog({
          title: this.lang === 'en' ? 'Auto-completion' : '智能补全',
          message: this.t('toastCompleteHSuccess', { count: res.count })
        });
      } else {
        this.showAlertDialog({
          title: this.lang === 'en' ? 'Auto-completion' : '智能补全',
          message: this.t('toastCompleteHNone')
        });
      }
    } catch (err) {
      this.showScriptError(err.message);
    }
  }

  /**
   * 自研模态对话框底层触发器 (完全替代原生 prompt / confirm / alert)
   */
  showModalDialog({ title = '提示', message = '', type = 'alert', defaultValue = '', placeholder = '', confirmText = '确定', cancelText = '取消', danger = false }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('chem-dialog-overlay');
      const titleEl = document.getElementById('chem-dialog-title');
      const msgEl = document.getElementById('chem-dialog-message');
      const inputWrap = document.getElementById('chem-dialog-input-wrap');
      const inputEl = document.getElementById('chem-dialog-input');
      const cancelBtn = document.getElementById('chem-dialog-cancel-btn');
      const confirmBtn = document.getElementById('chem-dialog-confirm-btn');
      const closeBtn = document.getElementById('chem-dialog-close-btn');

      if (!overlay) {
        if (type === 'prompt') resolve(prompt(message, defaultValue));
        else if (type === 'confirm') resolve(confirm(message));
        else { alert(message); resolve(); }
        return;
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;

      if (type === 'prompt') {
        if (inputWrap) inputWrap.style.display = 'block';
        if (inputEl) {
          inputEl.value = defaultValue || '';
          inputEl.placeholder = placeholder || '';
        }
      } else {
        if (inputWrap) inputWrap.style.display = 'none';
      }

      if (cancelBtn) {
        cancelBtn.style.display = type === 'alert' ? 'none' : 'inline-block';
        cancelBtn.textContent = cancelText;
      }

      if (confirmBtn) {
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `chem-dialog-btn ${danger ? 'danger' : 'primary'}`;
      }

      overlay.style.display = 'flex';

      const cleanup = () => {
        overlay.style.display = 'none';
        window.removeEventListener('keydown', onKeyDown);
      };

      const onConfirm = () => {
        const val = type === 'prompt' ? (inputEl ? inputEl.value : '') : true;
        cleanup();
        resolve(val);
      };

      const onCancel = () => {
        cleanup();
        resolve(type === 'prompt' ? null : false);
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          onConfirm();
        }
      };

      if (confirmBtn) confirmBtn.onclick = onConfirm;
      if (cancelBtn) cancelBtn.onclick = onCancel;
      if (closeBtn) closeBtn.onclick = onCancel;
      overlay.onclick = (e) => {
        if (e.target === overlay) onCancel();
      };

      window.addEventListener('keydown', onKeyDown);

      if (type === 'prompt' && inputEl) {
        setTimeout(() => {
          inputEl.focus();
          inputEl.select();
        }, 30);
      } else if (confirmBtn) {
        setTimeout(() => {
          confirmBtn.focus();
        }, 30);
      }
    });
  }

  showPromptDialog(opts) {
    return this.showModalDialog({ ...opts, type: 'prompt' });
  }

  showConfirmDialog(opts) {
    return this.showModalDialog({ ...opts, type: 'confirm' });
  }

  showAlertDialog(opts) {
    return this.showModalDialog({ ...opts, type: 'alert' });
  }

  /**
   * 新建反应机理 (使用自研优雅工坊模态对话框)
   */
  async handleNewReaction() {
    const name = await this.showPromptDialog({
      title: this.t('newReactionTitle'),
      message: this.t('newReactionMsg'),
      defaultValue: this.t('newReactionDefault'),
      placeholder: this.t('newReactionPlaceholder'),
      confirmText: this.t('createReactionBtn'),
      cancelText: this.t('cancelBtn')
    });
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();
    // 查重：避免与库中已有反应重名
    const isDuplicate = this.presets.some(p => p.name.trim() === trimmedName);
    if (isDuplicate) {
      await this.showAlertDialog({
        title: this.t('duplicateNameTitle'),
        message: this.t('duplicateNameMsg', { name: trimmedName }),
        confirmText: this.t('confirmBtn')
      });
      return;
    }

    const templateText = ReactionScriptEngine.getQuickTemplate('reaction_blank').replace('reaction "新建化学反应"', `reaction "${trimmedName}"`);
    let newReaction;
    try {
      newReaction = ReactionScriptEngine.parse(templateText);
    } catch (e) {
      newReaction = {
        id: 'reaction-' + Date.now(),
        name: trimmedName,
        equation: 'A + B ⇌ C + D',
        summary: '新建化学反应机理推演',
        steps: [
          {
            name: '1. 反应物碰撞吸附',
            note: '底物分子靠近并形成瞬态接触。',
            atoms: [
              { id: 'A1', element: 'C', x: -1.5, y: 0, z: 0 },
              { id: 'A2', element: 'O', x: 1.5, y: 0, z: 0 }
            ],
            bonds: []
          }
        ]
      };
    }

    this.presets.push(newReaction);
    this.savePresetsToStorage();
    this.currentReactionIndex = this.presets.length - 1;
    this.populatePresetSelect();
    this.loadReaction(this.currentReactionIndex);
    this.switchTab('script');
  }

  /**
   * 删除当前选中的反应机理 (使用自研优雅工坊模态对话框)
   */
  async handleDeleteReaction() {
    if (this.presets.length <= 1) {
      await this.showAlertDialog({
        title: this.t('deleteAlertTitle'),
        message: this.t('deleteAlertMsg'),
        confirmText: this.t('confirmBtn')
      });
      return;
    }

    const currentReaction = this.presets[this.currentReactionIndex];
    const ok = await this.showConfirmDialog({
      title: this.t('deleteReactionTitle'),
      message: this.t('deleteReactionMsg', { name: currentReaction.name }),
      confirmText: this.t('deleteConfirmBtn'),
      cancelText: this.t('cancelBtn'),
      danger: true
    });
    if (!ok) return;

    this.presets.splice(this.currentReactionIndex, 1);
    this.savePresetsToStorage();

    this.currentReactionIndex = Math.max(0, this.currentReactionIndex - 1);
    this.populatePresetSelect();
    this.loadReaction(this.currentReactionIndex);
  }

  /**
   * 标记脚本脏状态
   */
  markScriptDirty(dirty, statusText) {
    this.isScriptDirty = dirty;
    if (this.fileSaveStatus) {
      if (dirty) {
        this.fileSaveStatus.textContent = '未保存 *';
        this.fileSaveStatus.classList.remove('saved');
        this.fileSaveStatus.classList.add('dirty');
      } else {
        this.fileSaveStatus.textContent = statusText || '已同步';
        this.fileSaveStatus.classList.remove('dirty');
        this.fileSaveStatus.classList.add('saved');
      }
    }
  }

  /**
   * 刷新 CCPL IDE 编辑器：同步语法高亮与行号列
   */
  updateIDE() {
    if (!this.scriptEditor) return;
    const code = this.scriptEditor.value;

    if (this.ideCode) {
      this.ideCode.innerHTML = this.highlightCCPL(code);
    }

    const gutterTarget = this.ideGutterInner || this.ideGutter;
    if (gutterTarget) {
      const lineCount = (code.split('\n').length) || 1;
      let errLine = null;
      if (this.scriptErrorToast && this.scriptErrorToast.style.display === 'block') {
        const lineMatch = this.scriptErrorToast.textContent.match(/第\s*(\d+)\s*行/);
        if (lineMatch) errLine = parseInt(lineMatch[1], 10);
      }
      let gutterHtml = '';
      for (let i = 1; i <= lineCount; i++) {
        const isErr = i === errLine ? ' class="gutter-error"' : '';
        gutterHtml += `<div${isErr}>${i}</div>`;
      }
      gutterTarget.innerHTML = gutterHtml;
    }

    if (this.ideHighlight) {
      this.ideHighlight.scrollTop = this.scriptEditor.scrollTop;
      this.ideHighlight.scrollLeft = this.scriptEditor.scrollLeft;
    }
    if (this.ideGutterInner) {
      this.ideGutterInner.style.transform = `translateY(-${this.scriptEditor.scrollTop}px)`;
    } else if (this.ideGutter) {
      this.ideGutter.scrollTop = this.scriptEditor.scrollTop;
    }
  }

  /**
   * CCPL 脚本语法高亮解析器（单趟精准词法正则高亮）
   */
  highlightCCPL(text) {
    if (!text) return '';

    const tokenRegex = /(#.*$)|("(?:[^"\\]|\\.)*")|\b(reaction|step|atom|bond|polymer|aromatic|pi|order|tag|leftBond|rightBond|include|includeIds|exclude|excludeIds|vector|note|equation|summary|radical|charge)\b|\b(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Fe|Cu|Zn|Br|I|Pt|Pd|Au)\b|(?<!\w)(-?\d+(?:\.\d+)?)(?!\w)|([{}[\]])/gm;

    let result = '';
    let lastIndex = 0;
    let match;

    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result += escape(text.slice(lastIndex, match.index));
      }
      const [full, comment, str, kw, elem, num, punct] = match;
      if (comment) {
        result += `<span class="tok-comment">${escape(comment)}</span>`;
      } else if (str) {
        result += `<span class="tok-string">${escape(str)}</span>`;
      } else if (kw) {
        result += `<span class="tok-keyword">${kw}</span>`;
      } else if (elem) {
        result += `<span class="tok-element">${elem}</span>`;
      } else if (num) {
        result += `<span class="tok-number">${num}</span>`;
      } else if (punct) {
        result += `<span class="tok-punct">${punct}</span>`;
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      result += escape(text.slice(lastIndex));
    }

    if (text.endsWith('\n')) {
      result += '<br> ';
    }

    return result;
  }

  showScriptError(msg) {
    if (!this.scriptErrorToast) return;
    const cleanMsg = msg.replace(/^语法错误:\s*/, '');
    this.scriptErrorToast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 13px; line-height: 1.2;">⚠️</span>
        <div style="flex: 1; word-break: break-word;">
          <div style="font-weight: 700; margin-bottom: 2px; color: #B84A28;">语法校验拦截 · 无法更新推演</div>
          <div style="opacity: 0.95;">${this.escapeHtml(cleanMsg)}</div>
        </div>
      </div>
    `;
    this.scriptErrorToast.style.display = 'block';

    const lineMatch = msg.match(/第\s*(\d+)\s*行/);
    const gutterTarget = this.ideGutterInner || this.ideGutter;
    if (lineMatch && gutterTarget) {
      const errLine = parseInt(lineMatch[1], 10);
      const gutterLines = gutterTarget.querySelectorAll('div');
      gutterLines.forEach((div, idx) => {
        if (idx + 1 === errLine) {
          div.classList.add('gutter-error');
        } else {
          div.classList.remove('gutter-error');
        }
      });
    }
  }

  hideScriptError() {
    if (this.scriptErrorToast) {
      this.scriptErrorToast.style.display = 'none';
      this.scriptErrorToast.innerHTML = '';
    }
    if (this.ideGutter) {
      const gutterLines = this.ideGutter.querySelectorAll('.gutter-error');
      gutterLines.forEach(div => div.classList.remove('gutter-error'));
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ReactionApp();
});
