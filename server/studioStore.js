/* Account-owned, bounded conversation documents. Redis is authoritative when configured.
   Compare-and-swap rejects stale writes; cloud failures are never reported as saved. */
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../js/aiStudioCore');
const adapter = require('./upstashAdapter');
const ROOT = path.join(process.env.CHEMIATION_DATA_DIR || path.join(__dirname, 'data'), 'studio');
function cloud() { return process.env.NODE_ENV !== 'test' && adapter.isConfigured(); }
function directory(userId) { Core.key(userId); return path.join(ROOT, userId); }
function file(userId, id) { return path.join(directory(userId), Core.key(id) + '.json'); }
function read(filename) { try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function keys(userId) { Core.key(userId); const base = adapter.prefix + 'studio:{' + userId + '}'; return [base + ':sessions', base + ':index', base + ':metadata']; }
function newest(a, b) { return b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id); }
function localMetadata(userId) {
  const dir = directory(userId);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^[a-zA-Z0-9_-]+\.json$/.test(n)) : [];
  return files.map(n => Core.metadata(Core.normalize(read(path.join(dir, n))))).sort(newest);
}
async function get(userId, id) {
  Core.key(id);
  const value = cloud() ? await adapter.execute(['HGET', keys(userId)[0], id]) : read(file(userId, id));
  return value ? Core.normalize(typeof value === 'string' ? JSON.parse(value) : value) : null;
}
async function list(userId, offset = 0, limit = 20, projectId) {
  offset = Math.min(10000, Math.max(0, Math.floor(Number(offset) || 0))); limit = Math.min(30, Math.max(1, Math.floor(Number(limit) || 20)));
  let items;
  if (projectId !== undefined) {
    const project = Core.projectId(projectId);
    // At most 100 metadata records per account; never load message/script bodies to filter.
    const metadata = cloud() ? (await adapter.execute(['HVALS', keys(userId)[2]]) || []).map(v => JSON.parse(v)) : localMetadata(userId);
    items = metadata.filter(v => (v.projectId || '') === project).sort(newest).slice(offset, offset + limit + 1);
  } else if (cloud()) {
    const [, index, metadata] = keys(userId);
    const ids = await adapter.execute(['ZREVRANGE', index, offset, offset + limit]);
    if (!ids?.length) return { items: [], nextOffset: null };
    const values = await adapter.execute(['HMGET', metadata, ...ids]);
    items = values.filter(Boolean).map(v => JSON.parse(v));
  } else {
    items = localMetadata(userId).slice(offset, offset + limit + 1);
  }
  return { items: items.slice(0, limit), nextOffset: items.length > limit ? offset + limit : null };
}
const SAVE = `local old=redis.call('HGET',KEYS[1],ARGV[1])
local revision=0
if old then revision=cjson.decode(old).revision end
if revision~=tonumber(ARGV[2]) then return -1 end
if old and (cjson.decode(old).projectId or '')~=ARGV[6] then return -3 end
if not old and redis.call('HLEN',KEYS[1])>=100 then return -2 end
redis.call('HSET',KEYS[1],ARGV[1],ARGV[3])
redis.call('ZADD',KEYS[2],ARGV[4],ARGV[1])
redis.call('HSET',KEYS[3],ARGV[1],ARGV[5])
return ARGV[3]`;
async function save(userId, id, input, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw Core.fail('缺少有效版本号，未覆盖已有会话');
  const value = Core.normalize({ ...input, id: Core.key(id) });
  const now = new Date().toISOString(); value.updatedAt = now; value.createdAt ||= now;
  if (cloud()) {
    const old = await get(userId, id);
    value.createdAt = old?.createdAt || now;
    value.revision = expectedRevision + 1;
    // Store the JS JSON verbatim: Redis Lua cjson would turn empty [] into {}.
    const result = await adapter.execute(['EVAL', SAVE, 3, ...keys(userId), id, expectedRevision, JSON.stringify(value), Date.now(), JSON.stringify(Core.metadata(value)), value.projectId]);
    if (result === -1) throw Core.fail('此会话已在其他窗口更新。请导出本地副本，再打开云端会话', 409);
    if (result === -2) throw Core.fail('云端会话数量已达上限，请导出并清理旧会话', 413);
    if (result === -3) throw Core.fail('已有对话不能更换机理项目，请复制为新对话', 409);
    return Core.normalize(JSON.parse(result));
  }
  // There is no await between the read/check and atomic rename in the single server process.
  const filename = file(userId, id), old = read(filename);
  if ((old?.revision || 0) !== expectedRevision) throw Core.fail('此会话已在其他窗口更新。请导出本地副本，再打开云端会话', 409);
  if (old && (old.projectId || '') !== value.projectId) throw Core.fail('已有对话不能更换机理项目，请复制为新对话', 409);
  fs.mkdirSync(directory(userId), { recursive: true });
  if (!old && fs.readdirSync(directory(userId)).filter(n => n.endsWith('.json')).length >= 100) throw Core.fail('会话数量已达上限，请导出并清理旧会话', 413);
  value.revision = expectedRevision + 1; value.createdAt = old?.createdAt || now;
  const temp = filename + '.' + Core.id() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value), 'utf8'); fs.renameSync(temp, filename);
  return value;
}
async function remove(userId, id) {
  Core.key(id);
  if (cloud()) await adapter.execute(['EVAL', "redis.call('HDEL',KEYS[1],ARGV[1]);redis.call('ZREM',KEYS[2],ARGV[1]);redis.call('HDEL',KEYS[3],ARGV[1]);return 1", 3, ...keys(userId), id]);
  else { try { fs.unlinkSync(file(userId, id)); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
async function findMechanisms(userId, query) {
  const metadata = cloud() ? (await adapter.execute(['HVALS', keys(userId)[2]]) || []).map(v => JSON.parse(v)) : localMetadata(userId);
  const candidates = Core.match(query, metadata.flatMap(v => v.mechanisms || []), { metadataOnly: true });
  const items = await Promise.all(candidates.map(async candidate => {
    const session = await get(userId, candidate.sessionId);
    const version = session?.versions.find(v => v.id === candidate.versionId && ['accepted', 'restored'].includes(v.status));
    return version ? { id: candidate.versionId, title: Core.reactionTitle(version.script), script: version.script,
      source: '历史对话的已保留版本', reviewStatus: 'unreviewed', sessionId: candidate.sessionId } : null;
  }));
  return items.filter(Boolean);
}
module.exports = { get, list, save, remove, findMechanisms };
