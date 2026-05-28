/**
 * Parse Damai-style search API payloads into activity catalog rows.
 */

const DAMAI_DETAIL_URL = 'https://detail.damai.cn/item.htm?id=';

/** Project IDs excluded from import (user-requested removals). */
const DAMAI_BLOCKED_PROJECT_IDS = new Set([
  1054171884343, // 潮起东方电音节廊坊站
]);

/** Curated participant counts for Damai imports (homepage cards). */
const DAMAI_ATTENDEE_OVERRIDES = new Map([
  [1045457803269, 128], // GUAN电音节
]);

function resolveDamaiAttendees(projectid) {
  return DAMAI_ATTENDEE_OVERRIDES.get(projectid) ?? 0;
}

/** Name substrings that exclude an item from import. */
const DAMAI_BLOCKED_NAME_PATTERNS = [/潮起东方/];

function normalizeDamaiShowtime(showtime) {
  const trimmed = String(showtime ?? '').trim();
  if (!trimmed) return undefined;

  const crossMonth = trimmed.match(
    /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})$/,
  );
  if (crossMonth) {
    const startMonth = crossMonth[2];
    const startDay = crossMonth[3];
    const endMonth = crossMonth[4];
    const endDay = crossMonth[5];
    if (startMonth === endMonth) {
      return `${startMonth}/${startDay}-${endDay}`;
    }
    return `${startMonth}/${startDay}-${endMonth}/${endDay}`;
  }

  const sameMonth = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})$/);
  if (sameMonth) {
    const month = sameMonth[2];
    const startDay = sameMonth[3];
    const endDay = sameMonth[4];
    return `${month}/${startDay}-${endDay}`;
  }

  return trimmed;
}

function formatDamaiLocation(venue, cityname) {
  const v = String(venue ?? '').trim();
  const c = String(cityname ?? '').trim();
  if (v && c) return `${v}（${c}）`;
  return v || c || '';
}

function damaiDetailUrl(projectid) {
  return `${DAMAI_DETAIL_URL}${projectid}`;
}

/**
 * Damai sometimes nests a full CDN URL under /bao/uploaded/.
 * e.g. https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/...
 */
function normalizeDamaiVerticalPicUrl(verticalPic) {
  const trimmed = String(verticalPic ?? '').trim();
  if (!trimmed) return undefined;

  const nested = trimmed.match(
    /^https?:\/\/img\.alicdn\.com\/bao\/uploaded\/(https?:\/\/.+)$/i,
  );
  if (nested) {
    return nested[1].trim() || undefined;
  }

  return trimmed;
}

function damaiNameMatchesKeyword(name, keyword = '电音节') {
  return String(name ?? '').includes(keyword);
}

function isDamaiItemBlocked(item) {
  const projectid = item?.projectid;
  if (projectid != null && DAMAI_BLOCKED_PROJECT_IDS.has(Number(projectid))) {
    return true;
  }
  const name = String(item?.name ?? item?.nameNoHtml ?? '');
  return DAMAI_BLOCKED_NAME_PATTERNS.some((re) => re.test(name));
}

function damaiBlockReason(item) {
  const projectid = item?.projectid;
  if (projectid != null && DAMAI_BLOCKED_PROJECT_IDS.has(Number(projectid))) {
    return `blocked projectid ${projectid}`;
  }
  const name = String(item?.name ?? item?.nameNoHtml ?? '').trim();
  const pattern = DAMAI_BLOCKED_NAME_PATTERNS.find((re) => re.test(name));
  if (pattern) {
    return `blocked name pattern ${pattern}`;
  }
  return 'blocked';
}

function resolveDamaiActivityCode(item) {
  const name = String(item.name ?? '');
  const projectid = item.projectid;

  if (
    projectid === 1048730418844 ||
    (/风暴|口味王/.test(name) && /深圳/.test(name))
  ) {
    return 'storm';
  }

  return `damai-${projectid}`;
}

function buildDamaiAliases(item) {
  const aliases = new Set();
  const push = (value) => {
    const v = String(value ?? '').trim();
    if (v) aliases.add(v);
  };

  push(item.nameNoHtml);
  push(item.cityname);
  push(`damai:${item.projectid}`);
  push(damaiDetailUrl(item.projectid));

  const name = String(item.name ?? '');
  if (name.includes('电音节')) {
    push('电音节');
    const short = name.replace(/\d{4}/, '').trim();
    if (short && short !== name) push(short);
  }

  return [...aliases];
}

function parseDamaiSearchPayload(payload, options = {}) {
  const keyword = options.keyword ?? payload.keyword ?? '电音节';
  const resultData = Array.isArray(payload?.pageData?.resultData)
    ? payload.pageData.resultData
    : [];

  const items = [];
  const skipped = [];

  for (const raw of resultData) {
    const name = String(raw.name ?? raw.nameNoHtml ?? '').trim();
    if (isDamaiItemBlocked(raw)) {
      skipped.push({
        name: name || '(unnamed)',
        reason: damaiBlockReason(raw),
      });
      continue;
    }
    if (!damaiNameMatchesKeyword(name, keyword)) {
      skipped.push({
        name: name || '(unnamed)',
        reason: `name does not contain "${keyword}"`,
      });
      continue;
    }

    const projectid = raw.projectid;
    const code = resolveDamaiActivityCode({ name, projectid });
    const legacyId = code === 'storm' ? 4 : Number(projectid);

    items.push({
      legacyId,
      code,
      name,
      alias: buildDamaiAliases(raw),
      date: normalizeDamaiShowtime(raw.showtime),
      location: formatDamaiLocation(raw.venue, raw.cityname),
      image: normalizeDamaiVerticalPicUrl(raw.verticalPic),
      hot: false,
      attendees: resolveDamaiAttendees(projectid),
      damaiProjectId: String(projectid),
      externalUrl: damaiDetailUrl(projectid),
      _meta: {
        cityname: raw.cityname,
        venue: raw.venue,
        showtime: raw.showtime,
        showstatus: raw.showstatus,
        price_str: raw.price_str,
      },
    });
  }

  return { items, skipped };
}

module.exports = {
  normalizeDamaiVerticalPicUrl,
  normalizeDamaiShowtime,
  formatDamaiLocation,
  damaiDetailUrl,
  damaiNameMatchesKeyword,
  isDamaiItemBlocked,
  damaiBlockReason,
  resolveDamaiActivityCode,
  resolveDamaiAttendees,
  buildDamaiAliases,
  parseDamaiSearchPayload,
};
