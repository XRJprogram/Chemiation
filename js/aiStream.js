/* Incremental SSE framing and chat-completion decoding. No DOM dependency. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChemiationAIStream = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function failure(code, message) { const err = new Error(message); err.code = code; return err; }
  function createDecoder(onEvent) {
    let line = '', data = [], event = '', size = 0, skipLF = false, first = true;
    const consumeLine = () => {
      if (!line) {
        if (data.length) onEvent({ event: event || 'message', data: data.join('\n') });
        data = []; event = ''; size = 0;
      } else if (line[0] !== ':') {
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? '' : line.slice(colon + 1);
        if (value[0] === ' ') value = value.slice(1);
        if (field === 'data') { data.push(value); size += value.length; }
        else if (field === 'event') event = value;
        if (size > 1000000) throw failure('STREAM_LIMIT', '接口单条流式消息过长，已停止接收');
      }
      line = '';
    };
    return {
      feed(text) {
        if (!text) return;
        if (first) { if (text[0] === '\uFEFF') text = text.slice(1); first = false; }
        let cursor = skipLF && text[0] === '\n' ? 1 : 0;
        skipLF = false;
        const breaks = /[\r\n]/g;
        breaks.lastIndex = cursor;
        let match;
        while ((match = breaks.exec(text))) {
          line += text.slice(cursor, match.index);
          if (line.length > 1000000) throw failure('STREAM_LIMIT', '接口单条流式消息过长，已停止接收');
          consumeLine();
          cursor = match.index + 1;
          if (match[0] === '\r') {
            if (text[cursor] === '\n') cursor++;
            else if (cursor === text.length) skipLF = true;
          }
          breaks.lastIndex = cursor;
        }
        line += text.slice(cursor);
        if (line.length > 1000000) throw failure('STREAM_LIMIT', '接口单条流式消息过长，已停止接收');
      },
      // An event without its final empty line is incomplete, never dispatched.
      end() { return { pending: data.length > 0 || (!!line && !line.startsWith(':')) }; }
    };
  }

  async function readCompletion(response, options = {}) {
    if (!response.body || typeof response.body.getReader !== 'function') throw failure('STREAM_UNAVAILABLE', '浏览器或接口无法读取流式响应，请关闭逐步显示后重试');
    const signal = options.signal;
    if (signal && signal.aborted) throw failure('CANCELLED', '请求已中止');
    const reader = response.body.getReader();
    const textDecoder = new TextDecoder('utf-8', { fatal: true });
    const decode = (value, settings) => {
      try { return textDecoder.decode(value, settings); }
      catch (_) { throw failure('INVALID_STREAM', '流式文本编码无效，已停止接收'); }
    };
    const pieces = [];
    let length = 0, finishReason = null, usage = null, done = false, cancelled = false;
    const cancelReader = () => {
      if (cancelled) return;
      cancelled = true;
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (_) { /* Already closed. */ }
    };
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => { reject(failure('CANCELLED', '请求已中止')); cancelReader(); };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
    const decoder = createDecoder(message => {
      if (done) return;
      if (message.event === 'error') throw failure('STREAM_PROVIDER_ERROR', '模型服务在生成过程中返回错误，已保留收到的片段');
      if (!message.data.trim()) return;
      if (message.data.trim() === '[DONE]') { done = true; return; }
      let data;
      try { data = JSON.parse(message.data); }
      catch (_) { throw failure('INVALID_STREAM', '收到无法识别的流式消息，已停止接收'); }
      if (!data || typeof data !== 'object' || data.error) throw failure('STREAM_PROVIDER_ERROR', '模型服务在生成过程中返回错误，已保留收到的片段');
      if (data.usage) usage = data.usage;
      if (!Array.isArray(data.choices)) throw failure('INVALID_STREAM', '流式回复缺少 choices 数据');
      const choice = data.choices.find(item => item && item.index === 0) || (data.choices.length === 1 && data.choices[0] && data.choices[0].index === undefined ? data.choices[0] : null);
      if (!choice) return; // Usage-only packets and other choice indices.
      const delta = choice.delta && choice.delta.content;
      if (delta !== undefined && delta !== null && typeof delta !== 'string') throw failure('INVALID_STREAM', '流式回复中的脚本文本格式无效');
      if (delta) {
        if (finishReason) throw failure('INVALID_STREAM', '接口在结束标记后继续输出内容，不能确认结果完整性');
        const remaining = 200000 - length;
        const allowed = delta.slice(0, remaining);
        if (allowed) {
          pieces.push(allowed); length += allowed.length;
          if (options.onDelta) options.onDelta({ delta: allowed, contentLength: length });
        }
        if (delta.length > remaining) throw failure('OUTPUT_LIMIT', '生成内容超过 200000 字符，已停止接收；请缩小生成范围');
      }
      if (choice.finish_reason) {
        if (finishReason && choice.finish_reason !== finishReason) throw failure('INVALID_STREAM', '接口返回互相冲突的结束标记');
        finishReason = choice.finish_reason;
      }
      // Other fields, including reasoning text, are deliberately not displayed.
    });
    try {
      for (;;) {
        const result = await Promise.race([reader.read(), aborted]);
        if (signal && signal.aborted) throw failure('CANCELLED', '请求已中止');
        if (result.done) {
          decoder.feed(decode());
          if (!done && decoder.end().pending) throw failure('INCOMPLETE_STREAM', '流式连接提前结束，最后一条消息不完整，不能载入');
          break;
        }
        decoder.feed(decode(result.value, { stream: true }));
        if (done) break;
      }
      return { content: pieces.join(''), finishReason, usage, transport: 'stream' };
    } finally {
      if (signal) signal.removeEventListener('abort', onAbort);
      cancelReader();
      try { reader.releaseLock(); } catch (_) { /* A broken transport may retain its pending read. */ }
    }
  }
  return { createDecoder, readCompletion };
});
