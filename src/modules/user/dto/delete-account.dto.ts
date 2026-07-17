import { Equals, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @Equals('DELETE', { message: 'Type DELETE to confirm account deletion.' })
  confirmation!: string;
}
