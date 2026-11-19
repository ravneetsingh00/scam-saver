const test = require('node:test');
const assert = require('node:assert/strict');
const { streamChatResponse } = require('../utils/openaiInvestigation');

const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_MODEL;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGoogleKey = process.env.GOOGLE_API_KEY;
const originalGeminiModel = process.env.GEMINI_MODEL;

test.after(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = originalModel;
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGoogleKey === undefined) delete process.env.GOOGLE_API_KEY; else process.env.GOOGLE_API_KEY = originalGoogleKey;
  if (originalGeminiModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalGeminiModel;
});

test('chat streams Responses API text, uses web search and returns source citations', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'gpt-6.2-sol';
  const text = 'Answer '.repeat(90);
  const chunks = [text.slice(0, 400), text.slice(400)];
  const events = [
    ...chunks.map(delta => ({ type: 'response.output_text.delta', delta })),
    { type: 'response.completed', response: { output: [{ type: 'message', content: [{ type: 'output_text', text, annotations: [{ type: 'url_citation', title: 'Official source', url: 'https://example.org/source' }] }] }] } },
  ].map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  let request;
  global.fetch = async (url, options) => {
    request = JSON.parse(options.body);
    assert.equal(url, 'https://api.openai.com/v1/responses');
    return new Response(events, { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const deltas = [];
  const result = await streamChatResponse({ message: 'Explain this topic', onDelta: delta => deltas.push(delta) });
  assert.equal(request.model, 'gpt-6.2-sol');
  assert.equal(request.stream, true);
  assert.equal(request.tools[0].type, 'web_search');
  assert.equal(deltas.join(''), text);
  assert.equal(result.text, text);
  assert.equal(result.sources[0].url, 'https://example.org/source');
});

test('chat fails clearly before network access when the backend key is missing', async () => {
  delete process.env.OPENAI_API_KEY;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not connect'); };
  await assert.rejects(streamChatResponse({ message: 'Hello' }), error => error.status === 503 && /GEMINI_API_KEY/.test(error.message));
  assert.equal(called, false);
});

test('chat explains when the OpenAI project has no API credits', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async () => new Response(JSON.stringify({ error: { code: 'insufficient_quota', message: 'You have no credits remaining.' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(streamChatResponse({ message: 'Hello' }), error => error.status === 503 && /no credits remaining/i.test(error.message));
});

test('chat also handles quota errors sent inside a successful HTTP stream', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const event = { type: 'response.failed', response: { error: { code: 'insufficient_quota', message: 'You have no credits remaining.' } } };
  global.fetch = async () => new Response(`event: response.failed\ndata: ${JSON.stringify(event)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  await assert.rejects(streamChatResponse({ message: 'Hello' }), error => error.status === 503 && /no available quota or credits/i.test(error.message));
});

test('chat selects Gemini when a Gemini key is stored in the previous OpenAI environment slot', async () => {
  process.env.OPENAI_API_KEY = 'AQ.test-gemini-key';
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  const { getAiProvider } = require('../utils/openaiInvestigation');
  assert.deepEqual(getAiProvider(), { name: 'Gemini', key: 'AQ.test-gemini-key', model: 'gemini-3.8-flash' });
});

test('Gemini chat streams text, requests Google Search and returns citations', async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  const text = 'A short Gemini answer.';
  const events = [
    { event_type: 'step.delta', delta: { type: 'text', text } },
    { event_type: 'interaction.completed', interaction: { steps: [{ type: 'model_output', content: [{ type: 'text', text, annotations: [{ type: 'url_citation', title: 'Official source', url: 'https://example.org/gemini-source' }] }] }] } },
  ].map(event => `event: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  let request, requestHeaders;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    request = JSON.parse(options.body); requestHeaders = options.headers;
    return new Response(events, { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const deltas = [];
  const result = await streamChatResponse({ message: 'Explain this', onDelta: delta => deltas.push(delta) });
  assert.equal(request.model, 'gemini-3.8-flash');
  assert.deepEqual(request.tools, [{ type: 'google_search' }]);
  assert.equal(request.stream, true);
  assert.equal(request.store, false);
  assert.equal(requestHeaders['x-goog-api-key'], 'test-gemini-key');
  assert.equal(deltas.join(''), text);
  assert.equal(result.text, text);
  assert.equal(result.sources[0].url, 'https://example.org/gemini-source');
});
