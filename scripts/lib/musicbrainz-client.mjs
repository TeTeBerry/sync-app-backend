/**
 * Minimal MusicBrainz WS/2 client (rate-limited).
 * https://musicbrainz.org/doc/MusicBrainz_API
 */

const DEFAULT_BASE_URL = 'https://musicbrainz.org/ws/2';
const DEFAULT_MIN_INTERVAL_MS = 1100;
const DEFAULT_MAX_RETRIES = 5;

function isRetryableMbStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export { isRetryableMbStatus };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeLucene(value) {
  return value.replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1');
}

export function normalizeMbNameKey(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function lineupNameMatchesMbArtist(lineupName, artist) {
  const target = normalizeMbNameKey(lineupName);
  if (!target) {
    return false;
  }

  const candidates = [
    artist.name,
    artist['sort-name'],
    ...(artist.aliases ?? []).map((row) => row.name),
  ].filter(Boolean);

  return candidates.some((name) => {
    const key = normalizeMbNameKey(name);
    return key === target || key.includes(target) || target.includes(key);
  });
}

export function extractDiscogsUrlFromArtist(artist) {
  for (const rel of artist.relations ?? []) {
    const url = rel.url?.resource?.trim();
    if (url && /discogs\.com\/artist\//i.test(url)) {
      return url;
    }
  }
  return '';
}

/** Parse numeric Discogs artist id from MB url-relation or any discogs artist URL. */
export function parseDiscogsIdFromUrl(url) {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/discogs\.com\/artist\/(\d+)/i);
  if (!match) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function createMusicBrainzClient(options = {}) {
  const baseUrl = options.baseUrl?.trim() || DEFAULT_BASE_URL;
  const userAgent =
    options.userAgent?.trim() ||
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    process.env.MUSICBRAINZ_CONTACT?.trim() ||
    'sync-app-backend/1.0 (hermes lineup lookup; contact: hermes@sync.local)';
  const minIntervalMs = Math.max(
    500,
    Number(options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS) || DEFAULT_MIN_INTERVAL_MS,
  );
  const maxRetries = Math.max(
    0,
    Number(options.maxRetries ?? DEFAULT_MAX_RETRIES) || DEFAULT_MAX_RETRIES,
  );

  let lastRequestAt = 0;

  async function throttle() {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }
    lastRequestAt = Date.now();
  }

  async function fetchJson(path, params = {}, attempt = 0) {
    await throttle();
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set('fmt', 'json');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (isRetryableMbStatus(response.status) && attempt < maxRetries) {
        const waitMs = minIntervalMs * (attempt + 2);
        console.warn(
          `MusicBrainz ${response.status}，${waitMs}ms 后重试 (${attempt + 1}/${maxRetries}): ${path}`,
        );
        await sleep(waitMs);
        return fetchJson(path, params, attempt + 1);
      }
      const body = await response.text().catch(() => '');
      throw new Error(
        `MusicBrainz ${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
      );
    }

    return response.json();
  }

  return {
    async searchArtists(query, { limit = 5 } = {}) {
      return fetchJson('/artist', {
        query,
        limit,
      });
    },

    async lookupArtist(mbid, { inc = 'aliases+tags+url-rels' } = {}) {
      return fetchJson(`/artist/${mbid}`, { inc });
    },

    buildArtistQuery(lineupName) {
      const escaped = escapeLucene(lineupName.trim());
      return `artist:"${escaped}" OR alias:"${escaped}"`;
    },
  };
}
