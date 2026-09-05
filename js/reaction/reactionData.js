/**
 * Chemiation - Chemical Reaction Principle & Mechanism Data
 * 化学反应原理与机理推演数据集
 * 每个步骤均包含各原子的精确 3D 空间坐标、化学键连接拓扑与详细机理注解
 */

const REACTION_PRESETS = [
  {
    id: "co2-to-sugar",
    name: "二氧化碳人工全合成糖反应",
    equation: "CO₂ → CH₃OH → DHA → DHAP → F-1,6-BP → G-6-P",
    category: "人工合成路线",
    deltaH: "-ΔH (放热缩合)",
    summary: "模拟中科院突破性二氧化碳人工全合成淀粉/己糖的前体合成核心路径：从单碳原料到高活性三碳酮糖，再经醛醇缩合构筑六碳环糖骨架。",
    steps: [
      {
        name: "二氧化碳基态原料",
        note: "反应原料 CO₂ 分子，碳原子与两个氧原子形成直线型强共价双键结构 (O=C=O)，化学稳定性极高。",
        atoms: [
          { id: "C1", element: "C", x: 0, y: 0, z: 0 },
          { id: "O1", element: "O", x: -2.3, y: 0, z: 0.3 },
          { id: "O2", element: "O", x: 2.3, y: 0, z: -0.3 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 2 },
          { atom1Id: "C1", atom2Id: "O2", order: 2 }
        ],
        action: { type: "start", desc: "注入 CO₂ 原料分子" }
      },
      {
        name: "催化加氢还原为甲醇 (CH₃OH)",
        note: "在催化剂与氢能驱动下，断开一个 C=O 双键并脱氧生成水，碳原子被多步加氢还原为四面体构型的甲醇。",
        atoms: [
          { id: "C1", element: "C", x: 0, y: 0, z: 0 },
          { id: "O1", element: "O", x: 1.8, y: 0.8, z: 0.4 },
          { id: "H1", element: "H", x: 2.7, y: 0.6, z: 1.0 },
          { id: "H2", element: "H", x: -0.7, y: 1.3, z: -0.8 },
          { id: "H3", element: "H", x: -0.8, y: -1.0, z: 0.9 },
          { id: "H4", element: "H", x: -0.5, y: -0.4, z: -1.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 }
        ],
        action: { type: "reduce", desc: "C=O 双键断裂还原，形成甲醇羟基与甲基" }
      },
      {
        name: "碳链缩合生成二羟基丙酮 (DHA)",
        note: "碳链聚合酶催化 C-C 偶联增长，将单碳分子级联缩合为三碳二元酮糖——二羟基丙酮 (1,3-二羟基-2-丙酮)。",
        atoms: [
          { id: "C1", element: "C", x: -2.0, y: -0.4, z: 0.6 },
          { id: "O1", element: "O", x: -3.4, y: -0.8, z: 1.1 },
          { id: "H1", element: "H", x: -4.0, y: -0.2, z: 1.5 },
          { id: "C2", element: "C", x: 0, y: 0.6, z: 0 },
          { id: "O2", element: "O", x: 0, y: 2.3, z: -0.4 },
          { id: "C3", element: "C", x: 2.0, y: -0.4, z: -0.6 },
          { id: "O3", element: "O", x: 3.4, y: -0.8, z: -1.1 },
          { id: "H2", element: "H", x: 4.0, y: -0.2, z: -1.5 },
          { id: "H3", element: "H", x: -1.9, y: -1.5, z: 0.2 },
          { id: "H4", element: "H", x: 1.9, y: -1.5, z: -0.2 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 2 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C3", atom2Id: "H4", order: 1 }
        ],
        action: { type: "form_bond", desc: "C1-C2 与 C2-C3 键生成，形成三碳酮羰基骨架" }
      },
      {
        name: "磷酸化修饰生成磷酸二羟基丙酮 (DHAP)",
        note: "激酶引入高能磷酸根 (-PO₃H₂) 活化一侧末端羟基，生成关键糖代谢前体：磷酸二羟基丙酮 (DHAP)。",
        atoms: [
          { id: "C1", element: "C", x: -3.0, y: -0.5, z: 0.8 },
          { id: "O1", element: "O", x: -4.4, y: -0.9, z: 1.2 },
          { id: "C2", element: "C", x: -1.2, y: 0.5, z: 0.2 },
          { id: "O2", element: "O", x: -1.2, y: 2.1, z: -0.2 },
          { id: "C3", element: "C", x: 0.6, y: -0.4, z: -0.4 },
          { id: "O3", element: "O", x: 1.9, y: 0.2, z: -0.7 },
          { id: "P1", element: "P", x: 3.5, y: -0.4, z: -0.5 },
          { id: "O4", element: "O", x: 3.5, y: -2.0, z: -0.2 },
          { id: "O5", element: "O", x: 4.5, y: 0.1, z: 0.8 },
          { id: "O6", element: "O", x: 4.1, y: 0.2, z: -1.9 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 2 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "P1", order: 1 },
          { atom1Id: "P1", atom2Id: "O4", order: 2 },
          { atom1Id: "P1", atom2Id: "O5", order: 1 },
          { atom1Id: "P1", atom2Id: "O6", order: 1 }
        ],
        action: { type: "attach", desc: "引入磷酸根基团 P(=O)(OH)₂，活化末端" }
      },
      {
        name: "醛醇缩合成键构建果糖骨架 (F-1,6-BP)",
        note: "在醛缩酶催化下，DHAP 与异构体甘油醛进行立体特异性醛醇加成，构建出 6 个碳的 1,6-二磷酸果糖全链。",
        atoms: [
          { id: "C1", element: "C", x: -4.5, y: 0.8, z: 0.5 },
          { id: "C2", element: "C", x: -2.8, y: 0.2, z: 0.2 },
          { id: "O2", element: "O", x: -2.6, y: -1.3, z: 0.3 },
          { id: "C3", element: "C", x: -1.4, y: 1.0, z: -0.4 },
          { id: "O3", element: "O", x: -1.5, y: 2.4, z: -0.6 },
          { id: "C4", element: "C", x: 0.2, y: 0.3, z: -0.3 },
          { id: "O4", element: "O", x: 0.3, y: -1.1, z: -0.1 },
          { id: "C5", element: "C", x: 1.6, y: 1.1, z: 0.3 },
          { id: "O5", element: "O", x: 1.5, y: 2.5, z: 0.5 },
          { id: "C6", element: "C", x: 3.2, y: 0.4, z: 0.6 },
          { id: "O6", element: "O", x: 4.4, y: 1.1, z: 0.9 },
          { id: "P1", element: "P", x: -5.8, y: 1.8, z: 0.8 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "O4", order: 1 },
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "O5", order: 1 },
          { atom1Id: "C5", atom2Id: "C6", order: 1 },
          { atom1Id: "C6", atom2Id: "O6", order: 1 },
          { atom1Id: "C1", atom2Id: "P1", order: 1 }
        ],
        action: { type: "form_bond", desc: "C3-C4 醛醇缩合成键，完成 6 碳连续碳链聚合" }
      },
      {
        name: "异构化重排生成 6-磷酸葡萄糖 (G-6-P)",
        note: "经异构酶催化环化异构与定点脱磷酸酶修饰，生成天然糖代谢核心枢纽产物——6-磷酸葡萄糖 (G-6-P)。",
        atoms: [
          { id: "C1", element: "C", x: -1.6, y: 1.6, z: 0.8 },
          { id: "O1", element: "O", x: -2.3, y: 2.8, z: 1.1 },
          { id: "C2", element: "C", x: -2.1, y: 0.2, z: 0.3 },
          { id: "O2", element: "O", x: -3.5, y: 0.1, z: 0.4 },
          { id: "C3", element: "C", x: -1.2, y: -1.0, z: -0.4 },
          { id: "O3", element: "O", x: -1.7, y: -2.2, z: -0.7 },
          { id: "C4", element: "C", x: 0.3, y: -0.7, z: -0.6 },
          { id: "O4", element: "O", x: 1.1, y: -1.9, z: -1.0 },
          { id: "C5", element: "C", x: 0.9, y: 0.6, z: -0.1 },
          { id: "O5", element: "O", x: 0.1, y: 1.7, z: 0.5 },
          { id: "C6", element: "C", x: 2.4, y: 0.8, z: -0.2 },
          { id: "O6", element: "O", x: 2.9, y: 2.1, z: 0.2 },
          { id: "P1", element: "P", x: 4.4, y: 2.7, z: 0.3 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "O4", order: 1 },
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "O5", order: 1 },
          { atom1Id: "O5", atom2Id: "C1", order: 1 },
          { atom1Id: "C5", atom2Id: "C6", order: 1 },
          { atom1Id: "C6", atom2Id: "O6", order: 1 },
          { atom1Id: "O6", atom2Id: "P1", order: 1 }
        ],
        action: { type: "isomerize", desc: "半缩醛环化成六元吡喃环，稳定终产物生成" }
      }
    ]
  },

  {
    id: "esterification",
    name: "乙酸与乙醇的费歇尔酯化反应",
    equation: "CH₃COOH + CH₃CH₂OH ⇌ CH₃COOCH₂CH₃ + H₂O",
    category: "经典有机机理",
    deltaH: "-ΔH (平衡放热)",
    summary: "羧酸与醇在酸催化下的可逆亲核酰基取代反应机理，清晰展示质子化活化羰基、醇氧亲核进攻、质子转移与脱水过程。",
    steps: [
      {
        name: "乙酸与乙醇反应底物",
        note: "乙酸分子（左侧，含羰基 C=O 与羟基）与乙醇分子（右侧，亲核醇羟基）在酸性溶剂中互相靠近。",
        atoms: [
          // 乙酸 CH3COOH
          { id: "C1", element: "C", x: -4.2, y: -0.6, z: 0.4 },
          { id: "C2", element: "C", x: -2.6, y: 0.2, z: 0 },
          { id: "O1", element: "O", x: -2.4, y: 1.6, z: -0.3 },
          { id: "O2", element: "O", x: -1.5, y: -0.7, z: 0.3 },
          { id: "H1", element: "H", x: -0.6, y: -0.4, z: 0.4 },
          // 乙醇 CH3CH2OH
          { id: "O3", element: "O", x: 1.8, y: 0.4, z: -0.4 },
          { id: "H2", element: "H", x: 1.6, y: 1.3, z: -0.7 },
          { id: "C3", element: "C", x: 3.1, y: -0.2, z: -0.1 },
          { id: "C4", element: "C", x: 4.5, y: 0.6, z: 0.4 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 }
        ],
        action: { type: "approach", desc: "底物分子扩散并定位于反应范德华半径内" }
      },
      {
        name: "酸催化：羰基氧质子化",
        note: "外界酸性质子 (H⁺) 进攻电负性较强的羰基氧，使羰基碳的正电性显著增强，极大地提高了亲核进攻活性。",
        atoms: [
          { id: "C1", element: "C", x: -4.0, y: -0.6, z: 0.4 },
          { id: "C2", element: "C", x: -2.5, y: 0.2, z: 0 },
          { id: "O1", element: "O", x: -2.3, y: 1.7, z: -0.3 },
          { id: "Hp", element: "H", x: -2.8, y: 2.6, z: -0.6 },
          { id: "O2", element: "O", x: -1.4, y: -0.7, z: 0.3 },
          { id: "H1", element: "H", x: -0.5, y: -0.4, z: 0.4 },
          { id: "O3", element: "O", x: 1.5, y: 0.3, z: -0.3 },
          { id: "H2", element: "H", x: 1.4, y: 1.2, z: -0.6 },
          { id: "C3", element: "C", x: 2.8, y: -0.2, z: -0.1 },
          { id: "C4", element: "C", x: 4.2, y: 0.6, z: 0.4 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "Hp", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 }
        ],
        action: { type: "protonate", desc: "羰基氧捕获质子，C=O 转变为活化单键 C-OH⁺" }
      },
      {
        name: "亲核进攻：形成四面体共价中间体",
        note: "乙醇的羟基氧原子孤对电子亲核进攻带正电的羰基碳原子，生成具有四面体杂化特性的关键中间体。",
        atoms: [
          { id: "C1", element: "C", x: -2.8, y: -1.2, z: 0.8 },
          { id: "C2", element: "C", x: -1.2, y: -0.4, z: 0.1 },
          { id: "O1", element: "O", x: -1.6, y: 1.0, z: -0.5 },
          { id: "Hp", element: "H", x: -2.4, y: 1.4, z: -0.8 },
          { id: "O2", element: "O", x: -1.1, y: -1.2, z: -1.2 },
          { id: "H1", element: "H", x: -1.5, y: -2.1, z: -1.3 },
          { id: "O3", element: "O", x: 0.2, y: 0.2, z: 0.5 },
          { id: "H2", element: "H", x: 0.2, y: 1.1, z: 0.9 },
          { id: "C3", element: "C", x: 1.5, y: -0.4, z: 0.2 },
          { id: "C4", element: "C", x: 2.8, y: 0.3, z: 0.6 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "Hp", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "H2", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 }
        ],
        action: { type: "form_bond", desc: "C2-O3 新共价单键生成，碳由 sp² 转为 sp³ 四面体" }
      },
      {
        name: "分子内质子转移与消除脱水 (H₂O 离去)",
        note: "氧原子间发生质子快速互变转移，羟基质子化为极佳离去基团水分子 (-OH₂⁺)，随后发生消除并使羰基重新双键化。",
        atoms: [
          // 乙酸乙酯前体
          { id: "C1", element: "C", x: -3.2, y: -0.8, z: 0.5 },
          { id: "C2", element: "C", x: -1.6, y: 0.1, z: 0 },
          { id: "O1", element: "O", x: -1.7, y: 1.5, z: -0.4 },
          { id: "Hp", element: "H", x: -2.3, y: 2.1, z: -0.7 },
          { id: "O3", element: "O", x: -0.3, y: -0.6, z: 0.3 },
          { id: "C3", element: "C", x: 1.0, y: 0.0, z: -0.1 },
          { id: "C4", element: "C", x: 2.3, y: -0.8, z: 0.4 },
          // 离去的水分子 H2O (虚化远离)
          { id: "O2", element: "O", x: 0.8, y: -2.8, z: -1.8 },
          { id: "H1", element: "H", x: 0.2, y: -3.4, z: -2.2 },
          { id: "H2", element: "H", x: 1.6, y: -3.2, z: -1.5 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 },
          { atom1Id: "O1", atom2Id: "Hp", order: 1 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "O2", atom2Id: "H1", order: 1 },
          { atom1Id: "O2", atom2Id: "H2", order: 1 }
        ],
        action: { type: "break_bond", desc: "C2-O2 键断裂，水分子脱附离去，C=O 双键重建" }
      },
      {
        name: "脱去质子：生成终产物乙酸乙酯",
        note: "体系中的溶剂分子夺回多余质子，催化循环闭环完成，最终生成芳香的乙酸乙酯分子。",
        atoms: [
          { id: "C1", element: "C", x: -3.0, y: -0.9, z: 0.5 },
          { id: "C2", element: "C", x: -1.5, y: -0.1, z: 0 },
          { id: "O1", element: "O", x: -1.5, y: 1.4, z: -0.4 },
          { id: "O3", element: "O", x: -0.2, y: -0.8, z: 0.3 },
          { id: "C3", element: "C", x: 1.1, y: -0.1, z: -0.1 },
          { id: "C4", element: "C", x: 2.5, y: -0.9, z: 0.4 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "O1", order: 2 },
          { atom1Id: "C2", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 }
        ],
        action: { type: "deprotonate", desc: "质子脱除恢复中性分子，完成酯化全合成" }
      }
    ]
  },

  {
    id: "methane-chlorination",
    name: "甲烷自由基氯代反应机理",
    equation: "CH₄ + Cl₂ —(hν)→ CH₃Cl + HCl",
    category: "自由基反应",
    deltaH: "-104 kJ/mol (放热)",
    summary: "光化学引发的经典烷烃自由基链式反应：包含光照链引发、高活性氯自由基夺氢链增长、以及生成一氯甲烷的闭环反应。",
    steps: [
      {
        name: "反应物基态：甲烷与氯气分子",
        note: "正四面体构型的甲烷分子 (CH₄) 与双原子氯气分子 (Cl-Cl) 混合共存。",
        atoms: [
          // 甲烷 CH4
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
        action: { type: "start", desc: "底物处于暗态基态" }
      },
      {
        name: "光照链引发：Cl-Cl 键均裂",
        note: "在紫外光照 (hν) 激发下，弱共价单键 Cl-Cl 发生均裂 (Homolysis)，各自分走一个电子生成两个高活性氯自由基 (Cl·)。",
        atoms: [
          { id: "C1", element: "C", x: -2.8, y: 0, z: 0 },
          { id: "H1", element: "H", x: -2.8, y: 1.8, z: 0 },
          { id: "H2", element: "H", x: -1.3, y: -0.6, z: 0.9 },
          { id: "H3", element: "H", x: -4.1, y: -0.6, z: 0.9 },
          { id: "H4", element: "H", x: -2.8, y: -0.6, z: -1.7 },
          // 两个氯自由基拉开距离
          { id: "Cl1", element: "Cl", x: 1.0, y: 0.5, z: 0.8 },
          { id: "Cl2", element: "Cl", x: 4.8, y: -0.5, z: -0.8 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 }
        ],
        action: { type: "homolysis", desc: "Cl-Cl 单键均裂，生成 2 个具有单电子的氯自由基" }
      },
      {
        name: "链增长第一步：氯自由基夺氢生成甲基自由基",
        note: "活性极高的氯自由基从甲烷中夺取一个氢原子生成 HCl，碳原子失去一个共价键转变为平面三角形的甲基自由基 (·CH₃)。",
        atoms: [
          // 平面三角形甲基自由基
          { id: "C1", element: "C", x: -2.0, y: 0, z: 0 },
          { id: "H2", element: "H", x: -0.8, y: 1.2, z: 0 },
          { id: "H3", element: "H", x: -3.4, y: 0.6, z: 0 },
          { id: "H4", element: "H", x: -1.8, y: -1.8, z: 0 },
          // 生成的 HCl
          { id: "H1", element: "H", x: 1.8, y: 0, z: 0.2 },
          { id: "Cl1", element: "Cl", x: 3.2, y: 0, z: 0.2 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 },
          { atom1Id: "H1", atom2Id: "Cl1", order: 1 }
        ],
        action: { type: "radical_transfer", desc: "C-H 键均裂，H-Cl 新键生成，甲基自由基形成平面杂化" }
      },
      {
        name: "链增长第二步：生成产物一氯甲烷 (CH₃Cl)",
        note: "甲基自由基与另一分子 Cl₂ 碰撞夺取氯原子，生成目标产物一氯甲烷，同时再生出一个新的氯自由基继续循环链反应。",
        atoms: [
          { id: "C1", element: "C", x: 0, y: 0, z: 0 },
          { id: "Cl1", element: "Cl", x: 2.2, y: 0, z: 0 },
          { id: "H2", element: "H", x: -0.6, y: 1.3, z: 0.8 },
          { id: "H3", element: "H", x: -0.6, y: -1.3, z: 0.8 },
          { id: "H4", element: "H", x: -0.6, y: 0, z: -1.7 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "Cl1", order: 1 },
          { atom1Id: "C1", atom2Id: "H2", order: 1 },
          { atom1Id: "C1", atom2Id: "H3", order: 1 },
          { atom1Id: "C1", atom2Id: "H4", order: 1 }
        ],
        action: { type: "product", desc: "C-Cl 新共价键稳固生成，四面体构型恢复" }
      }
    ]
  },

  {
    id: "haber-bosch",
    name: "哈伯-博施法合成氨多步机理",
    equation: "N₂ + 3H₂ ⇌ 2NH₃",
    category: "工业无机催化",
    deltaH: "-92.4 kJ/mol (放热)",
    summary: "化肥工业里程碑反应：展示高键能氮氮三键在过渡金属催化剂表面的解离吸附，及三个连续加氢生成氨气分子的微观基元反应步奏。",
    steps: [
      {
        name: "氮气与氢气分子表面吸附",
        note: "具有极高键能 (945 kJ/mol) 的 N≡N 分子与 H-H 分子靠近铁基催化剂活性位点。",
        atoms: [
          { id: "N1", element: "N", x: -1.8, y: 0.8, z: 0 },
          { id: "N2", element: "N", x: -0.2, y: 0.8, z: 0 },
          { id: "H1", element: "H", x: 2.2, y: 1.2, z: 0.4 },
          { id: "H2", element: "H", x: 3.2, y: 1.2, z: -0.4 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "N2", order: 3 },
          { atom1Id: "H1", atom2Id: "H2", order: 1 }
        ],
        action: { type: "adsorb", desc: "反应物物理与化学吸附于催化位点" }
      },
      {
        name: "决速步：N≡N 三键解离活化",
        note: "金属铁的 d 电子反馈活化削弱了三键，氮分子与氢分子解离为表面吸附态的孤立氮原子 (N*) 与氢原子 (H*)。",
        atoms: [
          { id: "N1", element: "N", x: -2.8, y: 0, z: 0.2 },
          { id: "N2", element: "N", x: 0.8, y: 0, z: -0.2 },
          { id: "H1", element: "H", x: 2.5, y: 1.4, z: 0.6 },
          { id: "H2", element: "H", x: 3.5, y: -1.2, z: -0.6 }
        ],
        bonds: [],
        action: { type: "dissociate", desc: "N≡N 三键完全解离，成为吸附活性原子" }
      },
      {
        name: "第一加氢步：亚氨基 (NH*) 生成",
        note: "吸附态氢原子在表面扩散并与活性氮原子碰撞成键，形成第一步加氢产物 NH*。",
        atoms: [
          { id: "N1", element: "N", x: -0.6, y: 0, z: 0 },
          { id: "H1", element: "H", x: 0.8, y: 0.7, z: 0.5 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 }
        ],
        action: { type: "hydrogenate_1", desc: "N-H 单键形成" }
      },
      {
        name: "第二加氢步：氨基 (NH₂*) 生成",
        note: "第二个吸附态氢原子加成，生成具有弯曲构型的氨基自由基团 NH₂*。",
        atoms: [
          { id: "N1", element: "N", x: 0, y: 0.2, z: 0 },
          { id: "H1", element: "H", x: -1.2, y: -0.8, z: 0.5 },
          { id: "H2", element: "H", x: 1.2, y: -0.8, z: -0.5 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 },
          { atom1Id: "N1", atom2Id: "H2", order: 1 }
        ],
        action: { type: "hydrogenate_2", desc: "第二根 N-H 键生成，构型展开" }
      },
      {
        name: "第三加氢步：三角锥氨气分子脱附 (NH₃↑)",
        note: "第三个氢原子完成结合，生成达到八隅体闭壳稳定的三角锥构型氨分子 (NH₃)，自催化剂表面脱附释放。",
        atoms: [
          { id: "N1", element: "N", x: 0, y: 0.8, z: 0 },
          { id: "H1", element: "H", x: 0, y: -0.5, z: 1.6 },
          { id: "H2", element: "H", x: 1.4, y: -0.5, z: -0.8 },
          { id: "H3", element: "H", x: -1.4, y: -0.5, z: -0.8 }
        ],
        bonds: [
          { atom1Id: "N1", atom2Id: "H1", order: 1 },
          { atom1Id: "N1", atom2Id: "H2", order: 1 },
          { atom1Id: "N1", atom2Id: "H3", order: 1 }
        ],
        action: { type: "desorb", desc: "三角锥 sp³ 构型氨气分子脱附生成" }
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REACTION_PRESETS };
}
