import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';

export interface TicketToolContext {
  userId?: string;
  userName?: string;
  onCreated?: (ticketId: string) => void;
}

export function createTicketTool(
  ticketService: TicketService,
  activityService: ActivityService,
  context: TicketToolContext = {},
) {
  const searchTool = new DynamicStructuredTool({
    name: 'searchTickets',
    description:
      '【查询门票必调】搜索平台在售/求购门票挂单。用户询问某活动有没有票、票价、谁出票、想买票、查门票列表时，必须先调用本工具再回答；禁止编造票价或挂单。activityId 用活动 code（edc/s2o/ultra/tomorrowland/edc-thailand），不确定时先 queryActivity。type: sell=他人出票（用户想买时查 sell），buy=他人收票。',
    schema: z.object({
      activityId: z
        .string()
        .optional()
        .describe('活动 code，如 edc、edc-thailand、s2o；留空查全部'),
      type: z
        .enum(['sell', 'buy'])
        .optional()
        .describe('sell=查出票挂单；buy=查收票挂单；用户想买票时通常查 sell'),
    }),
    func: async ({ activityId, type }) => {
      const rows = await ticketService.searchListings({
        activityId: activityId?.toLowerCase().trim() || undefined,
        type,
      });
      return rows.length ? JSON.stringify(rows) : '暂无相关门票挂单';
    },
  });

  const createTool = new DynamicStructuredTool({
    name: 'createTicketListing',
    description:
      '【必须调用】创建出票/收票挂单并写入数据库。用户确认信息（如回复「好的」）或信息已齐全时，必须调用本工具，禁止只用文字声称已创建。activityId 用活动 code（edc/s2o/ultra/tomorrowland），不确定时先 queryActivity。',
    schema: z.object({
      activityId: z.string().describe('活动 code，如 edc、s2o'),
      quantity: z
        .number()
        .int()
        .min(1)
        .describe('门票数量'),
      type: z.enum(['sell', 'buy']).describe('sell 出票 / buy 收票'),
      skuCode: z.string().describe('票种，如 双日票、单日票、GA'),
      price: z
        .number()
        .positive()
        .describe('单价（元）'),
      eventDate: z.string().describe('演出日期，如 2025-03-02'),
      contact: z
        .string()
        .min(1)
        .describe('联系方式（微信号或手机号），必须向用户确认后填写'),
    }),
    func: async ({
      activityId,
      quantity,
      type,
      skuCode,
      price,
      eventDate,
      contact,
    }) => {
      const activity =
        (await activityService.matchActivity(activityId)) ??
        (await activityService.findByCode(activityId));
      if (!activity?.code) {
        return JSON.stringify({
          ok: false,
          error: `未找到活动「${activityId}」，请用户提供更准确的活动名称（如 EDC China、S2O）`,
        });
      }

      const ticket = await ticketService.createListing({
        activityId: activity.code,
        quantity,
        type,
        skuCode,
        price,
        eventDate,
        contact,
        userId: context.userId,
        userName: context.userName,
      });

      const ticketId = String(ticket._id ?? '');
      if (!ticketId) {
        return JSON.stringify({
          ok: false,
          error: '挂单写入失败，请稍后重试',
        });
      }

      context.onCreated?.(ticketId);

      return JSON.stringify({
        ok: true,
        intent: type === 'sell' ? 'sell_ticket' : 'buy_ticket',
        ticket,
        ticketId,
        activityName: activity.name,
        msg: '已创建门票挂单，可在门票出/收列表查看',
      });
    },
  });

  return [searchTool, createTool];
}
