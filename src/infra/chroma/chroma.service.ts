import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Document } from '@langchain/core/documents';
import { buildStaticKnowledgeDocuments } from './build-static-knowledge-documents.util';
import { buildActivityKnowledgeDocument } from './chroma-activity-document.util';
import { ChromaHttpClient } from './chroma-http.client';
import {
  embedKnowledgeTexts,
  warmupKnowledgeEmbedder,
} from './chroma-embedding.util';

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private httpClient?: ChromaHttpClient;
  private collectionId?: string;
  private collectionName = 'sync_knowledge';
  private enabled = false;
  private embedderReady = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.initClient();
    if (this.enabled) {
      this.embedderReady = await this.warmupEmbedder();
      if (this.embedderReady) {
        await this.seedIfEmpty();
      }
    }
  }

  isEmbedderReady(): boolean {
    return this.embedderReady;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Kept for health checks. */
  isCircuitOpen(): boolean {
    return false;
  }

  private resolveChromaBaseUrl(): string | null {
    const url = this.config.get<string>('chroma.url')?.trim();
    if (url) return url;

    const path = this.config.get<string>('chroma.path')?.trim();
    if (path?.startsWith('http://') || path?.startsWith('https://')) {
      return path;
    }

    return null;
  }

  private async initClient(): Promise<void> {
    const baseUrl = this.resolveChromaBaseUrl();
    this.collectionName =
      this.config.get<string>('chroma.collection') ?? 'sync_knowledge';

    if (!baseUrl) {
      this.enabled = false;
      this.logger.log(
        'RAG optional: CHROMA_URL not set; vector search uses Mongo/rules fallback (set CHROMA_URL=http://localhost:8000 to enable)',
      );
      return;
    }

    const connectTimeoutMs = 8_000;

    try {
      await Promise.race([
        this.connectCollection(baseUrl),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`连接超时（${connectTimeoutMs}ms）`)),
            connectTimeoutMs,
          );
        }),
      ]);

      this.enabled = true;
      this.logger.log(
        `Chroma connected (${baseUrl}), collection="${this.collectionName}"`,
      );
    } catch (error) {
      this.enabled = false;
      this.logger.log(
        `RAG optional: Chroma unreachable at ${baseUrl} (${(error as Error).message}); using Mongo/rules fallback`,
      );
    }
  }

  private async warmupEmbedder(): Promise<boolean> {
    try {
      await warmupKnowledgeEmbedder();
      this.logger.log('Knowledge embedder ready (MiniLM)');
      return true;
    } catch (error) {
      this.logger.warn(
        `Knowledge embedder unavailable: ${(error as Error).message}. ` +
          'Vector RAG disabled; Mongo/rules/DJ alias fallback still work.',
      );
      return false;
    }
  }

  private async connectCollection(baseUrl: string): Promise<void> {
    this.httpClient = new ChromaHttpClient(baseUrl);
    const ok = await this.httpClient.heartbeat();
    if (!ok) {
      throw new Error('heartbeat failed');
    }

    this.collectionId = await this.httpClient.getOrCreateCollection(
      this.collectionName,
      { source: 'sync-app-backend' },
    );
  }

  private docId(doc: Document, index: number): string {
    const code = doc.metadata?.code;
    const topic = doc.metadata?.topic ?? 'general';
    return code ? `${topic}:${code}` : `${topic}:${index}`;
  }

  async seedIfEmpty(): Promise<void> {
    if (!this.httpClient || !this.collectionId) return;

    try {
      const count = await this.httpClient.count(this.collectionId);
      if (count > 0) return;

      const staticDocs = buildStaticKnowledgeDocuments();
      await this.upsertDocuments(staticDocs);
      this.logger.log(`Seeded ${staticDocs.length} knowledge documents`);
    } catch (error) {
      this.logger.warn(`Chroma seed skipped: ${(error as Error).message}`);
    }
  }

  async upsertDocuments(docs: Document[]): Promise<void> {
    if (!this.httpClient || !this.collectionId || !docs.length) return;

    const ids = docs.map((doc, index) => this.docId(doc, index));
    const documents = docs.map((doc) => doc.pageContent);
    const metadatas = docs.map((doc) => ({
      topic: String(doc.metadata?.topic ?? 'general'),
      code: doc.metadata?.code ? String(doc.metadata.code) : '',
    }));

    let embeddings: number[][];
    try {
      embeddings = await embedKnowledgeTexts(documents);
      this.embedderReady = true;
    } catch (error) {
      this.logger.warn(
        `Chroma upsert embed failed: ${(error as Error).message}`,
      );
      return;
    }

    await this.httpClient.upsert(this.collectionId, {
      ids,
      documents,
      metadatas,
      embeddings,
    });
  }

  async upsertActivityKnowledge(input: {
    code: string;
    name: string;
    alias?: string[];
    date?: string;
    location?: string;
    area?: string;
    region?: string;
    activityType?: string;
  }): Promise<void> {
    await this.upsertDocuments([buildActivityKnowledgeDocument(input)]);
  }

  async query(
    text: string,
    n = 3,
    options?: { topics?: string[] },
  ): Promise<Document[]> {
    if (!this.httpClient || !this.collectionId || !text.trim()) return [];
    if (!this.embedderReady) return [];

    try {
      const where =
        options?.topics?.length === 1
          ? { topic: options.topics[0] }
          : options?.topics?.length
            ? { topic: { $in: options.topics } }
            : undefined;

      let queryEmbeddings: number[][];
      try {
        queryEmbeddings = await embedKnowledgeTexts([text.trim()]);
      } catch (error) {
        this.embedderReady = false;
        this.logger.warn(`Chroma embed failed: ${(error as Error).message}`);
        return [];
      }

      const result = await this.httpClient.query(this.collectionId, {
        queryEmbeddings,
        nResults: n,
        where,
      });

      const docs: Document[] = [];
      const documents = result.documents?.[0] ?? [];
      const metadatas = result.metadatas?.[0] ?? [];

      for (let index = 0; index < documents.length; index += 1) {
        const pageContent = documents[index];
        if (!pageContent) continue;
        docs.push(
          new Document({
            pageContent,
            metadata: metadatas[index] ?? {},
          }),
        );
      }

      return docs;
    } catch (error) {
      this.logger.warn(`Chroma HTTP query failed: ${(error as Error).message}`);
      return [];
    }
  }
}
