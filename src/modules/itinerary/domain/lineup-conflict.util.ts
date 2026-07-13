export type ClashPerformance = {
  artistId: string;
  artistName: string;
  dateKey: string;
  stage?: string;
  stageLabel: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
};

export type LineupConflictType =
  | 'hard-clash'
  | 'partial-clash'
  | 'tight-transfer'
  | 'schedule-pending';

export type ClashSeverity = 'low' | 'medium' | 'high';

export type ClashResolutionOptionType =
  | 'keep-artist-a'
  | 'keep-artist-b'
  | 'split-both'
  | 'decide-later';

export type ClashResolutionOption = {
  id: string;
  type: ClashResolutionOptionType;
  labelKey: ClashResolutionOptionType;
  itineraryImpact: Array<{
    artistId: string;
    watchFrom?: string;
    watchUntil?: string;
    missedMinutes?: number;
  }>;
  transferPlan?: {
    fromStage: string;
    toStage: string;
    estimatedMinutes: number;
  };
  warnings: string[];
};

export type LineupConflict = {
  id: string;
  type: LineupConflictType;
  artistAId: string;
  artistBId: string;
  artistAName: string;
  artistBName: string;
  eventDate?: string;
  overlapMinutes?: number;
  transferMinutes?: number;
  availableTransferMinutes?: number;
  stageA?: string;
  stageB?: string;
  startA?: string;
  endA?: string;
  startB?: string;
  endB?: string;
  startMinutesA?: number;
  endMinutesA?: number;
  startMinutesB?: number;
  endMinutesB?: number;
  severity: ClashSeverity;
  reasonKeys: string[];
  resolutionOptions: ClashResolutionOption[];
  suggestedOptionId?: string;
};

export type ArtistScheduleStatus =
  | 'fits-route'
  | 'partial-clash'
  | 'hard-clash'
  | 'tight-transfer'
  | 'schedule-pending'
  | 'not-selected';

/** Default walking minutes when stages differ and no venue matrix exists. */
export const DEFAULT_CROSS_STAGE_TRANSFER_MINUTES = 12;
export const SAME_STAGE_TRANSFER_MINUTES = 2;
/** Extra buffer beyond estimated walk. */
export const TRANSFER_SAFETY_BUFFER_MINUTES = 3;
/** Overlap ratio of shorter set that counts as hard clash. */
export const HARD_CLASH_OVERLAP_RATIO = 0.5;
export const HARD_CLASH_OVERLAP_MINUTES = 30;
/** Remaining watch window too short for a meaningful Split Both. */
export const MIN_MEANINGFUL_WATCH_MINUTES = 15;

export function artistIdFromSelection(raw: string): string {
  return raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw;
}

export function normalizeSelectionArtistIds(ids: string[]): string[] {
  return [...new Set(ids.map(artistIdFromSelection).filter(Boolean))];
}

export function toClashPerformances(
  performances: Array<{
    artistId: string;
    artistName: string;
    dateKey: string;
    stage?: string;
    stageLabel?: string;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
  }>,
): ClashPerformance[] {
  return performances
    .filter(
      (perf) =>
        Boolean(perf.artistId) &&
        typeof perf.startMinutes === 'number' &&
        perf.startMinutes >= 0 &&
        typeof perf.endMinutes === 'number' &&
        perf.endMinutes > perf.startMinutes,
    )
    .map((perf) => ({
      artistId: perf.artistId,
      artistName: perf.artistName,
      dateKey: perf.dateKey,
      stage: perf.stage,
      stageLabel: perf.stageLabel || perf.stage || '',
      startTime: perf.startTime,
      endTime: perf.endTime,
      startMinutes: perf.startMinutes,
      endMinutes: perf.endMinutes,
    }));
}

/**
 * Estimate stage transfer minutes.
 * Prefer stage-pair overrides when provided; otherwise same-stage vs cross-stage defaults.
 * Never assumes zero transfer between different stages.
 */
export function estimateTransferMinutes(
  stageA: string,
  stageB: string,
  stagePairMinutes?: Record<string, number>,
  defaultTransferMinutes: number = DEFAULT_CROSS_STAGE_TRANSFER_MINUTES,
): number {
  const left = stageA.trim().toLowerCase();
  const right = stageB.trim().toLowerCase();
  if (!left || !right) return defaultTransferMinutes;
  if (left === right) return SAME_STAGE_TRANSFER_MINUTES;
  if (stagePairMinutes) {
    const key = `${left}->${right}`;
    const reverse = `${right}->${left}`;
    if (typeof stagePairMinutes[key] === 'number')
      return stagePairMinutes[key]!;
    if (typeof stagePairMinutes[reverse] === 'number') {
      return stagePairMinutes[reverse]!;
    }
  }
  return defaultTransferMinutes;
}

