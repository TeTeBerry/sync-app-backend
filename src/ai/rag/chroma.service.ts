import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';
import { Document } from '@langchain/core/documents';
import { KNOWLEDGE_DOCUMENTS } from './knowledge.seed';

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client?: ChromaClient;
  private collection?: Collection;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.initClient();
    await this.seedIfEmpty();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async initClient(): Promise<void> {
    const url = this.config.get<string>('chroma.url')?.trim();
    const path = this.config.get<string>('chroma.path')?.trim() ?? './chroma_data';
    const collectionName =
      this.config.get<string>('chroma.collection') ?? 'sync_knowledge';

    try {
      this.client = url
        ? new ChromaClient({ path: url })
        : new ChromaClient({ path });

      this.collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: { source: 'sync-app-backend' },
      });
      this.enabled = true;
      this.logger.log(
        `Chroma connected (${url || path}), collection="${collectionName}"`,
      );
    } catch (error) {
      this.enabled = false;
      this.logger.warn(
        `Chroma unavailable, RAG disabled: ${(error as Error).message}`,
      );
    }
  }

  private docId(doc: Document, index: number): string {
    const code = doc.metadata?.code;
    const topic = doc.metadata?.topic ?? 'general';
    return code ? `${topic}:${code}` : `${topic}:${index}`;
  }

  async seedIfEmpty(): Promise<void> {
    if (!this.collection) return;

    try {
      const count = await this.collection.count();
      if (count > 0) return;

      await this.upsertDocuments(KNOWLEDGE_DOCUMENTS);
      this.logger.log(`Seeded ${KNOWLEDGE_DOCUMENTS.length} knowledge documents`);
    } catch (error) {
      this.logger.warn(`Chroma seed skipped: ${(error as Error).message}`);
    }
  }

  async upsertDocuments(docs: Document[]): Promise<void> {
    if (!this.collection || !docs.length) return;

    const ids = docs.map((doc, index) => this.docId(doc, index));
    const documents = docs.map(doc => doc.pageContent);
    const metadatas = docs.map(doc => ({
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
      pageContent: `${input.name}（${input.code}）${dateText}${locationText}${aliasText}`.trim(),
      metadata: { topic: 'activity', code: input.code },
    });

    await this.upsertDocuments([doc]);
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
