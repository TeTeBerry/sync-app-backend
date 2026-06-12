import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  isAllowedUserUploadImageRef,
  USER_IMAGE_URL_INVALID_MESSAGE,
} from './user-image-ref.util';

@ValidatorConstraint({ name: 'userImageRef', async: false })
export class UserImageRefConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      isAllowedUserUploadImageRef(value)
    );
  }

  defaultMessage(_args: ValidationArguments): string {
    return USER_IMAGE_URL_INVALID_MESSAGE;
  }
}
