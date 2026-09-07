/**
 * Chemiation - Project Directory & Local Storage Manager
 * 
 * 基于现代 Web 原生 File System Access API (showDirectoryPicker) 与 IndexedDB
 * 实现无后端、零依赖的本地项目文件夹读写与 4 大经典样例自动初始化
 */

class StorageManager {
  constructor() {
    this.dirHandle = null;
    this.projectName = '';
    this.activeFileName = '';
    this.files = []; // [{ name, handle, type: 'acpl' | 'json' }]
    this.isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    this.dbName = 'Chemiation_Storage_DB';
    this.storeName = 'handles';
    this.db = null;
  }

  /**
   * 初始化 IndexedDB 数据库连接
   */
  async initDB() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => {
        console.warn('[Chemiation Storage] IndexedDB 初始化失败', e);
        resolve(null);
      };
    });
  }

  /**
   * 将 DirectoryHandle 存入 IndexedDB
   */
  async saveHandleToIDB(handle) {
    try {
      const db = await this.initDB();
      if (!db) return;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(handle, 'active_project_dir');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[Chemiation Storage] 保存目录句柄到 IDB 失败:', err);
    }
  }

  /**
   * 从 IndexedDB 提取保存的 DirectoryHandle
   */
  async getHandleFromIDB() {
    try {
      const db = await this.initDB();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get('active_project_dir');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('[Chemiation Storage] 从 IDB 读取目录句柄失败:', err);
      return null;
    }
  }

  /**
   * 清除已记住的目录句柄
   */
  async clearSavedHandle() {
    try {
      const db = await this.initDB();
      if (!db) return;
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete('active_project_dir');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (e) {
      // ignore
    }
  }

  /**
   * 检查是否能够恢复历史记住的目录权限
   */
  async checkSavedDirectory() {
    if (!this.isSupported) return null;
    const savedHandle = await this.getHandleFromIDB();
    if (!savedHandle) return null;

    try {
      const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
      return {
        handle: savedHandle,
        name: savedHandle.name,
        permission: perm // 'granted' | 'prompt' | 'denied'
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * 唤醒并恢复之前记住的项目目录
   */
  async resumeSavedDirectory(savedHandle) {
    if (!savedHandle) return false;
    try {
      let perm = await savedHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await savedHandle.requestPermission({ mode: 'readwrite' });
      }
      if (perm === 'granted') {
        this.dirHandle = savedHandle;
        this.projectName = savedHandle.name;
        await this.scanAndInitIfNeeded();
        return true;
      }
    } catch (err) {
      console.warn('[Chemiation Storage] 恢复目录授权失败:', err);
    }
    return false;
  }

  /**
   * 弹出系统原生选择器打开或新建项目文件夹
   */
  async openDirectoryPicker() {
    if (!this.isSupported) {
      throw new Error('当前浏览器不支持 Web File System Access API，请使用 Chrome、Edge 等现代浏览器。');
    }

    const dirHandle = await window.showDirectoryPicker({
      id: 'chemiation_workspace',
      mode: 'readwrite',
      startIn: 'documents'
    });

    if (!dirHandle) return false;

    this.dirHandle = dirHandle;
    this.projectName = dirHandle.name;
    await this.saveHandleToIDB(dirHandle);

    await this.scanAndInitIfNeeded();
    return true;
  }

  /**
   * 扫描目录；若为空或无 .ccpl/.acpl 文件，则自动将 4 个初始样例写入本地磁盘
   */
  async scanAndInitIfNeeded() {
    if (!this.dirHandle) return;

    let scannedFiles = await this.scanFiles();

    // 检查是否存在 .ccpl 或 .acpl 文件
    const ccplFiles = scannedFiles.filter(f => f.type === 'ccpl');

    if (ccplFiles.length === 0) {
      // 目录为空或没有机理文件，自动释放 4 大经典样例
      await this.initDefaultSamples();
      scannedFiles = await this.scanFiles();
    }

    this.files = scannedFiles;
  }

  /**
   * 扫描项目目录中的所有 .ccpl, .acpl 与 .json 文件
   */
  async scanFiles() {
    if (!this.dirHandle) return [];
    const list = [];
    try {
      for await (const [name, handle] of this.dirHandle.entries()) {
        if (handle.kind === 'file') {
          const lower = name.toLowerCase();
          if (lower.endsWith('.ccpl') || lower.endsWith('.acpl')) {
            list.push({ name, handle, type: 'ccpl' });
          } else if (name === 'chemiation.json') {
            list.push({ name, handle, type: 'json' });
          }
        }
      }
    } catch (err) {
      console.warn('[Chemiation Storage] 扫描文件列表异常:', err);
    }

    // 按名称自然升序排序
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
    this.files = list;
    return list;
  }

  /**
   * 初始化 4 个经典样例并写入用户指定的项目文件夹
   */
  async initDefaultSamples() {
    if (!this.dirHandle || typeof ReactionScriptEngine === 'undefined') return;

    // 4 大经典核心样例
    const samplePresets = [
      {
        filename: '01_乙酸乙醇费歇尔酯化.ccpl',
        id: 'esterification'
      },
      {
        filename: '02_二氧化碳人工合成淀粉.ccpl',
        id: 'co2-to-starch'
      },
      {
        filename: '03_甲烷自由基光解氯代.ccpl',
        id: 'methane-chlorination'
      },
      {
        filename: '04_哈伯博施法合成氨.ccpl',
        id: 'haber-bosch'
      }
    ];

    for (const sample of samplePresets) {
      const presetData = (typeof REACTION_PRESETS !== 'undefined')
        ? REACTION_PRESETS.find(p => p.id === sample.id)
        : null;

      if (presetData) {
        const ccplContent = ReactionScriptEngine.serialize(presetData);
        await this.writeFile(sample.filename, ccplContent);
      }
    }

    // 写入项目元数据配置文件 chemiation.json
    const projectConfig = {
      name: this.projectName,
      version: '1.0',
      createdTime: new Date().toISOString(),
      generator: 'Chemiation ReactionPrinciple Studio',
      lastOpenedFile: '01_乙酸乙醇费歇尔酯化.ccpl',
      description: 'Chemiation 化学反应原理机理推演项目工作区'
    };

    await this.writeFile('chemiation.json', JSON.stringify(projectConfig, null, 2));
  }

  /**
   * 读取指定文件文本内容
   */
  async readFile(filename) {
    if (!this.dirHandle) throw new Error('未打开项目目录');
    const fileHandle = await this.dirHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  /**
   * 将文本内容写入指定文件（若不存在则自动创建）
   */
  async writeFile(filename, content) {
    if (!this.dirHandle) throw new Error('未打开项目目录');
    const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * 在当前项目文件夹中新建机理脚本文件
   */
  async createNewReactionFile(displayName) {
    if (!this.dirHandle) throw new Error('未打开项目目录');

    let cleanName = (displayName || '未命名反应').trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanName.endsWith('.ccpl')) {
      cleanName += '.ccpl';
    }

    // 编号自增前缀
    const ccplCount = this.files.filter(f => f.type === 'ccpl').length;
    const prefix = String(ccplCount + 1).padStart(2, '0') + '_';
    const finalFilename = /^\d{2}_/.test(cleanName) ? cleanName : `${prefix}${cleanName}`;

    // 初始 CCPL 骨架模板
    const initialContent = `# Chemiation 反应机理推演脚本 (CCPL)
reaction "${cleanName.replace(/\.ccpl$/i, '')}"
equation "A + B ⇌ C + D"
summary "在此输入关于该反应原理、过渡态与机理特征的简述。"

step "反应物底物吸附与碰撞" {
  note "反应底物靠近，化学键准备断裂或重构。"

  # 原子定义: atom <ID> <元素> [X Y Z 坐标(可选)]
  atom A1 C -1.5 0 0
  atom A2 O 1.5 0 0
  atom H1 H -1.5 1.5 0
  atom H2 H 1.5 1.5 0

  # 化学键定义: bond <原子1> <原子2> [键级1/2/3]
  bond A1 H1 1
  bond A2 H2 1
}

step "产物分子生成与脱附" {
  note "新键形成，反应完成并脱附释放。"

  atom A1 C -0.8 0 0
  atom A2 O 0.8 0 0
  atom H1 H -1.8 0.8 0
  atom H2 H 1.8 0.8 0

  bond A1 A2 2
  bond A1 H1 1
  bond A2 H2 1
}
`;

    await this.writeFile(finalFilename, initialContent);
    await this.scanFiles();
    return finalFilename;
  }

  /**
   * 关闭并脱开当前项目文件夹，恢复为内置预设状态
   */
  async closeProject() {
    this.dirHandle = null;
    this.projectName = '';
    this.activeFileName = '';
    this.files = [];
    await this.clearSavedHandle();
  }
}

// 导出全局单例
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
