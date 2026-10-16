/**
 * Chemiation - Community Ecosystem Seeder
 * Populates realistic chemistry researcher accounts and high-quality mechanism works.
 */

const fs = require('fs');
const path = require('path');
const auth = require('./auth');
const { ReactionScriptEngine } = require('../js/scriptParser.js');
const { REACTION_PRESETS } = require('../js/reactionData.js');

const DATA_DIR = process.env.CHEMIATION_DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const REACTIONS_FILE = path.join(DATA_DIR, 'reactions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fixed salt & hash for predictable password "password123"
const sharedSalt = '3bfe6906c61abea0c58d679d27c7dafc';
const userPasswordHash = auth.hashPassword('password123', sharedSalt);
const adminPasswordHash = auth.hashPassword('admin123', sharedSalt);

const now = new Date().toISOString();
const pastDate = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const communityUsers = [
  {
    id: 'u_admin_root',
    username: 'admin',
    passwordHash: adminPasswordHash,
    salt: sharedSalt,
    role: 'admin',
    nickname: '系统管理员 (Admin)',
    email: 'admin@chemiation.local',
    avatar: 'AD',
    bio: 'Chemiation 反应机理平台内置超级管理员，拥有全局机理与用户审计权限。',
    createdAt: pastDate(30),
    updatedAt: pastDate(30),
    lastLoginAt: now,
    loginCount: 28
  },
  {
    id: 'u_curie_marie',
    username: 'curie_marie',
    passwordHash: userPasswordHash,
    salt: sharedSalt,
    role: 'user',
    nickname: '玛丽·居里 (Marie Curie)',
    email: 'm.curie@radium-lab.org',
    avatar: 'MC',
    bio: '放射性与无机/有机物理化学研究先驱，致力于分子结构与反应机理深度解析。',
    createdAt: pastDate(25),
    updatedAt: pastDate(20),
    lastLoginAt: pastDate(1),
    loginCount: 42
  },
  {
    id: 'u_victor_grignard',
    username: 'victor_grignard',
    passwordHash: userPasswordHash,
    salt: sharedSalt,
    role: 'user',
    nickname: '维克多·格林尼亚 (Victor Grignard)',
    email: 'v.grignard@lyon-chem.edu',
    avatar: 'VG',
    bio: '有机金属化合物与碳-碳成键机理爱好者，专注于有机合成推演。',
    createdAt: pastDate(22),
    updatedAt: pastDate(18),
    lastLoginAt: pastDate(2),
    loginCount: 35
  },
  {
    id: 'u_pauling_linus',
    username: 'pauling_linus',
    passwordHash: userPasswordHash,
    salt: sharedSalt,
    role: 'user',
    nickname: '莱纳斯·鲍林 (Linus Pauling)',
    email: 'l.pauling@caltech.edu',
    avatar: 'LP',
    bio: '化学键的本质研究者，关注多肽、蛋白质折叠及量子共振机理。',
    createdAt: pastDate(20),
    updatedAt: pastDate(15),
    lastLoginAt: pastDate(1),
    loginCount: 50
  },
  {
    id: 'u_woodward_robert',
    username: 'woodward_robert',
    passwordHash: userPasswordHash,
    salt: sharedSalt,
    role: 'user',
    nickname: '罗伯特·伍德沃德 (Robert Woodward)',
    email: 'rb.woodward@harvard.edu',
    avatar: 'RW',
    bio: '现代有机全合成与轨道对称守恒定律探索者，推演前沿有机分子拓扑构建。',
    createdAt: pastDate(18),
    updatedAt: pastDate(12),
    lastLoginAt: pastDate(3),
    loginCount: 31
  },
  {
    id: 'u_haber_fritz',
    username: 'haber_fritz',
    passwordHash: userPasswordHash,
    salt: sharedSalt,
    role: 'user',
    nickname: '弗里茨·哈伯 (Fritz Haber)',
    email: 'f.haber@kwi-berlin.de',
    avatar: 'FH',
    bio: '工业相界面催化动力学与高压气固表面反应机理推演。',
    createdAt: pastDate(15),
    updatedAt: pastDate(10),
    lastLoginAt: pastDate(2),
    loginCount: 26
  },
  {
    id: 'u_boyle_robert',
    username: 'boyle_robert',
    passwordHash: userPasswordHash,
    salt: sharedSalt,
    role: 'user',
    nickname: '罗伯特·波义耳 (Robert Boyle)',
    email: 'r.boyle@oxford.ac.uk',
    avatar: 'RB',
    bio: '近代实验化学探索者，热衷于催化氧化与气相热力学循环。',
    createdAt: pastDate(12),
    updatedAt: pastDate(8),
    lastLoginAt: pastDate(1),
    loginCount: 19
  }
];

// 6 Preset Scripts generated cleanly from REACTION_PRESETS
const presetMap = {};
if (Array.isArray(REACTION_PRESETS)) {
  REACTION_PRESETS.forEach(p => {
    presetMap[p.id] = {
      title: p.name,
      equation: p.equation,
      summary: p.summary,
      script: ReactionScriptEngine.serialize(p)
    };
  });
}

// 6 Additional CCPL Mechanism Scripts
const extraWorks = [
  {
    id: 'chem_repo_grignard_acetone',
    userId: 'u_victor_grignard',
    title: '格氏试剂与丙酮亲核加成',
    equation: 'CH3MgBr + CH3COCH3 -> (CH3)3COMgBr',
    summary: '甲基溴化镁与丙酮发生亲核加成，格氏试剂的亲核甲基进攻带部分正电荷的羰基碳，生成叔丁醇镁加成物中间体。',
    category: 'organic',
    tags: ['格氏试剂', '亲核加成', '有机合成', '金属有机'],
    stars: 42,
    forks: 11,
    views: 285,
    createdAt: pastDate(16),
    script: `# ============================================================
# Chemiation 反应机理推演脚本 (CCPL)
# 反应名称: 格氏试剂与丙酮亲核加成
# ============================================================

reaction "格氏试剂与丙酮亲核加成"
equation "CH3MgBr + CH3COCH3 -> (CH3)3COMgBr"
summary "甲基溴化镁与丙酮发生亲核加成，格氏试剂的亲核甲基进攻带部分正电荷的羰基碳，生成叔丁醇镁加成物中间体。"

step "格氏试剂配位与亲核进攻" {
  note "CH3MgBr 极化键靠近丙酮羰基，镁原子与氧配位，亲核甲基进攻羰基碳"
  atom C1 C
  atom C2 C
  atom O1 O
  atom C3 C
  atom C4 C
  atom Mg1 Mg
  atom Br1 Br
  bond C1 C2 1
  bond C2 O1 2
  bond C2 C3 1
  bond C4 Mg1 1
  bond Mg1 Br1 1
}

step "四面体烷氧基镁中间体生成" {
  note "甲基碳与羰基碳成键，C=O双键转为单键，镁离子配位于带负电荷的氧生成烷氧基镁"
  atom C1 C
  atom C2 C
  atom O1 O
  atom C3 C
  atom C4 C
  atom Mg1 Mg
  atom Br1 Br
  bond C1 C2 1
  bond C2 O1 1
  bond C2 C3 1
  bond C2 C4 1
  bond O1 Mg1 1
  bond Mg1 Br1 1
}
`
  },
  {
    id: 'chem_repo_aldol_condensation',
    userId: 'u_curie_marie',
    title: '乙醛羟醛缩合反应',
    equation: '2 CH3CHO -> CH3CH=CHCHO + H2O',
    summary: '碱催化下乙醛脱质子生成烯醇负离子，进攻另一分子乙醛羰基碳，形成β-羟基丁醛中间体并经消除反应脱水生成巴豆醛。',
    category: 'organic',
    tags: ['羟醛缩合', '碳负离子', '烯醇化', '有机反应'],
    stars: 38,
    forks: 8,
    views: 230,
    createdAt: pastDate(14),
    script: `# ============================================================
# Chemiation 反应机理推演脚本 (CCPL)
# 反应名称: 乙醛羟醛缩合反应
# ============================================================

reaction "乙醛羟醛缩合反应"
equation "2 CH3CHO -> CH3CH=CHCHO + H2O"
summary "碱催化下乙醛脱质子生成烯醇负离子，进攻另一分子乙醛羰基碳，形成β-羟基丁醛中间体并经消除反应脱水生成巴豆醛。"

step "烯醇负离子进攻第二分子乙醛" {
  note "乙醛脱质子生成的碳负离子进攻第二分子乙醛羰基碳"
  atom C1 C
  atom C2 C
  atom O1 O
  atom C3 C
  atom C4 C
  atom O2 O
  bond C1 C2 1
  bond C2 O1 2
  bond C3 C4 1
  bond C4 O2 1
}

step "生成β-羟基丁醛中间体" {
  note "形成新的C-C单键，氧质子化生成醇羟基"
  atom C1 C
  atom C2 C
  atom O1 O
  atom C3 C
  atom C4 C
  atom O2 O
  bond C1 C2 1
  bond C2 O1 1
  bond C2 C3 1
  bond C3 C4 1
  bond C4 O2 2
}

step "脱水消除生成巴豆醛" {
  note "羟基消除形成共轭碳碳双键并释放水分子"
  atom C1 C
  atom C2 C
  atom C3 C
  atom C4 C
  atom O2 O
  atom O1 O
  bond C1 C2 1
  bond C2 C3 2
  bond C3 C4 1
  bond C4 O2 2
}
`
  },
  {
    id: 'chem_repo_ethanol_dehydrogenation',
    userId: 'u_boyle_robert',
    title: '乙醇催化脱氢氧化反应',
    equation: 'CH3CH2OH + [Cu] -> CH3CHO + H2 + [Cu]',
    summary: '乙醇在过渡金属铜表面吸附解离，羟基氢与α-碳氢依次发生表面断键与配位消除，高选择性生成乙醛并脱附放出氢气。',
    category: 'catalysis',
    tags: ['催化氧化', '脱氢机理', '表面化学', '界面催化'],
    stars: 27,
    forks: 5,
    views: 165,
    createdAt: pastDate(11),
    script: `# ============================================================
# Chemiation 反应机理推演脚本 (CCPL)
# 反应名称: 乙醇催化脱氢氧化反应
# ============================================================

reaction "乙醇催化脱氢氧化反应"
equation "CH3CH2OH + [Cu] -> CH3CHO + H2 + [Cu]"
summary "乙醇在过渡金属铜表面吸附解离，羟基氢与α-碳氢依次发生表面断键与配位消除，高选择性生成乙醛并脱附放出氢气。"

step "乙醇在铜催化剂表面化学吸附" {
  note "乙醇氧原子孤对电子配位于活性铜位点，C-H键与O-H键发生拉伸活化"
  atom Cu1 Cu
  atom O1 O
  atom C1 C
  atom C2 C
  bond Cu1 O1 1
  bond O1 C1 1
  bond C1 C2 1
}

step "协同脱氢与双键重构" {
  note "α-C-H键断裂，生成C=O双键与表面吸附氢物种"
  atom Cu1 Cu
  atom O1 O
  atom C1 C
  atom C2 C
  bond O1 C1 2
  bond C1 C2 1
}

step "乙醛产物脱附与氢气逸出" {
  note "乙醛分子脱离催化位点，活性表面复原完成催化循环"
  atom Cu1 Cu
  atom O1 O
  atom C1 C
  atom C2 C
  bond O1 C1 2
  bond C1 C2 1
}
`
  },
  {
    id: 'chem_repo_peptide_condensation',
    userId: 'u_pauling_linus',
    title: '甘氨酸与丙氨酸多肽缩合',
    equation: 'Gly + Ala <=> Gly-Ala + H2O',
    summary: '甘氨酸羧基与丙氨酸氨基脱水缩合形成肽键(-CO-NH-)，展示生物大分子多肽链延伸的共价成键机理与刚性平面构造。',
    category: 'biochem',
    tags: ['多肽合成', '肽键机理', '生物化学', '蛋白质'],
    stars: 53,
    forks: 14,
    views: 340,
    createdAt: pastDate(13),
    script: `# ============================================================
# Chemiation 反应机理推演脚本 (CCPL)
# 反应名称: 甘氨酸与丙氨酸多肽缩合
# ============================================================

reaction "甘氨酸与丙氨酸多肽缩合"
equation "Gly + Ala <=> Gly-Ala + H2O"
summary "甘氨酸羧基与丙氨酸氨基脱水缩合形成肽键(-CO-NH-)，展示生物大分子多肽链延伸的共价成键机理与刚性平面构造。"

step "亲核氨基进攻活化羧基碳" {
  note "丙氨酸氨基氮原子进攻甘氨酸羧基碳，形成四面体过渡态前体"
  atom N1 N
  atom C1 C
  atom C2 C
  atom O1 O
  atom O2 O
  atom N2 N
  atom C3 C
  atom C4 C
  bond N1 C1 1
  bond C1 C2 1
  bond C2 O1 2
  bond C2 O2 1
  bond N2 C3 1
  bond C3 C4 1
}

step "肽键形成与水分子消除" {
  note "C-N肽键形成，脱去水分子，形成具有共振稳定的刚性肽平面结构"
  atom N1 N
  atom C1 C
  atom C2 C
  atom O1 O
  atom N2 N
  atom C3 C
  atom C4 C
  atom O2 O
  bond N1 C1 1
  bond C1 C2 1
  bond C2 O1 2
  bond C2 N2 1
  bond N2 C3 1
  bond C3 C4 1
}
`
  },
  {
    id: 'chem_repo_ammonia_fe_surface',
    userId: 'u_haber_fritz',
    title: '铁催化合成氨界面活化反应',
    equation: 'N2 + 3 H2 -[Fe]-> 2 NH3',
    summary: '超高活化能的氮气三键在金属铁表面吸附并逐级裂解，与解离吸附的表面氢原子发生连续氢转移，生成氨分子并脱附。',
    category: 'inorganic',
    tags: ['合成氨', '工业催化', '表面机理', '无机化学'],
    stars: 35,
    forks: 9,
    views: 205,
    createdAt: pastDate(9),
    script: `# ============================================================
# Chemiation 反应机理推演脚本 (CCPL)
# 反应名称: 铁催化合成氨界面活化反应
# ============================================================

reaction "铁催化合成氨界面活化反应"
equation "N2 + 3 H2 -[Fe]-> 2 NH3"
summary "超高活化能的氮气三键在金属铁表面吸附并逐级裂解，与解离吸附的表面氢原子发生连续氢转移，生成氨分子并脱附。"

step "氮分子与氢分子解离吸附于铁晶面" {
  note "N≡N 三键在 Fe 表面受 d 轨道反馈裂解为原子态氮，氢分子解离为表面吸附氢"
  atom Fe1 Fe
  atom Fe2 Fe
  atom N1 N
  atom N2 N
  bond Fe1 N1 1
  bond Fe2 N2 1
}

step "表面氨基物种逐级氢化" {
  note "解离态氮原子与表面迁移氢原子结合生成亚氨基(NH)及氨基(NH2)表面络合物"
  atom Fe1 Fe
  atom N1 N
  atom H1 H
  atom H2 H
  bond Fe1 N1 1
  bond N1 H1 1
  bond N1 H2 1
}

step "氨分子生成与表面脱附" {
  note "第三次加氢生成氨分子(NH3)，完成表面脱附，铁催化活性中心再生"
  atom Fe1 Fe
  atom N1 N
  atom H1 H
  atom H2 H
  atom H3 H
  bond N1 H1 1
  bond N1 H2 1
  bond N1 H3 1
}
`
  },
  {
    id: 'chem_repo_oxirane_opening',
    userId: 'u_woodward_robert',
    title: '环氧乙烷酸催化亲核开环反应',
    equation: 'C2H4O + H2O -[H+]-> HO-CH2-CH2-OH',
    summary: '三元环氧环具有巨大的环张力，氧原子经质子化活化后，亲核试剂水分子从背面进攻碳原子发生开环，消除质子得到乙二醇。',
    category: 'organic',
    tags: ['开环反应', '亲核取代', '张力环', '立体化学'],
    stars: 32,
    forks: 6,
    views: 180,
    createdAt: pastDate(7),
    script: `# ============================================================
# Chemiation 反应机理推演脚本 (CCPL)
# 反应名称: 环氧乙烷酸催化亲核开环反应
# ============================================================

reaction "环氧乙烷酸催化亲核开环反应"
equation "C2H4O + H2O -[H+]-> HO-CH2-CH2-OH"
summary "三元环氧环具有巨大的环张力，氧原子经质子化活化后，亲核试剂水分子从背面进攻碳原子发生开环，消除质子得到乙二醇。"

step "环氧乙烷质子化与水分子背面靠近" {
  note "环氧乙烷氧质子化形成正离子中间体，C-O键极度弱化，亲核试剂水分子从反面进攻"
  atom C1 C
  atom C2 C
  atom O1 O
  atom O2 O
  bond C1 C2 1
  bond C1 O1 1
  bond C2 O1 1
}

step "三元环破裂与反式加成" {
  note "环张力释放，C1-O1键断裂，同时水分子亲核进攻成键形成开环质子化中间体"
  atom O2 O
  atom C1 C
  atom C2 C
  atom O1 O
  bond O2 C1 1
  bond C1 C2 1
  bond C2 O1 1
}

step "质子转移生成乙二醇" {
  note "脱质子形成稳定的双官能团1,2-乙二醇产物"
  atom O2 O
  atom C1 C
  atom C2 C
  atom O1 O
  bond O2 C1 1
  bond C1 C2 1
  bond C2 O1 1
}
`
  }
];

const presetMeta = [
  {
    id: 'chem_repo_esterification',
    presetKey: 'esterification',
    userId: 'u_admin_root',
    category: 'organic',
    tags: ['有机合成', '亲核取代', '酯化反应', '酸催化'],
    stars: 48,
    forks: 12,
    views: 310,
    createdAt: pastDate(28)
  },
  {
    id: 'chem_repo_co2_to_starch',
    presetKey: 'co2-to-starch',
    userId: 'u_pauling_linus',
    category: 'biochem',
    tags: ['人工光合', '合成生物', '全合成', '高分子缩聚'],
    stars: 64,
    forks: 19,
    views: 450,
    createdAt: pastDate(26)
  },
  {
    id: 'chem_repo_allylic_bromination',
    presetKey: 'allylic-bromination',
    userId: 'u_curie_marie',
    category: 'organic',
    tags: ['自由基反应', 'NBS', '共振离域', '烯丙基溴代'],
    stars: 31,
    forks: 7,
    views: 190,
    createdAt: pastDate(24)
  },
  {
    id: 'chem_repo_haber_bosch',
    presetKey: 'haber-bosch',
    userId: 'u_haber_fritz',
    category: 'catalysis',
    tags: ['工业催化', '哈伯法', '无机化学', '合成氨'],
    stars: 47,
    forks: 13,
    views: 320,
    createdAt: pastDate(21)
  },
  {
    id: 'chem_repo_auto_layout_diels_alder',
    presetKey: 'auto-layout-diels-alder',
    userId: 'u_woodward_robert',
    category: 'organic',
    tags: ['协同反应', '双环桥环', '狄尔斯-阿尔德', '环加成'],
    stars: 55,
    forks: 16,
    views: 380,
    createdAt: pastDate(19)
  },
  {
    id: 'chem_repo_electrophilic_aromatic_substitution',
    presetKey: 'electrophilic-aromatic-substitution',
    userId: 'u_boyle_robert',
    category: 'organic',
    tags: ['芳香烃', '硝化反应', '亲电取代', 'Wheland络合物'],
    stars: 36,
    forks: 9,
    views: 225,
    createdAt: pastDate(17)
  }
];

const communityReactions = [];

// Add 6 presets
presetMeta.forEach(meta => {
  const p = presetMap[meta.presetKey];
  if (!p) return;
  communityReactions.push({
    id: meta.id,
    userId: meta.userId,
    title: p.title,
    equation: p.equation || '',
    summary: p.summary || '',
    script: p.script,
    category: meta.category,
    tags: meta.tags,
    isPublic: true,
    stars: meta.stars,
    starredBy: [],
    forks: meta.forks,
    forkedFrom: null,
    views: meta.views,
    createdAt: meta.createdAt,
    updatedAt: meta.createdAt
  });
});

// Add 6 extra works
extraWorks.forEach(w => {
  communityReactions.push({
    id: w.id,
    userId: w.userId,
    title: w.title,
    equation: w.equation,
    summary: w.summary,
    script: w.script,
    category: w.category,
    tags: w.tags,
    isPublic: true,
    stars: w.stars,
    starredBy: [],
    forks: w.forks,
    forkedFrom: null,
    views: w.views,
    createdAt: w.createdAt,
    updatedAt: w.createdAt
  });
});

function seedAll() {
  // Validate all scripts first!
  communityReactions.forEach(r => {
    try {
      const parsed = ReactionScriptEngine.parse(r.script);
      console.log(`[Seed Check] ${r.title}: OK (${parsed.steps.length} steps)`);
    } catch (e) {
      console.error(`[Seed Error] Failed to parse script for ${r.title}:`, e.message);
      throw e;
    }
  });

  fs.writeFileSync(USERS_FILE, JSON.stringify(communityUsers, null, 2), 'utf8');
  console.log(`[Seed] Successfully wrote ${communityUsers.length} users to ${USERS_FILE}`);

  fs.writeFileSync(REACTIONS_FILE, JSON.stringify(communityReactions, null, 2), 'utf8');
  console.log(`[Seed] Successfully wrote ${communityReactions.length} community reactions to ${REACTIONS_FILE}`);
}

if (require.main === module) {
  seedAll();
}

module.exports = { communityUsers, communityReactions, seedAll };
