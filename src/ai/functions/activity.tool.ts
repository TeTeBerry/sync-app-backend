import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ActivityService } from '../../modules/activity/activity.service';

export function createActivityTool(activityService: ActivityService) {
  return new DynamicStructuredTool({
    name: 'queryActivity',
    description: '按关键词查询音乐节活动，如 edc、s2o、ultra',
    schema: z.object({
      keyword: z.string().describe('活动关键词或别名'),
    }),
    func: async ({ keyword }) => {
      const data = await activityService.matchActivity(keyword);
      return data ? JSON.stringify(data) : '未找到匹配活动';
    },
  });
}
