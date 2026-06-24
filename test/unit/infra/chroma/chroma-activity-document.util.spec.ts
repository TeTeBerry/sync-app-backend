import { buildActivityKnowledgeDocument } from '../../../../src/infra/chroma/chroma-activity-document.util';

describe('buildActivityKnowledgeDocument', () => {
  it('includes catalog fields for vector retrieval', () => {
    const doc = buildActivityKnowledgeDocument({
      code: 'edc-korea',
      name: 'EDC Korea 2026',
      alias: ['edc korea', '韩国edc'],
      date: '2026-10-03',
      location: '韩国仁川',
      area: '韩国',
      region: 'overseas',
    });

    expect(doc.pageContent).toContain('EDC Korea 2026');
    expect(doc.pageContent).toContain('edc-korea');
    expect(doc.pageContent).toContain('韩国仁川');
    expect(doc.pageContent).toContain('韩国edc');
    expect(doc.pageContent).toContain('曲风气质');
    expect(doc.metadata).toEqual({ topic: 'activity', code: 'edc-korea' });
  });
});
