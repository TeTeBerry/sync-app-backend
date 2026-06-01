import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './auth.constants';

/** Skip JWT guard (login, health, anonymous reads). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
