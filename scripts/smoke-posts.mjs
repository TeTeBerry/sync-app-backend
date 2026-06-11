#!/usr/bin/env node
/**
 * Post business smoke — create / list / like / comment / apply / update / delete.
 * Requires running backend (default http://localhost:3000/api).
 */

const baseUrl = (process.env.SMOKE_API_BASE || 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);
const activityId = Number(process.env.SMOKE_ACTIVITY_ID || 4);
const ownerId = process.env.SMOKE_OWNER_ID || `post-smoke-owner-${Date.now()}`;
const ownerName = process.env.SMOKE_OWNER_NAME || 'PostSmokeOwner';
const applicantId = process.env.SMOKE_APPLICANT_ID || `post-smoke-applicant-${Date.now()}`;
const applicantName = process.env.SMOKE_APPLICANT_NAME || 'PostSmokeApplicant';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30_000);

/** @type {{ name: string, run: (ctx: Record<string, unknown>) => Promise<void> }[]} */
const steps = [];

function ownerQuery(userId, authorName) {
  return new URLSearchParams({ userId, authorName }).toString();
}

async function request(method, path, { body, userId, authorName, expectStatus } = {}) {
  const q = userId && authorName ? `?${ownerQuery(userId, authorName)}` : '';
  const url = `${baseUrl}/${path.replace(/^\//, '')}${q}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (expectStatus != null) {
      if (res.status !== expectStatus) {
        throw new Error(`${method} ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      return json?.data ?? json;
    }
    if (!res.ok) {
      throw new Error(`${method} ${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    if (json?.code != null && json.code !== 200) {
      throw new Error(`${method} ${url} → code ${json.code}: ${json.message ?? ''}`);
    }
    return json?.data ?? json;
  } finally {
    clearTimeout(timer);
  }
}

function step(name, run) {
  steps.push({ name, run });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

step('POST /posts (create)', async (ctx) => {
  const data = await request('POST', 'posts', {
    userId: ownerId,
    authorName: ownerName,
    body: {
      body: `smoke test post ${Date.now()}`,
      activityLegacyId: activityId,
    },
  });
  assert(data?.id, 'create should return post id');
  ctx.postId = data.id;
});

step('GET /posts?activityLegacyId (list)', async (ctx) => {
  const data = await request('GET', `posts?activityLegacyId=${activityId}&limit=20`, {
    userId: ownerId,
    authorName: ownerName,
  });
  const items = data?.items ?? [];
  assert(Array.isArray(items), 'items should be array');
  assert(items.some((p) => p.id === ctx.postId), 'created post should appear in activity feed');
});

step('GET /posts/popular (home feed)', async (ctx) => {
  const data = await request('GET', 'posts/popular?limit=20', {
    userId: ownerId,
    authorName: ownerName,
  });
  assert(Array.isArray(data), 'popular posts should be array');
});

step('GET /profile/posts (owner)', async (ctx) => {
  const data = await request('GET', 'profile/posts', {
    userId: ownerId,
    authorName: ownerName,
  });
  assert(Array.isArray(data), 'profile posts should be array');
  assert(data.some((p) => p.id === ctx.postId), 'created post in profile list');
});

step('POST /posts/:id/like (toggle on)', async (ctx) => {
  const data = await request('POST', `posts/${ctx.postId}/like`, {
    userId: applicantId,
    authorName: applicantName,
  });
  assert(data?.liked === true, 'like should set liked=true');
});

step('POST /posts/:id/like (toggle off)', async (ctx) => {
  const data = await request('POST', `posts/${ctx.postId}/like`, {
    userId: applicantId,
    authorName: applicantName,
  });
  assert(data?.liked === false, 'second like should unlike');
});

step('POST /posts/:id/comments', async (ctx) => {
  const data = await request('POST', `posts/${ctx.postId}/comments`, {
    userId: applicantId,
    authorName: applicantName,
    body: { body: '想一起组队！' },
  });
  assert(data?.id === ctx.postId, 'comment should return updated post');
});

step('GET /posts/:id/comments', async (ctx) => {
  const data = await request('GET', `posts/${ctx.postId}/comments`);
  assert(Array.isArray(data) && data.length > 0, 'comments list non-empty');
  ctx.commentId = data[0]?.id;
});

step('POST /posts/:id/applications', async (ctx) => {
  const data = await request('POST', `posts/${ctx.postId}/applications`, {
    userId: applicantId,
    authorName: applicantName,
  });
  assert(data?.ok === true, 'apply should return ok');
});

step('POST /posts/:id/applications (duplicate)', async (ctx) => {
  const data = await request('POST', `posts/${ctx.postId}/applications`, {
    userId: applicantId,
    authorName: applicantName,
  });
  assert(data?.alreadyApplied === true, 'duplicate apply should be idempotent');
});

step('POST /posts/:id/applications (own post → 400)', async (ctx) => {
  await request('POST', `posts/${ctx.postId}/applications`, {
    userId: ownerId,
    authorName: ownerName,
    expectStatus: 400,
  });
});

step('POST /posts/:id/applications/:userId/accept', async (ctx) => {
  const data = await request(
    'POST',
    `posts/${ctx.postId}/applications/${encodeURIComponent(applicantId)}/accept`,
    { userId: ownerId, authorName: ownerName },
  );
  assert(data?.ok === true, 'accept should return ok');
});

step('PATCH /posts/:id (mark completed)', async (ctx) => {
  const data = await request('PATCH', `posts/${ctx.postId}`, {
    userId: ownerId,
    authorName: ownerName,
    body: { status: 'completed' },
  });
  assert(data?.status === '已组队' || data?.status === 'completed', 'status should be completed');
});

step('DELETE /posts/:id (cleanup)', async (ctx) => {
  const data = await request('DELETE', `posts/${ctx.postId}`, {
    userId: ownerId,
    authorName: ownerName,
  });
  assert(data?.ok === true, 'delete should return ok');
});

step('GET /profile/posts (after delete)', async (ctx) => {
  const data = await request('GET', 'profile/posts', {
    userId: ownerId,
    authorName: ownerName,
  });
  assert(!data.some((p) => p.id === ctx.postId), 'deleted post should not appear');
});

async function main() {
  const ctx = {};
  console.log(`\n📝 Post smoke — ${baseUrl} activity=${activityId}\n`);
  let passed = 0;
  for (const { name, run } of steps) {
    process.stdout.write(`  • ${name} … `);
    try {
      await run(ctx);
      console.log('OK');
      passed += 1;
    } catch (err) {
      console.log('FAIL');
      console.error(`    ${err instanceof Error ? err.message : err}`);
      console.log(`\n❌ ${passed}/${steps.length} passed\n`);
      process.exit(1);
    }
  }
  console.log(`\n✅ ${passed}/${steps.length} passed\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
