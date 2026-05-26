import type { PindanType } from '../../database/schemas/pindan.schema';

/** 与前端 i18n / 首页展示一致的拼单类型文案 */
export const PINDAN_TYPE_LABEL: Record<PindanType, string> = {
  package: '套餐拼单',
  hotel: '酒店拼单',
  transport: '交通拼单',
};

/** AI 回复中识别用户选择拼单类型的正则片段 */
export const PINDAN_TYPE_LABEL_PATTERN =
  '套餐拼单|酒店拼单|交通拼单|套餐拼|酒店拼|交通拼';
