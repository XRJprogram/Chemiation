/**
 * Chemiation - Reaction Deduction Application Controller
 * 参考 Anychem 架构设计的反应推演工作区与脚本编辑器
 */

class ReactionApp {
  constructor() {
    this.storageKey = 'chemiation_reactions_v12';
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
        btnDelete: '删除',
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
        exportVideoBtn: '导出视频',
        exportVideoTitle: '导出完整推演视频',
        exportVideoModalTitle: '导出完整推演视频',
        videoReactionName: '反应名称',
        videoStepsCount: '包含步骤',
        videoDuration: '预计时长',
        videoPlaySpeed: '推演播放速率',
        videoOverlayToggle: '在视频画面中包含反应式与步骤说明标签',
        startExportBtn: '开始录制并导出',
        recordingProgress: '正在录制推演视频... 步骤 {current} / {total}',
        toastRecordingSuccess: '推演视频导出成功！已自动触发下载保存。',
        toastRecordingCancelled: '已取消推演视频导出。',
        toastRecordingNotSupported: '当前浏览器或运行环境不支持 Canvas 视频录制功能 (需支持 MediaRecorder 与 canvas.captureStream)。',
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
        toastCompleteHNone: '当前所有原子共价价态与电荷均已饱和，无需额外补全氢原子。',
        btnAiAssistant: 'AI 辅助',
        aiAssistantTitle: 'AI 辅助推演与机理生成 (快捷键: Alt + A)',
        aiModalTitle: 'AI 机理推演脚本生成器',
        aiBtn: 'AI 助手',
        btnSaveCloud: '存到云端',
        saveCloudTitle: '保存至云端仓库',
        cloudRepoBtn: '机理仓库',
        authBtn: '登录 / 注册',
        authModalTitle: '用户中心 · 登录与注册'
      },
      en: {
        docsBtn: 'Docs',
        repoBtn: 'Repository',
        workspaceTitle: 'Workspace',
        tabSteps: 'Steps',
        tabScript: 'CCPL Script',
        libraryTitle: 'Mechanism Library',
        btnNew: '+ New',
        btnDelete: 'Delete',
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
        exportVideoBtn: 'Export Video',
        exportVideoTitle: 'Export Full Deduction Video',
        exportVideoModalTitle: 'Export Full Deduction Video',
        videoReactionName: 'Reaction Name',
        videoStepsCount: 'Included Steps',
        videoDuration: 'Estimated Duration',
        videoPlaySpeed: 'Playback Speed',
        videoOverlayToggle: 'Include reaction equation & step labels in video',
        startExportBtn: 'Start Recording & Export',
        recordingProgress: 'Recording deduction video... Step {current} / {total}',
        toastRecordingSuccess: 'Deduction video exported successfully! Download initiated.',
        toastRecordingCancelled: 'Deduction video export cancelled.',
        toastRecordingNotSupported: 'Current browser environment does not support canvas video recording.',
        btnAiAssistant: 'AI Copilot',
        aiAssistantTitle: 'AI Mechanism Copilot & Generator (Alt + A)',
        aiModalTitle: 'AI Mechanism Deduction Script Generator',
        aiBtn: 'AI Copilot',
        btnSaveCloud: 'Save Cloud',
        saveCloudTitle: 'Save to Cloud Repository',
        cloudRepoBtn: 'Cloud Repos',
        authBtn: 'Sign In / Register',
        authModalTitle: 'User Center · Sign In & Register',
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
        toastCompleteHNone: 'All atom covalent valences and formal charges are fully saturated; no additional hydrogens needed.',
        btnAiAssistant: 'AI Assistant',
        aiAssistantTitle: 'AI Mechanism Deduction & Script Generator (Alt + A)',
        aiModalTitle: 'AI Mechanism Deduction & Script Generator',
        aiBtn: 'AI Copilot'
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
    if (this.btnAiAssistant) this.btnAiAssistant.title = dict.aiAssistantTitle;
    if (this.headerAiBtn) this.headerAiBtn.title = dict.aiAssistantTitle;
    if (this.btnRunScript) this.btnRunScript.title = dict.runScriptTitle;
    if (this.btnNewReaction) this.btnNewReaction.title = dict.btnNew;
    if (this.btnDeleteReaction) this.btnDeleteReaction.title = dict.btnDelete;
    if (this.btnExportVideo) this.btnExportVideo.title = dict.exportVideoTitle;
    if (this.btnExportVideoFloat) this.btnExportVideoFloat.title = dict.exportVideoTitle;

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
    if (this.btnSaveCloud) {
      this.btnSaveCloud.title = dict.saveCloudTitle || '保存至云端仓库';
    }
    if (this.headerRepoCloudBtn) {
      this.headerRepoCloudBtn.title = this.lang === 'zh' ? '浏览云端机理模型与社区作品' : 'Browse Cloud Mechanism Repositories';
    }
    if (window.authCtrl && typeof window.authCtrl.updateHeaderBadge === 'function') {
      window.authCtrl.updateHeaderBadge();
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
    this.tabBtnChat = document.getElementById('tab-btn-chat');
    this.tabPaneChat = document.getElementById('tab-pane-chat');
    this.tabBtnChat?.addEventListener('click', () => this.switchTab('chat'));

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
    this.btnAiAssistant = document.getElementById('btn-ai-assistant');
    this.headerAiBtn = document.getElementById('header-ai-btn');
    this.btnSaveCloud = document.getElementById('btn-save-cloud');
    this.headerRepoCloudBtn = document.getElementById('header-repo-cloud-btn');
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

    // 视频导出控制 DOM
    this.btnExportVideo = document.getElementById('btn-export-video');
    this.btnExportVideoFloat = document.getElementById('btn-export-video-float');
    this.videoExportModal = document.getElementById('video-export-modal');
    this.canvasRecordingIndicator = document.getElementById('canvas-recording-indicator');
    this.recordingText = document.getElementById('recording-text');
    this.btnCancelRecording = document.getElementById('btn-cancel-recording');
    this.videoExportReactionName = document.getElementById('video-export-reaction-name');
    this.videoExportStepsCount = document.getElementById('video-export-steps-count');
    this.videoExportDuration = document.getElementById('video-export-duration');
    this.videoExportSpeed = document.getElementById('video-export-speed');
    this.videoExportOverlayToggle = document.getElementById('video-export-overlay-toggle');
    this.btnStartRecordVideo = document.getElementById('btn-start-record-video');
    this.closeVideoModalBtns = document.querySelectorAll('.close-video-modal');

    this.isRecordingVideo = false;
    this.isRecordingCancelled = false;
    this.activeMediaRecorder = null;

    // 检测 Tauri 原生桌面运行环境并接入窗口控制
    if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
      document.body.classList.add('tauri-app');
      const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
      if (invoke) {
        document.getElementById('win-btn-minimize')?.addEventListener('click', () => invoke('app_minimize'));
        document.getElementById('win-btn-maximize')?.addEventListener('click', () => invoke('app_toggle_maximize'));
        document.getElementById('win-btn-close')?.addEventListener('click', () => invoke('app_close'));
      }
    }

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
      // 录制视频期间隐性加锁，禁止拖动调节工作区
      if (this.isRecordingVideo) return;
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
      const maxWidth = Math.min(760, window.innerWidth - 320);
      const newWidth = Math.max(320, Math.min(maxWidth, startWidth + dx));
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
      window.chemiationStudio?.fitCanvas();
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
      this.btnExpandWorkspace.addEventListener('click', () => {
        if (this.isRecordingVideo) return; // 录制期间隐性加锁，无法点击调出
        this.toggleWorkspace(true);
      });
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
    if (this.btnAiAssistant) {
      this.btnAiAssistant.addEventListener('click', () => {
        if (window.aiAssistant && typeof window.aiAssistant.openModal === 'function') {
          window.aiAssistant.openModal('new');
        }
      });
    }
    if (this.headerAiBtn) {
      this.headerAiBtn.addEventListener('click', () => {
        if (window.aiAssistant && typeof window.aiAssistant.openModal === 'function') {
          window.aiAssistant.openModal('new');
        }
      });
    }
    if (this.btnSaveCloud) {
      this.btnSaveCloud.addEventListener('click', () => {
        if (window.repoCtrl && typeof window.repoCtrl.openSaveModal === 'function') {
          window.repoCtrl.openSaveModal();
        }
      });
    }
    if (this.headerRepoCloudBtn) {
      this.headerRepoCloudBtn.addEventListener('click', () => {
        if (window.repoCtrl && typeof window.repoCtrl.openModal === 'function') {
          window.repoCtrl.openModal('public');
        }
      });
    }

    // CCPL 语法手册内嵌弹窗与外部链接交互（全面适配网页端与 Tauri 桌面端）
    const docsModal = document.getElementById('docs-modal');
    const docsIframe = document.getElementById('docs-modal-iframe');
    const headerDocsBtn = document.getElementById('header-docs-btn');
    const closeDocsModal = document.getElementById('close-docs-modal');
    const headerRepoBtn = document.getElementById('header-repo-btn');
    const docsExternalLink = document.getElementById('docs-modal-external-link');

    const openDocsModal = (e) => {
      if (e) e.preventDefault();
      if (docsModal && docsIframe) {
        const lang = this.currentLang || 'zh';
        const docUrl = lang === 'en' ? 'docs_en.html' : 'docs.html';
        if (!docsIframe.src || !docsIframe.src.endsWith(docUrl)) {
          docsIframe.src = docUrl;
        }
        if (docsExternalLink) docsExternalLink.href = docUrl;
        docsModal.style.display = 'flex';
      }
    };

    const closeDocsModalHandler = () => {
      if (docsModal) docsModal.style.display = 'none';
    };

    headerDocsBtn?.addEventListener('click', openDocsModal);
    closeDocsModal?.addEventListener('click', closeDocsModalHandler);
    docsModal?.addEventListener('click', (e) => {
      if (e.target === docsModal) closeDocsModalHandler();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && docsModal && docsModal.style.display !== 'none') {
        closeDocsModalHandler();
      }
    });

