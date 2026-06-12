import { UserImageRefConstraint } from '../../../common/media/user-image-ref.constraint';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'notDataUrl', async: false })
class NotDataUrlConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return (
      typeof value === 'string' &&
      !value.trim().toLowerCase().startsWith('data:')
    );
  }

  defaultMessage(): string {
    return '请使用上传后的图片 URL，不支持 Base64';
  }
}

export class SubmitLiveInfoWristbandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Validate(UserImageRefConstraint)
  @Validate(NotDataUrlConstraint)
  imageUrl!: string;
}
