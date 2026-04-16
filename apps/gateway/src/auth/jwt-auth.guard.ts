import {
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const PUBLIC_KEY = 'isPublic';

/**
 * 标注接口为公开，跳过 JWT 验证
 * 用法：在 Controller 方法上加 @Public()
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    // 检查 handler 或 class 是否标注了 @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(ctx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(err: unknown, user: any) {
    if (err || !user) {
      throw new UnauthorizedException('请先登录，或 Token 已过期');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
