/**
 * Chemiation - Reaction Script (CCPL) Serializer & Parser
 * 极简反应推演脚本引擎：
 * 1. 简单易上手：支持人类可读的极简高阶语法，无需用户手动计算和输入三维浮点坐标！
 * 2. 智能三维排版 (Auto-Layout)：若用户仅提供原子与连接拓扑（如 bond C1-O1），引擎自动解算三维 VSEPR 空间坐标
 * 3. 模板化一键生成：内置反应模板与片段库，一键插入与修改
 */

const VALID_CCPL_ELEMENTS = new Set([
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

function stripCCPLInlineComment(line) {
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

const CCPL_SUB_MAP = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
  'a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ'
};

const CCPL_SUP_MAP = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ'
};

const ReactionScriptEngine = {
  /**
   * 化学式与机理文本智能上下标与符号排印解析 (无需用户手打复杂 Unicode 字符)
   * 1. 显式大括号上下标: _{...} 与 ^{...}，如 C_6H_{12}O_6, Fe^{3+}
   * 2. 显式单字符上下标: _2, _n, ^2, ^+, ^-，如 H_2O, [C_6H_10O_5]_n
   * 3. 常见反应符号简写: -> 或 --> 转为 →，<=> 或 <-> 或 <==> 转为 ⇌
   * 4. 智能化学式下标: 化学元素符号或闭括号后紧跟的数字 (如 CO2, H2O, CH3COOH, C7H10, (NH4)2SO4) 自动转为化学下标
   */
  formatChemText(str) {
    if (!str || typeof str !== 'string') return str || '';

    // 1. 显式大括号上下标: _{...} 与 ^{...}
    let res = str.replace(/_\{([^}]+)\}/g, (_, inner) => {
      return inner.split('').map(ch => CCPL_SUB_MAP[ch] || ch).join('');
    });
    res = res.replace(/\^\{([^}]+)\}/g, (_, inner) => {
      return inner.split('').map(ch => CCPL_SUP_MAP[ch] || ch).join('');
    });

    // 2. 显式单字符上下标: _[0-9a-z+-] 与 ^[0-9+-]
    res = res.replace(/_([0-9a-z+-])/gi, (_, ch) => CCPL_SUB_MAP[ch.toLowerCase()] || ('_' + ch));
    res = res.replace(/\^([0-9+-])/g, (_, ch) => CCPL_SUP_MAP[ch] || ('^' + ch));

    // 3. 常见反应平衡、共振与反应方向箭头简写
    res = res
      .replace(/<==>|<=>/g, '⇌')
      .replace(/==/g, '⇌')
      .replace(/<-->|<->/g, '↔')
      .replace(/-->|->/g, '→')
      .replace(/<--|<-/g, '←');

    // 4. 聚合物末尾 ]n 自动转换为下标 ]ₙ
    res = res.replace(/\]n\b/g, ']ₙ');

    // 5. 智能化学式下标：化学元素符号或闭括号/闭中括号后直接跟随的数字 (如 CO2, H2O, CH3COOH, C6H12O6, (NH4)2SO4)
    res = res.replace(/([A-Z][a-z]?|\)|\])(\d+)/g, (match, prefix, digits) => {
      const subDigits = digits.split('').map(d => CCPL_SUB_MAP[d] || d).join('');
      return prefix + subDigits;
    });

    return res;
  },

  /**
   * 将反应对象序列化为简洁易读的 CCPL 脚本文本
   */
  serialize(reaction) {
    if (!reaction) return '';

    const lines = [];
    lines.push('# ============================================================');
    lines.push('# Chemiation 反应机理推演脚本 (CCPL)');
    lines.push(`# 反应名称: ${reaction.name || '未命名反应'}`);
    lines.push('# 语法极简：只需指定步骤名称、机理说明与原子键连，三维坐标自动解算');
    lines.push('# ============================================================\n');

    lines.push(`reaction "${reaction.name || '未命名反应'}"`);
    if (reaction.equation) lines.push(`equation "${reaction.equation}"`);
    if (reaction.summary) lines.push(`summary "${reaction.summary.replace(/"/g, '\\"')}"`);
    lines.push('');

    (reaction.steps || []).forEach((step, idx) => {
      const cleanName = (step.name || `步骤 ${idx + 1}`).replace(/^\s*(?:(?:第\s*)?\d+\s*(?:步|节)?|[一二三四五六七八九十]+)[\.、:\s-]\s*/i, '').trim() || (step.name || `步骤 ${idx + 1}`);
      lines.push(`step "${cleanName}" {`);
      if (step.note) lines.push(`  note "${step.note.replace(/"/g, '\\"')}"`);
      if (step.polymer) {
        const p = typeof step.polymer === 'object' ? step.polymer : { label: String(step.polymer) };
        const labelStr = p.label || 'n';
        const tagStr = p.tag ? ` tag "${p.tag.replace(/"/g, '\\"')}"` : '';
        let filterStr = '';
        if (Array.isArray(p.includeIds) && p.includeIds.length) {
          filterStr = ` include "${p.includeIds.join(' ')}"`;
        } else if (Array.isArray(p.excludeIds) && p.excludeIds.length) {
          filterStr = ` exclude "${p.excludeIds.join(' ')}"`;
        }
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
        lines.push(`  polymer "${labelStr}"${tagStr}${filterStr}${leftStr}${rightStr}`);
      }
      if (step.aromatic) {
        const aromatics = Array.isArray(step.aromatic) ? step.aromatic : [step.aromatic];
        aromatics.forEach(ar => {
          const atomList = Array.isArray(ar) ? ar.join(' ') : (Array.isArray(ar.atomIds) ? ar.atomIds.join(' ') : (ar.atomIds || ''));
          const tagStr = ar.tag ? ` tag "${ar.tag.replace(/"/g, '\\"')}"` : '';
          lines.push(`  aromatic "${atomList}"${tagStr}`);
        });
      }
      lines.push('');
      lines.push('  # 原子定义: atom <ID> <元素> [可选X Y Z坐标] [radical] [charge=+1/-1]');
      (step.atoms || []).forEach(a => {
        let extra = '';
        if (a.radical) extra += ' radical';
        if (a.charge) extra += ` charge=${a.charge > 0 ? '+' + a.charge : a.charge}`;
        if (!a.autoLayout && typeof a.x === 'number' && typeof a.y === 'number' && typeof a.z === 'number') {
          lines.push(`  atom ${a.id} ${a.element} ${a.x.toFixed(2)} ${a.y.toFixed(2)} ${a.z.toFixed(2)}${extra}`);
        } else {
          lines.push(`  atom ${a.id} ${a.element}${extra}`);
        }
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
   * 将 CCPL 脚本解析为反应对象，进行严格语法校验与空间构型解算
   */
  parse(scriptText) {
    if (!scriptText || !scriptText.trim()) {
      throw new Error('脚本内容为空，请输入有效的 CCPL 推演脚本');
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

    function normalizeEquation(eqStr) {
      if (!eqStr) return '';
      return eqStr
        .replace(/<==>|<=>/g, '⇌')
        .replace(/==/g, '⇌')
        .replace(/<-->|<->/g, '↔')
        .replace(/-->|->/g, '→')
        .replace(/<--|<-/g, '←');
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
      const line = stripCCPLInlineComment(rawLine);

      if (!line) continue;

      if (currentStep === null) {
        const rxMatch = line.match(/^reaction\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (rxMatch) {
          reaction.name = this.formatChemText(rxMatch[1].replace(/\\"/g, '"'));
          continue;
        }
        if (/^reaction\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: reaction 指令格式错误，必须使用双引号包裹反应名称，例如: reaction "反应名称"`);
        }

        const eqMatch = line.match(/^equation\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (eqMatch) {
          reaction.equation = this.formatChemText(eqMatch[1].replace(/\\"/g, '"'));
          continue;
        }
        if (/^equation\b/i.test(line)) {
          throw new Error(`第 ${lineNum} 行语法错误: equation 指令格式错误，必须使用双引号包裹化学方程式，例如: equation "A + B -> C"`);
        }

        // 兼容旧脚本中的 category 声明，静默跳过
        if (/^category\b/i.test(line)) {
          continue;
        }

        const sumMatch = line.match(/^summary\s+"((?:[^"\\]|\\.)*)"\s*$/i);
        if (sumMatch) {
          reaction.summary = this.formatChemText(sumMatch[1].replace(/\\"/g, '"'));
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
          const rawName = stepMatch[1].replace(/\\"/g, '"');
          // 步骤序号无需用户手写，自动智能去除前缀标号（如 "1. "、"步骤1: "、"一、"）
          const cleanName = rawName.replace(/^\s*(?:(?:第\s*)?\d+\s*(?:步|节)?|[一二三四五六七八九十]+)[\.、:\s-]\s*/i, '').trim() || rawName;
          currentStep = {
            name: this.formatChemText(cleanName),
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
          throw new Error(`第 ${lineNum} 行语法错误: step 指令格式错误，格式为: step "步骤名称" {（无需手动填写序号）`);
        }

        if (line === '}') {
          throw new Error(`第 ${lineNum} 行语法错误: 意外的多余闭合括号 '}'`);
        }

        throw new Error(`第 ${lineNum} 行语法错误: 未知的全局指令 "${line}"，有效指令包括 reaction, equation, summary, step`);
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
        if (currentStep.polymer && Array.isArray(currentStep.polymer.includeIds)) {
          for (const inId of currentStep.polymer.includeIds) {
            if (!currentStepAtomIds.has(inId)) {
              throw new Error(`第 ${currentStep.polymerLineNum} 行语法错误: polymer include 包含的原子 "${inId}" 在步骤 "${currentStep.name}" 中未定义`);
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
        currentStep.note = this.formatChemText(noteMatch[1].replace(/\\"/g, '"'));
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
          const inclMatch = line.match(/include\s+"((?:[^"\\]|\\.)*)"/i);
          if ((!exclMatch || quotes[1] !== exclMatch[1]) && (!inclMatch || quotes[1] !== inclMatch[1])) {
            tag = quotes[1].replace(/\\"/g, '"');
          }
        }

        const inclMatch = line.match(/include\s+"((?:[^"\\]|\\.)*)"/i);
        const exclMatch = line.match(/exclude\s+"((?:[^"\\]|\\.)*)"/i);

        if (inclMatch && exclMatch) {
          throw new Error(`第 ${lineNum} 行语法错误: polymer 指令中 include 与 exclude 为互斥选项，每次只能使用其中一个（二选一：使用 include 正向包含重复单元原子，或使用 exclude 排除副产物原子）`);
        }

        const includeIds = inclMatch ? inclMatch[1].replace(/\\"/g, '"').split(/\s+/).filter(Boolean) : [];
        const excludeIds = exclMatch ? exclMatch[1].replace(/\\"/g, '"').split(/\s+/).filter(Boolean) : [];

        const polymerObj = { label: this.formatChemText(label), tag: this.formatChemText(tag), includeIds, excludeIds };

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
        const parts = line.split(/\s+/);
        if (parts.length < 3) {
          throw new Error(`第 ${lineNum} 行语法错误: atom 指令参数不足，至少需指定原子 ID 与元素符号，例如: atom C1 C`);
        }

        const atomId = parts[1];
        if (!/^[A-Za-z0-9_]+$/.test(atomId)) {
          throw new Error(`第 ${lineNum} 行语法错误: 无效的原子 ID "${atomId}"，ID 只能由英文字母、数字和下划线组成`);
        }

        const rawElem = parts[2];
        const normElem = rawElem.charAt(0).toUpperCase() + rawElem.slice(1).toLowerCase();
        if (!VALID_CCPL_ELEMENTS.has(normElem)) {
          throw new Error(`第 ${lineNum} 行语法错误: 未知的化学元素符号 "${rawElem}"`);
        }

        if (currentStepAtomIds.has(atomId)) {
          throw new Error(`第 ${lineNum} 行语法错误: 步骤 "${currentStep.name}" 中重复定义了原子 ID "${atomId}"`);
        }

        let x = null, y = null, z = null;
        let radical = false;
        let charge = 0;

        const extraTokens = parts.slice(3);
        const numericTokens = [];
        for (const token of extraTokens) {
          if (/^radical$/i.test(token)) {
            radical = true;
          } else if (/^charge=([+-]?\d*)$/i.test(token)) {
            const chgMatch = token.match(/^charge=([+-]?\d*)$/i);
            const val = chgMatch[1];
            if (val === '+' || val === '') charge = 1;
            else if (val === '-') charge = -1;
            else charge = parseInt(val, 10) || 0;
          } else if (!isNaN(parseFloat(token))) {
            numericTokens.push(parseFloat(token));
          } else {
            throw new Error(`第 ${lineNum} 行语法错误: atom 指令中未知的参数 "${token}"，支持 [X Y Z] 坐标、radical、charge=+1/-1`);
          }
        }

        if (numericTokens.length === 3) {
          [x, y, z] = numericTokens;
        } else if (numericTokens.length !== 0) {
          throw new Error(`第 ${lineNum} 行语法错误: atom 坐标格式错误，必须提供完整的 X Y Z 三维数值或不提供坐标，例如: atom C1 C 0.0 1.5 -0.5`);
        }

        currentStepAtomIds.add(atomId);
        const atomObj = { id: atomId, element: normElem, x, y, z };
        if (numericTokens.length === 0) {
          atomObj.autoLayout = true;
        }
        if (radical) atomObj.radical = true;
        if (charge !== 0) atomObj.charge = charge;
        currentStep.atoms.push(atomObj);
        continue;
      }

      // 自由基声明: radical <atomId1> [atomId2 ...]
      if (/^radical\b/i.test(line)) {
        const parts = line.split(/\s+/).slice(1);
        if (parts.length === 0) {
          throw new Error(`第 ${lineNum} 行语法错误: radical 指令缺少原子 ID，例如: radical Cl2 C1`);
        }
        for (const aId of parts) {
          const target = currentStep.atoms.find(a => a.id === aId);
          if (!target) {
            throw new Error(`第 ${lineNum} 行语法错误: radical 指令引用的原子 "${aId}" 尚未声明`);
          }
          target.radical = true;
        }
        continue;
      }

      // 形式电荷声明: charge <atomId> <+1|-1|+|-|值>
      if (/^charge\b/i.test(line)) {
        const parts = line.split(/\s+/);
        if (parts.length < 3) {
          throw new Error(`第 ${lineNum} 行语法错误: charge 指令参数不足，格式为: charge <原子ID> <电荷值>，例如: charge O1 -1`);
        }
        const aId = parts[1];
        const valStr = parts[2];
        const target = currentStep.atoms.find(a => a.id === aId);
        if (!target) {
          throw new Error(`第 ${lineNum} 行语法错误: charge 指令引用的原子 "${aId}" 尚未声明`);
        }
        let chg = 0;
        if (valStr === '+' || valStr === '+1') chg = 1;
        else if (valStr === '-' || valStr === '-1') chg = -1;
        else chg = parseInt(valStr, 10);
        if (isNaN(chg)) {
          throw new Error(`第 ${lineNum} 行语法错误: charge 电荷值 "${valStr}" 无效，例如: charge O1 -1 或 charge O2 +1`);
        }
        target.charge = chg;
        continue;
      }

      // 芳香体系大 Π 键声明 (可选): aromatic "<原子列表如 C1 C2 C3 C4 C5 C6>" [tag "<说明如 Π_6^6>"]
      if (/^(?:aromatic|pi)\b/i.test(line)) {
        const tagMatch = line.match(/tag\s+"((?:[^"\\]|\\.)*)"/i);
        const tag = tagMatch ? this.formatChemText(tagMatch[1].replace(/\\"/g, '"')) : '';
        const cleanLine = line.replace(/tag\s+"(?:[^"\\]|\\.)*"/i, '').replace(/^(?:aromatic|pi)\b/i, '').trim();
        const quoteMatch = cleanLine.match(/"((?:[^"\\]|\\.)*)"/);
        const atomStr = quoteMatch ? quoteMatch[1] : cleanLine;
        const atomIds = atomStr.split(/\s+/).filter(Boolean);
        if (atomIds.length < 3) {
          throw new Error(`第 ${lineNum} 行语法错误: aromatic 指令声明的环原子数量不足，至少需要 3 个原子构成环，例如: aromatic "C1 C2 C3 C4 C5 C6"`);
        }
        currentStep.aromatic = currentStep.aromatic || [];
        currentStep.aromatic.push({ atomIds, tag });
        continue;
      }

      if (/^bond\b/i.test(line)) {
        const bondMatch = line.match(/^bond\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(?:\s+([123]|1\.5))?\s*$/i);
        if (!bondMatch) {
          const parts = line.split(/\s+/);
          if (parts.length < 3) {
            throw new Error(`第 ${lineNum} 行语法错误: bond 指令参数不足，格式应为: bond <原子1> <原子2> [键级1/1.5/2/3]`);
          }
          if (parts.length > 4) {
            throw new Error(`第 ${lineNum} 行语法错误: bond 指令参数过多，格式应为: bond <原子1> <原子2> [键级1/1.5/2/3]`);
          }
          if (parts.length === 4 && !['1', '1.5', '2', '3'].includes(parts[3])) {
            throw new Error(`第 ${lineNum} 行语法错误: 化学键键级 "${parts[3]}" 无效，键级只能为 1 (单键)、1.5 (芳香/共振键)、2 (双键) 或 3 (三键)`);
          }
          throw new Error(`第 ${lineNum} 行语法错误: bond 指令格式错误，格式应为: bond <原子1> <原子2> [键级1/1.5/2/3]`);
        }

        const atom1Id = bondMatch[1];
        const atom2Id = bondMatch[2];
        const order = bondMatch[3] ? parseFloat(bondMatch[3]) : 1;

        if (atom1Id === atom2Id) {
          throw new Error(`第 ${lineNum} 行语法错误: 原子无法与自身成键 "${atom1Id}"`);
        }

        currentStepBonds.push({ atom1Id, atom2Id, order, lineNum });
        currentStep.bonds.push({ atom1Id, atom2Id, order });
        continue;
      }

      throw new Error(`第 ${lineNum} 行语法错误: 步骤 "${currentStep.name}" 中存在无法识别的指令 "${line}"，有效指令包括 note, polymer, aromatic, atom, bond`);
    }

    if (currentStep !== null) {
      throw new Error(`第 ${lines.length} 行语法错误: 步骤 "${currentStep.name}" (开始于第 ${currentStepStartLine} 行) 缺少闭合括号 '}'`);
    }

    if (reaction.steps.length === 0) {
      throw new Error('语法错误: 脚本中未包含任何基元反应步骤，请使用 step "步骤名称" { ... } 声明');
    }

    // 对所有步骤中缺少坐标的原子执行自动空间拓扑松弛解算
    reaction.steps.forEach(st => this.autoLayoutStep(st));

    return reaction;
  },

  /**
   * 对未提供三维坐标的原子进行自动空间立体排布 (基于分子图论、化学键拓扑与距离几何力场松弛)
   */
  autoLayoutStep(step) {
    if (!step.atoms || step.atoms.length === 0) return;

    // 检查是否有缺失坐标的原子或无效数值
    const needLayout = step.atoms.some(a => a.x === null || a.y === null || a.z === null || typeof a.x !== 'number' || typeof a.y !== 'number' || typeof a.z !== 'number' || isNaN(a.x) || isNaN(a.y) || isNaN(a.z));
    if (!needLayout) return;

    const atoms = step.atoms;
    const bonds = step.bonds || [];

    const atomMap = new Map();
    atoms.forEach(a => {
      atomMap.set(a.id, a);
      if (a.x === null || a.x === undefined || typeof a.x !== 'number' || isNaN(a.x)) {
        a.autoLayout = true;
      }
    });

    // 1. 构建化学键邻接表
    const adj = new Map();
    atoms.forEach(a => adj.set(a.id, []));
    bonds.forEach(b => {
      if (adj.has(b.atom1Id) && adj.has(b.atom2Id)) {
        adj.get(b.atom1Id).push({ target: b.atom2Id, order: b.order || 1 });
        adj.get(b.atom2Id).push({ target: b.atom1Id, order: b.order || 1 });
      }
    });

    // 2. 识别连通分子组件 (Connected Components)
    const visited = new Set();
    const components = [];

    atoms.forEach(a => {
      if (!visited.has(a.id)) {
        const compAtoms = [];
        const queue = [a.id];
        visited.add(a.id);
        while (queue.length > 0) {
          const currId = queue.shift();
          compAtoms.push(currId);
          (adj.get(currId) || []).forEach(edge => {
            if (!visited.has(edge.target)) {
              visited.add(edge.target);
              queue.push(edge.target);
            }
          });
        }
        components.push(compAtoms);
      }
    });

    // 3. 对每个连通分子分别进行基于真实键长拓扑的三维弹簧-电荷力场松弛 (Kamada-Kawai + VSEPR)
    const compLayouts = components.map(compIds => {
      const compN = compIds.length;
      const idToIdx = new Map();
      compIds.forEach((id, i) => idToIdx.set(id, i));

      // Floyd-Warshall 计算图内所有原子对之间的拓扑最短路径
      const dist = Array.from({ length: compN }, () => Array(compN).fill(Infinity));
      for (let i = 0; i < compN; i++) dist[i][i] = 0;

      compIds.forEach((uId, i) => {
        (adj.get(uId) || []).forEach(edge => {
          if (idToIdx.has(edge.target)) {
            const j = idToIdx.get(edge.target);
            dist[i][j] = 1;
            dist[j][i] = 1;
          }
        });
      });

      for (let k = 0; k < compN; k++) {
        for (let i = 0; i < compN; i++) {
          for (let j = 0; j < compN; j++) {
            if (dist[i][k] + dist[k][j] < dist[i][j]) {
              dist[i][j] = dist[i][k] + dist[k][j];
            }
          }
        }
      }

      // 计算真实目标化学键长与键角几何距离
      const targetD = Array.from({ length: compN }, () => Array(compN).fill(0));
      for (let i = 0; i < compN; i++) {
        for (let j = 0; j < compN; j++) {
          if (i === j) continue;
          const d = dist[i][j];
          const a1 = atomMap.get(compIds[i]);
          const a2 = atomMap.get(compIds[j]);
          const isH = (a1 && a1.element === 'H') || (a2 && a2.element === 'H');

          if (d === 1) {
            if (isH) {
              targetD[i][j] = 1.08;
            } else {
              const edge = (adj.get(compIds[i]) || []).find(e => e.target === compIds[j]);
              const ord = edge ? edge.order : 1;
              targetD[i][j] = ord === 3 ? 1.20 : (ord === 2 ? 1.34 : (ord === 1.5 ? 1.39 : 1.50));
            }
          } else if (d === 2) {
            targetD[i][j] = isH ? 1.85 : 2.45;
          } else if (d === 3) {
            targetD[i][j] = 3.05;
          } else {
            targetD[i][j] = 2.8 + (d - 3) * 1.25;
          }
        }
      }

      // 骨架原子与氢原子分层初布局
      const heavyIds = compIds.filter(id => {
        const a = atomMap.get(id);
        return a && a.element !== 'H';
      });
      const hIds = compIds.filter(id => {
        const a = atomMap.get(id);
        return a && a.element === 'H';
      });
      const pos = compIds.map(() => ({ x: 0, y: 0, z: 0 }));

      heavyIds.forEach((hId, idx) => {
        const i = idToIdx.get(hId);
        const angle = (2 * Math.PI * idx) / Math.max(1, heavyIds.length);
        const r = Math.max(0.9, heavyIds.length * 0.28);
        pos[i].x = r * Math.cos(angle);
        pos[i].y = r * Math.sin(angle);
        pos[i].z = Math.sin(idx * 2.1) * 0.35;
      });

      hIds.forEach((hId, hIdx) => {
        const i = idToIdx.get(hId);
        const parentEdge = (adj.get(hId) || [])[0];
        if (parentEdge && idToIdx.has(parentEdge.target)) {
          const pIdx = idToIdx.get(parentEdge.target);
          const parentPos = pos[pIdx];
          const offsetAngle = (hIdx * 1.6) + Math.PI / 4;
          pos[i].x = parentPos.x + 1.08 * Math.cos(offsetAngle);
          pos[i].y = parentPos.y + 1.08 * Math.sin(offsetAngle);
          pos[i].z = parentPos.z + (hIdx % 2 === 0 ? 0.38 : -0.38);
        } else {
          const angle = (2 * Math.PI * hIdx) / Math.max(1, hIds.length);
          pos[i].x = 1.8 * Math.cos(angle);
          pos[i].y = 1.8 * Math.sin(angle);
          pos[i].z = 0;
        }
      });

      // 模拟退火力场迭代松弛
      const iterations = 160;
      for (let iter = 0; iter < iterations; iter++) {
        const temp = 0.3 * Math.pow(1 - iter / iterations, 1.2);
        const forces = compIds.map(() => ({ x: 0, y: 0, z: 0 }));

        for (let i = 0; i < compN; i++) {
          for (let j = i + 1; j < compN; j++) {
            let dx = pos[i].x - pos[j].x;
            let dy = pos[i].y - pos[j].y;
            let dz = pos[i].z - pos[j].z;
            let curDist = Math.hypot(dx, dy, dz);
            if (curDist < 0.001) {
              dx = (Math.random() - 0.5) * 0.05;
              dy = (Math.random() - 0.5) * 0.05;
              dz = (Math.random() - 0.5) * 0.05;
              curDist = Math.hypot(dx, dy, dz);
            }

            const target = targetD[i][j];
            const weight = 1.0 / (target * target);
            const delta = curDist - target;
            const fMag = weight * delta;

            const fx = (dx / curDist) * fMag;
            const fy = (dy / curDist) * fMag;
            const fz = (dz / curDist) * fMag;

            forces[i].x -= fx;
            forces[i].y -= fy;
            forces[i].z -= fz;

            forces[j].x += fx;
            forces[j].y += fy;
            forces[j].z += fz;

            // 非键合原子之间的立体位阻排斥势能，防止原子重叠穿模
            if (dist[i][j] > 1 && curDist < 1.7) {
              const rep = 1.5 / (curDist * curDist + 0.05);
              forces[i].x += (dx / curDist) * rep;
              forces[i].y += (dy / curDist) * rep;
              forces[i].z += (dz / curDist) * rep;
              forces[j].x -= (dx / curDist) * rep;
              forces[j].y -= (dy / curDist) * rep;
              forces[j].z -= (dz / curDist) * rep;
            }
          }
        }

        for (let i = 0; i < compN; i++) {
          const fLen = Math.hypot(forces[i].x, forces[i].y, forces[i].z);
          if (fLen > 0) {
            const move = Math.min(fLen, temp);
            pos[i].x += (forces[i].x / fLen) * move;
            pos[i].y += (forces[i].y / fLen) * move;
            pos[i].z += (forces[i].z / fLen) * move;
          }
        }
      }

      // 将连通分子居中于局部原点
      let cx = 0, cy = 0, cz = 0;
      pos.forEach(p => { cx += p.x; cy += p.y; cz += p.z; });
      cx /= compN; cy /= compN; cz /= compN;
      pos.forEach(p => { p.x -= cx; p.y -= cy; p.z -= cz; });

      return { compIds, pos };
    });

    // 4. 将各独立分子按反应空间相对位置错开排布
    if (compLayouts.length === 1) {
      const { compIds, pos } = compLayouts[0];
      compIds.forEach((id, i) => {
        const a = atomMap.get(id);
        if (a) {
          a.x = +pos[i].x.toFixed(2);
          a.y = +pos[i].y.toFixed(2);
          a.z = +pos[i].z.toFixed(2);
        }
      });
    } else if (compLayouts.length === 2) {
      // 两个反应物分子（如双烯体与亲双烯体）：分列左右 X 轴对称朝向碰撞
      const offsets = [-2.4, 2.4];
      compLayouts.forEach((comp, cIdx) => {
        const offX = offsets[cIdx];
        comp.compIds.forEach((id, i) => {
          const a = atomMap.get(id);
          if (a) {
            a.x = +(comp.pos[i].x + offX).toFixed(2);
            a.y = +comp.pos[i].y.toFixed(2);
            a.z = +comp.pos[i].z.toFixed(2);
          }
        });
      });
    } else {
      const span = 2.6;
      const startX = -((compLayouts.length - 1) * span) / 2;
      compLayouts.forEach((comp, cIdx) => {
        const offX = startX + cIdx * span;
        comp.compIds.forEach((id, i) => {
          const a = atomMap.get(id);
          if (a) {
            a.x = +(comp.pos[i].x + offX).toFixed(2);
            a.y = +comp.pos[i].y.toFixed(2);
            a.z = +comp.pos[i].z.toFixed(2);
          }
        });
      });
    }
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
  note "亲电试剂进攻 C=C 不饱和双键，π 键解离，形成带正电碳正离子中间体。"

  atom C1 C -1.2 0 0
  atom C2 C 1.2 0 0 charge=+1
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

  atom C1 C -1.5 0 0 radical
  atom H1 H -0.3 0 0
  atom Cl1 Cl 1.8 0 0 radical
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

  # 聚合物括号语法: polymer "<聚合度下标如 n>" ["说明标签"] [include "<聚合单元原子ID列表>" | exclude "<副产物原子ID列表>"] (二选一)
  polymer "n" "[单体最简重复单元]_n" include "C1 C2 O1"

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
}
`;
    }

    if (type === 'aromatic_step') {
      return `\nstep "芳香体系与大 Π 键" {
  note "六元芳香环具备高度对称与能量极低的闭合大 Π 键电子云。"

  # 可选声明闭合共轭大 Π 键 (参数: 构成芳香环的原子ID列表，可选 tag 标注)
  aromatic "C1 C2 C3 C4 C5 C6" tag "Π_6^6"

  atom C1 C 0 1.4 0
  atom C2 C 1.21 0.7 0
  atom C3 C 1.21 -0.7 0
  atom C4 C 0 -1.4 0
  atom C5 C -1.21 -0.7 0
  atom C6 C -1.21 0.7 0

  bond C1 C2 1.5
  bond C2 C3 1.5
  bond C3 C4 1.5
  bond C4 C5 1.5
  bond C5 C6 1.5
  bond C6 C1 1.5
}
`;
    }

    if (type === 'reaction_blank') {
      return `# Chemiation 反应机理推演脚本 (CCPL)
reaction "新建化学反应"
equation "A + B <=> C + D"
summary "在此输入关于该反应原理、过渡态与机理路径的详细说明。"

step "反应物底物吸附与碰撞" {
  note "底物分子靠近，化学键受到极化并准备重构。"

  atom A1 C -1.5 0 0
  atom A2 O 1.5 0 0
  atom H1 H -1.5 1.2 0
  atom H2 H 1.2 1.2 0

  bond A1 H1 1
  bond A2 H2 1
}

step "产物分子生成与脱附" {
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