export function computeScheduleVersion(
  performances: Array<{
    artistId: string;
    dateKey: string;
    startMinutes: number;
    endMinutes: number;
    stage?: string;
    stageLabel?: string;
  }>,
  schedulePublished: boolean,
): string {
  const fingerprint = performances
    .map(
      (p) =>
        `${p.dateKey}|${p.artistId}|${p.startMinutes}|${p.endMinutes}|${p.stage ?? p.stageLabel ?? ''}`,
    )
    .sort()
    .join(';');
  // Simple stable hash for versioning / stale detection
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i += 1) {
    hash = (hash * 31 + fingerprint.charCodeAt(i)) | 0;
  }
  return `sch:${schedulePublished ? 1 : 0}:${performances.length}:${hash >>> 0}`;
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function overlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function conflictId(
  type: LineupConflictType,
  dateKey: string,
  a: string,
  b: string,
): string {
  const [left, right] = [a, b].sort();
  return `${type}:${dateKey}:${left}:${right}`;
}

function pickPrimarySlot(
  slots: ClashPerformance[],
): ClashPerformance | undefined {
  return [...slots].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  )[0];
}

function buildSplitOption(
  earlier: ClashPerformance,
  later: ClashPerformance,
  transferMinutes: number,
): ClashResolutionOption | null {
  const available = later.startMinutes - earlier.endMinutes;
  if (available >= 0) {
    // Sequential — split is leave at end of first / arrive for second.
    if (available < transferMinutes) return null;
    return {
      id: `split:${earlier.artistId}:${later.artistId}`,
      type: 'split-both',
      labelKey: 'split-both',
      itineraryImpact: [
        {
          artistId: earlier.artistId,
          watchFrom: earlier.startTime,
          watchUntil: earlier.endTime,
          missedMinutes: 0,
        },
        {
          artistId: later.artistId,
          watchFrom: later.startTime,
          watchUntil: later.endTime,
          missedMinutes: 0,
        },
      ],
      transferPlan: {
        fromStage: earlier.stageLabel,
        toStage: later.stageLabel,
        estimatedMinutes: transferMinutes,
      },
      warnings:
        available < transferMinutes + TRANSFER_SAFETY_BUFFER_MINUTES
          ? ['tight-after-split']
          : [],
    };
  }

  // Overlapping — leave earlier set early enough to transfer.
  const leaveAt = later.startMinutes - transferMinutes;
  const watchUntilEarlier = Math.min(earlier.endMinutes, leaveAt);
  const watchedEarlier = watchUntilEarlier - earlier.startMinutes;
  const missedEarlier = earlier.endMinutes - watchUntilEarlier;
  const watchedLater = later.endMinutes - later.startMinutes;

  if (
    watchedEarlier < MIN_MEANINGFUL_WATCH_MINUTES ||
    watchedLater < MIN_MEANINGFUL_WATCH_MINUTES ||
    leaveAt <= earlier.startMinutes
  ) {
    return null;
  }

  return {
    id: `split:${earlier.artistId}:${later.artistId}`,
    type: 'split-both',
    labelKey: 'split-both',
    itineraryImpact: [
      {
        artistId: earlier.artistId,
        watchFrom: earlier.startTime,
        watchUntil: formatMinutesAsTime(watchUntilEarlier),
        missedMinutes: Math.max(0, missedEarlier),
      },
      {
        artistId: later.artistId,
        watchFrom: later.startTime,
        watchUntil: later.endTime,
        missedMinutes: 0,
      },
    ],
    transferPlan: {
      fromStage: earlier.stageLabel,
      toStage: later.stageLabel,
      estimatedMinutes: transferMinutes,
    },
    warnings: missedEarlier >= HARD_CLASH_OVERLAP_MINUTES ? ['heavy-miss'] : [],
  };
}

