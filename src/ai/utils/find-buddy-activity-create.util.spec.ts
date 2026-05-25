import {
  getMissingActivityCreateFields,
  mergeActivityCreateSlots,
  parseFindBuddyBudget,
  parseFindBuddyGroupSize,
  formatBudgetRangeLabel,
  resolvePerPersonBudget,
} from './find-buddy-activity-create.util';
import { mergeFindBuddyState } from '../parser/find-buddy-merge.util';
import { buildPindanPricePerPerson } from './find-buddy-pindan-create.util';
import type { FindBuddyState } from '../conversation/conversation-state.types';

describe('parseFindBuddyGroupSize', () => {
  it('parses bare 个 forms', () => {
    expect(parseFindBuddyGroupSize('2个')).toBe(2);
    expect(parseFindBuddyGroupSize('3个')).toBe(3);
    expect(parseFindBuddyGroupSize('拼2个')).toBe(2);
  });

  it('parses 人 forms', () => {
    expect(parseFindBuddyGroupSize('2个人')).toBe(2);
    expect(parseFindBuddyGroupSize('2人')).toBe(2);
    expect(parseFindBuddyGroupSize('拼4人')).toBe(4);
  });

  it('parses group size after budget in combined input', () => {
    expect(parseFindBuddyGroupSize('1000-1200，2个')).toBe(2);
    expect(parseFindBuddyGroupSize('预算1000，2个')).toBe(2);
  });

  it('rejects out-of-range and ambiguous 个', () => {
    expect(parseFindBuddyGroupSize('几个')).toBeUndefined();
    expect(parseFindBuddyGroupSize('1个')).toBeUndefined();
    expect(parseFindBuddyGroupSize('1200个')).toBeUndefined();
  });
});

describe('mergeActivityCreateSlots', () => {
  const base: FindBuddyState = {
    phase: 'collect_create_pindan',
    activityId: 'edc',
    joinablePindanIds: [],
  };

  it('fills budget and people from "1000-1200，2个"', () => {
    const merged = mergeActivityCreateSlots(base, '1000-1200，2个');
    expect(parseFindBuddyBudget('1000-1200，2个')).toEqual(
      expect.objectContaining({
        budgetMin: 1000,
        budgetMax: 1200,
        budgetScope: 'total',
      }),
    );
    expect(merged.budgetMin).toBe(1000);
    expect(merged.budgetMax).toBe(1200);
    expect(merged.budgetScope).toBe('total');
    expect(merged.peopleCount).toBe(2);
    expect(getMissingActivityCreateFields(merged)).toEqual([]);
    expect(formatBudgetRangeLabel(merged)).toBe('¥500-600/人');
    expect(resolvePerPersonBudget(merged)).toEqual({
      budgetMin: 500,
      budgetMax: 600,
      budget: 550,
    });
  });

  it('keeps per-person ranges unchanged', () => {
    const merged = mergeActivityCreateSlots(base, '人均500-600，2个');
    expect(merged.budgetScope).toBe('per_person');
    expect(formatBudgetRangeLabel(merged)).toBe('¥500-600/人');
  });

  it('fills people only from "2个"', () => {
    const merged = mergeActivityCreateSlots(base, '2个');
    expect(merged.peopleCount).toBe(2);
    expect(getMissingActivityCreateFields(merged)).toEqual(['budget']);
  });
});

describe('confirm create budget consistency', () => {
  const confirmState: FindBuddyState = {
    phase: 'confirm_create_pindan',
    activityId: 'edc',
    joinablePindanIds: [],
    peopleCount: 2,
    budgetMin: 1000,
    budgetMax: 1200,
    budget: 1100,
    budgetScope: 'total',
  };

  it('preserves budget range fields through mergeFindBuddyState on confirm', () => {
    const merged = mergeFindBuddyState({
      base: confirmState,
      ruleState: confirmState,
      input: '确认创建',
    });

    expect(merged.budgetScope).toBe('total');
    expect(merged.budgetMin).toBe(1000);
    expect(merged.budgetMax).toBe(1200);
    expect(formatBudgetRangeLabel(merged, 2)).toBe('¥500-600/人');
    expect(resolvePerPersonBudget(merged, 2)).toEqual({
      budgetMin: 500,
      budgetMax: 600,
      budget: 550,
    });
    expect(buildPindanPricePerPerson(merged, 2)).toBe(550);
  });

  it('converts single total budget with ±10% for 2 people', () => {
    const merged = mergeActivityCreateSlots(
      { ...confirmState, phase: 'collect_create_pindan' },
      '预算1200，2个',
    );
    expect(merged.budgetScope).toBe('per_person');
    expect(formatBudgetRangeLabel(merged)).toBe('¥1080-1320/人');

    const totalScoped: FindBuddyState = {
      ...merged,
      budgetMin: 1200,
      budgetMax: 1200,
      budget: 1200,
      budgetScope: 'total',
    };
    expect(formatBudgetRangeLabel(totalScoped, 2)).toBe('约¥600/人');
    expect(buildPindanPricePerPerson(totalScoped, 2)).toBe(600);
  });
});
