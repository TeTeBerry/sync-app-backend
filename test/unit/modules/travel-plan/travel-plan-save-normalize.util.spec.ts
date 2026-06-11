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
});
