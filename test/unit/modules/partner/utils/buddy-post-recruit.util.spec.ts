import {
  normalizeRecruitFields,
  parseRecruitSlotsFromText,
} from '@src/modules/partner/utils/buddy-post-recruit.util';

describe('buddy-post-recruit.util', () => {
  it('parses fraction headcount from body text', () => {
    expect(parseRecruitSlotsFromText('组队 1/3 还差两人')).toEqual({
      recruitStatus: 'open',
      slotsFilled: 1,
      slotsTotal: 3,
    });
  });

  it('parses full status from keywords', () => {
    expect(parseRecruitSlotsFromText('组队已满 3/3')).toEqual({
      recruitStatus: 'full',
      slotsFilled: 3,
      slotsTotal: 3,
    });
  });

  it('normalizes explicit create payload', () => {
    expect(
      normalizeRecruitFields({
        recruitStatus: 'open',
        slotsTotal: 3,
        slotsFilled: 1,
      }),
    ).toEqual({
      recruitStatus: 'open',
      slotsTotal: 3,
      slotsFilled: 1,
    });
  });

  it('marks full and fills slots when author closes recruitment', () => {
    expect(
      normalizeRecruitFields({
        recruitStatus: 'full',
        slotsTotal: 2,
      }),
    ).toEqual({
      recruitStatus: 'full',
      slotsTotal: 2,
      slotsFilled: 2,
    });
  });

  it('keeps open when author reopens recruitment despite full slots', () => {
    expect(
      normalizeRecruitFields({
        recruitStatus: 'open',
        slotsTotal: 3,
        slotsFilled: 3,
      }),
    ).toEqual({
      recruitStatus: 'open',
      slotsTotal: 3,
      slotsFilled: 3,
    });
  });

  it('still infers full from slots when status is not explicitly open', () => {
    expect(
      normalizeRecruitFields({
        slotsTotal: 3,
        slotsFilled: 3,
      }),
    ).toEqual({
      recruitStatus: 'full',
      slotsTotal: 3,
      slotsFilled: 3,
    });
  });

  it('clamps slotsFilled to at least 1 when slotsTotal is set', () => {
    expect(
      normalizeRecruitFields({
        recruitStatus: 'open',
        slotsTotal: 3,
        slotsFilled: 0,
      }),
    ).toEqual({
      recruitStatus: 'open',
      slotsTotal: 3,
      slotsFilled: 1,
    });
  });
});
