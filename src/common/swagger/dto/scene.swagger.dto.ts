import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SceneInsightLineEffectDto {
  @ApiProperty({ enum: ['insight_line'] })
  type!: 'insight_line';

  @ApiProperty()
  text!: string;

  @ApiPropertyOptional({ enum: ['parsed', 'preference'] })
  variant?: 'parsed' | 'preference';

  @ApiPropertyOptional()
  aiGenerated?: boolean;
}

export class SceneReorderPostsEffectDto {
  @ApiProperty({ enum: ['reorder_posts'] })
  type!: 'reorder_posts';

  @ApiProperty({ type: [String] })
  postIds!: string[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  items!: Record<string, unknown>[];

  @ApiProperty()
  totalMatched!: number;

  @ApiProperty()
  totalScanned!: number;
}

export class SceneRunResponseDto {
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: '#/components/schemas/SceneInsightLineEffectDto' },
        { $ref: '#/components/schemas/SceneReorderPostsEffectDto' },
      ],
    },
  })
  effects!: Array<SceneInsightLineEffectDto | SceneReorderPostsEffectDto>;

  @ApiPropertyOptional()
  disclaimer?: string;
}
