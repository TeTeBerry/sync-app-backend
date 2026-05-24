import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  ping() {
    return { ok: true, scope: 'user' };
  }
}
