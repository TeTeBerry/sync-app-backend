const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type EmbeddingPipeline = {
  (
    texts: string[],
    options: { pooling: 'mean'; normalize: true },
  ): Promise<{ tolist(): number[][] }>;
};

type TransformersModule = typeof import('@huggingface/transformers');

let embedder: EmbeddingPipeline | null = null;
let embedderReady = false;
let warmupPromise: Promise<boolean> | null = null;
let embedderLoadPromise: Promise<EmbeddingPipeline> | null = null;
let transformersModule: TransformersModule | null = null;

function resolveHuggingFaceRemoteHost(): string | null {
  const endpoint =
    process.env.HF_ENDPOINT?.trim() ||
    process.env.HUGGINGFACE_HUB_ENDPOINT?.trim();
  if (!endpoint) return null;
  return endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
}

function configureTransformersEnv(env: TransformersModule['env']): void {
  const remoteHost = resolveHuggingFaceRemoteHost();
  if (remoteHost) {
    env.remoteHost = remoteHost;
  }
  env.useFSCache = true;
}

async function getTransformers(): Promise<TransformersModule> {
  transformersModule ??= await import('@huggingface/transformers');
  configureTransformersEnv(transformersModule.env);
  return transformersModule;
}

async function loadEmbedder(): Promise<EmbeddingPipeline> {
  const { pipeline } = await getTransformers();
  const loaded = await (
    pipeline as (
      task: string,
      model: string,
      options: { dtype: string },
    ) => Promise<EmbeddingPipeline>
  )('feature-extraction', EMBEDDING_MODEL, { dtype: 'fp32' });
  return loaded;
}

async function getEmbedder(): Promise<EmbeddingPipeline> {
  embedderLoadPromise ??= loadEmbedder();
  embedder ??= await embedderLoadPromise;
  return embedder;
}

export function isKnowledgeEmbedderReady(): boolean {
  return embedderReady;
}

export async function warmupKnowledgeEmbedder(): Promise<boolean> {
  if (embedderReady) return true;
  warmupPromise ??= (async () => {
    try {
      const vectors = await embedKnowledgeTexts(['warmup']);
      if (!vectors.length || !vectors[0]?.length) {
        throw new Error('embedding returned empty vectors');
      }
      embedderReady = true;
      return true;
    } finally {
      warmupPromise = null;
    }
  })();
  return warmupPromise;
}

export async function embedKnowledgeTexts(
  texts: string[],
): Promise<number[][]> {
  if (!texts.length) return [];

  const embeddingPipeline = await getEmbedder();
  try {
    const output = await embeddingPipeline(texts, {
      pooling: 'mean',
      normalize: true,
    });
    const embeddings = output.tolist() as number[][];
    if (!embeddings.length || !embeddings[0]?.length) {
      throw new Error('embedding returned empty vectors');
    }
    embedderReady = true;
    return embeddings;
  } catch (error) {
    const message = (error as Error).message;
    const transformers = await getTransformers().catch(() => null);
    const host = resolveHuggingFaceRemoteHost() ?? transformers?.env.remoteHost;
    const hint = resolveHuggingFaceRemoteHost()
      ? ''
      : ' (set HF_ENDPOINT=https://hf-mirror.com for CN networks)';
    throw new Error(`embedding model (${host}): ${message}${hint}`);
  }
}
