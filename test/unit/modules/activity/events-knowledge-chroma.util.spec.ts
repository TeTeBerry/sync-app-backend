import { Document } from '@langchain/core/documents';
import { mergeChromaActivityHints } from '../../../../src/modules/activity/utils/events-knowledge-chroma.util';
import type { ActivityLookupRecord } from '../../../../src/modules/activity/ports/activity-lookup.port';

function activity(
  partial: Partial<ActivityLookupRecord> &
    Pick<ActivityLookupRecord, 'legacyId' | 'name' | 'code'>,
): ActivityLookupRecord {
  return {
    alias: [],
    hot: false,
    attendees: 0,
    activityType: 'festival',
    ...partial,
  } as ActivityLookupRecord;
}

describe('mergeChromaActivityHints', () => {
  const catalog = [
    activity({ legacyId: 1, name: 'STORM', code: 'storm' }),
    activity({ legacyId: 8, name: 'EDC Korea', code: 'edc-korea' }),
  ];

  it('appends activities hinted by chroma metadata code', () => {
    const matched = [catalog[0]];
    const chromaDocs = [
      new Document({
        pageContent: 'EDC Korea FAQ',
        metadata: { topic: 'activity', code: 'edc-korea' },
      }),
    ];

    const merged = mergeChromaActivityHints(matched, chromaDocs, catalog);

    expect(merged.map((item) => item.code)).toEqual(['storm', 'edc-korea']);
  });

  it('returns matched unchanged when chroma is empty', () => {
    const matched = [catalog[0]];
    expect(mergeChromaActivityHints(matched, [], catalog)).toEqual(matched);
  });
});
