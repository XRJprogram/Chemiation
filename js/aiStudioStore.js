/* Independent IndexedDB store: old AI history is left intact. Local writes precede sync. */
(function (root) {
  'use strict';
  const Core = root.ChemiationStudioCore;
  function create() {
    let connection;
    function open() {
      if (connection) return connection;
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open('chemiation-conversations-v1', 1);
        request.onupgradeneeded = () => { const s = request.result.createObjectStore('sessions', { keyPath: ['owner', 'id'] }); s.createIndex('owner', 'owner'); };
        request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); connection = null; }; resolve(db); };
        request.onerror = () => { connection = null; reject(new Error('无法打开聊天存储，请允许浏览器保存本地数据')); };
        request.onblocked = () => { connection = null; reject(new Error('聊天存储被旧窗口占用，请关闭旧窗口后重试')); };
      });
      return connection;
    }
    async function transaction(mode, action) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', mode); let result;
        tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error || new Error('聊天保存失败，当前内容仍可导出'));
        tx.onabort = () => reject(tx.error || new Error('聊天保存被中止'));
        action(tx.objectStore('sessions'), value => { result = value; });
      });
    }
    return {
      put: (owner, session) => transaction('readwrite', (s, done) => {
        const entry = Core.normalize(session);
        s.get([owner, entry.id]).onsuccess = e => {
          const old = e.target.result;
          if ((old?.localRevision || 0) !== entry.localRevision) { done({ conflict: true }); return; }
          if (old && (old.projectId || '') !== entry.projectId) { done({ conflict: true }); return; }
          entry.revision = Math.max(entry.revision, old?.revision || 0);
          entry.localRevision++; s.put({ owner, ...entry }); done(entry);
        };
      }),
      markSynced: (owner, id, revision) => transaction('readwrite', s => {
        s.get([owner, id]).onsuccess = e => { const old = e.target.result; if (old && old.revision <= revision) { old.revision = revision; s.put(old); } };
      }),
      get: (owner, id) => transaction('readonly', (s, done) => { s.get([owner, id]).onsuccess = e => done(e.target.result ? Core.normalize(e.target.result) : null); }),
      list: (owner, projectId) => transaction('readonly', (s, done) => {
        const items = [];
        s.index('owner').openCursor(owner).onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) { if (projectId === undefined || (cursor.value.projectId || '') === projectId) items.push(Core.metadata(cursor.value)); cursor.continue(); }
          else done(items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        };
      }),
      remove: (owner, id) => transaction('readwrite', s => s.delete([owner, id]))
    };
  }
  root.ChemiationStudioStore = { create };
})(globalThis);
