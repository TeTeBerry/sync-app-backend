import { Document } from '@langchain/core/documents';
import { ChromaService } from '@src/infra/chroma/chroma.service';

jest.mock('@src/infra/chroma/chroma-embedding.util', () => ({
  embedKnowledgeTexts: jest.fn(async (texts: string[]) =>
    texts.map(() => [0.1, 0.2, 0.3]),
  ),
  warmupKnowledgeEmbedder: jest.fn(async () => true),
}));

describe('ChromaService knowledge query', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns empty array when collection is unavailable', async () => {
    const service = new ChromaService({ get: jest.fn() } as never);
    await expect(service.query('test query')).resolves.toEqual([]);
  });

  it('maps HTTP query results to documents', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/heartbeat')) {
        return { ok: true, json: async () => ({}) };
      }
      if (url.endsWith('/collections') && init?.method !== 'POST') {
        return {
          ok: true,
          json: async () => [{ id: 'col-1', name: 'sync_knowledge' }],
        };
      }
      if (url.endsWith('/count')) {
        return { ok: true, json: async () => 1 };
      }
      if (url.endsWith('/query')) {
        return {
          ok: true,
          json: async () => ({
            documents: [['活动知识片段']],
            metadatas: [[{ topic: 'activity', code: 'storm' }]],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const service = new ChromaService({
      get: jest.fn((key: string) => {
        if (key === 'chroma.url') return 'http://localhost:8000';
        if (key === 'chroma.collection') return 'sync_knowledge';
        return '';
      }),
    } as never);

    await service.onModuleInit();

    const docs = await service.query('风暴电音节', 2);

    expect(docs).toEqual([
      new Document({
        pageContent: '活动知识片段',
        metadata: { topic: 'activity', code: 'storm' },
      }),
    ]);
  });
});
