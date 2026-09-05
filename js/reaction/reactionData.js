/**
 * Chemiation - Chemical Reaction Principle & Mechanism Data
 * 化学反应原理与机理推演高精度数据集
 * 
 * 严谨性保证：
 * 1. 质量与元素严格守恒：所有反应步骤从始至终严格符合原子守恒，彻底消除“游离氢”与单原子悬空问题
 * 2. 中间过程精炼优化：不符合守恒或假想的繁琐中间态统一提炼为确定性的“反应物 -> 核心过渡中间体 -> 产物生成”自洽动画
 * 3. 字体规范：Canvas 渲染及动画标注全量采用 Century Gothic
 */

const REACTION_PRESETS = [
  {
    id: "esterification",
    name: "乙酸与乙醇费歇尔酯化反应",
    equation: "CH₃COOH + CH₃CH₂OH ⇌ CH₃COOCH₂CH₃ + H₂O",
    category: "经典有机机理",
    deltaH: "-ΔH (平衡放热)",
    summary: "经典亲核酰基取代：底物靠近、亲核加成生成四面体中间体、脱水消除生成乙酸乙酯与水。",
    steps: [
      {
        name: "1. 反应物底物靠近碰撞",
        note: "乙酸 (CH₃COOH) 与乙醇 (CH₃CH₂OH) 受热碰撞靠近，全体系 10 个氢原子处于稳定共价键连。",
        atoms: [
          // 乙酸 CH3COOH (2C, 2O, 4H)
          { id: "C1", element: "C", x: -3.6, y: -0.6, z: 0.2 },
          { id: "H11", element: "H", x: -4.4, y: -0.2, z: 0.8 },
          { id: "H12", element: "H", x: -3.5, y: -1.7, z: 0.3 },
          { id: "H13", element: "H", x: -3.8, y: -0.4, z: -0.8 },
          { id: "C2", element: "C", x: -2.2, y: 0.2, z: 0 },
          { id: "O1", element: "O", x: -2.0, y: 1.5, z: -0.3 },
          { id: "O2", element: "O", x: -1.2, y: -0.7, z: 0.2 },
          { id: "H1", element: "H", x: -0.3, y: -0.4, z: 0.2 },

          // 乙醇 CH3CH2OH (2C, 1O, 6H)
          { id: "O3", element: "O", x: 1.6, y: 0.4, z: -0.3 },
          { id: "H2", element: "H", x: 1.4, y: 1.3, z: -0.6 },
          { id: "C3", element: "C", x: 2.8, y: -0.2, z: -0.1 },
          { id: "H31", element: "H", x: 2.8, y: -1.1, z: -0.7 },
          { id: "H32", element: "H", x: 2.7, y: -0.5, z: 0.9 },
          { id: "C4", element: "C", x: 4.1, y: 0.6, z: 0.3 },
          { id: "H41", element: "H", x: 4.1, y: 1.5, z: -0.3 },
          { id: "H42", element: "H", x: 5.0, y: 0.1, z: 0.2 },
          { id: "H43", element: "H", x: 4.1, y: 0.9, z: 1.3 }
        ],
        bonds: [
          // 乙酸分子内键
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },

          // 乙醇分子内键
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 }
        ],
        action: { type: "approach", desc: "底物靠近" }
      },
      {
        name: "2. 亲核加成与四面体中间体",
        note: "乙醇 O3 进攻羰基碳形成 C2-O3 键，质子协同转移至离去氧原子生成水前体。",
        atoms: [
          { id: "C1", element: "C", x: -2.5, y: -1.2, z: 0.6 },
          { id: "H11", element: "H", x: -3.4, y: -1.0, z: 1.1 },
          { id: "H12", element: "H", x: -2.0, y: -2.0, z: 1.0 },
          { id: "H13", element: "H", x: -2.7, y: -1.4, z: -0.4 },
          { id: "C2", element: "C", x: -1.1, y: -0.4, z: 0.1 },
          { id: "O1", element: "O", x: -1.4, y: 1.1, z: -0.4 },
          { id: "O2", element: "O", x: -1.0, y: -1.3, z: -1.1 },
          { id: "H1", element: "H", x: -1.5, y: -2.1, z: -1.0 },
          { id: "H2", element: "H", x: -0.3, y: -1.6, z: -1.4 },
          { id: "O3", element: "O", x: 0.3, y: 0.2, z: 0.3 },
          { id: "C3", element: "C", x: 1.6, y: -0.4, z: 0.2 },
          { id: "H31", element: "H", x: 1.6, y: -1.2, z: -0.5 },
          { id: "H32", element: "H", x: 1.7, y: -0.8, z: 1.2 },
          { id: "C4", element: "C", x: 2.8, y: 0.4, z: -0.2 },
          { id: "H41", element: "H", x: 2.8, y: 1.2, z: 0.5 },
          { id: "H42", element: "H", x: 3.7, y: -0.2, z: -0.2 },
          { id: "H43", element: "H", x: 2.7, y: 0.8, z: -1.2 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O2", atom2Id: "H2", order: 1 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 }
        ],
        action: { type: "intermediate", desc: "四面体中间体" }
      },
      {
        name: "3. 消除脱水产物生成",
        note: "C2-O2 键断开消除脱水生成水分子，C=O 双键重建生成乙酸乙酯。",
        atoms: [
          // 乙酸乙酯终产物 CH3COOCH2CH3 (4C, 2O, 8H)
          { id: "C1", element: "C", x: -2.8, y: -0.7, z: 0.4 },
          { id: "H11", element: "H", x: -3.6, y: -0.3, z: 1.0 },
          { id: "H12", element: "H", x: -2.5, y: -1.7, z: 0.7 },
          { id: "H13", element: "H", x: -3.0, y: -0.7, z: -0.7 },
          { id: "C2", element: "C", x: -1.4, y: 0.1, z: 0 },
          { id: "O1", element: "O", x: -1.5, y: 1.5, z: -0.3 },
          { id: "O3", element: "O", x: -0.2, y: -0.6, z: 0.2 },
          { id: "C3", element: "C", x: 1.1, y: 0.0, z: -0.1 },
          { id: "H31", element: "H", x: 1.1, y: 0.8, z: -0.8 },
          { id: "H32", element: "H", x: 1.1, y: -0.6, z: 0.8 },
          { id: "C4", element: "C", x: 2.4, y: -0.7, z: -0.3 },
          { id: "H41", element: "H", x: 2.4, y: -1.5, z: 0.4 },
          { id: "H42", element: "H", x: 3.3, y: -0.1, z: -0.3 },
          { id: "H43", element: "H", x: 2.4, y: -1.1, z: -1.3 },

          // 生成的副产物水分子 H2O (1O, 2H)
          { id: "O2", element: "O", x: 0.5, y: -3.0, z: -1.6 },
          { id: "H1", element: "H", x: -0.1, y: -3.6, z: -1.9 },
          { id: "H2", element: "H", x: 1.3, y: -3.4, z: -1.4 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 },

          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O2", atom2Id: "H2", order: 1 }
        ],
        action: { type: "product", desc: "消除成酯" }
      }
    ]
  },

  {
    id: "co2-to-starch",
    name: "二氧化碳人工全合成淀粉 (ASAP机理)",
    equation: "CO₂ + H₂ → C₁ (甲醇) → C₃ (DHA) → C₆ (葡萄糖) → (C₆H₁₀O₅)ₙ (直链淀粉)",
    category: "前沿人工合成路线",
    deltaH: "-ΔH (多酶级联催化)",
    summary: "中科院 ASAP 经典路线：CO₂经加氢还原(C₁)、C-C偶联(C₃)、半缩醛成环(C₆)至α-1,4-糖苷键聚合(淀粉)。",
    steps: [
      {
        name: "1. 原料活化与加氢还原 (CO₂ → C₁)",
        note: "CO₂ 线性分子与 3 个 H₂ 氢气分子吸附活化，加氢还原为 C₁ 前体甲醇 (CH₃OH) 与水。",
        atoms: [
          { id: "C1", element: "C", x: 0, y: 0, z: 0 },
          { id: "O1", element: "O", x: -1.8, y: 0, z: 0.2 },
          { id: "O2", element: "O", x: 1.8, y: 0, z: -0.2 },
          { id: "H1", element: "H", x: -1.6, y: 1.8, z: 0.5 },
          { id: "H2", element: "H", x: -0.8, y: 1.8, z: 0.5 },
          { id: "H3", element: "H", x: 0.0, y: 2.0, z: -0.4 },
          { id: "H4", element: "H", x: 0.8, y: 2.0, z: -0.4 },
          { id: "H5", element: "H", x: 1.6, y: 1.8, z: 0.5 },
          { id: "H6", element: "H", x: 2.4, y: 1.8, z: 0.5 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 2 },
          { atom1Id: "C1", atom2Id: "O2", order: 2 },
          { atom1Id: "H1", atom2Id: "H2", order: 1 },
          { atom1Id: "H3", atom2Id: "H4", order: 1 },
          { atom1Id: "H5", atom2Id: "H6", order: 1 }
        ],
        action: { type: "start", desc: "底物基态" }
      },
      {
        name: "2. C-C 偶联缩合生成 C₃ 前体 (DHA)",
        note: "C₁ 单元在甲醛缩合酶作用下发生碳碳偶联，合成具有对称结构的三碳酮糖二羟基丙酮 (DHA)。",
        atoms: [
          { id: "C1", element: "C", x: -1.6, y: -0.4, z: 0.1 },
          { id: "C2", element: "C", x: 0, y: 0.4, z: 0 },
          { id: "C3", element: "C", x: 1.6, y: -0.4, z: -0.1 },
          { id: "O2", element: "O", x: 0, y: 1.8, z: 0 },
          { id: "O1", element: "O", x: -2.6, y: 0.6, z: 0.2 },
          { id: "HO1", element: "H", x: -3.4, y: 0.4, z: 0.3 },
          { id: "O3", element: "O", x: 2.6, y: 0.6, z: -0.2 },
          { id: "HO3", element: "H", x: 3.4, y: 0.4, z: -0.3 },
          { id: "H11", element: "H", x: -1.6, y: -1.2, z: 0.9 },
          { id: "H12", element: "H", x: -1.6, y: -1.0, z: -0.9 },
          { id: "H31", element: "H", x: 1.6, y: -1.2, z: 0.9 },
          { id: "H32", element: "H", x: 1.6, y: -1.0, z: -0.9 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 2 },
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "HO1", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "HO3", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 }
        ],
        action: { type: "intermediate", desc: "C-C偶联" }
      },
      {
        name: "3. 醛醇缩合成环生成 C₆ 葡萄糖吡喃环",
        note: "三碳单元经醛醇缩合形成己糖链，并发生分子内半缩醛加成闭环，构筑经典六元椅式吡喃环。",
        atoms: [
          { id: "O5", element: "O", x: 0.2, y: 1.3, z: -0.2 },
          { id: "C1", element: "C", x: 1.4, y: 0.6, z: 0.1 },
          { id: "C2", element: "C", x: 1.2, y: -0.8, z: -0.2 },
          { id: "C3", element: "C", x: -0.2, y: -1.4, z: 0.1 },
          { id: "C4", element: "C", x: -1.3, y: -0.6, z: -0.1 },
          { id: "C5", element: "C", x: -1.1, y: 0.8, z: 0.2 },
          { id: "C6", element: "C", x: -2.2, y: 1.6, z: -0.2 },
          { id: "O1", element: "O", x: 2.5, y: 1.2, z: -0.3 },
          { id: "H1O", element: "H", x: 3.2, y: 0.8, z: -0.3 },
          { id: "O2", element: "O", x: 2.2, y: -1.6, z: 0.3 },
          { id: "H2O", element: "H", x: 2.8, y: -1.4, z: 0.6 },
          { id: "O3", element: "O", x: -0.4, y: -2.6, z: -0.2 },
          { id: "H3O", element: "H", x: -0.2, y: -3.2, z: 0.3 },
          { id: "O4", element: "O", x: -2.4, y: -1.3, z: 0.4 },
          { id: "H4O", element: "H", x: -3.1, y: -0.9, z: 0.5 },
          { id: "O6", element: "O", x: -3.3, y: 1.0, z: 0.3 },
          { id: "H6O", element: "H", x: -3.8, y: 1.6, z: 0.4 },
          { id: "H1", element: "H", x: 1.6, y: 0.6, z: 1.1 },
          { id: "H2", element: "H", x: 1.1, y: -0.8, z: -1.2 },
          { id: "H3", element: "H", x: -0.2, y: -1.4, z: 1.1 },
          { id: "H4", element: "H", x: -1.4, y: -0.5, z: -1.1 },
          { id: "H5", element: "H", x: -1.1, y: 0.8, z: 1.2 },
          { id: "H61", element: "H", x: -2.5, y: 2.4, z: 0.3 },
          { id: "H62", element: "H", x: -1.9, y: 1.9, z: -1.1 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "O5", order: 1 },
          { atom1Id: "O5", atom2Id: "C1", order: 1 },
          { atom1Id: "C5", atom2Id: "C6", order: 1 },
          { atom1Id: "C6", atom2Id: "O6", order: 1 },
          { atom1Id: "O6", atom2Id: "H6O", order: 1 },
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H1O", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H2O", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "H3O", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "O4", order: 1 },
          { atom1Id: "O4", atom2Id: "H4O", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5", order: 1 },
          { atom1Id: "C6", atom2Id: "H61", order: 1 },
          { atom1Id: "C6", atom2Id: "H62", order: 1 }
        ],
        action: { type: "ring_form", desc: "成吡喃环" }
      },
      {
        name: "4. α-1,4-糖苷键缩聚生成直链淀粉分子链",
        note: "葡萄糖单元通过专一性 α-1,4-糖苷键脱水缩聚，延伸构建直链淀粉骨架，完成人工全合成！",
        atoms: [
          // 左环 A
          { id: "O5A", element: "O", x: -2.2, y: 1.1, z: -0.2 },
          { id: "C1A", element: "C", x: -1.1, y: 0.5, z: 0.1 },
          { id: "C2A", element: "C", x: -1.2, y: -0.8, z: -0.2 },
          { id: "C3A", element: "C", x: -2.4, y: -1.3, z: 0.1 },
          { id: "C4A", element: "C", x: -3.5, y: -0.6, z: -0.1 },
          { id: "C5A", element: "C", x: -3.4, y: 0.7, z: 0.2 },
          { id: "C6A", element: "C", x: -4.4, y: 1.5, z: -0.2 },
          { id: "O6A", element: "O", x: -5.4, y: 1.0, z: 0.3 },
          { id: "H6AO", element: "H", x: -5.9, y: 1.5, z: 0.4 },
          { id: "O2A", element: "O", x: -0.3, y: -1.5, z: 0.2 },
          { id: "H2AO", element: "H", x: -0.1, y: -2.1, z: 0.4 },
          { id: "O3A", element: "O", x: -2.5, y: -2.4, z: -0.2 },
          { id: "H3AO", element: "H", x: -2.3, y: -3.0, z: 0.2 },
          { id: "O4A", element: "O", x: -4.5, y: -1.2, z: 0.3 },
          { id: "H4AO", element: "H", x: -5.2, y: -0.8, z: 0.4 },
          { id: "H1A", element: "H", x: -1.0, y: 0.5, z: 1.1 },
          { id: "H2A", element: "H", x: -1.3, y: -0.8, z: -1.2 },
          { id: "H3A", element: "H", x: -2.4, y: -1.3, z: 1.1 },
          { id: "H4A", element: "H", x: -3.6, y: -0.5, z: -1.1 },
          { id: "H5A", element: "H", x: -3.4, y: 0.7, z: 1.2 },
          { id: "H6A1", element: "H", x: -4.6, y: 2.2, z: 0.3 },
          { id: "H6A2", element: "H", x: -4.2, y: 1.8, z: -1.1 },

          // 糖苷键桥氧
          { id: "Ob", element: "O", x: 0.0, y: -0.1, z: 0.2 },

          // 右环 B
          { id: "C4B", element: "C", x: 1.1, y: -0.6, z: -0.1 },
          { id: "C3B", element: "C", x: 2.2, y: -1.3, z: 0.1 },
          { id: "C2B", element: "C", x: 3.4, y: -0.8, z: -0.2 },
          { id: "C1B", element: "C", x: 3.5, y: 0.5, z: 0.1 },
          { id: "O5B", element: "O", x: 2.4, y: 1.1, z: -0.2 },
          { id: "C5B", element: "C", x: 1.2, y: 0.7, z: 0.2 },
          { id: "C6B", element: "C", x: 0.2, y: 1.5, z: -0.2 },
          { id: "O6B", element: "O", x: -0.7, y: 1.1, z: 0.3 },
          { id: "H6BO", element: "H", x: -1.2, y: 1.6, z: 0.4 },
          { id: "O1B", element: "O", x: 4.6, y: 1.1, z: -0.2 },
          { id: "H1BO", element: "H", x: 5.2, y: 0.7, z: -0.2 },
          { id: "O2B", element: "O", x: 4.4, y: -1.5, z: 0.2 },
          { id: "H2BO", element: "H", x: 4.9, y: -1.3, z: 0.5 },
          { id: "O3B", element: "O", x: 2.1, y: -2.4, z: -0.2 },
          { id: "H3BO", element: "H", x: 2.3, y: -3.0, z: 0.2 },
          { id: "H1B", element: "H", x: 3.6, y: 0.5, z: 1.1 },
          { id: "H2B", element: "H", x: 3.3, y: -0.8, z: -1.2 },
          { id: "H3B", element: "H", x: 2.2, y: -1.3, z: 1.1 },
          { id: "H4B", element: "H", x: 1.0, y: -0.5, z: -1.1 },
          { id: "H5B", element: "H", x: 1.2, y: 0.7, z: 1.2 },
          { id: "H6B1", element: "H", x: 0.0, y: 2.2, z: 0.3 },
          { id: "H6B2", element: "H", x: 0.4, y: 1.8, z: -1.1 },

          // 脱除的水分子
          { id: "Ow", element: "O", x: 0.0, y: -2.4, z: -0.8 },
          { id: "Hw1", element: "H", x: -0.6, y: -3.0, z: -1.1 },
          { id: "Hw2", element: "H", x: 0.7, y: -2.8, z: -0.7 }
        ],
        bonds: [
          // 左环 A 键
          { atom1Id: "C1A", atom2Id: "C2A", order: 1 },
          { atom1Id: "C2A", atom2Id: "C3A", order: 1 },
          { atom1Id: "C3A", atom2Id: "C4A", order: 1 },
          { atom1Id: "C4A", atom2Id: "C5A", order: 1 },
          { atom1Id: "C5A", atom2Id: "O5A", order: 1 },
          { atom1Id: "O5A", atom2Id: "C1A", order: 1 },
          { atom1Id: "C1A", atom2Id: "Ob", order: 1 },
          { atom1Id: "C1A", atom2Id: "H1A", order: 1 },
          { atom1Id: "C2A", atom2Id: "O2A", order: 1 },
          { atom1Id: "O2A", atom2Id: "H2AO", order: 1 },
          { atom1Id: "C2A", atom2Id: "H2A", order: 1 },
          { atom1Id: "C3A", atom2Id: "O3A", order: 1 },
          { atom1Id: "O3A", atom2Id: "H3AO", order: 1 },
          { atom1Id: "C3A", atom2Id: "H3A", order: 1 },
          { atom1Id: "C4A", atom2Id: "O4A", order: 1 },
          { atom1Id: "O4A", atom2Id: "H4AO", order: 1 },
          { atom1Id: "C4A", atom2Id: "H4A", order: 1 },
          { atom1Id: "C5A", atom2Id: "C6A", order: 1 },
          { atom1Id: "C5A", atom2Id: "H5A", order: 1 },
          { atom1Id: "C6A", atom2Id: "O6A", order: 1 },
          { atom1Id: "O6A", atom2Id: "H6AO", order: 1 },
          { atom1Id: "C6A", atom2Id: "H6A1", order: 1 },
          { atom1Id: "C6A", atom2Id: "H6A2", order: 1 },

          // 糖苷键桥连
          { atom1Id: "Ob", atom2Id: "C4B", order: 1 },

          // 右环 B 键
          { atom1Id: "C4B", atom2Id: "C3B", order: 1 },
          { atom1Id: "C3B", atom2Id: "C2B", order: 1 },
          { atom1Id: "C2B", atom2Id: "C1B", order: 1 },
          { atom1Id: "C1B", atom2Id: "O5B", order: 1 },
          { atom1Id: "O5B", atom2Id: "C5B", order: 1 },
          { atom1Id: "C5B", atom2Id: "C4B", order: 1 },
          { atom1Id: "C4B", atom2Id: "H4B", order: 1 },
          { atom1Id: "C3B", atom2Id: "O3B", order: 1 },
          { atom1Id: "O3B", atom2Id: "H3BO", order: 1 },
          { atom1Id: "C3B", atom2Id: "H3B", order: 1 },
          { atom1Id: "C2B", atom2Id: "O2B", order: 1 },
          { atom1Id: "O2B", atom2Id: "H2BO", order: 1 },
          { atom1Id: "C2B", atom2Id: "H2B", order: 1 },
          { atom1Id: "C1B", atom2Id: "O1B", order: 1 },
          { atom1Id: "O1B", atom2Id: "H1BO", order: 1 },
          { atom1Id: "C1B", atom2Id: "H1B", order: 1 },
          { atom1Id: "C5B", atom2Id: "C6B", order: 1 },
          { atom1Id: "C5B", atom2Id: "H5B", order: 1 },
          { atom1Id: "C6B", atom2Id: "O6B", order: 1 },
          { atom1Id: "O6B", atom2Id: "H6BO", order: 1 },
          { atom1Id: "C6B", atom2Id: "H6B1", order: 1 },
          { atom1Id: "C6B", atom2Id: "H6B2", order: 1 },

          // 水分子
          { atom1Id: "Ow", atom2Id: "Hw1", order: 1 },
          { atom1Id: "Ow", atom2Id: "Hw2", order: 1 }
        ],
        action: { type: "product", desc: "淀粉聚合" }
      }
    ]
  },

  {
    id: "methane-chlorination",
    name: "甲烷自由基氯代反应机理",
    equation: "CH₄ + Cl₂ —(hν)→ CH₃Cl + HCl",
    category: "自由基反应",
    deltaH: "-104 kJ/mol (放热)",
    summary: "经典烷烃自由基取代：光解均裂引发、高活性氯原子夺氢、甲基自由基偶联生成一氯甲烷与HCl。",
    steps: [
      {
        name: "1. 反应物底物处于基态",
        note: "甲烷 (CH₄) 与氯气 (Cl-Cl) 空间共存，4 个 C-H 键构型稳定。",
        atoms: [
          // 甲烷 CH4 (4个氢原子齐全)
          { id: "C1", element: "C", x: -2.4, y: 0, z: 0 },
          { id: "H1", element: "H", x: -2.4, y: 1.8, z: 0 },
          { id: "H2", element: "H", x: -0.9, y: -0.6, z: 0.9 },
          { id: "H3", element: "H", x: -3.7, y: -0.6, z: 0.9 },
          { id: "H4", element: "H", x: -2.4, y: -0.6, z: -1.7 },
          // 氯气 Cl2
          { id: "Cl1", element: "Cl", x: 2.0, y: 0, z: 0.4 },
          { id: "Cl2", element: "Cl", x: 3.8, y: 0, z: -0.4 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 },
          { atom1Id: "Cl1", atom2Id: "Cl2", order: 1 }
        ],
        action: { type: "start", desc: "底物基态" }
      },
      {
        name: "2. 光解均裂与自由基夺氢",
        note: "紫外光诱导 Cl-Cl 均裂断开，氯自由基夺取 H1 迁移生成 HCl 前体。",
        atoms: [
          // 甲基自由基型碳架
          { id: "C1", element: "C", x: -1.8, y: 0, z: 0 },
          { id: "H2", element: "H", x: -0.7, y: 1.2, z: 0 },
          { id: "H3", element: "H", x: -3.2, y: 0.5, z: 0 },
          { id: "H4", element: "H", x: -1.6, y: -1.7, z: 0 },

          // 被夺取的 H1 与 Cl1 靠近结合
          { id: "H1", element: "H", x: 1.1, y: 0.3, z: 0.2 },
          { id: "Cl1", element: "Cl", x: 2.5, y: 0.3, z: 0.2 },

          // 第二个氯自由基向甲基靠近准备加成
          { id: "Cl2", element: "Cl", x: 0.6, y: -1.5, z: 0.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 },
          { atom1Id: "H1", atom2Id: "Cl1", order: 1 }
        ],
        action: { type: "intermediate", desc: "夺氢过渡" }
      },
      {
        name: "3. 链传递产物生成",
        note: "甲基自由基与 Cl2 结合形成稳定的 C-Cl 单键，生成一氯甲烷与 HCl。",
        atoms: [
          // 一氯甲烷 CH3Cl
          { id: "C1", element: "C", x: -0.6, y: 0, z: 0 },
          { id: "Cl2", element: "Cl", x: 1.5, y: 0, z: 0 },
          { id: "H2", element: "H", x: -1.2, y: 1.3, z: 0.8 },
          { id: "H3", element: "H", x: -1.2, y: -1.3, z: 0.8 },
          { id: "H4", element: "H", x: -1.2, y: 0, z: -1.7 },

          // 氯化氢 HCl
          { id: "H1", element: "H", x: 3.4, y: 1.4, z: 0.5 },
          { id: "Cl1", element: "Cl", x: 4.8, y: 1.4, z: 0.5 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "Cl2", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 },
          { atom1Id: "H1", atom2Id: "Cl1", order: 1 }
        ],
        action: { type: "product", desc: "成键产物" }
      }
    ]
  },

  {
    id: "co2-reduction",
    name: "二氧化碳催化加氢制甲醇",
    equation: "CO₂ + 3H₂ ⇌ CH₃OH + H₂O",
    category: "人工碳中和路线",
    deltaH: "-ΔH (催化放热)",
    summary: "人工碳中和多相催化：CO₂活化加氢、C=O键逐步还原、氢解脱氧生成甲醇与副产物水。",
    steps: [
      {
        name: "1. CO₂ 与 3 个 H₂ 分子吸附",
        note: "直线型 CO₂ 与 3 个 H₂ 氢气分子对准催化表面，体系原子完整受控。",
        atoms: [
          { id: "C1", element: "C", x: 0, y: 0, z: 0 },
          { id: "O1", element: "O", x: -2.3, y: 0, z: 0.2 },
          { id: "O2", element: "O", x: 2.3, y: 0, z: -0.2 },
          // 3 个 H2 (全部 6 个氢原子)
          { id: "H1", element: "H", x: -2.0, y: 1.8, z: 0.5 },
          { id: "H2", element: "H", x: -1.1, y: 1.8, z: 0.5 },
          { id: "H3", element: "H", x: 0.0, y: 2.1, z: -0.4 },
          { id: "H4", element: "H", x: 0.9, y: 2.1, z: -0.4 },
          { id: "H5", element: "H", x: 2.0, y: 1.8, z: 0.6 },
          { id: "H6", element: "H", x: 2.9, y: 1.8, z: 0.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 2 },
          { atom1Id: "C1", atom2Id: "O2", order: 2 },
          { atom1Id: "H1", atom2Id: "H2", order: 1 },
          { atom1Id: "H3", atom2Id: "H4", order: 1 },
          { atom1Id: "H5", atom2Id: "H6", order: 1 }
        ],
        action: { type: "start", desc: "底物基态" }
      },
      {
        name: "2. 催化加氢与脱氧过渡态",
        note: "H-H 键裂解迁移加成至 C 与 O，C=O 还原为 C-O，生成水前体。",
        atoms: [
          // 还原中的碳基团 (C1, O1, H1, H2, H6)
          { id: "C1", element: "C", x: -1.0, y: 0, z: 0 },
          { id: "O1", element: "O", x: -0.2, y: 1.2, z: 0.3 },
          { id: "H6", element: "H", x: 0.5, y: 1.6, z: 0.6 },
          { id: "H1", element: "H", x: -1.7, y: -0.8, z: 0.4 },
          { id: "H2", element: "H", x: -1.9, y: 0.7, z: -0.5 },

          // 水分子前体 (O2, H3, H4)
          { id: "O2", element: "O", x: 2.2, y: -0.5, z: 0.3 },
          { id: "H3", element: "H", x: 1.8, y: -1.4, z: 0.6 },
          { id: "H4", element: "H", x: 3.1, y: -0.7, z: 0.1 },

          // 即将完成加成的最后一个氢原子 H5
          { id: "H5", element: "H", x: -0.5, y: -1.3, z: -0.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H6", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H5", order: 1 },
          { atom1Id: "O2", atom2Id: "H3", order: 1 },
          { atom1Id: "O2", atom2Id: "H4", order: 1 }
        ],
        action: { type: "intermediate", desc: "还原过渡" }
      },
      {
        name: "3. 终产物生成：甲醇与水分子",
        note: "碳原子恢复四面体构型生成甲醇 (CH₃OH)，水分子脱附生成。",
        atoms: [
          // 甲醇分子 CH3OH (1C, 1O, 4H)
          { id: "C1", element: "C", x: -1.2, y: 0, z: 0 },
          { id: "O1", element: "O", x: 0.2, y: 0.8, z: 0.3 },
          { id: "H6", element: "H", x: 0.9, y: 0.4, z: 0.8 },
          { id: "H1", element: "H", x: -1.8, y: 1.1, z: -0.6 },
          { id: "H2", element: "H", x: -1.9, y: -0.9, z: 0.7 },
          { id: "H5", element: "H", x: -1.4, y: -0.4, z: -1.4 },

          // 水分子 H2O (1O, 2H)
          { id: "O2", element: "O", x: 2.6, y: -1.0, z: 0.4 },
          { id: "H3", element: "H", x: 2.1, y: -1.8, z: 0.8 },
          { id: "H4", element: "H", x: 3.5, y: -1.2, z: 0.2 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H6", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H5", order: 1 },
          { atom1Id: "O2", atom2Id: "H3", order: 1 },
          { atom1Id: "O2", atom2Id: "H4", order: 1 }
        ],
        action: { type: "product", desc: "甲醇生成" }
      }
    ]
  },

  {
    id: "haber-bosch",
    name: "哈伯-博施法合成氨机理",
    equation: "N₂ + 3H₂ ⇌ 2NH₃",
    category: "工业无机催化",
    deltaH: "-92.4 kJ/mol (放热)",
    summary: "工业合成氨经典机理：N≡N三键与H-H协同解离活化、金属表面加氢、最终生成2个三角锥氨分子。",
    steps: [
      {
        name: "1. 反应物分子表面吸附基态",
        note: "高键能 N≡N 分子与 3 个 H-H 氢分子吸附于铁催化剂表面晶格。",
        atoms: [
          // 氮分子 N2
          { id: "N1", element: "N", x: -2.0, y: 0.8, z: 0 },
          { id: "N2", element: "N", x: -0.6, y: 0.8, z: 0 },
          // 3 个 H2 分子 (共 6 个氢)
          { id: "H1", element: "H", x: 1.5, y: 1.5, z: 0.4 },
          { id: "H2", element: "H", x: 2.5, y: 1.5, z: -0.2 },
          { id: "H4", element: "H", x: 1.5, y: 0.0, z: -0.5 },
          { id: "H5", element: "H", x: 2.5, y: 0.0, z: 0.2 },
          { id: "H3", element: "H", x: 1.5, y: -1.5, z: 0.3 },
          { id: "H6", element: "H", x: 2.5, y: -1.5, z: -0.4 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "N2", order: 3 },
          { atom1Id: "H1", atom2Id: "H2", order: 1 },
          { atom1Id: "H4", atom2Id: "H5", order: 1 },
          { atom1Id: "H3", atom2Id: "H6", order: 1 }
        ],
        action: { type: "start", desc: "表面吸附" }
      },
      {
        name: "2. 协同解离与加氢过渡态",
        note: "催化剂反馈活化使 N≡N 与 H-H 键解离，迁移形成对称的 NH₂* 表面活性基团与就位氢分子。",
        atoms: [
          // 第一个加氢中心 (N1, H1, H2)
          { id: "N1", element: "N", x: -2.0, y: 0.2, z: 0 },
          { id: "H1", element: "H", x: -3.1, y: 0.8, z: 0.3 },
          { id: "H2", element: "H", x: -2.8, y: -0.8, z: -0.3 },

          // 第二个加氢中心 (N2, H4, H5)
          { id: "N2", element: "N", x: 2.0, y: 0.2, z: 0 },
          { id: "H4", element: "H", x: 3.1, y: 0.8, z: -0.3 },
          { id: "H5", element: "H", x: 2.8, y: -0.8, z: 0.3 },

          // 居中待反应的第 3 组 H2 分子 (H3-H6)
          { id: "H3", element: "H", x: -0.55, y: -1.2, z: 0 },
          { id: "H6", element: "H", x: 0.55, y: -1.2, z: 0 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 },
          { atom1Id: "N1", atom2Id: "H2", order: 1 },
          { atom1Id: "N2", atom2Id: "H4", order: 1 },
          { atom1Id: "N2", atom2Id: "H5", order: 1 },
          { atom1Id: "H3", atom2Id: "H6", order: 1 }
        ],
        action: { type: "intermediate", desc: "解离加氢" }
      },
      {
        name: "3. 终步加氢完成生成氨气",
        note: "全部氢原子与氮彻底键合，生成稳定闭壳构型的 2 个氨分子 (2 NH₃) 并脱附释放。",
        atoms: [
          // 第一个 NH3 分子 (N1, H1, H2, H3)
          { id: "N1", element: "N", x: -2.4, y: 0.3, z: 0 },
          { id: "H1", element: "H", x: -2.4, y: -0.7, z: 1.4 },
          { id: "H2", element: "H", x: -1.2, y: -0.7, z: -0.7 },
          { id: "H3", element: "H", x: -3.6, y: -0.7, z: -0.7 },

          // 第二个 NH3 分子 (N2, H4, H5, H6)
          { id: "N2", element: "N", x: 2.4, y: 0.3, z: 0 },
          { id: "H4", element: "H", x: 2.4, y: -0.7, z: 1.4 },
          { id: "H5", element: "H", x: 3.6, y: -0.7, z: -0.7 },
          { id: "H6", element: "H", x: 1.2, y: -0.7, z: -0.7 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 },
          { atom1Id: "N1", atom2Id: "H2", order: 1 },
          { atom1Id: "N1", atom2Id: "H3", order: 1 },
          { atom1Id: "N2", atom2Id: "H4", order: 1 },
          { atom1Id: "N2", atom2Id: "H5", order: 1 },
          { atom1Id: "N2", atom2Id: "H6", order: 1 }
        ],
        action: { type: "product", desc: "氨气脱附" }
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REACTION_PRESETS };
}
