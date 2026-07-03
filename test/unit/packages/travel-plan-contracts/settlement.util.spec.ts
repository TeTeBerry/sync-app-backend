import {
  computeTravelPlanSettlement,
  sumSplitEnabledNodePrices,
  sumTravelPlanNodePrices,
} from '@sync/travel-plan-contracts';

describe('travel-plan settlement util', () => {
  it('computes net balances and greedy transfer suggestions', () => {
    const result = computeTravelPlanSettlement({
      memberIds: ['alice', 'bob', 'carol'],
      nodes: [
        {
          id: 'dinner',
          category: 'dining',
          startDate: '2026-03-14',
          endDate: '2026-03-14',
          title: '晚餐',
          subtitle: '',
          confirmed: true,
          price: 900,
          splitEnabled: true,
          splitAmong: ['alice', 'bob', 'carol'],
          paidBy: 'alice',
          createdBy: 'alice',
        },
        {
          id: 'taxi',
          category: 'transport',
          startDate: '2026-03-14',
          endDate: '2026-03-14',
          title: '打车',
          subtitle: '',
          confirmed: true,
          price: 120,
          splitEnabled: true,
          splitAmong: ['alice', 'bob'],
          paidBy: 'bob',
          createdBy: 'bob',
        },
      ],
    });

    expect(result.splitTotal).toBe(1020);
    expect(result.balances).toEqual(
      expect.arrayContaining([
        { userId: 'alice', balance: 540 },
        { userId: 'bob', balance: -240 },
        { userId: 'carol', balance: -300 },
      ]),
    );
    expect(result.transfers).toEqual([
      { fromUserId: 'carol', toUserId: 'alice', amount: 300 },
      { fromUserId: 'bob', toUserId: 'alice', amount: 240 },
    ]);
  });

  it('ignores personal-only and zero-price nodes', () => {
    const result = computeTravelPlanSettlement({
      memberIds: ['alice', 'bob'],
      nodes: [
        {
          id: 'solo',
          category: 'dining',
          startDate: '2026-03-14',
          endDate: '2026-03-14',
          title: '个人消费',
          subtitle: '',
          confirmed: true,
          price: 200,
          splitEnabled: false,
        },
        {
          id: 'free',
          category: 'event',
          startDate: '2026-03-15',
          endDate: '2026-03-15',
          title: '活动',
          subtitle: '',
          confirmed: true,
          price: 0,
          splitEnabled: true,
          splitAmong: ['alice', 'bob'],
          paidBy: 'alice',
        },
      ],
    });

    expect(result.splitTotal).toBe(0);
    expect(result.balances).toEqual([]);
    expect(result.transfers).toEqual([]);
  });

  it('defaults payer to createdBy when paidBy is missing', () => {
    const result = computeTravelPlanSettlement({
      memberIds: ['alice', 'bob'],
      nodes: [
        {
          id: 'meal',
          category: 'dining',
          startDate: '2026-03-14',
          endDate: '2026-03-14',
          title: '午餐',
          subtitle: '',
          confirmed: true,
          price: 200,
          splitEnabled: true,
          splitAmong: ['alice', 'bob'],
          createdBy: 'bob',
        },
      ],
    });

    expect(result.balances).toEqual(
      expect.arrayContaining([
        { userId: 'alice', balance: -100 },
        { userId: 'bob', balance: 100 },
      ]),
    );
  });

  it('sums all node prices and split-enabled totals', () => {
    const nodes = [
      {
        id: 'a',
        category: 'hotel' as const,
        startDate: '2026-03-14',
        endDate: '2026-03-15',
        title: '酒店',
        subtitle: '',
        confirmed: true,
        price: 800,
        splitEnabled: true,
      },
      {
        id: 'b',
        category: 'dining' as const,
        startDate: '2026-03-14',
        endDate: '2026-03-14',
        title: '个人',
        subtitle: '',
        confirmed: true,
        price: 50,
        splitEnabled: false,
      },
    ];

    expect(sumTravelPlanNodePrices(nodes)).toBe(850);
    expect(sumSplitEnabledNodePrices(nodes)).toBe(800);
  });
});
