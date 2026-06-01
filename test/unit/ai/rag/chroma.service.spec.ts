jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents-page-content'),
);

import { ChromaService } from '@src/ai/rag/chroma.service';

describe('ChromaService circuit breaker', () => {
  it('marks queries degraded and opens circuit after consecutive failures', async () => {
    const service = new ChromaService({ get: jest.fn() } as never);
    (service as unknown as { enabled: boolean }).enabled = true;
    (
      service as unknown as { postsCollection: { query: jest.Mock } }
    ).postsCollection = {
      query: jest.fn().mockRejectedValue(new Error('boom')),
    };

    for (let index = 0; index < 3; index += 1) {
      const result = await service.queryPostsForMatch('test query', { n: 3 });
      expect(result.matches).toEqual([]);
      expect(result.degraded).toBe(true);
    }

    expect(service.isCircuitOpen()).toBe(true);

    const skipped = await service.queryPostsForMatch('test query', { n: 3 });
    expect(skipped.matches).toEqual([]);
    expect(skipped.degraded).toBe(true);
    expect(
      (service as unknown as { postsCollection: { query: jest.Mock } })
        .postsCollection.query,
    ).toHaveBeenCalledTimes(3);
  });
});
