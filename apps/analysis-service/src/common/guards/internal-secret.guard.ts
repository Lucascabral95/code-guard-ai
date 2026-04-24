import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedSecret = this.configService.get<string>('INTERNAL_SECRET');
    if (!expectedSecret) {
      throw new UnauthorizedException('Internal secret is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    return request.header('x-internal-secret') === expectedSecret;
  }
}
