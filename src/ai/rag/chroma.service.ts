import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection, IncludeEnum, Where } from 'chromadb';
import { Document } from '@langchain/core/documents';
import type { PostStatus } from '../../database/schemas/post.schema';
import { KNOWLEDGE_DOCUMENTS } from './knowledge.seed';

/** Post vector metadata: kind=post, status filters recruiting-only retrieval */
export interface PostEmbeddingInput {
  postId: string;
  userId: string;
  body: string;
  eventTitle: string;
  tags?: string[];
  location?: string;
  activityCode?: string;
  activityLegacyId?: number;
  status?: PostStatus;
}

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

export interface PostMatchQueryOptions {
  activityCode?: string;
  activityLegacyId?: number;
  /** Per-user isolation: self, blocked, already-matched authors */
  excludeUserIds?: string[];
  /** When set, runs a secondary profile-vector query for similarity boost */
  profileUserId?: string;
  n?: number;
}

export interface PostMatchResult {
  postId: string;
  document: string;
  distance?: number;
  /** Distance from user-profile vector query (lower = better profile fit) */
  profileDistance?: number;
  userId?: string;
}

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client?: ChromaClient;
  private collection?: Collection;
  private postsCollection?: Collection;
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
    const postsCollectionName =
      this.config.get<string>('chroma.postsCollection') ?? 'sync_posts';
    const profilesCollectionName =
      this.config.get<string>('chroma.profilesCollection') ??
      'sync_user_profiles';

    if (!baseUrl) {
      this.enabled = false;
      this.logger.warn(
        'Chroma 未配置 HTTP 地址（设置 CHROMA_URL=http://localhost:8000），RAG 已禁用',
      );
      return;
    }

    const connectTimeoutMs = 8_000;

    try {
      await Promise.race([
        this.connectCollections(
          baseUrl,
          collectionName,
          postsCollectionName,
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
        `Chroma connected (${baseUrl}), collections="${collectionName}", "${postsCollectionName}", "${profilesCollectionName}"`,
      );
    } catch (error) {
      this.enabled = false;
      this.logger.warn(
        `Chroma unavailable, RAG disabled: ${(error as Error).message}`,
      );
    }
  }

  private async connectCollections(
    baseUrl: string,
    collectionName: string,
    postsCollectionName: string,
    profilesCollectionName: string,
  ): Promise<void> {
    this.client = new ChromaClient({ path: baseUrl });

    this.collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: { source: 'sync-app-backend' },
      });

      this.postsCollection = await this.client.getOrCreateCollection({
        name: postsCollectionName,
        metadata: { source: 'sync-app-backend', kind: 'posts' },
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

  private buildPostDocument(input: PostEmbeddingInput): string {
    const tags = input.tags?.length ? input.tags.join(' ') : '';
    return [input.eventTitle, input.body, input.location, tags]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private buildUserProfileDocument(input: UserProfileEmbeddingInput): string {
    const genres = input.favorGenres?.length
      ? input.favorGenres.join(' ')
      : '';
    const matePref =
      input.likeMate == null
        ? ''
        : input.likeMate
          ? '希望找搭子一起'
          : '独自前往也可';
    const budget = input.budgetLevel?.trim()
      ? `预算${input.budgetLevel}`
      : '';
    const bioSnippet = input.bio?.trim()
      ? input.bio.trim().slice(0, 200)
      : '';

    return [
      input.city,
      input.location,
      genres,
      matePref,
      budget,
      bioSnippet,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private buildRecruitingPostWhere(
    options: Pick<
      PostMatchQueryOptions,
      'activityCode' | 'activityLegacyId' | 'excludeUserIds'
    >,
  ): Where | undefined {
    const clauses: Where[] = [{ kind: 'post' }, { status: 'recruiting' }];

    if (options.activityLegacyId != null) {
      clauses.push({ activityLegacyId: String(options.activityLegacyId) });
    } else if (options.activityCode?.trim()) {
      clauses.push({ activityCode: options.activityCode.trim() });
    }

    const excluded = (options.excludeUserIds ?? [])
      .map(id => id.trim())
      .filter(Boolean);
    if (excluded.length === 1) {
      clauses.push({ userId: { $ne: excluded[0] } });
    } else if (excluded.length > 1) {
      clauses.push({ userId: { $nin: excluded } });
    }

    return clauses.length === 1 ? clauses[0] : { $and: clauses };
  }

  private mapQueryResults(
    result: Awaited<ReturnType<Collection['query']>>,
  ): PostMatchResult[] {
    const documents = result.documents?.[0] ?? [];
    const metadatas = result.metadatas?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];
    const matches: PostMatchResult[] = [];

    for (let index = 0; index < documents.length; index += 1) {
      const document = documents[index];
      if (!document) continue;

      const metadata = metadatas[index] ?? {};
      const postId =
        String(metadata.postId ?? '') ||
        String(result.ids?.[0]?.[index] ?? '');

      matches.push({
        postId,
        document,
        distance: distances[index],
        userId: metadata.userId ? String(metadata.userId) : undefined,
      });
    }

    return matches;
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

  async upsertPostEmbedding(input: PostEmbeddingInput): Promise<void> {
    if (!this.postsCollection) return;

    const document = this.buildPostDocument(input);
    if (!document) return;

    try {
      await this.postsCollection.upsert({
        ids: [input.postId],
        documents: [document],
        metadatas: [
          {
            kind: 'post',
            topic: 'post',
            postId: input.postId,
            userId: input.userId,
            activityCode: input.activityCode ?? '',
            activityLegacyId:
              input.activityLegacyId != null
                ? String(input.activityLegacyId)
                : '',
            status: input.status ?? 'recruiting',
          },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Chroma post upsert failed (${input.postId}): ${(error as Error).message}`,
      );
    }
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

  async deletePostEmbedding(postId: string): Promise<void> {
    if (!this.postsCollection || !postId) return;

    try {
      await this.postsCollection.delete({ ids: [postId] });
    } catch (error) {
      this.logger.warn(
        `Chroma post delete failed (${postId}): ${(error as Error).message}`,
      );
    }
  }

  /** Remove post vector when no longer eligible for match retrieval */
  async deprecatePostEmbedding(postId: string): Promise<void> {
    await this.deletePostEmbedding(postId);
  }

  async syncPostEmbeddingStatus(input: PostEmbeddingInput): Promise<void> {
    if (input.status !== 'recruiting') {
      await this.deprecatePostEmbedding(input.postId);
      return;
    }

    await this.upsertPostEmbedding(input);
  }

  private async getUserProfileQueryText(
    userId: string,
  ): Promise<string | undefined> {
    if (!this.profilesCollection || !userId.trim()) return undefined;

    try {
      const result = await this.profilesCollection.get({
        ids: [userId.trim()],
        include: [IncludeEnum.Documents],
      });
      return result.documents?.[0] ?? undefined;
    } catch {
      return undefined;
    }
  }

  async queryPostsForMatch(
    text: string,
    options: PostMatchQueryOptions = {},
  ): Promise<PostMatchResult[]> {
    if (!this.postsCollection || !text.trim()) return [];

    const n = options.n ?? 5;
    const where = this.buildRecruitingPostWhere(options);

    try {
      const result = await this.postsCollection.query({
        queryTexts: [text.trim()],
        nResults: n,
        ...(where ? { where } : {}),
      });

      const matches = this.mapQueryResults(result);

      const profileUserId = options.profileUserId?.trim();
      if (!profileUserId || !matches.length) {
        return matches;
      }

      const profileText = await this.getUserProfileQueryText(profileUserId);
      if (!profileText) return matches;

      const profileResult = await this.postsCollection.query({
        queryTexts: [profileText],
        nResults: n,
        ...(where ? { where } : {}),
      });

      const profileDistances = new Map<string, number>();
      const profileDocs = profileResult.documents?.[0] ?? [];
      const profileMetas = profileResult.metadatas?.[0] ?? [];
      const profileDists = profileResult.distances?.[0] ?? [];

      for (let index = 0; index < profileDocs.length; index += 1) {
        const metadata = profileMetas[index] ?? {};
        const postId =
          String(metadata.postId ?? '') ||
          String(profileResult.ids?.[0]?.[index] ?? '');
        if (!postId) continue;
        profileDistances.set(postId, profileDists[index] ?? 0);
      }

      return matches.map(match => ({
        ...match,
        profileDistance: profileDistances.get(match.postId),
      }));
    } catch (error) {
      this.logger.warn(
        `Chroma post match query failed: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /** @deprecated Prefer queryPostsForMatch for activity + user isolation */
  async queryPostsByActivity(
    text: string,
    activityCode: string,
    activityLegacyId?: number,
    n = 5,
  ): Promise<PostMatchResult[]> {
    return this.queryPostsForMatch(text, {
      activityCode,
      activityLegacyId,
      n,
    });
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