    // Tauri 桌面端调用原生浏览器打开外部 GitHub / 文档链接
    const handleExternalUrl = (e, targetUrl) => {
      if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
        e.preventDefault();
        const invoke = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke;
        if (invoke) {
          invoke('open_external_url', { url: targetUrl });
        }
      }
    };

    headerRepoBtn?.addEventListener('click', (e) => {
      handleExternalUrl(e, 'https://github.com/XRJprogram/Chemiation');
    });

    docsExternalLink?.addEventListener('click', (e) => {
      if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
        e.preventDefault();
        const docUrl = (this.currentLang === 'en')
          ? 'https://xrjprogram.github.io/Chemiation/docs_en.html'
          : 'https://xrjprogram.github.io/Chemiation/docs.html';
        handleExternalUrl(e, docUrl);
      }
    });

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

    // 导出完整推演视频交互
    if (this.btnExportVideo) {
      this.btnExportVideo.addEventListener('click', () => this.openVideoExportModal());
    }
    if (this.btnExportVideoFloat) {
      this.btnExportVideoFloat.addEventListener('click', () => this.openVideoExportModal());
    }
    if (this.btnStartRecordVideo) {
      this.btnStartRecordVideo.addEventListener('click', () => this.startVideoRecording());
    }
    if (this.btnCancelRecording) {
      this.btnCancelRecording.addEventListener('click', () => this.cancelVideoRecording());
    }
    if (this.closeVideoModalBtns) {
      this.closeVideoModalBtns.forEach(btn => {
        btn.addEventListener('click', () => this.closeVideoExportModal());
      });
    }
    if (this.videoExportModal) {
      this.videoExportModal.addEventListener('click', (e) => {
        if (e.target === this.videoExportModal) this.closeVideoExportModal();
      });
    }

    // 全局快捷键
    window.addEventListener('keydown', (e) => {
      if (this.isRecordingVideo) {
        if (e.key === 'Escape') {
          this.cancelVideoRecording();
        }
        return;
      }

      if (e.key === 'Escape' && this.videoExportModal && this.videoExportModal.style.display !== 'none') {
        this.closeVideoExportModal();
        return;
      }

      // 支持 Alt + A 快捷键随时唤起 AI 助手
      if (e.altKey && (e.code === 'KeyA' || e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (window.aiAssistant && typeof window.aiAssistant.openModal === 'function') {
          window.aiAssistant.openModal('new');
        }
        return;
      }

      // 支持 Alt + H 快捷键智能补全氢原子
      if (e.altKey && (e.code === 'KeyH' || e.key === 'h' || e.key === 'H') && this.activeTab === 'script') {
        e.preventDefault();
        this.handleCompleteHydrogens();
        return;
      }

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
    window.chemiationStudio?.closePanels();
    if (tabName === 'steps' && this.isScriptDirty && this.scriptEditor) {
      try {
        const text = this.scriptEditor.value;
        const parsedReaction = ReactionScriptEngine.parse(text);
        this.hideScriptError();

        parsedReaction.id = this.presets[this.currentReactionIndex]?.id || parsedReaction.id;
        this.presets[this.currentReactionIndex] = parsedReaction;
        this.savePresetsToStorage();

        if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
        this.setReactionEquation(parsedReaction.equation);
        if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

        if (this.presetSelect && this.presetSelect.options[this.currentReactionIndex]) {
          this.presetSelect.options[this.currentReactionIndex].textContent = `${this.currentReactionIndex + 1}. ${parsedReaction.name}`;
        }

        this.buildStepsList(parsedReaction.steps);
        this.buildTimelineTrack(parsedReaction.steps);
        this.markScriptDirty(false, '已同步');
        this.pause();
        this.goToStep(Math.min(this.currentStepIndex, parsedReaction.steps.length - 1), false);
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
    if (this.renderer) this.renderer.studioLabelScale = this.renderer.studioSavedLabelScale || 1;
    this.tabBtnChat?.classList.toggle('active', tabName === 'chat');
    if (this.tabPaneChat) this.tabPaneChat.style.display = tabName === 'chat' ? 'flex' : 'none';
    this.workspaceSidebar?.classList.toggle('studio-active', tabName === 'chat');
    if (this.tabBtnSteps) this.tabBtnSteps.classList.toggle('active', tabName === 'steps');
    if (this.tabBtnScript) this.tabBtnScript.classList.toggle('active', tabName === 'script');
    if (this.tabPaneSteps) this.tabPaneSteps.style.display = tabName === 'steps' ? 'flex' : 'none';
    if (this.tabPaneScript) this.tabPaneScript.style.display = tabName === 'script' ? 'flex' : 'none';

    if (this.workspaceContent) {
      this.workspaceContent.style.overflowY = tabName === 'script' || tabName === 'chat' ? 'hidden' : 'auto';
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
    if (this.isRecordingVideo && open) return; // 录制推演视频期间隐性加锁，不允许调出工作区
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

  setReactionEquation(equation) {
    if (!this.reactionEquation) return;
    const format = typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.formatChemText
      ? ReactionScriptEngine.formatChemText
      : (s => s);
    const text = format(equation || '');
    this.reactionEquation.textContent = text;
    const badge = this.reactionEquation.closest('.viewport-equation-display, #header-equation-display');
    if (badge) {
      badge.style.display = text ? 'inline-flex' : 'none';
      badge.title = text ? `反应方程式: ${text}` : '';
    }
  }

  loadReaction(reactionIndex) {
    if (!this.presets[reactionIndex]) return;
    this.studioPreview = null;

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
    this.setReactionEquation(reaction.equation || '');
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
    this.markScriptDirty(false, this.t('statusSynced'));
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
          <div class="step-card-title">${this.escapeHtml(cleanTitle)}</div>
        </div>
        <div class="step-card-note">${this.escapeHtml(cleanNote)}</div>
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

  previewStudioReaction(reaction, stepIndex = 0, animate = false) {
    this.pause();
    if (!this.studioPreview) this.studioPreview = { originalStep: this.currentStepIndex };
    this.studioPreview.reaction = reaction;
    this.showStudioReaction(reaction, stepIndex, animate);
  }

  endStudioPreview() {
    if (!this.studioPreview) return;
    const step = this.studioPreview.originalStep;
    this.studioPreview = null;
    this.pause();
    this.showStudioReaction(this.presets[this.currentReactionIndex], step);
  }

  showStudioReaction(reaction, step, animate = false) {
    if (this.reactionTitle) this.reactionTitle.textContent = reaction.name;
    this.setReactionEquation(reaction.equation || '');
    if (this.reactionDesc) this.reactionDesc.textContent = reaction.summary || '';
    this.buildStepsList(reaction.steps);
    this.buildTimelineTrack(reaction.steps);
    this.goToStep(Math.min(step, reaction.steps.length - 1), animate);
  }

  goToStep(stepIndex, animate = true) {
    const reaction = this.studioPreview?.reaction || this.presets[this.currentReactionIndex];
    if (!reaction || !reaction.steps[stepIndex]) return;

    this.currentStepIndex = stepIndex;
    const step = reaction.steps[stepIndex];
    const totalSteps = reaction.steps.length;

    // 渲染器更新
    this.renderer.setStep(step, animate);
    if (typeof CustomEvent !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('chemiation:step', { detail: { index: stepIndex, preview: !!this.studioPreview } }));

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
        <span class="toast-title">${this.escapeHtml(cleanTitle)}</span>
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
    const reaction = this.studioPreview?.reaction || this.presets[this.currentReactionIndex];
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
    const reaction = this.studioPreview?.reaction || this.presets[this.currentReactionIndex];
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

      parsedReaction.id = this.presets[this.currentReactionIndex]?.id || parsedReaction.id;
      this.presets[this.currentReactionIndex] = parsedReaction;
      this.savePresetsToStorage();

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      this.setReactionEquation(parsedReaction.equation);
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

      parsedReaction.id = this.presets[this.currentReactionIndex]?.id || parsedReaction.id;
      this.presets[this.currentReactionIndex] = parsedReaction;
      this.savePresetsToStorage();

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      this.setReactionEquation(parsedReaction.equation);
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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B84A28" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div style="flex: 1; word-break: break-word;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; flex-wrap: wrap; gap: 6px;">
            <div style="font-weight: 700; color: #B84A28;">语法校验拦截 · 无法更新推演</div>
            <button type="button" id="btn-toast-ai-fix" style="background: rgba(184, 74, 40, 0.12); border: 1px solid rgba(184, 74, 40, 0.35); color: #B84A28; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; cursor: pointer;">[AI 智能排错]</button>
          </div>
          <div style="opacity: 0.95;">${this.escapeHtml(cleanMsg)}</div>
        </div>
      </div>
    `;
    this.scriptErrorToast.style.display = 'block';

    const fixBtn = this.scriptErrorToast.querySelector('#btn-toast-ai-fix');
    if (fixBtn) {
      fixBtn.addEventListener('click', () => {
        if (window.aiAssistant && typeof window.aiAssistant.openModal === 'function') {
          window.aiAssistant.openModal('fix');
        }
      });
    }

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

  /**
   * =========================================================================
   * 反应推演全过程视频导出引擎 (Video Export Engine via Native MediaRecorder)
   * =========================================================================
   */

  openVideoExportModal() {
    if (!this.videoExportModal) return;
    if (this.studioPreview) {
      window.chemiationStudio?.notice('请先保留当前预览版本，再导出它的动画。当前导出使用已保存的原稿。');
      this.endStudioPreview();
    }
    const reaction = this.presets[this.currentReactionIndex];
    if (!reaction) return;

    const totalSteps = (reaction.steps && reaction.steps.length) || 1;
    const format = typeof ReactionScriptEngine !== 'undefined' && ReactionScriptEngine.formatChemText
      ? ReactionScriptEngine.formatChemText
      : (s => s);

    if (this.videoExportReactionName) {
      this.videoExportReactionName.textContent = format(reaction.name);
    }
    if (this.videoExportStepsCount) {
      this.videoExportStepsCount.textContent = this.lang === 'en'
        ? `${totalSteps} steps (from initial reactants to final products)`
        : `共 ${totalSteps} 步 (从起始态到最终产物)`;
    }

    const initialHold = 1.6;
    const stepTransition = 0.92;
    const stepHold = 1.6;
    const finalHold = 2.0;
    const intermediateTotal = Math.max(0, totalSteps - 1) * (stepTransition + stepHold);
    const totalSec = Math.max(3, Math.round(initialHold + intermediateTotal + finalHold));
    if (this.videoExportDuration) {
      this.videoExportDuration.textContent = this.lang === 'en'
        ? `approx. ${totalSec} seconds`
        : `约 ${totalSec} 秒`;
    }

    this.videoExportModal.style.display = 'flex';
  }

  closeVideoExportModal() {
    if (this.videoExportModal) {
      this.videoExportModal.style.display = 'none';
    }
  }

  async startVideoRecording() {
    if (this.isRecordingVideo) return;

    if (!this.canvas || typeof this.canvas.captureStream !== 'function' || typeof window.MediaRecorder === 'undefined') {
      await this.showAlertDialog({
        title: this.lang === 'en' ? 'Recording Not Supported' : '环境不支持视频录制',
        message: this.t('toastRecordingNotSupported')
      });
      return;
    }

    const reaction = this.presets[this.currentReactionIndex];
    if (!reaction || !reaction.steps || reaction.steps.length === 0) {
      await this.showAlertDialog({
        title: this.lang === 'en' ? 'Cannot Export Video' : '无法导出推演视频',
        message: this.lang === 'en' ? 'Current reaction has no mechanism steps.' : '当前反应没有可推演的机理步骤。'
      });
      return;
    }

    const speed = 1.0;
    const showOverlay = this.videoExportOverlayToggle ? this.videoExportOverlayToggle.checked : true;

    this.closeVideoExportModal();

    // 记录原始工作状态以供导出后恢复
    const originalStep = this.currentStepIndex;
    const wasPlaying = this.isPlaying;
    const wasSidebarCollapsed = this.workspaceSidebar ? this.workspaceSidebar.classList.contains('collapsed') : false;

    // 暂停当前交互播放
    this.pause();

    // 为了获得高清全画幅视觉体验，录制时收起工作区侧边栏，录制完成后自动恢复
    if (!wasSidebarCollapsed && this.workspaceSidebar) {
      this.toggleWorkspace(false);
      await new Promise(r => setTimeout(r, 380));
    }

    this.isRecordingVideo = true;
    this.isRecordingCancelled = false;

    // 隐藏视口内 DOM 浮动标签（反应式与步骤说明），彻底消除与 Canvas 画面视频标签的重叠
    document.body.classList.add('recording-in-progress');

    // 显示画布悬浮录制胶囊
    if (this.canvasRecordingIndicator) {
      this.canvasRecordingIndicator.style.display = 'flex';
    }
    this.updateRecordingIndicatorText(0, reaction.steps.length);

    try {
      // 临时根据速率调节渲染器转场速度
      const originalTransitionDuration = this.renderer.transitionDuration;
      this.renderer.transitionDuration = Math.round(920 / speed);

      // 初始化步骤 0
      this.goToStep(0, false);
      if (showOverlay) {
        this.updateVideoExportOverlay(0);
      } else {
        this.renderer.videoExportOverlay = null;
      }
      this.renderer.render();

      await new Promise(r => setTimeout(r, 300));

      // 捕获 Canvas 视频流 (30 fps) 并提升码率至 8Mbps 以消除色块与压缩振铃
      const stream = this.canvas.captureStream(30);
      const mimeType = this.getSupportedVideoMimeType();
      let recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8000000
        });
      } catch (errRec) {
        recorder = new MediaRecorder(stream);
      }

      this.activeMediaRecorder = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const recordStopPromise = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (e) => reject(e);
      });

      // 记录精确物理录制开始时间戳
      const recordingStartTime = performance.now();

      // 启动录制 (每 100ms 刷新切片)
      recorder.start(100);

      // 第一步起始态静止展示 (~1600ms)
      const initialHold = Math.round(1600 / speed);
      const stepHold = Math.round(1600 / speed);
      const finalHold = Math.round(2000 / speed);

      await this.sleepWithCancelCheck(initialHold);

      // 顺次推进各步骤
      for (let s = 1; s < reaction.steps.length; s++) {
        if (this.isRecordingCancelled) break;

        this.updateRecordingIndicatorText(s, reaction.steps.length);
        this.goToStep(s, true);
        if (showOverlay) {
          this.updateVideoExportOverlay(s);
        }

        // 等待步骤三维过渡动画完成
        await this.sleepWithCancelCheck(this.renderer.transitionDuration + 100);
        if (this.isRecordingCancelled) break;

        // 步骤完成态驻留
        await this.sleepWithCancelCheck(stepHold);
        if (this.isRecordingCancelled) break;
      }

      // 最终产物态驻留
      if (!this.isRecordingCancelled) {
        await this.sleepWithCancelCheck(finalHold);
      }

      // 停止录制并等待流刷新
      if (recorder.state !== 'inactive') {
        recorder.stop();
        await recordStopPromise;
      }

      // 计算真实录制总时长 (毫秒)
      const recordingEndTime = performance.now();
      const totalDurationMs = Math.max(100, Math.round(recordingEndTime - recordingStartTime));

      // 恢复渲染器转场速度与清空画面水印
      this.renderer.transitionDuration = originalTransitionDuration;
      this.renderer.videoExportOverlay = null;
      this.renderer.render();

      // 如果未被用户主动取消，则通过视频元数据补全引擎回填时长与拖拽索引
      if (!this.isRecordingCancelled && chunks.length > 0) {
        const actualMime = recorder.mimeType || mimeType;
        const rawBlob = new Blob(chunks, { type: actualMime });
        let finalBlob = rawBlob;
        let ext = 'mp4';

        if (window.ChemiationVideoPatcher && typeof window.ChemiationVideoPatcher.fixVideoBlob === 'function') {
          try {
            const fixedResult = await window.ChemiationVideoPatcher.fixVideoBlob(rawBlob, totalDurationMs);
            if (fixedResult && fixedResult.blob) {
              finalBlob = fixedResult.blob;
              ext = fixedResult.ext || 'mp4';
            }
          } catch (errFix) {
            console.warn('[Chemiation] 视频时长与索引元数据补全异常，降级为原生流:', errFix);
          }
        }

        const safeName = (reaction.name || '反应机理')
          .replace(/[\\/:*?"<>|]/g, '_')
          .replace(/\s+/g, '_')
          .trim();
        const fileName = `${safeName}_推演全过程.${ext}`;

        const blobUrl = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 3000);

        this.showAlertDialog({
          title: this.lang === 'en' ? 'Export Successful' : '视频导出成功',
          message: this.t('toastRecordingSuccess')
        });
      } else if (this.isRecordingCancelled) {
        this.showAlertDialog({
          title: this.lang === 'en' ? 'Export Cancelled' : '导出已取消',
          message: this.t('toastRecordingCancelled')
        });
      }

    } catch (err) {
      console.error('[Chemiation] 视频录制导出异常:', err);
      this.showAlertDialog({
        title: this.lang === 'en' ? 'Recording Error' : '视频录制失败',
        message: err.message || String(err)
      });
    } finally {
      // 状态收尾与界面恢复
      this.isRecordingVideo = false;
      this.isRecordingCancelled = false;
      this.activeMediaRecorder = null;
      this.renderer.videoExportOverlay = null;

      // 恢复视口内原生 DOM 浮动标签展示
      document.body.classList.remove('recording-in-progress');

      if (this.canvasRecordingIndicator) {
        this.canvasRecordingIndicator.style.display = 'none';
      }

      // 恢复侧边栏状态
      if (!wasSidebarCollapsed && this.workspaceSidebar) {
        this.toggleWorkspace(true);
      }

      // 恢复原步骤与播放状态
      this.goToStep(originalStep, false);
      if (wasPlaying) {
        this.play();
      }
    }
  }

  cancelVideoRecording() {
    if (!this.isRecordingVideo) return;
    this.isRecordingCancelled = true;
    if (this.activeMediaRecorder && this.activeMediaRecorder.state !== 'inactive') {
      try {
        this.activeMediaRecorder.stop();
      } catch (e) {}
    }
  }

  sleepWithCancelCheck(ms) {
    return new Promise(resolve => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (this.isRecordingCancelled || Date.now() - start >= ms) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  updateRecordingIndicatorText(currentStepIdx, totalSteps) {
    if (!this.recordingText) return;
    const current = currentStepIdx + 1;
    this.recordingText.textContent = this.t('recordingProgress', { current, total: totalSteps });
  }

  updateVideoExportOverlay(stepIndex) {
    const reaction = this.presets[this.currentReactionIndex];
    if (!reaction || !reaction.steps || !reaction.steps[stepIndex]) return;
    const step = reaction.steps[stepIndex];
    this.renderer.videoExportOverlay = {
      title: reaction.name || '',
      equation: reaction.equation || '',
      stepIndex,
      totalSteps: reaction.steps.length,
      stepTitle: step.name || '',
      stepNote: step.note || ''
    };
    this.renderer.render();
  }

  getSupportedVideoMimeType() {
    const types = [
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    if (typeof window.MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
    }
    return 'video/mp4';
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

document.addEventListener('DOMContentLoaded', async () => {
  window.app = new ReactionApp();
  window.reactionApp = window.app;

  // The workspace is interactive before authentication or repository network requests finish.
  try {
    if (window.aiAssistant) window.aiAssistant.init();
    if (window.chemiationStudio) await window.chemiationStudio.init();
  } catch (err) {
    console.warn('[Chemiation] 初始化 AI 工作台异常:', err);
  }

  // 初始化用户认证控制器 (无论是否启动 server，调用 init 都会初始化基础状态并进行安全鉴权)
  if (window.authCtrl && typeof window.authCtrl.init === 'function') {
    try {
      await window.authCtrl.init();
    } catch (err) {
      console.warn('[Chemiation] 初始化用户认证控制器异常:', err);
    }
  }

  // 初始化云端仓库控制器
  if (window.repoCtrl && typeof window.repoCtrl.init === 'function') {
    try {
      window.repoCtrl.init();
    } catch (err) {
      console.warn('[Chemiation] 初始化云端仓库控制器异常:', err);
    }
  }

  // 支持通过 URL 参数 (?load_repo=<id>) 直接载入云端机理推演
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const repoId = urlParams.get('load_repo');
    if (repoId && window.api) {
      const res = await window.api.getRepo(repoId);
      if (res && res.reaction && window.repoCtrl) {
        window.repoCtrl.loadIntoWorkspace(res.reaction);
      }
    }
  } catch (err) {
    console.warn('[Chemiation] 无法从 URL 载入机理:', err);
  }

  // URL View parameter handler for instant screenshot capture & demo view
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang');
    if (lang && window.reactionApp) {
      window.reactionApp.setLanguage(lang);
    }
    const view = urlParams.get('view');
    if (view === 'auth' && window.authCtrl) {
      window.authCtrl.openModal('login');
    } else if (view === 'repo' && window.repoCtrl) {
      window.repoCtrl.openModal('public');
    } else if (view === 'ai' && window.aiAssistant) {
      window.aiAssistant.openModal('new');
      const promptEl = document.getElementById('ai-prompt-input');
      if (promptEl) promptEl.value = '请为 SN2 亲核取代反应设计三维微观机理，体现 OH⁻ 离子背面 180° 直线进攻与瓦尔登翻转。';
    } else if (view === 'ai_result' && window.aiAssistant) {
      window.aiAssistant.openModal('new');
      const promptEl = document.getElementById('ai-prompt-input');
      if (promptEl) promptEl.value = '请为 SN2 亲核取代反应设计三维微观机理，体现 OH⁻ 离子背面 180° 直线进攻与瓦尔登翻转。';
      const previewSection = document.getElementById('ai-preview-section');
      const previewCode = document.getElementById('ai-preview-code');
      const statusBadge = document.getElementById('ai-status-badge');
      if (previewSection) previewSection.style.display = 'block';
      if (previewCode) {
        previewCode.value = `# Chemiation AI Chemical Copilot 自动推演生成
reaction "SN2 Nucleophilic Substitution & Walden Inversion"
equation "OH- + CH3Br -> [HO···CH3···Br]#- -> CH3OH + Br-"
summary "双分子亲核取代：OH-由背部180°进攻，形成五配位三角双锥过渡态，中心碳完成瓦尔登构型翻转。"

step "1. 亲核试剂靠近与碰撞" {
  note "OH- 负离子沿 C-Br 轴线背部逼近，甲基氢处于四面体构象"
  atom C1 C 0.0 0.0 0.0
  atom Br1 Br 1.9 0.0 0.0 charge=-0.3
  atom O1 O -3.2 0.0 0.0 charge=-1.0
  atom H1 H -0.3 1.0 0.0
  atom H2 H -0.3 -0.5 0.9
  atom H3 H -0.3 -0.5 -0.9
  bond C1 Br1 1
  bond C1 H1 1
  bond C1 H2 1
  bond C1 H3 1
}

step "2. 五配位三角双锥过渡态" {
  note "中心碳原子平面杂化重排，C-Br键减弱拉长，新C-O键初步形成"
  atom C1 C 0.0 0.0 0.0
  atom Br1 Br 2.3 0.0 0.0 charge=-0.6
  atom O1 O -2.2 0.0 0.0 charge=-0.6
  atom H1 H 0.0 1.05 0.0
  atom H2 H 0.0 -0.52 0.92
  atom H3 H 0.0 -0.52 -0.92
  bond C1 Br1 0.5
  bond C1 O1 0.5
  bond C1 H1 1
  bond C1 H2 1
  bond C1 H3 1
}

step "3. 溴离子离去与构型彻底翻转" {
  note "溴离子携带电子对离去，中心碳完成雨伞状瓦尔登翻转生成甲醇"
  atom C1 C 0.0 0.0 0.0
  atom Br1 Br 4.0 0.0 0.0 charge=-1.0
  atom O1 O -1.4 0.0 0.0
  atom H1 H 0.4 1.0 0.0
  atom H2 H 0.4 -0.5 0.9
  atom H3 H 0.4 -0.5 -0.9
  bond C1 O1 1
  bond C1 H1 1
  bond C1 H2 1
  bond C1 H3 1
}`;
      }
      if (statusBadge) {
        statusBadge.textContent = '100% 语法校验通过 · 贝塞尔物理动力学验证';
        statusBadge.className = 'ai-status-badge success';
      }
    } else if (view === 'da' && window.reactionApp) {
      window.reactionApp.loadReaction(4);
    } else if (view === 'starch' && window.reactionApp) {
      window.reactionApp.loadReaction(1);
      const fromParam = urlParams.get('from');
      const toParam = urlParams.get('to');
      const tParam = urlParams.get('t');
      const stepParam = urlParams.get('step');
      if (fromParam !== null && toParam !== null && tParam !== null) {
        const rx = window.reactionApp.presets[1];
        const f = parseInt(fromParam, 10);
        const to = parseInt(toParam, 10);
        const t = parseFloat(tParam);
        if (rx && rx.steps[f] && rx.steps[to]) {
          window.reactionApp.currentStepIndex = t >= 0.5 ? to : f;
          window.reactionApp.renderer.setTransitionState(rx.steps[f], rx.steps[to], t);
          if (window.reactionApp.stepsListContainer) {
            const cards = window.reactionApp.stepsListContainer.querySelectorAll('.step-item-card');
            cards.forEach((c, idx) => {
              c.classList.remove('active', 'completed');
              if (idx === window.reactionApp.currentStepIndex) c.classList.add('active');
              else if (idx < window.reactionApp.currentStepIndex) c.classList.add('completed');
            });
          }
          if (window.reactionApp.canvasStepToast) {
            window.reactionApp.canvasStepToast.innerHTML = `
              <span class="toast-num">${window.reactionApp.currentStepIndex + 1}/${rx.steps.length}</span>
              <span class="toast-title">空间微观反应推演中 (${Math.round(t * 100)}%)</span>
            `;
          }
        }
      } else if (stepParam !== null) {
        window.reactionApp.goToStep(parseInt(stepParam, 10), false);
      }
      if (urlParams.get('play') === '1') {
        setTimeout(() => window.reactionApp.play(), 400);
      }
    } else if (view === 'script' && window.reactionApp) {
      window.reactionApp.switchTab('script');
    }
  } catch (err) {
    console.warn('[Chemiation] URL view handler error:', err);
  }
});
