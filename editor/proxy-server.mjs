// proxy-server.mjs — Lightweight DMXAPI proxy for PPT Editor image generation
// Zero dependencies (uses Node.js built-in http/https)
// Usage: node proxy-server.mjs [--port 4321]

import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1]) || 4321;

function loadEnvKey() {
  const envPath = resolve(__dirname, '..', '.agents', 'skills', 'image-generator-dmxapi-gptimage2', '.env');
  if (!existsSync(envPath)) return null;
  const content = readFileSync(envPath, 'utf-8');
  const match = content.match(/DMXAPI_KEY\s*=\s*(.+)/);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

const ENV_KEY = loadEnvKey();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, status, data) {
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function proxyGenerate(body) {
  return new Promise((resolve, reject) => {
    const apiKey = body.apiKey || ENV_KEY;
    if (!apiKey) {
      return reject(new Error('No API key provided (pass apiKey in body or set DMXAPI_KEY in .env)'));
    }

    const postData = JSON.stringify({
      model: body.model || 'gpt-image-2-ssvip',
      prompt: body.prompt,
      n: 1,
      size: body.size || '1536x1024',
      quality: body.quality || 'auto',
      output_format: body.format || 'png',
    });

    const req = httpsRequest({
      hostname: 'www.dmxapi.cn',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { status: 'ok', envKey: !!ENV_KEY });
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.prompt) {
          return sendJson(res, 400, { error: 'prompt is required' });
        }
        const result = await proxyGenerate(parsed);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`DMXAPI proxy server running on http://localhost:${PORT}`);
  console.log(`ENV key: ${ENV_KEY ? 'loaded' : 'not found'}`);
  console.log(`POST http://localhost:${PORT}/api/generate`);
  console.log(`GET  http://localhost:${PORT}/health`);
});
