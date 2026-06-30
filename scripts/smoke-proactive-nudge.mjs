#!/usr/bin/env node
/**
 * Seed Mongo preconditions, run ProactiveNudgeService.checkNudges(), verify N1–N4 notifications.
 *
 * Usage:
 *   npm run db:smoke-proactive-nudge
 *   node scripts/smoke-proactive-nudge.mjs
 */

import { execSync } from 'child_process';
import { createRequire } from 'node:module';
import {
  requireFromDist,
  resolveDistRoot,
} from './lib/resolve-dist-root.mjs';

const require = createRequire(import.meta.url);

if (!resolveDistRoot()) {
  console.log('dist missing — building…');
  execSync('nest build', { stdio: 'inherit' });
}

const { NestFactory } = require('@nestjs/core');
const { getConnectionToken } = require('@nestjs/mongoose');
const { AppModule } = requireFromDist('app.module');
const { ProactiveNudgeService } = requireFromDist(
  'modules/notification/proactive-nudge.service',
);
const { ActivityLookupService } = requireFromDist(
  'modules/activity/activity-lookup.service',
);

const TEST_ACTIVITY_LEGACY_ID = 4;
const SMOKE_PREFIX = 'smoke-nudge';

function daysFromNowIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function clearSmokeData(db) {
  const userPattern = new RegExp(`^${SMOKE_PREFIX}`);
  await Promise.all([
    db.collection('notifications').deleteMany({ userId: userPattern }),
    db.collection('activityregistrations').deleteMany({ userId: userPattern }),
    db.collection('user_activity_engagements').deleteMany({ userId: userPattern }),
    db.collection('travel_guide_saved_plans').deleteMany({ ownerUserId: userPattern }),
    db.collection('posts').deleteMany({ userId: `${SMOKE_PREFIX}-post-author` }),
  ]);
}

async function upsertRegistration(db, userId) {
  await db.collection('activityregistrations').updateOne(
    { userId, activityLegacyId: TEST_ACTIVITY_LEGACY_ID },
    {
      $set: {
        userId,
        activityLegacyId: TEST_ACTIVITY_LEGACY_ID,
        status: 'registered',
        authorName: 'Smoke',
      },
    },
    { upsert: true },
  );
}

async function seedN4Posts(db, count = 5) {
  const now = new Date();
  const docs = Array.from({ length: count }, (_, i) => ({
    userId: `${SMOKE_PREFIX}-post-author`,
    authorName: 'SmokeAuthor',
    activityLegacyId: TEST_ACTIVITY_LEGACY_ID,
    eventTitle: 'Smoke fest',
    body: `smoke recruit post ${i + 1}`,
    bodyPreview: `smoke recruit post ${i + 1}`,
    status: 'active',
    listedInFeed: true,
    recruitStatus: 'open',
    createdAt: now,
    updatedAt: now,
  }));
  await db.collection('posts').insertMany(docs);
}

async function fetchNudgeNotifications(db, userId) {
  return db
    .collection('notifications')
    .find({
      userId,
      'meta.type': 'proactive_nudge',
      'meta.activityLegacyId': TEST_ACTIVITY_LEGACY_ID,
    })
    .sort({ createdAt: -1 })
    .toArray();
}

function printNotifications(userId, notifications) {
  if (!notifications.length) {
    console.log(`  (no proactive_nudge notifications for ${userId})`);
    return;
  }
  for (const n of notifications) {
    const meta = n.meta ?? {};
    console.log(`  • rule=${meta.nudgeRule} title=${n.title}`);
    console.log(`    body: ${n.body}`);
    console.log(
      `    meta: ${JSON.stringify({
        nudgeRule: meta.nudgeRule,
        displayEventName: meta.displayEventName,
        prefillQuery: meta.prefillQuery,
        openBuddyPost: meta.openBuddyPost,
        openLineup: meta.openLineup,
        focusPosts: meta.focusPosts,
      })}`,
    );
  }
}

function assertRule(notifications, ruleId, checks = {}) {
  const hit = notifications.find((n) => n.meta?.nudgeRule === ruleId);
  if (!hit) {
    throw new Error(`Expected nudge ${ruleId} but none found`);
  }
  if (checks.bodyIncludes && !hit.body?.includes(checks.bodyIncludes)) {
    throw new Error(
      `${ruleId} body expected to include "${checks.bodyIncludes}", got: ${hit.body}`,
    );
  }
  if (checks.prefillIncludes && !hit.meta?.prefillQuery?.includes(checks.prefillIncludes)) {
    throw new Error(
      `${ruleId} prefillQuery expected to include "${checks.prefillIncludes}", got: ${hit.meta?.prefillQuery}`,
    );
  }
  if (checks.openBuddyPost && !hit.meta?.openBuddyPost) {
    throw new Error(`${ruleId} expected openBuddyPost meta`);
  }
  if (checks.openLineup && !hit.meta?.openLineup) {
    throw new Error(`${ruleId} expected openLineup meta`);
  }
  if (checks.focusPosts && !hit.meta?.focusPosts) {
    throw new Error(`${ruleId} expected focusPosts meta`);
  }
  return hit;
}

