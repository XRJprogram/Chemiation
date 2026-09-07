/**
 * Chemiation - Reaction Deduction Application Controller
 * 参考 Anychem 架构设计的反应推演工作区与脚本编辑器
 */

class ReactionApp {
  constructor() {
    this.storageKey = 'chemiation_reactions_v3';
    this.presets = this.loadInitialPresets();
    this.currentReactionIndex = 0;
    this.currentStepIndex = 0;

    this.activeTab = 'steps'; // 'steps' | 'script'
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.playTimer = null;
    this.stepBaseDuration = 2800; // ms

    this.isScriptDirty = false;

    this.initDOM();
    this.initRenderer();
    this.initResizable();
    this.bindEvents();
    this.loadReaction(0);
  }

  loadInitialPresets() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Chemiation] 读取本地存储反应失败，使用内置预设', e);
    }
    return typeof REACTION_PRESETS !== 'undefined' ? JSON.parse(JSON.stringify(REACTION_PRESETS)) : [];
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

    // 反应机理库操作 DOM
    this.projectBar = document.getElementById('project-bar');
    this.projectNameLabel = document.getElementById('project-name-label');
    this.reactionCountBadge = document.getElementById('reaction-count-badge');
    this.btnNewReaction = document.getElementById('btn-new-reaction');
    this.btnDeleteReaction = document.getElementById('btn-delete-reaction');
    this.fileSaveStatus = document.getElementById('file-save-status');
    this.btnSaveScript = document.getElementById('btn-save-script');

    // 反应总体信息 (已移除 deltaH)
    this.reactionTitle = document.getElementById('reaction-title');
    this.reactionEquation = document.getElementById('reaction-equation');
    this.reactionCategory = document.getElementById('reaction-category');
    this.reactionDesc = document.getElementById('reaction-desc');

    // 右侧推演工作区整体与容器
    this.workspaceSidebar = document.getElementById('workspace-sidebar');
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
    this.ideHighlight = document.getElementById('ide-highlight');
    this.ideCode = document.getElementById('ide-code');
    this.btnRunScript = document.getElementById('btn-run-script');
    this.btnResetScript = document.getElementById('btn-reset-script');
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
      option.textContent = `${idx + 1}. ${preset.name}`;
      this.presetSelect.appendChild(option);
    });
    this.presetSelect.value = this.currentReactionIndex;
    if (this.reactionCountBadge) {
      this.reactionCountBadge.textContent = `${this.presets.length} 个机理`;
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
    if (this.scriptEditor) {
      this.scriptEditor.addEventListener('input', () => this.markScriptDirty(true));
    }

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

    // ACPL 脚本 IDE 编辑器交互（高亮、行号、Tab缩进与滚动同步）
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
        if (this.ideGutter) {
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
      });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.pause();
        this.nextStep();
      });
    }
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
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
    this.activeTab = tabName;
    if (this.tabBtnSteps) this.tabBtnSteps.classList.toggle('active', tabName === 'steps');
    if (this.tabBtnScript) this.tabBtnScript.classList.toggle('active', tabName === 'script');
    if (this.tabPaneSteps) this.tabPaneSteps.style.display = tabName === 'steps' ? 'flex' : 'none';
    if (this.tabPaneScript) this.tabPaneScript.style.display = tabName === 'script' ? 'flex' : 'none';

    if (tabName === 'script') {
      if (this.scriptEditor && !this.scriptEditor.value.trim()) {
        this.resetScriptToCurrent();
      } else {
        this.updateIDE();
      }
    }
  }

  toggleWorkspace(open) {
    if (!this.workspaceSidebar) return;
    if (open) {
      this.workspaceSidebar.classList.remove('collapsed');
      if (this.btnExpandWorkspace) this.btnExpandWorkspace.classList.remove('visible');
    } else {
      this.workspaceSidebar.classList.add('collapsed');
      if (this.btnExpandWorkspace) this.btnExpandWorkspace.classList.add('visible');
    }
  }

  loadReaction(reactionIndex) {
    if (!this.presets[reactionIndex]) return;

    this.pause();
    this.currentReactionIndex = reactionIndex;
    const reaction = this.presets[reactionIndex];

    if (this.reactionTitle) this.reactionTitle.textContent = reaction.name;
    if (this.reactionEquation) this.reactionEquation.textContent = reaction.equation || '';
    if (this.reactionCategory) this.reactionCategory.textContent = reaction.category || '机理推演';
    if (this.reactionDesc) this.reactionDesc.textContent = reaction.summary || '';

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

    steps.forEach((step, idx) => {
      const card = document.createElement('div');
      card.className = `step-item-card ${idx === 0 ? 'active' : ''}`;
      card.dataset.stepIndex = idx;

      const cleanTitle = step.name.replace(/^\d+\.\s*/, '');
      card.innerHTML = `
        <div class="step-card-top">
          <div class="step-card-num">${idx + 1}</div>
          <div class="step-card-title">${cleanTitle}</div>
        </div>
        <div class="step-card-note">${step.note || ''}</div>
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

    steps.forEach((step, idx) => {
      const pill = document.createElement('div');
      pill.className = `step-pill ${idx === 0 ? 'active' : ''}`;
      pill.title = `第 ${idx + 1} 步: ${step.name}`;
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
      const cleanTitle = step.name.replace(/^\d+\.\s*/, '');
      this.canvasStepToast.innerHTML = `
        <span class="toast-num">${stepIndex + 1}/${totalSteps}</span>
        <span class="toast-title">${cleanTitle}</span>
      `;
    }

    // 滚动并高亮当前步骤卡片
    if (this.stepsListContainer) {
      const cards = this.stepsListContainer.querySelectorAll('.step-item-card');
      cards.forEach((c, idx) => {
        c.classList.remove('active', 'completed');
        if (idx === stepIndex) {
          c.classList.add('active');
          c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (idx < stepIndex) {
          c.classList.add('completed');
        }
      });
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
    this.isPlaying = true;
    this.updatePlayButtonUI();

    const reaction = this.presets[this.currentReactionIndex];
    if (this.currentStepIndex >= reaction.steps.length - 1) {
      this.goToStep(0, true);
    }
    this.scheduleNextTick();
  }

  pause() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    this.updatePlayButtonUI();
  }

  scheduleNextTick() {
    if (!this.isPlaying) return;

    const interval = Math.round(this.stepBaseDuration / this.playbackSpeed);
    this.playTimer = setTimeout(() => {
      if (!this.isPlaying) return;

      const hasNext = this.nextStep();
      if (hasNext) {
        this.scheduleNextTick();
      } else {
        // 推演到最后一步时自动暂停，不进行循环播放
        this.pause();
      }
    }, interval);
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    if (this.speedPills) {
      this.speedPills.forEach(pill => {
        const pSpeed = parseFloat(pill.dataset.speed || '1');
        pill.classList.toggle('active', pSpeed === speed);
      });
    }

    if (this.isPlaying) {
      if (this.playTimer) clearTimeout(this.playTimer);
      this.scheduleNextTick();
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
      this.hideScriptError();

      this.presets[this.currentReactionIndex] = parsedReaction;
      this.savePresetsToStorage();

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
      if (this.reactionCategory) this.reactionCategory.textContent = parsedReaction.category || '机理推演';
      if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

      if (this.presetSelect && this.presetSelect.options[this.currentReactionIndex]) {
        this.presetSelect.options[this.currentReactionIndex].textContent = `${this.currentReactionIndex + 1}. ${parsedReaction.name}`;
      }

      this.buildStepsList(parsedReaction.steps);
      this.buildTimelineTrack(parsedReaction.steps);
      this.renderer.resetCamera();
      this.goToStep(0, false);
      this.markScriptDirty(false, '已同步');

      // 切回步骤机理页面查看推演效果
      this.switchTab('steps');
    } catch (err) {
      this.showScriptError(err.message);
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
      this.presets[this.currentReactionIndex] = parsedReaction;
      this.savePresetsToStorage();

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
      if (this.reactionCategory) this.reactionCategory.textContent = parsedReaction.category || '机理推演';
      if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

      if (this.presetSelect && this.presetSelect.options[this.currentReactionIndex]) {
        this.presetSelect.options[this.currentReactionIndex].textContent = `${this.currentReactionIndex + 1}. ${parsedReaction.name}`;
      }

      this.buildStepsList(parsedReaction.steps);
      this.buildTimelineTrack(parsedReaction.steps);
      this.goToStep(this.currentStepIndex || 0, false);
      this.hideScriptError();
      this.markScriptDirty(false, '已保存');
    } catch (err) {
      this.showScriptError(err.message);
      this.markScriptDirty(false, '语法错误');
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
   * 新建反应机理
   */
  handleNewReaction() {
    const name = prompt('请输入新反应名称 (例如: 乙醇催化氧化机理):', '新建化学反应');
    if (!name || !name.trim()) return;

    const templateText = ReactionScriptEngine.getQuickTemplate('reaction_blank').replace('reaction "新建化学反应"', `reaction "${name.trim()}"`);
    let newReaction;
    try {
      newReaction = ReactionScriptEngine.parse(templateText);
    } catch (e) {
      newReaction = {
        id: 'reaction-' + Date.now(),
        name: name.trim(),
        equation: 'A + B ⇌ C + D',
        category: '自定义机理',
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
   * 删除当前选中的反应机理
   */
  handleDeleteReaction() {
    if (this.presets.length <= 1) {
      alert('反应机理库中至少需要保留 1 个机理，无法删除唯一机理。');
      return;
    }

    const currentReaction = this.presets[this.currentReactionIndex];
    const ok = confirm(`确定要删除反应【${currentReaction.name}】吗？删除后将从本地机理库移除。`);
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
   * 刷新 ACPL IDE 编辑器：同步语法高亮与行号列
   */
  updateIDE() {
    if (!this.scriptEditor) return;
    const code = this.scriptEditor.value;

    if (this.ideCode) {
      this.ideCode.innerHTML = this.highlightACPL(code);
    }

    if (this.ideGutter) {
      const lineCount = (code.split('\n').length) || 1;
      let gutterHtml = '';
      for (let i = 1; i <= lineCount; i++) {
        gutterHtml += `<div>${i}</div>`;
      }
      this.ideGutter.innerHTML = gutterHtml;
    }

    if (this.ideHighlight) {
      this.ideHighlight.scrollTop = this.scriptEditor.scrollTop;
      this.ideHighlight.scrollLeft = this.scriptEditor.scrollLeft;
    }
    if (this.ideGutter) {
      this.ideGutter.scrollTop = this.scriptEditor.scrollTop;
    }
  }

  /**
   * ACPL 脚本语法高亮解析器（单趟精准词法正则高亮）
   */
  highlightACPL(text) {
    if (!text) return '';

    const tokenRegex = /(#.*$)|("(?:[^"\\]|\\.)*")|\b(reaction|step|atom|bond|polymer|order|tag|leftBond|rightBond|exclude|excludeIds|vector|note|equation|summary|category)\b|\b(H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Fe|Cu|Zn|Br|I|Pt|Pd|Au)\b|(?<!\w)(-?\d+(?:\.\d+)?)(?!\w)|([{}[\]])/gm;

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
      result += ' ';
    }

    return result;
  }

  showScriptError(msg) {
    if (!this.scriptErrorToast) return;
    this.scriptErrorToast.textContent = `语法错误: ${msg}`;
    this.scriptErrorToast.style.display = 'block';
  }

  hideScriptError() {
    if (!this.scriptErrorToast) return;
    this.scriptErrorToast.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ReactionApp();
});
