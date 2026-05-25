/**
 * 环境变量集中配置
 */
function cleanEnv(value?: string, fallback = ''): string {
  if (!value) return fallback;
  const trimmed = value.split('#')[0]?.trim();
  return trimmed || fallback;
}

export default () => ({
  port: parseInt(cleanEnv(process.env.PORT, '3000'), 10),

  mongodb: {
    uri: cleanEnv(
      process.env.MONGODB_URI ?? process.env.MONGO_URI,
      'mongodb://127.0.0.1:27017/sync',
    ),
  },

  llm: {
    apiKey: cleanEnv(
      process.env.QWEN_API_KEY ??
        process.env.ALIBABA_API_KEY ??
        process.env.DASHSCOPE_API_KEY,
    ),
    model: cleanEnv(process.env.QWEN_MODEL, 'qwen-turbo'),
    vlModel: cleanEnv(process.env.QWEN_VL_MODEL, 'qwen-vl-plus'),
  },

  chroma: {
    path:
      process.env.CHROMA_PATH ?? process.env.CHROMA_DB_PATH ?? './chroma_data',
    url: process.env.CHROMA_URL ?? '',
    collection: process.env.CHROMA_COLLECTION ?? 'sync_knowledge',
  },
});
