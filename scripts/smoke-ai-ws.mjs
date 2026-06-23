#!/usr/bin/env node
/**
 * AI WebSocket smoke — JWT actor, invalid Bearer, anonymous body.
 *
 * Usage (backend must be running):
 *   npm run smoke:ws
 *   SMOKE_API_BASE=http://127.0.0.1:3000/api npm run smoke:ws
 *
 * Env:
 *   SMOKE_API_BASE   API root (default http://localhost:3000/api)
 *   SMOKE_JWT        Optional preset Bearer token (skips Mongo mint)
 *   SMOKE_USER_ID    Smoke user externalId (default smoke-ws-user)
 *   SMOKE_USER_NAME  Display name when minting JWT (default Smoke WS)
 *   JWT_SECRET       Must match backend (from .env)
 *   MONGODB_URI          Used when minting JWT (upsert smoke user + tv)
 *   SMOKE_WS_MODE        `golden` → Case A only (JWT ping); default runs A+B+C
 *   AI_CHAT_WS_ENABLED   When unset/false in suite context, skip with exit 0
 */

import WebSocket from 'ws';
import { resolveSmokeJwt } from './lib/smoke-jwt.mjs';

const DEFAULT_BASE = 'http://localhost:3000/api';
const SESSION_EXPIRED = '登录已过期，请重新登录';

const baseUrl = (process.env.SMOKE_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ai/chat/ws`;
const anonymousUserId = process.env.SMOKE_USER_ID || 'smoke-ws-user';
const goldenMode = process.env.SMOKE_WS_MODE === 'golden';

function isAiChatWsEnabled() {
  const v = process.env.AI_CHAT_WS_ENABLED;
  return v === 'true' || v === '1';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function caseAnonymous() {
  await wsOnce(wsUrl, {}, {
    label: 'Case C anonymous',
    onMessage: (msg, ws, done) => {
      if (msg.type === 'connected') {
        if (msg.auth !== 'anonymous') {
          done(new Error(`expected auth=anonymous, got ${msg.auth}`));
          return;
        }
        ws.send(
          JSON.stringify({
            type: 'send',
            messages: [{ role: 'user', content: 'smoke anonymous' }],
            userId: anonymousUserId,
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
  console.log('  OK Case C: anonymous body userId → connected.auth=anonymous');
}

async function main() {
  if (goldenMode && !isAiChatWsEnabled()) {
    console.log('↷ skip WS smoke — AI_CHAT_WS_ENABLED is not true');
    return;
  }

  console.log(`WS smoke → ${wsUrl}${goldenMode ? ' (golden)' : ''}`);
  const token = await resolveSmokeJwt();
  await caseValidJwt(token);

  if (goldenMode) {
    console.log('smoke-ai-ws: golden ping passed');
    return;
  }

  await delay(300);
  await caseInvalidJwt();
  await delay(300);
  await caseAnonymous();
  console.log('smoke-ai-ws: all cases passed');
}

main().catch((err) => {
  console.error('smoke-ai-ws failed:', err.message || err);
  process.exit(1);
});
