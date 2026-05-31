import type { ArtistPerformance } from '../../../database/schemas/artist-performance.schema';
import type {
  ItineraryDay,
  ItineraryTimelineItem,
} from '../../../database/schemas/user-itinerary.schema';
import type { FestivalSession } from '../../../database/schemas/festival-session.schema';

const DOT_ROTATION = ['pink', 'cyan', 'purple'] as const;

function buildPerformanceItem(
  perf: ArtistPerformance,
  index: number,
  highlighted: boolean,
): ItineraryTimelineItem {
  const dotColor = DOT_ROTATION[index % DOT_ROTATION.length];
  const timeTag = `${perf.startTime}-${perf.endTime}`;
  return {
    id: `${perf.artistId}-${perf.dateKey}`,
    time: perf.startTime,
    dotColor,
    title: `${perf.artistName} · ${perf.stageLabel}`,
    subtitle: `${perf.genreLabel} · 官方演出时段`,
    timeTag,
    timeTagColor: dotColor,
    ...(highlighted
      ? {
          highlighted: true,
          pill: { label: '重点演出 · 必看', variant: 'pink' as const },
        }
      : {}),
  };
}

export function buildFallbackItinerary(input: {
  eventMeta: string;
  sessions: FestivalSession[];
  performances: ArtistPerformance[];
  selectedDjIds: string[];
  primaryDateKey?: string;
}): { eventMeta: string; days: ItineraryDay[] } {
  const selected = new Set(input.selectedDjIds);
  const dateKeys =
    input.primaryDateKey != null
      ? [
          input.primaryDateKey,
          ...input.sessions
            .map(s => s.dateKey)
            .filter(k => k !== input.primaryDateKey),
        ]
      : input.sessions.map(s => s.dateKey).sort();

  const uniqueDateKeys = [...new Set(dateKeys)];

  const days: ItineraryDay[] = [];

  for (const dateKey of uniqueDateKeys) {
    const session = input.sessions.find(s => s.dateKey === dateKey);
    const dayPerfs = input.performances
      .filter(p => p.dateKey === dateKey && selected.has(p.artistId))
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (dayPerfs.length === 0) continue;

    const items: ItineraryTimelineItem[] = [];

    if (dateKey === input.primaryDateKey || dateKey === uniqueDateKeys[0]) {
      const firstStart = dayPerfs[0]?.startTime ?? '18:00';
      const [h, m] = firstStart.split(':').map(Number);
      const departMinutes = Math.max(0, (h ?? 18) * 60 + (m ?? 0) - 90);
      const departH = Math.floor(departMinutes / 60);
      const departM = departMinutes % 60;
      items.push({
        id: `depart-${dateKey}`,
        time: `${String(departH).padStart(2, '0')}:${String(departM).padStart(2, '0')}`,
        dotColor: 'pink',
        title: '出发前往场馆',
        subtitle: '建议提前 1.5 小时出发，预留安检与入场时间',
        pill: { label: '出行提醒', variant: 'green' },
      });
    }

    dayPerfs.forEach((perf, index) => {
      items.push(buildPerformanceItem(perf, items.length + index, true));
    });

    days.push({
      id: dateKey,
      label: session?.label ?? dateKey,
      bannerDateLabel: session?.bannerDateLabel ?? session?.label ?? dateKey,
      nodeCount: items.length,
      items,
    });
  }

  if (days.length === 0 && input.sessions.length > 0) {
    const session = input.sessions[0];
    days.push({
      id: session.dateKey,
      label: session.label,
      bannerDateLabel: session.bannerDateLabel,
      nodeCount: 1,
      items: [
        {
          id: 'placeholder',
          time: '18:00',
          dotColor: 'pink',
          title: '行程生成中',
          subtitle: '所选 DJ 暂无该日演出排期，请换选日期或艺人',
          pill: { label: '提示', variant: 'green' },
        },
      ],
    });
  }

  return { eventMeta: input.eventMeta, days };
}
