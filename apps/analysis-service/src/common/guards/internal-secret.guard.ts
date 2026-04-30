import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { envs } from '../../config/envs';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedSecret = envs.internalSecret;
    if (!expectedSecret) {
      throw new UnauthorizedException('Internal secret is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    return request.header('x-internal-secret') === expectedSecret;
  }
}
