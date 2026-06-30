import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectAvatarMusicBrainzIds,
  isTheAudioDbHomonymBio,
  isShapedTheAudioDbHomonymStub,
  scoreTheAudioDbSearchCandidate,
  shapeTheAudioDbCandidate,
} from '../../../scripts/lib/theaudiodb-avatars.mjs';
import { PREFERRED_MB_BY_LINEUP } from '../../../scripts/lib/lineup-rejected-discogs.mjs';

const FISHER_HOMONYM_BIO =
  'There are 4 artists called Fisher:\n\n1) Paul Fisher aka Fisher (OZ) is a producer';

describe('theaudiodb-avatars', () => {
  it('detects merged homonym biography pages', () => {
    assert.equal(isTheAudioDbHomonymBio(FISHER_HOMONYM_BIO), true);
    assert.equal(
      isTheAudioDbHomonymBio('Australian house DJ and producer.'),
      false,
    );
  });

  it('penalizes low-follower homonym stubs during search ranking', () => {
    const wrongStub = {
      strArtist: 'Fisher',
      strBiography: FISHER_HOMONYM_BIO,
      strGenre: '',
      intFollowers: '4164',
    };
    const popular = {
      strArtist: 'FISHER',
      strBiography: FISHER_HOMONYM_BIO,
      strGenre: '',
      intFollowers: '1089713',
    };
    assert.ok(
      scoreTheAudioDbSearchCandidate('FISHER', popular) >
        scoreTheAudioDbSearchCandidate('FISHER', wrongStub),
    );
  });

  it('shapes candidate metadata used by avatar genre gate', () => {
    const shaped = shapeTheAudioDbCandidate(
      {
        idArtist: '177101',
        strArtist: 'FISHER',
        strArtistThumb: 'https://example.com/fisher.jpg',
        strBiography: FISHER_HOMONYM_BIO,
        intFollowers: '1089713',
        strCountryCode: 'AU',
      },
      { query: 'mb:test', score: 100, searchVia: 'musicbrainz' },
    );
    assert.equal(shaped.theAudioDbArtistId, '177101');
    assert.equal(shaped.followers, 1089713);
    assert.equal(shaped.countryCode, 'AU');
    assert.equal(shaped.searchVia, 'musicbrainz');
  });

  it('collects preferred MB id for FISHER lineup billing', () => {
    assert.deepEqual(collectAvatarMusicBrainzIds('FISHER', []), [
      PREFERRED_MB_BY_LINEUP.FISHER.mbid,
    ]);
  });

  it('rejects shaped homonym stub candidates', () => {
    assert.equal(
      isShapedTheAudioDbHomonymStub({
        biography:
          'There are 4 artists called Fisher:\n\n1) Paul Fisher aka Fisher (OZ) is a producer',
        genres: [],
        followers: 4164,
      }),
      true,
    );
  });
});
