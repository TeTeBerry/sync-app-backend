import { ProfileService } from '../../modules/profile/profile.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { PINDAN_TYPE_LABEL } from '../../common/constants/pindan-labels';

export { PINDAN_TYPE_LABEL };

export type ReplyPindanRow = {
  legacyId?: number;
  title?: string;
  type?: string;
  date?: string;
  location?: string;
  price?: number;
  joined?: number;
  total?: number;
  activityId?: string;
  userJoined?: boolean;
  isOwner?: boolean;
};

/** 用户可加入的拼单（不含本人已发起/已加入） */
export function getJoinablePindanRows(rows: ReplyPindanRow[]): ReplyPindanRow[] {
  return rows.filter(row => !row.userJoined && isPindanOpen(row));
}

/** 活动下仍进行中的拼单（含本人发起/已加入，用于浏览与计数） */
export function getBrowsePindanRows(rows: ReplyPindanRow[]): ReplyPindanRow[] {
  return rows.filter(row => row.userJoined || isPindanOpen(row));
}

export function pickBrowseCardRow(
  rows: ReplyPindanRow[],
): ReplyPindanRow | undefined {
  return getJoinablePindanRows(rows)[0] ?? getBrowsePindanRows(rows)[0];
}

export function isPindanOpen(row: {
  joined?: number;
  total?: number;
}): boolean {
  const joined = row.joined ?? 0;
  const total = row.total ?? 4;
  return joined < total;
}

function mapPindanDoc(
  doc: {
    legacyId?: number;
    title?: string;
    type?: string;
    date?: string;
    location?: string;
    price?: number;
    joined?: number;
    total?: number;
    activityId?: string;
  },
  userJoined = false,
  isOwner = false,
): ReplyPindanRow {
  return {
    legacyId: doc.legacyId,
    title: doc.title,
    type: doc.type,
    date: doc.date,
    location: doc.location,
    price: doc.price,
    joined: doc.joined,
    total: doc.total,
    activityId: doc.activityId,
    userJoined,
    isOwner,
  };
}

/** 仅返回正在拼的订单；用户已加入的拼单始终保留（含已满员） */
export async function loadPindanRowsForReply(
  candidateRows: ReplyPindanRow[],
  services: {
    pindanService: PindanService;
    profileService: ProfileService;
  },
  userId?: string,
): Promise<ReplyPindanRow[]> {
  const myPindan = await services.profileService.listMyPindan(userId);
  const joinedIds = new Set(myPindan.map(item => item.id));
  const ownerIds = new Set(
    myPindan.filter(item => item.isOwner).map(item => item.id),
  );
  const rowsMap = new Map<number, ReplyPindanRow>();

  for (const row of candidateRows) {
    if (row.legacyId == null) continue;
    const legacyId = row.legacyId;
    rowsMap.set(legacyId, {
      ...row,
      userJoined: joinedIds.has(legacyId),
      isOwner: ownerIds.has(legacyId),
    });
  }

  for (const legacyId of joinedIds) {
    if (rowsMap.has(legacyId)) {
      const mapped = rowsMap.get(legacyId);
      if (mapped) {
        mapped.userJoined = true;
        mapped.isOwner = ownerIds.has(legacyId);
      }
      continue;
    }

    const pindan = await services.pindanService.findByLegacyId(legacyId);
    if (pindan?.legacyId != null) {
      rowsMap.set(
        legacyId,
        mapPindanDoc(pindan, true, ownerIds.has(legacyId)),
      );
      continue;
    }

    const profile = myPindan.find(item => item.id === legacyId);
    if (profile) {
      rowsMap.set(legacyId, {
        legacyId: profile.id,
        title: profile.title,
        type: profile.category,
        date: profile.date,
        location: profile.location,
        price: profile.price,
        userJoined: true,
        isOwner: profile.isOwner,
      });
    }
  }

  const userJoinedRows: ReplyPindanRow[] = [];
  const openRows: ReplyPindanRow[] = [];

  for (const row of rowsMap.values()) {
    if (row.userJoined) {
      userJoinedRows.push(row);
      continue;
    }
    if (isPindanOpen(row)) {
      openRows.push(row);
    }
  }

  const byLegacyId = (a: ReplyPindanRow, b: ReplyPindanRow) =>
    (a.legacyId ?? 0) - (b.legacyId ?? 0);

  userJoinedRows.sort(byLegacyId);
  openRows.sort(byLegacyId);

  return [...userJoinedRows, ...openRows];
}

export function formatPindanLines(
  rows: ReplyPindanRow[],
  limit = 5,
  emptyText = '暂无正在拼单的订单，你可以告诉我活动和时间，我帮你留意。',
): string {
  if (!rows.length) {
    return emptyText;
  }

  return rows
    .slice(0, limit)
    .map((row, index) => {
      const label = PINDAN_TYPE_LABEL[row.type ?? ''] ?? '拼单';
      const spots = row.userJoined
        ? '，已加入'
        : row.total != null && row.joined != null
          ? `，还差 ${Math.max(0, row.total - row.joined)} 人`
          : '';
      const price = row.price != null ? ` · ¥${row.price}/人` : '';
      const meta = [row.date, row.location].filter(Boolean).join(' · ');
      return `${index + 1}. 【${label}】${row.title ?? '拼单'}${meta ? `（${meta}）` : ''}${price}${spots}`;
    })
    .join('\n');
}

export function buildPindanIntro(
  rows: ReplyPindanRow[],
  scopeLabel: string,
): string {
  const joinedCount = rows.filter(row => row.userJoined).length;
  const browseCount = getBrowsePindanRows(rows).length;
  const joinableCount = getJoinablePindanRows(rows).length;

  if (!rows.length) {
    return `【${scopeLabel} 相关拼单】`;
  }

  const parts: string[] = [];
  if (browseCount) parts.push(`进行中 ${browseCount} 条`);
  if (joinableCount) parts.push(`可加入 ${joinableCount} 条`);
  else if (joinedCount) parts.push(`你已加入 ${joinedCount} 条`);

  return `【${scopeLabel} 相关拼单】${parts.length ? ` · ${parts.join(' · ')}` : ''}`;
}
