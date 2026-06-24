import { normalizeTravelPlanNodesForSave } from '../../../../src/modules/travel-plan/domain/travel-plan-save-normalize.util';

describe('normalizeTravelPlanNodesForSave', () => {
  it('normalizes nodes and swaps inverted date ranges', () => {
    const nodes = normalizeTravelPlanNodesForSave([
      {
        id: 'a',
        category: 'hotel',
        startDate: '2025-06-15',
        endDate: '2025-06-13',
        title: '  入住酒店  ',
        subtitle: '',
        confirmed: false,
      },
    ]);

    expect(nodes).toEqual([
      {
        id: 'a',
        category: 'hotel',
        startDate: '2025-06-13',
        endDate: '2025-06-15',
        title: '入住酒店',
        subtitle: '待补充详情',
        confirmed: false,
      },
    ]);
  });

  it('drops invalid nodes', () => {
    const nodes = normalizeTravelPlanNodesForSave([
      {
        id: '',
        category: 'event',
        startDate: 'bad',
        endDate: '2025-06-13',
        title: '活动',
        subtitle: '副标题',
        confirmed: true,
      },
    ]);

    expect(nodes).toEqual([]);
  });

  it('preserves dining and transport bill line items', () => {
    const nodes = normalizeTravelPlanNodesForSave([
      {
        id: 'dining-1',
        category: 'dining',
        startDate: '2025-06-14',
        endDate: '2025-06-14',
        title: '佳能量 等 2 笔',
        subtitle: '共 2 笔消费',
        detail: '2 笔账单明细',
        price: 42.7,
        confirmed: true,
        diningBills: [
          {
            id: 'dining-bill-1',
            title: '佳能量',
            description: '6/14 12:10',
            cost: 24,
            startDate: '2025-06-14',
            startTime: '12:10',
          },
          {
            id: 'dining-bill-2',
            title: '便利店',
            cost: 18.7,
            startDate: '2025-06-14',
            startTime: '22:42',
          },
        ],
      },
      {
        id: 'transport-1',
        category: 'transport',
        startDate: '2025-06-14',
        endDate: '2025-06-15',
        title: '滴滴出行 等 2 笔',
        subtitle: '共 2 笔打车',
        confirmed: true,
        transportBills: [
          {
            id: 'transport-bill-1',
            title: '滴滴出行',
            cost: 29.9,
            startDate: '2025-06-14',
            startTime: '19:37',
          },
        ],
      },
    ]);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.diningBills).toEqual([
      {
        id: 'dining-bill-1',
        title: '佳能量',
        description: '6/14 12:10',
        cost: 24,
        startDate: '2025-06-14',
        startTime: '12:10',
      },
      {
        id: 'dining-bill-2',
        title: '便利店',
        cost: 18.7,
        startDate: '2025-06-14',
        startTime: '22:42',
      },
    ]);
    expect(nodes[1]?.transportBills).toEqual([
      {
        id: 'transport-bill-1',
        title: '滴滴出行',
        cost: 29.9,
        startDate: '2025-06-14',
        startTime: '19:37',
      },
    ]);
  });

  it('preserves split fields when enabled', () => {
    const nodes = normalizeTravelPlanNodesForSave([
      {
        id: 'dining-split',
        category: 'dining',
        startDate: '2025-06-14',
        endDate: '2025-06-14',
        title: '晚餐',
        subtitle: '4 人分摊',
        price: 860,
        confirmed: true,
        splitEnabled: true,
        splitCount: 4,
      },
      {
        id: 'dining-personal',
        category: 'dining',
        startDate: '2025-06-14',
        endDate: '2025-06-14',
        title: '个人消费',
        subtitle: '不分摊',
        price: 120,
        confirmed: true,
        splitEnabled: false,
        splitCount: 4,
      },
    ]);

    expect(nodes[0]).toMatchObject({
      splitEnabled: true,
      splitCount: 4,
    });
    expect(nodes[1]).not.toHaveProperty('splitEnabled');
    expect(nodes[1]).not.toHaveProperty('splitCount');
  });
});
