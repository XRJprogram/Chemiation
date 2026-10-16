const test = require('node:test');
const assert = require('node:assert/strict');
const editing = require('../js/aiEditingTools.js');
const block = (name, note = 'unchanged') => `step "${name}" {\n  note "${note}"\n  hydrogens none\n  atom H1 H 0 0 0\n}`;
const source = `# saved header\nreaction "Original"\nsummary "Keep global text"\n\n${block('one')}\n# keep between steps\n${block('two')}\n${block('three')}\n# saved footer\n`;

test('scoped CCPL changes only the chosen block, preserving comments and whitespace', () => {
  const scope = editing.createScope(source, [1]);
  const result = editing.mergeSelected(scope, block('two', 'new explanation'));
  assert.equal(result, source.replace(block('two'), block('two', 'new explanation')));
  assert.equal(editing.assertScope(scope, result), true);
});

test('multiple non-adjacent blocks are merged in source order', () => {
  const scope = editing.createScope(source, [2, 0]);
  const result = editing.mergeSelected(scope, block('one', 'new 1') + '\n' + block('three', 'new 3'));
  assert.equal(result, source.replace(block('one'), block('one', 'new 1')).replace(block('three'), block('three', 'new 3')));
});

test('quoted braces, escaped quotes, comments, and a separate opening brace do not change step ranges', () => {
  const script = `reaction "Braces"\nstep "a { # \\" // }"\n{ # comment\nnote "literal } and {"\nhydrogens none\natom H1 H 0 0 0\n}\n`;
  const doc = editing.documentOf(script);
  assert.equal(doc.steps.length, 1);
  assert.equal(editing.mergeSelected(editing.createScope(script, [0]), block('safe')), script.slice(0, doc.steps[0].start) + block('safe') + '\n');
});

test('CRLF source keeps all untouched bytes and uses CRLF in a replacement', () => {
  const crlf = source.replace(/\n/g, '\r\n');
  const result = editing.mergeSelected(editing.createScope(crlf, [1]), block('two', 'updated'));
  assert.equal(result, crlf.replace(block('two').replace(/\n/g, '\r\n'), block('two', 'updated').replace(/\n/g, '\r\n')));
});

test('full scripts and extra blocks are rejected by a local edit', () => {
  const scope = editing.createScope(source, [1]);
  assert.throws(() => editing.mergeSelected(scope, 'reaction "Changed"\n' + block('two')), /全局/);
  assert.throws(() => editing.mergeSelected(scope, block('two') + '\n' + block('extra')), /仅输出/);
});

test('the write boundary detects edits to protected steps and global information', () => {
  const scope = editing.createScope(source, [1]);
  assert.throws(() => editing.assertScope(scope, source.replace('Keep global text', 'changed')), /未选中/);
  assert.throws(() => editing.assertScope(scope, source.replace(block('one'), block('one', 'changed'))), /未选中/);
  assert.throws(() => editing.assertScope(scope, source + '\n' + block('extra')), /增删/);
});

test('empty and out-of-range selections fail before model requests', () => {
  assert.throws(() => editing.createScope(source, []), /选择/);
  assert.throws(() => editing.createScope(source, [99]), /选择/);
  assert.throws(() => editing.createScope(source, [1.5]), /选择/);
});

test('incomplete step boundaries cannot be used as a local edit target', () => {
  assert.throws(() => editing.documentOf('reaction "x"\nstep "open" {\natom H H'), /未闭合/);
});

test('JSON edits preserve the exact bytes of other steps and root metadata', () => {
  const base = ' { "summary": "literal steps [ { \\\" }", "steps" : [ { "name":"one", "note":"keep" },\n { "name":"two", "note":"old" } ], "extra": { "steps": [] } } ';
  const patch = '{"steps":[{"name":"two","note":"new"}]}';
  const scope = editing.createScope(base, [1]);
  const result = editing.mergeSelected(scope, patch);
  assert.equal(result, base.replace('{ "name":"two", "note":"old" }', '{"name":"two","note":"new"}'));
  assert.equal(editing.assertScope(scope, result), true);
});

test('JSON patches reject root field changes and ambiguous duplicate steps fields', () => {
  const base = '{"name":"json","steps":[{"name":"one"}]}';
  assert.throws(() => editing.mergeSelected(editing.createScope(base, [0]), '{"name":"changed","steps":[{}]}'), /其他字段/);
  assert.throws(() => editing.documentOf('{"steps":[{}],"steps":[{}]}'), /重复/);
});

test('comparison reports changes and provides literal text without interpreting markup', () => {
  const after = source.replace('Keep global text', '<svg onload=alert(1)>').replace(block('two'), block('two', 'updated'));
  const diff = editing.compare(source, after);
  assert.equal(diff.added, 2);
  assert.equal(diff.removed, 2);
  assert.deepEqual(diff.changedSteps.map(step => step.index), [1]);
  assert.equal(diff.globalChanged, true);
  assert.ok(diff.rows.some(row => row.type === 'add' && row.text.includes('<svg')));
});

test('unchanged and newline-only comparisons have distinct summaries', () => {
  assert.equal(editing.compare(source, source).identical, true);
  assert.equal(editing.compare(source, source.replace(/\n/g, '\r\n')).lineEndingsOnly, true);
  assert.equal(editing.compare('', 'new').added, 1);
});

test('long comparisons use bounded work and limit rendered rows', () => {
  const diff = editing.compare('old\n'.repeat(1500), 'new\n'.repeat(1500));
  assert.equal(diff.approximate, true);
  assert.equal(diff.truncated, true);
  assert.ok(diff.rows.length <= 601);
});

test('oversized model text avoids expensive comparison work', () => {
  const diff = editing.compare(source, 'x'.repeat(200001));
  assert.equal(diff.unavailable, true);
  assert.equal(diff.rows.length, 0);
});
