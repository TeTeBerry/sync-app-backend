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

  @ApiPropertyOptional({ type: [String] })
  recruitUnityTags?: string[];
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

export class BuddyPostComposeCandidateDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  text!: string;

  @ApiPropertyOptional({ enum: ['code', 'slogan'] })
  style?: 'code' | 'slogan';
}

export class BuddyPostAiComposeResultDto {
  @ApiProperty({ type: [BuddyPostComposeCandidateDto] })
  candidates!: BuddyPostComposeCandidateDto[];

  @ApiProperty()
  disclaimer!: string;

  @ApiProperty()
  aiGenerated!: true;
}

export class PostMutationResultDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  ok?: boolean;
}
