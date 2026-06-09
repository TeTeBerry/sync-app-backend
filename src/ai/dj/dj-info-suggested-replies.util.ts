import type {
  DjInfoStructuredIntent,
  DjInfoStructuredQuery,
} from './dj-info-structured.types';

const MAX_SUGGESTIONS = 3;

export function buildDjInfoSuggestedReplies(params: {
  query: DjInfoStructuredQuery;
  activityLegacyId?: number;
}): string[] {
  const artist =
    params.query.artistName?.trim() || params.query.referenceArtist?.trim();
  const replies: string[] = [];

  const push = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && !replies.includes(trimmed)) {
      replies.push(trimmed);
    }
  };

  switch (params.query.intent as DjInfoStructuredIntent) {
    case 'artist_profile':
      if (artist) {
        push(`${artist} 近期演出`);
        push('找类似风格的 DJ');
        push(`${artist} 代表作有哪些`);
      }
      break;
    case 'artist_performances':
      if (artist) {
        push('找类似风格的 DJ');
        push(`${artist} 是什么风格`);
        push(`${artist} 代表作有哪些`);
      }
      break;
    case 'artist_discography':
      if (artist) {
        push(`${artist} 近期演出`);
        push(`${artist} 是什么风格`);
        push('找类似风格的 DJ');
      }
      break;
    case 'similar_artists':
      if (artist) {
        push(`${artist} 近期演出`);
      }
      push(
        params.activityLegacyId != null
          ? '这场阵容有哪些 DJ'
          : '风暴电音节阵容',
      );
      break;
    case 'by_style':
    case 'lineup_by_style':
      if (params.query.styles[0]) {
        push(`还有哪些 ${params.query.styles[0]} DJ`);
      }
      if (artist) {
        push(`${artist} 近期演出`);
      }
      break;
    case 'lineup_overview':
      push('这场有哪些 Techno DJ');
      if (artist) {
        push(`${artist} 是什么风格`);
      }
      break;
    default:
      if (artist) {
        push(`${artist} 近期演出`);
        push('找类似风格的 DJ');
      }
      break;
  }

  return replies.slice(0, MAX_SUGGESTIONS);
}