function resolutionOptionsForPair(
  a: ClashPerformance,
  b: ClashPerformance,
  type: LineupConflictType,
  stagePairMinutes?: Record<string, number>,
  defaultTransferMinutes?: number,
): ClashResolutionOption[] {
  const options: ClashResolutionOption[] = [
    {
      id: `keep-a:${a.artistId}:${b.artistId}`,
      type: 'keep-artist-a',
      labelKey: 'keep-artist-a',
      itineraryImpact: [
        { artistId: a.artistId },
        { artistId: b.artistId, missedMinutes: b.endMinutes - b.startMinutes },
      ],
      warnings: [],
    },
    {
      id: `keep-b:${a.artistId}:${b.artistId}`,
      type: 'keep-artist-b',
      labelKey: 'keep-artist-b',
      itineraryImpact: [
        { artistId: b.artistId },
        { artistId: a.artistId, missedMinutes: a.endMinutes - a.startMinutes },
      ],
      warnings: [],
    },
    {
      id: `later:${a.artistId}:${b.artistId}`,
      type: 'decide-later',
      labelKey: 'decide-later',
      itineraryImpact: [],
      warnings: ['deferred'],
    },
  ];

  if (type === 'schedule-pending') {
    return options.filter(
      (opt) => opt.type === 'decide-later' || opt.type.startsWith('keep'),
    );
  }

  const earlier = a.startMinutes <= b.startMinutes ? a : b;
  const later = earlier === a ? b : a;
  const transfer = estimateTransferMinutes(
    earlier.stageLabel,
    later.stageLabel,
    stagePairMinutes,
    defaultTransferMinutes,
  );
  const split = buildSplitOption(earlier, later, transfer);
  if (split && type !== 'hard-clash') {
    options.splice(2, 0, split);
  } else if (split && type === 'hard-clash') {
    // Only offer split on hard clash when enough meaningful watch remains.
    const impacts = split.itineraryImpact;
    const ok = impacts.every(
      (item) =>
        item.missedMinutes == null ||
        (item.watchFrom &&
          item.watchUntil &&
          (item.missedMinutes ?? 0) < HARD_CLASH_OVERLAP_MINUTES + 10),
    );
    if (ok) options.splice(2, 0, split);
  }

  return options;
}

function classifyOverlap(
  a: ClashPerformance,
  b: ClashPerformance,
  stagePairMinutes?: Record<string, number>,
  defaultTransferMinutes?: number,
): Omit<LineupConflict, 'resolutionOptions' | 'suggestedOptionId'> | null {
  const overlap = overlapMinutes(
    a.startMinutes,
    a.endMinutes,
    b.startMinutes,
    b.endMinutes,
  );
  const shorter = Math.min(
    a.endMinutes - a.startMinutes,
    b.endMinutes - b.startMinutes,
  );
  const transfer = estimateTransferMinutes(
    a.stageLabel,
    b.stageLabel,
    stagePairMinutes,
    defaultTransferMinutes,
  );
  const required = transfer + TRANSFER_SAFETY_BUFFER_MINUTES;

  if (overlap > 0) {
    const hard =
      overlap >= HARD_CLASH_OVERLAP_MINUTES ||
      (shorter > 0 && overlap / shorter >= HARD_CLASH_OVERLAP_RATIO);
    const type: LineupConflictType = hard ? 'hard-clash' : 'partial-clash';
    return {
      id: conflictId(type, a.dateKey, a.artistId, b.artistId),
      type,
      artistAId: a.artistId,
      artistBId: b.artistId,
      artistAName: a.artistName,
      artistBName: b.artistName,
      eventDate: a.dateKey,
      overlapMinutes: overlap,
      stageA: a.stageLabel,
      stageB: b.stageLabel,
      startA: a.startTime,
      endA: a.endTime,
      startB: b.startTime,
      endB: b.endTime,
      startMinutesA: a.startMinutes,
      endMinutesA: a.endMinutes,
      startMinutesB: b.startMinutes,
      endMinutesB: b.endMinutes,
      transferMinutes: transfer,
      severity: hard ? 'high' : 'medium',
      reasonKeys: hard
        ? ['substantial-overlap', 'cannot-attend-both']
        : ['partial-overlap', 'may-split'],
    };
  }

  // Sequential on same day — check transfer feasibility.
  const earlier = a.startMinutes <= b.startMinutes ? a : b;
  const later = earlier === a ? b : a;
  const gap = later.startMinutes - earlier.endMinutes;
  if (gap < 0) return null;
  if (gap < required) {
    return {
      id: conflictId('tight-transfer', a.dateKey, a.artistId, b.artistId),
      type: 'tight-transfer',
      artistAId: a.artistId,
      artistBId: b.artistId,
      artistAName: a.artistName,
      artistBName: b.artistName,
      eventDate: a.dateKey,
      transferMinutes: transfer,
      availableTransferMinutes: gap,
      stageA: earlier.stageLabel,
      stageB: later.stageLabel,
      startA: earlier.startTime,
      endA: earlier.endTime,
      startB: later.startTime,
      endB: later.endTime,
      startMinutesA: earlier.startMinutes,
      endMinutesA: earlier.endMinutes,
      startMinutesB: later.startMinutes,
      endMinutesB: later.endMinutes,
      severity: gap < transfer ? 'high' : 'medium',
      reasonKeys:
        gap < transfer
          ? ['transfer-impossible', 'stage-change']
          : ['transfer-tight', 'stage-change'],
    };
  }

  return null;
}

