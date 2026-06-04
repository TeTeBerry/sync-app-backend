import {
  inferContentTypesFromTags,
  inferPostContentTypes,
} from '@src/modules/partner/utils/post-content-type.util';

describe('post-content-type.util (组队发帖标签)', () => {
  it('maps sheet tags to content types', () => {
    expect(inferContentTypesFromTags(['#组队'])).toEqual(['team']);
    expect(inferContentTypesFromTags(['#拼房'])).toEqual(['accommodation']);
    expect(inferContentTypesFromTags(['#同路'])).toEqual(['carpool']);
    expect(inferContentTypesFromTags(['#拼卡'])).toEqual(['carpool']);
  });

  it('supports multiple tags (intersection)', () => {
    const types = inferPostContentTypes({
      tags: ['#组队', '#拼房'],
      body: '找同行',
    });
    expect(types).toContain('team');
    expect(types).toContain('accommodation');
  });

  it('infers team from structured buddy post body', () => {
    const body = [
      '找「风暴电音节」同行',
      '时间：6月13日-14日',
      '地点：上海',
      '人数：2人',
      '类型：#组队 #拼房',
    ].join('\n');
    const types = inferPostContentTypes({
      tags: ['#组队', '#拼房'],
      body,
    });
    expect(types).toContain('team');
    expect(types).toContain('accommodation');
  });
});
