/* Local-only guided preview. The production server and saved model settings are unchanged. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.CHEMIATION_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chemiation-guided-preview-'));
const server = require('../server/server');
const originalHandler = server.listeners('request')[0];
const { ReactionScriptEngine: Engine } = require('../index');
const Safety = require('../js/aiTaskSafety');
const Editing = require('../js/aiEditingTools');
const root = path.resolve(__dirname, '..');
const atoms = [
  { id: 'C1', element: 'C', x: -1, y: 0, z: 0 },
  { id: 'H1', element: 'H', x: -1.5, y: 1, z: .3 },
  { id: 'H2', element: 'H', x: -1.5, y: -.5, z: .9 },
  { id: 'H3', element: 'H', x: -1.5, y: -.5, z: -.9 },
  { id: 'Br1', element: 'Br', x: .8, y: 0, z: 0 },
  { id: 'O1', element: 'O', charge: -1, x: -4, y: 0, z: 0 },
  { id: 'H4', element: 'H', x: -4.7, y: .7, z: 0 }
];
const bonds = ['H1', 'H2', 'H3', 'Br1'].map(id => ({ atom1Id: 'C1', atom2Id: id, order: 1 })).concat({ atom1Id: 'O1', atom2Id: 'H4', order: 1 });
function sample(detailed) {
  const middle = structuredClone(atoms), product = structuredClone(atoms);
  middle.find(a => a.id === 'O1').x = -2.9; middle.find(a => a.id === 'H4').x = -3.6;
  for (const a of product) {
    if (/^H[123]$/.test(a.id)) a.x = -.5;
    if (a.id === 'Br1') { a.x = 2.7; a.charge = -1; }
    if (a.id === 'O1') { a.x = -2.3; a.charge = 0; }
    if (a.id === 'H4') a.x = -3;
  }
  return Engine.serialize({ name: 'SN2 · 溴甲烷与氢氧根（教学示意）', equation: 'CH_3Br + OH^- -> CH_3OH + Br^-',
    summary: '本地固定示例：SN2 反应的三状态教学动画；接近构型用于演示，不代表稳定中间体或能量计算结果。',
    steps: [
      { name: '反应物初态', hydrogensMode: 'none', note: '氢氧根是亲核试剂，溴甲烷是底物。全体系总电荷为 −1。' + (detailed ? ' 亲核氧从 C—Br 键相反方向靠近亲电碳。' : ''), atoms, bonds },
      { name: '背面接近（示意）', hydrogensMode: 'none', note: '此处展示亲核试剂的背面接近，不将它标为稳定中间体；真实 SN2 成键与断键协同发生。' + (detailed ? ' 该离散动画未计算过渡态，也没有画出五根完整共价键相连的碳。' : ''), atoms: middle, bonds },
      { name: '产物与离去基团', hydrogensMode: 'none', note: 'C—O 键形成，C—Br 键断裂，得到甲醇与溴离子。保留原子编号、所有氢和总电荷。', atoms: product, bonds: bonds.filter(b => b.atom2Id !== 'Br1').concat({ atom1Id: 'C1', atom2Id: 'O1', order: 1 }) }
    ] });
}
const validated = Safety.validateScript(sample(true), Engine);
if (!validated.valid) throw new Error(validated.diagnostics.join('; '));
function output(messages) {
  const system = messages.find(m => m.role === 'system')?.content || '';
  const match = /本轮任务记录[^\n]*：(\{[^\n]+\})/.exec(system);
  let task = {}; try { task = JSON.parse(match?.[1] || '{}'); } catch (_) { /* Older clients still get the example. */ }
  if (task.kind === 'explain') return JSON.stringify({ type: 'explanation', text: '本地示例说明：氢氧根从 C—Br 键背面进攻，成键与断键协同发生；左侧第二个状态仅为接近构型示意，不是真实稳定中间体。本模式用于体验交互，不调用模型。' });
  if (task.kind === 'new' && !(task.evidence || []).some(e => e.field === 'presentation')) return JSON.stringify({ type: 'question', field: 'presentation', question: '这次 SN2 动画希望采用哪种讲解方式？', options: [
    { label: '基础教学版', value: '基础教学版，保留离去的溴离子', description: '三状态动画，文字简洁' },
    { label: '详细讲解版', value: '详细讲解版，说明协同成键断键和电荷变化', description: '相同反应结构，补充机理说明' }
  ] });
  const last = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  let source = /当前脚本：\s*```[^\n]*\n([\s\S]*?)```/.exec(last)?.[1];
  if (task.kind !== 'new' && source) {
    source = source.replace(/note\s+"([^"\n]*)"/g, (_, note) => 'note "' + note + '（本地示例补充：核对成键、断键与电荷变化。）"');
    const indices = [...last.matchAll(/第 (\d+) 步（/g)].map(m => Number(m[1]) - 1);
    if (indices.length) { const doc = Editing.documentOf(source); return indices.map(i => doc.steps[i]?.text || '').join('\n'); }
    return source;
  }
  return sample((task.evidence || []).some(e => e.answer.includes('详细')));
}
server.removeAllListeners('request');
server.on('request', (req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/experience') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('</body>', '<script src="/scripts/preview_ai_studio.client.js"></script></body>')); return;
  }
  if (pathname !== '/__preview__/v1/chat/completions') { originalHandler(req, res); return; }
  if (req.method !== 'POST' || req.headers.origin !== 'http://' + req.headers.host) { res.writeHead(403); res.end(); return; }
  let body = '', tooLarge = false;
  req.on('data', c => { body += c; if (body.length > 220000) { tooLarge = true; req.destroy(); } });
  req.on('end', () => {
    if (tooLarge) return;
    let data; try { data = JSON.parse(body); if (!Array.isArray(data.messages)) throw new Error(); } catch (_) { res.writeHead(400); res.end(); return; }
    const text = output(data.messages);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    const chunks = text.match(/[\s\S]{1,85}/g) || ['']; let i = 0;
    const timer = setInterval(() => {
      if (i < chunks.length) res.write('data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: chunks[i++] }, finish_reason: null }] }) + '\n\n');
      else { clearInterval(timer); res.end('data: ' + JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n'); }
    }, 130);
    res.on('close', () => clearInterval(timer));
  });
});
server.listen(Number(process.env.CHEMIATION_PREVIEW_PORT || 31821), '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + server.address().port + '/experience'));
