/**
 * Chemiation - Main UI & Interactive Periodic Table Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化 3D 渲染引擎
  const visualizer = new AtomVisualizer('atom-viewport');

  // 当前选中元素 (默认钠 Na - 经典三层结构 2, 8, 1)
  let currentZ = 11;
  let currentFilter = 'all';

  // DOM 元素引用
  const dom = {
    // HUD 核心信息
    hudAtomicNumber: document.getElementById('hudAtomicNumber'),
    hudSymbol: document.getElementById('hudSymbol'),
    hudZhName: document.getElementById('hudZhName'),
    hudPinyin: document.getElementById('hudPinyin'),
    hudEnName: document.getElementById('hudEnName'),
    hudCategoryBadge: document.getElementById('hudCategoryBadge'),
    hudMass: document.getElementById('hudMass'),
    hudConfig: document.getElementById('hudConfig'),
    hudValence: document.getElementById('hudValence'),
    hudState: document.getElementById('hudState'),
    hudShellsList: document.getElementById('hudShellsList'),
    hudPeriodGroup: document.getElementById('hudPeriodGroup'),

    // 顶部与悬浮控制
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnRandom: document.getElementById('btnRandom'),
    btnPause: document.getElementById('btnPause'),
    btnTrails: document.getElementById('btnTrails'),
    btnResetCam: document.getElementById('btnResetCam'),
    btnSound: document.getElementById('btnSound'),
    speedSlider: document.getElementById('speedSlider'),
    speedValText: document.getElementById('speedValText'),
    modeBtns: document.querySelectorAll('.mode-btn'),

    // 周期表与筛选
    periodicGrid: document.getElementById('periodicGrid'),
    searchInput: document.getElementById('elementSearchInput'),
    categoryFilterBar: document.getElementById('categoryFilterBar'),
    tableToggleBtn: document.getElementById('tableToggleBtn'),
    tablePanel: document.getElementById('tablePanel')
  };

  /**
   * 渲染周期表网格 (IUPAC 18 列标准排版)
   */
  function renderPeriodicTable() {
    dom.periodicGrid.innerHTML = '';

    PERIODIC_ELEMENTS.forEach(elem => {
      const cell = document.createElement('div');
      cell.className = 'element-cell';
      cell.dataset.z = elem.number;
      cell.dataset.category = elem.category;
      cell.dataset.symbol = elem.symbol.toLowerCase();
      cell.dataset.name = elem.name.toLowerCase();
      cell.dataset.zh = elem.zhName;

      // 网格行列设置 (18列标准排布)
      cell.style.gridRow = elem.gridRow;
      cell.style.gridColumn = elem.gridCol;

      const catInfo = CATEGORIES[elem.category] || { color: '#38bdf8' };
      cell.style.setProperty('--elem-color', elem.color || catInfo.color);

      cell.innerHTML = `
        <span class="cell-z">${elem.number}</span>
        <span class="cell-sym">${elem.symbol}</span>
        <span class="cell-name">${elem.zhName}</span>
      `;

      // 点击选中
      cell.addEventListener('click', () => {
        selectElement(elem.number);
      });

      // 悬浮音效与微交互
      cell.addEventListener('mouseenter', () => {
        if (window.soundEngine) window.soundEngine.playHover();
      });

      dom.periodicGrid.appendChild(cell);
    });

    // 补充镧系与锕系标记占位块 (Row 6 Col 3, Row 7 Col 3)
    const lanPlaceholder = document.createElement('div');
    lanPlaceholder.className = 'element-cell placeholder-cell';
    lanPlaceholder.style.gridRow = 6;
    lanPlaceholder.style.gridColumn = 3;
    lanPlaceholder.innerHTML = `<span class="cell-z">57-71</span><span class="cell-sym">La-Lu</span><span class="cell-name">镧系</span>`;
    dom.periodicGrid.appendChild(lanPlaceholder);

    const actPlaceholder = document.createElement('div');
    actPlaceholder.className = 'element-cell placeholder-cell';
    actPlaceholder.style.gridRow = 7;
    actPlaceholder.style.gridColumn = 3;
    actPlaceholder.innerHTML = `<span class="cell-z">89-103</span><span class="cell-sym">Ac-Lr</span><span class="cell-name">锕系</span>`;
    dom.periodicGrid.appendChild(actPlaceholder);
  }

  /**
   * 渲染分类筛选标签栏
   */
  function renderCategoryFilters() {
    dom.categoryFilterBar.innerHTML = `<button class="filter-pill active" data-cat="all">全部元素 (118)</button>`;
    
    Object.keys(CATEGORIES).forEach(catKey => {
      const cat = CATEGORIES[catKey];
      const pill = document.createElement('button');
      pill.className = 'filter-pill';
      pill.dataset.cat = catKey;
      pill.style.setProperty('--cat-color', cat.color);
      pill.innerHTML = `<span class="pill-dot" style="background:${cat.color}"></span>${cat.zh}`;
      
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        filterElements(catKey, dom.searchInput.value.trim());
      });

      dom.categoryFilterBar.appendChild(pill);
    });

    // 全部元素按钮事件
    dom.categoryFilterBar.querySelector('[data-cat="all"]').addEventListener('click', (e) => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      filterElements('all', dom.searchInput.value.trim());
    });
  }

  /**
   * 根据类别与搜索词过滤周期表高亮
   */
  function filterElements(category, searchKeyword) {
    currentFilter = category;
    const query = searchKeyword ? searchKeyword.toLowerCase() : '';

    const cells = dom.periodicGrid.querySelectorAll('.element-cell:not(.placeholder-cell)');
    cells.forEach(cell => {
      const cat = cell.dataset.category;
      const sym = cell.dataset.symbol;
      const zh = cell.dataset.zh;
      const name = cell.dataset.name;
      const z = cell.dataset.z;

      const matchesCat = (category === 'all' || cat === category);
      const matchesSearch = !query || sym.includes(query) || zh.includes(query) || name.includes(query) || z === query;

      if (matchesCat && matchesSearch) {
        cell.classList.remove('dimmed');
      } else {
        cell.classList.add('dimmed');
      }
    });
  }

  /**
   * 切换当前选中元素
   */
  function selectElement(z) {
    z = Math.max(1, Math.min(118, z));
    currentZ = z;

    const elem = PERIODIC_ELEMENTS[z - 1];
    if (!elem) return;

    // 1. 播放音调反馈
    if (window.soundEngine) {
      window.soundEngine.playSelect(0.8 + (z / 118) * 0.8);
    }

    // 2. 加载 3D 动力学原子模型
    visualizer.loadElement(elem);

    // 3. 更新 HUD 信息面板
    updateHUD(elem);

    // 4. 更新周期表选中态
    dom.periodicGrid.querySelectorAll('.element-cell').forEach(c => {
      if (parseInt(c.dataset.z) === z) {
        c.classList.add('active');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } else {
        c.classList.remove('active');
      }
    });
  }

  /**
   * 更新 HUD 数据展示面板
   */
  function updateHUD(elem) {
    const catInfo = CATEGORIES[elem.category] || { zh: '未知分类', color: '#38bdf8' };

    dom.hudAtomicNumber.textContent = elem.number;
    dom.hudSymbol.textContent = elem.symbol;
    dom.hudSymbol.style.color = elem.color || catInfo.color;
    dom.hudSymbol.style.textShadow = `0 0 24px ${elem.color || catInfo.color}88`;

    dom.hudZhName.textContent = elem.zhName;
    dom.hudPinyin.textContent = elem.pinyin;
    dom.hudEnName.textContent = elem.name;

    dom.hudCategoryBadge.textContent = catInfo.zh;
    dom.hudCategoryBadge.style.borderColor = catInfo.color;
    dom.hudCategoryBadge.style.color = catInfo.color;
    dom.hudCategoryBadge.style.backgroundColor = `${catInfo.color}18`;

    dom.hudMass.textContent = elem.mass.toFixed(3);
    dom.hudConfig.textContent = elem.config;
    dom.hudValence.textContent = `${elem.valence} 个`;
    dom.hudState.textContent = elem.state;
    dom.hudPeriodGroup.textContent = `第 ${elem.period} 周期 · 第 ${elem.group} 族`;

    // 渲染各层电子分布图表 (K-Q)
    dom.hudShellsList.innerHTML = '';
    const maxCapacity = [2, 8, 18, 32, 32, 18, 8];

    elem.shells.forEach((count, idx) => {
      const shellName = SHELL_NAMES[idx];
      const maxCap = maxCapacity[idx] || 32;
      const pct = Math.round((count / maxCap) * 100);
      const isValence = idx === elem.shells.length - 1;

      const item = document.createElement('div');
      item.className = `shell-row ${isValence ? 'valence-shell' : ''}`;
      item.innerHTML = `
        <div class="shell-label">
          <span class="shell-name">${shellName}层 (n=${idx + 1})</span>
          <span class="shell-count">${count} e⁻${isValence ? ' <b class="valence-tag">价层</b>' : ''}</span>
        </div>
        <div class="shell-bar-bg">
          <div class="shell-bar-fill" style="width: ${pct}%; background: ${isValence ? (elem.color || '#38bdf8') : '#60a5fa'}"></div>
        </div>
      `;
      dom.hudShellsList.appendChild(item);
    });
  }

  // 快捷前后切换
  dom.btnPrev.addEventListener('click', () => selectElement(currentZ - 1));
  dom.btnNext.addEventListener('click', () => selectElement(currentZ + 1));
  dom.btnRandom.addEventListener('click', () => {
    const randZ = Math.floor(Math.random() * 118) + 1;
    selectElement(randZ);
  });

  // 播放与暂停
  dom.btnPause.addEventListener('click', () => {
    const isPaused = visualizer.togglePause();
    dom.btnPause.innerHTML = isPaused ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
    dom.btnPause.title = isPaused ? '继续运行' : '暂停运行';
  });

  // 轨迹尾焰开关
  dom.btnTrails.addEventListener('click', () => {
    const hasTrails = visualizer.toggleTrails();
    dom.btnTrails.classList.toggle('active', hasTrails);
  });

  // 视角重置
  dom.btnResetCam.addEventListener('click', () => {
    visualizer.resetCamera();
  });

  // 音效开关
  dom.btnSound.addEventListener('click', () => {
    if (window.soundEngine) {
      const isOn = window.soundEngine.toggle();
      dom.btnSound.innerHTML = isOn ? '<i class="fas fa-volume-high"></i>' : '<i class="fas fa-volume-xmark"></i>';
      dom.btnSound.classList.toggle('active', isOn);
    }
  });

  // 速度滑块
  dom.speedSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    visualizer.setSpeed(val);
    dom.speedValText.textContent = `${val.toFixed(1)}x`;
  });

  // 模式切换
  dom.modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      visualizer.setVisualMode(mode);
    });
  });

  // 周期表抽屉折叠展开
  dom.tableToggleBtn.addEventListener('click', () => {
    const isCollapsed = dom.tablePanel.classList.toggle('collapsed');
    dom.tableToggleBtn.innerHTML = isCollapsed 
      ? '<i class="fas fa-chevron-up"></i> 展开元素周期表' 
      : '<i class="fas fa-chevron-down"></i> 收起元素周期表';
  });

  // 搜索框响应
  dom.searchInput.addEventListener('input', (e) => {
    filterElements(currentFilter, e.target.value.trim());
  });

  dom.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const visibleCells = dom.periodicGrid.querySelectorAll('.element-cell:not(.dimmed):not(.placeholder-cell)');
      if (visibleCells.length > 0) {
        selectElement(parseInt(visibleCells[0].dataset.z));
      }
    }
  });

  // 全局快捷键：左右键切换元素，空格键暂停
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') {
      selectElement(currentZ - 1);
    } else if (e.key === 'ArrowRight') {
      selectElement(currentZ + 1);
    } else if (e.key === ' ') {
      e.preventDefault();
      dom.btnPause.click();
    }
  });

  // 初始化周期表并加载默认元素
  renderPeriodicTable();
  renderCategoryFilters();
  selectElement(currentZ);
});
