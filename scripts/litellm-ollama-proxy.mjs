/*
 * LiteLLM-replacement Ollama proxy for Kurukoo
 *
 * Provides OpenAI-compatible API endpoints on port 4000, routing to local
 * and/or remote Ollama instances.
 *
 * Usage:
 *   node scripts/litellm-ollama-proxy.mjs
 *
 * Environment:
 *   OLLAMA_LOCAL_HOST  – default: http://localhost:11434
 *   OLLAMA_REMOTE_HOST – default: http://localhost:11434
 *   PORT               – default: 4000
 */

import http from 'node:http';
import { URL } from 'node:url';

const LOCAL_HOST = process.env.OLLAMA_LOCAL_HOST || 'http://localhost:11434';
const REMOTE_HOST = process.env.OLLAMA_REMOTE_HOST || 'http://localhost:11434';
const PORT = parseInt(process.env.PORT || '4000', 10);

function getOllamaHost(modelName) {
  const name = (modelName || '').toLowerCase();
  if (name.endsWith('-remote')) return REMOTE_HOST;
  return LOCAL_HOST;
}

const MODEL_ALIASES = {
  'smollm2': 'smollm2:360m',
  'gemma3': 'gemma3:4b',
  'gemma4': 'gemma4:e2b',
  'gemma4:e2b': 'gemma4:e2b',
  'qwen3vl': 'qwen3-vl:2b-instruct-q8_0',
  'qwen3': 'qwen3-vl:2b-instruct-q8_0',
};

function stripSuffix(modelName) {
  const name = (modelName || '')
    .replace(/^(ollama\/)?/, '')
    .replace(/-local$/, '')
    .replace(/-remote$/, '');
  // Resolve aliases if the cleaned name doesn't have a tag (colon)
  if (!name.includes(':' ) && MODEL_ALIASES[name.toLowerCase()]) {
    return MODEL_ALIASES[name.toLowerCase()];
  }
  return name;
}

async function fetchJson(url) {
  try { return await fetch(url).then(r => r.json()); }
  catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const { method, url: reqUrl } = req;
  const url = new URL(reqUrl, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', local: LOCAL_HOST, remote: REMOTE_HOST, port: PORT }));
      return;
    }

    if (url.pathname === '/v1/models' && method === 'GET') {
      const localTags = await fetchJson(`${LOCAL_HOST}/api/tags`);
      const localModels = (localTags.models || []).map(m => ({
        id: m.name, object: 'model',
        created: Math.floor(new Date(m.modified_at || Date.now()).getTime() / 1000),
        owned_by: 'ollama-local'
      }));

      if (REMOTE_HOST !== LOCAL_HOST) {
        const remoteTags = await fetchJson(`${REMOTE_HOST}/api/tags`);
        const remoteModels = (remoteTags.models || []).map(m => ({
          id: `${m.name}-remote`, object: 'model',
          created: Math.floor(new Date(m.modified_at || Date.now()).getTime() / 1000),
          owned_by: 'ollama-remote'
        }));
        localModels.push(...remoteModels);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: localModels }));
      return;
    }

    if (url.pathname === '/v1/chat/completions' && method === 'POST') {
      const body = JSON.parse(await new Promise((resolve) => {
        let data = '';
        req.on('data', c => data += c);
        req.on('end', () => resolve(data));
      }));

      const host = getOllamaHost(body.model);
      const cleanModel = stripSuffix(body.model);
      const ollamaBody = {
        model: cleanModel,
        messages: body.messages,
        stream: body.stream || false,
        options: {
          temperature: body.temperature || 0.7,
          num_predict: body.max_tokens || 2048,
        }
      };

      const targetUrl = new URL('/api/chat', host);
      const payload = JSON.stringify(ollamaBody);

      if (body.stream) {
        // For streaming, Ollama's /api/chat sends JSON chunks with "message.content"
        // We need to convert each chunk to OpenAI SSE format
        const tgt = http.request(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (upstream) => {
          res.writeHead(upstream.statusCode || 502, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          let buffer = '';
          upstream.on('data', (chunk) => {
            buffer += chunk.toString();
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.message && data.message.content) {
                  const openaiChunk = {
                    id: 'chatcmpl-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: body.model,
                    choices: [{
                      index: 0,
                      delta: { content: data.message.content, role: 'assistant' },
                      finish_reason: data.done ? 'stop' : null
                    }]
                  };
                  res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
                }
              } catch (e) { /* skip invalid lines */ }
            }
          });
          upstream.on('end', () => {
            res.end('data: [DONE]\n\n');
          });
        });
        tgt.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        });
        tgt.write(payload);
        tgt.end();
      } else {
        // Non-streaming: forward and convert Ollama response to OpenAI format
        const tgt = http.request(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (upstream) => {
          let rawBody = '';
          upstream.on('data', c => rawBody += c);
          upstream.on('end', () => {
            try {
              const ollamaResp = JSON.parse(rawBody);
              // Convert Ollama format to OpenAI format
              const openaiResp = {
                id: 'chatcmpl-' + Date.now(),
                object: 'chat.completion',
                created: Math.floor(new Date(ollamaResp.created_at || Date.now()).getTime() / 1000),
                model: body.model,
                choices: [{
                  index: 0,
                  message: ollamaResp.message || { role: 'assistant', content: '' },
                  finish_reason: ollamaResp.done ? 'stop' : 'length'
                }],
                usage: {
                  prompt_tokens: ollamaResp.prompt_eval_count || 0,
                  completion_tokens: ollamaResp.eval_count || 0,
                  total_tokens: (ollamaResp.prompt_eval_count || 0) + (ollamaResp.eval_count || 0)
                }
              };
              res.writeHead(upstream.statusCode || 502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(openaiResp));
            } catch (e) {
              // If we can't parse, just forward raw
              res.writeHead(upstream.statusCode || 502, { 'Content-Type': 'application/json' });
              res.end(rawBody);
            }
          });
        });
        tgt.on('error', (err) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        });
        tgt.write(payload);
        tgt.end();
      }
      return;
    }

    if (url.pathname === '/api/tags' && method === 'GET') {
      const tgt = http.request(new URL('/api/tags', LOCAL_HOST), { method: 'GET' }, (upstream) => {
        let chunks = '';
        upstream.on('data', c => chunks += c);
        upstream.on('end', () => {
          res.writeHead(upstream.statusCode || 502, { 'Content-Type': 'application/json' });
          res.end(chunks);
        });
      });
      tgt.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      });
      tgt.end();
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: err.message || 'Internal error' } }));
  }
});

server.listen(PORT, () => {
  console.log(`[LiteLLM-Ollama Proxy] Running on http://0.0.0.0:${PORT}`);
  console.log(`  Local Ollama: ${LOCAL_HOST}`);
  console.log(`  Remote Ollama: ${REMOTE_HOST}`);
});
