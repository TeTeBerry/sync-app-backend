#!/usr/bin/env node
/**
 * 清空测试数据：AI 聊天记录 / session。
 * 保留 activities 种子数据。
 *
 * 用法:
 *   node scripts/reset-test-data.mjs
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sync-ai node scripts/reset-test-data.mjs
 */

import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

async function main() {
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const chats = db.collection('chats');

  const chatResult = await chats.deleteMany({});

  console.log('✅ 测试数据已重置');
  console.log(`   chats 删除: ${chatResult.deletedCount}`);
  console.log('');
  console.log('下一步: 浏览器清除 sessionStorage 键 sync_ai_session，或开无痕窗口');

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('❌ 重置失败:', error.message ?? error);
  process.exit(1);
});
