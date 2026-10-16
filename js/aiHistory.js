/* Account-scoped browser history. Writes are atomic and omit API credentials. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChemiationAIHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DATABASE = 'chemiation-ai-history-v1';
  const PREFIX = 'chemiation_ai_history_v1:';
  const LIMITS = { indexedDB: { records: 100, characters: 12000000 }, localStorage: { records: 30, characters: 1200000 } };
  let sequence = 0;
  function error(code, message) { const err = new Error(message); err.code = code; return err; }
  function id() { return Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  const string = (value, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';
  function ownerKey(owner) {
    if (typeof owner !== 'string' || !owner || owner.length > 160) throw error('HISTORY_OWNER', '无法确定历史记录所属账号');
    return owner;
  }
  function normalize(record) {
    if (!record || typeof record.id !== 'string' || !record.id || record.id.length > 120 || !Array.isArray(record.versions) || !record.versions.length || record.versions.length > 8) throw error('HISTORY_FORMAT', '历史记录格式无效，未覆盖已有记录');
    const ids = new Set();
    const versions = record.versions.map(version => {
      if (!version || typeof version.script !== 'string' || version.script.length > 200000 || typeof version.id !== 'string' || !version.id || version.id.length > 100 || ids.has(version.id)) throw error('HISTORY_FORMAT', '版本过长或格式无效，未覆盖已有记录');
      ids.add(version.id);
      return {
        id: string(version.id, 100), label: string(version.label),
        kind: ['draft', 'generated', 'fragment'].includes(version.kind) ? version.kind : 'fragment',
        script: version.script, complete: version.complete === true,
        valid: version.valid === true, finishReason: string(version.finishReason, 50),
        diagnostics: Array.isArray(version.diagnostics) ? version.diagnostics.slice(0, 8).map(value => string(value, 2000)) : [],
        createdAt: string(version.createdAt, 40)
      };
    });
    if (typeof record.createdAt !== 'string' || record.createdAt.length > 40 || !Number.isFinite(Date.parse(record.createdAt))) throw error('HISTORY_FORMAT', '历史记录日期无效，未覆盖已有记录');
    return {
      schema: 1, id: string(record.id, 120), createdAt: record.createdAt,
      kind: record.kind === 'snapshot' ? 'snapshot' : 'generation',
      title: string(record.title) || '未命名记录', prompt: string(record.prompt, 4000),
      mode: string(record.mode, 30), status: string(record.status, 30),
      errorCode: string(record.errorCode, 80),
      provider: string(record.provider), model: string(record.model),
      targetName: string(record.targetName), targetId: string(record.targetId),
      repairAttempts: Math.max(0, Math.min(2, Number(record.repairAttempts) || 0)),
      appliedVersionId: string(record.appliedVersionId, 100), appliedAt: string(record.appliedAt, 40),
      sourceRecordId: string(record.sourceRecordId, 120), sourceVersionId: string(record.sourceVersionId, 100),
      versions
    };
  }
  function plan(existing, incoming, limits) {
    const entry = normalize(incoming);
    const rest = existing.filter(value => value.id !== entry.id).map(normalize).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let size = JSON.stringify(entry).length;
    if (size > limits.characters) throw error('HISTORY_TOO_LARGE', '这条记录超过历史空间上限，当前结果仍可复制或下载');
    const keep = [entry];
    for (const value of rest) {
      const length = JSON.stringify(value).length;
      if (keep.length < limits.records && size + length <= limits.characters) { keep.push(value); size += length; }
    }
    return { entry, keep, pruned: existing.filter(value => value.id !== entry.id).length - (keep.length - 1) };
  }
  function metadata(record) {
    const { versions, ...rest } = normalize(record);
    return { ...rest, versions: versions.map(({ script, ...version }) => ({ ...version, characters: script.length })) };
  }
  function createStore(options = {}) {
    const databaseProvider = options.indexedDB;
    const storage = options.localStorage;
    const backend = databaseProvider ? 'indexedDB' : 'localStorage';
    const limits = options.limits || LIMITS[backend];
    let connection = null, queue = Promise.resolve();
    function open() {
      if (connection) return connection;
      const opening = new Promise((resolve, reject) => {
        let request, expired = false;
        const timer = setTimeout(() => { expired = true; reject(error('HISTORY_BUSY', '历史存储暂时不可用，请关闭其他旧页面后重试')); }, 4000);
        try { request = databaseProvider.open(DATABASE, 1); }
        catch (_) { clearTimeout(timer); reject(error('HISTORY_STORAGE', '浏览器不允许打开历史存储')); return; }
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore('records', { keyPath: ['owner', 'id'] });
          store.createIndex('owner', 'owner', { unique: false });
        };
        request.onerror = () => { clearTimeout(timer); reject(error('HISTORY_STORAGE', '无法打开历史存储，已有记录未被覆盖')); };
        request.onsuccess = () => {
          clearTimeout(timer);
          if (expired) { request.result.close(); return; }
          const db = request.result;
          db.onversionchange = () => { db.close(); if (connection === opening) connection = null; };
          resolve(db);
        };
      });
      connection = opening;
      opening.catch(() => { if (connection === opening) connection = null; });
      return opening;
    }
    function readFallback(owner) {
      if (!storage) throw error('HISTORY_STORAGE', '浏览器没有可用的本地历史存储');
      const raw = storage.getItem(PREFIX + encodeURIComponent(owner));
      if (!raw) return [];
      if (raw.length > 8000000) throw error('HISTORY_FORMAT', '历史记录过大，未覆盖已有数据');
      let data;
      try { data = JSON.parse(raw); } catch (_) { throw error('HISTORY_FORMAT', '历史记录无法读取，未覆盖已有数据'); }
      if (!data || data.schema !== 1 || !Array.isArray(data.records)) throw error('HISTORY_FORMAT', '历史记录格式不兼容，未覆盖已有数据');
      return data.records.map(normalize);
    }
    async function transaction(owner, mode, transform) {
      ownerKey(owner);
      if (backend === 'localStorage') {
        const records = readFallback(owner);
        const result = transform(records);
        if (mode === 'readwrite') {
          try { storage.setItem(PREFIX + encodeURIComponent(owner), JSON.stringify({ schema: 1, records: result.keep })); }
          catch (_) { throw error('HISTORY_QUOTA', '历史保存失败，可能空间不足；已有记录未被覆盖'); }
        }
        return result;
      }
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('records', mode);
        const store = tx.objectStore('records');
        let result, failure;
        const timer = setTimeout(() => { failure = error('HISTORY_BUSY', '历史存储响应超时，当前草稿未改变'); try { tx.abort(); } catch (_) {} }, 4000);
        tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
        tx.onerror = tx.onabort = () => { clearTimeout(timer); reject(failure || error('HISTORY_STORAGE', '历史保存或读取失败，已有记录未被覆盖')); };
        const request = store.index('owner').getAll(owner);
        request.onsuccess = () => {
          try {
            const records = request.result.map(normalize);
            result = transform(records);
            if (mode === 'readwrite') {
              const retained = new Set(result.keep.map(value => value.id));
              for (const record of records) if (!retained.has(record.id)) store.delete([owner, record.id]);
              store.put({ ...result.entry, owner });
            }
          } catch (err) { failure = err; tx.abort(); }
        };
      });
    }
    const enqueue = action => {
      const operation = queue.then(action);
      queue = operation.catch(() => {});
      return operation;
    };
    return {
      backend, limits,
      list: owner => enqueue(async () => {
        const records = await transaction(owner, 'readonly', records => records);
        return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(metadata);
      }),
      get: (owner, recordId) => enqueue(() => transaction(owner, 'readonly', records => records.find(value => value.id === recordId) || null)),
      export: owner => enqueue(() => transaction(owner, 'readonly', records => records)),
      put: (owner, record) => enqueue(async () => {
        const result = await transaction(owner, 'readwrite', records => plan(records, record, limits));
        return { entry: result.entry, pruned: result.pruned };
      }),
      markApplied: (owner, recordId, versionId) => enqueue(() => transaction(owner, 'readwrite', records => {
        const record = records.find(value => value.id === recordId);
        if (!record || !record.versions.some(value => value.id === versionId)) throw error('HISTORY_MISSING', '原历史版本已不存在');
        return plan(records, { ...record, appliedVersionId: versionId, appliedAt: new Date().toISOString() }, limits);
      }))
    };
  }
  return { createStore, normalize, plan, id, PREFIX, LIMITS };
});