async function runScenario(db, activityLookup, nudgeService, label, setup, assertFn) {
  console.log(`\n── ${label} ──`);
  await setup();
  await activityLookup.refreshCache();
  await nudgeService.checkNudges();
  const userId = `${SMOKE_PREFIX}-${label.toLowerCase()}`;
  const notifications = await fetchNudgeNotifications(db, userId);
  printNotifications(userId, notifications);
  await assertFn(notifications);
  console.log(`  ✅ ${label} passed`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const connection = app.get(getConnectionToken());
  const db = connection.db;
  const nudgeService = app.get(ProactiveNudgeService);
  const activityLookup = app.get(ActivityLookupService);

  const activityCol = db.collection('activities');
  const originalActivity = await activityCol.findOne({
    legacyId: TEST_ACTIVITY_LEGACY_ID,
  });
  if (!originalActivity) {
    throw new Error(
      `Activity legacyId=${TEST_ACTIVITY_LEGACY_ID} not found — seed activities first`,
    );
  }

  const restoreActivity = {
    date: originalActivity.date,
    name: originalActivity.name,
    lineupAnnouncedAt: originalActivity.lineupAnnouncedAt ?? null,
  };

  try {
    console.log(
      `Using activity ${TEST_ACTIVITY_LEGACY_ID} (${originalActivity.name}) on ${process.env.MONGODB_URI ?? 'default URI'}`,
    );
    await clearSmokeData(db);

    const upcomingDate = daysFromNowIso(14);
    const smokeActivityName = 'SmokeStorm';

    await activityCol.updateOne(
      { legacyId: TEST_ACTIVITY_LEGACY_ID },
      {
        $set: {
          date: upcomingDate,
          name: smokeActivityName,
          lineupAnnouncedAt: null,
        },
      },
    );

    await runScenario(
      db,
      activityLookup,
      nudgeService,
      'N1',
      async () => {
        const userId = `${SMOKE_PREFIX}-n1`;
        await db.collection('notifications').deleteMany({ userId });
        await upsertRegistration(db, userId);
      },
      async (notifications) => {
        assertRule(notifications, 'N1', {
          bodyIncludes: '公开招募帖',
          openBuddyPost: true,
        });
      },
    );

    await runScenario(
      db,
      activityLookup,
      nudgeService,
      'N2',
      async () => {
        const userId = `${SMOKE_PREFIX}-n2`;
        await db.collection('notifications').deleteMany({ userId });
        await upsertRegistration(db, userId);
        await activityCol.updateOne(
          { legacyId: TEST_ACTIVITY_LEGACY_ID },
          { $set: { lineupAnnouncedAt: new Date() } },
        );
      },
      async (notifications) => {
        assertRule(notifications, 'N2', {
          bodyIncludes: `${smokeActivityName}阵容已出`,
          openLineup: true,
        });
      },
    );

    await runScenario(
      db,
      activityLookup,
      nudgeService,
      'N3',
      async () => {
        const userId = `${SMOKE_PREFIX}-n3`;
        await db.collection('notifications').deleteMany({ userId });
        await upsertRegistration(db, userId);
        await activityCol.updateOne(
          { legacyId: TEST_ACTIVITY_LEGACY_ID },
          { $set: { lineupAnnouncedAt: isoDaysAgo(10) } },
        );
        await db.collection('travel_guide_saved_plans').updateOne(
          { guideId: `${SMOKE_PREFIX}-guide-n3` },
          {
            $set: {
              guideId: `${SMOKE_PREFIX}-guide-n3`,
              ownerUserId: userId,
              activityLegacyId: TEST_ACTIVITY_LEGACY_ID,
              form: {
                departure: '上海',
                headcount: 3,
                budgetTier: 'comfort',
              },
              plan: { sections: [] },
              expiresAt: new Date(Date.now() + 7 * 86_400_000),
            },
          },
          { upsert: true },
        );
      },
      async (notifications) => {
        assertRule(notifications, 'N3', {
          bodyIncludes: '攻略条件',
          prefillIncludes: '上海出发',
          focusPosts: true,
        });
      },
    );

    await runScenario(
      db,
      activityLookup,
      nudgeService,
      'N4',
      async () => {
        const userId = `${SMOKE_PREFIX}-n4`;
        await db.collection('notifications').deleteMany({ userId });
        await db.collection('posts').deleteMany({
          userId: `${SMOKE_PREFIX}-post-author`,
        });
        await upsertRegistration(db, userId);
        await activityCol.updateOne(
          { legacyId: TEST_ACTIVITY_LEGACY_ID },
          { $unset: { lineupAnnouncedAt: '' } },
        );
        await seedN4Posts(db, 5);
      },
      async (notifications) => {
        assertRule(notifications, 'N4', {
          bodyIncludes: '招募很活跃',
          focusPosts: true,
        });
        assertRule(notifications, 'N1', { openBuddyPost: true });
      },
    );

    console.log('\n✅ All proactive nudge smoke scenarios passed (N1–N4)');
  } finally {
    const restoreUpdate = {
      $set: {
        date: restoreActivity.date,
        name: restoreActivity.name,
      },
    };
    if (restoreActivity.lineupAnnouncedAt) {
      restoreUpdate.$set.lineupAnnouncedAt = restoreActivity.lineupAnnouncedAt;
    } else {
      restoreUpdate.$unset = { lineupAnnouncedAt: '' };
    }
    await activityCol.updateOne(
      { legacyId: TEST_ACTIVITY_LEGACY_ID },
      restoreUpdate,
    );
    await clearSmokeData(db);
    await activityLookup.refreshCache();
    await app.close();
  }
}

main().catch((error) => {
  console.error('\n❌ Proactive nudge smoke failed:', error?.message ?? error);
  process.exit(1);
});
