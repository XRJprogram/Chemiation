/**
 * Chemiation - Reaction Script (ACPL) Serializer & Parser
 * 反应机理推演脚本解析器与序列化工具
 * 支持可读性极佳的声明式语法以及标准 JSON 互转
 */

const ReactionScriptEngine = {
  /**
   * 将反应对象序列化为结构清晰的 ACPL 脚本文本
   */
  serialize(reaction) {
    if (!reaction) return '';

    const lines = [];
    lines.push('# ============================================================');
    lines.push('# Chemiation Chemical Process Language (ACPL)');
    lines.push(`# 反应名称: ${reaction.name || '未命名反应'}`);
    lines.push('# 支持自由编辑原子空间三维坐标与化学键拓扑');
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
      lines.push('  # 原子坐标列表: atom <ID> <元素> <X> <Y> <Z>');
      (step.atoms || []).forEach(a => {
        lines.push(`  atom ${a.id} ${a.element} ${a.x} ${a.y} ${a.z}`);
      });
      lines.push('');
      lines.push('  # 化学键拓扑: bond <原子1ID> <原子2ID> [键级1/2/3]');
      (step.bonds || []).forEach(b => {
        lines.push(`  bond ${b.atom1Id} ${b.atom2Id} ${b.order || 1}`);
      });
      lines.push('}\n');
    });

    return lines.join('\n');
  },

  /**
   * 将 ACPL 脚本或 JSON 字符串解析为反应对象
   */
  parse(scriptText) {
    if (!scriptText || !scriptText.trim()) {
      throw new Error('脚本内容为空');
    }

    const trimmed = scriptText.trim();

    // 如果用户粘贴的是纯 JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (!parsedJson.steps || !Array.isArray(parsedJson.steps)) {
          throw new Error('JSON 格式不符合反应规范，必须包含 steps 步骤数组');
        }
        return parsedJson;
      } catch (err) {
        throw new Error(`JSON 解析失败: ${err.message}`);
      }
    }

    // 逐行解析 ACPL 脚本语法
    const lines = scriptText.split(/\r?\n/);
    const reaction = {
      id: 'custom-' + Date.now(),
      name: '自定义推演反应',
      equation: '',
      category: '自定义脚本',
      deltaH: 'ΔH',
      summary: '',
      steps: []
    };

    let currentStep = null;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const line = rawLine.trim();

      // 跳过空行和注释行
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      // 顶级属性解析
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

      // 步骤开始
      const stepMatch = line.match(/^step\s+"([^"]+)"\s*\{?/i);
      if (stepMatch) {
        if (currentStep) {
          reaction.steps.push(currentStep);
        }
        currentStep = {
          name: stepMatch[1],
          note: '',
          action: { type: 'custom', desc: '反应步骤' },
          atoms: [],
          bonds: []
        };
        continue;
      }

      // 步骤结束
      if (line === '}') {
        if (currentStep) {
          reaction.steps.push(currentStep);
          currentStep = null;
        }
        continue;
      }

      // 步骤内部语句
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

        // atom <ID> <Elem> <X> <Y> <Z>
        const atomMatch = line.match(/^atom\s+([A-Za-z0-9_]+)\s+([A-Za-z]{1,2})\s+([-+]?[0-9]*\.?[0-9]+)\s+([-+]?[0-9]*\.?[0-9]+)\s+([-+]?[0-9]*\.?[0-9]+)/i);
        if (atomMatch) {
          currentStep.atoms.push({
            id: atomMatch[1],
            element: atomMatch[2].charAt(0).toUpperCase() + atomMatch[2].slice(1).toLowerCase(),
            x: parseFloat(atomMatch[3]),
            y: parseFloat(atomMatch[4]),
            z: parseFloat(atomMatch[5])
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

      // 未知指令警告
      console.warn(`[ACPL Parser] 忽略无法识别的语法 (第 ${lineNum} 行): ${line}`);
    }

    if (currentStep) {
      reaction.steps.push(currentStep);
    }

    if (reaction.steps.length === 0) {
      throw new Error('未在脚本中检测到任何有效步骤 (请使用 step "名称" { ... } 语法)');
    }

    return reaction;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReactionScriptEngine };
}
