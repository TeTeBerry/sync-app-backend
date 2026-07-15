import { presentRavenPlan } from '@src/modules/travel-guide/raven/raven-plan-response.presenter';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

describe('presentRavenPlan', () => {
  it('passes grounded inventory fields and strips internal quote metadata', () => {
    const plan: TravelGuidePlan = {
      activityName: 'Tomorrowland Belgium',
      venue: 'De Schorre',
      eventDates: '07/17-19',
      departure: 'London',
      headcount: 2,
      budgetLabel: 'Comfort',
      accommodationNights: 3,
      selfDrive: false,
      transport: {
        title: 'Flights',
        lines: ['LHR to BRU'],
        flightOffers: [
          {
            pricePerAdult: 100,
            currency: 'USD',
            outbound: {
              route: 'LHR-BRU',
              stopsLabel: 'Direct',
            },
          },
        ],
      },
      accommodation: {
        title: 'Stay',
        hotels: [
          {
            name: 'DreamVille',
            note: 'Official camping',
            reason: 'Closest practical stay',
            bookingHint: 'Official site',
          },
        ],
        schemes: [
          {
            label: 'Best Overall',
            name: 'DreamVille',
            note: 'Official camping',
            reason: 'Closest practical stay',
            bookingHint: 'Official site',
          },
        ],
      },
      nightlife: {
        title: 'Night',
        spots: [
          {
            name: 'Festival grounds',
            note: 'Follow the official schedule',
            reason: 'On-site',
          },
        ],
      },
      tips: { title: 'Tips', items: ['Bring earplugs'] },
      documents: { title: 'Documents', items: ['Passport'] },
      tickets: {
        title: 'Tickets',
        channels: [{ name: 'Official', note: 'tomorrowland.com' }],
      },
      essentials: {
        title: 'Essentials',
        network: ['eSIM'],
        payment: ['Card'],
        apps: ['Maps'],
      },
      budgetTierSnapshots: [],
      quoteTierSources: { standard: 'rollinggo' },
      hotelByTier: {},
      flightByTier: {},
    };

    const presented = presentRavenPlan(plan);

    expect(presented).toEqual({
      activityName: 'Tomorrowland Belgium',
      venue: 'De Schorre',
      eventDates: '07/17-19',
      departure: 'London',
      headcount: 2,
      budgetLabel: 'Comfort',
      accommodationNights: 3,
      selfDrive: false,
      transport: {
        title: 'Flights',
        lines: ['LHR to BRU'],
        flightOffers: [
          {
            pricePerAdult: 100,
            currency: 'USD',
            outbound: {
              route: 'LHR-BRU',
              stopsLabel: 'Direct',
            },
          },
        ],
      },
      accommodation: {
        title: 'Stay',
        hotels: [
          {
            name: 'DreamVille',
            note: 'Official camping',
            reason: 'Closest practical stay',
            bookingHint: 'Official site',
          },
        ],
        schemes: [
          {
            label: 'Best Overall',
            name: 'DreamVille',
            note: 'Official camping',
            reason: 'Closest practical stay',
            bookingHint: 'Official site',
          },
        ],
      },
      tips: { title: 'Tips', items: ['Bring earplugs'] },
      documents: { title: 'Documents', items: ['Passport'] },
      tickets: {
        title: 'Tickets',
        channels: [{ name: 'Official', note: 'tomorrowland.com' }],
      },
      essentials: {
        title: 'Essentials',
        network: ['eSIM'],
        payment: ['Card'],
        apps: ['Maps'],
      },
    });

    expect(presented).not.toHaveProperty('budgetTierSnapshots');
    expect(presented).not.toHaveProperty('quoteTierSources');
    expect(presented).not.toHaveProperty('hotelByTier');
    expect(presented).not.toHaveProperty('flightByTier');
  });
});
