#!/usr/bin/env node
/**
 * Golden-path REST smoke — core user flows for CI merge gate.
 *
 * Usage:
 *   npm run smoke:golden
 *   npm run smoke:golden:wait
 *
 * Env:
 *   SMOKE_API_BASE          API root (default http://localhost:3000/api)
 *   SMOKE_ACTIVITY_ID       Activity legacyId (default 4)
 *   SMOKE_USER_ID           Shared user for query + JWT (default smoke-golden-user)
 *   SMOKE_AUTHOR_NAME       Query authorName (default Smoke)
 *   SMOKE_TIMEOUT_MS        Per-request timeout (default 30000)
 *   SMOKE_TG_POLL_MS        Travel guide poll interval (default 2000)
 *   SMOKE_TG_POLL_TIMEOUT_MS Travel guide poll timeout (default 90000)
 */

import { assert, createSmokeHttp } from './lib/smoke-http.mjs';
import { smokeTravelGuideGenerateAsync } from './lib/smoke-travel-guide-async.mjs';
import { resolveSmokeJwt } from './lib/smoke-jwt.mjs';

const DEFAULT_BASE = 'http://localhost:3000/api';
const DEFAULT_ACTIVITY_ID = 4;
const DEFAULT_AUTHOR = 'Smoke';

const baseUrl = (process.env.SMOKE_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
const activityId = Number(process.env.SMOKE_ACTIVITY_ID || DEFAULT_ACTIVITY_ID);
const userId = process.env.SMOKE_USER_ID || 'smoke-golden-user';
const authorName = process.env.SMOKE_AUTHOR_NAME || DEFAULT_AUTHOR;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30_000);

const http = createSmokeHttp(baseUrl, timeoutMs);

/** @type {{ name: string, run: (ctx: GoldenContext) => Promise<void> }[]} */
const steps = [];

/** @typedef {{ baseUrl: string, activityId: number, q: string, bearerToken?: string }} GoldenContext */

function ownerQuery() {
  const p = new URLSearchParams({ userId, authorName });
  return p.toString();
}

function step(name, run) {
  steps.push({ name, run });
}

step('GET /health', async () => {
  const data = await http.request('GET', 'health');
  assert(data?.ok === true, 'health.ok should be true');
});

step('GET /activities + detail', async (ctx) => {
  const listData = await http.request('GET', 'activities');
  const list = Array.isArray(listData)
    ? listData
    : listData?.items ?? listData?.activities;
  assert(Array.isArray(list) && list.length > 0, 'activities list should be non-empty');

  const detail = await http.request('GET', `activities/${ctx.activityId}?${ctx.q}`);
  assert(
    detail?.legacyId === ctx.activityId || detail?.id != null,
    'activity detail missing',
  );
});

step(`POST travel-guide/generate-async + poll`, async (ctx) => {
  const token = ctx.bearerToken ?? (await resolveSmokeJwt());
  ctx.bearerToken = token;
  await smokeTravelGuideGenerateAsync(http, ctx.activityId, token);
});

step(`POST /ai/scene-run events_knowledge_search`, async (ctx) => {
  const token = ctx.bearerToken ?? (await resolveSmokeJwt());
  ctx.bearerToken = token;

  const data = await http.request('POST', 'ai/scene-run', {
    body: {
      scene: 'events_knowledge_search',
      input: '7月欧洲电音节',
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  const effects = data?.effects ?? [];
  assert(Array.isArray(effects), 'scene-run should return effects array');
});

step(`POST /activities/:id/set-votes + GET leaderboard`, async (ctx) => {
  const token = ctx.bearerToken ?? (await resolveSmokeJwt());
  ctx.bearerToken = token;

  const schedule = await http.request(
    'GET',
    `activities/${ctx.activityId}/itinerary/schedule?${ctx.q}`,
  );
  const djs = schedule?.djs ?? [];
  assert(Array.isArray(djs) && djs.length >= 2, 'schedule should list at least 2 DJs');

  const artistIds = djs.slice(0, 2).map((dj) => dj.id);
  const submit = await http.request(
    'POST',
    `activities/${ctx.activityId}/set-votes`,
    {
      body: { artistIds },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  assert(submit?.ok === true, 'set-vote submit should return ok');
  assert(Array.isArray(submit?.picks) && submit.picks.length === 2, 'set-vote picks');

  const board = await http.request(
    'GET',
    `activities/${ctx.activityId}/set-votes/leaderboard?${ctx.q}`,
  );
  assert(board?.totalVoters >= 1, 'leaderboard totalVoters should be >= 1');
  assert(Array.isArray(board?.entries), 'leaderboard entries should be array');
});

async function main() {
  /** @type {GoldenContext} */
  const ctx = {
    baseUrl,
    activityId,
    q: ownerQuery(),
  };

  console.log(`\n✨ Golden-path smoke — ${baseUrl}`);
  console.log(`   activityLegacyId=${activityId}  userId=${userId}\n`);

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
