const assert = require('assert');
const { Pseudo3DRenderer, ReactionScriptEngine, REACTION_PRESETS } = require('../index.js');

console.log('Running Chemiation package validation tests...');

// 1. Verify module exports
assert.ok(Pseudo3DRenderer, 'Pseudo3DRenderer should be exported');
assert.ok(ReactionScriptEngine, 'ReactionScriptEngine should be exported');
assert.ok(Array.isArray(REACTION_PRESETS), 'REACTION_PRESETS should be an array');
console.log('✔ Module exports verified');

// 2. Verify presets
assert.strictEqual(REACTION_PRESETS.length, 6, 'Should have 6 preset reactions');
REACTION_PRESETS.forEach((r, idx) => {
  assert.ok(r.id, `Reaction ${idx} must have id`);
  assert.ok(r.name, `Reaction ${idx} must have name`);
  assert.ok(Array.isArray(r.steps) && r.steps.length > 0, `Reaction ${idx} must have steps`);
});
console.log('✔ Preset reactions integrity verified (6 presets)');

// 3. Verify CCPL script serializer and parser round-trip
const preset = REACTION_PRESETS[0];
const serialized = ReactionScriptEngine.serialize(preset);
assert.ok(typeof serialized === 'string' && serialized.includes('reaction "乙酸与乙醇费歇尔酯化反应"'));
console.log('✔ CCPL script serializer verified');

const parsed = ReactionScriptEngine.parse(serialized);
assert.ok(parsed, 'Serialized CCPL should be parsed');
assert.strictEqual(parsed.name, preset.name);
assert.strictEqual(parsed.steps.length, preset.steps.length);
console.log('✔ CCPL script parser & round-trip verified');

console.log('All tests passed successfully! ✨');
