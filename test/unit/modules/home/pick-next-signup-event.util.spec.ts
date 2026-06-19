import { pickNextRegisteredSignupEvent } from '@src/modules/home/utils/pick-next-signup-event.util';

describe('pickNextRegisteredSignupEvent', () => {
  it('returns nearest upcoming registered event', () => {
    const result = pickNextRegisteredSignupEvent(
      [
        { id: 7, title: 'Later', date: '12/01', going: true },
        { id: 4, title: 'Soon', date: '08/01', going: true },
        { id: 9, title: 'Not going', date: '08/02', going: false },
      ],
      new Date('2026-06-01T12:00:00'),
    );

    expect(result?.id).toBe(4);
  });

  it('returns null when no registered events', () => {
    expect(
      pickNextRegisteredSignupEvent([
        { id: 4, title: 'Fest', date: '08/01', going: false },
      ]),
    ).toBeNull();
  });
});
