import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const path = `${req.originalUrl ?? ''}`;
    /** SSE：避免把流式正文包成 `{ code, message, data }` */
    if (path.includes('/api/ai/chat')) {
      return next.handle();
    }
    return next.handle().pipe(
      map(data => ({
        code: 200,
        message: 'success',
        data,
      })),
    );
  }
}
