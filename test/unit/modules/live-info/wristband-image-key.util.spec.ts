import {
  wristbandImageFileKey,
  wristbandImageUrlRegex,
} from '../../../../src/modules/live-info/utils/wristband-image-key.util';

describe('wristbandImageFileKey', () => {
  it('extracts filename from upload URL', () => {
    expect(
      wristbandImageFileKey('http://192.168.1.7:3000/uploads/abc-def.jpg'),
    ).toBe('abc-def.jpg');
    expect(
      wristbandImageFileKey('http://127.0.0.1:3000/uploads/ABC-DEF.JPG'),
    ).toBe('abc-def.jpg');
  });

  it('builds regex that matches equivalent upload paths', () => {
    const key = wristbandImageFileKey('http://localhost:3000/uploads/wb-1.png');
    const re = wristbandImageUrlRegex(key);
    expect(re.test('http://127.0.0.1:3000/uploads/wb-1.png')).toBe(true);
    expect(re.test('http://localhost:3000/uploads/other.png')).toBe(false);
  });
});
