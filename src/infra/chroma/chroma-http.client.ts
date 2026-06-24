type ChromaCollectionRecord = {
  id: string;
  name: string;
};

type ChromaQueryResponse = {
  documents?: (string | null)[][];
  metadatas?: (Record<string, string> | null)[][];
};

export class ChromaHttpClient {
  constructor(private readonly baseUrl: string) {}

  private apiUrl(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/api/v1${path}`;
  }

  async heartbeat(): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl('/heartbeat'));
      return response.ok;
    } catch {
      return false;
    }
  }

  async getOrCreateCollection(
    name: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const listResponse = await fetch(this.apiUrl('/collections'));
    if (!listResponse.ok) {
      throw new Error(`Chroma list collections failed: ${listResponse.status}`);
    }

    const collections = (await listResponse.json()) as ChromaCollectionRecord[];
    const existing = collections.find((collection) => collection.name === name);
    if (existing?.id) return existing.id;

    const createResponse = await fetch(this.apiUrl('/collections'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, metadata: metadata ?? {} }),
    });
    if (!createResponse.ok) {
      throw new Error(
        `Chroma create collection failed: ${createResponse.status}`,
      );
    }

    const created = (await createResponse.json()) as ChromaCollectionRecord;
    return created.id;
  }

  async count(collectionId: string): Promise<number> {
    const response = await fetch(
      this.apiUrl(`/collections/${collectionId}/count`),
    );
    if (!response.ok) {
      throw new Error(`Chroma count failed: ${response.status}`);
    }
    return Number(await response.json());
  }

  async upsert(
    collectionId: string,
    input: {
      ids: string[];
      documents: string[];
      metadatas: Record<string, string>[];
      embeddings: number[][];
    },
  ): Promise<void> {
    const response = await fetch(
      this.apiUrl(`/collections/${collectionId}/upsert`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: input.ids,
          documents: input.documents,
          metadatas: input.metadatas,
          embeddings: input.embeddings,
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Chroma upsert failed: ${response.status} ${body}`);
    }
  }

  async query(
    collectionId: string,
    input: {
      queryEmbeddings: number[][];
      nResults: number;
      where?: Record<string, unknown>;
    },
  ): Promise<ChromaQueryResponse> {
    const response = await fetch(
      this.apiUrl(`/collections/${collectionId}/query`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_embeddings: input.queryEmbeddings,
          n_results: input.nResults,
          ...(input.where ? { where: input.where } : {}),
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Chroma query failed: ${response.status} ${body}`);
    }
    return (await response.json()) as ChromaQueryResponse;
  }
}
