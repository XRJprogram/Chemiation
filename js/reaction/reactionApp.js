/**
 * Chemiation - Reaction Deduction Application Controller
 * 参考 Anychem 架构设计的反应推演工作区与脚本编辑器
 */

class ReactionApp {
  constructor() {
    this.presets = typeof REACTION_PRESETS !== 'undefined' ? JSON.parse(JSON.stringify(REACTION_PRESETS)) : [];
    this.currentReactionIndex = 0;
    this.currentStepIndex = 0;

    this.activeTab = 'steps'; // 'steps' | 'script'
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.playTimer = null;
    this.stepBaseDuration = 2800; // ms

    // 本地项目文件夹与存储引擎
    this.storage = new StorageManager();
    this.isProjectMode = false;
    this.activeProjectFile = '';
    this.isScriptDirty = false;
    this.projectReactions = [];

    this.initDOM();
    this.initRenderer();
    this.initResizable();
    this.bindEvents();
    this.loadReaction(0);
    this.checkSavedProjectOnStartup();
  }

  initDOM() {
    this.canvas = document.getElementById('reaction-canvas');
    this.presetSelect = document.getElementById('preset-select');

    // 项目文件夹相关 DOM
    this.projectBar = document.getElementById('project-bar');
    this.projectNameLabel = document.getElementById('project-name-label');
    this.btnOpenProject = document.getElementById('btn-open-project');
    this.btnNewReaction = document.getElementById('btn-new-reaction');
    this.btnCloseProject = document.getElementById('btn-close-project');
    this.fileSaveStatus = document.getElementById('file-save-status');
    this.btnSaveScript = document.getElementById('btn-save-script');

    // 反应总体信息
    this.reactionTitle = document.getElementById('reaction-title');
    this.reactionDeltaH = document.getElementById('reaction-delta-h');
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

    // 脚本编辑器相关
    this.scriptEditor = document.getElementById('script-editor');
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
    if (this.presetSelect && this.presets.length > 0) {
      this.presetSelect.innerHTML = '';
      this.presets.forEach((preset, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `${idx + 1}. ${preset.name}`;
        this.presetSelect.appendChild(option);
      });
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
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;
      const dx = startX - e.clientX;
      const newWidth = Math.max(320, Math.min(760, startWidth + dx));
      this.workspaceSidebar.style.width = `${newWidth}px`;
      this.renderer.resize();
    };

    const onMouseUp = () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.renderer.resize();
    };

