const test = require('node:test');
const assert = require('node:assert/strict');
const { createDecoder, readCompletion } = require('../js/aiStream.js');
const safety = require('../js/aiTaskSafety.js');
const encoder = new TextEncoder();
const frame = data => `data: ${JSON.stringify(data)}\n\n`;
const chunk = (content, reason = null, extra = {}) => frame({ choices: [{ index: 0, delta: { content, ...extra }, finish_reason: reason }] });
function streamResponse(parts, close = true) {
  return { ok: true, headers: new Headers({ 'content-type': 'text/event-stream; charset=utf-8' }), body: new ReadableStream({ start(controller) {
    for (const part of parts) controller.enqueue(typeof part === 'string' ? encoder.encode(part) : part);
    if (close) controller.close();
  } }) };
}
async function usingFetch(fetch, action) {
  const original = global.fetch;
  global.fetch = fetch;
  try { return await action(); } finally { global.fetch = original; }
}

test('SSE framing supports split CRLF, bare CR, comments, BOM, and multi-line data', () => {
  const events = [];
  const decoder = createDecoder(event => events.push(event));
  for (const part of ['\uFEFF:heartbeat\r', '\nevent: message\rdata: {"value":\r\n', 'data: "中文"}\r', '\n\r', '\n']) decoder.feed(part);
  assert.deepEqual(events, [{ event: 'message', data: '{"value":\n"中文"}' }]);
  assert.equal(decoder.end().pending, false);
});

test('unfinished SSE events are never dispatched at EOF', () => {
  const events = [];
  const decoder = createDecoder(event => events.push(event));
  decoder.feed('data: {"value":1}\n');
  assert.equal(events.length, 0);
  assert.equal(decoder.end().pending, true);
});

test('UTF-8 characters survive a network split at every byte', async () => {
  const text = 'reaction "中文𠮷"';
  const bytes = encoder.encode(chunk(text) + chunk('', 'stop') + 'data: [DONE]\n\n');
  const deltas = [];
  const result = await readCompletion(streamResponse([...bytes].map(byte => new Uint8Array([byte]))), { onDelta: value => deltas.push(value.delta) });
  assert.equal(result.content, text);
  assert.equal(deltas.join(''), text);
  assert.equal(result.finishReason, 'stop');
});

test('content is assembled without role, reasoning or usage-only packets entering the script', async () => {
  const result = await readCompletion(streamResponse([
    chunk('', null, { role: 'assistant', reasoning_content: 'private reasoning' }),
    ': heartbeat\n\n' + chunk('first') + chunk(' second', 'stop'),
    frame({ choices: [], usage: { total_tokens: 42 } }) + 'data: [DONE]\n\n'
  ]));
  assert.equal(result.content, 'first second');
  assert.deepEqual(result.usage, { total_tokens: 42 });
  assert.equal(result.transport, 'stream');
});

test('a normal finish event plus clean EOF works without a DONE sentinel', async () => {
  assert.equal((await readCompletion(streamResponse([chunk('text', 'stop')]))).finishReason, 'stop');
});

test('DONE alone never turns missing finish metadata into a valid completion', async () => {
  const result = await readCompletion(streamResponse([chunk('partial'), 'data: [DONE]\n\n']));
  assert.equal(result.finishReason, null);
  assert.ok(safety.completionIssue(result.finishReason));
});

test('EOF without finish metadata remains an incomplete result', async () => {
  const result = await readCompletion(streamResponse([chunk('partial')]));
  assert.equal(result.finishReason, null);
});

test('a torn final packet is rejected even if an earlier packet had a stop marker', async () => {
  await assert.rejects(readCompletion(streamResponse([chunk('text', 'stop'), 'data: {"error":'])), { code: 'INCOMPLETE_STREAM' });
});

test('malformed stream messages fail without echoing their raw body', async () => {
  await assert.rejects(readCompletion(streamResponse(['data: private-provider-body\n\n'])), error => error.code === 'INVALID_STREAM' && !error.message.includes('private-provider-body'));
});

for (const body of [frame({ error: { message: 'private-provider-body' } }), 'event: error\ndata: private-provider-body\n\n']) {
  test('provider error frames terminate reception without exposing private provider text: ' + body.slice(0, 12), async () => {
    await assert.rejects(readCompletion(streamResponse([body])), error => error.code === 'STREAM_PROVIDER_ERROR' && !error.message.includes('private-provider-body'));
  });
}

