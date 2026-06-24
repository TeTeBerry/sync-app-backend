import {
  buildDjKnowledgeDocuments,
  buildFestivalCorpusDocuments,
  buildStaticKnowledgeDocuments,
} from '../../../../src/infra/chroma/build-static-knowledge-documents.util';

describe('buildStaticKnowledgeDocuments', () => {
  it('builds per-DJ documents instead of one monolithic alias blob', () => {
    const djDocs = buildDjKnowledgeDocuments();
    expect(djDocs.length).toBeGreaterThanOrEqual(28);
    expect(djDocs.every((doc) => doc.metadata?.topic === 'dj')).toBe(true);
    expect(djDocs.some((doc) => doc.pageContent.includes('小马丁'))).toBe(true);
    expect(djDocs.some((doc) => doc.metadata?.code === 'martin-garrix')).toBe(
      true,
    );
  });

  it('includes story, lineup_hint and survival topics for catalog codes', () => {
    const corpus = buildFestivalCorpusDocuments();
    const topics = new Set(corpus.map((doc) => doc.metadata?.topic));
    expect(topics.has('story')).toBe(true);
    expect(topics.has('lineup_hint')).toBe(true);
    expect(topics.has('survival')).toBe(true);
    expect(
      corpus.some(
        (doc) =>
          doc.metadata?.code === 'storm' && doc.metadata?.topic === 'story',
      ),
    ).toBe(true);
  });

  it('static bundle is festival corpus plus dj docs', () => {
    const all = buildStaticKnowledgeDocuments();
    expect(all.length).toBe(
      buildFestivalCorpusDocuments().length +
        buildDjKnowledgeDocuments().length,
    );
  });
});
