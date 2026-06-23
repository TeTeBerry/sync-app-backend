import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventDetailPostDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  location!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  avatar!: string;

  @ApiPropertyOptional()
  body?: string;

  @ApiPropertyOptional()
  recruitStatus?: string;
}

export class EventPostsPageDto {
  @ApiProperty({ type: [EventDetailPostDto] })
  items!: EventDetailPostDto[];

  @ApiPropertyOptional()
  nextCursor?: string;

  @ApiProperty()
  hasMore!: boolean;
}

export class PostCommentItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  authorName!: string;

  @ApiProperty()
  avatar!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  time!: string;
}

export class PostCommentsPageDto {
  @ApiProperty({ type: [PostCommentItemDto] })
  items!: PostCommentItemDto[];

  @ApiProperty()
  hasMore!: boolean;

  @ApiPropertyOptional()
  nextCursor?: string;
}

export class BuddyPostAiSearchResultDto {
  @ApiProperty({ type: [EventDetailPostDto] })
  items!: EventDetailPostDto[];

  @ApiProperty()
  totalMatched!: number;

  @ApiProperty()
  totalScanned!: number;
}

export class PostMutationResultDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  ok?: boolean;
}
