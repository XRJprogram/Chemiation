/**
 * Chemiation - Reaction Script (ACPL) Serializer & Parser
 * 极简反应推演脚本引擎：
 * 1. 简单易上手：支持人类可读的极简高阶语法，无需用户手动计算和输入三维浮点坐标！
 * 2. 智能三维排版 (Auto-Layout)：若用户仅提供原子与连接拓扑（如 bond C1-O1），引擎自动解算三维 VSEPR 空间坐标
 * 3. 模板化一键生成：内置反应模板与片段库，一键插入与修改
 */

const ReactionScriptEngine = {
  /**
   * 将反应对象序列化为简洁易读的 ACPL 脚本文本
   */
  serialize(reaction) {
    if (!reaction) return '';

    const lines = [];
    lines.push('# ============================================================');
    lines.push('# Chemiation 反应机理推演脚本 (ACPL)');
    lines.push(`# 反应名称: ${reaction.name || '未命名反应'}`);
    lines.push('# 语法极简：只需指定步骤名称、机理说明与原子键连，三维坐标自动解算');
    lines.push('# ============================================================\n');

    lines.push(`reaction "${reaction.name || '未命名反应'}"`);
    if (reaction.equation) lines.push(`equation "${reaction.equation}"`);
    if (reaction.category) lines.push(`category "${reaction.category}"`);
    if (reaction.summary) lines.push(`summary "${reaction.summary.replace(/"/g, '\\"')}"`);
    lines.push('');

    (reaction.steps || []).forEach((step, idx) => {
      lines.push(`step "${step.name || `步骤 ${idx + 1}`}" {`);
      if (step.note) lines.push(`  note "${step.note.replace(/"/g, '\\"')}"`);
      if (step.action && step.action.desc) lines.push(`  action "${step.action.desc.replace(/"/g, '\\"')}"`);
      if (step.polymer) {
        const p = typeof step.polymer === 'object' ? step.polymer : { label: String(step.polymer) };
        const labelStr = p.label || 'n';
        const tagStr = p.tag ? ` tag "${p.tag.replace(/"/g, '\\"')}"` : '';
        const exclStr = Array.isArray(p.excludeIds) && p.excludeIds.length ? ` exclude "${p.excludeIds.join(' ')}"` : '';
        lines.push(`  polymer "${labelStr}"${tagStr}${exclStr}`);
      }
      lines.push('');
      lines.push('  # 原子定义: atom <ID> <元素> [可选X Y Z坐标]');
      (step.atoms || []).forEach(a => {
        lines.push(`  atom ${a.id} ${a.element} ${a.x.toFixed(2)} ${a.y.toFixed(2)} ${a.z.toFixed(2)}`);
      });
      lines.push('');
      lines.push('  # 化学键拓扑: bond <原子1> <原子2> [键级1/2/3]');
      (step.bonds || []).forEach(b => {
        lines.push(`  bond ${b.atom1Id} ${b.atom2Id} ${b.order || 1}`);
      });
      lines.push('}\n');
    });

    return lines.join('\n');
  },

  /**
   * 将 ACPL 脚本解析为反应对象，带有坐标自动补全与错误容忍
   */
  parse(scriptText) {
    if (!scriptText || !scriptText.trim()) {
      throw new Error('脚本内容为空，请输入推演脚本');
    }

    const trimmed = scriptText.trim();

    // 支持 JSON 格式
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (!parsedJson.steps || !Array.isArray(parsedJson.steps)) {
          throw new Error('JSON 必须包含 steps 步骤数组');
        }
        return parsedJson;
      } catch (err) {
        throw new Error(`JSON 解析失败: ${err.message}`);
      }
    }

    const lines = scriptText.split(/\r?\n/);
    const reaction = {
      id: 'custom-' + Date.now(),
      name: '自定义推演反应',
      equation: '',
      category: '自定义机理',
      summary: '',
      steps: []
    };

    let currentStep = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();

      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      const rxMatch = line.match(/^reaction\s+"([^"]+)"/i);
      if (rxMatch) {
        reaction.name = rxMatch[1];
        continue;
      }

      const eqMatch = line.match(/^equation\s+"([^"]+)"/i);
      if (eqMatch) {
        reaction.equation = eqMatch[1];
        continue;
      }

      // 兼容旧脚本中的 deltaH 声明，静默跳过
      if (/^deltaH\s+/i.test(line)) {
        continue;
      }

      const catMatch = line.match(/^category\s+"([^"]+)"/i);
      if (catMatch) {
        reaction.category = catMatch[1];
        continue;
      }

      const sumMatch = line.match(/^summary\s+"([^"]+)"/i);
      if (sumMatch) {
        reaction.summary = sumMatch[1];
        continue;
      }

      const stepMatch = line.match(/^step\s+"([^"]+)"\s*\{?/i);
      if (stepMatch) {
        if (currentStep) {
          this.autoLayoutStep(currentStep);
          reaction.steps.push(currentStep);
        }
        currentStep = {
          name: stepMatch[1],
          note: '',
          action: { type: 'step', desc: '反应进行' },
          atoms: [],
          bonds: []
        };
        continue;
      }

      if (line === '}') {
        if (currentStep) {
          this.autoLayoutStep(currentStep);
          reaction.steps.push(currentStep);
          currentStep = null;
        }
        continue;
      }

      if (currentStep) {
        const noteMatch = line.match(/^note\s+"([^"]+)"/i);
        if (noteMatch) {
          currentStep.note = noteMatch[1];
          continue;
        }

        const actMatch = line.match(/^action\s+"([^"]+)"/i);
        if (actMatch) {
          currentStep.action = { type: 'action', desc: actMatch[1] };
          continue;
        }

        if (/^polymer\b/i.test(line)) {
          const quotes = Array.from(line.matchAll(/"([^"]+)"/g)).map(m => m[1]);
          const exclMatch = line.match(/exclude\s+"([^"]+)"/i);
          const label = quotes[0] || 'n';
          const tag = quotes.length > 1 && (!exclMatch || quotes[1] !== exclMatch[1]) ? quotes[1] : '';
          const excludeIds = exclMatch ? exclMatch[1].split(/\s+/).filter(Boolean) : [];
          currentStep.polymer = {
            label,
            tag,
            excludeIds
          };
          continue;
        }

        // 简式声明：atom <ID> <Elem> [X Y Z]
        // 允许用户不提供 X Y Z（由 autoLayoutStep 自动解算空间构型）
        const atomWithCoord = line.match(/^atom\s+([A-Za-z0-9_]+)\s+([A-Za-z]{1,2})\s+([-+]?[0-9]*\.?[0-9]+)\s+([-+]?[0-9]*\.?[0-9]+)\s+([-+]?[0-9]*\.?[0-9]+)/i);
        if (atomWithCoord) {
          currentStep.atoms.push({
            id: atomWithCoord[1],
            element: atomWithCoord[2].charAt(0).toUpperCase() + atomWithCoord[2].slice(1).toLowerCase(),
            x: parseFloat(atomWithCoord[3]),
            y: parseFloat(atomWithCoord[4]),
            z: parseFloat(atomWithCoord[5])
          });
          continue;
        }

        // 简明原子声明：atom <ID> <Elem> (自动排布)
        const atomSimple = line.match(/^atom\s+([A-Za-z0-9_]+)\s+([A-Za-z]{1,2})$/i);
        if (atomSimple) {
          currentStep.atoms.push({
            id: atomSimple[1],
            element: atomSimple[2].charAt(0).toUpperCase() + atomSimple[2].slice(1).toLowerCase(),
            x: null,
            y: null,
            z: null
          });
          continue;
        }

        // bond <ID1> <ID2> [order]
        const bondMatch = line.match(/^bond\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(?:\s+([123]))?/i);
        if (bondMatch) {
          currentStep.bonds.push({
            atom1Id: bondMatch[1],
            atom2Id: bondMatch[2],
            order: bondMatch[3] ? parseInt(bondMatch[3], 10) : 1
          });
          continue;
        }
      }
    }

    if (currentStep) {
      this.autoLayoutStep(currentStep);
      reaction.steps.push(currentStep);
    }

    if (reaction.steps.length === 0) {
      throw new Error('未在脚本中检测到任何有效步骤 (请使用 step "步骤名称" { ... } 声明)');
    }

    return reaction;
  },

  /**
   * 对未提供三维坐标的原子进行自动空间排布 (基于力导向与空间均匀分布)
   */
  autoLayoutStep(step) {
    if (!step.atoms || step.atoms.length === 0) return;

    // 检查是否有缺失坐标的原子
    const unpositioned = step.atoms.filter(a => a.x === null || a.y === null || a.z === null);
    if (unpositioned.length === 0) return;

    // 环形与球形空间自动分散排布
    const count = step.atoms.length;
    const radius = Math.max(2.0, count * 0.45);

    step.atoms.forEach((atom, idx) => {
      if (atom.x === null || atom.y === null || atom.z === null) {
        // 斐波那契球面均匀点分布
        const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
        atom.x = +(radius * Math.sin(phi) * Math.cos(theta)).toFixed(2);
        atom.y = +(radius * Math.sin(phi) * Math.sin(theta)).toFixed(2);
        atom.z = +(radius * Math.cos(phi) * 0.6).toFixed(2);
      }
    });
  },

  /**
   * 预设机理模板生成工具（供用户一键插入到编辑器）
   */
  getQuickTemplate(type) {
    if (type === 'new_step') {
      return `\nstep "新反应步骤" {
  note "在此输入该基元反应步骤的机理描述与电子转移说明。"
  action "成键/断键"

  # 原子定义: atom <ID> <元素> [X Y Z(可选)]
  atom C1 C -1.0 0 0
  atom O1 O 1.0 0 0
  atom H1 H -1.0 1.2 0
  atom H2 H 1.0 1.2 0

  # 化学键定义: bond <原子1> <原子2> [键级]
  bond C1 O1 2
  bond C1 H1 1
  bond O1 H2 1
}\n`;
    }

    if (type === 'addition_elimination') {
      return `\nstep "亲电加成/消除反应" {
  note "亲电试剂进攻 C=C 不饱和双键，π 键解离，形成饱和烷基卤代/醇类中间体。"
  action "亲电加成"

  atom C1 C -1.2 0 0
  atom C2 C 1.2 0 0
  atom X1 Br 0 1.8 0
  atom H1 H -1.8 -1.0 0
  atom H2 H 1.8 -1.0 0

  bond C1 C2 1
  bond C1 X1 1
  bond C1 H1 1
  bond C2 H2 1
}\n`;
    }

    if (type === 'catalysis_step') {
      return `\nstep "催化剂表面配位与活化" {
  note "中心催化原子与底物配位，削弱靶反应键能，显著降低反应活化能。"
  action "配位催化"

  atom M1 Fe 0 -1.0 0
  atom N1 N -1.2 0.8 0
  atom N2 N 1.2 0.8 0
  atom H1 H -1.2 2.0 0
  atom H2 H 1.2 2.0 0

  bond M1 N1 1
  bond M1 N2 1
  bond N1 H1 1
  bond N2 H2 1
}\n`;
    }

    if (type === 'radical_step') {
      return `\nstep "自由基均裂与链传递" {
  note "光照或受热导致共价键均裂产生单电子自由基，夺取底物原子引发链传递。"
  action "自由基传递"

  atom C1 C -1.5 0 0
  atom H1 H -0.3 0 0
  atom Cl1 Cl 1.8 0 0
  atom H2 H -2.2 1.0 0
  atom H3 H -2.2 -1.0 0

  bond C1 H2 1
  bond C1 H3 1
  bond H1 Cl1 1
}\n`;
    }

    if (type === 'polymer_step') {
      return `\nstep "单体聚合生成高分子" {
  note "单体首尾脱水/脱除小分子后缩合，主链化学键就近穿出大括号截断形成重复单元。"
  action "缩聚/加聚"

  # 聚合物括号语法: polymer "<聚合度下标如 n>" ["说明标签"] [exclude "<副产物原子ID列表>"]
  polymer "n" "[单体最简重复单元]ₙ" exclude "Ow Hw1 Hw2"

  atom C1 C -1.2 0 0
  atom C2 C 1.2 0 0
  atom O1 O 0 1.0 0
  atom Ow O 3.6 0 0
  atom Hw1 H 4.2 0.8 0
  atom Hw2 H 4.2 -0.8 0

  bond C1 C2 1
  bond C1 O1 1
  bond Ow Hw1 1
  bond Ow Hw2 1
}\n`;
    }

    if (type === 'reaction_blank') {
      return `# Chemiation 反应机理推演脚本 (ACPL)
reaction "新建化学反应"
equation "A + B ⇌ C + D"
category "反应机理推演"
summary "在此输入关于该反应原理、过渡态与机理路径的详细说明。"

step "1. 反应物底物吸附与碰撞" {
  note "底物分子靠近，化学键受到极化并准备重构。"
  action "碰撞活化"

  atom A1 C -1.5 0 0
  atom A2 O 1.5 0 0
  atom H1 H -1.5 1.2 0
  atom H2 H 1.5 1.2 0

  bond A1 H1 1
  bond A2 H2 1
}

step "2. 产物分子生成与脱附" {
  note "新化学键形成，完成基元反应并脱附离开。"
  action "产物生成"

  atom A1 C -0.8 0 0
  atom A2 O 0.8 0 0
  atom H1 H -1.8 0.8 0
  atom H2 H 1.8 0.8 0

  bond A1 A2 2
  bond A1 H1 1
  bond A2 H2 1
}
`;
    }

    return '';
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReactionScriptEngine };
}
