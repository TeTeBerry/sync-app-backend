#!/usr/bin/env node
/**
 * REST API smoke test — hits main business endpoints against a running backend.
 *
 * Usage:
 *   npm run smoke:api
 *   SMOKE_API_BASE=http://127.0.0.1:3000/api npm run smoke:api
 *   npm run smoke:api:wait   # wait for :3000 then run
 *
 * Env:
 *   SMOKE_API_BASE     API root (default http://localhost:3000/api)
 *   SMOKE_ACTIVITY_ID  Demo activity legacyId (default 4 — 风暴电音节)
 *   SMOKE_USER_ID      Query userId (default smoke-<timestamp>)
 *   SMOKE_AUTHOR_NAME  Query authorName (default Smoke; deprecated — smoke compat only)
 *   SMOKE_TIMEOUT_MS   Per-request timeout (default 30000)
 */

import { assert, createSmokeHttp } from './lib/smoke-http.mjs';
import { smokeTravelGuideGenerateAsync } from './lib/smoke-travel-guide-async.mjs';
import { resolveSmokeJwt } from './lib/smoke-jwt.mjs';

const DEFAULT_BASE = 'http://localhost:3000/api';
const DEFAULT_ACTIVITY_ID = 4;
const DEFAULT_AUTHOR = 'Smoke';

const baseUrl = (process.env.SMOKE_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
const activityId = Number(process.env.SMOKE_ACTIVITY_ID || DEFAULT_ACTIVITY_ID);
const userId = process.env.SMOKE_USER_ID || `smoke-${Date.now()}`;
const authorName = process.env.SMOKE_AUTHOR_NAME || DEFAULT_AUTHOR;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30_000);

const http = createSmokeHttp(baseUrl, timeoutMs);

/** @type {{ name: string, run: (ctx: SmokeContext) => Promise<void> }[]} */
const steps = [];

/** @typedef {{ baseUrl: string, activityId: number, q: string, postId?: string, postAuthorUserId?: string, djIds?: string[], generateResult?: unknown, bearerToken?: string }} SmokeContext */

function ownerQuery() {
  // authorName kept for legacy smoke paths; production demo uses userId only.
  const p = new URLSearchParams({ userId, authorName });
  return p.toString();
}

function step(name, run) {
  steps.push({ name, run });
}

step('GET /health', async () => {
  const data = await http.request('GET', 'health');
  assert(data?.ok === true, 'health.ok should be true');
  assert(data?.ai?.transport === 'scene-run', 'health.ai.transport should be scene-run');
});

step('GET /home', async () => {
  const data = await http.request('GET', 'home');
  assert(data != null, 'home data missing');
});

step('GET /activities', async () => {
  const data = await http.request('GET', 'activities');
  const list = Array.isArray(data) ? data : data?.items ?? data?.activities;
  assert(Array.isArray(list) && list.length > 0, 'activities list should be non-empty');
});

step(`GET /activities/${activityId}`, async (ctx) => {
  const data = await http.request('GET', `activities/${ctx.activityId}?${ctx.q}`);
  assert(data?.legacyId === ctx.activityId || data?.id != null, 'activity detail missing');
});

step('GET /posts/popular', async (ctx) => {
  const data = await http.request('GET', `posts/popular?limit=5&${ctx.q}`);
  const list = Array.isArray(data) ? data : data?.items;
  assert(Array.isArray(list), 'popular posts should be an array');
});

step(`GET /posts?activityLegacyId=${activityId}`, async (ctx) => {
  const data = await http.request(
    'GET',
    `posts?activityLegacyId=${ctx.activityId}&limit=5&${ctx.q}`,
  );
  const items = data?.items ?? (Array.isArray(data) ? data : []);
  assert(Array.isArray(items), 'posts page should have items array');
  if (items.length > 0 && items[0]?.id) {
    ctx.postId = String(items[0].id);
    ctx.postAuthorUserId = items[0].userId ? String(items[0].userId) : undefined;
  }
});

step('GET /profile', async (ctx) => {
  await http.request(
    'GET',
    `profile?${ctx.q}&activityLegacyId=${ctx.activityId}`,
  );
});

step('GET /users/me', async (ctx) => {
  const data = await http.request('GET', `users/me?${ctx.q}`);
  assert(data?.id || data?.name, 'users/me should return profile fields');
});

step('PATCH /users/me', async (ctx) => {
  await http.request('PATCH', `users/me?${ctx.q}`, {
    body: { bio: `smoke ${new Date().toISOString()}` },
  });
});

step(`POST /activities/${activityId}/register`, async (ctx) => {
  const data = await http.request('POST', `activities/${ctx.activityId}/register?${ctx.q}`);
  assert(data?.ok === true, 'register should return ok: true');
});

step(`GET /activities/${activityId}/itinerary/schedule`, async (ctx) => {
  const data = await http.request(
    'GET',
    `activities/${ctx.activityId}/itinerary/schedule?${ctx.q}`,
  );
  assert(Array.isArray(data?.djs) && data.djs.length > 0, 'schedule.djs should be non-empty');
  ctx.djIds = data.djs.slice(0, 2).map((d) => d.id);
  assert(ctx.djIds.every(Boolean), 'could not pick DJ ids from schedule');
});