    this.resizeHandle.addEventListener('mousedown', onMouseDown);
  }

  bindEvents() {
    // 反应预设或本地项目文件切换
    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', async (e) => {
        if (this.isProjectMode) {
          await this.loadProjectFile(e.target.value);
        } else {
          this.loadReaction(parseInt(e.target.value, 10));
        }
      });
    }

    // 本地项目文件夹操作绑定
    if (this.btnOpenProject) {
      this.btnOpenProject.addEventListener('click', () => this.handleOpenProject());
    }
    if (this.btnNewReaction) {
      this.btnNewReaction.addEventListener('click', () => this.handleNewReaction());
    }
    if (this.btnCloseProject) {
      this.btnCloseProject.addEventListener('click', () => this.handleCloseProject());
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

    // 快捷模板一键插入
    const templatePills = document.querySelectorAll('.template-pill');
    templatePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const t = pill.dataset.template;
        const text = ReactionScriptEngine.getQuickTemplate(t);
        if (this.scriptEditor) {
          if (t === 'new_step') {
            this.scriptEditor.value += text;
          } else {
            this.scriptEditor.value = text;
          }
          this.hideScriptError();
          this.markScriptDirty(true);
        }
      });
    });

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

    if (tabName === 'script' && this.scriptEditor && !this.scriptEditor.value.trim()) {
      this.resetScriptToCurrent();
    }
  }

  toggleWorkspace(open) {
    if (!this.workspaceSidebar) return;
    if (open) {
      this.workspaceSidebar.classList.remove('collapsed');
      if (this.btnExpandWorkspace) this.btnExpandWorkspace.style.display = 'none';
    } else {
      this.workspaceSidebar.classList.add('collapsed');
      if (this.btnExpandWorkspace) this.btnExpandWorkspace.style.display = 'flex';
    }
    setTimeout(() => this.renderer.resize(), 220);
  }

  loadReaction(reactionIndex) {
    if (!this.presets[reactionIndex]) return;

    this.pause();
    this.currentReactionIndex = reactionIndex;
    const reaction = this.presets[reactionIndex];

    if (this.reactionTitle) this.reactionTitle.textContent = reaction.name;
    if (this.reactionDeltaH) this.reactionDeltaH.textContent = reaction.deltaH || 'ΔH';
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
      const isPolymer = !!(step.polymer || step.isPolymer || (step.name && (step.name.includes('淀粉') || step.name.includes('聚合'))));
      const polymerBadge = isPolymer ? `<span class="step-card-badge" style="background:#FFF0E6;color:#B84A28;border-color:#F5C6AA;margin-left:4px;">[ ]ₙ 聚合物</span>` : '';
      card.innerHTML = `
        <div class="step-card-top">
          <div class="step-card-num">${idx + 1}</div>
          <div class="step-card-title">${cleanTitle}</div>
          <span class="step-card-badge">${(step.action && step.action.desc) || '反应'}</span>
          ${polymerBadge}
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
   * 运行自定义编写的推演脚本
   */
  async runCustomScript() {
    if (!this.scriptEditor) return;
    const text = this.scriptEditor.value;

    try {
      const parsedReaction = ReactionScriptEngine.parse(text);
      this.hideScriptError();

      if (this.isProjectMode && this.activeProjectFile) {
        // 项目模式：自动同步写盘并载入
        await this.storage.writeFile(this.activeProjectFile, text);
        this.presets = [parsedReaction];
        this.currentReactionIndex = 0;
        this.markScriptDirty(false, '已同步保存');
      } else {
        // 内置预设模式：将解析后的自定义反应插入或替换预设
        const customIndex = this.presets.findIndex(p => p.id === parsedReaction.id || p.id === 'custom-active');
        if (customIndex >= 0) {
          this.presets[customIndex] = parsedReaction;
          this.currentReactionIndex = customIndex;
        } else {
          parsedReaction.id = 'custom-active';
          this.presets.unshift(parsedReaction);
          this.currentReactionIndex = 0;

          // 更新下拉
          if (this.presetSelect) {
            const opt = document.createElement('option');
            opt.value = 0;
            opt.textContent = `★ ${parsedReaction.name} (自定义脚本)`;
            this.presetSelect.insertBefore(opt, this.presetSelect.firstChild);
            this.presetSelect.value = 0;
          }
        }
      }

      if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
      if (this.reactionDeltaH) this.reactionDeltaH.textContent = parsedReaction.deltaH || 'ΔH';
      if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
      if (this.reactionCategory) this.reactionCategory.textContent = parsedReaction.category || '机理推演';
      if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

      this.buildStepsList(parsedReaction.steps);
      this.buildTimelineTrack(parsedReaction.steps);
      this.renderer.resetCamera();
      this.goToStep(0, false);

      // 切回步骤机理页面查看效果
      this.switchTab('steps');
    } catch (err) {
      this.showScriptError(err.message);
    }
  }

  async resetScriptToCurrent() {
    if (this.isProjectMode && this.activeProjectFile) {
      try {
        const content = await this.storage.readFile(this.activeProjectFile);
        if (this.scriptEditor) {
          this.scriptEditor.value = content;
        }
        this.hideScriptError();
        this.markScriptDirty(false, '已还原');
      } catch (err) {
        console.error('[Chemiation] 还原本地文件失败:', err);
      }
    } else {
      const reaction = this.presets[this.currentReactionIndex];
      if (reaction && this.scriptEditor) {
        this.scriptEditor.value = ReactionScriptEngine.serialize(reaction);
        this.hideScriptError();
        this.markScriptDirty(false, '已还原');
      }
    }
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

  /* ==========================================================================
     本地项目工作区管理 (Web File System Access API & IndexedDB)
     ========================================================================== */

  /**
   * 启动时检查是否有记住的本地项目
   */
  async checkSavedProjectOnStartup() {
    try {
      const savedInfo = await this.storage.checkSavedDirectory();
      if (!savedInfo || !savedInfo.handle) return;

      if (savedInfo.permission === 'granted') {
        const resumed = await this.storage.resumeSavedDirectory(savedInfo.handle);
        if (resumed) {
          await this.enterProjectMode();
          return;
        }
      }

      // 若权限需要用户交互确认，保留句柄待用户点击时唤醒
      this.pendingResumeHandle = savedInfo.handle;
      if (this.projectNameLabel) {
        this.projectNameLabel.textContent = `恢复: ${savedInfo.name}`;
        this.projectNameLabel.title = `点击恢复访问本地项目: ${savedInfo.name}`;
      }
      if (this.btnOpenProject) {
        this.btnOpenProject.textContent = '恢复项目';
      }
    } catch (err) {
      console.warn('[Chemiation] 检查历史项目异常:', err);
    }
  }

  /**
   * 处理打开或创建本地项目目录
   */
  async handleOpenProject() {
    try {
      if (this.pendingResumeHandle) {
        const ok = await this.storage.resumeSavedDirectory(this.pendingResumeHandle);
        this.pendingResumeHandle = null;
        if (ok) {
          await this.enterProjectMode();
          return;
        }
      }

      const ok = await this.storage.openDirectoryPicker();
      if (ok) {
        await this.enterProjectMode();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[Chemiation] 打开项目目录失败:', err);
        alert('打开项目目录失败: ' + err.message);
      }
    }
  }

  /**
   * 进入本地项目工作区模式
   */
  async enterProjectMode() {
    this.isProjectMode = true;
    if (this.projectBar) {
      this.projectBar.classList.add('active-project');
    }
    if (this.projectNameLabel) {
      this.projectNameLabel.textContent = this.storage.projectName || '项目工作区';
      this.projectNameLabel.title = `已连接本地项目: ${this.storage.projectName}`;
    }
    if (this.btnOpenProject) {
      this.btnOpenProject.textContent = '更换目录';
    }
    if (this.btnNewReaction) {
      this.btnNewReaction.style.display = 'inline-flex';
    }
    if (this.btnCloseProject) {
      this.btnCloseProject.style.display = 'inline-flex';
    }
    if (this.fileSaveStatus) {
      this.fileSaveStatus.style.display = 'inline-block';
    }
    if (this.btnSaveScript) {
      this.btnSaveScript.style.display = 'inline-flex';
    }

    // 刷新反应列表下拉框
    const acplFiles = this.storage.files.filter(f => f.type === 'acpl');
    if (this.presetSelect) {
      this.presetSelect.innerHTML = '';
      acplFiles.forEach(file => {
        const opt = document.createElement('option');
        opt.value = file.name;
        opt.textContent = file.name.replace(/\.acpl$/i, '');
        this.presetSelect.appendChild(opt);
      });
    }

    // 确定载入哪个机理文件
    let targetFile = acplFiles[0]?.name;
    const jsonFile = this.storage.files.find(f => f.name === 'chemiation.json');
    if (jsonFile) {
      try {
        const configStr = await this.storage.readFile('chemiation.json');
        const config = JSON.parse(configStr);
        if (config.lastOpenedFile && acplFiles.some(f => f.name === config.lastOpenedFile)) {
          targetFile = config.lastOpenedFile;
        }
      } catch (e) {
        // ignore
      }
    }

    if (targetFile) {
      await this.loadProjectFile(targetFile);
    }
  }

  /**
   * 从本地项目目录载入指定 .acpl 机理文件
   */
  async loadProjectFile(filename) {
    if (!filename) return;
    try {
      const content = await this.storage.readFile(filename);
      const reaction = ReactionScriptEngine.parse(content);

      this.pause();
      this.activeProjectFile = filename;
      this.presets = [reaction];
      this.currentReactionIndex = 0;

      if (this.presetSelect) {
        this.presetSelect.value = filename;
      }

      if (this.reactionTitle) this.reactionTitle.textContent = reaction.name;
      if (this.reactionDeltaH) this.reactionDeltaH.textContent = reaction.deltaH || 'ΔH';
      if (this.reactionEquation) this.reactionEquation.textContent = reaction.equation || '';
      if (this.reactionCategory) this.reactionCategory.textContent = reaction.category || '本地机理脚本';
      if (this.reactionDesc) this.reactionDesc.textContent = reaction.summary || '';

      this.buildStepsList(reaction.steps);
      this.buildTimelineTrack(reaction.steps);

      if (this.scriptEditor) {
        this.scriptEditor.value = content;
      }

      this.markScriptDirty(false, '已同步');
      this.hideScriptError();

      this.renderer.resetCamera();
      this.goToStep(0, false);

      // 记录到 chemiation.json
      try {
        const configStr = await this.storage.readFile('chemiation.json');
        const config = JSON.parse(configStr);
        config.lastOpenedFile = filename;
        await this.storage.writeFile('chemiation.json', JSON.stringify(config, null, 2));
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('[Chemiation] 载入/解析本地文件失败:', err);
      this.showScriptError(err.message);
    }
  }

  /**
   * 保存当前编辑的推演脚本至本地文件 (Ctrl + S 或点击保存)
   */
  async saveCurrentScript() {
    if (!this.scriptEditor) return;
    const text = this.scriptEditor.value;

    if (!this.isProjectMode) {
      const confirmOpen = confirm('当前处于内置预设模式，文件修改仅在内存中生效。\n是否选择本地文件夹作为项目工作区，以将 4 大经典样例和您的修改实时写盘持久化？');
      if (confirmOpen) {
        await this.handleOpenProject();
      }
      return;
    }

    if (!this.activeProjectFile) {
      alert('未选中任何机理文件');
      return;
    }

    try {
      await this.storage.writeFile(this.activeProjectFile, text);

      // 尝试解析并即时更新视口与步骤
      try {
        const parsedReaction = ReactionScriptEngine.parse(text);
        this.presets = [parsedReaction];
        this.currentReactionIndex = 0;

        if (this.reactionTitle) this.reactionTitle.textContent = parsedReaction.name;
        if (this.reactionDeltaH) this.reactionDeltaH.textContent = parsedReaction.deltaH || 'ΔH';
        if (this.reactionEquation) this.reactionEquation.textContent = parsedReaction.equation || '';
        if (this.reactionDesc) this.reactionDesc.textContent = parsedReaction.summary || '';

        this.buildStepsList(parsedReaction.steps);
        this.buildTimelineTrack(parsedReaction.steps);
        this.goToStep(this.currentStepIndex || 0, false);
        this.hideScriptError();
        this.markScriptDirty(false, '已保存至本地');
      } catch (parseErr) {
        this.markScriptDirty(false, '已写盘 (语法警告)');
        this.showScriptError(parseErr.message);
      }
    } catch (err) {
      console.error('[Chemiation] 保存文件失败:', err);
      alert('保存文件失败: ' + err.message);
    }
  }

  /**
   * 标记脚本脏状态 (有未保存更改)
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
   * 在当前项目中新建反应机理文件
   */
  async handleNewReaction() {
    if (!this.isProjectMode) {
      await this.handleOpenProject();
      return;
    }

    const name = prompt('请输入新反应机理的名称 (例如: 乙醇催化氧化):', '');
    if (!name || !name.trim()) return;

    try {
      const filename = await this.storage.createNewReactionFile(name.trim());

      // 重新生成下拉选项
      const acplFiles = this.storage.files.filter(f => f.type === 'acpl');
      if (this.presetSelect) {
        this.presetSelect.innerHTML = '';
        acplFiles.forEach(file => {
          const opt = document.createElement('option');
          opt.value = file.name;
          opt.textContent = file.name.replace(/\.acpl$/i, '');
          this.presetSelect.appendChild(opt);
        });
      }

      await this.loadProjectFile(filename);
      this.switchTab('script');
    } catch (err) {
      console.error('[Chemiation] 新建反应文件失败:', err);
      alert('新建反应机理失败: ' + err.message);
    }
  }

  /**
   * 退出本地项目模式，恢复内置样例
   */
  async handleCloseProject() {
    if (this.isScriptDirty) {
      const confirmClose = confirm('当前有未保存的脚本修改，退出项目工作区将放弃这些改动，是否确认退出？');
      if (!confirmClose) return;
    }

    await this.storage.closeProject();
    this.isProjectMode = false;
    this.activeProjectFile = '';
    this.isScriptDirty = false;

    if (this.projectBar) {
      this.projectBar.classList.remove('active-project');
    }
    if (this.projectNameLabel) {
      this.projectNameLabel.textContent = '内置样例模式';
      this.projectNameLabel.title = '当前为内置预设模式。点击右侧按钮选择本地文件夹作为项目工作区';
    }
    if (this.btnOpenProject) {
      this.btnOpenProject.textContent = '打开项目目录';
    }
    if (this.btnNewReaction) {
      this.btnNewReaction.style.display = 'none';
    }
    if (this.btnCloseProject) {
      this.btnCloseProject.style.display = 'none';
    }
    if (this.fileSaveStatus) {
      this.fileSaveStatus.style.display = 'none';
    }

    // 还原内置预设
    this.presets = (typeof REACTION_PRESETS !== 'undefined') ? [...REACTION_PRESETS] : [];
    if (this.presetSelect) {
      this.presetSelect.innerHTML = '';
      this.presets.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = p.name;
        this.presetSelect.appendChild(opt);
      });
    }

    this.loadReaction(0);
    this.switchTab('steps');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ReactionApp();
});
