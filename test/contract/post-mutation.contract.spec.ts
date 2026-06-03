import * as fs from 'fs';
import * as path from 'path';
import { toPostMutationResponse } from '@src/modules/partner/utils/post-mutation-response.util';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

const contractPath = path.resolve(
  __dirname,
  '../../../contracts/post-mutation.contract.json',
);
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as {
  required: string[];
  properties: { post: { required: string[] } };
};

describe('post-mutation.contract.json', () => {
  it('matches PostMutationResponseDto from like/comment mapper', () => {
    const post = {
      _id: 'post-contract-1',
      userId: 'demo-user',
      authorName: 'Demo',
      body: 'test',
      eventTitle: 'Event',
      likes: 3,
      comments: 1,
      status: 'recruiting',
      tags: [],
      contentTypes: ['team'],
      images: [],
      listedInFeed: true,
    } as unknown as PostRecord;

    const response = toPostMutationResponse(post, true, false);

    expect(contract.required).toContain('post');
    for (const field of contract.properties.post.required) {
      expect(response.post).toHaveProperty(field);
    }
    expect(response.post.id).toBe('post-contract-1');
    expect(response.post.liked).toBe(true);
    expect(response.post.likes).toBe(3);
  });
});
