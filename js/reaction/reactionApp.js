/**
 * Chemiation - Chemical Reaction Deduction Application Controller
 * 连接反应数据集与伪 3D Canvas 渲染器，管理推演步骤时序与用户交互
 */

class ReactionApp {
  constructor() {
    this.presets = typeof REACTION_PRESETS !== 'undefined' ? REACTION_PRESETS : [];
    this.currentReactionIndex = 0;
    this.currentStepIndex = 0;

    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.playTimer = null;
    this.stepBaseDuration = 2800; // 基础步进时间间隔 (ms)

    this.initDOM();
    this.initRenderer();
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
    this.reactionDesc = document.getElementById('reaction-desc');

    // 步骤机理详情
    this.stepCounterBadge = document.getElementById('step-counter-badge');
    this.stepActionBadge = document.getElementById('step-action-badge');
    this.stepName = document.getElementById('step-name');
    this.stepNoteText = document.getElementById('step-note-text');

    // 步进轨道与控制按钮
    this.timelineTrack = document.getElementById('timeline-track');
    this.prevBtn = document.getElementById('prev-btn');
    this.playBtn = document.getElementById('play-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.resetStepBtn = document.getElementById('reset-step-btn');

    // 工具按钮
    this.btnResetCam = document.getElementById('btn-reset-cam');
    this.btnToggleRotate = document.getElementById('btn-toggle-rotate');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');

    // 速度选择按钮
    this.speedPills = document.querySelectorAll('.speed-pill');

    // 填充下拉选项
    if (this.presetSelect && this.presets.length > 0) {
      this.presetSelect.innerHTML = '';
      this.presets.forEach((preset, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = `${idx + 1}. ${preset.name} (${preset.category || '机理推演'})`;
        this.presetSelect.appendChild(option);
      });
    }
  }

  initRenderer() {
    this.renderer = new Pseudo3DRenderer(this.canvas, {
      bg: '#FAF6E9',
      maskBg: '#FAF6E9',
      autoRotate: false
    });
    this.renderer.start();
  }

  bindEvents() {
    // 反应切换
    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => {
        this.loadReaction(parseInt(e.target.value, 10));
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
      this.playBtn.addEventListener('click', () => {
        this.togglePlay();
      });
    }

    if (this.resetStepBtn) {
      this.resetStepBtn.addEventListener('click', () => {
        this.pause();
        this.goToStep(0, true);
      });
    }

    // 视角与视口工具
    if (this.btnResetCam) {
      this.btnResetCam.addEventListener('click', () => {
        this.renderer.resetCamera();
      });
    }

    if (this.btnToggleRotate) {
      this.btnToggleRotate.addEventListener('click', () => {
        this.renderer.autoRotate = !this.renderer.autoRotate;
        this.btnToggleRotate.classList.toggle('active', this.renderer.autoRotate);
      });
    }

    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', () => {
        this.renderer.targetZoom = Math.min(180, this.renderer.targetZoom * 1.2);
      });
    }

    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', () => {
        this.renderer.targetZoom = Math.max(35, this.renderer.targetZoom * 0.83);
      });
    }

    // 播放速度选择
    this.speedPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const speed = parseFloat(pill.dataset.speed || '1');
        this.setPlaybackSpeed(speed);
      });
    });

    // 键盘快捷键支持
    window.addEventListener('keydown', (e) => {
      // 避免在输入框中触发
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

  loadReaction(reactionIndex) {
    if (!this.presets[reactionIndex]) return;

    this.pause();
    this.currentReactionIndex = reactionIndex;
    const reaction = this.presets[reactionIndex];

    // 更新信息卡片
    if (this.reactionTitle) this.reactionTitle.textContent = reaction.name;
    if (this.reactionDeltaH) this.reactionDeltaH.textContent = reaction.deltaH || 'ΔH';
    if (this.reactionEquation) this.reactionEquation.textContent = reaction.equation;
    if (this.reactionDesc) this.reactionDesc.textContent = reaction.summary;

    if (this.presetSelect) {
      this.presetSelect.value = reactionIndex;
    }

    // 重建时间轴胶囊轨道
    this.buildTimelineTrack(reaction.steps);

    // 重置视角到自然方位并进入第 0 步
    this.renderer.resetCamera();
    this.goToStep(0, false);
  }

  buildTimelineTrack(steps) {
    if (!this.timelineTrack) return;
    this.timelineTrack.innerHTML = '';

    steps.forEach((step, idx) => {
      const pill = document.createElement('div');
      pill.className = `step-pill ${idx === 0 ? 'active' : ''}`;
      pill.title = `步骤 ${idx + 1}: ${step.name}`;
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

    // 更新 Canvas 渲染器模型步骤
    this.renderer.setStep(step, animate);

    // 更新机理卡片文字
    if (this.stepCounterBadge) {
      this.stepCounterBadge.textContent = `STEP ${stepIndex + 1}/${totalSteps}`;
    }

    if (this.stepActionBadge) {
      this.stepActionBadge.textContent = (step.action && step.action.desc) || '反应基态';
    }

    if (this.stepName) {
      this.stepName.textContent = step.name;
    }

    if (this.stepNoteText) {
      this.stepNoteText.textContent = step.note;
    }

    // 更新时间轴高亮状态
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

    // 更新按钮可用状态
    if (this.prevBtn) {
      this.prevBtn.style.opacity = stepIndex === 0 ? '0.45' : '1';
      this.prevBtn.style.pointerEvents = stepIndex === 0 ? 'none' : 'auto';
    }

    if (this.nextBtn) {
      this.nextBtn.style.opacity = stepIndex === totalSteps - 1 ? '0.45' : '1';
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
    // 如果已经在最后一步，则从头开始循环
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
        // 反应结束，短暂停留后循环至起点
        setTimeout(() => {
          if (this.isPlaying) {
            this.goToStep(0, true);
            this.scheduleNextTick();
          }
        }, 1500);
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
}

// 页面加载就绪后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ReactionApp();
});
