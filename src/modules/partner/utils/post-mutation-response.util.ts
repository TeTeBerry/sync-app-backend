import { PostMapper } from '../post.mapper';
import type { PostRecord } from '../interfaces/post.repository.interface';

export type PostEventDetailDto = ReturnType<
  typeof PostMapper.toEventDetailItem
>;

export type PostMutationResponseDto = {
  post: PostEventDetailDto;
};

export function toPostMutationResponse(
  post: PostRecord,
  liked: boolean,
  appliedByMe = false,
): PostMutationResponseDto {
  return { post: PostMapper.toEventDetailItem(post, liked, appliedByMe) };
}
