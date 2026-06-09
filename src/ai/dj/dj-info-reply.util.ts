import type {
  DjCatalogItem,
  DjRepresentativeWork,
} from '../../modules/dj/dj.types';

type LineupDj = {
  name: string;
  genreLabel?: string;
  genre?: string;
};

export function formatDjProfileReply(item: DjCatalogItem): string {
  const styleText =
    item.styles.length > 0
      ? item.styles.join(' · ')
      : item.genres.length > 0
        ? item.genres.join(' · ')
        : '暂无公开风格标签';
  const country = item.country?.trim() ? ` · ${item.country.trim()}` : '';
  const profile = item.profile?.trim() ? `\n${item.profile.trim()}` : '';
  return `${item.name}${country}\n🎧 风格：${styleText}${profile}`;
}

export function formatDjListReply(params: {
  title: string;
  items: Array<{ name: string; styleLabel: string }>;
  total: number;
  truncated: boolean;
}): string {
  if (!params.items.length) {
    return `${params.title}\n暂未找到匹配的 DJ，可以换个风格或艺名试试。`;
  }

  const lines = params.items.map(
    (item) => `· ${item.name} — ${item.styleLabel || '风格待补充'}`,
  );
  const suffix = params.truncated
    ? `\n… 共 ${params.total} 位，先展示前 ${params.items.length} 位`
    : '';
  return `${params.title}\n${lines.join('\n')}${suffix}`;
}

export function lineupDjStyleLabel(dj: LineupDj): string {
  return dj.genreLabel?.trim() || dj.genre?.trim() || '风格待补充';
}

export function formatArtistDiscographyReply(params: {
  artistName: string;
  works: DjRepresentativeWork[];
}): string {
  const title = `🎵 ${params.artistName} 代表作`;
  if (!params.works.length) {
    return `${title}\n暂未收录该艺人的曲目列表，可以先问风格或近期演出。`;
  }

  const lines = params.works.map((work) => {
    const year = work.year ? ` (${work.year})` : '';
    const trackLines = work.tracks
      .slice(0, 5)
      .map((track) => `  · ${track}`)
      .join('\n');
    return trackLines
      ? `· ${work.title}${year}\n${trackLines}`
      : `· ${work.title}${year}`;
  });

  return `${title}\n${lines.join('\n')}`;
}

export function formatArtistPerformancesReply(params: {
  artistName: string;
  items: Array<{
    activityName: string;
    dateLabel: string;
    stageLabel: string;
    startTime: string;
    endTime: string;
    genreLabel: string;
  }>;
}): string {
  const title = `🎤 ${params.artistName} 近期演出安排`;
  if (!params.items.length) {
    return `${title}\n暂未在平台收录的活动阵容中找到该艺人的场次。可以问「风暴电音节阵容」或指定音乐节。`;
  }

  const lines = params.items.map(
    (item) =>
      `· ${item.activityName} · ${item.dateLabel} · ${item.stageLabel} · ${item.startTime}-${item.endTime}`,
  );
  return `${title}\n${lines.join('\n')}`;
}
