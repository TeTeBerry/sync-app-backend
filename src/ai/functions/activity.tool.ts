import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ActivityService } from '../../modules/activity/activity.service';

export function createActivityTool(activityService: ActivityService) {
  return new DynamicStructuredTool({
    name: 'queryActivity',
    description: '查询音乐节活动；keyword 为空或「全部」时返回活动列表',
    schema: z.object({
      keyword: z
        .string()
        .optional()
        .describe('活动关键词或别名；留空返回全部活动'),
    }),
    func: async ({ keyword = '' }) => {
      if (!keyword?.trim() || ['全部', '最近', '列表', '所有'].includes(keyword.trim())) {
        const rows = await activityService.findAll();
        return rows.length ? JSON.stringify(rows) : '暂无活动数据';
      }

      const data = await activityService.matchActivity(keyword);
      return data ? JSON.stringify(data) : '未找到匹配活动';
    },
  });
}
