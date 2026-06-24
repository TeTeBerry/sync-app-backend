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
    activity({
      legacyId: 1,
      name: 'STORM',
      code: 'storm',
      date: '06/13-14',
    }),
    activity({
      legacyId: 8,
      name: 'EDC Korea',
      code: 'edc-korea',
      date: '09/12-14',
    }),
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

  it('skips chroma hints outside parsed month or already ended', () => {
    const matched = [
      activity({
        legacyId: 9,
        name: 'Ultra Japan 2026',
        code: 'ultra-japan',
        date: '09/19-20',
      }),
    ];
    const chromaDocs = [
      new Document({
        pageContent: 'STORM FAQ',
        metadata: { topic: 'activity', code: 'storm' },
      }),
    ];
    const now = new Date('2026-06-25T12:00:00');

    const merged = mergeChromaActivityHints(
      matched,
      chromaDocs,
      catalog,
      { month: 9 },
      now,
    );

    expect(merged.map((item) => item.code)).toEqual(['ultra-japan']);
  });

  it('returns matched unchanged when chroma is empty', () => {
    const matched = [catalog[0]];
    expect(mergeChromaActivityHints(matched, [], catalog)).toEqual(matched);
  });
});
