/* Shared, dependency-free conversation contracts and conservative mechanism lookup. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChemiationStudioCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = { messages: 160, versions: 40, characters: 2400000, script: 200000 };
  function fail(message, statusCode = 400) { const e = new Error(message); e.statusCode = statusCode; return e; }
  function id() { return globalThis.crypto?.randomUUID?.() || 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
  function key(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw fail('记录编号无效'); return value; }
  function str(value, max = 300) { return typeof value === 'string' ? value.slice(0, max) : ''; }
  function projectId(value) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string' || value.length > 200 || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) throw fail('机理项目编号无效');
    return value.trim();
  }
  function normalize(value) {
    if (!value || !Array.isArray(value.messages) || !Array.isArray(value.versions)) throw fail('聊天记录格式无效');
    if (value.messages.length > LIMITS.messages || value.versions.length > LIMITS.versions) throw fail('本次会话已达到保存上限，请导出后新建会话；旧记录已保留', 413);
    const ids = new Set();
    const unique = v => { key(v); if (ids.has(v)) throw fail('记录编号重复'); ids.add(v); return v; };
    const versions = value.versions.map(v => {
      if (!v || typeof v.script !== 'string' || v.script.length > LIMITS.script) throw fail('脚本版本过长或格式无效');
      return { id: unique(v.id), script: v.script, label: str(v.label, 200), createdAt: str(v.createdAt, 40),
        source: str(v.source, 200), status: ['candidate', 'accepted', 'restored'].includes(v.status) ? v.status : 'candidate',
        parentId: str(v.parentId, 100), request: str(v.request, 4000), scope: str(v.scope, 100) };
    });
    const messages = value.messages.map(m => {
      if (!m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 12000) throw fail('聊天消息格式无效或过长');
      const message = { id: unique(m.id), role: m.role, text: m.text, createdAt: str(m.createdAt, 40), versionId: str(m.versionId, 100), replyTo: str(m.replyTo, 100) };
      if (m.role === 'assistant' && m.question) message.question = normalizeQuestion(m.question);
      return message;
    });
    const result = { schema: 1, id: key(value.id), title: str(value.title, 100) || '新的机理对话',
      projectId: projectId(value.projectId), projectName: str(value.projectName, 200), draft: str(value.draft, 4000),
      createdAt: str(value.createdAt, 40), updatedAt: str(value.updatedAt, 40),
      revision: Math.max(0, Math.floor(Number(value.revision) || 0)), messages, versions,
      localRevision: Math.max(0, Math.floor(Number(value.localRevision) || 0)),
      activeVersionId: versions.some(v => v.id === value.activeVersionId) ? value.activeVersionId : '' };
    if (JSON.stringify(result).length > LIMITS.characters) throw fail('会话空间已满，请导出后新建会话；旧记录已保留', 413);
    return result;
  }
  function reactionTitle(script) {
    try {
      if (script.trimStart().startsWith('{')) return str(JSON.parse(script).name, 200);
      const match = script.match(/^\s*reaction\s+("(?:\\.|[^"\\\r\n])*")/m);
      return match ? str(JSON.parse(match[1]), 200) : '';
    } catch (_) { return ''; }
  }
  function metadata(s) {
    return { id: s.id, title: s.title, projectId: s.projectId || '', projectName: s.projectName || '', createdAt: s.createdAt, updatedAt: s.updatedAt, revision: s.revision, messageCount: s.messages.length, versionCount: s.versions.length,
      mechanisms: s.versions.filter(v => v.status === 'accepted' || v.status === 'restored').map(v => ({
        sessionId: s.id, versionId: v.id, title: reactionTitle(v.script), label: v.label
      })).filter(v => v.title) };
  }
  function create(project = {}) { const now = new Date().toISOString(); return { schema: 1, id: id(), projectId: projectId(project.id), projectName: str(project.name, 200), draft: '', title: '新的机理对话', createdAt: now, updatedAt: now, revision: 0, messages: [], versions: [], activeVersionId: '' }; }
  function canonical(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s，。！？、,!?：:；;“”"「」()（）]/g, '').replace(/^(请帮我|请|帮我)?(展示一下|展示|演示一下|演示|生成一下|生成|看看)/, '').replace(/(的)?(反应)?机理$/, ''); }
  function match(query, records, options = {}) {
    const q = canonical(query);
    if (q.length < 2) return [];
    const seen = new Set();
    return records.flatMap(r => {
      if (!r || (!options.metadataOnly && (typeof r.script !== 'string' || !r.script.trim()))) return [];
      const names = [r.title || r.name, ...(r.aliases || [])].map(canonical).filter(n => n.length > 1);
      const exact = names.some(n => n === q);
      let score = exact ? 100 : names.reduce((best, n) => Math.max(best, (q.includes(n) || n.includes(q)) ? Math.min(n.length, q.length) / Math.max(n.length, q.length) * 75 : 0), 0);
      const terms = q.match(/[a-z][a-z0-9+-]{1,}|[\u4e00-\u9fff]{2,}/g) || [];
      const haystack = canonical([r.title || r.name, r.equation, ...(r.tags || [])].join(' '));
      if (!score) score = terms.filter(t => haystack.includes(t)).length * 12;
      const identity = options.metadataOnly ? r.sessionId + ':' + r.versionId : r.script;
      if (score < 18 || seen.has(identity)) return [];
      seen.add(identity);
      // A title match never establishes chemical applicability or scientific correctness.
      return [{ ...r, score, exact, reviewed: r.reviewStatus === 'reviewed', reason: exact ? '名称吻合，请核对反应条件' : '名称或关键词相近，请核对底物和条件' }];
    }).sort((a, b) => b.score - a.score).slice(0, 4);
  }
  function normalizeQuestion(value) {
    if (!value || typeof value.question !== 'string' || !value.question.trim()) return null;
    const seen = new Set();
    const options = (Array.isArray(value.options) ? value.options : []).slice(0, 4).flatMap(option => {
      const label = str(typeof option === 'string' ? option : option?.label, 160).trim();
      const answer = str(typeof option === 'string' ? option : option?.value || label, 300).trim();
      if (!label || !answer || seen.has(answer)) return [];
      seen.add(answer);
      return [{ label, value: answer, description: str(option?.description, 240) }];
    });
    return { question: value.question.trim().slice(0, 4000), options };
  }
  function questionForm(content) {
    const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    if (!text.startsWith('{')) return null;
    try { const v = JSON.parse(text); return v.type === 'question' ? normalizeQuestion(v) : null; } catch (_) { return null; }
  }
  function question(content) { return questionForm(content)?.question || null; }
  // Only return closed step blocks/objects. The caller must validate this prefix before rendering.
  // Missing atoms, bonds, braces or values are never filled in to make a partial step executable.
  function completedSteps(content) {
    let text = String(content || '').trimStart();
    if (text.length > LIMITS.script) return null;
    if (text.startsWith('```')) {
      const fence = text.match(/^```(?:ccpl|chem|script|json)?[ \t]*\r?\n/i);
      if (!fence) return null;
      text = text.slice(fence[0].length);
    }
    if (text.startsWith('{')) {
      const array = /"steps"\s*:\s*\[/.exec(text);
      if (!array) return null;
      const start = array.index + array[0].length;
      let quoted = false, depth = 0, end = -1, count = 0;
      for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (quoted) { if (c === '\\') i++; else if (c === '"') quoted = false; continue; }
        if (c === '"') { quoted = true; continue; }
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') {
          if (depth === 0) break;
          if (--depth === 0) { if (c !== '}') return null; end = i + 1; count++; }
        } else if (depth === 0 && !/[\s,]/.test(c)) return null;
      }
      if (end < 0) return null;
      const script = text.slice(0, end) + ']}';
      try { const value = JSON.parse(script); if (value.type === 'question' || value.steps?.length !== count) return null; } catch (_) { return null; }
      return { script, count };
    }
    let opened = false, end = -1, count = 0, offset = 0;
    for (const line of text.split(/\n/)) {
      let quoted = false, clean = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted && c === '\\') { clean += c + (line[++i] || ''); continue; }
        if (c === '"') quoted = !quoted;
        if (!quoted && (c === '#' || line.slice(i, i + 2) === '//')) break;
        clean += c;
      }
      clean = clean.trim();
      if (/^step\s+"(?:[^"\\]|\\.)*"\s*(?:\{)?\s*$/i.test(clean)) {
        if (opened) return null;
        opened = true;
      } else if (opened && clean === '}') { opened = false; count++; end = offset + line.length; }
      offset += line.length + 1;
    }
    return end < 0 ? null : { script: text.slice(0, end), count };
  }
  function context(messages) {
    let size = 0;
    return messages.slice(-14).map(m => ({ role: m.role, content: m.text + (m.question?.options?.length ? '\n可选回答：' + m.question.options.map(o => o.label + '：' + o.value).join('；') : '') })).reverse().filter(m => { size += m.content.length; return size <= 20000; }).reverse();
  }
  return { LIMITS, fail, id, key, projectId, normalize, metadata, create, match, question, questionForm, normalizeQuestion, completedSteps, context, reactionTitle };
});
