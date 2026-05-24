import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { AlibabaTongyiEmbeddings } from '@langchain/community/embeddings/alibaba_tongyi';
import { ChromaClient } from 'chromadb';
import { KNOWLEDGE_DOCUMENTS } from './knowledge.seed';

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private vectorStore: Chroma | null = null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('llm.apiKey');
    this.enabled = Boolean(apiKey && apiKey !== 'MISSING_API_KEY');
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('LLM API key missing — RAG vector store disabled');
      return;
    }

    try {
      await this.initVectorStore();
      await this.seedIfEmpty();
    } catch (error) {
      this.logger.warn(
        `Chroma init failed (RAG disabled): ${(error as Error).message}`,
      );
      this.vectorStore = null;
    }
  }

  isReady(): boolean {
    return this.vectorStore !== null;
  }

  async query(question: string, k = 3): Promise<string> {
    if (!this.vectorStore || !question.trim()) {
      return '';
    }

    const docs = await this.vectorStore.similaritySearch(question, k);
    if (!docs.length) {
      return '';
    }

    return docs.map(doc => doc.pageContent).join('\n\n');
  }

  private async initVectorStore(): Promise<void> {
    const embeddings = new AlibabaTongyiEmbeddings({
      apiKey: this.config.get<string>('llm.apiKey'),
      modelName: 'text-embedding-v2',
    });

    const chromaUrl = this.config.get<string>('chroma.url');
    const chromaPath = this.config.get<string>('chroma.path');
    const collectionName = this.config.get<string>('chroma.collection');

    const args = chromaUrl
      ? { url: chromaUrl, collectionName }
      : {
          index: new ChromaClient({ path: chromaPath }),
          collectionName,
        };

    this.vectorStore = await Chroma.fromExistingCollection(embeddings, args).catch(
      () => Chroma.fromDocuments([], embeddings, args),
    );

    this.logger.log(`Chroma ready (collection=${collectionName})`);
  }

  private async seedIfEmpty(): Promise<void> {
    if (!this.vectorStore) return;

    const existing = await this.vectorStore.similaritySearch('EDC', 1);
    if (existing.length) return;

    await this.vectorStore.addDocuments(KNOWLEDGE_DOCUMENTS);
    this.logger.log(`Seeded ${KNOWLEDGE_DOCUMENTS.length} knowledge documents`);
  }
}
