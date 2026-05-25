#!/usr/bin/env node
/**
 * 清空测试数据：AI 聊天记录 / session、用户挂单、拼单参与记录，并重置拼单人数。
 * 保留 activities 种子数据；tickets 清空后需重启后端以重新写入演示挂单。
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

const PINDAN_JOINED = {
  1: 3,
  2: 2,
  3: 5,
  4: 2,
  5: 1,
  6: 3,
  7: 2,
  8: 4,
  9: 3,
  10: 4,
  11: 2,
  12: 3,
  13: 2,
};

async function main() {
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection.db;
  const chats = db.collection('chats');
  const tickets = db.collection('tickets');
  const pindanjoins = db.collection('pindanjoins');
  const pindans = db.collection('pindans');

  const chatResult = await chats.deleteMany({});
  const ticketResult = await tickets.deleteMany({});
  const joinResult = await pindanjoins.deleteMany({});

  await pindans.updateMany(
    {},
    { $set: { memberUserIds: [] } },
  );

  for (const [legacyId, joined] of Object.entries(PINDAN_JOINED)) {
    await pindans.updateOne(
      { legacyId: Number(legacyId) },
      { $set: { joined, memberUserIds: [] } },
    );
  }

  await pindans.deleteMany({ legacyId: { $gt: 13 } });

  const ticketSeed = [
    {
      activityId: 'tomorrowland',
      userId: 'Mia',
      skuCode: 'VIP B区',
      status: 'open',
      seatOrSlot: { type: 'sell', quantity: 2, price: 880 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      activityId: 'edc',
      userId: 'Leo',
      skuCode: 'GA',
      status: 'open',
      seatOrSlot: { type: 'buy', quantity: 1, price: 560 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      activityId: 's2o',
      userId: 'Zara',
      skuCode: '水上区',
      status: 'open',
      seatOrSlot: { type: 'sell', quantity: 4, price: 420 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      activityId: 'ultra',
      userId: 'Jake',
      skuCode: 'Front Stage',
      status: 'open',
      seatOrSlot: { type: 'buy', quantity: 2, price: 1100 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  await tickets.insertMany(ticketSeed);

  console.log('✅ 测试数据已重置');
  console.log(`   chats 删除: ${chatResult.deletedCount}`);
  console.log(`   tickets 删除: ${ticketResult.deletedCount}，已重新写入演示挂单 ${ticketSeed.length} 条`);
  console.log(`   pindanjoins 删除: ${joinResult.deletedCount}`);
  console.log('   pindans 已重置参与人数');
  console.log('');
  console.log('下一步: 浏览器清除 sessionStorage 键 sync_ai_session，或开无痕窗口');

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('❌ 重置失败:', error.message ?? error);
  process.exit(1);
});
