#!/usr/bin/env node
/**
 * AI WebSocket smoke — JWT actor, invalid Bearer, demo body.
 *
 * Usage (backend must be running):
 *   npm run smoke:ws
 *   SMOKE_API_BASE=http://127.0.0.1:3000/api npm run smoke:ws
 */

import WebSocket from 'ws';

const DEFAULT_BASE = 'http://localhost:3000/api';
const SESSION_EXPIRED = '登录已过期，请重新登录';

const baseUrl = (process.env.SMOKE_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ai/chat/ws`;
const demoUserId = process.env.SMOKE_USER_ID || 'smoke-ws-demo';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(method, path, { body, headers } = {}) {
  const url = `${baseUrl}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${method} ${url} non-JSON: ${text.slice(0, 200)}`);
  }
  return { status: res.status, json };
}

async function devLogin() {
  const { status, json } = await fetchJson('POST', 'auth/dev', {
    body: { displayName: 'Smoke WS' },
  });
  if (status !== 201 && status !== 200) {
    throw new Error(`POST /auth/dev failed: ${status} ${JSON.stringify(json)}`);
  }
  const token = json?.data?.accessToken;
  if (!token) {
    throw new Error('POST /auth/dev missing accessToken (is AUTH_MODE=dev?)');
  }
  return token;
}

function isStreamTerminal(msg) {
  return (
    msg.type === 'delta' ||
    msg.type === 'done' ||
    msg.type === 'message_complete'
  );
}

function wsOnce(url, headers, handlers) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WS timeout (${handlers.label || 'case'})`));
    }, 30_000);

    const finish = (err, result) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(result);
    };

    ws.on('error', (err) => finish(err));
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'connect' }));
      handlers.onOpen?.(ws);
    });
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handlers.onMessage?.(msg, ws, () => finish(null, msg));
      } catch (e) {
        finish(e);
      }
    });
    ws.on('close', () => handlers.onClose?.());
  });
}

async function caseValidJwt(token) {
  await wsOnce(
    wsUrl,
    { Authorization: `Bearer ${token}` },
    {
      label: 'Case A valid JWT',
      onMessage: (msg, ws, done) => {
        if (msg.type === 'connected') {
          if (msg.auth !== 'jwt') {
            done(new Error(`expected auth=jwt, got ${msg.auth}`));
            return;
          }
          ws.send(
            JSON.stringify({
              type: 'send',
              messages: [{ role: 'user', content: 'smoke ping' }],
            }),
          );
          return;
        }
        if (msg.type === 'error') {
          done(new Error(`unexpected error: ${msg.message}`));
          return;
        }
        if (isStreamTerminal(msg)) {
          done(null);
        }
      },
    },
  );
  console.log('  OK Case A: valid JWT, send without body userId');
}

async function caseInvalidJwt() {
  await new Promise((resolve, reject) => {
    let sawExpired = false;
    const ws = new WebSocket(wsUrl, {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Case B: timeout'));
    }, 10_000);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error' && msg.message === SESSION_EXPIRED) {
        sawExpired = true;
      }
    });
    ws.on('error', reject);
    ws.on('close', () => {
      clearTimeout(timer);
      if (sawExpired) resolve();
      else reject(new Error('Case B: no session expired error frame'));
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'connect' }));
    });
  });
  console.log('  OK Case B: invalid Bearer → session expired error');
}

async function caseDemo() {
  await wsOnce(wsUrl, {}, {
    label: 'Case C demo',
    onMessage: (msg, ws, done) => {
      if (msg.type === 'connected') {
        if (msg.auth !== 'demo') {
          done(new Error(`expected auth=demo, got ${msg.auth}`));
          return;
        }
        ws.send(
          JSON.stringify({
            type: 'send',
            messages: [{ role: 'user', content: 'smoke demo' }],
            userId: demoUserId,
            userName: 'Smoke',
          }),
        );
        return;
      }
      if (msg.type === 'error' && msg.message?.includes('缺少用户身份')) {
        done(new Error(msg.message));
        return;
      }
      if (isStreamTerminal(msg) || msg.type === 'error') {
        done(null);
      }
    },
  });
  console.log('  OK Case C: demo body userId → connected.auth=demo');
}

async function main() {
  console.log(`WS smoke → ${wsUrl}`);
  const token = await devLogin();
  await caseValidJwt(token);
  await delay(300);
  await caseInvalidJwt();
  await delay(300);
  await caseDemo();
  console.log('smoke-ai-ws: all cases passed');
}

main().catch((err) => {
  console.error('smoke-ai-ws failed:', err.message || err);
  process.exit(1);
});
