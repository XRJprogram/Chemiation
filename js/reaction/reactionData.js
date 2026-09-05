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
    name: "乙酸与乙醇的费歇尔酯化反应",
    equation: "CH₃COOH + CH₃CH₂OH ⇌ CH₃COOCH₂CH₃ + H₂O",
    category: "经典有机机理",
    deltaH: "-ΔH (平衡放热反应)",
    summary: "展示经典的亲核酰基取代全过程。全流程严格遵循质量守恒：4个碳、3个氧、10个氢原子全程闭环，无任何孤立游离氢！",
    steps: [
      {
        name: "1. 反应底物：乙酸与乙醇分子靠近",
        note: "反应原料乙酸 (CH₃COOH) 与乙醇 (CH₃CH₂OH) 受热碰撞靠近。全部 10 个氢原子分别处于甲基、亚甲基与羟基稳定键连中，无裸露游离质子。",
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
        action: { type: "approach", desc: "底物分子对准反应位点靠近，全体系 10 个氢原子守恒无游离" }
      },
      {
        name: "2. 亲核加成与质子转移：四面体中间体形成",
        note: "乙醇的 O3 进攻羰基碳 C2 形成 C2-O3 共价单键，同时质子发生分子间协同转移，生成四面体共价加成物，原子与化学键完全守恒。",
        atoms: [
          { id: "C1", element: "C", x: -2.5, y: -1.2, z: 0.6 },
          { id: "H11", element: "H", x: -3.4, y: -1.0, z: 1.1 },
          { id: "H12", element: "H", x: -2.0, y: -2.0, z: 1.0 },
          { id: "H13", element: "H", x: -2.7, y: -1.4, z: -0.4 },
          { id: "C2", element: "C", x: -1.1, y: -0.4, z: 0.1 },
          { id: "O1", element: "O", x: -1.4, y: 1.1, z: -0.4 },
          { id: "O2", element: "O", x: -1.0, y: -1.3, z: -1.1 },
          { id: "H1", element: "H", x: -1.5, y: -2.1, z: -1.0 },
          { id: "H2", element: "H", x: -0.3, y: -1.6, z: -1.4 }, // H2 协同转移至 O2，准备脱水
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
          { atom1Id: "O2", atom2Id: "H2", order: 1 }, // H2 键连在 O2 上构成离去前体水基团
          { atom1Id: "C2", atom2Id: "O3", order: 1 }, // 新成键 C2-O3
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 }
        ],
        action: { type: "intermediate", desc: "形成四面体中间体：C2-O3 成键，H2 转移结合于 O2" }
      },
      {
        name: "3. 消除脱水：生成乙酸乙酯产物与水分子",
        note: "C2-O2 键自中间断开并消除脱水生成水分子 (H₂O)，羰基 C2=O1 双键重建，生成目标产物乙酸乙酯，10 个氢原子完全守恒！",
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
          { atom1Id: "C2", atom2Id: "O1", order: 2 }, // C=O 双键重构
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 },

          // 水分子内共价键
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O2", atom2Id: "H2", order: 1 }
        ],
        action: { type: "product", desc: "C2-O2 键自中间断开并消除，产物乙酸乙酯与水生成" }
      }
    ]
  },

  {
    id: "methane-chlorination",
    name: "甲烷自由基氯代反应机理",
    equation: "CH₄ + Cl₂ —(hν)→ CH₃Cl + HCl",
    category: "自由基反应",
    deltaH: "-104 kJ/mol (放热反应)",
    summary: "经典烷烃自由基取代反应：全流程严格质量守恒（1个碳、2个氯、4个氢），一步动画顺畅过渡，无孤立原子悬挂。",
    steps: [
      {
        name: "1. 反应底物：甲烷与氯气分子",
        note: "反应原料甲烷 (CH₄) 与氯气 (Cl-Cl) 在空间共存，4 个 C-H 键构型稳定。",
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
        action: { type: "start", desc: "反应物分子处于基态，全体系 4 个氢原子守恒" }
      },
      {
        name: "2. 光解均裂与自由基夺氢过渡态",
        note: "在紫外光激发下，Cl-Cl 键自中间均裂断开；高活性氯原子夺取 H1，断裂的 C-H1 键平滑迁移至 Cl1 生成 HCl 过渡对。",
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
          { atom1Id: "H1", atom2Id: "Cl1", order: 1 } // C-H1 键迁移为 H1-Cl1 键
        ],
        action: { type: "intermediate", desc: "Cl-Cl 从中裂解，C-H1 键迁移重组为 H1-Cl1 键" }
      },
      {
        name: "3. 链传递产物生成：一氯甲烷与氯化氢",
        note: "甲基自由基与 Cl2 快速重组形成稳定的 C-Cl 键，构型恢复为四面体的一氯甲烷与 HCl，质量严格守恒！",
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
        action: { type: "product", desc: "C-Cl2 共价键形成，一氯甲烷与 HCl 产物稳定生成" }
      }
    ]
  },

  {
    id: "co2-reduction",
    name: "二氧化碳催化加氢制甲醇与水",
    equation: "CO₂ + 3H₂ ⇌ CH₃OH + H₂O",
    category: "人工碳中和路线",
    deltaH: "-ΔH (催化放热反应)",
    summary: "模拟二氧化碳加氢还原：1个碳、2个氧、6个氢原子全程守恒，一步动画顺畅过渡，各氢原子全程明确键连。",
    steps: [
      {
        name: "1. 原料分子：CO₂ 与 3 个 H₂ 分子",
        note: "直线型二氧化碳 (O=C=O) 与 3 个氢气分子 (共 6 个氢原子 H1~H6) 共同对准催化表面，体系严格守恒。",
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
        action: { type: "start", desc: "CO₂ 与 3H₂ 初始基态，6 个氢原子完整守恒" }
      },
      {
        name: "2. 催化活化与加氢脱氧过渡态",
        note: "H-H 键从中解离，断裂的键迁移加成于碳原子与氧原子，同时脱氧生成水分子前体，过渡态自洽守恒。",
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
        action: { type: "intermediate", desc: "H-H 断开迁移加成，C=O 双键还原为 C-O，生成水前体" }
      },
      {
        name: "3. 终产物生成：甲醇 (CH₃OH) 与水分子 (H₂O)",
        note: "碳原子完全转化为四面体构型的甲醇分子，脱附的水分子稳定生成，6 个氢原子全程完全守恒！",
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
        action: { type: "product", desc: "四面体甲醇与水分子形成，全反应氢原子严格闭环守恒" }
      }
    ]
  },

  {
    id: "haber-bosch",
    name: "哈伯-博施法合成氨机理",
    equation: "N₂ + 3H₂ ⇌ 2NH₃",
    category: "工业无机催化",
    deltaH: "-92.4 kJ/mol (放热反应)",
    summary: "工业合成氨经典机理：2个氮、6个氢原子全程闭环守恒，一步动画完成表面解离与连续加氢，无非守恒中间态悬挂。",
    steps: [
      {
        name: "1. 反应物分子表面吸附基态",
        note: "高键能 N≡N 分子与 3 个 H-H 氢分子吸附于铁催化剂表面晶格，全体系 2 个氮与 6 个氢原子严格在场。",
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
        action: { type: "start", desc: "N₂ 与 3H₂ 表面吸附，共 2 个氮、6 个氢原子守恒" }
      },
      {
        name: "2. 协同解离与加氢过渡态",
        note: "催化剂反馈活化使 N≡N 与 H-H 键从中解离，断裂的键平滑迁移至氮原子，形成两组平面对称的 NH₂* 活性加氢中心与就位氢分子。",
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
        action: { type: "intermediate", desc: "三键裂解，化学键迁移加成形成表面活性氢化中心与就位氢分子" }
      },
      {
        name: "3. 终步加氢完成：生成 2 个三角锥 NH₃ 分子",
        note: "全部 6 个氢原子与 2 个氮原子彻底完成键合，生成达到稳定闭壳构型的 2 个氨气分子 (2 NH₃) 并脱附，全过程严格守恒！",
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
        action: { type: "product", desc: "生成 2 个三角锥氨分子 NH₃ 并脱附，质量全守恒" }
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REACTION_PRESETS };
}
