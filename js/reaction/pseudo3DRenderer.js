/**
 * Chemiation - Pseudo3DRenderer
 * 伪3D 化学分子与反应机理 2D Canvas 渲染引擎
 * 
 * 核心动画升级：
 * 1. 化学键断裂从中间断开：断键时自中心裂解为两段并回缩消解，带有微观断键能辉光
 * 2. 元素共价键迁移合成：若同一元素在断键的同时还有新加键，断裂的键将沿自然三维弧线平滑迁移至新键位置完成重组构筑 (Electron-Pair Migration)
 * 3. 独立生成键自两侧向中间生长相遇合成
 * 4. 全双向深度色彩渐变：由浅入深、前后纵深分明
 * 5. 纯字母排印与 100% 氢原子立体守恒呈现
 */

class Pseudo3DRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 视觉色彩配置（淡黄宣纸基调与深棕学术色阶）
    this.palette = {
      bg: options.bg || '#FAF6E9',
      bgGrid: options.bgGrid || 'rgba(92, 64, 45, 0.04)',
      atomFront: options.atomFront || { r: 36, g: 20, b: 11 },   // 前景深棕黑 #24140B
      atomBack: options.atomBack || { r: 168, g: 142, b: 122 },  // 远景淡暖棕 #A88E7A
      bondFront: options.bondFront || { r: 42, g: 25, b: 14 },   // 前景键浓棕
      bondBack: options.bondBack || { r: 182, g: 160, b: 142 },  // 远景键淡棕
      highlight: options.highlight || '#B84A28', // 活性中心赭红
      activeGold: options.activeGold || '#C87820', // 迁移重组成键金橙
      maskBg: options.maskBg || '#FAF6E9'
    };

    // 3D 视角参数
    this.rotX = options.rotX !== undefined ? options.rotX : 0.35;
    this.rotY = options.rotY !== undefined ? options.rotY : -0.55;
    this.targetRotX = this.rotX;
    this.targetRotY = this.rotY;

    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;

    this.zoom = options.zoom || 78;
    this.targetZoom = this.zoom;
    this.autoRotate = options.autoRotate || false;
    this.autoRotateSpeed = 0.003;

    // 交互模式：纯渲染视口以 3D 自由旋转为主
    this.toolMode = options.toolMode || 'rotate';
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.hoveredAtom = null;

    // 步骤过渡状态
    this.currentStepData = null;
    this.nextStepData = null;
    this.transitionProgress = 1;
    this.transitionDuration = 920; // 动画更从容优雅展现断键与迁移 (ms)
    this.transitionStartTime = 0;

    this.animationFrameId = null;
    this.lastFrameTime = performance.now();

    this.initEvents();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const onPointerDown = (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX || (e.touches && e.touches[0].clientX);
      this.lastMouseY = e.clientY || (e.touches && e.touches[0].clientY);
    };

    const onPointerMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      if (this.isDragging && clientX !== undefined && clientY !== undefined) {
        const dx = clientX - this.lastMouseX;
        const dy = clientY - this.lastMouseY;

        // 3D 自由空间旋转
        this.targetRotY += dx * 0.008;
        this.targetRotX += dy * 0.008;
        this.targetRotX = Math.max(-1.45, Math.min(1.45, this.targetRotX));

        this.lastMouseX = clientX;
        this.lastMouseY = clientY;
      } else if (e.clientX !== undefined) {
        this.checkHover(e.clientX, e.clientY);
      }
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
      this.targetZoom = Math.max(30, Math.min(220, this.targetZoom * zoomFactor));
    }, { passive: false });
  }

  zoomIn() {
    this.targetZoom = Math.min(220, this.targetZoom * 1.25);
  }

  zoomOut() {
    this.targetZoom = Math.max(30, this.targetZoom * 0.8);
  }

  resetCamera() {
    this.targetRotX = 0.35;
    this.targetRotY = -0.55;
    this.targetZoom = 78;
    this.targetPanX = 0;
    this.targetPanY = 0;
  }

  setStep(stepData, animate = true) {
    if (!this.currentStepData || !animate) {
      this.currentStepData = stepData;
      this.nextStepData = null;
      this.transitionProgress = 1;
      return;
    }

    this.nextStepData = stepData;
    this.transitionProgress = 0;
    this.transitionStartTime = performance.now();
  }

  start() {
    if (this.animationFrameId) return;
    const loop = (now) => {
      // 实时检测视口尺寸变动（平滑展开/折叠或拖动过程），动态更新绘图缓冲区消除形变拉伸
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          (Math.abs(rect.width - this.width) > 0.5 || Math.abs(rect.height - this.height) > 0.5)) {
        this.resize();
      }

      this.update(now);
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  update(now) {
    if (this.autoRotate && !this.isDragging) {
      this.targetRotY += this.autoRotateSpeed;
    }

    this.rotX += (this.targetRotX - this.rotX) * 0.14;
    this.rotY += (this.targetRotY - this.rotY) * 0.14;
    this.zoom += (this.targetZoom - this.zoom) * 0.16;
    this.panX += (this.targetPanX - this.panX) * 0.16;
    this.panY += (this.targetPanY - this.panY) * 0.16;

    if (this.transitionProgress < 1 && this.nextStepData) {
      const elapsed = now - this.transitionStartTime;
      const rawProgress = Math.min(1, elapsed / this.transitionDuration);
      // 三次平滑缓动
      this.transitionProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);

      if (rawProgress >= 1) {
        this.currentStepData = this.nextStepData;
        this.nextStepData = null;
        this.transitionProgress = 1;
      }
    }
  }

  rotatePoint(p) {
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = p.x * cosY + p.z * sinY;
    const y1 = p.y;
    const z1 = -p.x * sinY + p.z * cosY;

    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    return { x: x2, y: y2, z: z2 };
  }

  /**
   * 自动机理化学推断：针对未显式声明自由基/电荷的原子，依据成键数与共价价态自动推算
   */
  enrichAtomsRadicalAndCharge(atoms, bonds) {
    if (!atoms || !bonds) return;
    const bondCounts = new Map();
    bonds.forEach(b => {
      const ord = b.order || 1;
      const id1 = b.atom1Id || b.atom1;
      const id2 = b.atom2Id || b.atom2;
      if (id1) bondCounts.set(id1, (bondCounts.get(id1) || 0) + ord);
      if (id2) bondCounts.set(id2, (bondCounts.get(id2) || 0) + ord);
    });

    const STANDARD_VALENCE = { H: 1, C: 4, N: 3, O: 2, Cl: 1, Br: 1, I: 1, F: 1 };

    atoms.forEach(a => {
      if (a.radical === undefined && a.charge === undefined) {
        const actual = bondCounts.get(a.id) || 0;
        const std = STANDARD_VALENCE[a.element];
        if (std !== undefined && actual !== std) {
          const diff = actual - std;
          if (a.element === 'O') {
            if (diff === -1) a.charge = -1;
            else if (diff === 1) a.charge = 1;
          } else if (a.element === 'N') {
            if (diff === 1) a.charge = 1;
            else if (diff === -1) a.radical = true;
          } else if (a.element === 'C' && diff === -1) {
            a.radical = true;
          } else if (['Cl', 'Br', 'I', 'F'].includes(a.element) && actual === 0) {
            a.radical = true;
          }
        }
      }
    });
  }

  /**
   * 核心机理计算：插值原子与化学键集合
   * 具备“断裂从中间断开”与“同元素加键时键迁移重组合成”判定
   */
  getInterpolatedScene() {
    if (!this.currentStepData) return { atoms: [], bonds: [] };

    // 静止态（无过渡）
    if (this.transitionProgress >= 1 || !this.nextStepData) {
      const atoms = this.currentStepData.atoms.map(a => ({ ...a, opacity: 1, scale: 1 }));
      this.enrichAtomsRadicalAndCharge(atoms, this.currentStepData.bonds);
      return {
        atoms,
        bonds: this.currentStepData.bonds.map(b => ({ ...b, opacity: 1, isStandard: true }))
      };
    }

    const t = this.transitionProgress;
    const curAtoms = this.currentStepData.atoms;
    const nxtAtoms = this.nextStepData.atoms;
    const curMap = new Map(curAtoms.map(a => [a.id, a]));
    const nxtMap = new Map(nxtAtoms.map(a => [a.id, a]));

    const allIds = new Set([...curMap.keys(), ...nxtMap.keys()]);
    const interpolatedAtoms = [];

    allIds.forEach(id => {
      const cur = curMap.get(id);
      const nxt = nxtMap.get(id);

      if (cur && nxt) {
        interpolatedAtoms.push({
          id,
          element: nxt.element || cur.element,
          x: cur.x + (nxt.x - cur.x) * t,
          y: cur.y + (nxt.y - cur.y) * t,
          z: cur.z + (nxt.z - cur.z) * t,
          radical: t < 0.5 ? cur.radical : nxt.radical,
          charge: t < 0.5 ? cur.charge : nxt.charge,
          opacity: 1,
          scale: 1
        });
      } else if (cur && !nxt) {
        // 平滑渐隐消退：自 1 平滑下降至 0，二次平滑缓动，杜绝提前截断与突变
        const fadeOut = Math.max(0, 1 - t);
        const smoothFade = fadeOut * fadeOut;
        interpolatedAtoms.push({
          id,
          element: cur.element,
          x: cur.x + (cur.x * 0.15) * t,
          y: cur.y + (cur.y * 0.15) * t,
          z: cur.z + (cur.z * 0.15) * t,
          radical: cur.radical,
          charge: cur.charge,
          opacity: smoothFade,
          scale: Math.max(0.08, 1 - t * 0.5)
        });
      } else if (!cur && nxt) {
        // 平滑渐现进入：自 0 平滑上升至 1
        const fadeIn = Math.min(1, Math.max(0, t));
        const smoothIn = fadeIn * (2 - fadeIn);
        interpolatedAtoms.push({
          id,
          element: nxt.element,
          x: nxt.x * (0.88 + 0.12 * t),
          y: nxt.y * (0.88 + 0.12 * t),
          z: nxt.z * (0.88 + 0.12 * t),
          radical: nxt.radical,
          charge: nxt.charge,
          opacity: smoothIn,
          scale: Math.min(1, 0.4 + 0.6 * t)
        });
      }
    });

    this.enrichAtomsRadicalAndCharge(interpolatedAtoms, t < 0.5 ? this.currentStepData.bonds : this.nextStepData.bonds);

    // 化学键拓扑分析与匹配
    const curBonds = this.currentStepData.bonds;
    const nxtBonds = this.nextStepData.bonds;
    const makeKey = (id1, id2) => (id1 < id2 ? `${id1}--${id2}` : `${id2}--${id1}`);

    const curBondMap = new Map();
    curBonds.forEach(b => curBondMap.set(makeKey(b.atom1Id, b.atom2Id), b));

    const nxtBondMap = new Map();
    nxtBonds.forEach(b => nxtBondMap.set(makeKey(b.atom1Id, b.atom2Id), b));

    // 1. 识别断裂键（当前有、下一步无，或键级减少）
    const breakingBonds = [];
    curBonds.forEach(b => {
      const k = makeKey(b.atom1Id, b.atom2Id);
      const nb = nxtBondMap.get(k);
      if (!nb) {
        breakingBonds.push({ atom1Id: b.atom1Id, atom2Id: b.atom2Id, order: b.order || 1 });
      } else if ((b.order || 1) > (nb.order || 1)) {
        breakingBonds.push({ atom1Id: b.atom1Id, atom2Id: b.atom2Id, order: (b.order || 1) - (nb.order || 1) });
      }
    });

    // 2. 识别生成键（当前无、下一步有，或键级增加）
    const formingBonds = [];
    nxtBonds.forEach(b => {
      const k = makeKey(b.atom1Id, b.atom2Id);
      const cb = curBondMap.get(k);
      if (!cb) {
        formingBonds.push({ atom1Id: b.atom1Id, atom2Id: b.atom2Id, order: b.order || 1 });
      } else if ((b.order || 1) > (cb.order || 1)) {
        formingBonds.push({ atom1Id: b.atom1Id, atom2Id: b.atom2Id, order: (b.order || 1) - (cb.order || 1) });
      }
    });

    // 3. 核心创新点：元素加键迁移匹配 (Bond Migration Matching)
    // 若断键 (A-B) 与加键 (C-D) 共享某个元素（如 A==C），则断裂的键将从 B 脱开，平滑移动至 D 处合成！
    const migratingBonds = [];
    const usedBreaking = new Set();
    const usedForming = new Set();

    for (let bi = 0; bi < breakingBonds.length; bi++) {
      const brk = breakingBonds[bi];
      for (let fi = 0; fi < formingBonds.length; fi++) {
        if (usedForming.has(fi)) continue;
        const form = formingBonds[fi];

        let anchor = null, from = null, to = null;

        if (brk.atom1Id === form.atom1Id) {
          anchor = brk.atom1Id; from = brk.atom2Id; to = form.atom2Id;
        } else if (brk.atom1Id === form.atom2Id) {
          anchor = brk.atom1Id; from = brk.atom2Id; to = form.atom1Id;
        } else if (brk.atom2Id === form.atom1Id) {
          anchor = brk.atom2Id; from = brk.atom1Id; to = form.atom2Id;
        } else if (brk.atom2Id === form.atom2Id) {
          anchor = brk.atom2Id; from = brk.atom1Id; to = form.atom1Id;
        }

        if (anchor && from && to && from !== to) {
          migratingBonds.push({
            isMigrating: true,
            anchorId: anchor,
            fromId: from,
            toId: to,
            order: 1
          });
          usedBreaking.add(bi);
          usedForming.add(fi);
          break;
        }
      }
    }

    // 4. 无迁移配对的断键：严格从中间断开并向两侧回缩
    const centerBreakingBonds = breakingBonds
      .filter((_, idx) => !usedBreaking.has(idx))
      .map(b => ({ ...b, isBreaking: true, splitCenter: true }));

    // 5. 无迁移配对的加键：由两侧向中间生长相遇合成
    const centerFormingBonds = formingBonds
      .filter((_, idx) => !usedForming.has(idx))
      .map(b => ({ ...b, isForming: true, growCenter: true }));

    // 6. 持续存在的稳定骨架键
    const persistentBonds = [];
    nxtBonds.forEach(nb => {
      const k = makeKey(nb.atom1Id, nb.atom2Id);
      const cb = curBondMap.get(k);
      if (cb) {
        persistentBonds.push({
          ...nb,
          order: Math.min(cb.order || 1, nb.order || 1),
          isStandard: true,
          opacity: 1
        });
      }
    });

    const combinedBonds = [
      ...persistentBonds,
      ...centerBreakingBonds,
      ...migratingBonds,
      ...centerFormingBonds
    ];

    return { atoms: interpolatedAtoms, bonds: combinedBonds };
  }

  render() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;

    ctx.fillStyle = this.palette.bg;
    ctx.fillRect(0, 0, width, height);

    this.renderGrid(ctx, width, height);

    const { atoms, bonds } = this.getInterpolatedScene();
    if (atoms.length === 0) return;

    const centerX = width * 0.5 + this.panX;
    const centerY = height * 0.5 + this.panY;

    let minZ = Infinity, maxZ = -Infinity;
    const projectedAtoms = atoms.map(atom => {
      const rot = this.rotatePoint(atom);
      if (rot.z < minZ) minZ = rot.z;
      if (rot.z > maxZ) maxZ = rot.z;
      return {
        ...atom,
        rot,
        sx: centerX + rot.x * this.zoom,
        sy: centerY - rot.y * this.zoom,
        sz: rot.z
      };
    });

    const zRange = Math.max(0.1, maxZ - minZ);
    const atomMap = new Map();

    projectedAtoms.forEach(atom => {
      const depthFactor = (atom.sz - minZ) / zRange;
      atom.depthFactor = depthFactor;

      const baseFontSize = 18 + depthFactor * 16;
      atom.fontSize = Math.max(12, Math.round(baseFontSize * (atom.scale || 1)));

      const r = Math.round(this.palette.atomBack.r + (this.palette.atomFront.r - this.palette.atomBack.r) * depthFactor);
      const g = Math.round(this.palette.atomBack.g + (this.palette.atomFront.g - this.palette.atomBack.g) * depthFactor);
      const b = Math.round(this.palette.atomBack.b + (this.palette.atomFront.b - this.palette.atomBack.b) * depthFactor);
      const atomOpacity = typeof atom.opacity === 'number' ? Math.max(0, Math.min(1, atom.opacity)) : 1;
      atom.opacity = atomOpacity;
      atom.color = `rgba(${r}, ${g}, ${b}, ${atomOpacity})`;
      atom.rgb = { r, g, b };
      atom.clipRadius = Math.max(7, atom.fontSize * 0.44);

      atomMap.set(atom.id, atom);
    });

    // 组装待绘制的键
    const renderableBonds = bonds.map(bond => {
      if (bond.isMigrating) {
        const anchor = atomMap.get(bond.anchorId);
        const fromAtom = atomMap.get(bond.fromId);
        const toAtom = atomMap.get(bond.toId);
        if (!anchor || !fromAtom || !toAtom) return null;
        const avgZ = (anchor.sz + fromAtom.sz + toAtom.sz) / 3;
        const avgDepth = (anchor.depthFactor + fromAtom.depthFactor + toAtom.depthFactor) / 3;
        return {
          bond,
          anchor,
          fromAtom,
          toAtom,
          avgZ,
          avgDepth,
          type: 'migrating'
        };
      }

      const a1 = atomMap.get(bond.atom1Id);
      const a2 = atomMap.get(bond.atom2Id);
      if (!a1 || !a2) return null;

      const avgDepth = (a1.depthFactor + a2.depthFactor) * 0.5;
      const avgZ = (a1.sz + a2.sz) * 0.5;

      return {
        bond,
        a1,
        a2,
        avgDepth,
        avgZ,
        type: bond.isBreaking ? 'center_break' : (bond.isForming ? 'center_form' : 'standard')
      };
    }).filter(Boolean);

    // 画家算法排序
    const renderQueue = [];

    renderableBonds.forEach(item => {
      renderQueue.push({ type: 'bond', z: item.avgZ, data: item });
    });

    projectedAtoms.forEach(atom => {
      renderQueue.push({ type: 'atom', z: atom.sz, data: atom });
    });

    renderQueue.sort((a, b) => a.z - b.z);

    // 绘制全部元素与化学键
    renderQueue.forEach(item => {
      if (item.type === 'bond') {
        const b = item.data;
        if (b.type === 'migrating') {
          this.renderMigratingBond(ctx, b);
        } else if (b.type === 'center_break') {
          this.renderCenterBreakingBond(ctx, b);
        } else if (b.type === 'center_form') {
          this.renderCenterFormingBond(ctx, b);
        } else {
          this.renderStandardBond(ctx, b);
        }
      } else {
        this.renderAtom(ctx, item.data);
      }
    });

    // 绘制高分子聚合物 []n 大括号组件
    this.renderPolymerBrackets(ctx, projectedAtoms);

    if (this.hoveredAtom) {
      this.renderHoverTooltip(ctx, this.hoveredAtom);
    }
  }

  renderGrid(ctx, width, height) {
    const step = 48;
    ctx.save();
    ctx.strokeStyle = this.palette.bgGrid;
    ctx.lineWidth = 1;

    const offsetX = (width * 0.5 + this.panX) % step;
    const offsetY = (height * 0.5 + this.panY) % step;

    ctx.beginPath();
    for (let x = offsetX; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 1. 核心动画优化：断裂从中间断开并向两端收缩
   */
  renderCenterBreakingBond(ctx, { a1, a2, avgDepth }) {
    const dx = a2.sx - a1.sx;
    const dy = a2.sy - a1.sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const ux = dx / dist;
    const uy = dy / dist;

    const startX = a1.sx + ux * a1.clipRadius;
    const startY = a1.sy + uy * a1.clipRadius;
    const endX = a2.sx - ux * a2.clipRadius;
    const endY = a2.sy - uy * a2.clipRadius;

    const len = Math.hypot(endX - startX, endY - startY);
    if (len <= 2) return;

    const midX = (startX + endX) * 0.5;
    const midY = (startY + endY) * 0.5;
    const halfLen = len * 0.5;

    const t = this.transitionProgress;
    // 中间断裂开裂缝进展：自 0 扩大至 1
    const gapRatio = Math.min(1, t * 1.35);
    const gapSmooth = gapRatio * gapRatio * (3 - 2 * gapRatio);
    const gap = halfLen * gapSmooth;
    const currentHalf = halfLen - gap;
    const alpha = Math.max(0, 1 - t * 1.25);

    if (currentHalf <= 0.5 || alpha <= 0.02) return;

    const baseWidth = Math.max(1.2, 1.4 + avgDepth * 2.2);

    ctx.save();
    ctx.lineCap = 'round';

    // 绘制段1：从 a1 边缘延伸至断开点 (mid - gap)
    const tip1X = midX - ux * gap;
    const tip1Y = midY - uy * gap;
    const grad1 = ctx.createLinearGradient(startX, startY, tip1X, tip1Y);
    grad1.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, ${alpha})`);
    grad1.addColorStop(1, `rgba(215, 75, 35, ${alpha * 0.95})`);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(tip1X, tip1Y);
    ctx.strokeStyle = grad1;
    ctx.lineWidth = baseWidth;
    ctx.stroke();

    // 段1断裂断口能量辉光
    ctx.beginPath();
    ctx.arc(tip1X, tip1Y, Math.max(1.5, 2.6 * (1 - t)), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 110, 45, ${alpha})`;
    ctx.fill();

    // 绘制段2：从 a2 边缘延伸至断开点 (mid + gap)
    const tip2X = midX + ux * gap;
    const tip2Y = midY + uy * gap;
    const grad2 = ctx.createLinearGradient(endX, endY, tip2X, tip2Y);
    grad2.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, ${alpha})`);
    grad2.addColorStop(1, `rgba(215, 75, 35, ${alpha * 0.95})`);

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(tip2X, tip2Y);
    ctx.strokeStyle = grad2;
    ctx.lineWidth = baseWidth;
    ctx.stroke();

    // 段2断裂断口能量辉光
    ctx.beginPath();
    ctx.arc(tip2X, tip2Y, Math.max(1.5, 2.6 * (1 - t)), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 110, 45, ${alpha})`;
    ctx.fill();

    ctx.restore();
  }

  /**
   * 2. 核心动画优化：断裂的键移动到新加键位置上合成 (Bond Migration & Synthesis)
   */
  renderMigratingBond(ctx, { anchor, fromAtom, toAtom, avgDepth }) {
    const ax = anchor.sx;
    const ay = anchor.sy;
    const fx = fromAtom.sx;
    const fy = fromAtom.sy;
    const tx = toAtom.sx;
    const ty = toAtom.sy;

    // 起始与终点端点停靠位置
    const vfx = fx - ax, vfy = fy - ay, distF = Math.hypot(vfx, vfy) || 1;
    const srcX = fx - (vfx / distF) * fromAtom.clipRadius;
    const srcY = fy - (vfy / distF) * fromAtom.clipRadius;

    const vtx = tx - ax, vty = ty - ay, distT = Math.hypot(vtx, vty) || 1;
    const dstX = tx - (vtx / distT) * toAtom.clipRadius;
    const dstY = ty - (vty / distT) * toAtom.clipRadius;

    const t = this.transitionProgress;
    // 迁移时序曲线 (0.05 ~ 0.9)
    const p = Math.min(1, Math.max(0, (t - 0.05) / 0.85));
    const smoothP = p * p * (3 - 2 * p);

    // 自由末端沿弧线平滑摆动位移
    const baseTipX = (1 - smoothP) * srcX + smoothP * dstX;
    const baseTipY = (1 - smoothP) * srcY + smoothP * dstY;

    // 施加垂直远离 anchor 的柔和三维弧线高度
    const outX = baseTipX - ax;
    const outY = baseTipY - ay;
    const outDist = Math.hypot(outX, outY) || 1;
    const arcHeight = Math.sin(smoothP * Math.PI) * Math.min(28, outDist * 0.28);
    const curTipX = baseTipX + (outX / outDist) * arcHeight;
    const curTipY = baseTipY + (outY / outDist) * arcHeight;

    // 锚点出线位置
    const toTipX = curTipX - ax;
    const toTipY = curTipY - ay;
    const toTipDist = Math.hypot(toTipX, toTipY) || 1;
    const startX = ax + (toTipX / toTipDist) * anchor.clipRadius;
    const startY = ay + (toTipY / toTipDist) * anchor.clipRadius;

    const baseWidth = Math.max(1.6, (1.4 + avgDepth * 2.2) * 1.15);

    ctx.save();
    ctx.lineCap = 'round';

    // 绘制移动中的化学键
    const grad = ctx.createLinearGradient(startX, startY, curTipX, curTipY);
    grad.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, 0.95)`);
    grad.addColorStop(0.65, 'rgba(215, 115, 35, 0.95)');
    grad.addColorStop(1, 'rgba(245, 180, 55, 1)'); // 活跃金黄色移动端头

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(curTipX, curTipY);
    ctx.strokeStyle = grad;
    ctx.lineWidth = baseWidth;
    ctx.stroke();

    // 移动前端的电子对高能光珠
    ctx.beginPath();
    ctx.arc(curTipX, curTipY, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFC837';
    ctx.shadowColor = 'rgba(240, 150, 40, 0.55)';
    ctx.shadowBlur = 6;
    ctx.fill();

    // 到达目标位点时的结合脉冲
    if (t > 0.78) {
      const lockP = (t - 0.78) / 0.22;
      ctx.beginPath();
      ctx.arc(dstX, dstY, 3 + lockP * 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(220, 125, 35, ${1 - lockP})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 3. 独立生成键：由两侧原子向中间延伸相遇并锁合成键
   */
  renderCenterFormingBond(ctx, { a1, a2, avgDepth }) {
    const dx = a2.sx - a1.sx;
    const dy = a2.sy - a1.sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const ux = dx / dist;
    const uy = dy / dist;

    const startX = a1.sx + ux * a1.clipRadius;
    const startY = a1.sy + uy * a1.clipRadius;
    const endX = a2.sx - ux * a2.clipRadius;
    const endY = a2.sy - uy * a2.clipRadius;

    const len = Math.hypot(endX - startX, endY - startY);
    if (len <= 2) return;

    const halfLen = len * 0.5;
    const t = this.transitionProgress;

    // 生长比例 (0 -> 1)
    const growRatio = Math.min(1, t * 1.3);
    const growSmooth = growRatio * growRatio * (3 - 2 * growRatio);
    const curHalf = halfLen * growSmooth;

    const baseWidth = Math.max(1.4, 1.4 + avgDepth * 2.2);

    ctx.save();
    ctx.lineCap = 'round';

    const tip1X = startX + ux * curHalf;
    const tip1Y = startY + uy * curHalf;
    const tip2X = endX - ux * curHalf;
    const tip2Y = endY - uy * curHalf;

    if (growSmooth < 0.98) {
      // 双方各自向中心生长
      const grad1 = ctx.createLinearGradient(startX, startY, tip1X, tip1Y);
      grad1.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, 0.9)`);
      grad1.addColorStop(1, 'rgba(235, 145, 55, 1)');

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(tip1X, tip1Y);
      ctx.strokeStyle = grad1;
      ctx.lineWidth = baseWidth;
      ctx.stroke();

      const grad2 = ctx.createLinearGradient(endX, endY, tip2X, tip2Y);
      grad2.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, 0.9)`);
      grad2.addColorStop(1, 'rgba(235, 145, 55, 1)');

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(tip2X, tip2Y);
      ctx.strokeStyle = grad2;
      ctx.lineWidth = baseWidth;
      ctx.stroke();
    } else {
      // 在中间汇合锁死成键
      const grad = ctx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, 0.95)`);
      grad.addColorStop(0.5, 'rgba(235, 145, 55, 1)');
      grad.addColorStop(1, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, 0.95)`);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 4. 稳态标准化学键绘制：双向深度线性渐变
   */
  renderStandardBond(ctx, { bond, a1, a2, avgDepth }) {
    const dx = a2.sx - a1.sx;
    const dy = a2.sy - a1.sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const ux = dx / dist;
    const uy = dy / dist;

    const startX = a1.sx + ux * a1.clipRadius;
    const startY = a1.sy + uy * a1.clipRadius;
    const endX = a2.sx - ux * a2.clipRadius;
    const endY = a2.sy - uy * a2.clipRadius;

    const rStart = Math.round(this.palette.bondBack.r + (this.palette.bondFront.r - this.palette.bondBack.r) * a1.depthFactor);
    const gStart = Math.round(this.palette.bondBack.g + (this.palette.bondFront.g - this.palette.bondBack.g) * a1.depthFactor);
    const bStart = Math.round(this.palette.bondBack.b + (this.palette.bondFront.b - this.palette.bondBack.b) * a1.depthFactor);

    const rEnd = Math.round(this.palette.bondBack.r + (this.palette.bondFront.r - this.palette.bondBack.r) * a2.depthFactor);
    const gEnd = Math.round(this.palette.bondBack.g + (this.palette.bondFront.g - this.palette.bondBack.g) * a2.depthFactor);
    const bEnd = Math.round(this.palette.bondBack.b + (this.palette.bondFront.b - this.palette.bondBack.b) * a2.depthFactor);

    const baseWidth = 1.4 + avgDepth * 2.2;
    const grad = ctx.createLinearGradient(startX, startY, endX, endY);
    grad.addColorStop(0, `rgba(${rStart}, ${gStart}, ${bStart}, 0.92)`);
    grad.addColorStop(1, `rgba(${rEnd}, ${gEnd}, ${bEnd}, 0.92)`);

    const nx = -uy;
    const ny = ux;
    const order = Math.round(bond.order || 1);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = grad;
    ctx.lineWidth = baseWidth;

    if (order === 1) {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else if (order === 2) {
      const offset = Math.max(3.2, 2.5 + avgDepth * 2.8);
      ctx.beginPath();
      ctx.moveTo(startX + nx * offset, startY + ny * offset);
      ctx.lineTo(endX + nx * offset, endY + ny * offset);
      ctx.moveTo(startX - nx * offset, startY - ny * offset);
      ctx.lineTo(endX - nx * offset, endY - ny * offset);
      ctx.stroke();
    } else if (order === 3) {
      const offset = Math.max(3.8, 3.2 + avgDepth * 3.2);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.moveTo(startX + nx * offset, startY + ny * offset);
      ctx.lineTo(endX + nx * offset, endY + ny * offset);
      ctx.moveTo(startX - nx * offset, startY - ny * offset);
      ctx.lineTo(endX - nx * offset, endY - ny * offset);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderAtom(ctx, atom) {
    const opacity = typeof atom.opacity === 'number' ? atom.opacity : 1;
    if (opacity <= 0.005) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    ctx.font = `700 ${atom.fontSize}px 'Century Gothic', CenturyGothic, AppleGothic, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 关键优化：沿着字母外轮廓勾勒一圈底色，完全消除圆球衬底感，同时防止化学键穿透字形
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(3.5, atom.fontSize * 0.28);
    ctx.strokeStyle = this.palette.maskBg;
    ctx.strokeText(atom.element, atom.sx, atom.sy);

    const isHovered = this.hoveredAtom && this.hoveredAtom.id === atom.id;
    if (isHovered) {
      ctx.save();
      ctx.shadowColor = 'rgba(184, 74, 40, 0.65)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = this.palette.highlight;
      ctx.lineWidth = Math.max(1.8, atom.fontSize * 0.12);
      ctx.strokeText(atom.element, atom.sx, atom.sy);
      ctx.restore();
    }

    ctx.fillStyle = atom.color;
    ctx.fillText(atom.element, atom.sx, atom.sy);

    // ==========================================
    // 自由基实心圆点 (·) 与 形式电荷圈加圈减 (⊕ / ⊖) 规范排印
    // ==========================================
    const textMetrics = ctx.measureText(atom.element);
    const halfWidth = textMetrics.width * 0.5;
    let badgeOffsetX = halfWidth + Math.max(2, atom.fontSize * 0.08);

    // 1. 自由基单电子实心圆点 (Radical Dot: ·)
    if (atom.radical) {
      const dotR = Math.max(2.4, atom.fontSize * 0.11);
      const dotX = atom.sx + badgeOffsetX + dotR;
      const dotY = atom.sy - atom.fontSize * 0.35;

      // 底色遮罩环，防止键线穿透字形
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR + 1.2, 0, Math.PI * 2);
      ctx.fillStyle = this.palette.maskBg;
      ctx.fill();

      // 实心自由基圆点 (反应活性中心赭红)
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#B84A28';
      ctx.fill();

      badgeOffsetX += dotR * 2 + 4;
    }

    // 2. 形式电荷圈加/圈减 (Formal Charge: ⊕ / ⊖)
    if (typeof atom.charge === 'number' && atom.charge !== 0) {
      const isPos = atom.charge > 0;
      const chargeR = Math.max(5.5, atom.fontSize * 0.24);
      const chargeX = atom.sx + badgeOffsetX + chargeR;
      const chargeY = atom.sy - atom.fontSize * 0.36;
      const chargeColor = isPos ? '#B84A28' : '#382215';

      // 宣纸底色圆盘遮罩
      ctx.beginPath();
      ctx.arc(chargeX, chargeY, chargeR, 0, Math.PI * 2);
      ctx.fillStyle = this.palette.maskBg;
      ctx.fill();

      // 外描边圆圈
      ctx.lineWidth = Math.max(1.1, atom.fontSize * 0.05);
      ctx.strokeStyle = chargeColor;
      ctx.stroke();

      // 正负号符号 (使用加粗，负号用数学减号 '\u2212')
      const symbol = isPos ? '+' : '\u2212';
      ctx.font = `700 ${Math.max(8, atom.fontSize * 0.34)}px sans-serif`;
      ctx.fillStyle = chargeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, chargeX, chargeY + (isPos ? 0.5 : -0.2));
    }

    ctx.restore();
  }

  checkHover(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const { atoms } = this.getInterpolatedScene();
    let found = null;
    let closestDist = Infinity;

    const centerX = this.width * 0.5 + this.panX;
    const centerY = this.height * 0.5 + this.panY;

    atoms.forEach(atom => {
      if ((atom.opacity !== undefined && atom.opacity <= 0.05) || (atom.scale && atom.scale < 0.2)) {
        return;
      }
      const rot = this.rotatePoint(atom);
      const sx = centerX + rot.x * this.zoom;
      const sy = centerY - rot.y * this.zoom;
      const dist = Math.hypot(mx - sx, my - sy);
      const hitRadius = (atom.fontSize || 24) * 0.9;

      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        found = { ...atom, sx, sy, sz: rot.z };
      }
    });

    this.hoveredAtom = found;
    this.canvas.style.cursor = this.isDragging ? 'grabbing' : (found ? 'pointer' : 'grab');
  }

  renderHoverTooltip(ctx, atom) {
    ctx.save();
    let statusText = '';
    if (atom.radical) statusText += ' · 自由基单电子 (·)';
    if (typeof atom.charge === 'number' && atom.charge !== 0) {
      statusText += ` · 形式电荷: ${atom.charge > 0 ? '+' + atom.charge : atom.charge}`;
    }
    const text = `${atom.element} (${atom.id})${statusText} · 空间深度 Z: ${atom.sz.toFixed(2)}`;
    ctx.font = '12px "Century Gothic", CenturyGothic, AppleGothic, sans-serif';
    const textMetrics = ctx.measureText(text);
    const boxW = textMetrics.width + 20;
    const boxH = 26;
    const boxX = atom.sx - boxW * 0.5;
    const boxY = atom.sy - atom.clipRadius - boxH - 6;

    ctx.fillStyle = 'rgba(46, 27, 15, 0.92)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();

    ctx.fillStyle = '#FAF6E9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, atom.sx, boxY + boxH * 0.5);
    ctx.restore();
  }

  /**
   * 高分子聚合物 []n 酷炫化学大括号组件
   * 根据聚合物重复单元原子空间投影坐标动态框选并附带聚合度下标 n 与延长虚键
   */
  renderPolymerBrackets(ctx, projectedAtoms) {
    if (!projectedAtoms || projectedAtoms.length === 0) return;

    const getStepPolymer = step => {
      if (!step) return null;
      if (step.polymer) return step.polymer;
      if (step.isPolymer) return { label: 'n', tag: '高分子聚合物单元 · []ₙ' };
      if (step.name && (step.name.includes('淀粉') || step.name.includes('聚合') || step.name.includes('聚合物'))) {
        return {
          label: 'n',
          tag: '直链淀粉聚合单元 · [C₆H₁₀O₅]ₙ',
          excludeIds: ['Ow', 'Hw1', 'Hw2']
        };
      }
      return null;
    };

    const curPolymer = getStepPolymer(this.currentStepData);
    const nxtPolymer = getStepPolymer(this.nextStepData);

    let bracketOpacity = 0;
    let activeConfig = null;

    if (this.transitionProgress >= 1 || !this.nextStepData) {
      if (!curPolymer) return;
      bracketOpacity = 1;
      activeConfig = curPolymer;
    } else {
      if (curPolymer && nxtPolymer) {
        bracketOpacity = 1;
        activeConfig = nxtPolymer;
      } else if (curPolymer && !nxtPolymer) {
        bracketOpacity = Math.max(0, 1 - this.transitionProgress);
        activeConfig = curPolymer;
      } else if (!curPolymer && nxtPolymer) {
        bracketOpacity = Math.min(1, this.transitionProgress);
        activeConfig = nxtPolymer;
      } else {
        return;
      }
    }

    if (bracketOpacity <= 0.01 || !activeConfig) return;

    const excludeSet = new Set(activeConfig.excludeIds || []);
    const polymerAtoms = projectedAtoms.filter(a => {
      if (excludeSet.has(a.id)) return false;
      if (activeConfig.atomIds && activeConfig.atomIds.length > 0) {
        return activeConfig.atomIds.includes(a.id);
      }
      if (a.opacity !== undefined && a.opacity <= 0.08) return false;
      return true;
    });

    if (polymerAtoms.length < 2) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let avgDepth = 0;
    polymerAtoms.forEach(a => {
      if (a.sx < minX) minX = a.sx;
      if (a.sx > maxX) maxX = a.sx;
      if (a.sy < minY) minY = a.sy;
      if (a.sy > maxY) maxY = a.sy;
      avgDepth += (a.depthFactor !== undefined ? a.depthFactor : 0.5);
    });
    avgDepth /= polymerAtoms.length;

    // 留白边距自适应缩放
    const padX = Math.max(22, 26 * (this.zoom / 42));
    const padY = Math.max(20, 24 * (this.zoom / 42));
    const leftX = minX - padX;
    const rightX = maxX + padX;
    const topY = minY - padY;
    const bottomY = maxY + padY;
    const boxHeight = bottomY - topY;
    const capLen = Math.min(26, Math.max(14, boxHeight * 0.1));

    ctx.save();

    // 1. 微光聚合物保护区背景 (极淡暖色)
    ctx.fillStyle = `rgba(184, 74, 40, ${0.02 * bracketOpacity})`;
    ctx.beginPath();
    ctx.rect(leftX, topY, rightX - leftX, boxHeight);
    ctx.fill();

    // 2. 左括号 [
    const bracketColor = `rgba(184, 74, 40, ${0.9 * bracketOpacity})`;
    const lineWidth = Math.max(2.0, 2.0 + avgDepth * 1.2);
    ctx.strokeStyle = bracketColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    ctx.beginPath();
    ctx.moveTo(leftX + capLen, topY);
    ctx.lineTo(leftX, topY);
    ctx.lineTo(leftX, bottomY);
    ctx.lineTo(leftX + capLen, bottomY);
    ctx.stroke();

    // 3. 右括号 ]
    ctx.beginPath();
    ctx.moveTo(rightX - capLen, topY);
    ctx.lineTo(rightX, topY);
    ctx.lineTo(rightX, bottomY);
    ctx.lineTo(rightX - capLen, bottomY);
    ctx.stroke();

    // 4. 聚合化学键直接穿透大括号伸出 (Polymerization chemical bonds extending directly through brackets)
    const centerX = this.width * 0.5 + this.panX;
    const centerY = this.height * 0.5 + this.panY;

    // 4.1 提取/自动识别左右两端参与聚合的原子与伸出方向向量
    let leftConfig = activeConfig.leftBond || activeConfig.leftTerminal;
    let rightConfig = activeConfig.rightBond || activeConfig.rightTerminal;

    // 默认/智能备选：按原子 ID 或 空间极值查找
    if (!leftConfig) {
      const candidateO4 = polymerAtoms.find(a => a.id === 'O4A' || a.id === 'O4' || a.id === 'Ob_left');
      if (candidateO4) {
        leftConfig = { atomId: candidateO4.id, vector: [-1.3, 0.1, 0] };
      }
    }

    if (!rightConfig) {
      const candidateC1 = polymerAtoms.find(a => a.id === 'C1B' || a.id === 'C1' || a.id === 'Cb_right');
      if (candidateC1) {
        rightConfig = { atomId: candidateC1.id, vector: [1.3, -0.6, 0.1] };
      }
    }

    // 收集所有已配置的聚合端点
    const rawConfigs = [leftConfig, rightConfig].filter(cfg => cfg && cfg.atomId);

    // 若无配置，智能降级：取当前屏幕坐标系最左与最右原子
    if (rawConfigs.length === 0 && polymerAtoms.length >= 2) {
      const sortedByX = [...polymerAtoms].sort((a, b) => a.sx - b.sx);
      rawConfigs.push(
        { atomId: sortedByX[0].id, vector: [-1.3, 0, 0] },
        { atomId: sortedByX[sortedByX.length - 1].id, vector: [1.3, 0, 0] }
      );
    }

    // 关联投影后的实际原子对象
    const terminalItems = rawConfigs.map(cfg => {
      const atom = projectedAtoms.find(a => a.id === cfg.atomId);
      return atom ? { config: cfg, atom } : null;
    }).filter(Boolean);

    // 🌟 核心改进：动态视差自适应与“左右就近延伸”
    // 视角在三维空间中旋转时，参与聚合的两个端点在屏幕上的投影 X 坐标 (sx) 会发生互换或偏移。
    // 按当前投影屏幕的 sx 升序排序：sx 较小者必然处于分子左侧，就近穿透左括号 (leftX)；
    // sx 较大者必然处于分子右侧，就近穿透右括号 (rightX)。绝不产生跨越整个分子的交叉错位！
    if (terminalItems.length >= 2) {
      terminalItems.sort((a, b) => a.atom.sx - b.atom.sx);
    }

    const renderExtendingBond = (item, isLeft) => {
      if (!item || !item.atom) return;
      const { config: termConfig, atom } = item;

      // 提取该端点在三维空间中的特征延伸方向向量
      const v3 = termConfig.vector || (isLeft ? [-1.3, 0.1, 0] : [1.3, -0.6, 0.1]);
      const target3D = {
        x: atom.x + v3[0],
        y: atom.y + v3[1],
        z: atom.z + v3[2]
      };
      const rotTarget = this.rotatePoint(target3D);
      const targetSX = centerX + rotTarget.x * this.zoom;
      const targetSY = centerY - rotTarget.y * this.zoom;

      let dx = targetSX - atom.sx;
      let dy = targetSY - atom.sy;

      // 视向就近约束：确保延伸方向必须朝向所分配的大括号一侧（左侧为向左负方向，右侧为向右正方向）
      // 避免视角旋转到侧面或背后时，由于局部键角指向导致连线向内折返
      if (isLeft && dx > -0.15) {
        dx = -Math.max(0.5, Math.abs(dx));
      } else if (!isLeft && dx < 0.15) {
        dx = Math.max(0.5, Math.abs(dx));
      }

      const dirDist = Math.hypot(dx, dy) || 1;
      let ux = dx / dirDist;
      let uy = dy / dirDist;

      const bracketX = isLeft ? leftX : rightX;
      let crossX = bracketX;
      let crossY = atom.sy;

      // 计算射线与大括号垂直骨架线的交点 (t 必然为正，因为 bracketX 与 atom.sx 的相对位置与 ux 符号一致)
      if (Math.abs(ux) > 0.001) {
        const t = (bracketX - atom.sx) / ux;
        if (t > 0) {
          crossY = atom.sy + uy * t;
        }
      }
      // 将穿透交点严格限制在大括号可视高程区间内（留出顶部/底部折角余量）
      crossY = Math.max(topY + 14, Math.min(bottomY - 14, crossY));

      // 根据实际起点与穿透交点重新校准实际方向向量，确保线段平滑精准、毫无折线歧义
      const effDx = crossX - atom.sx;
      const effDy = crossY - atom.sy;
      const effDist = Math.hypot(effDx, effDy) || 1;
      const finalUx = effDx / effDist;
      const finalUy = effDy / effDist;

      const extLen = Math.max(24, 30 * (this.zoom / 42));
      const midExtX = crossX + finalUx * (extLen * 0.52);
      const midExtY = crossY + finalUy * (extLen * 0.52);
      const outerX = crossX + finalUx * extLen;
      const outerY = crossY + finalUy * extLen;

      ctx.save();
      const bondWidth = Math.max(1.8, 2.0 + avgDepth * 1.4);
      ctx.lineWidth = bondWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // (A) 括号内侧段：从聚合原子字符外边缘平滑连接至穿透括号交点 (实线化学键)
      const clip = atom.clipRadius || 10;
      const startX = atom.sx + finalUx * clip;
      const startY = atom.sy + finalUy * clip;

      // 仅当原子在括号内侧时绘制内部连接段
      if ((isLeft && startX > crossX) || (!isLeft && startX < crossX)) {
        const bondGrad = ctx.createLinearGradient(startX, startY, crossX, crossY);
        bondGrad.addColorStop(0, `rgba(${this.palette.bondFront.r}, ${this.palette.bondFront.g}, ${this.palette.bondFront.b}, ${0.95 * bracketOpacity})`);
        bondGrad.addColorStop(1, `rgba(184, 74, 40, ${0.9 * bracketOpacity})`);
        ctx.strokeStyle = bondGrad;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(crossX, crossY);
        ctx.stroke();
      }

      // (B) 穿透括号线处的微型立体锚固节点 (强化化学键穿过大括号的立体视觉)
      ctx.fillStyle = `rgba(184, 74, 40, ${bracketOpacity})`;
      ctx.beginPath();
      ctx.arc(crossX, crossY, bondWidth * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // (C) 伸出括号外侧段：前半段坚挺实线，后半段开链虚线延伸
      // 前半段实线直接伸出括号
      ctx.strokeStyle = `rgba(184, 74, 40, ${0.92 * bracketOpacity})`;
      ctx.beginPath();
      ctx.moveTo(crossX, crossY);
      ctx.lineTo(midExtX, midExtY);
      ctx.stroke();

      // 后半段虚线表示链节无限延伸
      ctx.strokeStyle = `rgba(184, 74, 40, ${0.8 * bracketOpacity})`;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(midExtX, midExtY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // (D) 链端延展提示微点
      ctx.fillStyle = `rgba(184, 74, 40, ${0.9 * bracketOpacity})`;
      ctx.beginPath();
      ctx.arc(outerX, outerY, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    if (terminalItems.length === 1) {
      const isLeft = terminalItems[0].atom.sx < (leftX + rightX) * 0.5;
      renderExtendingBond(terminalItems[0], isLeft);
    } else if (terminalItems.length >= 2) {
      renderExtendingBond(terminalItems[0], true);
      renderExtendingBond(terminalItems[terminalItems.length - 1], false);
    }

    // 5. 聚合度下标 [ ]n 酷炫排印
    const indexLabel = activeConfig.label || 'n';
    const indexFontSize = Math.max(19, Math.round(22 * (0.85 + avgDepth * 0.35)));
    ctx.font = `italic 700 ${indexFontSize}px 'Century Gothic', CenturyGothic, AppleGothic, sans-serif`;
    ctx.fillStyle = `rgba(184, 74, 40, ${bracketOpacity})`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(indexLabel, rightX + 8, bottomY + 4);

    // 6. 顶部微型学术胶囊标签
    if (activeConfig.tag) {
      ctx.font = `700 11.5px 'Century Gothic', CenturyGothic, AppleGothic, sans-serif`;
      const tw = ctx.measureText(activeConfig.tag).width;
      const tagX = (leftX + rightX) * 0.5;
      const tagY = topY - 14;

      ctx.fillStyle = `rgba(250, 246, 233, ${0.94 * bracketOpacity})`;
      ctx.strokeStyle = `rgba(184, 74, 40, ${0.4 * bracketOpacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tagX - tw * 0.5 - 10, tagY - 10, tw + 20, 20, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = `rgba(184, 74, 40, ${bracketOpacity})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeConfig.tag, tagX, tagY);
    }

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pseudo3DRenderer };
}
