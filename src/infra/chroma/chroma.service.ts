import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';
import { Document } from '@langchain/core/documents';
import { KNOWLEDGE_DOCUMENTS } from './knowledge.seed';

/** User profile vector metadata: kind=user_profile, keyed by userId */
export interface UserProfileEmbeddingInput {
  userId: string;
  city?: string;
  favorGenres?: string[];
  likeMate?: boolean;
  bio?: string;
  budgetLevel?: string;
  location?: string;
}

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client?: ChromaClient;
  private collection?: Collection;
  private profilesCollection?: Collection;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.initClient();
    await this.seedIfEmpty();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Kept for health checks; post-match circuit breaker removed. */
  isCircuitOpen(): boolean {
    return false;
  }

  /** Chroma JS 客户端的 path 必须是 HTTP 基址，不能是本地目录 */
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
    const collectionName =
      this.config.get<string>('chroma.collection') ?? 'sync_knowledge';
    const profilesCollectionName =
      this.config.get<string>('chroma.profilesCollection') ??
      'sync_user_profiles';

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
        this.connectCollections(
          baseUrl,
          collectionName,
          profilesCollectionName,
        ),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`连接超时（${connectTimeoutMs}ms）`)),
            connectTimeoutMs,
          );
        }),
      ]);

      this.enabled = true;
      this.logger.log(
        `Chroma connected (${baseUrl}), collections="${collectionName}", "${profilesCollectionName}"`,
      );
    } catch (error) {
      this.enabled = false;
      this.logger.log(
        `RAG optional: Chroma unreachable at ${baseUrl} (${(error as Error).message}); using Mongo/rules fallback`,
      );
    }
  }

  private async connectCollections(
    baseUrl: string,
    collectionName: string,
    profilesCollectionName: string,
  ): Promise<void> {
    this.client = new ChromaClient({ path: baseUrl });

    this.collection = await this.client.getOrCreateCollection({
      name: collectionName,
      metadata: { source: 'sync-app-backend' },
    });

    this.profilesCollection = await this.client.getOrCreateCollection({
      name: profilesCollectionName,
      metadata: { source: 'sync-app-backend', kind: 'user_profiles' },
    });
  }

  private docId(doc: Document, index: number): string {
    const code = doc.metadata?.code;
    const topic = doc.metadata?.topic ?? 'general';
    return code ? `${topic}:${code}` : `${topic}:${index}`;
  }

  private buildUserProfileDocument(input: UserProfileEmbeddingInput): string {
    const genres = input.favorGenres?.length ? input.favorGenres.join(' ') : '';
    const matePref =
      input.likeMate == null
        ? ''
        : input.likeMate
          ? '希望找搭子一起'
          : '独自前往也可';
    const budget = input.budgetLevel?.trim() ? `预算${input.budgetLevel}` : '';
    const bioSnippet = input.bio?.trim() ? input.bio.trim().slice(0, 200) : '';

    return [input.city, input.location, genres, matePref, budget, bioSnippet]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  async seedIfEmpty(): Promise<void> {
    if (!this.collection) return;

    try {
      const count = await this.collection.count();
      if (count > 0) return;

      await this.upsertDocuments(KNOWLEDGE_DOCUMENTS);
      this.logger.log(
        `Seeded ${KNOWLEDGE_DOCUMENTS.length} knowledge documents`,
      );
    } catch (error) {
      this.logger.warn(`Chroma seed skipped: ${(error as Error).message}`);
    }
  }

  async upsertDocuments(docs: Document[]): Promise<void> {
    if (!this.collection || !docs.length) return;

    const ids = docs.map((doc, index) => this.docId(doc, index));
    const documents = docs.map((doc) => doc.pageContent);
    const metadatas = docs.map((doc) => ({
      topic: String(doc.metadata?.topic ?? 'general'),
      code: doc.metadata?.code ? String(doc.metadata.code) : '',
    }));

    await this.collection.upsert({ ids, documents, metadatas });
  }

  async upsertActivityKnowledge(input: {
    code: string;
    name: string;
    alias?: string[];
    date?: string;
    location?: string;
  }): Promise<void> {
    const aliasText = input.alias?.length
      ? `别名：${input.alias.join('、')}。`
      : '';
    const dateText = input.date ? `档期：${input.date}。` : '';
    const locationText = input.location ? `地点：${input.location}。` : '';

    const doc = new Document({
      pageContent:
        `${input.name}（${input.code}）${dateText}${locationText}${aliasText}`.trim(),
      metadata: { topic: 'activity', code: input.code },
    });

    await this.upsertDocuments([doc]);
  }

  async upsertUserProfileEmbedding(
    input: UserProfileEmbeddingInput,
  ): Promise<void> {
    if (!this.profilesCollection || !input.userId.trim()) return;

    const document = this.buildUserProfileDocument(input);
    if (!document) return;

    const userId = input.userId.trim();

    try {
      await this.profilesCollection.upsert({
        ids: [userId],
        documents: [document],
        metadatas: [
          {
            kind: 'user_profile',
            userId,
            city: input.city ?? '',
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Chroma profile upsert failed (${userId}): ${(error as Error).message}`,
      );
    }
  }

  async query(text: string, n = 3): Promise<Document[]> {
    if (!this.collection || !text.trim()) return [];

    try {
      const result = await this.collection.query({
        queryTexts: [text.trim()],
        nResults: n,
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
      this.logger.warn(`Chroma query failed: ${(error as Error).message}`);
      return [];
    }
  }
}
