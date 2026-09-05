/**
 * Chemiation - Pseudo3DRenderer
 * 伪3D 化学分子与反应机理 2D Canvas 渲染引擎
 * 
 * 核心特性：
 * 1. 严格 2D Canvas 绘制，纯字母表达元素，无小球，保证画面简洁与学术质感
 * 2. 伪 3D 纵深表达：深度 Z 映射为字体字号 (font-size) 与深棕色色阶深浅 (Lightness/Depth)
 * 3. 动态平滑插值：步骤切换时，原子坐标、化学键在时间轴上进行 smoothstep 变形过渡
 * 4. 键线修剪 (Bond Clipping)：线条精准停靠在字母外轮廓边缘，多重键（双键/三键）法向平行偏移
 * 5. 交互式 3D 旋转、缩放与阻尼惯性
 */

class Pseudo3DRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 视觉配置（淡黄色调与深棕色系）
    this.palette = {
      bg: options.bg || '#FAF6E9',              // 淡黄米宣纸底色
      bgGrid: options.bgGrid || 'rgba(92, 64, 45, 0.04)', // 微弱参考网格
      atomFront: options.atomFront || { r: 38, g: 20, b: 12 },   // 前景深棕黑 #26140C
      atomBack: options.atomBack || { r: 168, g: 142, b: 122 },  // 远景淡暖棕 #A88E7A
      bondFront: options.bondFront || { r: 46, g: 27, b: 15 },   // 前景键深棕
      bondBack: options.bondBack || { r: 185, g: 165, b: 148 },  // 远景键淡棕
      highlight: options.highlight || '#B84A28', // 反应活性中心高亮暖赭红
      activeBond: options.activeBond || '#C85A17',
      maskBg: options.maskBg || '#FAF6E9'        // 字母遮罩底色，防止键穿透字母
    };

    // 3D 视角参数
    this.rotX = options.rotX !== undefined ? options.rotX : 0.35; // 仰角 (pitch)
    this.rotY = options.rotY !== undefined ? options.rotY : -0.55; // 方位角 (yaw)
    this.targetRotX = this.rotX;
    this.targetRotY = this.rotY;
    this.zoom = options.zoom || 78;              // 缩放比例 (px / 坐标单位)
    this.targetZoom = this.zoom;
    this.autoRotate = options.autoRotate || false;
    this.autoRotateSpeed = 0.003;

    // 拖拽与交互状态
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.hoveredAtom = null;

    // 反应状态与平滑过渡
    this.currentStepData = null; // 当前/起始步骤数据
    this.nextStepData = null;    // 目标步骤数据
    this.transitionProgress = 1; // 0 -> 1 过渡进度 (1 为静止)
    this.transitionDuration = 900; // ms
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
        this.targetRotY += dx * 0.008;
        this.targetRotX += dy * 0.008;
        // 限制仰角范围，防止上下翻转眩晕
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
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.targetZoom = Math.max(35, Math.min(180, this.targetZoom * zoomFactor));
    }, { passive: false });
  }

  /**
   * 设定当前机理步骤，若已有步骤则开启平滑过渡
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

  resetCamera() {
    this.targetRotX = 0.35;
    this.targetRotY = -0.55;
    this.targetZoom = 78;
  }

  /**
   * 启动渲染管线
   */
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

  /**
   * 更新物理与动画帧
   */
  update(now) {
    // 自动缓速自转
    if (this.autoRotate && !this.isDragging) {
      this.targetRotY += this.autoRotateSpeed;
    }

    // 视角平滑插值 (Damping)
    this.rotX += (this.targetRotX - this.rotX) * 0.12;
    this.rotY += (this.targetRotY - this.rotY) * 0.12;
    this.zoom += (this.targetZoom - this.zoom) * 0.15;

    // 步骤过渡插值
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

  /**
   * 3D 旋转变换：将模型坐标变换至相机观察坐标系
   */
  rotatePoint(p) {
    // 绕 Y 轴旋转 (方位角 Yaw)
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = p.x * cosY + p.z * sinY;
    const y1 = p.y;
    const z1 = -p.x * sinY + p.z * cosY;

    // 绕 X 轴旋转 (仰角 Pitch)
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    return { x: x2, y: y2, z: z2 };
  }

  /**
   * 计算插值后的原子与化学键集合
   */
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
        // 两步均存在：平滑位置移动
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
        // 在下一步中离去 (消解/脱附)
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
        // 在下一步中生成/进攻引入
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

    // 键插值
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
        // 正在断裂的化学键：淡出并闪烁
        interpolatedBonds.push({
          ...cur,
          opacity: Math.max(0, 1 - t * 1.2),
          isBreaking: true
        });
      } else if (!cur && nxt) {
        // 正在形成的新化学键：淡入与生长
        interpolatedBonds.push({
          ...nxt,
          opacity: Math.min(1, t * 1.5),
          isForming: true
        });
      }
    });

    return { atoms: interpolatedAtoms, bonds: interpolatedBonds };
  }

  /**
   * 核心渲染循环
   */
  render() {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;

    // 清空背景并填充淡黄色宣纸底色
    ctx.fillStyle = this.palette.bg;
    ctx.fillRect(0, 0, width, height);

    // 绘制微妙的实验记录网格 (Laboratory Grid)
    this.renderGrid(ctx, width, height);

    const { atoms, bonds } = this.getInterpolatedScene();
    if (atoms.length === 0) return;

    // 1. 将原子空间坐标通过 3D 矩阵旋转，并计算伪3D深度与屏幕投影
    const centerX = width * 0.5;
    const centerY = height * 0.5;

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

    // 深度范围归一化
    const zRange = Math.max(0.1, maxZ - minZ);
    const atomMap = new Map();

    projectedAtoms.forEach(atom => {
      // 深度因子 0 (最远) ~ 1 (最近)
      const depthFactor = (atom.sz - minZ) / zRange;
      atom.depthFactor = depthFactor;

      // 核心需求：伪3D纵深通过字号大小和颜色深浅表示
      // 前景字号大，远景字号小
      const baseFontSize = 18 + depthFactor * 16; // 18px ~ 34px
      atom.fontSize = Math.max(12, Math.round(baseFontSize * (atom.scale || 1)));

      // 颜色深浅：前景深棕黑，后景浅暖棕
      const r = Math.round(this.palette.atomBack.r + (this.palette.atomFront.r - this.palette.atomBack.r) * depthFactor);
      const g = Math.round(this.palette.atomBack.g + (this.palette.atomFront.g - this.palette.atomBack.g) * depthFactor);
      const b = Math.round(this.palette.atomBack.b + (this.palette.atomFront.b - this.palette.atomBack.b) * depthFactor);
      atom.color = `rgba(${r}, ${g}, ${b}, ${atom.opacity || 1})`;
      atom.rgb = { r, g, b };

      // 字母碰撞半宽/外边距（用于键线停靠修剪）
      atom.clipRadius = atom.fontSize * 0.68;

      atomMap.set(atom.id, atom);
    });

    // 2. 准备键线并计算每根键的平均深度（用于画家算法 Painter's Algorithm）
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

    // 3. 将所有待绘制元素（原子、键）按空间深度 sz 由远及近排序，实现真实前后遮挡
    const renderQueue = [];

    renderableBonds.forEach(item => {
      renderQueue.push({ type: 'bond', z: item.avgZ, data: item });
    });

    projectedAtoms.forEach(atom => {
      renderQueue.push({ type: 'atom', z: atom.sz, data: atom });
    });

    renderQueue.sort((a, b) => a.z - b.z);

    // 4. 按排序绘制
    renderQueue.forEach(item => {
      if (item.type === 'bond') {
        this.renderBond(ctx, item.data);
      } else {
        this.renderAtom(ctx, item.data);
      }
    });

    // 5. 绘制悬停原子的信息提示（若有）
    if (this.hoveredAtom) {
      this.renderHoverTooltip(ctx, this.hoveredAtom);
    }
  }

  /**
   * 绘制淡黄色宣纸背景的精致网格
   */
  renderGrid(ctx, width, height) {
    const step = 48;
    ctx.save();
    ctx.strokeStyle = this.palette.bgGrid;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = (width * 0.5) % step; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = (height * 0.5) % step; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 绘制化学键：严格根据两端原子位置计算方向向量，修剪端点，支持单/双/三键
   */
  renderBond(ctx, { bond, a1, a2, avgDepth }) {
    const dx = a2.sx - a1.sx;
    const dy = a2.sy - a1.sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;

    const ux = dx / dist;
    const uy = dy / dist;

    // 端点修剪：从字母轮廓向外偏移，保证线条不穿入字母本身
    const r1 = a1.clipRadius;
    const r2 = a2.clipRadius;

    if (dist <= r1 + r2) return;

    const startX = a1.sx + ux * r1;
    const startY = a1.sy + uy * r1;
    const endX = a2.sx - ux * r2;
    const endY = a2.sy - uy * r2;

    // 键线粗细与深棕色阶：前景粗而浓，远景细而淡
    const baseWidth = 1.4 + avgDepth * 2.2;
    const r = Math.round(this.palette.bondBack.r + (this.palette.bondFront.r - this.palette.bondBack.r) * avgDepth);
    const g = Math.round(this.palette.bondBack.g + (this.palette.bondFront.g - this.palette.bondBack.g) * avgDepth);
    const b = Math.round(this.palette.bondBack.b + (this.palette.bondFront.b - this.palette.bondBack.b) * avgDepth);
    const alpha = (bond.opacity !== undefined ? bond.opacity : 1);

    ctx.save();
    ctx.lineCap = 'round';

    // 反应动态状态提示（断裂键虚线渐隐，生成键高亮）
    if (bond.isBreaking) {
      ctx.strokeStyle = `rgba(184, 74, 40, ${alpha * 0.85})`;
      ctx.lineWidth = baseWidth * 1.1;
      ctx.setLineDash([5, 4]);
    } else if (bond.isForming) {
      ctx.strokeStyle = `rgba(200, 90, 23, ${alpha})`;
      ctx.lineWidth = baseWidth * 1.25;
      ctx.setLineDash([6, 3]);
    } else {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.88})`;
      ctx.lineWidth = baseWidth;
      ctx.setLineDash([]);
    }

    // 法向量（用于双键与三键的平行位移）
    const nx = -uy;
    const ny = ux;
    const order = Math.round(bond.order || 1);

    if (order === 1) {
      // 单键
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else if (order === 2) {
      // 双键：两条平行线
      const offset = Math.max(3.2, 2.5 + avgDepth * 2.8);
      ctx.beginPath();
      ctx.moveTo(startX + nx * offset, startY + ny * offset);
      ctx.lineTo(endX + nx * offset, endY + ny * offset);
      ctx.moveTo(startX - nx * offset, startY - ny * offset);
      ctx.lineTo(endX - nx * offset, endY - ny * offset);
      ctx.stroke();
    } else if (order === 3) {
      // 三键：中央一条，两侧平行两条
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
   * 绘制原子：纯字母表现，无小球，配合高雅衬线字体与背景净空
   */
  renderAtom(ctx, atom) {
    ctx.save();

    // 字体排印：采用古典典雅且具有科学学术美感的衬线体
    ctx.font = `600 ${atom.fontSize}px 'Cinzel', 'Playfair Display', 'Merriweather', 'Times New Roman', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. 字母背后淡黄微光遮罩：防止任何后方重叠杂线干扰文字可读性
    const pad = atom.fontSize * 0.62;
    ctx.beginPath();
    ctx.arc(atom.sx, atom.sy, pad, 0, Math.PI * 2);
    ctx.fillStyle = this.palette.maskBg;
    ctx.fill();

    // 2. 悬停或交互强调圈（极简细线）
    const isHovered = this.hoveredAtom && this.hoveredAtom.id === atom.id;
    if (isHovered) {
      ctx.strokeStyle = this.palette.highlight;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. 绘制元素符号字母（纯字母，深棕色调）
    ctx.fillStyle = atom.color;
    ctx.fillText(atom.element, atom.sx, atom.sy);

    ctx.restore();
  }

  /**
   * 悬停检测
   */
  checkHover(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const { atoms } = this.getInterpolatedScene();
    let found = null;
    let closestDist = Infinity;

    atoms.forEach(atom => {
      const rot = this.rotatePoint(atom);
      const sx = this.width * 0.5 + rot.x * this.zoom;
      const sy = this.height * 0.5 - rot.y * this.zoom;
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

  /**
   * 悬停提示气泡
   */
  renderHoverTooltip(ctx, atom) {
    ctx.save();
    const text = `${atom.element} (${atom.id}) · 空间深度 Z: ${atom.sz.toFixed(2)}`;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textMetrics = ctx.measureText(text);
    const boxW = textMetrics.width + 20;
    const boxH = 26;
    const boxX = atom.sx - boxW * 0.5;
    const boxY = atom.sy - atom.clipRadius - boxH - 6;

    // 气泡背景
    ctx.fillStyle = 'rgba(46, 27, 15, 0.92)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();

    // 气泡文字
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