/**
 * Detect schedule conflicts among My Lineup artists.
 * Missing timetable data becomes schedule-pending — never "no conflicts".
 */
export function detectLineupConflicts(input: {
  selectedArtistIds: string[];
  performances: ClashPerformance[];
  schedulePublished: boolean;
  /** Artists already confirmed into Today's Journey (higher priority). */
  journeyArtistIds?: string[];
  /** Artists deferred ("Keep for Later") — still My Lineup, excluded from route pressure. */
  deferredArtistIds?: string[];
  /** Optional venue stage-pair walking minutes (`stageA->stageB`). */
  stagePairMinutes?: Record<string, number>;
  /** Event-level default transfer when pair unknown. */
  defaultTransferMinutes?: number;
}): LineupConflict[] {
  const selected = normalizeSelectionArtistIds(input.selectedArtistIds);
  const deferred = new Set(input.deferredArtistIds ?? []);
  const journey = new Set(input.journeyArtistIds ?? []);
  const byArtist = new Map<string, ClashPerformance[]>();
  const stagePairs = input.stagePairMinutes;
  const defaultTransfer = input.defaultTransferMinutes;

  for (const perf of input.performances) {
    if (!selected.includes(perf.artistId)) continue;
    const list = byArtist.get(perf.artistId) ?? [];
    list.push(perf);
    byArtist.set(perf.artistId, list);
  }

  const conflicts: LineupConflict[] = [];
  const seen = new Set<string>();

  // Schedule pending: selected artists with no timed slots while others have times,
  // or schedule not published at all.
  const timedIds = new Set(byArtist.keys());
  for (const artistId of selected) {
    if (timedIds.has(artistId)) continue;
    if (!input.schedulePublished && input.performances.length === 0) {
      const id = conflictId('schedule-pending', 'unknown', artistId, artistId);
      if (seen.has(id)) continue;
      seen.add(id);
      conflicts.push({
        id,
        type: 'schedule-pending',
        artistAId: artistId,
        artistBId: artistId,
        artistAName: artistId,
        artistBName: artistId,
        severity: 'low',
        reasonKeys: ['schedule-unavailable'],
        resolutionOptions: [
          {
            id: `later:${artistId}`,
            type: 'decide-later',
            labelKey: 'decide-later',
            itineraryImpact: [],
            warnings: ['schedule-pending'],
          },
        ],
        suggestedOptionId: `later:${artistId}`,
      });
      continue;
    }
    if (input.schedulePublished || input.performances.length > 0) {
      const id = conflictId('schedule-pending', 'pending', artistId, artistId);
      if (seen.has(id)) continue;
      seen.add(id);
      const name =
        input.performances.find((p) => p.artistId === artistId)?.artistName ??
        artistId;
      conflicts.push({
        id,
        type: 'schedule-pending',
        artistAId: artistId,
        artistBId: artistId,
        artistAName: name,
        artistBName: name,
        severity: 'low',
        reasonKeys: ['artist-schedule-pending'],
        resolutionOptions: [
          {
            id: `later:${artistId}`,
            type: 'decide-later',
            labelKey: 'decide-later',
            itineraryImpact: [],
            warnings: ['schedule-pending'],
          },
        ],
        suggestedOptionId: `later:${artistId}`,
      });
    }
  }

  const routeCandidates = selected.filter((id) => !deferred.has(id));
  const slots = routeCandidates
    .map((id) => pickPrimarySlot(byArtist.get(id) ?? []))
    .filter((slot): slot is ClashPerformance => Boolean(slot));

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i]!;
      const b = slots[j]!;
      if (a.dateKey !== b.dateKey) continue;
      const classified = classifyOverlap(a, b, stagePairs, defaultTransfer);
      if (!classified) continue;
      if (seen.has(classified.id)) continue;
      seen.add(classified.id);
      const options = resolutionOptionsForPair(
        a,
        b,
        classified.type,
        stagePairs,
        defaultTransfer,
      );
      conflicts.push({
        ...classified,
        resolutionOptions: options,
        suggestedOptionId: suggestOption(classified, options, journey),
      });
    }
  }

  return prioritizeConflicts(conflicts);
}

