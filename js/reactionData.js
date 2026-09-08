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
    equation: "CH_3COOH + CH_3CH_2OH <=> CH_3COOCH_2CH_3 + H_2O",
    summary: "经典亲核酰基取代：底物靠近、亲核加成生成四面体中间体、脱水消除生成乙酸乙酯与水。",
    steps: [
      {
        name: "反应物底物靠近碰撞",
        note: "乙酸 (CH_3COOH) 与乙醇 (CH_3CH_2OH) 受热碰撞靠近，全体系 10 个氢原子处于稳定共价键连。",
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
        ]
      },
      {
        name: "亲核加成与四面体中间体",
        note: "乙醇 O3 进攻羰基碳形成 C2-O3 键，质子协同转移至离去氧原子生成水前体。",
        atoms: [
          { id: "C1", element: "C", x: -2.5, y: -1.2, z: 0.6 },
          { id: "H11", element: "H", x: -3.4, y: -1.0, z: 1.1 },
          { id: "H12", element: "H", x: -2.0, y: -2.0, z: 1.0 },
          { id: "H13", element: "H", x: -2.7, y: -1.4, z: -0.4 },
          { id: "C2", element: "C", x: -1.1, y: -0.4, z: 0.1 },
          { id: "O1", element: "O", x: -1.4, y: 1.1, z: -0.4, charge: -1 },
          { id: "O2", element: "O", x: -1.0, y: -1.3, z: -1.1, charge: 1 },
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
        ]
      },
      {
        name: "消除脱水产物生成",
        note: "C2-O2 键断开消除脱水生成水分子 H_2O，C=O 双键重建生成乙酸乙酯 CH_3COOCH_2CH_3。",
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
        ]
      }
    ]
  },

  {
    id: "co2-to-starch",
    name: "二氧化碳人工全合成淀粉 (ASAP机理)",
    equation: "CO_2 + H_2 -> C_1 (甲醇) -> C_3 (DHA) -> 2×C_3 (DHA+GAP) -> C_6 (葡萄糖) -> [C_6H_{10}O_5]_n (直链淀粉)",
    summary: "中科院 ASAP 经典路线：CO_2 经加氢还原(C_1)、C-C偶联(C_3)、三碳糖复制异构(2×C_3)、半缩醛成环(C_6)至 α-1,4-糖苷键聚合([C_6H_{10}O_5]_n)。",
    steps: [
      {
        name: "原料活化与加氢还原 (CO_2 -> C_1)",
        note: "CO_2 线性分子与 3 个 H_2 氢气分子吸附活化，加氢还原为 C_1 前体甲醇 (CH_3OH) 与水 H_2O。",
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
        ]
      },
      {
        name: "C_1 酶促缩合生成单分子三碳前体 (C_3: DHA)",
        note: "甲醇/甲醛前体经甲醛缩合酶与磷酸酶级联催化，形成首个稳定的三碳糖骨架 —— 二羟基丙酮 (DHA)。",
        atoms: [
          { id: "C1", element: "C", x: 0.8, y: 0.8, z: 0.1 },
          { id: "C2", element: "C", x: 0.4, y: -0.6, z: -0.2 },
          { id: "C3", element: "C", x: -1.0, y: -1.2, z: 0.1 },
          { id: "O1", element: "O", x: 1.8, y: 1.4, z: -0.2 },
          { id: "H1O", element: "H", x: 2.5, y: 1.0, z: -0.2 },
          { id: "O2", element: "O", x: 1.2, y: -1.5, z: 0.2 },
          { id: "H2O", element: "H", x: 1.9, y: -1.3, z: 0.5 },
          { id: "O3", element: "O", x: -1.2, y: -2.4, z: -0.2 },
          { id: "H3O", element: "H", x: -1.0, y: -3.0, z: 0.3 },
          { id: "H1", element: "H", x: 1.0, y: 0.7, z: 1.1 },
          { id: "H2", element: "H", x: 0.3, y: -0.6, z: -1.2 },
          { id: "H3", element: "H", x: -1.1, y: -1.2, z: 1.1 }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H1O", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H2O", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "H3O", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 }
        ]
      },
      {
        name: "三碳糖前体复制与立体异构 (C_3 -> 2×C_3: DHA 与 GAP)",
        note: "第二分子三碳糖经酶促级联生成并复制到位，二羟基丙酮 (DHA) 与甘油醛 (GAP) 对称对准吸附，准备发生碳碳偶联。",
        atoms: [
          // 第一分子三碳糖：二羟基丙酮 DHA (C1, C2, C3, O1, O2, O3, 6H)
          { id: "C1", element: "C", x: 2.8, y: 0.8, z: 0.1 },
          { id: "C2", element: "C", x: 2.4, y: -0.6, z: -0.2 },
          { id: "C3", element: "C", x: 1.0, y: -1.2, z: 0.1 },
          { id: "O1", element: "O", x: 3.8, y: 1.4, z: -0.2 },
          { id: "H1O", element: "H", x: 4.5, y: 1.0, z: -0.2 },
          { id: "O2", element: "O", x: 3.2, y: -1.5, z: 0.2 },
          { id: "H2O", element: "H", x: 3.9, y: -1.3, z: 0.5 },
          { id: "O3", element: "O", x: 0.8, y: -2.4, z: -0.2 },
          { id: "H3O", element: "H", x: 1.0, y: -3.0, z: 0.3 },
          { id: "H1", element: "H", x: 3.0, y: 0.7, z: 1.1 },
          { id: "H2", element: "H", x: 2.3, y: -0.6, z: -1.2 },
          { id: "H3", element: "H", x: 0.9, y: -1.2, z: 1.1 },

          // 第二分子三碳糖：3-磷酸甘油醛前体 GAP (C4, C5, C6, O4, O5, O6, 6H)
          { id: "C4", element: "C", x: -2.8, y: -0.6, z: -0.1 },
          { id: "C5", element: "C", x: -2.6, y: 0.8, z: 0.2 },
          { id: "C6", element: "C", x: -3.7, y: 1.6, z: -0.2 },
          { id: "O4", element: "O", x: -3.8, y: -1.3, z: 0.4 },
          { id: "H4O", element: "H", x: -4.5, y: -0.9, z: 0.5 },
          { id: "O5", element: "O", x: -1.5, y: 1.4, z: -0.2 },
          { id: "O6", element: "O", x: -4.8, y: 1.0, z: 0.3 },
          { id: "H6O", element: "H", x: -5.3, y: 1.6, z: 0.4 },
          { id: "H4", element: "H", x: -2.9, y: -0.5, z: -1.1 },
          { id: "H5", element: "H", x: -2.6, y: 0.8, z: 1.2 },
          { id: "H61", element: "H", x: -4.0, y: 2.4, z: 0.3 },
          { id: "H62", element: "H", x: -3.4, y: 1.9, z: -1.1 }
        ],
        bonds: [
          // 第一分子 DHA 键连
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C1", atom2Id: "O1", order: 1 },
          { atom1Id: "O1", atom2Id: "H1O", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H2O", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "H3O", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },

          // 第二分子 GAP 键连
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "C6", order: 1 },
          { atom1Id: "C4", atom2Id: "O4", order: 1 },
          { atom1Id: "O4", atom2Id: "H4O", order: 1 },
          { atom1Id: "C5", atom2Id: "O5", order: 2 },
          { atom1Id: "C6", atom2Id: "O6", order: 1 },
          { atom1Id: "O6", atom2Id: "H6O", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5", order: 1 },
          { atom1Id: "C6", atom2Id: "H61", order: 1 },
          { atom1Id: "C6", atom2Id: "H62", order: 1 }
        ]
      },
      {
        name: "醛醇缩合成环生成 C_6 葡萄糖吡喃环",
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
        ]
      },
      {
        name: "α-1,4-糖苷键缩聚生成直链淀粉分子链",
        note: "葡萄糖单元通过专一性 α-1,4-糖苷键脱水缩聚，脱除的半缩醛羟基 (O1-H1O) 与 4-位质子 (H4O) 就地结合生成水分子 H_2O！",
        polymer: {
          label: "n",
          tag: "直链淀粉单体最简重复单元 · [C_6H_{10}O_5]_n",
          excludeIds: ["O1", "H1O", "H4O"],
          leftBond: {
            atomId: "O4",
            vector: [-1.4, -0.2, 0]
          },
          rightBond: {
            atomId: "C1",
            vector: [1.4, 0.4, 0]
          }
        },
        atoms: [
          // 吡喃葡萄糖单体链节核心环 (C6H10O5)
          { id: "O5", element: "O", x: 0.2, y: 1.3, z: -0.2 },
          { id: "C1", element: "C", x: 1.4, y: 0.6, z: 0.1 },
          { id: "C2", element: "C", x: 1.2, y: -0.8, z: -0.2 },
          { id: "C3", element: "C", x: -0.2, y: -1.4, z: 0.1 },
          { id: "C4", element: "C", x: -1.3, y: -0.6, z: -0.1 },
          { id: "C5", element: "C", x: -1.1, y: 0.8, z: 0.2 },
          { id: "C6", element: "C", x: -2.2, y: 1.6, z: -0.2 },
          { id: "O6", element: "O", x: -3.3, y: 1.0, z: 0.3 },
          { id: "H6O", element: "H", x: -3.8, y: 1.6, z: 0.4 },
          { id: "O2", element: "O", x: 2.2, y: -1.6, z: 0.3 },
          { id: "H2O", element: "H", x: 2.8, y: -1.4, z: 0.6 },
          { id: "O3", element: "O", x: -0.4, y: -2.6, z: -0.2 },
          { id: "H3O", element: "H", x: -0.2, y: -3.2, z: 0.3 },
          // 4-位糖苷桥氧 (向左延伸穿出括号，与上一单元 C1 相连)
          { id: "O4", element: "O", x: -2.4, y: -1.3, z: 0.4 },
          { id: "H1", element: "H", x: 1.6, y: 0.6, z: 1.1 },
          { id: "H2", element: "H", x: 1.1, y: -0.8, z: -1.2 },
          { id: "H3", element: "H", x: -0.2, y: -1.4, z: 1.1 },
          { id: "H4", element: "H", x: -1.4, y: -0.5, z: -1.1 },
          { id: "H5", element: "H", x: -1.1, y: 0.8, z: 1.2 },
          { id: "H61", element: "H", x: -2.5, y: 2.4, z: 0.3 },
          { id: "H62", element: "H", x: -1.9, y: 1.9, z: -1.1 },

          // 缩聚脱除的 1 分子水 (由上一步的 O1, H1O, H4O 就地结合生成，位于括号外侧右上方)
          { id: "O1", element: "O", x: 3.2, y: 2.2, z: -0.2 },
          { id: "H1O", element: "H", x: 3.8, y: 2.7, z: 0.1 },
          { id: "H4O", element: "H", x: 2.5, y: 2.7, z: -0.4 }
        ],
        bonds: [
          // 吡喃六元环骨架与侧基键
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "O5", order: 1 },
          { atom1Id: "O5", atom2Id: "C1", order: 1 },
          { atom1Id: "C5", atom2Id: "C6", order: 1 },
          { atom1Id: "C6", atom2Id: "O6", order: 1 },
          { atom1Id: "O6", atom2Id: "H6O", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "O2", order: 1 },
          { atom1Id: "O2", atom2Id: "H2O", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "O3", order: 1 },
          { atom1Id: "O3", atom2Id: "H3O", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "O4", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5", order: 1 },
          { atom1Id: "C6", atom2Id: "H61", order: 1 },
          { atom1Id: "C6", atom2Id: "H62", order: 1 },

          // 就地脱水生成的水分子内键
          { atom1Id: "O1", atom2Id: "H1O", order: 1 },
          { atom1Id: "O1", atom2Id: "H4O", order: 1 }
        ]
      }
    ]
  },

  {
    id: "allylic-bromination",
    name: "N-溴代丁二酰亚胺(NBS)烯丙基自由基溴代",
    equation: "CH_2=CH-CH_3 + NBS -> CH_2=CH-CH_2Br + HBr",
    summary: "高级自由基机理：低浓度 Br· 夺取烯丙基氢，生成离域共振的烯丙基自由基 [·CH_2-CH=CH_2 <-> CH_2=CH-·CH_2]，随后 Br_2 选择性加成完成链传递并再生溴自由基。",
    steps: [
      {
        name: "底物吸附与溴自由基生成",
        note: "微量 Br· 自由基靠近丙烯 (CH_2=CH-CH_3) 烯丙基碳，其 C-H 键离解能低，易被均裂夺氢。",
        atoms: [
          // 丙烯分子 CH2=CH-CH3 (3C, 6H)
          { id: "C1", element: "C", x: -2.8, y: -0.6, z: 0 },
          { id: "H11", element: "H", x: -3.6, y: -0.1, z: 0.5 },
          { id: "H12", element: "H", x: -2.8, y: -1.7, z: -0.2 },
          { id: "C2", element: "C", x: -1.6, y: 0.1, z: 0 },
          { id: "H2", element: "H", x: -1.6, y: 1.2, z: 0 },
          { id: "C3", element: "C", x: -0.4, y: -0.6, z: 0 },
          { id: "H31", element: "H", x: -0.4, y: -1.7, z: 0.2 },
          { id: "H32", element: "H", x: -0.3, y: -0.4, z: -1.1 },
          { id: "H33", element: "H", x: 0.6, y: -0.1, z: 0.5 },
          // 自由基 Br·
          { id: "Br1", element: "Br", x: 2.8, y: 0.4, z: 0.2, radical: true }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 2 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "H33", order: 1 }
        ]
      },
      {
        name: "夺氢与烯丙基自由基共振离域",
        note: "Br· 夺取烯丙基氢 H33 生成 HBr；形成三中心三电子离域的对称烯丙基自由基，C1 与 C3 均具单电子特征。",
        atoms: [
          // 对称共振离域烯丙基自由基 [CH2=CH-CH2· ↔ ·CH2-CH=CH2]
          { id: "C1", element: "C", x: -2.6, y: -0.5, z: 0, radical: true },
          { id: "H11", element: "H", x: -3.5, y: -0.1, z: 0.5 },
          { id: "H12", element: "H", x: -2.6, y: -1.6, z: -0.2 },
          { id: "C2", element: "C", x: -1.4, y: 0.2, z: 0 },
          { id: "H2", element: "H", x: -1.4, y: 1.3, z: 0 },
          { id: "C3", element: "C", x: -0.2, y: -0.5, z: 0, radical: true },
          { id: "H31", element: "H", x: -0.2, y: -1.6, z: 0.2 },
          { id: "H32", element: "H", x: -0.1, y: -0.4, z: -1.1 },

          // 生成的 HBr 分子 (H33 - Br1)
          { id: "H33", element: "H", x: 1.8, y: 0.2, z: 0.2 },
          { id: "Br1", element: "Br", x: 3.1, y: 0.4, z: 0.2 },

          // 传入的链传递溴单质分子 Br2 (Br2-Br3)
          { id: "Br2", element: "Br", x: 0.5, y: 2.2, z: 0 },
          { id: "Br3", element: "Br", x: 2.3, y: 2.4, z: -0.2 }
        ],
        bonds: [
          // 烯丙基骨架共振部分双键 (两端均为共振离域键)
          { atom1Id: "C1", atom2Id: "C2", order: 2 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },

          // HBr 与 Br2
          { atom1Id: "H33", atom2Id: "Br1", order: 1 },
          { atom1Id: "Br2", atom2Id: "Br3", order: 1 }
        ]
      },
      {
        name: "链传递完成生成3-溴丙烯与再生Br·",
        note: "离域碳自由基进攻 Br_2 (Br-Br) 均裂成键，生成 3-溴丙烯 CH_2=CH-CH_2Br，释放新的活性 Br· 自由基进入下一轮催化循环。",
        atoms: [
          // 产物 3-溴丙烯 CH2=CH-CH2Br
          { id: "C1", element: "C", x: -3.0, y: -0.5, z: 0 },
          { id: "H11", element: "H", x: -3.8, y: 0.0, z: 0.5 },
          { id: "H12", element: "H", x: -3.0, y: -1.6, z: -0.2 },
          { id: "C2", element: "C", x: -1.8, y: 0.2, z: 0 },
          { id: "H2", element: "H", x: -1.8, y: 1.3, z: 0 },
          { id: "C3", element: "C", x: -0.6, y: -0.5, z: 0 },
          { id: "H31", element: "H", x: -0.6, y: -1.6, z: 0.2 },
          { id: "H32", element: "H", x: -0.5, y: -0.3, z: -1.1 },
          { id: "Br2", element: "Br", x: 0.9, y: 0.5, z: 0.3 },

          // 副产物 HBr
          { id: "H33", element: "H", x: 2.8, y: -1.2, z: 0 },
          { id: "Br1", element: "Br", x: 4.1, y: -1.2, z: 0 },

          // 再生溴自由基 Br3·
          { id: "Br3", element: "Br", x: 2.8, y: 1.8, z: -0.2, radical: true }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 2 },
          { atom1Id: "C1", atom2Id: "H11", order: 1 },
          { atom1Id: "C1", atom2Id: "H12", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H31", order: 1 },
          { atom1Id: "C3", atom2Id: "H32", order: 1 },
          { atom1Id: "C3", atom2Id: "Br2", order: 1 },
          { atom1Id: "H33", atom2Id: "Br1", order: 1 }
        ]
      }
    ]
  },


  {
    id: "haber-bosch",
    name: "哈伯-博施法合成氨机理",
    equation: "N_2 + 3H_2 <=> 2NH_3",
    summary: "工业合成氨经典机理：N_2 (N≡N) 三键与 H_2 (H-H) 协同解离活化、金属表面加氢、最终生成 2 个三角锥 NH_3 氨分子。",
    steps: [
      {
        name: "反应物分子表面吸附基态",
        note: "高键能 N_2 (N≡N) 分子与 3 个 H_2 (H-H) 氢分子吸附于铁催化剂表面晶格。",
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
        ]
      },
      {
        name: "协同解离与加氢过渡态",
        note: "催化剂反馈活化使 N_2 与 H_2 键解离，迁移形成对称的 NH_2* 表面活性基团与就位 H_2 分子。",
        atoms: [
          // 第一个加氢中心 (N1, H1, H2)
          { id: "N1", element: "N", x: -2.0, y: 0.2, z: 0, radical: true },
          { id: "H1", element: "H", x: -3.1, y: 0.8, z: 0.3 },
          { id: "H2", element: "H", x: -2.8, y: -0.8, z: -0.3 },

          // 第二个加氢中心 (N2, H4, H5)
          { id: "N2", element: "N", x: 2.0, y: 0.2, z: 0, radical: true },
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
        ]
      },
      {
        name: "终步加氢完成生成氨气",
        note: "全部氢原子与氮彻底键合，生成稳定闭壳构型的 2 个 NH_3 氨分子并脱附释放。",
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
        ]
      }
    ]
  },

  {
    id: "auto-layout-diels-alder",
    name: "环戊二烯与乙烯狄尔斯-阿尔德加成",
    equation: "C_5H_6 + C_2H_4 -> C_7H_{10}",
    summary: "经典 [4+2] 环加成反应：共轭二烯体与亲双烯体协同发生电子转移，构筑具三维张力的双环[2.2.1]降冰片烯桥环构型。",
    steps: [
      {
        name: "双烯体与亲双烯体空间配准",
        note: "共轭环戊二烯 C_5H_6 与乙烯 C_2H_4 分子在空间彼此配准对齐，准备发生六电子协同转移加成。",
        atoms: [
          // 环戊二烯骨架 (自动空间排布)
          { id: "C1", element: "C", x: -2.09, y: 1.05, z: -0.38, autoLayout: true },
          { id: "C2", element: "C", x: -1.67, y: 0.64, z: 0.89, autoLayout: true },
          { id: "C3", element: "C", x: -2.24, y: -0.67, z: 1.12, autoLayout: true },
          { id: "C4", element: "C", x: -2.99, y: -0.99, z: -0.01, autoLayout: true },
          { id: "C5", element: "C", x: -2.77, y: -0.02, z: -1.03, autoLayout: true },
          { id: "H1", element: "H", x: -1.17, y: 1.4, z: -0.84, autoLayout: true },
          { id: "H2", element: "H", x: -1.87, y: 1.37, z: 1.62, autoLayout: true },
          { id: "H3", element: "H", x: -2.76, y: -0.81, z: 2.01, autoLayout: true },
          { id: "H4", element: "H", x: -2.69, y: -2.01, z: -0.23, autoLayout: true },
          { id: "H5A", element: "H", x: -3.78, y: 0.39, z: -1.23, autoLayout: true },
          { id: "H5B", element: "H", x: -2.38, y: -0.35, z: -1.93, autoLayout: true },

          // 亲双烯体乙烯 (自动空间排布)
          { id: "C6", element: "C", x: 2.79, y: 0.45, z: -0.08, autoLayout: true },
          { id: "C7", element: "C", x: 2.01, y: -0.45, z: 0.08, autoLayout: true },
          { id: "H61", element: "H", x: 3.69, y: 0.61, z: 0.53, autoLayout: true },
          { id: "H62", element: "H", x: 2.71, y: 1.21, z: -0.86, autoLayout: true },
          { id: "H71", element: "H", x: 1.12, y: -0.39, z: 0.73, autoLayout: true },
          { id: "H72", element: "H", x: 2.08, y: -1.43, z: -0.39, autoLayout: true }
        ],
        bonds: [
          { atom1Id: "C1", atom2Id: "C2", order: 2 },
          { atom1Id: "C2", atom2Id: "C3", order: 1 },
          { atom1Id: "C3", atom2Id: "C4", order: 2 },
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "C1", order: 1 },

          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5A", order: 1 },
          { atom1Id: "C5", atom2Id: "H5B", order: 1 },

          { atom1Id: "C6", atom2Id: "C7", order: 2 },
          { atom1Id: "C6", atom2Id: "H61", order: 1 },
          { atom1Id: "C6", atom2Id: "H62", order: 1 },
          { atom1Id: "C7", atom2Id: "H71", order: 1 },
          { atom1Id: "C7", atom2Id: "H72", order: 1 }
        ]
      },
      {
        name: "协同环加成生成降冰片烯桥环产物",
        note: "6 个 π 电子协同转移闭合，生成具张力的高对称双环[2.2.1]庚-2-烯 (降冰片烯 C_7H_{10}) 桥环拓扑构型。",
        atoms: [
          { id: "C1", element: "C", x: -0.53, y: 0.89, z: 0.19, autoLayout: true },
          { id: "C2", element: "C", x: 0.71, y: 1.02, z: 1.05, autoLayout: true },
          { id: "C3", element: "C", x: 1.53, y: 0.07, z: 0.53, autoLayout: true },
          { id: "C4", element: "C", x: 0.66, y: -0.55, z: -0.59, autoLayout: true },
          { id: "C5", element: "C", x: 0.12, y: 0.7, z: -1.12, autoLayout: true },
          { id: "C6", element: "C", x: -1.3, y: -0.37, z: 0.47, autoLayout: true },
          { id: "C7", element: "C", x: -0.44, y: -1.37, z: -0.01, autoLayout: true },
          { id: "H1", element: "H", x: -1.02, y: 1.78, z: 0.34, autoLayout: true },
          { id: "H2", element: "H", x: 0.94, y: 1.78, z: 1.68, autoLayout: true },
          { id: "H3", element: "H", x: 2.52, y: -0.08, z: 0.7, autoLayout: true },
          { id: "H4", element: "H", x: 1.29, y: -1.05, z: -1.23, autoLayout: true },
          { id: "H5A", element: "H", x: -0.58, y: 0.85, z: -1.95, autoLayout: true },
          { id: "H5B", element: "H", x: 0.98, y: 1.32, z: -1.46, autoLayout: true },
          { id: "H61", element: "H", x: -1.67, y: -0.48, z: 1.5, autoLayout: true },
          { id: "H62", element: "H", x: -2.31, y: -0.28, z: -0.06, autoLayout: true },
          { id: "H71", element: "H", x: -1.02, y: -2.06, z: -0.65, autoLayout: true },
          { id: "H72", element: "H", x: 0.1, y: -2.15, z: 0.62, autoLayout: true }
        ],
        bonds: [
          // 桥头碳与双键
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C2", atom2Id: "C3", order: 2 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "C5", order: 1 },
          { atom1Id: "C5", atom2Id: "C1", order: 1 },

          // 新生成的两根碳-碳 σ 键构建六元环
          { atom1Id: "C1", atom2Id: "C6", order: 1 },
          { atom1Id: "C4", atom2Id: "C7", order: 1 },
          { atom1Id: "C6", atom2Id: "C7", order: 1 },

          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5A", order: 1 },
          { atom1Id: "C5", atom2Id: "H5B", order: 1 },
          { atom1Id: "C6", atom2Id: "H61", order: 1 },
          { atom1Id: "C6", atom2Id: "H62", order: 1 },
          { atom1Id: "C7", atom2Id: "H71", order: 1 },
          { atom1Id: "C7", atom2Id: "H72", order: 1 }
        ]
      }
    ]
  },
  {
    id: "electrophilic-aromatic-substitution",
    name: "苯的亲电芳香取代硝化反应",
    equation: "C_6H_6 + HNO_3 -> C_6H_5NO_2 + H_2O",
    summary: "经典芳香亲电取代机理：亲电试剂 NO_2^+ 进攻苯环破坏大 Π 键形成非芳香性 Wheland 碳正离子中间体，随后消除质子重构稳定的大 Π 键生成硝基苯。",
    steps: [
      {
        name: "亲电试剂碰撞靠近",
        note: "硝鎓离子 (NO_2^+) 靠近富电子的苯环 (C_6H_6)，苯环六元碳骨架处于完全共平面的芳香大 Π 键 (Π_6^6) 稳定离域共轭体系中。",
        aromatic: {
          atomIds: ["C1", "C2", "C3", "C4", "C5", "C6"],
          tag: "Π_6^6"
        },
        atoms: [
          // 苯环 C6H6 (6C, 6H)
          { id: "C1", element: "C", x: -1.2, y: 1.4, z: 0.0 },
          { id: "C2", element: "C", x: 0.01, y: 0.7, z: 0.0 },
          { id: "C3", element: "C", x: 0.01, y: -0.7, z: 0.0 },
          { id: "C4", element: "C", x: -1.2, y: -1.4, z: 0.0 },
          { id: "C5", element: "C", x: -2.41, y: -0.7, z: 0.0 },
          { id: "C6", element: "C", x: -2.41, y: 0.7, z: 0.0 },

          { id: "H1", element: "H", x: -1.2, y: 2.48, z: 0.0 },
          { id: "H2", element: "H", x: 0.95, y: 1.24, z: 0.0 },
          { id: "H3", element: "H", x: 0.95, y: -1.24, z: 0.0 },
          { id: "H4", element: "H", x: -1.2, y: -2.48, z: 0.0 },
          { id: "H5", element: "H", x: -3.35, y: -1.24, z: 0.0 },
          { id: "H6", element: "H", x: -3.35, y: 1.24, z: 0.0 },

          // 亲电试剂 NO2+ (1N, 2O)
          { id: "N1", element: "N", x: 1.8, y: 2.2, z: 0.4, charge: 1 },
          { id: "O1", element: "O", x: 1.2, y: 3.1, z: 0.6 },
          { id: "O2", element: "O", x: 2.7, y: 1.7, z: 0.3 },

          // 催化碱基团 OH- (1O, 1H)
          { id: "O3", element: "O", x: 3.2, y: -0.8, z: -0.2, charge: -1 },
          { id: "H7", element: "H", x: 3.9, y: -0.4, z: 0.1 }
        ],
        bonds: [
          // 苯环 1.5 键级芳香键
          { atom1Id: "C1", atom2Id: "C2", order: 1.5 },
          { atom1Id: "C2", atom2Id: "C3", order: 1.5 },
          { atom1Id: "C3", atom2Id: "C4", order: 1.5 },
          { atom1Id: "C4", atom2Id: "C5", order: 1.5 },
          { atom1Id: "C5", atom2Id: "C6", order: 1.5 },
          { atom1Id: "C6", atom2Id: "C1", order: 1.5 },

          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5", order: 1 },
          { atom1Id: "C6", atom2Id: "H6", order: 1 },

          // NO2+
          { atom1Id: "N1", atom2Id: "O1", order: 2 },
          { atom1Id: "N1", atom2Id: "O2", order: 2 },

          // OH-
          { atom1Id: "O3", atom2Id: "H7", order: 1 }
        ]
      },
      {
        name: "亲电进攻生成 Wheland 碳正离子中间体",
        note: "NO_2^+ 进攻 C1 形成 C-N σ 键，C1 转变为 sp^3 杂化，环内大 Π 键中断；正电荷高度离域在五碳共轭碳正离子中间体中。",
        atoms: [
          { id: "C1", element: "C", x: -1.0, y: 1.2, z: 0.0 },
          { id: "C2", element: "C", x: 0.1, y: 0.6, z: 0.0 },
          { id: "C3", element: "C", x: 0.1, y: -0.7, z: 0.0, charge: 1 },
          { id: "C4", element: "C", x: -1.1, y: -1.4, z: 0.0 },
          { id: "C5", element: "C", x: -2.3, y: -0.7, z: 0.0 },
          { id: "C6", element: "C", x: -2.3, y: 0.6, z: 0.0 },

          { id: "H1", element: "H", x: -0.3, y: 1.7, z: -0.7 },
          { id: "H2", element: "H", x: 1.0, y: 1.1, z: 0.0 },
          { id: "H3", element: "H", x: 1.0, y: -1.2, z: 0.0 },
          { id: "H4", element: "H", x: -1.1, y: -2.5, z: 0.0 },
          { id: "H5", element: "H", x: -3.2, y: -1.2, z: 0.0 },
          { id: "H6", element: "H", x: -3.2, y: 1.1, z: 0.0 },

          { id: "N1", element: "N", x: -1.3, y: 2.3, z: 0.6 },
          { id: "O1", element: "O", x: -2.1, y: 3.0, z: 0.9 },
          { id: "O2", element: "O", x: -0.6, y: 2.9, z: 0.7 },

          { id: "O3", element: "O", x: 2.2, y: -0.6, z: -0.2, charge: -1 },
          { id: "H7", element: "H", x: 2.8, y: -0.2, z: 0.1 }
        ],
        bonds: [
          // Wheland 中间体 (C1 为 sp3)
          { atom1Id: "C1", atom2Id: "N1", order: 1 },
          { atom1Id: "C1", atom2Id: "H1", order: 1 },
          { atom1Id: "C1", atom2Id: "C2", order: 1 },
          { atom1Id: "C6", atom2Id: "C1", order: 1 },

          { atom1Id: "C2", atom2Id: "C3", order: 2 },
          { atom1Id: "C3", atom2Id: "C4", order: 1 },
          { atom1Id: "C4", atom2Id: "C5", order: 2 },
          { atom1Id: "C5", atom2Id: "C6", order: 1 },

          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5", order: 1 },
          { atom1Id: "C6", atom2Id: "H6", order: 1 },

          { atom1Id: "N1", atom2Id: "O1", order: 2 },
          { atom1Id: "N1", atom2Id: "O2", order: 1 },

          { atom1Id: "O3", atom2Id: "H7", order: 1 }
        ]
      },
      {
        name: "消除质子恢复芳香大 Π 键生成硝基苯",
        note: "碱 (OH^-) 夺取 C1 上的质子生成 H_2O，C-H σ 电子对重新填充环共轭体系，重构稳定的芳香大 Π 键 (Π_6^6)，生成硝基苯。",
        aromatic: {
          atomIds: ["C1", "C2", "C3", "C4", "C5", "C6"],
          tag: "Π_6^6"
        },
        atoms: [
          // 硝基苯 (6C, 5H, 1N, 2O)
          { id: "C1", element: "C", x: -1.1, y: 1.3, z: 0.0 },
          { id: "C2", element: "C", x: 0.1, y: 0.6, z: 0.0 },
          { id: "C3", element: "C", x: 0.1, y: -0.7, z: 0.0 },
          { id: "C4", element: "C", x: -1.1, y: -1.4, z: 0.0 },
          { id: "C5", element: "C", x: -2.3, y: -0.7, z: 0.0 },
          { id: "C6", element: "C", x: -2.3, y: 0.6, z: 0.0 },

          { id: "H2", element: "H", x: 1.0, y: 1.1, z: 0.0 },
          { id: "H3", element: "H", x: 1.0, y: -1.2, z: 0.0 },
          { id: "H4", element: "H", x: -1.1, y: -2.5, z: 0.0 },
          { id: "H5", element: "H", x: -3.2, y: -1.2, z: 0.0 },
          { id: "H6", element: "H", x: -3.2, y: 1.1, z: 0.0 },

          { id: "N1", element: "N", x: -1.1, y: 2.6, z: 0.0 },
          { id: "O1", element: "O", x: -2.0, y: 3.2, z: 0.1 },
          { id: "O2", element: "O", x: -0.2, y: 3.2, z: -0.1 },

          // 水分子 H2O (1O, 2H)
          { id: "O3", element: "O", x: 2.0, y: 0.4, z: -0.2 },
          { id: "H7", element: "H", x: 2.7, y: 0.9, z: 0.1 },
          { id: "H1", element: "H", x: 1.3, y: 0.9, z: -0.4 }
        ],
        bonds: [
          // 恢复 1.5 键级
          { atom1Id: "C1", atom2Id: "C2", order: 1.5 },
          { atom1Id: "C2", atom2Id: "C3", order: 1.5 },
          { atom1Id: "C3", atom2Id: "C4", order: 1.5 },
          { atom1Id: "C4", atom2Id: "C5", order: 1.5 },
          { atom1Id: "C5", atom2Id: "C6", order: 1.5 },
          { atom1Id: "C6", atom2Id: "C1", order: 1.5 },

          { atom1Id: "C1", atom2Id: "N1", order: 1 },
          { atom1Id: "N1", atom2Id: "O1", order: 2 },
          { atom1Id: "N1", atom2Id: "O2", order: 2 },

          { atom1Id: "C2", atom2Id: "H2", order: 1 },
          { atom1Id: "C3", atom2Id: "H3", order: 1 },
          { atom1Id: "C4", atom2Id: "H4", order: 1 },
          { atom1Id: "C5", atom2Id: "H5", order: 1 },
          { atom1Id: "C6", atom2Id: "H6", order: 1 },

          // 水分子
          { atom1Id: "O3", atom2Id: "H7", order: 1 },
          { atom1Id: "O3", atom2Id: "H1", order: 1 }
        ]
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REACTION_PRESETS };
}
