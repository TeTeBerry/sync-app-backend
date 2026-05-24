import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PindanService } from '../../modules/pindan/pindan.service';

export function createPindanTool(pindanService: PindanService) {
  return new DynamicStructuredTool({
    name: 'queryPindan',
    description: '查询开放中的拼单（套餐 package / 酒店 hotel / 交通 transport）',
    schema: z.object({
      activityId: z
        .string()
        .optional()
        .describe('活动 code 或 legacyId 数字字符串，如 edc 或 3'),
      type: z
        .enum(['package', 'hotel', 'transport'])
        .optional()
        .describe('拼单类型'),
      keyword: z.string().optional().describe('标题关键词，如 三亚、接驳'),
    }),
    func: async ({ activityId, type, keyword }) => {
      const rows = await pindanService.searchFromQuery({
        activityId,
        type,
        keyword,
      });
      return rows.length ? JSON.stringify(rows) : '暂无匹配拼单';
    },
  });
}
