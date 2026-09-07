/**
 * Chemiation - Reaction Script (ACPL) Serializer & Parser
 * 极简反应推演脚本引擎：
 * 1. 简单易上手：支持人类可读的极简高阶语法，无需用户手动计算和输入三维浮点坐标！
 * 2. 智能三维排版 (Auto-Layout)：若用户仅提供原子与连接拓扑（如 bond C1-O1），引擎自动解算三维 VSEPR 空间坐标
 * 3. 模板化一键生成：内置反应模板与片段库，一键插入与修改
 */

const VALID_ACPL_ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn',
  'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr',
  'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn',
  'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd',
  'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb',
  'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg',
  'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th',
  'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm',
  'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og',
  // 化学机理常用取代基/官能团与通用金属占位符
  'R', 'X', 'M'
]);

function stripACPLInlineComment(line) {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && inQuote) {
      i++;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote) {
      if (ch === '#') {
        return line.slice(0, i).trim();
      }
      if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') {
        return line.slice(0, i).trim();
      }
    }
  }
  return line.trim();
}

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
      if (step.polymer) {
        const p = typeof step.polymer === 'object' ? step.polymer : { label: String(step.polymer) };
        const labelStr = p.label || 'n';
        const tagStr = p.tag ? ` tag "${p.tag.replace(/"/g, '\\"')}"` : '';
        const exclStr = Array.isArray(p.excludeIds) && p.excludeIds.length ? ` exclude "${p.excludeIds.join(' ')}"` : '';
        let leftStr = '';
        if (p.leftBond && p.leftBond.atomId) {
          const vecStr = Array.isArray(p.leftBond.vector) ? p.leftBond.vector.join(', ') : '-1.3, 0, 0';
          leftStr = ` leftBond ${p.leftBond.atomId} [${vecStr}]`;
        }
        let rightStr = '';
        if (p.rightBond && p.rightBond.atomId) {
          const vecStr = Array.isArray(p.rightBond.vector) ? p.rightBond.vector.join(', ') : '1.3, 0, 0';
          rightStr = ` rightBond ${p.rightBond.atomId} [${vecStr}]`;
        }
        lines.push(`  polymer "${labelStr}"${tagStr}${exclStr}${leftStr}${rightStr}`);
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
   * 将 ACPL 脚本解析为反应对象，进行严格语法校验与空间构型解算
   */
  parse(scriptText) {
    if (!scriptText || !scriptText.trim()) {
      throw new Error('脚本内容为空，请输入有效的 ACPL 推演脚本');
    }

    const trimmed = scriptText.trim();

    // 支持 JSON 格式
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      let parsedJson;
      try {
        parsedJson = JSON.parse(trimmed);
      } catch (err) {
        throw new Error(`JSON 解析失败: ${err.message}`);
      }
      if (!parsedJson || typeof parsedJson !== 'object') {
        throw new Error('JSON 格式错误: 根节点必须为对象');
      }
      if (!parsedJson.steps || !Array.isArray(parsedJson.steps) || parsedJson.steps.length === 0) {
        throw new Error('JSON 格式错误: 必须包含非空的 steps 步骤数组');
      }
      parsedJson.steps.forEach((step, sIdx) => {
        if (!step || typeof step !== 'object') {
          throw new Error(`JSON 步骤 ${sIdx + 1} 格式错误: 必须为步骤对象`);
        }
        if (!step.atoms || !Array.isArray(step.atoms) || step.atoms.length === 0) {
          throw new Error(`JSON 步骤 ${sIdx + 1} ("${step.name || ''}") 缺少 atoms 原子数组`);
        }
        const atomIds = new Set();
        step.atoms.forEach(a => {
          if (!a.id || !a.element) {
            throw new Error(`JSON 步骤 ${sIdx + 1} 中的原子缺少 id 或 element 属性`);
          }
          if (atomIds.has(a.id)) {
            throw new Error(`JSON 步骤 ${sIdx + 1} 中存在重复的原子 ID "${a.id}"`);
          }
          atomIds.add(a.id);
        });
        (step.bonds || []).forEach(b => {
          if (!atomIds.has(b.atom1Id) || !atomIds.has(b.atom2Id)) {
            throw new Error(`JSON 步骤 ${sIdx + 1} 中的化学键引用的原子未定义: ${b.atom1Id} - ${b.atom2Id}`);
          }
        });
        this.autoLayoutStep(step);
      });
      return parsedJson;
    }

    const lines = scriptText.split(/\r?\n/);
    const reaction = {
      id: 'custom-' + Date.now(),
      name: '自定义推演反应',
      equation: '',
      category: '机理推演',
      summary: '',
      steps: []
    };

    let currentStep = null;
    let currentStepStartLine = 0;
    let currentStepAtomIds = new Set();
    let currentStepBonds = [];
    let stepNeedsOpenBrace = false;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i];
      const line = stripACPLInlineComment(rawLine);

      if (!line) continue;

      if (currentStep === null) {
        const rxMatch = line.match(/^reaction\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (rxMatch) {
          reaction.name = rxMatch[1].replace(/\\"/g, '"');
          continue;
        }
        if (/^reaction\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: reaction 指令格式错误，必须使用双引号包裹反应名称，例如: reaction "反应名称"`);
        }

        const eqMatch = line.match(/^equation\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (eqMatch) {
          reaction.equation = eqMatch[1].replace(/\\"/g, '"');
          continue;
        }
        if (/^equation\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: equation 指令格式错误，必须使用双引号包裹化学方程式，例如: equation "A + B ⇌ C"`);
        }

        const catMatch = line.match(/^category\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (catMatch) {
          reaction.category = catMatch[1].replace(/\\"/g, '"');
          continue;
        }
        if (/^category\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: category 指令格式错误，必须使用双引号包裹分类名称，例如: category "经典有机机理"`);
        }

        const sumMatch = line.match(/^summary\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (sumMatch) {
          reaction.summary = sumMatch[1].replace(/\\"/g, '"');
          continue;
        }
        if (/^summary\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: summary 指令格式错误，必须使用双引号包裹机理概述，例如: summary "机理详细阐释"`);
        }

        // 兼容旧脚本中的 deltaH 声明，静默跳过
        if (/^deltaH\b/i.test(line)) {
          continue;
        }

        const stepMatch = line.match(/^step\s+"((?:[^"\\]|\\.)*)"(?:\s*\{)?\s*$/i);
        if (stepMatch) {
          currentStep = {
            name: stepMatch[1].replace(/\\"/g, '"'),
            note: '',
            atoms: [],
            bonds: []
          };
          currentStepStartLine = lineNum;
          currentStepAtomIds = new Set();
          currentStepBonds = [];
          stepNeedsOpenBrace = !line.endsWith('{');
          continue;
        }
        if (/^step\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: step 指令格式错误，必须包含双引号包裹的步骤名称与大括号，例如: step "1. 步骤名称" {`);
        }

        if (line === '}') {
          throw new Error(`第 ${lineNum} 行语法错误: 意外的多余闭合括号 '}'`);
        }

        throw new Error(`第 ${lineNum} 行语法错误: 未知的全局指令 "${line}"，有效指令包括 reaction, equation, category, summary, step`);
      }

      // 处理处于步骤内部的代码块
      if (stepNeedsOpenBrace) {
        if (line === '{') {
          stepNeedsOpenBrace = false;
          continue;
        } else {
          throw new Error(`第 ${lineNum} 行语法错误: 步骤 "${currentStep.name}" (第 ${currentStepStartLine} 行) 声明后缺少开始括号 '{'`);
        }
      }

      if (/^step\b/i.test(line)) {
        throw new Error(`第 ${lineNum} 行语法错误: 步骤不能嵌套声明，请先使用 '}' 闭合步骤 "${currentStep.name}" (开始于第 ${currentStepStartLine} 行)`);
      }

      if (line === '}') {
        if (currentStep.atoms.length === 0) {
          throw new Error(`第 ${lineNum} 行语法错误: 步骤 "${currentStep.name}" (第 ${currentStepStartLine} 行) 中未定义任何原子，每个步骤必须包含至少一个 atom 声明`);
        }
        for (const bond of currentStepBonds) {
          if (!currentStepAtomIds.has(bond.atom1Id)) {
            throw new Error(`第 ${bond.lineNum} 行语法错误: 化学键 bond 引用的原子 "${bond.atom1Id}" 在步骤 "${currentStep.name}" 中未定义`);
          }
          if (!currentStepAtomIds.has(bond.atom2Id)) {
            throw new Error(`第 ${bond.lineNum} 行语法错误: 化学键 bond 引用的原子 "${bond.atom2Id}" 在步骤 "${currentStep.name}" 中未定义`);
          }
        }
        if (currentStep.polymer && Array.isArray(currentStep.polymer.excludeIds)) {
          for (const exId of currentStep.polymer.excludeIds) {
            if (!currentStepAtomIds.has(exId)) {
              throw new Error(`第 ${currentStep.polymerLineNum} 行语法错误: polymer exclude 排除的原子 "${exId}" 在步骤 "${currentStep.name}" 中未定义`);
            }
          }
        }

        this.autoLayoutStep(currentStep);
        reaction.steps.push(currentStep);
        currentStep = null;
        currentStepAtomIds = new Set();
        currentStepBonds = [];
        continue;
      }

      const noteMatch = line.match(/^note\s+"((?:[^"\\]|\\.)*)"\s*$/i);
      if (noteMatch) {
        currentStep.note = noteMatch[1].replace(/\\"/g, '"');
        continue;
      }
      if (/^note\b/i.test(line)) {
        throw new Error(`第 ${lineNum} 行语法错误: note 指令内容必须使用双引号包裹，例如: note "基元反应机理描述"`);
      }

      if (/^action\b/i.test(line)) {
        continue;
      }

      if (/^polymer\b/i.test(line)) {
        const quotes = Array.from(line.matchAll(/"((?:[^"\\]|\\.)*)"/g)).map(m => m[1].replace(/\\"/g, '"'));
        if (quotes.length === 0) {
          throw new Error(`第 ${lineNum} 行语法错误: polymer 指令缺少聚合度标识，例如: polymer "n"`);
        }
        const label = quotes[0] || 'n';
        const tagMatch = line.match(/tag\s+"((?:[^"\\]|\\.)*)"/i);
        let tag = '';
        if (tagMatch) {
          tag = tagMatch[1].replace(/\\"/g, '"');
        } else if (quotes.length > 1) {
          const exclMatch = line.match(/exclude\s+"((?:[^"\\]|\\.)*)"/i);
          if (!exclMatch || quotes[1] !== exclMatch[1]) {
            tag = quotes[1].replace(/\\"/g, '"');
          }
        }

        const exclMatch = line.match(/exclude\s+"((?:[^"\\]|\\.)*)"/i);
        const excludeIds = exclMatch ? exclMatch[1].replace(/\\"/g, '"').split(/\s+/).filter(Boolean) : [];

        const polymerObj = { label, tag, excludeIds };

        const leftMatch = line.match(/leftBond\s+([A-Za-z0-9_]+)(?:\s+\[([-\d.,\s]+)\])?/i);
        if (leftMatch) {
          const vec = leftMatch[2] ? leftMatch[2].split(',').map(n => parseFloat(n.trim())) : [-1.3, 0, 0];
          polymerObj.leftBond = { atomId: leftMatch[1], vector: vec };
        }

        const rightMatch = line.match(/rightBond\s+([A-Za-z0-9_]+)(?:\s+\[([-\d.,\s]+)\])?/i);
        if (rightMatch) {
          const vec = rightMatch[2] ? rightMatch[2].split(',').map(n => parseFloat(n.trim())) : [1.3, 0, 0];
          polymerObj.rightBond = { atomId: rightMatch[1], vector: vec };
        }

        currentStep.polymer = polymerObj;
        currentStep.polymerLineNum = lineNum;
        continue;
      }

      if (/^atom\b/i.test(line)) {
        const atomWithCoord = line.match(/^atom\s+([A-Za-z0-9_]+)\s+([A-Za-z]{1,2})\s+([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)\s+([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)\s+([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)\s*$/i);
        const atomSimple = !atomWithCoord ? line.match(/^atom\s+([A-Za-z0-9_]+)\s+([A-Za-z]{1,2})\s*$/i) : null;

        if (!atomWithCoord && !atomSimple) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) {
            throw new Error(`第 ${lineNum} 行语法错误: atom 指令参数不足，至少需指定原子 ID 与元素符号，例如: atom C1 C`);
          }
          if (!/^[A-Za-z0-9_]+$/.test(parts[1])) {
            throw new Error(`第 ${lineNum} 行语法错误: 无效的原子 ID "${parts[1]}"，ID 只能由英文字母、数字和下划线组成`);
          }
          const rawElem = parts[2];
          const normElem = rawElem.charAt(0).toUpperCase() + rawElem.slice(1).toLowerCase();
          if (!VALID_ACPL_ELEMENTS.has(normElem)) {
            throw new Error(`第 ${lineNum} 行语法错误: 未知的化学元素符号 "${rawElem}"`);
          }
          if (parts.length !== 3 && parts.length !== 6) {
            throw new Error(`第 ${lineNum} 行语法错误: atom 坐标格式错误，必须提供完整的 X Y Z 三维数值或不提供坐标，例如: atom C1 C 0.0 1.5 -0.5`);
          }
          for (let p = 3; p < parts.length; p++) {
            if (isNaN(parseFloat(parts[p]))) {
              throw new Error(`第 ${lineNum} 行语法错误: atom 坐标包含非数值 "${parts[p]}"，例如: atom C1 C 0.0 1.5 -0.5`);
            }
          }
          throw new Error(`第 ${lineNum} 行语法错误: atom 指令格式错误，正确格式为: atom <ID> <元素> [X Y Z]`);
        }

        const match = atomWithCoord || atomSimple;
        const atomId = match[1];
        const rawElem = match[2];
        const normElem = rawElem.charAt(0).toUpperCase() + rawElem.slice(1).toLowerCase();

        if (!VALID_ACPL_ELEMENTS.has(normElem)) {
          throw new Error(`第 ${lineNum} 行语法错误: 未知的化学元素符号 "${rawElem}"`);
        }

        if (currentStepAtomIds.has(atomId)) {
          throw new Error(`第 ${lineNum} 行语法错误: 步骤 "${currentStep.name}" 中重复定义了原子 ID "${atomId}"`);
        }

        currentStepAtomIds.add(atomId);
        currentStep.atoms.push({
          id: atomId,
          element: normElem,
          x: atomWithCoord ? parseFloat(atomWithCoord[3]) : null,
          y: atomWithCoord ? parseFloat(atomWithCoord[4]) : null,
          z: atomWithCoord ? parseFloat(atomWithCoord[5]) : null
        });
        continue;
      }

      if (/^bond\b/i.test(line)) {
        const bondMatch = line.match(/^bond\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(?:\s+([123]))?\s*$/i);
        if (!bondMatch) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) {
            throw new Error(`第 ${lineNum} 行语法错误: bond 指令参数不足，格式应为: bond <原子1> <原子2> [键级1/2/3]`);
          }
          if (parts.length > 4) {
            throw new Error(`第 ${lineNum} 行语法错误: bond 指令参数过多，格式应为: bond <原子1> <原子2> [键级1/2/3]`);
          }
          if (parts.length === 4 && !['1', '2', '3'].includes(parts[3])) {
            throw new Error(`第 ${lineNum} 行语法错误: 化学键键级 "${parts[3]}" 无效，键级只能为 1 (单键)、2 (双键) 或 3 (三键)`);
          }
          throw new Error(`第 ${lineNum} 行语法错误: bond 指令格式错误，格式应为: bond <原子1> <原子2> [键级1/2/3]`);
        }

        const atom1Id = bondMatch[1];
        const atom2Id = bondMatch[2];
        const order = bondMatch[3] ? parseInt(bondMatch[3], 10) : 1;

        if (atom1Id === atom2Id) {
          throw new Error(`第 ${lineNum} 行语法错误: 原子无法与自身成键 "${atom1Id}"`);
        }

        currentStepBonds.push({ atom1Id, atom2Id, order, lineNum });
        currentStep.bonds.push({ atom1Id, atom2Id, order });
        continue;
      }

      throw new Error(`第 ${lineNum} 行语法错误: 步骤 "${currentStep.name}" 中存在无法识别的指令 "${line}"，有效指令包括 note, polymer, atom, bond`);
    }

    if (currentStep !== null) {
      throw new Error(`第 ${lines.length} 行语法错误: 步骤 "${currentStep.name}" (开始于第 ${currentStepStartLine} 行) 缺少闭合括号 '}'`);
    }

    if (reaction.steps.length === 0) {
      throw new Error('语法错误: 脚本中未包含任何基元反应步骤，请使用 step "步骤名称" { ... } 声明');
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

  atom A1 C -1.5 0 0
  atom A2 O 1.5 0 0
  atom H1 H -1.5 1.2 0
  atom H2 H 1.5 1.2 0

  bond A1 H1 1
  bond A2 H2 1
}

step "2. 产物分子生成与脱附" {
  note "新化学键形成，完成基元反应并脱附离开。"

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
