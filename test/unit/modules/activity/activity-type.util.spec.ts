import {
  getActivityTypeLabel,
  resolveActivityType,
} from '@src/modules/activity/utils/activity-type.util';

describe('activity-type.util', () => {
  it('defaults to festival', () => {
    expect(resolveActivityType()).toBe('festival');
    expect(getActivityTypeLabel()).toBe('电音节');
  });

  it('maps indoor type to label', () => {
    expect(resolveActivityType('indoor')).toBe('indoor');
    expect(getActivityTypeLabel('indoor')).toBe('室内电音');
    expect(getActivityTypeLabel('室内电音')).toBe('室内电音');
  });
});
