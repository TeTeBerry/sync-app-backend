import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendTeamChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
