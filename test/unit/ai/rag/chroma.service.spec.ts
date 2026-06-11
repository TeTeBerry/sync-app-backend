jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents-page-content'),
);

import { Document } from '@langchain/core/documents';
import { ChromaService } from '@src/infra/chroma/chroma.service';

describe('ChromaService knowledge query', () => {
  it('returns empty array when collection is unavailable', async () => {
    const service = new ChromaService({ get: jest.fn() } as never);
    await expect(service.query('test query')).resolves.toEqual([]);
  });

  it('maps collection query results to documents', async () => {
    const service = new ChromaService({ get: jest.fn() } as never);
    (
      service as unknown as {
        collection: { query: jest.Mock };
      }
    ).collection = {
      query: jest.fn().mockResolvedValue({
        documents: [['活动知识片段']],
        metadatas: [[{ topic: 'activity', code: 'storm' }]],
      }),
    };

    const docs = await service.query('风暴电音节', 2);

    expect(docs).toEqual([
      new Document({
        pageContent: '活动知识片段',
        metadata: { topic: 'activity', code: 'storm' },
      }),
    ]);
  });
});
