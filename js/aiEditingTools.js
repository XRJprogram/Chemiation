/* Text-preserving step edits and bounded comparisons; no DOM or network access. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChemiationAIEditing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function fail(message) { throw new Error(message); }
  function cleanLine(line) {
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (quoted && line[i] === '\\') { i++; continue; }
      if (line[i] === '"') quoted = !quoted;
      if (!quoted && (line[i] === '#' || line.slice(i, i + 2) === '//')) return line.slice(0, i).trim();
    }
    return line.trim();
  }
  function ccplDocument(script) {
    const steps = [];
    const lines = script.match(/[^\n]*(?:\n|$)/g) || [];
    let offset = 0, current = null;
    for (const line of lines) {
      const content = cleanLine(line.replace(/\r?\n$/, ''));
      const header = content.match(/^step\s+"((?:[^"\\]|\\.)*)"\s*(\{)?\s*$/i);
      if (header) {
        if (current) fail('步骤未闭合，暂时无法限定修改范围；请先使用整份脚本排错');
        current = { index: steps.length, name: header[1].replace(/\\"/g, '"'), start: offset, opened: !!header[2] };
      } else if (current && !current.opened && content) {
        if (content !== '{') fail('步骤缺少开始括号，暂时无法限定修改范围');
        current.opened = true;
      } else if (current && content === '}') {
        current.end = offset + line.replace(/\r?\n$/, '').length;
        current.text = script.slice(current.start, current.end);
        steps.push(current);
        current = null;
      }
      offset += line.length;
    }
    if (current) fail('步骤未闭合，暂时无法限定修改范围；请先使用整份脚本排错');
    if (!steps.length) fail('当前脚本没有可选择的完整步骤');
    return { format: 'ccpl', script, steps, eol: script.includes('\r\n') ? '\r\n' : '\n' };
  }
  function jsonDocument(script) {
    const data = JSON.parse(script);
    if (!data || Array.isArray(data) || !Array.isArray(data.steps) || !data.steps.length) fail('JSON 缺少 steps 步骤数组');
    const ws = i => { while (/\s/.test(script[i] || '') && i < script.length) i++; return i; };
    const stringEnd = start => {
      for (let i = start + 1; i < script.length; i++) {
        if (script[i] === '\\') i++;
        else if (script[i] === '"') return i + 1;
      }
      fail('JSON 字符串未闭合');
    };
    const valueEnd = start => {
      if (script[start] === '"') return stringEnd(start);
      if (script[start] === '[' || script[start] === '{') {
        let depth = 0;
        for (let i = start; i < script.length; i++) {
          if (script[i] === '"') i = stringEnd(i) - 1;
          else if (script[i] === '[' || script[i] === '{') depth++;
          else if (script[i] === ']' || script[i] === '}') { if (--depth === 0) return i + 1; }
        }
      } else {
        let i = start;
        while (i < script.length && !/[\s,\]}]/.test(script[i])) i++;
        return i;
      }
      fail('JSON 结构未闭合');
    };
    let cursor = ws(script.indexOf('{') + 1), arrayStart = -1;
    while (script[cursor] !== '}') {
      const keyEnd = stringEnd(cursor);
      const key = JSON.parse(script.slice(cursor, keyEnd));
      const start = ws(ws(keyEnd) + 1);
      const end = valueEnd(start);
      if (key === 'steps') {
        if (arrayStart !== -1) fail('JSON 含重复 steps 字段，无法安全限定修改范围');
        arrayStart = start;
      }
      cursor = ws(end);
      if (script[cursor] === ',') cursor = ws(cursor + 1);
    }
    const steps = [];
    cursor = ws(arrayStart + 1);
    while (script[cursor] !== ']') {
      const end = valueEnd(cursor);
      const index = steps.length;
      const step = data.steps[index];
      if (!step || typeof step !== 'object' || Array.isArray(step)) fail('JSON 步骤必须是对象');
      steps.push({ index, name: step.name || `步骤 ${index + 1}`, start: cursor, end, text: script.slice(cursor, end) });
      cursor = ws(end);
      if (script[cursor] === ',') cursor = ws(cursor + 1);
    }
    return { format: 'json', script, steps, data, eol: script.includes('\r\n') ? '\r\n' : '\n' };
  }
  function documentOf(script) {
    if (typeof script !== 'string' || !script.trim() || script.length > 200000) fail('请使用不超过 200000 字符的有效脚本');
    return script.trimStart().startsWith('{') ? jsonDocument(script) : ccplDocument(script);
  }
  function createScope(script, selected) {
    const document = documentOf(script);
    const indices = [...new Set(selected)].sort((a, b) => a - b);
    if (!indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= document.steps.length)) fail('请至少选择一个有效步骤');
    return { document, indices };
  }
  function protectedParts(document, indices) {
    let cursor = 0;
    const parts = [];
    for (const index of indices) {
      const step = document.steps[index];
      parts.push(document.script.slice(cursor, step.start));
      cursor = step.end;
    }
    parts.push(document.script.slice(cursor));
    return parts;
  }
  function assertScope(scope, script) {
    if (!scope) return true;
    const result = documentOf(script);
    if (result.format !== scope.document.format || result.steps.length !== scope.document.steps.length) fail('指定步骤模式不能增删步骤或更换脚本格式');
    const before = protectedParts(scope.document, scope.indices);
    const after = protectedParts(result, scope.indices);
    if (before.some((part, i) => part !== after[i])) fail('检测到未选中步骤或全局信息被修改，已阻止载入');
    return true;
  }
  function mergeSelected(scope, output) {
    const patch = documentOf(output);
    if (patch.format !== scope.document.format || patch.steps.length !== scope.indices.length) fail(`请仅输出选中的 ${scope.indices.length} 个步骤，保持原顺序，不要输出完整脚本`);
    if (patch.format === 'ccpl') {
      if (protectedParts(patch, patch.steps.map(step => step.index)).some(part => part.split(/\r?\n/).some(line => cleanLine(line)))) fail('指定步骤模式只接受 step 块，请移除 reaction、equation 等全局内容');
    } else if (Object.keys(patch.data).some(key => key !== 'steps')) fail('指定步骤模式只接受 {"steps":[...]}，请移除其他字段');
    let script = scope.document.script;
    for (let i = scope.indices.length - 1; i >= 0; i--) {
      const target = scope.document.steps[scope.indices[i]];
      const replacement = patch.steps[i].text.replace(/\r?\n/g, scope.document.eol);
      script = script.slice(0, target.start) + replacement + script.slice(target.end);
    }
    assertScope(scope, script);
    return script;
  }
  function compare(before, after) {
    if (before.length > 200000 || after.length > 200000) return { added: 0, removed: 0, rows: [], approximate: false, truncated: true, unavailable: true, identical: before === after, changedSteps: [], globalChanged: false };
    const a = before ? before.split(/\r?\n/) : [], b = after ? after.split(/\r?\n/) : [];
    let head = 0, tail = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
    const left = a.slice(head, a.length - tail), right = b.slice(head, b.length - tail);
    const operations = a.slice(0, head).map(text => ({ type: 'equal', text }));
    const approximate = (left.length + 1) * (right.length + 1) > 250000;
    if (!approximate) {
      const width = right.length + 1, table = new Uint32Array((left.length + 1) * width);
      for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) {
        table[i * width + j] = left[i] === right[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
      let i = 0, j = 0;
      while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length && left[i] === right[j]) { operations.push({ type: 'equal', text: left[i++] }); j++; }
        else if (i < left.length && (j === right.length || table[(i + 1) * width + j] >= table[i * width + j + 1])) operations.push({ type: 'remove', text: left[i++] });
        else operations.push({ type: 'add', text: right[j++] });
      }
    } else {
      left.forEach(text => operations.push({ type: 'remove', text }));
      right.forEach(text => operations.push({ type: 'add', text }));
    }
    a.slice(a.length - tail).forEach(text => operations.push({ type: 'equal', text }));
    let oldLine = 0, newLine = 0, added = 0, removed = 0;
    operations.forEach(row => {
      row.oldLine = row.type === 'add' ? null : ++oldLine;
      row.newLine = row.type === 'remove' ? null : ++newLine;
      if (row.type === 'add') added++;
      if (row.type === 'remove') removed++;
    });
    const visible = new Set();
    operations.forEach((row, i) => { if (row.type !== 'equal') for (let j = Math.max(0, i - 2); j <= Math.min(operations.length - 1, i + 2); j++) visible.add(j); });
    const rows = [];
    let previous = -1;
    for (const index of [...visible].sort((x, y) => x - y)) {
      if (rows.length >= 600) break;
      if (index > previous + 1) rows.push({ type: 'gap', text: '… 未修改内容 …' });
      rows.push(operations[index]);
      previous = index;
    }
    const changedSteps = [];
    let globalChanged = false;
    try {
      const original = documentOf(before), result = documentOf(after);
      for (let i = 0; i < Math.max(original.steps.length, result.steps.length); i++) {
        if (original.steps[i]?.text !== result.steps[i]?.text) changedSteps.push({ index: i, name: result.steps[i]?.name || original.steps[i].name });
      }
      globalChanged = JSON.stringify(protectedParts(original, original.steps.map(step => step.index))) !== JSON.stringify(protectedParts(result, result.steps.map(step => step.index)));
    } catch (_) { /* Syntax failures still have a useful text comparison. */ }
    return { added, removed, rows, approximate, truncated: visible.size > 600, identical: before === after, lineEndingsOnly: before !== after && !added && !removed, changedSteps, globalChanged };
  }
  return { documentOf, createScope, assertScope, mergeSelected, compare };
});
