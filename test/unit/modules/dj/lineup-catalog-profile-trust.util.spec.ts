import {
  extractProfilePrimaryName,
  isLineupCatalogProfileTrusted,
  isLineupNameUsedAsAliasInProfile,
  profileLeadsWithLineupName,
} from '@src/modules/dj/lineup-catalog-profile-trust.util';

describe('lineup-catalog-profile-trust.util', () => {
  const marshaSmithProfileZh =
    'Marsha Smith 是一位常驻英国伦敦的 DJ、电台主持人、音乐顾问、音乐监制、导师、人脉拓展及创意开发者，亦以艺名 Marshmello 为人熟知。';

  it('rejects profiles that describe lineup name as an alias', () => {
    expect(
      isLineupNameUsedAsAliasInProfile('MARSHMELLO', marshaSmithProfileZh),
    ).toBe(true);
    expect(
      isLineupCatalogProfileTrusted('MARSHMELLO', {
        name: 'Marshmello',
        profile: marshaSmithProfileZh,
      }),
    ).toBe(false);
  });

  it('accepts profiles that lead with the lineup artist name', () => {
    const profile =
      'Marshmello（Christopher Comstock）是美国电子制作人兼 DJ，风格涵盖 Future Bass 与 Melodic Trap。';
    expect(profileLeadsWithLineupName('MARSHMELLO', profile)).toBe(true);
    expect(
      isLineupCatalogProfileTrusted('MARSHMELLO', {
        name: 'Marshmello',
        profile,
      }),
    ).toBe(true);
  });

  it('rejects profiles whose primary subject is a different person', () => {
    expect(extractProfilePrimaryName(marshaSmithProfileZh)).toBe(
      'Marsha Smith',
    );
    expect(
      isLineupCatalogProfileTrusted('MARSHMELLO', {
        name: 'Marshmello',
        profile: marshaSmithProfileZh,
      }),
    ).toBe(false);
  });

  it('rejects Discogs disambiguation stub pages', () => {
    expect(
      isLineupCatalogProfileTrusted('ALAN WALKER', {
        name: 'Alan Walker',
        profile:
          'For the British-Norwegian DJ and electronic music producer use [a4827622]',
      }),
    ).toBe(false);
  });
});
