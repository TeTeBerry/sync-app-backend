/**
 * 迁移脚本：为存量帖子补 contentTypes 字段
 * 用法：node scripts/migrate-post-content-types.mjs
 */
import { MongoClient } from 'mongodb';

const MONGO_URI =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

/** 标签/快捷词 → 内容类型映射 */
const TAG_TO_TYPE = {
  '组队队友': 'team',
  '组队': 'team',
  '找队友': 'team',
  '求组队': 'team',
  '住宿同行': 'accommodation',
  '拼房': 'accommodation',
  '拼房同行': 'accommodation',
  '住宿': 'accommodation',
  '酒店': 'accommodation',
  '拼车同行': 'carpool',
  '拼车': 'carpool',
  '顺路': 'carpool',
  '顺风车': 'carpool',
};

/** 正文关键词 → 内容类型映射 */
const BODY_PATTERNS = [
  { pattern: /拼房|住宿|酒店|同房|合住/i, type: 'accommodation' },
  { pattern: /拼车|顺路|顺风车|接送|包车/i, type: 'carpool' },
  { pattern: /组队|找队友|求组队|搭子|结伴|同行/i, type: 'team' },
];

function inferContentTypesFromTags(tags) {
  const types = new Set();
  for (const tag of tags ?? []) {
    const normalized = tag.replace(/^#/, '').trim();
    const type = TAG_TO_TYPE[normalized];
    if (type) types.add(type);
  }
  return [...types];
}

function inferContentTypesFromBody(body) {
  const text = (body ?? '').trim();
  if (!text) return [];
  const types = new Set();
  for (const { pattern, type } of BODY_PATTERNS) {
    if (pattern.test(text)) types.add(type);
  }
  return [...types];
}

function inferPostContentTypes(post) {
  const allTypes = new Set();
  for (const t of inferContentTypesFromTags(post.tags)) allTypes.add(t);
  for (const t of inferContentTypesFromBody(post.body)) allTypes.add(t);
  const result = [...allTypes];
  return result.length ? result : ['other'];
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const posts = db.collection('posts');

    // 查找没有 contentTypes 或 contentTypes 为空的帖子
    const cursor = posts.find({
      $or: [
        { contentTypes: { $exists: false } },
        { contentTypes: { $size: 0 } },
      ],
    });

    let updated = 0;
    let scanned = 0;

    for await (const post of cursor) {
      scanned++;
      const contentTypes = inferPostContentTypes(post);
      await posts.updateOne(
        { _id: post._id },
        { $set: { contentTypes } },
      );
      updated++;
      if (updated % 100 === 0) {
        console.log(`Progress: ${updated} posts updated...`);
      }
    }

    console.log(`\nMigration complete:`);
    console.log(`  Scanned: ${scanned} posts`);
    console.log(`  Updated: ${updated} posts`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
