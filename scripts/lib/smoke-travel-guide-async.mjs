import { assert } from './smoke-http.mjs';

const DEFAULT_POLL_MS = 2_000;
const DEFAULT_POLL_TIMEOUT_MS = 90_000;

/**
 * POST generate-async then poll until completed or failed.
 *
 * @param {{ request: Function }} http
 * @param {number} activityLegacyId
 * @param {string} bearerToken
 * @param {{ departure?: string, headcount?: number, pollMs?: number, pollTimeoutMs?: number }} [opts]
 */
export async function smokeTravelGuideGenerateAsync(
  http,
  activityLegacyId,
  bearerToken,
  opts = {},
) {
  const departure = opts.departure ?? '广州';
  const headcount = opts.headcount ?? 2;
  const accommodationNights = opts.accommodationNights ?? 0;
  const pollMs = opts.pollMs ?? Number(process.env.SMOKE_TG_POLL_MS || DEFAULT_POLL_MS);
  const pollTimeoutMs =
    opts.pollTimeoutMs ??
    Number(process.env.SMOKE_TG_POLL_TIMEOUT_MS || DEFAULT_POLL_TIMEOUT_MS);

  const authHeaders = { Authorization: `Bearer ${bearerToken}` };

  const enqueue = await http.request(
    'POST',
    `activities/${activityLegacyId}/travel-guide/generate-async`,
    {
      headers: authHeaders,
      body: { departure, headcount, budgetTier: 'standard', accommodationNights },
    },
  );

  const jobId = enqueue?.jobId;
  assert(typeof jobId === 'string' && jobId.length > 0, 'generate-async should return jobId');

  const deadline = Date.now() + pollTimeoutMs;
  let lastStatus = 'pending';

  while (Date.now() < deadline) {
    const job = await http.request('GET', `travel-guide/generation-jobs/${jobId}`, {
      headers: authHeaders,
    });

    lastStatus = job?.status ?? 'unknown';

    if (lastStatus === 'completed') {
      assert(job?.plan != null, 'completed job should include plan');
      return job;
    }

    if (lastStatus === 'failed') {
      throw new Error(
        `travel guide job failed: ${job?.errorMessage ?? 'unknown error'}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    `travel guide job poll timeout (${pollTimeoutMs}ms), last status=${lastStatus}`,
  );
}