test('invalid content types and inconsistent finish markers cannot be used', async () => {
  await assert.rejects(readCompletion(streamResponse([chunk({ value: 'invalid' })])), { code: 'INVALID_STREAM' });
  await assert.rejects(readCompletion(streamResponse([chunk('text', 'stop') + chunk('late')])), { code: 'INVALID_STREAM' });
  await assert.rejects(readCompletion(streamResponse([chunk('text', 'stop') + chunk('', 'length')])), { code: 'INVALID_STREAM' });
});

test('other choice indices never leak into the selected completion', async () => {
  const other = frame({ choices: [{ index: 1, delta: { content: 'wrong choice' } }] });
  const result = await readCompletion(streamResponse([other + chunk('right', 'stop')]));
  assert.equal(result.content, 'right');
});

for (const reason of ['length', 'content_filter', 'tool_calls']) {
  test(`stream finish reason ${reason} is preserved and blocked by completion checks`, async () => {
    const result = await readCompletion(streamResponse([chunk('text', reason), 'data: [DONE]\n\n']));
    assert.equal(result.finishReason, reason);
    assert.ok(safety.completionIssue(result.finishReason));
  });
}

test('a large delta is capped before previewing more than the allowed script size', async () => {
  let received = 0;
  await assert.rejects(readCompletion(streamResponse([chunk('x'.repeat(200001))]), { onDelta: value => { received += value.delta.length; } }), { code: 'OUTPUT_LIMIT' });
  assert.equal(received, 200000);
});

test('oversized unterminated framing is bounded', () => {
  assert.throws(() => createDecoder(() => {}).feed('data: ' + 'x'.repeat(1000001)), { code: 'STREAM_LIMIT' });
});

test('invalid UTF-8 including an unfinished final character is rejected', async () => {
  await assert.rejects(readCompletion(streamResponse([new Uint8Array([0xff])])), { code: 'INVALID_STREAM' });
  await assert.rejects(readCompletion(streamResponse([encoder.encode(chunk('text')), new Uint8Array([0xe4, 0xb8])])), { code: 'INVALID_STREAM' });
});

test('a stream without a readable body fails explicitly', async () => {
  await assert.rejects(readCompletion({}), { code: 'STREAM_UNAVAILABLE' });
});

test('one JSON response transparently completes a requested stream with no duplicate call', async () => {
  let calls = 0, payload, transport;
  const result = await usingFetch(async (_url, options) => {
    calls++; payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'JSON text' }, finish_reason: 'stop' }] }) };
  }, () => safety.requestCompletion({ baseUrl: 'https://offline.invalid', model: 'test' }, [], { onResponse: value => { transport = value.transport; } }));
  assert.equal(calls, 1);
  assert.equal(payload.stream, true);
  assert.equal(result.content, 'JSON text');
  assert.equal(transport, 'json');
});

test('disabling streaming does not send the stream parameter to older endpoints', async () => {
  let payload;
  await usingFetch(async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'text' }, finish_reason: 'stop' }] }) };
  }, () => safety.requestCompletion({ baseUrl: 'https://offline.invalid', stream: false }, []));
  assert.equal(Object.hasOwn(payload, 'stream'), false);
});

test('the request deadline covers an open stream and retains previously delivered deltas', async () => {
  const deltas = [];
  await usingFetch(async () => streamResponse([chunk('partial')], false), async () => {
    await assert.rejects(safety.requestCompletion({ baseUrl: 'https://offline.invalid', timeoutMs: 20 }, [], { onDelta: value => deltas.push(value.delta) }), { code: 'TIMEOUT' });
  });
  assert.deepEqual(deltas, ['partial']);
});

test('manual abort resolves even when the transport ignores both cancellation and pending reads', async () => {
  const controller = new AbortController();
  let reads = 0, cancels = 0;
  const response = { ok: true, headers: new Headers({ 'content-type': 'text/event-stream' }), body: { getReader() { return {
    read() { return ++reads === 1 ? Promise.resolve({ value: encoder.encode(chunk('partial')), done: false }) : new Promise(() => {}); },
    cancel() { cancels++; return new Promise(() => {}); }, releaseLock() {}
  }; } } };
  await usingFetch(async () => response, async () => {
    await assert.rejects(safety.requestCompletion({ baseUrl: 'https://offline.invalid', timeoutMs: 500 }, [], { signal: controller.signal, onDelta() { controller.abort(); } }), { code: 'CANCELLED' });
  });
  assert.equal(cancels, 1);
});

test('DONE terminates a still-open reader rather than hanging after normal completion', async () => {
  const result = await usingFetch(async () => streamResponse([chunk('text', 'stop') + 'data: [DONE]\n\n'], false), () => safety.requestCompletion({ baseUrl: 'https://offline.invalid', timeoutMs: 200 }, []));
  assert.equal(result.content, 'text');
});
