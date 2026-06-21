import {
  PostMapper,
  resolvePostListBodyPreview,
} from '@src/modules/partner/post.mapper';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

function postRecord(
  partial: Partial<PostRecord> & Pick<PostRecord, 'body'>,
): PostRecord {
  return {
    _id: 'post-1',
    userId: 'u1',
    authorName: 'Zara',
    eventTitle: 'Tomorrowland Thailand 2026',
    ...partial,
  } as PostRecord;
}

describe('resolvePostListBodyPreview', () => {
  it('uses stored preview when present', () => {
    const preview = resolvePostListBodyPreview(
      postRecord({
        body: 'full body',
        bodyPreview: 'stored preview',
      }),
    );
    expect(preview).toBe('stored preview');
  });

  it('falls back to body for short posts without preview', () => {
    const preview = resolvePostListBodyPreview(
      postRecord({
        body: '招募中｜12.11-13 TML 泰国，上海出发，目前 1/3',
        bodyPreview: '',
      }),
    );
    expect(preview).toContain('招募中');
  });

  it('truncates long body when preview is missing', () => {
    const longBody = 'a'.repeat(300);
    const preview = resolvePostListBodyPreview(
      postRecord({
        body: longBody,
        bodyPreview: '',
      }),
    );
    expect(preview).toHaveLength(280);
  });
});

describe('PostMapper.toEventDetailListItem', () => {
  it('exposes list preview for short mock posts', () => {
    const item = PostMapper.toEventDetailListItem(
      postRecord({
        body: '组队已满｜上海 Techno 小队 3/3 人齐',
        bodyPreview: '',
      }),
    );
    expect(item.bodyPreview).toContain('组队已满');
  });
});
