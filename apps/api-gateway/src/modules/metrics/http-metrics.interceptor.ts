import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        this.record(request, response.statusCode, startedAt);
      }),
      catchError((error: unknown) => {
        const statusCode = errorHasStatus(error) ? error.getStatus() : 500;
        this.record(request, statusCode, startedAt);
        return throwError(() => error);
      }),
    );
  }

  private record(request: Request, statusCode: number, startedAt: bigint) {
    const route = routeForRequest(request);
    if (route === '/metrics') {
      return;
    }

    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    this.metricsService.recordHttpRequest(request.method, route, statusCode, durationSeconds);
  }
}

function routeForRequest(request: Request) {
  const routePath = request.route?.path;
  const path = typeof routePath === 'string' ? routePath : request.path;
  return `${request.baseUrl ?? ''}${path}` || '/';
}

function errorHasStatus(error: unknown): error is { getStatus(): number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof (error as { getStatus?: unknown }).getStatus === 'function'
  );
}
