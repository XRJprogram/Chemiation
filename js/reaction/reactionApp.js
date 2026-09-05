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

    this.initDOM();
    this.initRenderer();
    this.initResizable();
    this.bindEvents();
    this.loadReaction(0);
  }

  initDOM() {
    this.canvas = document.getElementById('reaction-canvas');
    this.presetSelect = document.getElementById('preset-select');

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
    // 反应预设切换
    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => {
        this.loadReaction(parseInt(e.target.value, 10));
      });
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
    this.speedPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const speed = parseFloat(pill.dataset.speed || '1');
        this.setPlaybackSpeed(speed);
      });
    });

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
      card.innerHTML = `
        <div class="step-card-top">
          <div class="step-card-num">${idx + 1}</div>
          <div class="step-card-title">${cleanTitle}</div>
          <span class="step-card-badge">${(step.action && step.action.desc) || '反应'}</span>
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
        setTimeout(() => {
          if (this.isPlaying) {
            this.goToStep(0, true);
            this.scheduleNextTick();
          }
        }, 1600);
      }
    }, interval);
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    this.speedPills.forEach(pill => {
      const pSpeed = parseFloat(pill.dataset.speed || '1');
      pill.classList.toggle('active', pSpeed === speed);
    });

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
        <span>暂停推演</span>
      `;
      this.playBtn.classList.add('primary');
    } else {
      this.playBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>自动推演</span>
      `;
      this.playBtn.classList.remove('primary');
    }
  }

  /**
   * 运行自定义编写的推演脚本
   */
  runCustomScript() {
    if (!this.scriptEditor) return;
    const text = this.scriptEditor.value;

    try {
      const parsedReaction = ReactionScriptEngine.parse(text);
      this.hideScriptError();

      // 将解析后的自定义反应插入或替换预设
      const customIndex = this.presets.findIndex(p => p.id === parsedReaction.id || p.id === 'custom-active');
      if (customIndex >= 0) {
        this.presets[customIndex] = parsedReaction;
        this.loadReaction(customIndex);
      } else {
        parsedReaction.id = 'custom-active';
        this.presets.unshift(parsedReaction);

        // 更新下拉
        if (this.presetSelect) {
          const opt = document.createElement('option');
          opt.value = 0;
          opt.textContent = `★ ${parsedReaction.name} (自定义脚本)`;
          this.presetSelect.insertBefore(opt, this.presetSelect.firstChild);
        }
        this.loadReaction(0);
      }

      // 切回步骤机理页面查看效果
      this.switchTab('steps');
    } catch (err) {
      this.showScriptError(err.message);
    }
  }

  resetScriptToCurrent() {
    const reaction = this.presets[this.currentReactionIndex];
    if (reaction && this.scriptEditor) {
      this.scriptEditor.value = ReactionScriptEngine.serialize(reaction);
      this.hideScriptError();
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ReactionApp();
});
