/**
 * 环境变量集中配置
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),

  mongodb: {
    uri:
      process.env.MONGODB_URI ??
      process.env.MONGO_URI ??
      'mongodb://127.0.0.1:27017/sync',
  },

  llm: {
    apiKey:
      process.env.QWEN_API_KEY ??
      process.env.ALIBABA_API_KEY ??
      process.env.DASHSCOPE_API_KEY ??
      '',
    model: process.env.QWEN_MODEL ?? 'qwen-turbo',
  },

  chroma: {
    path:
      process.env.CHROMA_PATH ?? process.env.CHROMA_DB_PATH ?? './chroma_data',
    url: process.env.CHROMA_URL ?? '',
    collection: process.env.CHROMA_COLLECTION ?? 'sync_knowledge',
  },
});
