/**
 * Chemiation - 3D Quantum Atom & Electron Orbit Visualizer Engine
 * 基于 Three.js 驱动的高性能交互式 3D 动力学原子与电子云模拟引擎
 */

class AtomVisualizer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentElement = null;
    this.visualMode = 'gyroscopic'; // 'gyroscopic' | 'bohr' | 'quantum'
    this.speed = 1.0;
    this.paused = false;
    this.showTrails = true;
    this.autoRotate = true;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 内部对象引用
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.atomGroup = null;
    this.nucleusGroup = null;
    this.orbitalsGroup = null;
    this.electronsGroup = null;
    this.quantumCloudGroup = null;
    this.starfield = null;
    this.pointLight = null;

    // 运行时粒子与电子跟踪数组
    this.orbitingElectrons = [];
    this.nucleusParticles = [];
    this.orbitRings = [];

    // 时间戳
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070a14, 0.007);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    this.camera.position.set(0, 18, 38);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 180;
    this.controls.maxPolarAngle = Math.PI * 0.95;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    this.pointLight = new THREE.PointLight(0x38bdf8, 3.5, 60);
    this.scene.add(this.pointLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(20, 30, 20);
    this.scene.add(dirLight);

    // 6. Master Atom Group
    this.atomGroup = new THREE.Group();
    this.scene.add(this.atomGroup);

    this.nucleusGroup = new THREE.Group();
    this.orbitalsGroup = new THREE.Group();
    this.electronsGroup = new THREE.Group();
    this.quantumCloudGroup = new THREE.Group();

    this.atomGroup.add(this.nucleusGroup);
    this.atomGroup.add(this.orbitalsGroup);
    this.atomGroup.add(this.electronsGroup);
    this.atomGroup.add(this.quantumCloudGroup);

    // 7. Background Starfield
    this.createStarfield();

    // 8. Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));

    // 9. Start Loop
    this.animate();
  }

  createStarfield() {
    const starCount = 600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const r = 80 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const tint = Math.random();
      if (tint > 0.6) {
        colors[i * 3] = 0.5; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0;
      } else if (tint > 0.3) {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 0.9;
      } else {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  /**
   * 加载指定元素并构建 3D 原子结构
   */
  loadElement(element) {
    this.currentElement = element;

    // 清理旧元素对象
    this.clearAtom();

    // 更新光源颜色
    const elemColor = new THREE.Color(element.color || '#38bdf8');
    this.pointLight.color = elemColor;

    // 1. 构建原子核
    this.buildNucleus(element, elemColor);

    // 2. 构建电子轨道与电子
    this.buildOrbitsAndElectrons(element, elemColor);

    // 3. 构建量子几率云（备用）
    this.buildQuantumCloud(element, elemColor);

    // 4. 根据当前模式设置显隐
    this.applyVisualMode();

    // 5. 镜头自适应缩放
    this.adjustCamera(element);
  }

  clearAtom() {
    // 递归清理 Group
    const clearGroup = (group) => {
      while (group.children.length > 0) {
        const obj = group.children[0];
        group.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    };

    clearGroup(this.nucleusGroup);
    clearGroup(this.orbitalsGroup);
    clearGroup(this.electronsGroup);
    clearGroup(this.quantumCloudGroup);

    this.orbitingElectrons = [];
    this.nucleusParticles = [];
    this.orbitRings = [];
  }

  /**
   * 构建原子核（质子与中子簇 + 核等离子体光晕）
   */
  buildNucleus(element, elemColor) {
    const Z = element.number;
    const mass = Math.round(element.mass);
    const neutrons = Math.max(0, mass - Z);
    const totalNucleons = Z + neutrons;

    // 视觉粒子数量（对重元素平滑采样，最大表现 48 个高精质点）
    const displayCount = Math.min(totalNucleons, 48);
    const clusterRadius = 0.9 + Math.pow(displayCount, 0.33) * 0.35;

    const protonGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const neutronGeo = new THREE.SphereGeometry(0.38, 16, 16);

    const protonMat = new THREE.MeshStandardMaterial({
      color: elemColor,
      emissive: elemColor,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.4
    });

    const neutronMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0x334155,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.2
    });

    for (let i = 0; i < displayCount; i++) {
      // 斐波那契球面紧密堆积分布
      const phi = Math.acos(1 - 2 * (i + 0.5) / displayCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = clusterRadius * (0.6 + Math.random() * 0.45);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const isProton = (i % 2 === 0) || (i < Z);
      const mesh = new THREE.Mesh(isProton ? protonGeo : neutronGeo, isProton ? protonMat : neutronMat);
      mesh.position.set(x, y, z);
      
      mesh.userData = {
        basePos: mesh.position.clone(),
        phase: Math.random() * Math.PI * 2,
        jitterSpeed: 2 + Math.random() * 3
      };

      this.nucleusGroup.add(mesh);
      this.nucleusParticles.push(mesh);
    }

    // 核能量场光晕外壳 (Core Quantum Glow Aura)
    const auraGeo = new THREE.SphereGeometry(clusterRadius * 1.5, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: elemColor,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.userData = { isAura: true, baseScale: 1.0 };
    this.nucleusGroup.add(auraMesh);
  }

  /**
   * 构建电子轨道环与高光轨道电子
   */
  buildOrbitsAndElectrons(element, elemColor) {
    const shells = element.shells; // 各层电子数 [2, 8, ...]
    const numShells = shells.length;

    // 电子基础几何体与材质 (发光电子球)
    const electronGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const electronMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: elemColor,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.8
    });

    shells.forEach((electronCount, shellIdx) => {
      const n = shellIdx + 1; // 主量子数 1..7
      // 轨道半径：依据能级递增，视觉尺度做对数/根号适配
      const radius = 3.6 + n * 2.5 + Math.pow(n, 1.35) * 0.7;

      // 陀螺模式下的倾斜角分配
      const subPlanes = Math.min(electronCount, Math.ceil(electronCount / 2));
      
      for (let p = 0; p < subPlanes; p++) {
        // 计算轨道倾角 (陀螺天体仪多轴交错)
        let tiltX = 0;
        let tiltZ = 0;

        if (this.visualMode === 'gyroscopic') {
          const angleStep = Math.PI / subPlanes;
          tiltX = (p * angleStep * 0.8) + (n * 0.35);
          tiltZ = (p * angleStep * 0.6) - (n * 0.25);
        }

        // 1. 创建发光轨道虚线/细线环
        const ringGeo = new THREE.BufferGeometry();
        const segments = 96;
        const ringPoints = [];
        for (let s = 0; s <= segments; s++) {
          const theta = (s / segments) * Math.PI * 2;
          ringPoints.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
        }
        ringGeo.setFromPoints(ringPoints);

        const ringMat = new THREE.LineBasicMaterial({
          color: elemColor,
          transparent: true,
          opacity: 0.28 - shellIdx * 0.02,
          blending: THREE.AdditiveBlending
        });

        const orbitLine = new THREE.Line(ringGeo, ringMat);
        orbitLine.rotation.x = tiltX;
        orbitLine.rotation.z = tiltZ;
        orbitLine.userData = {
          shellIdx,
          radius,
          tiltX,
          tiltZ
        };

        this.orbitalsGroup.add(orbitLine);
        this.orbitRings.push(orbitLine);
      }

      // 2. 在本能级轨道上均匀排布电子
      for (let e = 0; e < electronCount; e++) {
        const electronMesh = new THREE.Mesh(electronGeo, electronMat.clone());
        
        // 分配到对应的倾斜轨道平面
        const planeIndex = e % subPlanes;
        const targetRing = this.orbitRings[this.orbitRings.length - subPlanes + planeIndex];

        // 基础角速度：根据主量子数递减 (玻尔/开普勒第三定律模拟)
        const angularSpeed = (2.2 / Math.sqrt(n)) * (0.85 + Math.random() * 0.1);
        const startPhase = (e / electronCount) * Math.PI * 2 + (planeIndex * 0.5);

        // 创建微弱光迹尾焰 (Gradient Trail Arc)
        const trailMesh = this.createElectronTrail(radius, elemColor);
        if (trailMesh) {
          trailMesh.rotation.x = targetRing ? targetRing.userData.tiltX : 0;
          trailMesh.rotation.z = targetRing ? targetRing.userData.tiltZ : 0;
          this.orbitalsGroup.add(trailMesh);
        }

        const electronObj = {
          mesh: electronMesh,
          trail: trailMesh,
          shellIdx,
          n,
          radius,
          speed: angularSpeed,
          phase: startPhase,
          tiltX: targetRing ? targetRing.userData.tiltX : 0,
          tiltZ: targetRing ? targetRing.userData.tiltZ : 0,
          planeIndex
        };

        electronMesh.userData = {
          isElectron: true,
          shellName: SHELL_NAMES[shellIdx] || N,
          shellIdx: shellIdx + 1,
          indexInShell: e + 1,
          isValence: shellIdx === shells.length - 1
        };

        this.electronsGroup.add(electronMesh);
        this.orbitingElectrons.push(electronObj);
      }
    });
  }

  /**
   * 创建电子流光拖尾环弧 (Luminous Comet Trail)
   */
  createElectronTrail(radius, elemColor) {
    const arcSegments = 32;
    const arcLength = Math.PI * 0.35; // 约 60 度的光弧尾迹
    const positions = [];
    const colors = [];
    const rgb = elemColor;

    for (let i = 0; i <= arcSegments; i++) {
      const theta = (i / arcSegments) * arcLength;
      positions.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
      
      const alpha = Math.pow(i / arcSegments, 1.8); // 尾部到头部透明度渐变
      colors.push(rgb.r * alpha, rgb.g * alpha, rgb.b * alpha);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    return new THREE.Line(geo, mat);
  }

  /**
   * 构建量子波函数几率云 (Quantum Electron Cloud)
   */
  buildQuantumCloud(element, elemColor) {
    const shells = element.shells;
    let totalPoints = Math.min(element.number * 80 + 300, 3200);
    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);
    const c = elemColor;

    let idx = 0;
    shells.forEach((count, sIdx) => {
      const n = sIdx + 1;
      const baseR = 3.6 + n * 2.5 + Math.pow(n, 1.35) * 0.7;
      const pointsForShell = Math.floor((count / element.number) * totalPoints);

      for (let p = 0; p < pointsForShell && idx < totalPoints; p++) {
        // 麦克斯韦-玻尔兹曼/指数径向几率密度抽样
        const r = baseR + (Math.random() - 0.5) * (1.5 + n * 0.8);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[idx * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx * 3 + 2] = r * Math.cos(phi);

        const lum = 0.4 + Math.random() * 0.6;
        colors[idx * 3] = c.r * lum;
        colors[idx * 3 + 1] = c.g * lum;
        colors[idx * 3 + 2] = c.b * lum;

        idx++;
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });

    const cloudMesh = new THREE.Points(geo, mat);
    this.quantumCloudGroup.add(cloudMesh);
  }

  /**
   * 应用当前可视化模式切换
   */
  applyVisualMode() {
    if (this.visualMode === 'gyroscopic') {
      this.orbitalsGroup.visible = true;
      this.electronsGroup.visible = true;
      this.quantumCloudGroup.visible = false;
      this.setOrbitTilts(true);
    } else if (this.visualMode === 'bohr') {
      this.orbitalsGroup.visible = true;
      this.electronsGroup.visible = true;
      this.quantumCloudGroup.visible = false;
      this.setOrbitTilts(false); // 平躺为经典同心圆
    } else if (this.visualMode === 'quantum') {
      this.orbitalsGroup.visible = false;
      this.electronsGroup.visible = false;
      this.quantumCloudGroup.visible = true;
    }
  }

  setOrbitTilts(isGyroscopic) {
    this.orbitRings.forEach(ring => {
      const tX = isGyroscopic ? ring.userData.tiltX : 0;
      const tZ = isGyroscopic ? ring.userData.tiltZ : 0;
      ring.rotation.x = tX;
      ring.rotation.z = tZ;
    });

    this.orbitingElectrons.forEach(eObj => {
      eObj.activeTiltX = isGyroscopic ? eObj.tiltX : 0;
      eObj.activeTiltZ = isGyroscopic ? eObj.tiltZ : 0;
      if (eObj.trail) {
        eObj.trail.rotation.x = eObj.activeTiltX;
        eObj.trail.rotation.z = eObj.activeTiltZ;
      }
    });
  }

  setVisualMode(mode) {
    if (this.visualMode === mode) return;
    this.visualMode = mode;
    this.applyVisualMode();
    if (window.soundEngine) {
      window.soundEngine.playModeSwitch();
    }
  }

  setSpeed(val) {
    this.speed = parseFloat(val) || 1.0;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  toggleTrails() {
    this.showTrails = !this.showTrails;
    this.orbitingElectrons.forEach(eObj => {
      if (eObj.trail) eObj.trail.visible = this.showTrails;
    });
    return this.showTrails;
  }

  resetCamera() {
    if (!this.currentElement) return;
    this.adjustCamera(this.currentElement, true);
  }

  adjustCamera(element, animate = false) {
    const maxRadius = 3.6 + element.shells.length * 2.5 + Math.pow(element.shells.length, 1.35) * 0.7;
    const targetDist = Math.max(20, maxRadius * 2.3);

    const targetPos = new THREE.Vector3(0, targetDist * 0.42, targetDist * 0.88);
    if (!animate) {
      this.camera.position.copy(targetPos);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    } else {
      // 简单平滑插值
      const startPos = this.camera.position.clone();
      let t = 0;
      const animateCam = () => {
        t += 0.05;
        this.camera.position.lerpVectors(startPos, targetPos, t);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        if (t < 1) requestAnimationFrame(animateCam);
      };
      animateCam();
    }
  }

  onMouseMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    const effectiveDelta = this.paused ? 0 : delta * this.speed;

    // 1. 全局轻微星系自转 (Auto Orbit Rotation)
    if (this.autoRotate && !this.paused) {
      this.atomGroup.rotation.y += effectiveDelta * 0.12;
    }

    // 2. 原子核微观涨落动效
    const timeNow = this.clock.getElapsedTime();
    this.nucleusParticles.forEach(p => {
      const u = p.userData;
      if (u && u.basePos) {
        const jAmp = 0.035;
        p.position.x = u.basePos.x + Math.sin(timeNow * u.jitterSpeed + u.phase) * jAmp;
        p.position.y = u.basePos.y + Math.cos(timeNow * u.jitterSpeed * 1.2 + u.phase) * jAmp;
        p.position.z = u.basePos.z + Math.sin(timeNow * u.jitterSpeed * 0.8 + u.phase) * jAmp;
      }
    });

    // 核能量球轻柔心跳脉动
    const aura = this.nucleusGroup.children.find(c => c.userData && c.userData.isAura);
    if (aura) {
      const scale = 1.0 + Math.sin(timeNow * 2.5) * 0.05;
      aura.scale.set(scale, scale, scale);
    }

    // 3. 电子在 3D 轨道中的运动
    this.orbitingElectrons.forEach(eObj => {
      if (!this.paused) {
        eObj.phase += effectiveDelta * eObj.speed;
      }

      // 计算轨道局部平面坐标 (x, 0, z)
      const localX = Math.cos(eObj.phase) * eObj.radius;
      const localZ = Math.sin(eObj.phase) * eObj.radius;
      const pos = new THREE.Vector3(localX, 0, localZ);

      // 应用轨道倾角
      const tX = eObj.activeTiltX !== undefined ? eObj.activeTiltX : eObj.tiltX;
      const tZ = eObj.activeTiltZ !== undefined ? eObj.activeTiltZ : eObj.tiltZ;
      pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), tX);
      pos.applyAxisAngle(new THREE.Vector3(0, 0, 1), tZ);

      eObj.mesh.position.copy(pos);

      // 同步尾迹角度旋转
      if (eObj.trail && this.showTrails) {
        eObj.trail.rotation.y = eObj.phase - Math.PI * 0.35;
      }
    });

    // 4. 量子几率云轻柔流转
    if (this.visualMode === 'quantum' && this.quantumCloudGroup.visible) {
      this.quantumCloudGroup.rotation.y += effectiveDelta * 0.25;
      this.quantumCloudGroup.rotation.z += effectiveDelta * 0.15;
    }

    // 5. 更新控制器并渲染
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.AtomVisualizer = AtomVisualizer;
