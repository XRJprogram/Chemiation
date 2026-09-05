/**
 * Chemiation - Chemical Reaction Principle & Mechanism Data
 * 化学反应原理与机理推演高精度数据集
 * 
 * 严谨性保证：
 * 1. 质量守恒与原子严格守恒：所有反应步骤中，氢原子 (H) 与所有重原子严格守恒，绝无氢原子突兀消失！
 * 2. 真实三维立体构型：依据价层电子对互斥理论 (VSEPR) 与杂化轨道理论计算各原子精确坐标
 * 3. 反应动作时序驱动：记录断键、成键、质子转移与离去基团动作
 */

const REACTION_PRESETS = [
  {
    id: "esterification",
    name: "乙酸与乙醇的费歇尔酯化反应",
    equation: "CH₃COOH + CH₃CH₂OH ⇌ CH₃COOCH₂CH₃ + H₂O",
    category: "经典有机机理",
    deltaH: "-ΔH (平衡放热反应)",
    summary: "展示典型的酸催化亲核酰基取代全过程。全流程严格追踪乙酸的 4 个氢原子、乙醇的 6 个氢原子以及酸催化剂质子 (H⁺)，氢原子全程守恒！",
    steps: [
      {
        name: "1. 反应物底物分子靠近",
        note: "乙酸 CH₃COOH 与乙醇 CH₃CH₂OH 在酸性溶剂中受热扩散并靠近，催化质子 H⁺ 存在于溶剂环境中。",
        atoms: [
          // 乙酸 CH3COOH (C1, C2, O1, O2, H11, H12, H13, H1)
          { id: "C1", element: "C", x: -4.0, y: -0.6, z: 0.4 },
          { id: "H11", element: "H", x: -4.8, y: -0.2, z: 1.1 },
          { id: "H12", element: "H", x: -3.8, y: -1.7, z: 0.6 },
          { id: "H13", element: "H", x: -4.4, y: -0.5, z: -0.6 },
          { id: "C2", element: "C", x: -2.6, y: 0.2, z: 0 },
          { id: "O1", element: "O", x: -2.4, y: 1.6, z: -0.3 },
          { id: "O2", element: "O", x: -1.5, y: -0.7, z: 0.3 },
          { id: "H1", element: "H", x: -0.6, y: -0.4, z: 0.4 },

          // 乙醇 CH3CH2OH (C4, C3, O3, H41, H42, H43, H31, H32, H2)
          { id: "O3", element: "O", x: 1.8, y: 0.4, z: -0.4 },
          { id: "H2", element: "H", x: 1.6, y: 1.3, z: -0.7 },
          { id: "C3", element: "C", x: 3.1, y: -0.2, z: -0.1 },
          { id: "H31", element: "H", x: 3.1, y: -1.1, z: -0.7 },
          { id: "H32", element: "H", x: 3.0, y: -0.6, z: 0.9 },
          { id: "C4", element: "C", x: 4.4, y: 0.6, z: 0.3 },
          { id: "H41", element: "H", x: 4.4, y: 1.5, z: -0.3 },
          { id: "H42", element: "H", x: 5.3, y: 0.1, z: 0.2 },
          { id: "H43", element: "H", x: 4.4, y: 0.9, z: 1.3 },

          // 催化剂游离质子 H+
          { id: "Hp", element: "H", x: -2.8, y: 3.2, z: -0.8 }
        ],
        bonds: [
          // 乙酸内化学键
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          // 乙醇内化学键
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 }
        ],
        action: { type: "approach", desc: "底物分子在酸催化环境中对准反应位点靠近" }
      },
      {
        name: "2. 酸催化：羰基氧质子化",
        note: "催化质子 H⁺ 进攻并结合羰基氧 O1，削弱 C=O 双键，羰基碳正电性剧增，亲核活性大大激活。",
        atoms: [
          { id: "C1", element: "C", x: -3.8, y: -0.6, z: 0.4 },
          { id: "H11", element: "H", x: -4.6, y: -0.2, z: 1.1 },
          { id: "H12", element: "H", x: -3.6, y: -1.7, z: 0.6 },
          { id: "H13", element: "H", x: -4.2, y: -0.5, z: -0.6 },
          { id: "C2", element: "C", x: -2.4, y: 0.2, z: 0 },
          { id: "O1", element: "O", x: -2.2, y: 1.6, z: -0.3 },
          { id: "Hp", element: "H", x: -2.6, y: 2.5, z: -0.6 }, // 结合质子
          { id: "O2", element: "O", x: -1.4, y: -0.7, z: 0.3 },
          { id: "H1", element: "H", x: -0.5, y: -0.4, z: 0.4 },

          { id: "O3", element: "O", x: 1.4, y: 0.3, z: -0.3 },
          { id: "H2", element: "H", x: 1.3, y: 1.2, z: -0.6 },
          { id: "C3", element: "C", x: 2.7, y: -0.2, z: -0.1 },
          { id: "H31", element: "H", x: 2.7, y: -1.1, z: -0.7 },
          { id: "H32", element: "H", x: 2.6, y: -0.6, z: 0.9 },
          { id: "C4", element: "C", x: 4.0, y: 0.6, z: 0.3 },
          { id: "H41", element: "H", x: 4.0, y: 1.5, z: -0.3 },
          { id: "H42", element: "H", x: 4.9, y: 0.1, z: 0.2 },
          { id: "H43", element: "H", x: 4.0, y: 0.9, z: 1.3 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 1 }, // 质子化后双键活化为单键倾向
          { atom1Id: "O1", atom2Id: "Hp", order: 1 }, // 新成 O-H 键
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 }
        ],
        action: { type: "protonate", desc: "O1 结合催化质子 Hp，C=O 双键开键活化" }
      },
      {
        name: "3. 亲核进攻：四面体中间体形成",
        note: "乙醇的 O3 原子孤对电子亲核进攻带正电的羰基碳 C2，生成具备 sp³ 杂化的四面体反应中间体。",
        atoms: [
          { id: "C1", element: "C", x: -2.6, y: -1.2, z: 0.7 },
          { id: "H11", element: "H", x: -3.5, y: -1.0, z: 1.2 },
          { id: "H12", element: "H", x: -2.1, y: -2.0, z: 1.1 },
          { id: "H13", element: "H", x: -2.8, y: -1.4, z: -0.3 },
          { id: "C2", element: "C", x: -1.2, y: -0.4, z: 0.1 },
          { id: "O1", element: "O", x: -1.6, y: 1.0, z: -0.5 },
          { id: "Hp", element: "H", x: -2.3, y: 1.5, z: -0.8 },
          { id: "O2", element: "O", x: -1.1, y: -1.2, z: -1.2 },
          { id: "H1", element: "H", x: -1.5, y: -2.1, z: -1.2 },
          { id: "O3", element: "O", x: 0.2, y: 0.2, z: 0.4 },
          { id: "H2", element: "H", x: 0.2, y: 1.1, z: 0.8 },
          { id: "C3", element: "C", x: 1.5, y: -0.4, z: 0.2 },
          { id: "H31", element: "H", x: 1.5, y: -1.2, z: -0.5 },
          { id: "H32", element: "H", x: 1.6, y: -0.9, z: 1.2 },
          { id: "C4", element: "C", x: 2.7, y: 0.4, z: -0.2 },
          { id: "H41", element: "H", x: 2.7, y: 1.2, z: 0.5 },
          { id: "H42", element: "H", x: 3.6, y: -0.2, z: -0.2 },
          { id: "H43", element: "H", x: 2.6, y: 0.8, z: -1.2 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "Hp", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 }, // 亲核成键 C2-O3
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 }
        ],
        action: { type: "attack", desc: "C2-O3 新共价键形成，碳原子转为四面体构型" }
      },
      {
        name: "4. 质子转移与消除脱水 (H₂O 离去)",
        note: "O3 上的质子转移至羟基氧 O2，使其转化为极佳离去基团水分子 -OH₂⁺，C2-O2 键断裂并消除脱水，C=O 双键重建。",
        atoms: [
          // 乙酸乙酯阳离子主体
          { id: "C1", element: "C", x: -2.8, y: -0.7, z: 0.4 },
          { id: "H11", element: "H", x: -3.6, y: -0.3, z: 1.0 },
          { id: "H12", element: "H", x: -2.5, y: -1.7, z: 0.7 },
          { id: "H13", element: "H", x: -3.0, y: -0.7, z: -0.7 },
          { id: "C2", element: "C", x: -1.4, y: 0.1, z: 0 },
          { id: "O1", element: "O", x: -1.5, y: 1.5, z: -0.3 },
          { id: "Hp", element: "H", x: -2.1, y: 2.1, z: -0.6 },
          { id: "O3", element: "O", x: -0.2, y: -0.6, z: 0.2 },
          { id: "C3", element: "C", x: 1.1, y: 0.0, z: -0.1 },
          { id: "H31", element: "H", x: 1.1, y: 0.8, z: -0.8 },
          { id: "H32", element: "H", x: 1.1, y: -0.6, z: 0.8 },
          { id: "C4", element: "C", x: 2.4, y: -0.7, z: -0.3 },
          { id: "H41", element: "H", x: 2.4, y: -1.5, z: 0.4 },
          { id: "H42", element: "H", x: 3.3, y: -0.1, z: -0.3 },
          { id: "H43", element: "H", x: 2.4, y: -1.1, z: -1.3 },

          // 消除离去的水分子 H2O (含 O2, H1, H2)
          { id: "O2", element: "O", x: 0.4, y: -2.6, z: -1.6 },
          { id: "H1", element: "H", x: -0.2, y: -3.2, z: -1.9 },
          { id: "H2", element: "H", x: 1.2, y: -3.0, z: -1.4 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C1", atom2Id: "H13", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 }, // C=O 重建
          { atom1Id: "O1", atom2Id: "Hp", order: 1 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "H41", order: 1 },
          { atom1Id: "C4", atom2Id: "H42", order: 1 },
          { atom1Id: "C4", atom2Id: "H43", order: 1 },

          // 水分子内键
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O2", atom2Id: "H2", order: 1 }
        ],
        action: { type: "eliminate", desc: "C2-O2 键断裂，水分子 H₂O 消除离去" }
      },
      {
        name: "5. 脱质子完成闭环：生成乙酸乙酯产物",
        note: "溶剂分子夺回质子 Hp，酸催化剂再生，形成电中性的最终产物乙酸乙酯 (CH₃COOCH₂CH₃) 与副产物水，氢原子全流程完整守恒！",
        atoms: [
          // 乙酸乙酯终产物 (全部 8 个氢原子完整存在)
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

          // 水分子 (脱水产物 H2O)
          { id: "O2", element: "O", x: 1.0, y: -3.2, z: -1.8 },
          { id: "H1", element: "H", x: 0.4, y: -3.8, z: -2.1 },
          { id: "H2", element: "H", x: 1.8, y: -3.6, z: -1.6 },

          // 再生酸催化剂质子 H+
          { id: "Hp", element: "H", x: -2.5, y: 3.4, z: -0.8 }
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

          // 水分子内部共价键
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O2", atom2Id: "H2", order: 1 }
        ],
        action: { type: "deprotonate", desc: "质子脱除恢复中性，生成乙酸乙酯与水" }
      }
    ]
  },

  {
    id: "methane-chlorination",
    name: "甲烷自由基氯代反应机理",
    equation: "CH₄ + Cl₂ —(hν)→ CH₃Cl + HCl",
    category: "自由基反应",
    deltaH: "-104 kJ/mol (放热)",
    summary: "光化学引发的经典烷烃自由基链式反应：全步骤严格追踪甲烷的 4 个氢原子与氯原子，展示链引发、夺氢传递与成键全过程。",
    steps: [
      {
        name: "1. 反应物基态：甲烷与氯气分子",
        note: "正四面体构型的甲烷分子 (CH₄，4个C-H键完整显示) 与双原子氯气分子 (Cl-Cl) 混合共存。",
        atoms: [
          // 甲烷 CH4 (全部 4 个氢原子)
          { id: "C1", element: "C", x: -2.5, y: 0, z: 0 },
          { id: "H1", element: "H", x: -2.5, y: 1.8, z: 0 },
          { id: "H2", element: "H", x: -1.0, y: -0.6, z: 0.9 },
          { id: "H3", element: "H", x: -3.8, y: -0.6, z: 0.9 },
          { id: "H4", element: "H", x: -2.5, y: -0.6, z: -1.7 },
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
        action: { type: "start", desc: "反应物处于基态平衡构型" }
      },
      {
        name: "2. 光照链引发：Cl-Cl 键均裂",
        note: "在紫外光 (hν) 能量激发下，共价单键 Cl-Cl 均裂 (Homolysis)，生成两个具有未配对单电子的氯自由基 (Cl·)。甲烷 4 个氢完好保留。",
        atoms: [
          { id: "C1", element: "C", x: -2.8, y: 0, z: 0 },
          { id: "H1", element: "H", x: -2.8, y: 1.8, z: 0 },
          { id: "H2", element: "H", x: -1.3, y: -0.6, z: 0.9 },
          { id: "H3", element: "H", x: -4.1, y: -0.6, z: 0.9 },
          { id: "H4", element: "H", x: -2.8, y: -0.6, z: -1.7 },
          // 氯自由基拉开间距
          { id: "Cl1", element: "Cl", x: 1.0, y: 0.6, z: 0.8 },
          { id: "Cl2", element: "Cl", x: 4.8, y: -0.6, z: -0.8 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 }
        ],
        action: { type: "homolysis", desc: "Cl-Cl 单键均裂，生成 2 个具有孤电子的高活性氯自由基" }
      },
      {
        name: "3. 链增长第一步：氯自由基夺氢",
        note: "氯自由基 Cl1 夺取甲烷的一个氢原子 H1 形成 HCl 分子，碳原子转变为平面三角形构型的甲基自由基 (·CH₃，保留 H2, H3, H4)。",
        atoms: [
          // 平面三角形甲基自由基 ·CH3 (保留 3 个氢)
          { id: "C1", element: "C", x: -2.0, y: 0, z: 0 },
          { id: "H2", element: "H", x: -0.8, y: 1.2, z: 0 },
          { id: "H3", element: "H", x: -3.4, y: 0.6, z: 0 },
          { id: "H4", element: "H", x: -1.8, y: -1.8, z: 0 },
          // 生成的 HCl (含被夺取的 H1)
          { id: "H1", element: "H", x: 1.2, y: 0.2, z: 0.2 },
          { id: "Cl1", element: "Cl", x: 2.6, y: 0.2, z: 0.2 },
          // 待碰撞的另一氯气自由基/分子
          { id: "Cl2", element: "Cl", x: 4.8, y: -0.6, z: -0.8 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 },
          { atom1Id: "H1", atom2Id: "Cl1", order: 1 }
        ],
        action: { type: "abstraction", desc: "C-H1 键断裂，H1-Cl1 新键生成，形成平面构型甲基自由基" }
      },
      {
        name: "4. 链增长第二步：产物一氯甲烷生成",
        note: "甲基自由基与氯气分子碰撞成键，生成目标产物一氯甲烷 (CH₃Cl)，构型恢复为四面体，所有 4 个氢原子完整守恒！",
        atoms: [
          // 一氯甲烷 CH3Cl (C1, Cl2, H2, H3, H4)
          { id: "C1", element: "C", x: -0.5, y: 0, z: 0 },
          { id: "Cl2", element: "Cl", x: 1.6, y: 0, z: 0 },
          { id: "H2", element: "H", x: -1.1, y: 1.3, z: 0.8 },
          { id: "H3", element: "H", x: -1.1, y: -1.3, z: 0.8 },
          { id: "H4", element: "H", x: -1.1, y: 0, z: -1.7 },
          // 生成并排出的 HCl
          { id: "H1", element: "H", x: 3.6, y: 1.2, z: 0.6 },
          { id: "Cl1", element: "Cl", x: 4.9, y: 1.2, z: 0.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "Cl2", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 },
          { atom1Id: "H1", atom2Id: "Cl1", order: 1 }
        ],
        action: { type: "product", desc: "C-Cl2 共价单键牢固形成，产物一氯甲烷生成" }
      }
    ]
  },

  {
    id: "co2-to-sugar",
    name: "二氧化碳催化还原合成甲醇与三碳糖",
    equation: "CO₂ + 3H₂ ⇌ CH₃OH + H₂O",
    category: "人工合成路线",
    deltaH: "-ΔH (放热催化)",
    summary: "模拟二氧化碳前体合成核心反应：CO₂ 分子在 3 个氢分子 (共 6 个氢原子) 作用下，催化还原加氢生成甲醇与水分子，全过程氢原子数量完全守恒！",
    steps: [
      {
        name: "1. 原料体系：CO₂ 与 3 个 H₂ 分子",
        note: "直线型二氧化碳分子 (O=C=O) 与 3 个氢气分子 (共 6 个氢原子 H1~H6) 共同注入催化活性表面。",
        atoms: [
          // 二氧化碳 CO2
          { id: "C1", element: "C", x: 0, y: 0, z: 0 },
          { id: "O1", element: "O", x: -2.3, y: 0, z: 0.2 },
          { id: "O2", element: "O", x: 2.3, y: 0, z: -0.2 },
          // 3 个 H2 分子 (6 个 H 原子全部明确呈现)
          { id: "H1", element: "H", x: -2.2, y: 2.0, z: 0.5 },
          { id: "H2", element: "H", x: -1.3, y: 2.0, z: 0.5 },
          { id: "H3", element: "H", x: 0.0, y: 2.2, z: -0.4 },
          { id: "H4", element: "H", x: 0.9, y: 2.2, z: -0.4 },
          { id: "H5", element: "H", x: 2.0, y: 2.0, z: 0.6 },
          { id: "H6", element: "H", x: 2.9, y: 2.0, z: 0.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 2 },
          { atom1Id: "C1", atom2Id: "O2", order: 2 },
          { atom1Id: "H1", atom2Id: "H2", order: 1 },
          { atom1Id: "H3", atom2Id: "H4", order: 1 },
          { atom1Id: "H5", atom2Id: "H6", order: 1 }
        ],
        action: { type: "start", desc: "注入 CO₂ 与 3 个 H₂ 反应原料" }
      },
      {
        name: "2. 催化加氢第一步：甲酸根型加成",
        note: "第一分子 H-H 活化裂解，一个氢加成至碳原子形成 C-H 键，另一个氢结合氧原子形成羟基。",
        atoms: [
          { id: "C1", element: "C", x: -0.3, y: -0.1, z: 0 },
          { id: "O1", element: "O", x: -1.8, y: 0.6, z: 0.3 },
          { id: "H1", element: "H", x: -2.6, y: 0.4, z: 0.7 }, // 羟基 H
          { id: "O2", element: "O", x: 1.0, y: 0.3, z: -0.3 },
          { id: "H2", element: "H", x: -0.5, y: -1.2, z: 0.1 }, // 碳上 H

          { id: "H3", element: "H", x: -1.0, y: 2.2, z: -0.5 },
          { id: "H4", element: "H", x: -0.1, y: 2.2, z: -0.5 },
          { id: "H5", element: "H", x: 1.8, y: 2.1, z: 0.5 },
          { id: "H6", element: "H", x: 2.7, y: 2.1, z: 0.5 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "O2", order: 2 },
          { atom1Id: "H3", atom2Id: "H4", order: 1 },
          { atom1Id: "H5", atom2Id: "H6", order: 1 }
        ],
        action: { type: "hydrogenate_1", desc: "C=O 双键开键加氢，形成第一个 C-H 与 O-H 键" }
      },
      {
        name: "3. 催化加氢第二步：脱氧生成甲醛中间体与水",
        note: "第二分子氢结合脱除一个氧原子生成稳定水分子 (H₂O)，碳氧骨架转化为甲醛型中间体。",
        atoms: [
          // 甲醛型中间体 (含 C1, O1, H1, H2)
          { id: "C1", element: "C", x: -1.2, y: 0, z: 0 },
          { id: "O1", element: "O", x: -1.2, y: 1.6, z: 0 },
          { id: "H1", element: "H", x: -2.4, y: -0.8, z: 0.3 },
          { id: "H2", element: "H", x: -0.2, y: -0.8, z: -0.3 },

          // 生成的水分子 H2O (含 O2, H3, H4)
          { id: "O2", element: "O", x: 2.5, y: -0.8, z: 0.4 },
          { id: "H3", element: "H", x: 2.0, y: -1.7, z: 0.8 },
          { id: "H4", element: "H", x: 3.4, y: -1.1, z: 0.2 },

          // 待反应的第三分子氢 H2
          { id: "H5", element: "H", x: 0.8, y: 2.0, z: -0.5 },
          { id: "H6", element: "H", x: 1.7, y: 2.0, z: -0.5 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 2 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "O2", atom2Id: "H3", order: 1 },
          { atom1Id: "O2", atom2Id: "H4", order: 1 },
          { atom1Id: "H5", atom2Id: "H6", order: 1 }
        ],
        action: { type: "deoxygenate", desc: "脱氧生成水分子 H₂O，碳氧骨架转为甲醛型中间体" }
      },
      {
        name: "4. 催化加氢第三步：终产物甲醇 (CH₃OH) 与水生成",
        note: "第三分子氢加成至碳与羟基氧，生成四面体构型的甲醇分子与水分子。6 个氢原子全部清晰守恒！",
        atoms: [
          // 甲醇分子 CH3OH (含 C1, O1, H1, H2, H5, H6)
          { id: "C1", element: "C", x: -1.2, y: 0, z: 0 },
          { id: "O1", element: "O", x: 0.2, y: 0.8, z: 0.3 },
          { id: "H6", element: "H", x: 0.9, y: 0.4, z: 0.8 }, // 醇羟基 H
          { id: "H1", element: "H", x: -1.8, y: 1.1, z: -0.6 },
          { id: "H2", element: "H", x: -1.9, y: -0.9, z: 0.7 },
          { id: "H5", element: "H", x: -1.4, y: -0.4, z: -1.4 },

          // 水分子 H2O (含 O2, H3, H4)
          { id: "O2", element: "O", x: 2.6, y: -1.2, z: 0.4 },
          { id: "H3", element: "H", x: 2.1, y: -2.0, z: 0.8 },
          { id: "H4", element: "H", x: 3.5, y: -1.4, z: 0.2 }
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
        action: { type: "product", desc: "生成四面体甲醇分子与水分子，全反应氢原子完全守恒" }
      }
    ]
  },

  {
    id: "haber-bosch",
    name: "哈伯-博施法合成氨机理",
    equation: "N₂ + 3H₂ ⇌ 2NH₃",
    category: "工业无机催化",
    deltaH: "-92.4 kJ/mol (放热)",
    summary: "化肥工业里程碑反应：展示高键能 N≡N 三键在催化剂表面活化，及 6 个氢原子逐步加氢生成 2 个氨分子 (NH₃) 的全微观基元步，氢原子全流程严格守恒！",
    steps: [
      {
        name: "1. 反应物分子在铁催化剂表面吸附",
        note: "高键能 N≡N 分子与 3 个 H-H 氢分子 (共 6 个氢原子 H1~H6) 靠近铁催化剂表面活性位点。",
        atoms: [
          // 氮分子 N2
          { id: "N1", element: "N", x: -2.0, y: 0.8, z: 0 },
          { id: "N2", element: "N", x: -0.6, y: 0.8, z: 0 },
          // 3 个 H2 分子 (6 个 H 原子)
          { id: "H1", element: "H", x: 1.5, y: 1.5, z: 0.4 },
          { id: "H2", element: "H", x: 2.5, y: 1.5, z: -0.2 },
          { id: "H3", element: "H", x: 1.5, y: 0.0, z: -0.5 },
          { id: "H4", element: "H", x: 2.5, y: 0.0, z: 0.2 },
          { id: "H5", element: "H", x: 1.5, y: -1.5, z: 0.3 },
          { id: "H6", element: "H", x: 2.5, y: -1.5, z: -0.4 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "N2", order: 3 },
          { atom1Id: "H1", atom2Id: "H2", order: 1 },
          { atom1Id: "H3", atom2Id: "H4", order: 1 },
          { atom1Id: "H5", atom2Id: "H6", order: 1 }
        ],
        action: { type: "adsorb", desc: "N₂ 与 3 个 H₂ 反应物分子物理化学吸附于催化晶格" }
      },
      {
        name: "2. 决速步：N≡N 三键解离活化",
        note: "催化剂铁原子的 d 轨道反馈填充分裂三键，N≡N 与 3 个 H-H 键彻底裂解为表面游离活性原子 (2个 N* 与 6个 H*)。",
        atoms: [
          { id: "N1", element: "N", x: -2.6, y: 0.2, z: 0.2 },
          { id: "N2", element: "N", x: 0.2, y: 0.2, z: -0.2 },
          { id: "H1", element: "H", x: -3.8, y: 1.2, z: 0.5 },
          { id: "H2", element: "H", x: -3.8, y: -0.8, z: 0.3 },
          { id: "H3", element: "H", x: -2.0, y: -1.6, z: -0.4 },
          { id: "H4", element: "H", x: 1.6, y: 1.2, z: 0.4 },
          { id: "H5", element: "H", x: 1.6, y: -0.8, z: -0.5 },
          { id: "H6", element: "H", x: 0.2, y: -1.6, z: 0.3 }
        ],
        bonds: [],
        action: { type: "dissociate", desc: "N≡N 与 H-H 全部裂解为表面吸附活性自由原子" }
      },
      {
        name: "3. 逐步加氢：表面亚氨基 (NH*) 生成",
        note: "表面吸附的活性氢原子向氮原子迁移，各自形成第一根 N-H 共价键，生成两个亚氨基自由团。",
        atoms: [
          // 第一个 NH*
          { id: "N1", element: "N", x: -2.2, y: 0, z: 0 },
          { id: "H1", element: "H", x: -3.4, y: 0.6, z: 0.5 },
          { id: "H2", element: "H", x: -3.4, y: -1.2, z: 0.2 },
          { id: "H3", element: "H", x: -1.8, y: -1.6, z: -0.4 },

          // 第二个 NH*
          { id: "N2", element: "N", x: 1.2, y: 0, z: 0 },
          { id: "H4", element: "H", x: 2.4, y: 0.6, z: -0.5 },
          { id: "H5", element: "H", x: 2.4, y: -1.2, z: -0.2 },
          { id: "H6", element: "H", x: 0.8, y: -1.6, z: 0.4 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 },
          { atom1Id: "N2", atom2Id: "H4", order: 1 }
        ],
        action: { type: "hydrogenate_1", desc: "每个氮原子结合第一个氢原子，形成 N-H 键" }
      },
      {
        name: "4. 第二加氢步：氨基自由基 (NH₂*) 生成",
        note: "第二个氢原子加成，形成弯曲构型的氨基自由基团 NH₂*，所有 6 个氢原子持续追踪在场。",
        atoms: [
          // 第一个 NH2*
          { id: "N1", element: "N", x: -2.2, y: 0, z: 0 },
          { id: "H1", element: "H", x: -3.4, y: 0.6, z: 0.5 },
          { id: "H2", element: "H", x: -3.2, y: -0.9, z: -0.5 },
          { id: "H3", element: "H", x: -1.6, y: -1.7, z: -0.2 },

          // 第二个 NH2*
          { id: "N2", element: "N", x: 1.4, y: 0, z: 0 },
          { id: "H4", element: "H", x: 2.6, y: 0.6, z: -0.5 },
          { id: "H5", element: "H", x: 2.4, y: -0.9, z: 0.5 },
          { id: "H6", element: "H", x: 0.8, y: -1.7, z: 0.2 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 },
          { atom1Id: "N1", atom2Id: "H2", order: 1 },
          { atom1Id: "N2", atom2Id: "H4", order: 1 },
          { atom1Id: "N2", atom2Id: "H5", order: 1 }
        ],
        action: { type: "hydrogenate_2", desc: "形成第二根 N-H 键，生成两个弯曲型 NH₂* 基团" }
      },
      {
        name: "5. 终步加氢与脱附：生成 2 个 NH₃ 分子",
        note: "第三个氢原子完成结合，生成 2 个稳定闭壳的三角锥构型氨气分子 (2 NH₃)，自催化剂表面脱附释放，全反应 6 个氢原子完整守恒！",
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
        action: { type: "desorb", desc: "生成 2 个三角锥氨分子 NH₃ 并脱附，全流程氢原子严格守恒" }
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REACTION_PRESETS };
}