step(`POST /activities/${activityId}/itinerary/generate`, async (ctx) => {
  const data = await http.request('POST', `activities/${ctx.activityId}/itinerary/generate?${ctx.q}`, {
    body: { selectedDjIds: ctx.djIds },
  });
  assert(data?.itinerary?.days?.length > 0, 'generate should return itinerary.days');
  ctx.generateResult = data;
});

step(`POST /activities/${activityId}/itinerary/save`, async (ctx) => {
  const gen = ctx.generateResult;
  assert(gen?.itinerary, 'missing generate result for save');
  const data = await http.request('POST', `activities/${ctx.activityId}/itinerary/save?${ctx.q}`, {
    body: {
      eventMeta: gen.itinerary.eventMeta,
      days: gen.itinerary.days,
      selectedDjIds: ctx.djIds,
    },
  });
  assert(data?.ok === true, 'save should return ok: true');
});

step(`GET /activities/${activityId}/itinerary/saved`, async (ctx) => {
  const data = await http.request(
    'GET',
    `activities/${ctx.activityId}/itinerary/saved?${ctx.q}`,
  );
  assert(data?.saved === true, 'saved should be true after save');
  assert(Array.isArray(data?.days) && data.days.length > 0, 'saved days missing');
});

step(`GET /activities/${activityId}/travel-plan/saved`, async (ctx) => {
  const data = await http.request(
    'GET',
    `activities/${ctx.activityId}/travel-plan/saved?${ctx.q}`,
  );
  assert(data?.saved === false || data?.saved === true, 'travel-plan saved flag missing');
  assert(Array.isArray(data?.nodes), 'travel-plan nodes should be an array');
});

step(`POST /activities/${activityId}/travel-plan/save`, async (ctx) => {
  const data = await http.request(
    'POST',
    `activities/${ctx.activityId}/travel-plan/save?${ctx.q}`,
    {
      body: {
        eventMeta: 'smoke travel plan',
        nodes: [
          {
            id: 'smoke-hotel-1',
            category: 'hotel',
            startDate: '2026-03-14',
            endDate: '2026-03-16',
            title: 'Smoke Hotel',
            subtitle: 'Bangkok',
            confirmed: true,
          },
        ],
      },
    },
  );
  assert(data?.ok === true, 'travel-plan save should return ok: true');
});

step(`POST travel-guide/generate-async + poll`, async (ctx) => {
  const token = ctx.bearerToken ?? (await resolveSmokeJwt());
  ctx.bearerToken = token;
  await smokeTravelGuideGenerateAsync(http, ctx.activityId, token);
});

step('GET /notifications', async (ctx) => {
  await http.request('GET', `notifications?${ctx.q}`);
});

step('GET /notifications/unread-count', async (ctx) => {
  const data = await http.request('GET', `notifications/unread-count?${ctx.q}`);
  const n = typeof data === 'number' ? data : data?.count;
  assert(typeof n === 'number', 'unread-count should be a number');
});

step('POST /reports (post)', async (ctx) => {
  if (!ctx.postId) {
    console.log('    ↷ skip — no postId');
    return;
  }
  const data = await http.request('POST', `reports?${ctx.q}`, {
    body: {
      targetType: 'post',
      targetId: ctx.postId,
      ...(ctx.postAuthorUserId
        ? { targetUserId: ctx.postAuthorUserId }
        : {}),
      category: 'ads',
    },
  });
  assert(data?.ok === true && data?.id, 'report should return ok and id');
});

step('POST /reports duplicate → 409', async (ctx) => {
  if (!ctx.postId) {
    console.log('    ↷ skip — no postId');
    return;
  }
  await http.request('POST', `reports?${ctx.q}`, {
    body: {
      targetType: 'post',
      targetId: ctx.postId,
      category: 'ads',
    },
    expectCode: 409,
    expectStatus: 409,
  });
});

step(`DELETE /activities/${activityId}/register (cleanup)`, async (ctx) => {
  await http.request('DELETE', `activities/${ctx.activityId}/register?${ctx.q}`);
});

async function main() {
  /** @type {SmokeContext} */
  const ctx = {
    baseUrl,
    activityId,
    q: ownerQuery(),
  };

  console.log(`\n🔥 REST smoke — ${baseUrl}`);
  console.log(`   activityLegacyId=${activityId}  ${ctx.q}\n`);

  let passed = 0;
  let failed = 0;

  for (const { name, run } of steps) {
    process.stdout.write(`  • ${name} … `);
    try {
      await run(ctx);
      console.log('OK');
      passed += 1;
    } catch (err) {
      console.log('FAIL');
      console.error(`    ${err instanceof Error ? err.message : err}`);
      failed += 1;
      break;
    }
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed}/${steps.length} steps passed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
