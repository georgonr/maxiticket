import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResolveImageUrlsInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.walk(data)));
  }

  private walk(val: unknown): unknown {
    if (typeof val === 'string') {
      if (val.startsWith('/v1/uploads/')) {
        const base = this.config.get('PUBLIC_API_URL', 'https://api.ticketall.eu');
        return `${base}${val}`;
      }
      return val;
    }
    if (Array.isArray(val)) return val.map((item) => this.walk(item));
    if (this.isPlainObject(val)) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        result[k] = this.walk(v);
      }
      return result;
    }
    return val;
  }

  private isPlainObject(val: unknown): boolean {
    if (!val || typeof val !== 'object') return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
  }
}
