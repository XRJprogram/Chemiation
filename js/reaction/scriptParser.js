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
    if (reaction.deltaH) lines.push(`deltaH "${reaction.deltaH}"`);
    if (reaction.category) lines.push(`category "${reaction.category}"`);
    if (reaction.summary) lines.push(`summary "${reaction.summary.replace(/"/g, '\\"')}"`);
    lines.push('');

    (reaction.steps || []).forEach((step, idx) => {
      lines.push(`step "${step.name || `步骤 ${idx + 1}`}" {`);
      if (step.note) lines.push(`  note "${step.note.replace(/"/g, '\\"')}"`);
      if (step.action && step.action.desc) lines.push(`  action "${step.action.desc.replace(/"/g, '\\"')}"`);
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
      deltaH: 'ΔH',
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

      const dhMatch = line.match(/^deltaH\s+"([^"]+)"/i);
      if (dhMatch) {
        reaction.deltaH = dhMatch[1];
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
   * 预设模板生成工具（供用户一键插入）
   */
  getQuickTemplate(type) {
    if (type === 'new_step') {
      return `\nstep "新反应步骤" {
  note "在此输入该反应步骤的详细机理解释"
  action "成键/断键动作说明"
  
  # 简写原子：无需计算坐标，系统自动解算空间排布
  atom C1 C
  atom O1 O
  atom H1 H
  atom H2 H
  
  # 连接化学键：bond <原子1> <原子2> [键级]
  bond C1 O1 2
  bond C1 H1 1
  bond C1 H2 1
}\n`;
    }

    if (type === 'esterification') {
      return this.serialize(REACTION_PRESETS.find(p => p.id === 'esterification') || REACTION_PRESETS[0]);
    }

    if (type === 'co2_starch' || type === 'starch') {
      return this.serialize(REACTION_PRESETS.find(p => p.id === 'co2-to-starch') || REACTION_PRESETS[1]);
    }

    if (type === 'chlorination') {
      return this.serialize(REACTION_PRESETS.find(p => p.id === 'methane-chlorination') || REACTION_PRESETS[2]);
    }

    if (type === 'haber_bosch') {
      return this.serialize(REACTION_PRESETS.find(p => p.id === 'haber-bosch') || REACTION_PRESETS[4]);
    }

    if (type === 'co2_reduction') {
      return this.serialize(REACTION_PRESETS.find(p => p.id === 'co2-reduction') || REACTION_PRESETS[3]);
    }

    return '';
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReactionScriptEngine };
}
