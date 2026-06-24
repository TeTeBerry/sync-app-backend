import { ChromaHttpClient } from '../../../../src/infra/chroma/chroma-http.client';

describe('ChromaHttpClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('queries with server-side query_texts', async () => {
    const client = new ChromaHttpClient('http://localhost:8000');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [['风暴电音节 FAQ']],
        metadatas: [[{ topic: 'activity', code: 'storm' }]],
      }),
    });

    const result = await client.query('collection-id', {
      queryEmbeddings: [[0.1, 0.2, 0.3]],
      nResults: 2,
      where: { topic: 'activity' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/collections/collection-id/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query_embeddings: [[0.1, 0.2, 0.3]],
          n_results: 2,
          where: { topic: 'activity' },
        }),
      }),
    );
    expect(result.documents?.[0]?.[0]).toBe('风暴电音节 FAQ');
  });
});
