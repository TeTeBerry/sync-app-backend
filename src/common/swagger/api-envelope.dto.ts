import { ApiProperty } from '@nestjs/swagger';

/** Matches TransformInterceptor output: { code, message, data }. */
export class ApiEnvelopeDto {
  @ApiProperty({ example: 200 })
  code!: number;

  @ApiProperty({ example: 'success' })
  message!: string;

  @ApiProperty({ description: 'Response payload' })
  data!: unknown;
}
