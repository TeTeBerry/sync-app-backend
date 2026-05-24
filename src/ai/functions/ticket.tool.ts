import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { TicketService } from '../../modules/ticket/ticket.service';

export function createTicketTool(ticketService: TicketService) {
  const searchTool = new DynamicStructuredTool({
    name: 'searchTickets',
    description: '搜索在售/求购门票',
    schema: z.object({
      activityId: z.string().optional().describe('活动 code，如 edc'),
      type: z.enum(['sell', 'buy']).optional().describe('sell 出票 / buy 收票'),
    }),
    func: async ({ activityId, type }) => {
      const rows = await ticketService.searchListings({ activityId, type });
      return rows.length ? JSON.stringify(rows) : '暂无相关门票挂单';
    },
  });

  const createTool = new DynamicStructuredTool({
    name: 'createTicketListing',
    description: '创建出票或收票挂单',
    schema: z.object({
      activityId: z.string().describe('活动 code'),
      quantity: z.number().int().min(1).describe('数量'),
      type: z.enum(['sell', 'buy']).describe('sell 出票 / buy 收票'),
      userId: z.string().optional(),
    }),
    func: async ({ activityId, quantity, type, userId }) => {
      const ticket = await ticketService.createListing({
        activityId,
        quantity,
        type,
        userId,
      });
      return JSON.stringify({
        intent: type === 'sell' ? 'sell_ticket' : 'buy_ticket',
        ticket,
        msg: '已创建门票挂单',
      });
    },
  });

  return [searchTool, createTool];
}
