/**
 * Chemiation - Pseudo3DRenderer
 * 伪3D 化学分子与反应机理 2D Canvas 渲染引擎
 * 
 * 核心升级：
 * 1. 化学键线性渐变 (Bond Gradients)：化学键自原子1端点向原子2端点根据两端各自的空间深度色阶平滑渐变
 * 2. 多重交互：支持 3D 自由旋转（左键拖动）、画布自由平移（右键/中键/Shift+拖动/平移模式）、滚轮无级缩放
 * 3. 严格 2D Canvas 绘制，纯字母表达元素，无小球，保证极简学术宣纸质感
 * 4. 伪 3D 纵深映射：深度 Z 映射为字体字号 (font-size) 与深棕色阶深浅
 * 5. 键线自动修剪：精准避让字母外轮廓，多重键平行法向偏移
 */

class Pseudo3DRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 视觉色彩配置（淡黄色调与深棕色系）
    this.palette = {
      bg: options.bg || '#FAF6E9',              // 淡黄米宣纸底色
      bgGrid: options.bgGrid || 'rgba(92, 64, 45, 0.04)', // 极简坐标参考网格
      atomFront: options.atomFront || { r: 36, g: 20, b: 11 },   // 前景深棕黑 #24140B
      atomBack: options.atomBack || { r: 168, g: 142, b: 122 },  // 远景淡暖棕 #A88E7A
      bondFront: options.bondFront || { r: 42, g: 25, b: 14 },   // 前景键浓棕
      bondBack: options.bondBack || { r: 182, g: 160, b: 142 },  // 远景键淡棕
      highlight: options.highlight || '#B84A28', // 活性中心暖赭红
      activeBond: options.activeBond || '#C85A17',
      maskBg: options.maskBg || '#FAF6E9'        // 字母遮罩底色
    };

    // 3D 视角与平移参数
    this.rotX = options.rotX !== undefined ? options.rotX : 0.35; // 仰角 (pitch)
    this.rotY = options.rotY !== undefined ? options.rotY : -0.55; // 方位角 (yaw)
    this.targetRotX = this.rotX;
    this.targetRotY = this.rotY;

    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;

    this.zoom = options.zoom || 78;              // 缩放比例 (px / 坐标单位)
    this.targetZoom = this.zoom;
    this.autoRotate = options.autoRotate || false;
    this.autoRotateSpeed = 0.003;

    // 交互模式：'rotate' (旋转) | 'pan' (平移)
    this.toolMode = options.toolMode || 'rotate';

    // 拖拽操作状态
    this.isDragging = false;
    this.dragType = 'rotate'; // 'rotate' | 'pan'
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.hoveredAtom = null;

    // 多点触控捏合手势
    this.touchStartDist = 0;
    this.touchStartZoom = 78;

    // 反应状态与平滑过渡
    this.currentStepData = null; // 当前/起始步骤数据
    this.nextStepData = null;    // 目标步骤数据
    this.transitionProgress = 1; // 0 -> 1 过渡进度 (1 为静止)
    this.transitionDuration = 850; // ms
    this.transitionStartTime = 0;

    // 渲染循环控制
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
    this.ctx.scale(dpr, dpr);
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    // 禁用画布原生右键菜单，便于右键自由平移
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const onPointerDown = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);

      if (e.touches && e.touches.length === 2) {
        // 双指捏合缩放与平移
        this.isDragging = true;
        this.dragType = 'pinch';
        this.touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.touchStartZoom = this.targetZoom;
        this.lastMouseX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        this.lastMouseY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        return;
      }

      this.isDragging = true;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;

      // 判断拖拽行为模式：右键/中键/Shift/Alt 或当前处于平移模式 -> 执行平移；否则执行 3D 旋转
      if (e.button === 2 || e.button === 1 || e.shiftKey || e.altKey || this.toolMode === 'pan') {
        this.dragType = 'pan';
      } else {
        this.dragType = 'rotate';
      }
      this.updateCursor();
    };

    const onPointerMove = (e) => {
      const touches = e.touches;

      if (this.isDragging && touches && touches.length === 2) {
        // 双指手势
        const dist = Math.hypot(
          touches[0].clientX - touches[1].clientX,
          touches[0].clientY - touches[1].clientY
        );
        if (this.touchStartDist > 0) {
          const factor = dist / this.touchStartDist;
          this.targetZoom = Math.max(30, Math.min(220, this.touchStartZoom * factor));
        }

        const midX = (touches[0].clientX + touches[1].clientX) * 0.5;
        const midY = (touches[0].clientY + touches[1].clientY) * 0.5;
        const dx = midX - this.lastMouseX;
        const dy = midY - this.lastMouseY;
        this.targetPanX += dx;
        this.targetPanY += dy;
        this.lastMouseX = midX;
        this.lastMouseY = midY;
        return;
      }

      const clientX = e.clientX || (touches && touches[0].clientX);
      const clientY = e.clientY || (touches && touches[0].clientY);

      if (this.isDragging && clientX !== undefined && clientY !== undefined) {
        const dx = clientX - this.lastMouseX;
        const dy = clientY - this.lastMouseY;

        if (this.dragType === 'pan') {
          // 画布平移拖动
          this.targetPanX += dx;
          this.targetPanY += dy;
        } else {
          // 3D 旋转拖动
          this.targetRotY += dx * 0.008;
          this.targetRotX += dy * 0.008;
          this.targetRotX = Math.max(-1.45, Math.min(1.45, this.targetRotX));
        }

        this.lastMouseX = clientX;
        this.lastMouseY = clientY;
      } else if (e.clientX !== undefined) {
        this.checkHover(e.clientX, e.clientY);
      }
    };

    const onPointerUp = () => {
      this.isDragging = false;
      this.updateCursor();
    };

    this.canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 滚轮无级缩放
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
      this.targetZoom = Math.max(30, Math.min(220, this.targetZoom * zoomFactor));
    }, { passive: false });
  }

  updateCursor() {
    if (this.isDragging) {
      this.canvas.style.cursor = 'grabbing';
    } else if (this.toolMode === 'pan') {
      this.canvas.style.cursor = 'grab';
    } else if (this.hoveredAtom) {
      this.canvas.style.cursor = 'pointer';
    } else {
      this.canvas.style.cursor = 'grab';
    }
  }

  setToolMode(mode) {
    this.toolMode = mode; // 'rotate' | 'pan'
    this.updateCursor();
  }

  zoomIn() {
    this.targetZoom = Math.min(220, this.targetZoom * 1.25);
  }

  zoomOut() {
    this.targetZoom = Math.max(30, this.targetZoom * 0.8);
  }

  setZoom(zoomVal) {
    this.targetZoom = Math.max(30, Math.min(220, zoomVal));
  }

  resetCamera() {
    this.targetRotX = 0.35;
    this.targetRotY = -0.55;
    this.targetZoom = 78;
    this.targetPanX = 0;
    this.targetPanY = 0;
  }

  /**
   * 设定当前推演步骤
   */
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
    // 缓速自转
    if (this.autoRotate && !this.isDragging) {
      this.targetRotY += this.autoRotateSpeed;
    }

    // 阻尼平滑插值 (Damping)
    this.rotX += (this.targetRotX - this.rotX) * 0.14;
    this.rotY += (this.targetRotY - this.rotY) * 0.14;
    this.zoom += (this.targetZoom - this.zoom) * 0.16;
    this.panX += (this.targetPanX - this.panX) * 0.16;
    this.panY += (this.targetPanY - this.panY) * 0.16;

    // 步骤过渡动画
    if (this.transitionProgress < 1 && this.nextStepData) {
      const elapsed = now - this.transitionStartTime;
      const rawProgress = Math.min(1, elapsed / this.transitionDuration);
      // 三次平滑缓动 (Smoothstep easing)
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

  getInterpolatedScene() {
    if (!this.currentStepData) return { atoms: [], bonds: [] };

    if (this.transitionProgress >= 1 || !this.nextStepData) {
      return {
        atoms: this.currentStepData.atoms.map(a => ({ ...a, opacity: 1, scale: 1 })),
        bonds: this.currentStepData.bonds.map(b => ({ ...b, opacity: 1 }))
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
          opacity: 1,
          scale: 1
        });
      } else if (cur && !nxt) {
        interpolatedAtoms.push({
          id,
          element: cur.element,
          x: cur.x + (cur.x * 0.3) * t,
          y: cur.y + (cur.y * 0.3) * t,
          z: cur.z + (cur.z * 0.3) * t,
          opacity: Math.max(0, 1 - t * 1.3),
          scale: Math.max(0.2, 1 - t * 0.8)
        });
      } else if (!cur && nxt) {
        interpolatedAtoms.push({
          id,
          element: nxt.element,
          x: nxt.x * (0.8 + 0.2 * t),
          y: nxt.y * (0.8 + 0.2 * t),
          z: nxt.z * (0.8 + 0.2 * t),
          opacity: Math.min(1, t * 1.4),
          scale: Math.min(1, 0.4 + 0.6 * t)
        });
      }
    });

    const curBonds = this.currentStepData.bonds;
    const nxtBonds = this.nextStepData.bonds;
    const bondKey = b => `${b.atom1Id}--${b.atom2Id}`;
    const nxtBondMap = new Map(nxtBonds.map(b => [bondKey(b), b]));
    const curBondMap = new Map(curBonds.map(b => [bondKey(b), b]));

    const allBondKeys = new Set([...curBondMap.keys(), ...nxtBondMap.keys()]);
    const interpolatedBonds = [];

    allBondKeys.forEach(k => {
      const cur = curBondMap.get(k);
      const nxt = nxtBondMap.get(k);

      if (cur && nxt) {
        interpolatedBonds.push({
          ...nxt,
          order: cur.order + (nxt.order - cur.order) * t,
          opacity: 1
        });
      } else if (cur && !nxt) {
        interpolatedBonds.push({
          ...cur,
          opacity: Math.max(0, 1 - t * 1.2),
          isBreaking: true
        });
      } else if (!cur && nxt) {
        interpolatedBonds.push({
          ...nxt,
          opacity: Math.min(1, t * 1.5),
          isForming: true
        });
      }
    });

    return { atoms: interpolatedAtoms, bonds: interpolatedBonds };
  }

  render() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;

    // 清空背景并填充淡黄色宣纸底色
    ctx.fillStyle = this.palette.bg;
    ctx.fillRect(0, 0, width, height);

    // 绘制实验室辅助网格
    this.renderGrid(ctx, width, height);

    const { atoms, bonds } = this.getInterpolatedScene();
    if (atoms.length === 0) return;

    // 核心视口中心点（叠加 pan 平移量）
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

      // 纵深映射：字号与深浅
      const baseFontSize = 18 + depthFactor * 16;
      atom.fontSize = Math.max(12, Math.round(baseFontSize * (atom.scale || 1)));

      const r = Math.round(this.palette.atomBack.r + (this.palette.atomFront.r - this.palette.atomBack.r) * depthFactor);
      const g = Math.round(this.palette.atomBack.g + (this.palette.atomFront.g - this.palette.atomBack.g) * depthFactor);
      const b = Math.round(this.palette.atomBack.b + (this.palette.atomFront.b - this.palette.atomBack.b) * depthFactor);
      atom.color = `rgba(${r}, ${g}, ${b}, ${atom.opacity || 1})`;
      atom.rgb = { r, g, b };
      atom.clipRadius = atom.fontSize * 0.68;

      atomMap.set(atom.id, atom);
    });

    // 准备键线并计算平均深度
    const renderableBonds = bonds.map(bond => {
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
        avgZ
      };
    }).filter(Boolean);

    // 画家算法：深度由远及近排序
    const renderQueue = [];

    renderableBonds.forEach(item => {
      renderQueue.push({ type: 'bond', z: item.avgZ, data: item });
    });

    projectedAtoms.forEach(atom => {
      renderQueue.push({ type: 'atom', z: atom.sz, data: atom });
    });

    renderQueue.sort((a, b) => a.z - b.z);

    // 执行绘制
    renderQueue.forEach(item => {
      if (item.type === 'bond') {
        this.renderBond(ctx, item.data);
      } else {
        this.renderAtom(ctx, item.data);
      }
    });

    // 悬停提示
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
   * 绘制化学键：核心要求实现化学键渐变 (Linear Gradient)
   * 渐变自原子1朝原子2平滑过渡，结合纵深光影与化学反应活性脉冲
   */
  renderBond(ctx, { bond, a1, a2, avgDepth }) {
    const dx = a2.sx - a1.sx;
    const dy = a2.sy - a1.sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const ux = dx / dist;
    const uy = dy / dist;

    // 端点修剪：精准在两端字母外轮廓处停靠
    const r1 = a1.clipRadius;
    const r2 = a2.clipRadius;

    if (dist <= r1 + r2) return;

    const startX = a1.sx + ux * r1;
    const startY = a1.sy + uy * r1;
    const endX = a2.sx - ux * r2;
    const endY = a2.sy - uy * r2;

    // 计算端点 1 (a1) 的深度颜色 Stop 0
    const rStart = Math.round(this.palette.bondBack.r + (this.palette.bondFront.r - this.palette.bondBack.r) * a1.depthFactor);
    const gStart = Math.round(this.palette.bondBack.g + (this.palette.bondFront.g - this.palette.bondBack.g) * a1.depthFactor);
    const bStart = Math.round(this.palette.bondBack.b + (this.palette.bondFront.b - this.palette.bondBack.b) * a1.depthFactor);

    // 计算端点 2 (a2) 的深度颜色 Stop 1
    const rEnd = Math.round(this.palette.bondBack.r + (this.palette.bondFront.r - this.palette.bondBack.r) * a2.depthFactor);
    const gEnd = Math.round(this.palette.bondBack.g + (this.palette.bondFront.g - this.palette.bondBack.g) * a2.depthFactor);
    const bEnd = Math.round(this.palette.bondBack.b + (this.palette.bondFront.b - this.palette.bondBack.b) * a2.depthFactor);

    const alpha = (bond.opacity !== undefined ? bond.opacity : 1);
    const baseWidth = 1.4 + avgDepth * 2.2;

    // 核心实现：创建从端点1到端点2的线性渐变
    const grad = ctx.createLinearGradient(startX, startY, endX, endY);

    ctx.save();
    ctx.lineCap = 'round';

    if (bond.isBreaking) {
      // 正在断裂的键：两端渐变 + 琥珀赭红中心渐隐脉冲
      grad.addColorStop(0, `rgba(184, 74, 40, ${alpha * 0.88})`);
      grad.addColorStop(0.5, `rgba(225, 115, 60, ${alpha * 0.35})`);
      grad.addColorStop(1, `rgba(184, 74, 40, ${alpha * 0.88})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth * 1.15;
      ctx.setLineDash([5, 4]);
    } else if (bond.isForming) {
      // 正在生成的键：高能金橙色动态生长渐变
      grad.addColorStop(0, `rgba(200, 90, 23, ${alpha * 0.95})`);
      grad.addColorStop(0.5, `rgba(240, 150, 50, ${alpha})`);
      grad.addColorStop(1, `rgba(200, 90, 23, ${alpha * 0.95})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth * 1.25;
      ctx.setLineDash([6, 3]);
    } else {
      // 稳态化学键：完美呈现由端点1空间深度向端点2空间深度的连续渐变
      grad.addColorStop(0, `rgba(${rStart}, ${gStart}, ${bStart}, ${alpha * 0.92})`);
      grad.addColorStop(1, `rgba(${rEnd}, ${gEnd}, ${bEnd}, ${alpha * 0.92})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = baseWidth;
      ctx.setLineDash([]);
    }

    // 法向量（用于双键与三键的平行位移）
    const nx = -uy;
    const ny = ux;
    const order = Math.round(bond.order || 1);

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

  /**
   * 绘制原子：纯字母排印，绝无小球，配合高雅衬线字体与背景净空
   */
  renderAtom(ctx, atom) {
    ctx.save();

    ctx.font = `600 ${atom.fontSize}px 'Cinzel', 'Playfair Display', 'Merriweather', 'Times New Roman', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. 字母背后宣纸微光遮罩：防止交叉线条杂乱
    const pad = atom.fontSize * 0.62;
    ctx.beginPath();
    ctx.arc(atom.sx, atom.sy, pad, 0, Math.PI * 2);
    ctx.fillStyle = this.palette.maskBg;
    ctx.fill();

    // 2. 悬停或交互强调圈
    const isHovered = this.hoveredAtom && this.hoveredAtom.id === atom.id;
    if (isHovered) {
      ctx.strokeStyle = this.palette.highlight;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. 绘制元素符号字母（纯字母，深棕色阶）
    ctx.fillStyle = atom.color;
    ctx.fillText(atom.element, atom.sx, atom.sy);

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
    this.updateCursor();
  }

  renderHoverTooltip(ctx, atom) {
    ctx.save();
    const text = `${atom.element} (${atom.id}) · 空间深度 Z: ${atom.sz.toFixed(2)}`;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Pseudo3DRenderer };
}