function suggestOption(
  conflict: Omit<LineupConflict, 'resolutionOptions' | 'suggestedOptionId'>,
  options: ClashResolutionOption[],
  journey: Set<string>,
): string | undefined {
  const aInJourney = journey.has(conflict.artistAId);
  const bInJourney = journey.has(conflict.artistBId);
  if (aInJourney && !bInJourney) {
    return options.find((o) => o.type === 'keep-artist-a')?.id;
  }
  if (bInJourney && !aInJourney) {
    return options.find((o) => o.type === 'keep-artist-b')?.id;
  }
  const split = options.find((o) => o.type === 'split-both');
  if (split && conflict.type !== 'hard-clash') return split.id;
  return options.find((o) => o.type === 'decide-later')?.id ?? options[0]?.id;
}

export function prioritizeConflicts(
  conflicts: LineupConflict[],
): LineupConflict[] {
  const rank: Record<LineupConflictType, number> = {
    'hard-clash': 0,
    'tight-transfer': 1,
    'partial-clash': 2,
    'schedule-pending': 3,
  };
  const severityRank: Record<ClashSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return [...conflicts].sort(
    (a, b) =>
      rank[a.type] - rank[b.type] ||
      severityRank[a.severity] - severityRank[b.severity] ||
      (a.eventDate ?? '').localeCompare(b.eventDate ?? ''),
  );
}

export function summarizeConflicts(conflicts: LineupConflict[]): {
  total: number;
  hard: number;
  partial: number;
  tightTransfer: number;
  schedulePending: number;
} {
  return {
    total: conflicts.length,
    hard: conflicts.filter((c) => c.type === 'hard-clash').length,
    partial: conflicts.filter((c) => c.type === 'partial-clash').length,
    tightTransfer: conflicts.filter((c) => c.type === 'tight-transfer').length,
    schedulePending: conflicts.filter((c) => c.type === 'schedule-pending')
      .length,
  };
}

/** Route status for a candidate artist against current My Lineup / Journey. */
export function getArtistScheduleStatus(input: {
  artistId: string;
  selectedArtistIds: string[];
  performances: ClashPerformance[];
  schedulePublished: boolean;
  deferredArtistIds?: string[];
  journeyArtistIds?: string[];
  stagePairMinutes?: Record<string, number>;
  defaultTransferMinutes?: number;
}): ArtistScheduleStatus {
  const selected = normalizeSelectionArtistIds(input.selectedArtistIds);
  if (!selected.includes(input.artistId) && selected.length === 0) {
    // Evaluating an unsaved candidate against current lineup.
  }

  const probeIds = selected.includes(input.artistId)
    ? selected
    : [...selected, input.artistId];

  const conflicts = detectLineupConflicts({
    selectedArtistIds: probeIds,
    performances: input.performances,
    schedulePublished: input.schedulePublished,
    deferredArtistIds: input.deferredArtistIds,
    journeyArtistIds: input.journeyArtistIds,
    stagePairMinutes: input.stagePairMinutes,
    defaultTransferMinutes: input.defaultTransferMinutes,
  }).filter(
    (conflict) =>
      conflict.artistAId === input.artistId ||
      conflict.artistBId === input.artistId,
  );

  if (conflicts.some((c) => c.type === 'schedule-pending'))
    return 'schedule-pending';
  if (conflicts.some((c) => c.type === 'hard-clash')) return 'hard-clash';
  if (conflicts.some((c) => c.type === 'partial-clash')) return 'partial-clash';
  if (conflicts.some((c) => c.type === 'tight-transfer'))
    return 'tight-transfer';

  const hasTimed = input.performances.some(
    (p) => p.artistId === input.artistId,
  );
  if (!hasTimed && (input.schedulePublished || input.performances.length > 0)) {
    return 'schedule-pending';
  }
  if (!input.schedulePublished && input.performances.length === 0) {
    return 'schedule-pending';
  }
  return selected.includes(input.artistId) ? 'fits-route' : 'fits-route';
}

export function conflictsInvolvingArtist(
  conflicts: LineupConflict[],
  artistId: string,
): LineupConflict[] {
  return conflicts.filter(
    (conflict) =>
      conflict.artistAId === artistId || conflict.artistBId === artistId,
  );
}

export function groupConflictsByDay(
  conflicts: LineupConflict[],
): Array<{ dateKey: string; conflicts: LineupConflict[] }> {
  const map = new Map<string, LineupConflict[]>();
  for (const conflict of conflicts) {
    const key = conflict.eventDate || 'pending';
    const list = map.get(key) ?? [];
    list.push(conflict);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, list]) => ({ dateKey, conflicts: list }));
}
