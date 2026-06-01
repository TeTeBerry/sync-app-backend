import { DEMO_OWNER_USER_ID } from './demo-owner.util';

export type AuthorGender = 'female' | 'male';

const FEMALE_DEMO_USER_IDS = new Set([
  DEMO_OWNER_USER_ID,
  'demo-luna',
  'demo-mia',
  'demo-jade',
  'demo-nova-storm',
]);

const MALE_DEMO_USER_IDS = new Set([
  'demo-ryan',
  'demo-sam',
  'demo-sean',
  'demo-leo',
  'demo-kai',
  'demo-alex',
]);

const FEMALE_NAME_HINTS = [
  'luna',
  'zara',
  'mia',
  'jade',
  'nova',
  'chen',
  'anna',
  'lily',
];

const MALE_NAME_HINTS = [
  'ryan',
  'sam',
  'sean',
  'leo',
  'kai',
  'alex',
  'tom',
  'jack',
  'max',
];

export function inferAuthorGenderFromPost(post: {
  userId?: string;
  authorName?: string;
  body?: string;
  tags?: string[];
}): AuthorGender | undefined {
  const userId = post.userId?.trim();
  if (userId && FEMALE_DEMO_USER_IDS.has(userId)) return 'female';
  if (userId && MALE_DEMO_USER_IDS.has(userId)) return 'male';

  const haystack = [...(post.tags ?? []), post.body ?? ''].join(' ');

  if (
    /(\d+)人女生|女生同行|我们女生|女生一起|飞深圳.*女生/i.test(haystack) &&
    !/男生女生都可|男女都可/i.test(haystack)
  ) {
    return 'female';
  }

  if (
    /(\d+)缺\d*男生|缺\d*男生|(\d+)人男生|男生拼车|男生同行|北京出发.*男生/i.test(
      haystack,
    ) &&
    !/男生女生都可|男女都可/i.test(haystack)
  ) {
    return 'male';
  }

  if (/女生优先|限女生|只要女生|女孩子更好|女生更好/i.test(haystack)) {
    return 'female';
  }

  const name = post.authorName?.trim().toLowerCase() ?? '';
  if (!name) return undefined;

  const firstToken = name.split(/\s+/)[0] ?? name;
  if (FEMALE_NAME_HINTS.some((hint) => firstToken.includes(hint))) {
    return 'female';
  }
  if (MALE_NAME_HINTS.some((hint) => firstToken.includes(hint))) {
    return 'male';
  }

  return undefined;
}
