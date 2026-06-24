import { env as TransformersEnv, pipeline } from '@huggingface/transformers';

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type EmbeddingPipeline = {
  (
    texts: string[],
    options: { pooling: 'mean'; normalize: true },
  ): Promise<{ tolist(): number[][] }>;
};

let embedder: EmbeddingPipeline | null = null;
let embedderReady = false;
let warmupPromise: Promise<boolean> | null = null;
let embedderLoadPromise: Promise<EmbeddingPipeline> | null = null;

function resolveHuggingFaceRemoteHost(): string | null {
  const endpoint =
    process.env.HF_ENDPOINT?.trim() ||
    process.env.HUGGINGFACE_HUB_ENDPOINT?.trim();
  if (!endpoint) return null;
  return endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
}

function configureTransformersEnv(): void {
  const remoteHost = resolveHuggingFaceRemoteHost();
  if (remoteHost) {
    TransformersEnv.remoteHost = remoteHost;
  }
  TransformersEnv.useFSCache = true;
}

async function loadEmbedder(): Promise<EmbeddingPipeline> {
  configureTransformersEnv();
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
    const host = resolveHuggingFaceRemoteHost() ?? TransformersEnv.remoteHost;
    const hint = resolveHuggingFaceRemoteHost()
      ? ''
      : ' (set HF_ENDPOINT=https://hf-mirror.com for CN networks)';
    throw new Error(`embedding model (${host}): ${message}${hint}`);
  }
}
